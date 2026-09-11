"""Recovery boundaries: synthetic data, no host services or real credentials."""
import asyncio
import io
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from time import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from core.tests.test_core import config, db, make_job
from core.tests.test_operations import services
from core.backups import Backups
from core.files import atomic_write, read_json
from core.restore import quarantine_database, recover


def test_restore_quarantines_canonical_delivery_and_jobs(config, db):
    _,_,_,_,storage,queue,runtime = services(config,db)
    make_job(config,'pending');storage.sync_jobs()
    run = queue.enqueue('pending','reserved-slot')
    db.put('control/message-delivery.json', {'version':1,'messages':[{'id':'message-1','chatId':'chat','status':'waiting','revision':1,'reviewedAt':1}],'gates':{}})
    db.put('job/cursor/pending',0)
    with db.transaction() as cx:
        cx.execute("INSERT INTO job_notifications(id,job_id,title,body,status,created_at,target,delivery) VALUES('n','pending','T','B','completed',0,'telegram','pending')")
        cx.execute("INSERT INTO sessions VALUES('old-session','csrf',?)",(time()+10000,))
    copy=config.data/'copy.sqlite3';db.backup(copy)
    quarantine_database(copy)
    with sqlite3.connect(copy) as cx:
        assert cx.execute('SELECT status,slot FROM executions').fetchone()==('interrupted','reserved-slot')
        assert cx.execute('SELECT delivery FROM job_notifications').fetchone()[0]=='unknown'
        assert cx.execute('SELECT count(*) FROM sessions').fetchone()[0]==0
        restored=json.loads(cx.execute("SELECT value FROM records WHERE key='control/message-delivery.json'").fetchone()[0])
        assert restored['messages'][0]['status']=='unknown'
        assert 'reviewedAt' not in restored['messages'][0]
    assert queue.get(run['id'])['status']=='queued'  # Original installation is untouched.
    asyncio.run(runtime.close())


def test_restored_schedule_skips_old_once_daily_interval_and_events(config,db):
    *_, storage,queue,runtime=services(config,db)
    now=datetime(2026,9,10,12,3,tzinfo=timezone.utc)
    for name,schedule in [('once',{'type':'once','at':'2026-09-10T11:00:00Z'}),('daily',{'type':'daily','time':'08:00'}),('periodic',{'type':'interval','minutes':5}),('event',{'type':'event','event':'synthetic'})]:
        make_job(config,name,schedule)
    db.put('recovery/not-before',now.timestamp())
    db.put('job/cursor/event',0)
    db.event('synthetic',None,{})
    # The offline restore advances existing event cursors along with the cutoff.
    newest=db.rows('SELECT max(id) n FROM events')[0]['n'];db.put('job/cursor/event',newest)
    queue.schedule(now)
    assert not db.rows('SELECT id FROM executions')
    queue.schedule(now.replace(minute=6))
    assert [r['job_id'] for r in db.rows('SELECT job_id FROM executions')]==['periodic']
    asyncio.run(runtime.close())


def test_failed_archive_validation_never_changes_target_or_key(config,db,monkeypatch):
    settings,_,_,o,*rest=services(config,db)
    settings.set_group('backup',target=str(config.root/'old'))
    before=settings.read()
    calls=[]
    def fail(*args,**kwargs):
        calls.append(settings.read())
        raise ValueError('synthetic rejected archive')
    monkeypatch.setattr(o.backups,'command',fail)
    with pytest.raises(ValueError):o.backups.configure(str(config.root/'new'),'synthetic-archive-passphrase')
    assert calls==[before] and settings.read()==before
    assert not db.get('provider-vault/system-backup')['found']
    asyncio.run(rest[-1].close())


def test_failed_restore_stage_removes_extracted_secrets(config,db,monkeypatch):
    *_,o,storage,queue,runtime=services(config,db)
    def extract(*args,**kwargs):
        destination=Path(args[-1]);(destination/'provider.key').write_text('synthetic-secret')
        raise ValueError('incomplete archive')
    monkeypatch.setattr(o.backups,'command',extract)
    with pytest.raises(ValueError):o.backups.stage_restore('a'*64)
    assert list((config.data/'restores').iterdir())==[]
    asyncio.run(runtime.close())


def test_backup_state_keeps_last_success_and_rejects_old_green(config,db,monkeypatch):
    settings,_,_,o,*rest=services(config,db)
    monkeypatch.setattr(Backups,'binary',property(lambda self:'/synthetic/restic'))
    assert o.backup_status()['state']=='unconfigured'
    target=str(config.root/'archive');Path(target).mkdir();(Path(target)/'config').write_text('synthetic archive')
    settings.set_group('backup',target=target,enabled=True)
    assert o.backup_status()['state']=='degraded'
    db.put('backup/last-success',{'snapshot':'a'*64,'target':target,'checked_at':time()})
    assert o.backup_status()['state']=='ready'
    o.record('backup','error',{'message':'synthetic failure'})
    assert o.backup_status()['state']=='error'
    assert o.backup_status()['last_success']['snapshot']=='a'*64
    (Path(target)/'config').unlink()
    assert 'erreichbar' in o.backup_status()['message']
    atomic_write(config.data/'heartbeat.json',json.dumps({'ok':True,'checked_at':time()-200}))
    assert o.status()['heartbeat']['state']=='stale' and not o.status()['heartbeat']['ok']
    settings.set_group('system',heartbeat=False)
    assert o.status()['heartbeat']['state']=='disabled'
    asyncio.run(rest[-1].close())


