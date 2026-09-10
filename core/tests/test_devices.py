import json
import hashlib
import shlex
import threading
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from core.app import create_app
from core.devices import Devices, DeviceInput, DeviceAction, private_address
from core.device_network import DeviceNetwork
from core.tests.test_core import config, db
from core import mcp


def definition(**kw):
    return DeviceInput.model_validate({'name':'Testgerät','provider':'android-adb','transport':'usb','serial':'TEST-USB',**kw})


def save_existing(devices, d, **kw):
    data = {k:v for k,v in d.items() if k in DeviceInput.model_fields}
    return devices.save(DeviceInput.model_validate({**data,**kw}))


def ready(devices, monkeypatch, **kw):
    monkeypatch.setattr(devices, 'android', lambda *args: {'ok':True,'status':'connected'})
    d = devices.save(definition(**kw))
    devices.execute(d['id'], DeviceAction(action='connect'))
    return save_existing(devices, devices.get(d['id']), enabled=True)


def test_empty_migration_and_reload(config, db):
    before = db.get('control/state.json')
    a = Devices(db, config)
    assert a.list()['devices'] == []
    d = a.save(definition(enabled=True))
    assert d['enabled'] is False
    assert Devices(db, config).get(d['id']) == d
    assert db.get('control/state.json') == before
    db.put(a.key, {'schema':99,'devices':[]})
    with pytest.raises(ValueError, match='neuere'):
        a.list()


def test_permissions_projects_workers_and_revocation(config, db, monkeypatch):
    devices = Devices(db,config)
    d = ready(devices,monkeypatch)
    assert devices.list('default','codex')['devices'][0]['id'] == d['id']
    assert devices.list('other','codex')['devices'] == []
    assert devices.list('default','claude')['devices'] == []
    for project,worker,action in [('other','codex','status'),('default','claude','status'),('default','codex','shell'),('default','codex','pair')]:
        with pytest.raises(ValueError,match='nicht freigegeben'):
            devices.execute(d['id'],DeviceAction(action=action),project,worker)
    devices.execute(d['id'],DeviceAction(action='status'),'default','codex')
    devices.revoke(d['id'])
    with pytest.raises(ValueError,match='nicht freigegeben'):
        devices.execute(d['id'],DeviceAction(action='key',key='home'),'default','codex')
    assert any(e['outcome']=='denied' for e in devices.state()['audit'])


def test_edit_target_resets_approval_conflict_and_remove(config, db, monkeypatch):
    devices = Devices(db,config); d = ready(devices,monkeypatch)
    newer = save_existing(devices,d,serial='OTHER-USB')
    assert not newer['enabled'] and newer['status']=='unchecked'
    with pytest.raises(FileExistsError):
        save_existing(devices,d,name='Stale')
    with pytest.raises(ValueError,match='zuerst'):
        save_existing(devices,newer,enabled=True)
    with pytest.raises(FileExistsError):
        devices.remove(d['id'],d['revision'])
    devices.remove(newer['id'],newer['revision'])
    assert devices.get(d['id']) is None


def test_revoke_during_io_is_immediate_and_survives_completion(config, db, monkeypatch):
    devices = Devices(db,config); d = ready(devices,monkeypatch)
    entered=threading.Event();release=threading.Event()
    def slow(*a):
        entered.set(); assert release.wait(3);return {'status':'connected'}
    monkeypatch.setattr(devices,'android',slow)
    thread=threading.Thread(target=lambda:devices.execute(d['id'],DeviceAction(action='status'),'default','codex'))
    thread.start();assert entered.wait(2)
    devices.revoke(d['id']);release.set();thread.join(3)
    assert not thread.is_alive() and not devices.get(d['id'])['enabled']


def test_pair_code_never_in_argv_registry_or_audit(config, db, monkeypatch):
    devices = Devices(db,config)
    monkeypatch.setattr('core.devices.private_address',lambda _: '192.168.1.9')
    calls=[]
    monkeypatch.setattr(devices,'adb',lambda args,**kw:calls.append((args,kw)) or 'Successfully paired')
    d=devices.save(definition(transport='network',serial='',host='android.local',port=41234))
    devices.execute(d['id'],DeviceAction(action='pair',pairingPort=42345,code='123456'))
    assert calls == [(['pair','192.168.1.9:42345'],{'stdin':'123456\n'})]
    assert '123456' not in json.dumps(devices.state())
    assert devices.get(d['id'])['status']=='paired'


