import asyncio
import os
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest

from core.tests.test_core import config, db, write_note, make_job
from core.knowledge import Knowledge
from core.memory import Memory
from core.settings import Settings, SettingsUpdate
from core.storage import Storage
from core.queue import JobQueue
from core.operations import Operations
from core.runtime import Runtime
from core.streaming import StreamHub
from core.backups import Backups, verify_restore


def services(config, db):
    settings = Settings(db)
    knowledge = Knowledge(db, config)
    memory = Memory(db, config, knowledge, settings)
    operations = Operations(db, config, settings, knowledge, memory)
    storage = Storage(db, config)
    queue = JobQueue(db, storage)
    runtime = Runtime(config, queue, knowledge, operations)
    return settings, knowledge, memory, operations, storage, queue, runtime


def test_settings_conflicts_preserve_current_values(config, db):
    settings = Settings(db)
    initial = settings.read()
    settings.set_group('memory', dreaming=False)
    with pytest.raises(FileExistsError):
        settings.save(SettingsUpdate.model_validate(initial))
    assert settings.values['memory']['dreaming'] is False
    with pytest.raises(ValueError):
        SettingsUpdate.model_validate({'version':1,'values':{'system':{'parallel_jobs':999}}})


def test_context_uses_match_at_end_and_filters_before_limit(config, db):
    write_note(config, 'notes/Long.md', '# Long\n' + ('Belanglose Einleitung. ' * 300) + '\nDer Kundencode ist SOL-4982.')
    k = Knowledge(db, config); k.scan()
    result = k.context('Kundencode SOL-4982', 'default')
    assert 'SOL-4982' in result['sources'][0]['text']
    assert result['sources'][0]['offset'] > 0
    assert result['characters'] <= 8000


def test_memory_capture_is_idempotent_private_and_reversible(config, db):
    _, k, m, o, _, _, runtime = services(config, db)
    db.put('control/state.json', {'chats':[{'id':'chat1','title':'Projektbesprechung','projectId':'default'}],'projects':[]})
    thread={'id':'chat1','turns':[{'id':'turn1','status':'completed','items':[
        {'type':'userMessage','text':'Windpark prüfen.\nPasswort: test-private-value'},
        {'type':'agentMessage','text':'Der Windpark benötigt eine neue Leitung.'},
        {'type':'reasoning','text':'private-thinking'},
        {'type':'mcpToolCall','text':'private-tool-result'}]}]}
    db.put('workspace/chats/chat1/transcript.json',thread)
    assert m.capture('chat1') == 1
    assert m.capture('chat1') == 0
    assert m.dream()['entries']==1
    text='\n'.join(p.read_text() for p in config.workspace.rglob('*.md'))
    assert 'Windpark' in text
    for private in ['test-private-value','private-thinking','private-tool-result']:
        assert private not in text
    changes=db.rows('SELECT * FROM memory_changes')
    assert changes
    path='notes/Editable.md'
    original=m.save(path,'# Erstes',None)
    revision=db.rows('SELECT id FROM memory_changes WHERE path=? ORDER BY created_at DESC LIMIT 1',(path,))[0]['id']
    changed=m.save(path,'# Zweites',original['version'])
    assert m.restore(revision,path,changed['version'],'default')['text']=='# Erstes'
    m.forget_chat('chat1'); k.scan()
    assert m.capture('chat1')==0
    assert not k.search('Windpark','default')
    asyncio.run(runtime.close())


def test_memory_never_overwrites_manual_curation(config, db):
    _, k, m, _, _, _, runtime = services(config, db)
    m.write_managed('brain/MEMORY.md','# Automatisch','default','Test')
    (config.workspace/'brain/MEMORY.md').write_text('# Meine Bearbeitung')
    m.write_managed('brain/MEMORY.md','# Neu','default','Test')
    assert (config.workspace/'brain/MEMORY.md').read_text()=='# Meine Bearbeitung'
    assert db.rows("SELECT id FROM events WHERE kind='memory.conflict'")
    asyncio.run(runtime.close())


def test_interval_and_event_schedules_survive_repeated_ticks(config, db):
    make_job(config,'periodic',{'type':'interval','minutes':5})
    make_job(config,'trigger',{'type':'event','event':'memory.captured'})
    storage=Storage(db,config); storage.sync_jobs(); queue=JobQueue(db,storage)
    now=datetime(2026,9,7,12,3,tzinfo=timezone.utc)
    queue.schedule(now); queue.schedule(now)
    assert len(db.rows("SELECT id FROM executions WHERE job_id='periodic'"))==1
    db.event('memory.captured','chat1',{})
    queue.schedule(now); queue.schedule(now)
    assert len(db.rows("SELECT id FROM executions WHERE job_id='trigger'"))==1


