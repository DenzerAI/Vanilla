import asyncio
import copy
import json
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from core.config import Config
from core.database import Database
from core.github import GitHub, GitHubError, ORIGIN
from core.releases import validate_manifest, Releases, compatibility
from core.notifications import Notifications
from core.product_updates import Updates


def manifest():
    return {'schemaVersion':1,'releaseId':10,'version':'1.1.0','repository':ORIGIN,'tag':'v1.1.0','commit':'a'*40,
            'publishedAt':'2026-01-01T00:00:00Z','summary':'Neue Suche','changes':['Suche erweitert'],
            'requirements':{'updater':1,'platforms':['darwin','linux'],'python':'3.12','node':22},
            'modules':[{'id':'platform','version':1,'dependencies':[]}], 'migrations':[],
            'rollback':{'compatible':True,'fromVersions':['1.0.0']},
            'checks':[{'workflow':w,'runId':i+1,'commit':'a'*40} for i,w in enumerate(['source-privacy.yml','functionality.yml','design.yml'])]}


def release():
    return {'id':10,'tag_name':'v1.1.0','draft':False,'prerelease':False,'published_at':'2026-01-01T00:00:00Z'}


@pytest.fixture
def context(tmp_path):
    config=Config(root=tmp_path,start_adapter=False)
    db=Database(config.data/'agent.sqlite3')
    yield config,db
    db.close()


def test_manifest_never_accepts_foreign_mutable_or_incomplete_release():
    good=manifest()
    assert validate_manifest(good,release())==good
    for key,value in [('repository','example/foreign'),('commit','main'),('schemaVersion',2),('checks',good['checks'][:2]),('command','curl example.invalid')]:
        bad={**good,key:value}
        with pytest.raises(ValueError):validate_manifest(bad,release())
    with pytest.raises(ValueError):validate_manifest(good,{**release(),'draft':True})
    bad=copy.deepcopy(good);bad['checks'][0]['commit']='b'*40
    with pytest.raises(ValueError):validate_manifest(bad,release())
    bad=copy.deepcopy(good);bad['modules']*=2
    with pytest.raises(ValueError):validate_manifest(bad,release())


@pytest.mark.asyncio
async def test_public_discovery_never_sends_account_or_inventory(context):
    config,db=context
    calls=[]
    def respond(request):
        calls.append(request)
        return httpx.Response(404,json={})
    github=GitHub(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(respond)))
    github.vault.save('github-account',json.dumps({'token':'synthetic-provider-value','clientId':'fixture-client'}))
    assert await Releases(github).latest() is None
    assert len(calls)==1 and 'authorization' not in calls[0].headers
    assert calls[0].url.host=='api.github.com'
    assert not calls[0].content
    await github.close()


@pytest.mark.asyncio
async def test_device_login_waits_and_hides_credentials(context):
    config,db=context
    now=[1000.0]; calls=[]
    def respond(request):
        calls.append(request)
        if request.url.path=='/login/device/code':return httpx.Response(200,json={'device_code':'fixture-device-secret','user_code':'TEST-CODE','verification_uri':'https://github.com/login/device','interval':5,'expires_in':900})
        if request.url.path=='/login/oauth/access_token':return httpx.Response(200,json={'access_token':'synthetic-provider-value','refresh_token':'synthetic-refresh-value','expires_in':28800})
        if request.url.path=='/user':return httpx.Response(200,json={'id':1,'login':'example-user'})
        raise AssertionError(request.url)
    github=GitHub(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),clock=lambda:now[0])
    await github.configure('fixture-client',0)
    device=await github.begin()
    assert 'secret' not in json.dumps(device)
    assert (await github.poll(device['id']))['status']=='pending'
    assert len(calls)==1
    now[0]+=6
    assert (await github.poll(device['id']))['status']=='connected'
    public=json.dumps(github.status())
    assert 'provider-value' not in public and 'refresh-value' not in public
    assert 'provider-value' not in db.get('provider-vault/github-account')['value']
    await github.disconnect()
    assert not github.status()['connected'] and not github.vault.has('github-account')
    await github.close()


