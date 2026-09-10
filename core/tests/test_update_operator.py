import json
import hashlib
import plistlib
import shutil
import sqlite3
import subprocess
from pathlib import Path

import pytest
from core import update_operator as operator
from core.update_source import digest


def run_git(root,*args):
    return subprocess.check_output(['git','-C',str(root),*args],stderr=subprocess.DEVNULL).decode().strip()


def fixture_install(tmp_path,monkeypatch):
    root=tmp_path/'installation';root.mkdir()
    home=tmp_path/'operator-home';home.mkdir()
    monkeypatch.setattr(Path,'home',classmethod(lambda cls:home))
    data=root/'data/control';data.mkdir(parents=True)
    id='a'*32;directory=data/'updates'/id;directory.mkdir(parents=True)
    (root/'core').mkdir();(root/'core/demo.py').write_text('value = "old"\n')
    run_git(root,'init','-q')
    run_git(root,'config','user.name','Synthetic Test');run_git(root,'config','user.email','source@example.invalid')
    run_git(root,'add','core/demo.py');run_git(root,'-c','core.hooksPath=/dev/null','commit','-qm','Synthetic baseline')
    before_commit=run_git(root,'rev-parse','HEAD')
    candidate=directory/'candidate'
    subprocess.run(['git','clone','--no-hardlinks','-q',str(root),str(candidate)],check=True)
    run_git(candidate,'config','user.name','Synthetic Test');run_git(candidate,'config','user.email','source@example.invalid')
    (candidate/'core/demo.py').write_text('value = "new"\n');(candidate/'core/addition.py').write_text('added = True\n')
    run_git(candidate,'add','core');run_git(candidate,'-c','core.hooksPath=/dev/null','commit','-qm','Synthetic update')
    commit=run_git(candidate,'rev-parse','HEAD')
    for base,value in [(root,'old-build'),(candidate,'new-build')]:
        (base/'wrapper/dist').mkdir(parents=True);(base/'wrapper/dist/version.json').write_text(json.dumps({'uiVersion':value}))
    job=root/'workspaces/default/jobs/local-job';job.mkdir(parents=True)
    (job/'job.yaml').write_text('id: local-job\nschedule:\n  type: daily\n  time: "09:00"\n')
    (job/'SKILL.md').write_text('Synthetic private workflow.\n')
    (root/'firmenbasis').mkdir();(root/'firmenbasis/FIRMA.md').write_text('Synthetic local company.\n')
    secret=data/'provider-vault';secret.mkdir();(secret/'fixture.key').write_bytes(b'fixture-private-value')
    before={'core/demo.py':{'sha256':operator.hash_file(root/'core/demo.py'),'mode':'100644'}}
    after={name:{'sha256':operator.hash_file(candidate/name),'mode':'100644'} for name in ['core/demo.py','core/addition.py']}
    build=operator.tree_files(candidate/'wrapper/dist')
    name='local.vanilla.agent.'+hashlib.sha256(str(data).encode()).hexdigest()[:10]
    plist=home/'Library/LaunchAgents'/f'{name}.plist';plist.parent.mkdir(parents=True)
    plist.write_bytes(plistlib.dumps({'Label':name,'WorkingDirectory':str(root)}))
    request={'schemaVersion':1,'id':id,'root':str(root),'data':str(data),'workspace':str(root/'workspaces/default'),'port':1989,
      'host':{'label':name,'plistHash':operator.hash_file(plist)},'candidate':{'commit':commit},'sourceCommit':before_commit,'before':before,'after':after,'build':build,
      'approvalHash':'fixture-approval','sourceHash':digest(before),'candidateHash':digest(after),'buildHash':digest(build),'nonce':'fixture-nonce','version':'1.1.0'}
    with sqlite3.connect(data/'agent.sqlite3') as cx:
        cx.execute('CREATE TABLE records(key TEXT PRIMARY KEY,value TEXT)')
        cx.execute('CREATE TABLE executions(id TEXT,slot TEXT,status TEXT)')
        cx.execute("INSERT INTO executions VALUES('done','reserved-slot','completed')")
        cx.execute('INSERT INTO records VALUES(?,?)',('updates/run/'+id,json.dumps({'approval':{'hash':request['approvalHash']},**{k:request[k] for k in ['sourceHash','candidateHash','buildHash']}})))
        cx.execute('INSERT INTO records VALUES(?,?)',('control/state.json',json.dumps({'connections':[{'id':'fixture-telegram','provider':'telegram','enabled':True}]})))
    file=directory/'install.json';operator.write(file,request)
    operator.write(data/'updates/maintenance.json',{'id':id,'nonce':request['nonce']})
    original=operator.command
    commands=[]
    def command(*args):
        commands.append(args)
        if args[0]!='launchctl':return original(*args)
    monkeypatch.setattr(operator,'command',command)
    monkeypatch.setattr(operator.time,'sleep',lambda n:None)
    return root,data,directory,file,request,commands


