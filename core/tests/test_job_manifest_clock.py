import pytest
from core.storage import Storage
from core.queue import JobQueue
from core.tests.test_core import config, db, write_note
from datetime import datetime
from fastapi.testclient import TestClient
from core.app import create_app


@pytest.mark.parametrize('clock', ['00:00','09:00','10:30','16:00','23:59'])
def test_js_yaml_clock_survives_core_loading_and_scheduling(config, db, clock):
    write_note(config, 'jobs/clock/SKILL.md', 'Prepare a local summary.')
    write_note(config, 'jobs/clock/job.yaml', f'''version: 1
name: Example routine
worker: codex
projectId: default
model: example-model
effort: high
status: active
schedule:
  type: daily
  time: {clock}
  timezone: Europe/Berlin
''')
    store=Storage(db,config)
    job=store.sync_jobs()[0]
    assert job['status']=='active',job
    assert job['schedule']['time']==clock
    assert job['model']=='example-model'
    assert job['effort']=='high'
    queue=JobQueue(db,store)
    now=datetime.fromisoformat('2026-09-10T23:59:00+02:00')
    queue.schedule(now)
    run=queue.claim()
    assert run['job_id']=='clock'
    queue.finish(run['id'],'completed')
    queue.schedule(now)
    assert queue.claim() is None


def test_backup_activation_requires_archive_but_pausing_does_not(config, monkeypatch):
    app=create_app(config)
    def unavailable(*args):
        raise ValueError('Sicherungsziel fehlt.')
    monkeypatch.setattr(app.state.operations.backups, 'command', unavailable)
    with TestClient(app) as client:
        headers={'x-uwe-token':client.get('/api/auth/session').json()['token']}
        job={'id':'system-backup','status':'active','schedule':{'type':'daily','time':'03:30'}}
        result=client.post('/api/jobs/save',headers=headers,json=job)
        assert result.status_code==400
        assert result.json()['error']=='Sicherungsziel fehlt.'
        assert app.state.operations.settings.values['backup']['enabled'] is False
        result=client.post('/api/jobs/save',headers=headers,json={**job,'status':'paused'})
        assert result.status_code==200


def test_job_validation_errors_return_readable_client_response(config, monkeypatch):
    app=create_app(config)
    async def unavailable(*args, **kwargs):
        raise RuntimeError('Modell oder Reasoning nicht verfügbar.')
    monkeypatch.setattr(app.state.runtime,'request',unavailable)
    with TestClient(app) as client:
        headers={'x-uwe-token':client.get('/api/auth/session').json()['token']}
        result=client.post('/api/jobs/save',headers=headers,json={'id':'example','name':'Example','instructions':'Example task','status':'paused','schedule':{'type':'manual'}})
        assert result.status_code==400
        assert result.json()['error']=='Modell oder Reasoning nicht verfügbar.'