@pytest.mark.parametrize('body',['{}','{"checks":{}}','{"checks":{"api":{"ok":"yes"}}}'])
def test_heartbeat_rejects_partial_success(config,monkeypatch,body):
    import core.heartbeat as heartbeat
    config.data.mkdir()
    monkeypatch.setattr(heartbeat,'urlopen',lambda *a,**k:io.StringIO(body))
    assert not heartbeat.check(config.data)['ok']


def test_committed_journal_recreates_receipt_idempotently(config,db):
    state={'committed':True,'committed_at':123,'snapshot':'b'*64,'steps':[]}
    journal=config.data/'restore-journal.json';atomic_write(journal,json.dumps(state))
    atomic_write(config.data/'restore-pending.json','{}')
    recover(config,journal)
    assert read_json(config.data/'restore-last.json')['restored_at']==123
    assert not journal.exists() and not (config.data/'restore-pending.json').exists()
    recover(config,journal)


def test_apply_rejected_active_work_leaves_no_pending_restore(config,monkeypatch):
    from core.app import create_app
    app=create_app(config)
    async def active():return True
    monkeypatch.setattr(app.state.runtime,'has_active_work',active)
    with TestClient(app) as client:
        client.headers['x-uwe-token']=client.get('/api/auth/session').json()['token']
        app.state.db.put('backup/restore/test',{'verified':True,'path':'unused','snapshot':'a'*64})
        response=client.post('/api/system/backups/apply',json={'id':'test'})
        assert response.status_code==400
        assert not (config.data/'restore-pending.json').exists()
        assert not app.state.runtime.frozen


def test_restore_hold_survives_restart_and_allows_only_explicit_resume(config,monkeypatch):
    from core.app import create_app
    import core.api as api
    atomic_write(config.data/'restore-hold.json','{"snapshot":"synthetic"}')
    stopped=[];monkeypatch.setattr(api.os,'kill',lambda *args:stopped.append(args))
    app=create_app(config)
    with TestClient(app) as client:
        client.headers['x-uwe-token']=client.get('/api/auth/session').json()['token']
        assert client.get('/api/system/status').json()['recovery']['paused']
        assert app.state.mail.task is None
        assert client.post('/api/system/restart',json={}).status_code==503
        assert client.post('/api/system/settings',json={}).status_code==503
        assert client.post('/api/system/backups/resume',json={}).status_code==200
        assert not (config.data/'restore-hold.json').exists()
        assert app.state.runtime.frozen  # Until the actual process replacement.


def test_supervisor_marks_interrupted_even_when_restart_disabled(config,db):
    settings,_,_,_,storage,queue,runtime=services(config,db)
    make_job(config);storage.sync_jobs();run=queue.enqueue('daily');queue.claim();queue.dispatched(run['id'],{'threadId':'synthetic'})
    settings.set_group('system',auto_restart=False)
    config.start_adapter=True;runtime.process=SimpleNamespace(returncode=1)
    asyncio.run(runtime.supervise())
    assert queue.get(run['id'])['status']=='interrupted'
    assert runtime.process.returncode==1
    asyncio.run(runtime.close())


@pytest.mark.parametrize('phase',['swap','receipt'])
def test_crash_restart_rolls_back_or_finishes_once(config,db,monkeypatch,phase):
    import core.restore as restore
    from core.files import sha256
    from core.tests.test_core import write_note
    write_note(config,'notes/Before.md','before')
    stage=config.data/'restores/crash';(stage/'workspace/notes').mkdir(parents=True)
    (stage/'workspace/notes/After.md').write_text('after')
    db.backup(stage/'database.sqlite3')
    with sqlite3.connect(stage/'database.sqlite3') as cx:cx.execute('PRAGMA journal_mode=DELETE')
    db.close()
    manifest={'format':'agent-backup-v1','schema':2,'files':{p.relative_to(stage).as_posix():sha256(p) for p in stage.rglob('*') if p.is_file()}}
    atomic_write(stage/'manifest.json',json.dumps(manifest))
    atomic_write(config.data/'restore-pending.json',json.dumps({'path':str(stage),'snapshot':'a'*64}))
    replace=restore.os.replace;receipt=restore.receipt
    if phase=='swap':
        def crash(source,target):
            if Path(target)==config.workspace and '-new-' in str(source):raise SystemExit('simulated process death')
            return replace(source,target)
        monkeypatch.setattr(restore.os,'replace',crash)
    else:
        monkeypatch.setattr(restore,'receipt',lambda *args:(_ for _ in ()).throw(SystemExit('simulated process death')))
    with pytest.raises(SystemExit):restore.apply_pending(config)
    assert (config.data/'restore-journal.json').exists()
    monkeypatch.setattr(restore.os,'replace',replace);monkeypatch.setattr(restore,'receipt',receipt)
    restore.apply_pending(config);restore.apply_pending(config)
    assert not (config.data/'restore-journal.json').exists()
    result=read_json(config.data/'restore-last.json')
    assert result['ok']==(phase=='receipt')
    assert (config.workspace/('notes/After.md' if phase=='receipt' else 'notes/Before.md')).is_file()
    assert (config.data/'restore-hold.json').exists()==(phase=='receipt')