def test_adb_remote_shell_quoting_and_explicit_target(config, db, monkeypatch):
    devices=Devices(db,config); calls=[]
    monkeypatch.setattr(devices,'adb',lambda args,**kw: 'TEST-SERIAL' if 'getprop' in args[-1] else (calls.append(args) or ''))
    d={**definition().model_dump(),'deviceIdentity':hashlib.sha256(b'TEST-SERIAL').hexdigest()}
    devices.android(d,DeviceAction(action='text',text="a; $(echo oops) 'b'"))
    assert calls[0][:3] == ['-s','TEST-USB','shell']
    assert shlex.split(calls[0][3]) == ['input','text',"a;%s$(echo%soops)%s'b'"]
    for bad in ('%', '\n', 'ä'):
        with pytest.raises(ValueError): devices.android(d,DeviceAction(action='text',text=bad))
    with pytest.raises(ValueError): devices.android(d,DeviceAction(action='key',key='; rm'))
    with pytest.raises(ValueError): devices.android(d,DeviceAction(action='launch',component='x/y; echo bad'))


@pytest.mark.parametrize('bad',[{'host':'--help','transport':'network'},{'serial':'-x'},{'allowPublic':True},{'permissions':['root']},{'workers':[]},{'port':0},{'name':'  '},{'unknown':True}])
def test_invalid_config(bad):
    with pytest.raises(ValueError): definition(**bad)


@pytest.mark.parametrize('ip',['127.0.0.1','169.254.169.254','8.8.8.8','::1'])
def test_private_target_check(ip,monkeypatch):
    monkeypatch.setattr('socket.getaddrinfo',lambda *a,**k:[(2,1,6,'',(ip,0))])
    with pytest.raises(ValueError): private_address('test.local')


def test_private_tailnet(monkeypatch):
    monkeypatch.setattr('socket.getaddrinfo',lambda *a,**k:[(2,1,6,'',('100.100.1.2',0))])
    assert private_address('test.local')=='100.100.1.2'


def test_owner_routes_and_internal_tool_auth(config,monkeypatch):
    app=create_app(config); client=TestClient(app)
    d=definition().model_dump()
    assert client.post('/api/devices/save',json=d).status_code==403
    token=client.get('/api/auth/session').json()['token']
    headers={'x-uwe-token':token}
    result=client.post('/api/devices/save',json=d,headers=headers)
    assert result.status_code==200
    id=result.json()['id']
    assert client.post('/internal/devices/tool',json={}).status_code==403
    assert client.post('/api/devices/'+id+'/action',json={'action':'shell','command':'echo test','extra':1},headers=headers).status_code==422
    internal={'x-agent-internal':config.adapter_token}
    assert client.post('/internal/devices/tool',json={'name':'device_list','workerId':'codex','arguments':{'projectId':'default'}},headers=internal).json()['devices']==[]
    denied=client.post('/internal/devices/tool',json={'name':'device_action','workerId':'codex','arguments':{'projectId':'default','id':id,'action':{'action':'connect'}}},headers=internal)
    assert denied.status_code==400
    app.state.db.close()


def network(config,db,monkeypatch):
    monkeypatch.delenv('VANILLA_MANAGED_HTTPS',raising=False)
    o=SimpleNamespace(db=db,config=config,tailscale_binary=lambda:'tailscale',tailscale_env=lambda:{},network_cache=(0,{}))
    n=DeviceNetwork(o)
    rules={'Web':{},'TCP':{},'AllowFunnel':{}}
    calls=[]
    def run(*args):
        calls.append(args)
        if args==('status','--json'): return json.dumps({'BackendState':'Running','Self':{'DNSName':'test.example.ts.net.'}})
        if args==('serve','status','--json'):return json.dumps(rules)
        port=args[1].split('=')[1];key='test.example.ts.net:'+port
        if args[-1]=='off':
            for group,k in [('Web',key),('TCP',port),('AllowFunnel',key)]:rules[group].pop(k,None)
        else:
            rules['Web'][key]={'Handlers':{'/':{'Proxy':f'http://127.0.0.1:{config.port}'}}}
            rules['TCP'][port]={'HTTPS':True}
            if args[0]=='funnel':rules['AllowFunnel'][key]=True
        return ''
    monkeypatch.setattr(n,'run',run)
    return n,rules,calls


def test_serve_preserves_other_handlers_and_stops_only_own(config,db,monkeypatch):
    n,rules,calls=network(config,db,monkeypatch)
    foreign={'Handlers':{'/':{'Proxy':'http://127.0.0.1:9001'}}}
    rules['Web']['test.example.ts.net:443']=foreign
    result=n.action('serve')
    assert result['serving'] and not result['funnel'] and result['ownsRule']
    assert rules['Web']['test.example.ts.net:443']==foreign
    assert json.loads((config.data/'host.json').read_text())['public_origin']==config.public_origin
    n.action('stop')
    assert rules['Web']=={'test.example.ts.net:443':foreign}
    assert config.public_origin==''
    assert not any('reset' in c for c in calls)