def test_python_runner_result_timeout_and_no_secret_environment(config, db):
    settings,k,m,o,storage,queue,runtime=services(config,db)
    make_job(config,'python-job')
    file=config.workspace/'jobs/python-job/job.yaml'
    job=json.loads(file.read_text()); job.update(worker='python',python={'handler':'script','script':'script.py','timeout':5,'input':{'value':21}})
    file.write_text(json.dumps(job))
    write_note(config,'jobs/python-job/script.py','import sys,json,os\nb=json.load(sys.stdin)\nassert "AGENT_INTERNAL_TOKEN" not in os.environ\nprint(json.dumps({"value":b["input"]["value"]*2}))\n')
    storage.sync_jobs(); queue.enqueue('python-job'); run=queue.claim()
    asyncio.run(runtime.execute(run))
    result=queue.get(run['id'])
    assert result['status']=='completed'
    assert json.loads(result['result'])['result']=={'value':42}
    write_note(config,'jobs/python-job/script.py','import time\ntime.sleep(10)\n')
    job['python']['timeout']=1;file.write_text(json.dumps(job));storage.sync_jobs()
    queue.enqueue('python-job');run=queue.claim();asyncio.run(runtime.execute(run))
    assert queue.get(run['id'])['status']=='failed'
    assert 'Zeitlimit' in queue.get(run['id'])['error']
    assert not runtime.python_processes
    asyncio.run(runtime.close())


def test_stream_bounds_slow_clients_and_preserves_frames(config, db):
    *_,runtime=services(config,db)
    hub=runtime.stream
    async def scenario():
        stream=hub.subscribe(); assert 'resync' in await anext(stream)
        for i in range(600): hub.publish({'method':'delta','params':{'text':'ä\n'+str(i)}})
        assert len(hub.clients)==1
        assert next(iter(hub.clients)).qsize()<=256
        frame=await anext(stream)
        assert 'resync' in frame
        await stream.aclose(); assert not hub.clients
        await runtime.close()
    asyncio.run(scenario())


def test_real_encrypted_backup_restore_and_corruption(config, db, monkeypatch):
    binary=Path(os.environ.get('AGENT_TEST_RESTIC', str(Path(__file__).resolve().parents[2]/'data/control/bin/restic')))
    if not binary.exists(): pytest.skip('Pinned restic binary not installed on this test host')
    settings,k,m,o,storage,queue,runtime=services(config,db)
    monkeypatch.setattr(Backups,'binary',property(lambda self:str(binary)))
    o.backups.password=lambda:'test-only-random-backup-passphrase-9fa8c742'
    target=config.root/'snapshots';target.mkdir()
    settings.set_group('backup',target=str(target))
    o.backups.command('init')
    write_note(config,'notes/Backup.md','# Wiederherstellbarer Text')
    k.scan()
    result=o.backups.snapshot()
    assert result['snapshot']
    restored=o.backups.stage_restore(result['snapshot'])
    assert restored['verified']
    base=Path(restored['path'])
    assert (base/'workspace/notes/Backup.md').read_text()=='# Wiederherstellbarer Text'
    assert verify_restore(base)['format']=='agent-backup-v1'
    (base/'workspace/notes/Backup.md').write_text('manipuliert')
    with pytest.raises(ValueError): verify_restore(base)
    # The encrypted repository never stores the known note in plaintext.
    assert all(b'Wiederherstellbarer Text' not in p.read_bytes() for p in target.rglob('*') if p.is_file())
    asyncio.run(runtime.close())


def test_mcp_routes_share_versions_and_enforce_projects(config):
    from fastapi.testclient import TestClient
    from core.app import create_app
    from core.mcp import handle
    from types import SimpleNamespace
    with TestClient(create_app(config)) as client:
        client.headers['x-uwe-token']=client.get('/api/auth/session').json()['token']
        body={'name':'memory_write','arguments':{'projectId':'default','path':'notes/Shared.md','text':'# Solarwissen','version':None}}
        response=client.post('/api/memory/tool',json=body)
        assert response.status_code==200
        version=response.json()['version']
        assert client.post('/api/memory/tool',json=body).status_code==409
        read=client.post('/api/memory/tool',json={'name':'memory_read','arguments':{'projectId':'default','path':'notes/Shared.md'}}).json()
        assert read['version']==version and read['projectId']=='default'
        assert client.post('/api/memory/tool',json={'name':'memory_read','arguments':{'projectId':'unknown','path':'notes/Shared.md'}}).status_code==400
        assert client.post('/internal/memory/tool',json=body).status_code==403
        listing=handle({'jsonrpc':'2.0','id':1,'method':'tools/list'},SimpleNamespace())
        assert {t['name'] for t in listing['result']['tools']}=={'memory_read','memory_write','memory_search','memory_context'}