@pytest.mark.asyncio
async def test_refresh_is_serialized_and_rotates_both_tokens(context):
    config,db=context;requests=[]
    async def respond(request):
        requests.append(request)
        await asyncio.sleep(0.01)
        return httpx.Response(200,json={'access_token':'synthetic-new-access','refresh_token':'synthetic-new-refresh','expires_in':28800})
    github=GitHub(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),clock=lambda:1000)
    github.vault.save('github-account',json.dumps({'token':'synthetic-old-access','refresh':'synthetic-old-refresh','clientId':'fixture-client','expiresAt':999}))
    result=await asyncio.gather(github.token(),github.token())
    assert result==['synthetic-new-access']*2 and len(requests)==1
    assert json.loads(github.vault.read('github-account'))['refresh']=='synthetic-new-refresh'
    assert b'client_secret' not in requests[0].content
    await github.close()


@pytest.mark.asyncio
async def test_unexpected_asset_redirect_never_reaches_external_host(context):
    config,db=context;calls=[]
    def respond(request):
        calls.append(request)
        return httpx.Response(302,headers={'location':'https://example.invalid/collect'})
    github=GitHub(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(respond)))
    with pytest.raises(ValueError,match='unerlaubte'):
        await Releases(github).asset(10)
    assert len(calls)==1
    await github.close()


def test_notifications_have_real_subjects_and_deduplicate(context):
    config,db=context
    notices=Notifications(db)
    notices.system('release-10','update','10','Update verfügbar','Neue Suche')
    notices.read('release-10')
    notices.system('release-10','update','10','Update verfügbar','Neue Suche')
    assert len(notices.list()['items'])==1 and notices.list()['unread']==0
    assert notices.list()['items'][0]['kind']=='update'
    assert not db.rows('SELECT * FROM executions')


@pytest.mark.asyncio
async def test_release_revocation_offline_and_recovery_are_honest(context):
    config,db=context
    github=GitHub(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(404,json={}))))
    runtime=SimpleNamespace(notifications=Notifications(db))
    contributions=SimpleNamespace(settings=lambda:{'role':'customer'})
    updater=Updates(db,config,runtime,github,contributions)
    updater.save(release={'manifest':manifest(),'digest':'fixture-digest'},checkedAt=10)
    async def offline():raise ValueError('Offline')
    updater.releases.latest=offline
    await updater.check()
    assert updater.status()['release']['manifest']['version']=='1.1.0'
    assert updater.status()['error']=='Offline' and updater.status()['checkedAt']==10
    async def revoked():return None
    updater.releases.latest=revoked
    await updater.check()
    assert not updater.status()['release'] and not updater.status()['available']
    run=updater.journal({'id':'a'*32,'state':'preparing'})
    updater.save(current=run['id']);updater.recover()
    assert updater.status()['run']['state']=='needs-review'
    await github.close()


@pytest.mark.asyncio
async def test_stale_approval_never_installs(context):
    config,db=context
    github=GitHub(db,config)
    runtime=SimpleNamespace(notifications=Notifications(db))
    updater=Updates(db,config,runtime,github,SimpleNamespace(settings=lambda:{'role':'customer'}))
    run=updater.journal({'id':'b'*32,'state':'needs-review'})
    updater.save(current=run['id'])
    with pytest.raises(ValueError,match='Freigabe'):await updater.install(run['id'],run['revision'])
    assert not (config.data/'updates/maintenance.json').exists()
    await github.close()


def test_update_api_uses_existing_csrf_and_operator_nonce_is_scoped(tmp_path):
    from fastapi.testclient import TestClient
    from core.app import create_app
    from core.update_operator import write
    config=Config(root=tmp_path,start_adapter=False)
    app=create_app(config)
    app.state.product_updates.configure({'automatic':False},0)
    with TestClient(app) as client:
        assert client.get('/api/system/updates').status_code==200
        assert client.post('/api/github/configure',json={'clientId':'fixture-client','revision':0}).status_code==403
        csrf=client.get('/api/auth/session').json()['token'];headers={'x-uwe-token':csrf}
        response=client.post('/api/github/configure',json={'clientId':'fixture-client','revision':0},headers=headers)
        assert response.status_code==200 and response.json()['configured']
        assert client.post('/api/github/configure',json={'clientId':'fixture-other','revision':0},headers=headers).status_code==400
        assert client.post('/api/system/updates/install',json={'id':'a'*32,'revision':1},headers=headers).status_code==400
        assert client.post('/api/system/updates/publish',json={'version':'1.1.0','summary':'Synthetic','changes':['Synthetic'],'fromVersions':['*'],'compatibleData':True},headers=headers).status_code==422
        assert client.post('/internal/update-operator',json={'id':'a'*32,'action':'quiesce'}).status_code==403
        write(config.data/'updates/maintenance.json',{'id':'a'*32,'nonce':'fixture-operator-nonce'})
        scoped={'x-agent-update':'fixture-operator-nonce'}
        assert client.post('/internal/storage',json={'key':'fixture','value':{}},headers=scoped).status_code==403
        assert client.post('/internal/update-operator',json={'id':'a'*32,'action':'quiesce'},headers={**scoped,'origin':'https://example.invalid'}).status_code==403