def test_foreign_and_public_guards(config,db,monkeypatch):
    n,rules,calls=network(config,db,monkeypatch)
    with pytest.raises(ValueError,match='App-Anmeldung'):n.action('funnel',True)
    config.login_password='example-login'
    with pytest.raises(ValueError,match='Bestätigung'):n.action('funnel',False)
    rules['Web']['test.example.ts.net:1989']={'Handlers':{'/':{'Proxy':'http://127.0.0.1:9001'}}}
    with pytest.raises(ValueError,match='bereits verwaltet'):n.action('serve')
    assert all(c in [('status','--json'),('serve','status','--json')] for c in calls)
    result=n.action('funnel',True)
    assert result['funnel'] and result['url'].endswith(':8443')
    n.action('stop')
    assert 'test.example.ts.net:1989' in rules['Web']


def test_managed_network_no_mutation(config,db,monkeypatch):
    n,_,calls=network(config,db,monkeypatch)
    monkeypatch.setenv('VANILLA_MANAGED_HTTPS','1')
    for action in ['login','serve','funnel','stop']:
        with pytest.raises(ValueError,match='verwaltet'):n.action(action,True)
    assert not calls


def test_mcp_exposes_bounded_tools():
    tools={t['name']:t for t in mcp.tools()}
    assert 'device_list' in tools
    assert not tools['device_action']['annotations']['readOnlyHint']
    actions=tools['device_action']['inputSchema']['properties']['action']['properties']['action']['enum']
    assert 'pair' not in actions and 'connect' not in actions
    assert not any('approve' in name or 'network' in name for name in tools)


def test_samsung_wire_protocol_authorization_and_keys(config,db,monkeypatch):
    from websockets.sync.server import serve
    from concurrent.futures import ThreadPoolExecutor
    received=[]
    def handler(ws):
        ws.send(json.dumps({'event':'ms.channel.connect','data':{'token':'TRANSIENT-TEST'}}))
        try:
            received.append(json.loads(ws.recv(timeout=5)))
        except Exception:
            pass
    server=serve(handler,'127.0.0.1',0)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    monkeypatch.setattr('core.devices.private_address',lambda _: '127.0.0.1')
    devices=Devices(db,config)
    try:
        port=server.socket.getsockname()[1]
        d=devices.save(DeviceInput(name='Test TV',provider='samsung-tv',url=f'ws://test.local:{port}'))
        assert devices.execute(d['id'],DeviceAction(action='connect'))['status']=='connected'
        assert devices.execute(d['id'],DeviceAction(action='key',key='volume-up'))['status']=='sent'
        devices.close()
        assert received[0]['params']['DataOfCmd']=='KEY_VOLUP'
        assert 'TRANSIENT-TEST' not in json.dumps(devices.state())
    finally:
        devices.close();server.shutdown();thread.join(3)


def test_samsung_rejection_never_connects(config,db,monkeypatch):
    from websockets.sync.server import serve
    def handler(ws):ws.send(json.dumps({'event':'ms.channel.unauthorized'}))
    server=serve(handler,'127.0.0.1',0)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    monkeypatch.setattr('core.devices.private_address',lambda _: '127.0.0.1')
    devices=Devices(db,config)
    try:
        port=server.socket.getsockname()[1]
        d=devices.save(DeviceInput(name='Test TV',provider='samsung-tv',url=f'ws://test.local:{port}'))
        with pytest.raises(ValueError,match='zulassen'):
            devices.execute(d['id'],DeviceAction(action='connect'))
        assert devices.get(d['id'])['status']=='error'
        assert not devices.tv_sessions
    finally:
        devices.close();server.shutdown();thread.join(3)


def test_android_rejects_reassigned_network_address(config,db,monkeypatch):
    devices=Devices(db,config)
    d={**definition().model_dump(),'deviceIdentity':hashlib.sha256(b'ORIGINAL').hexdigest()}
    calls=[]
    monkeypatch.setattr(devices,'adb',lambda args,**kw:calls.append(args) or 'OTHER-DEVICE')
    with pytest.raises(ValueError,match='anderes Android-Gerät'):
        devices.android(d,DeviceAction(action='key',key='home'))
    assert all('input' not in ' '.join(c) for c in calls)


def test_failed_connection_cannot_be_released_from_stale_success(config,db,monkeypatch):
    devices=Devices(db,config);d=ready(devices,monkeypatch)
    def fail(*a):raise ValueError('not reachable')
    monkeypatch.setattr(devices,'android',fail)
    with pytest.raises(ValueError):devices.execute(d['id'],DeviceAction(action='status'))
    latest=devices.get(d['id'])
    assert latest['status']=='error' and not latest['enabled']
    with pytest.raises(ValueError):save_existing(devices,latest,enabled=True)