@pytest.mark.parametrize('interrupt',[False,True])
def test_restore_swaps_all_sources_and_rolls_back_on_failure(config, db, monkeypatch, interrupt):
    from core.restore import apply_pending
    from core.files import sha256
    import core.restore as restore_module
    write_note(config,'notes/Current.md','# Current')
    stage=config.data/'restores/test';stage.mkdir(parents=True)
    (stage/'workspace/notes').mkdir(parents=True)
    (stage/'workspace/notes/Restored.md').write_text('# Restored')
    db.backup(stage/'database.sqlite3')
    with sqlite3.connect(stage/'database.sqlite3') as cx:
        cx.execute('PRAGMA journal_mode=DELETE')
    db.close()
    manifest={'format':'agent-backup-v1','schema':2,'files':{p.relative_to(stage).as_posix():sha256(p) for p in stage.rglob('*') if p.is_file()}}
    (stage/'manifest.json').write_text(json.dumps(manifest))
    (config.data/'restore-pending.json').write_text(json.dumps({'path':str(stage),'snapshot':'a'*64}))
    if interrupt:
        replace=restore_module.os.replace
        def fail_once(source,target):
            if Path(target)==config.data/'agent.sqlite3' and '-new-' in str(source):
                raise OSError('simulated interrupted replacement')
            return replace(source,target)
        monkeypatch.setattr(restore_module.os,'replace',fail_once)
        with pytest.raises(OSError):apply_pending(config)
        assert (config.workspace/'notes/Current.md').read_text()=='# Current'
        assert not (config.workspace/'notes/Restored.md').exists()
        assert json.loads((config.data/'restore-last.json').read_text())['rolled_back']
    else:
        apply_pending(config)
        assert (config.workspace/'notes/Restored.md').read_text()=='# Restored'
        assert not (config.workspace/'notes/Current.md').exists()
        assert json.loads((config.data/'restore-last.json').read_text())['ok']
    assert not (config.data/'restore-pending.json').exists()
    assert not (config.data/'restore-journal.json').exists()


def test_heartbeat_never_restarts_unknown_or_active_work(config, monkeypatch):
    from core.heartbeat import check
    import core.heartbeat as monitor
    import time
    monkeypatch.setattr(monitor,'urlopen',lambda *a,**k: (_ for _ in ()).throw(OSError('offline')))
    restarted=[]
    monkeypatch.setattr(monitor.subprocess,'run',lambda *a,**k:restarted.append(a))
    config.data.mkdir(parents=True)
    (config.data/'heartbeat.json').write_text(json.dumps({'failures':3}))
    (config.data/'monitor.json').write_text(json.dumps({'label':'local.vanilla.agent.test'}))
    check(config.data,restart=True)
    (config.data/'runtime.json').write_text(json.dumps({'active':1,'checked_at':time.time()}))
    check(config.data,restart=True)
    (config.data/'runtime.json').write_text(json.dumps({'active':0,'checked_at':time.time()-120}))
    check(config.data,restart=True)
    assert restarted==[]


def test_heartbeat_counts_api_failures_without_global_restart(config, monkeypatch):
    import io
    import time
    from types import SimpleNamespace
    import core.heartbeat as monitor
    config.data.mkdir(parents=True)
    (config.data/'heartbeat.json').write_text(json.dumps({'failures':50}))
    (config.data/'monitor.json').write_text(json.dumps({'label':'local.vanilla.agent.test'}))
    (config.data/'runtime.json').write_text(json.dumps({'active':0,'checked_at':time.time()}))
    restarted=[]
    def restart(*args, **kwargs):
        restarted.append(args)
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(monitor.subprocess,'run',restart)
    monkeypatch.setattr(monitor,'urlopen',lambda *a,**k: (_ for _ in ()).throw(OSError('offline')))
    assert monitor.check(config.data,restart=True)['api_failures']==1
    assert monitor.check(config.data,restart=True)['api_failures']==2
    assert not restarted
    assert monitor.check(config.data,restart=True)['api_failures']==3
    assert not restarted
    monitor.check(config.data,restart=True)
    assert not restarted  # Vanilla never restarts global services.
    monkeypatch.setattr(monitor,'urlopen',lambda *a,**k:io.StringIO('{"checks":{"tailscale":{"ok":false}}}'))
    result=monitor.check(config.data,restart=True)
    assert not result['ok'] and result['api_failures']==0


def test_capture_survives_restart_and_forget_hides_manual_derivatives(config, db):
    settings,k,m,o,storage,queue,runtime=services(config,db)
    db.put('control/state.json',{'chats':[{'id':'durable','projectId':'default'}],'projects':[]})
    thread={'id':'durable','turns':[{'id':'one','status':'completed','items':[{'type':'agentMessage','text':'Ein merkwürdiger Windpark am See.'}]}]}
    db.put('workspace/chats/durable/transcript.json',thread)
    m.queue_capture('workspace/chats/durable/transcript.json',thread)
    resumed=Memory(db,config,k,settings)
    assert resumed.pending=={'durable'}
    assert resumed.flush()['captured']==1
    note=resumed.continuation('durable')
    assert 'Windpark' in note['text'] and len(note['text'])<6500
    file=config.workspace/note['path'];file.write_text(file.read_text()+'\nMeine Bearbeitung')
    result=resumed.forget_chat('durable')
    assert note['path'] in result['hiddenManualFiles']
    assert 'Meine Bearbeitung' in file.read_text()
    assert not k.search('Windpark','default')
    asyncio.run(runtime.close())


def test_vanilla_refuses_global_tailscale_changes(config, db, monkeypatch):
    import subprocess
    *_, runtime = services(config, db)
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('Global command attempted'))
    with pytest.raises(ValueError, match='Vanilla'):
        runtime.operations.enable_serve()
    asyncio.run(runtime.close())