def assert_private_preserved(root,data):
    assert (root/'workspaces/default/jobs/local-job/SKILL.md').read_text()=='Synthetic private workflow.\n'
    assert '09:00' in (root/'workspaces/default/jobs/local-job/job.yaml').read_text()
    assert (data/'provider-vault/fixture.key').read_bytes()==b'fixture-private-value'
    with sqlite3.connect(data/'agent.sqlite3') as cx:
        assert cx.execute('SELECT slot,status FROM executions').fetchall()==[('reserved-slot','completed')]
        assert 'fixture-telegram' in cx.execute("SELECT value FROM records WHERE key='control/state.json'").fetchone()[0]


def test_operator_switches_only_approved_source_and_preserves_jobs_connections(tmp_path,monkeypatch):
    root,data,directory,file,request,commands=fixture_install(tmp_path,monkeypatch)
    actions=[]
    def control(r,action):
        actions.append(action)
        if action=='commit':operator.write(directory/'decision.json',{'action':'commit','phase':'completed'})
        return {'ready':True}
    monkeypatch.setattr(operator,'control',control)
    operator.operate(file)
    assert operator.read(directory/'operator-state.json')['phase']=='installed'
    assert 'new' in (root/'core/demo.py').read_text()
    assert run_git(root,'rev-parse','HEAD')==request['candidate']['commit']
    assert_private_preserved(root,data)
    assert actions==['quiesce','health','commit']
    assert sum(c[:2]==('launchctl','bootout') for c in commands)==1
    operator.operate(file)
    assert actions==['quiesce','health','commit']


def test_failed_new_service_restores_code_build_data_and_reserved_slots(tmp_path,monkeypatch):
    root,data,directory,file,request,commands=fixture_install(tmp_path,monkeypatch)
    def control(r,action):
        if action=='health':
            if 'new' in (root/'core/demo.py').read_text():raise OSError('fixture failed startup')
            return {'ready':True}
        return {'ready':True}
    monkeypatch.setattr(operator,'control',control)
    operator.operate(file)
    assert operator.read(directory/'operator-state.json')['phase']=='restored'
    assert 'old' in (root/'core/demo.py').read_text() and not (root/'core/addition.py').exists()
    assert json.loads((root/'wrapper/dist/version.json').read_text())['uiVersion']=='old-build'
    assert run_git(root,'rev-parse','HEAD')==request['sourceCommit']
    assert_private_preserved(root,data)


def test_lost_success_reply_cannot_roll_back_new_business_data(tmp_path,monkeypatch):
    root,data,directory,file,request,commands=fixture_install(tmp_path,monkeypatch)
    def control(r,action):
        if action=='commit':
            operator.write(directory/'decision.json',{'action':'commit','phase':'completed'})
            (root/'workspaces/default/new-business.txt').write_text('Synthetic new input after release')
            raise OSError('fixture lost response')
        return {'ready':True}
    monkeypatch.setattr(operator,'control',control)
    operator.operate(file)
    assert operator.read(directory/'operator-state.json')['phase']=='installed'
    assert (root/'workspaces/default/new-business.txt').exists()
    assert 'new' in (root/'core/demo.py').read_text()


def test_tampered_candidate_stops_before_copy_and_old_installation_remains(tmp_path,monkeypatch):
    root,data,directory,file,request,commands=fixture_install(tmp_path,monkeypatch)
    (directory/'candidate/core/demo.py').write_text('tampered = True\n')
    monkeypatch.setattr(operator,'control',lambda r,a:{'ready':True})
    operator.operate(file)
    assert 'old' in (root/'core/demo.py').read_text()
    assert_private_preserved(root,data)
    assert not (root/'core/addition.py').exists()


def test_crash_during_switch_recovers_without_repeating_activation(tmp_path,monkeypatch):
    root,data,directory,file,request,commands=fixture_install(tmp_path,monkeypatch)
    original=operator.command
    def crash(*args):
        if args[0]=='git':raise SystemExit('Synthetic power loss')
        return original(*args)
    monkeypatch.setattr(operator,'command',crash)
    monkeypatch.setattr(operator,'control',lambda r,a:{'ready':True})
    with pytest.raises(SystemExit):operator.operate(file)
    assert operator.read(directory/'operator-state.json')['phase']=='switching'
    monkeypatch.setattr(operator,'command',original)
    operator.operate(file)
    assert operator.read(directory/'operator-state.json')['phase']=='restored'
    assert_private_preserved(root,data)
    assert 'old' in (root/'core/demo.py').read_text()