def test_archive_commit_failure_preserves_old_target_and_ciphertext(config,db,monkeypatch):
    from contextlib import contextmanager
    from core.provider_vault import ProviderVault
    settings,_,_,o,*rest=services(config,db)
    target=str(config.root/'old-archive');settings.set_group('backup',target=target,enabled=True)
    vault=ProviderVault(config.data/'provider-vault',db,config.root);vault.save('system-backup','old-synthetic-passphrase')
    before=settings.read();ciphertext=db.get(vault.name('system-backup'))
    monkeypatch.setattr(o.backups,'command',lambda *a,**kw:'[]')
    original=db.transaction
    @contextmanager
    def fail_commit():
        with original() as cx:
            yield cx
            raise OSError('simulated database commit failure')
    monkeypatch.setattr(db,'transaction',fail_commit)
    with pytest.raises(OSError):o.backups.configure(str(config.root/'new-archive'),'new-synthetic-passphrase')
    assert settings.read()==before and db.get(vault.name('system-backup'))==ciphertext
    monkeypatch.setattr(db,'transaction',original)
    asyncio.run(rest[-1].close())


def test_backup_staging_cleanup_rejects_symlink(config,db):
    *_,o,storage,queue,runtime=services(config,db)
    stage=config.data/'backup-staging';stage.mkdir();(stage/'secret').write_text('synthetic')
    o.backups.discard_staging();assert not stage.exists()
    elsewhere=config.root/'elsewhere';elsewhere.mkdir();(elsewhere/'keep').write_text('keep')
    stage.symlink_to(elsewhere,target_is_directory=True)
    with pytest.raises(ValueError):o.backups.discard_staging()
    assert (elsewhere/'keep').read_text()=='keep'
    stage.unlink();asyncio.run(runtime.close())


def test_main_uses_controlled_shutdown_and_exec_after_cleanup(config,monkeypatch):
    import core.__main__ as entry
    from core.config import Config
    from core.runtime import Runtime
    from core.files import atomic_write
    calls=[]
    runtime=SimpleNamespace(shutdown=None)
    app=SimpleNamespace(state=SimpleNamespace(runtime=runtime))
    monkeypatch.setattr(Config,'environment',classmethod(lambda cls,**kw:config))
    monkeypatch.setattr(entry,'create_app',lambda config:app)
    class Server:
        def __init__(self,options):self.should_exit=False;self.started=True
        def run(self):
            runtime.shutdown();assert self.should_exit
            atomic_write(config.data/'restart.json','{"requested":true}')
            calls.append('cleaned')
    monkeypatch.setattr(entry.uvicorn,'Server',Server)
    monkeypatch.setattr(entry.os,'execv',lambda *args:calls.append('exec'))
    entry.main()
    assert calls==['cleaned','exec']
    assert not (config.data/'restart.json').exists()


def test_maintenance_hold_resumes_in_place_for_the_matching_operator(config,monkeypatch):
    from core.app import create_app
    atomic_write(config.data/'updates/maintenance.json','{"id":"release-1","nonce":"secret"}')
    app=create_app(config)
    with TestClient(app) as client:
        assert app.state.runtime.update_hold and app.state.runtime.frozen
        assert app.state.mail.task is None
        assert client.post('/internal/maintenance/resume',json={'id':'release-1'}).status_code==403
        headers={'x-agent-update':'secret'}
        assert client.post('/internal/maintenance/resume',json={'id':'other'},headers=headers).status_code==400
        response=client.post('/internal/maintenance/resume',json={'id':'release-1'},headers=headers)
        assert response.status_code==200 and response.json()['resumed'] is True
        assert not app.state.runtime.update_hold and not app.state.runtime.frozen
        assert app.state.mail.task is not None
        assert not (config.data/'updates/maintenance.json').exists()
        assert client.post('/internal/maintenance/resume',json={'id':'release-1'},headers=headers).status_code==403


def test_restore_journal_rolls_back_env_with_other_files(config,db):
    original=config.root/'.agent-restore-test-.env'
    original.write_text('ORIGINAL="private-value"\n')
    env=config.root/'.env';env.write_text('REPLACEMENT="different-value"\n')
    journal=config.data/'restore-journal.json'
    atomic_write(journal,json.dumps({'steps':[{'target':str(env),'old':str(original),'prepared':None,'existed':True,'started':True}]}))
    recover(config,journal)
    assert env.read_text()=='ORIGINAL="private-value"\n'
    assert not original.exists() and not journal.exists()