@pytest.mark.asyncio
async def test_lost_refresh_response_requires_reconnect_without_token_replay(context):
    config,db=context;calls=[]
    def respond(request):
        calls.append(request);raise httpx.ReadTimeout('Synthetic transport interruption')
    github=GitHub(db,config,client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),clock=lambda:1000)
    github.vault.save('github-account',json.dumps({'token':'synthetic-old-access','refresh':'synthetic-old-refresh','clientId':'fixture-client','expiresAt':999}))
    with pytest.raises(GitHubError):await github.token()
    with pytest.raises(GitHubError,match='unbestätigt'):await github.token()
    assert len(calls)==1 and not github.status()['connected']
    await github.close()


@pytest.mark.asyncio
async def test_release_requires_matching_modules_and_both_platform_checks():
    import base64
    m=manifest();state={'modules':m['modules'],'mac':True,'version':m['version']}
    async def request(method,path,**kwargs):
        if '/git/ref/' in path:return {'object':{'sha':m['commit'],'type':'commit'}}
        if '/contents/system/version.json' in path:return {'encoding':'base64','content':base64.b64encode(json.dumps({'version':state['version']}).encode()).decode()}
        if '/contents/' in path:return {'encoding':'base64','content':base64.b64encode(json.dumps({'modules':state['modules']}).encode()).decode()}
        if '/jobs?' in path:
            names=['customer-base (ubuntu-latest)','update-sandbox']+(['customer-base (macos-latest)'] if state['mac'] else [])
            return {'total_count':len(names),'jobs':[{'name':n,'status':'completed','conclusion':'success'} for n in names]}
        check=next(c for c in m['checks'] if path.endswith('/'+str(c['runId'])))
        return {'head_sha':m['commit'],'conclusion':'success','status':'completed','repository':{'full_name':ORIGIN},'head_repository':{'full_name':ORIGIN},'path':'.github/workflows/'+check['workflow'],'event':'push'}
    releases=Releases(SimpleNamespace(request=request));await releases.verify(m)
    state['mac']=False
    with pytest.raises(ValueError,match='Linux und macOS'):await releases.verify(m)
    state['modules']=[]
    with pytest.raises(ValueError,match='Modulregister'):await releases.verify(m)
    state.update(modules=m['modules'],mac=True,version='0.1.0')
    with pytest.raises(ValueError,match='Produktversion'):await releases.verify(m)


def test_product_version_is_bound_to_running_code_and_does_not_invent_a_release(context, monkeypatch):
    import core.product_updates as coordinator
    config, db = context
    file = config.root / 'system/version.json'; file.parent.mkdir()
    file.write_text(json.dumps({'version':'0.1.0'}))
    monkeypatch.setattr(coordinator, 'git', lambda root, *args: b'a'*40 if args[0]=='rev-parse' else b'')
    github = SimpleNamespace(status=lambda:{'connected':False})
    contributions = SimpleNamespace(settings=lambda:{'role':'customer'})
    updates = Updates(db, config, SimpleNamespace(), github, contributions)
    assert updates.status()['product'] == {'version':'0.1.0','revision':'a'*40,'modified':False,'development':True}
    updates.save(installed={'version':'1.0.0','commit':'b'*40})
    assert updates.status()['product']['version']=='0.1.0'
    assert updates.status()['product']['development']
    updates.save(installed={'version':'0.1.0','commit':'a'*40})
    assert not updates.status()['product']['development']
    file.write_text(json.dumps({'version':'0.1.1'}))
    assert updates.status()['product']['version']=='0.1.0'
    restarted = Updates(db, config, SimpleNamespace(), github, contributions)
    assert restarted.status()['product']['version']=='0.1.1'
    assert restarted.status()['product']['development']
    file.write_text(json.dumps({'version':'0.1.0'}))
    monkeypatch.setattr(coordinator, 'git', lambda root, *args: b'a'*40 if args[0]=='rev-parse' else b' M core/demo.py')
    assert Updates(db, config, SimpleNamespace(), github, contributions).status()['product']['development']
