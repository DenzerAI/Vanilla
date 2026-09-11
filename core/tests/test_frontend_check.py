import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest

from core.frontend_check import check_frontend, FrontendCheckError
from core.tests.test_core import config, db
from core.tests.test_operations import services
from core.settings import Settings


def fixture_client(config, *, body=b'{"private":"never retain this"}', failures=False, cache='no-store', restart=False):
    dist = config.root/'wrapper/dist'
    (dist/'.vite').mkdir(parents=True)
    (dist/'assets').mkdir()
    (dist/'.vite/manifest.json').write_text(json.dumps({'blueprint.html':{'isEntry':True,'file':'assets/preview.js'},'index.html':{'isEntry':True,'file':'assets/main.js'}}))
    (dist/'assets/main.js.br').write_bytes(b'compressed')
    (dist/'version.json').write_text('{"uiVersion":"current"}')
    def respond(request):
        if request.url.path.startswith('/assets/'):
            return httpx.Response(200, headers={'Content-Encoding':'gzip','Cache-Control':'public, max-age=31536000, immutable'}, stream=httpx.ByteStream(b'compressed'))
        if failures and request.url.path == '/api/bootstrap':
            raise httpx.ReadTimeout('timeout',request=request)
        payload = json.dumps({'uiVersion':'current','restartRequired':restart}).encode() if request.url.path == '/api/updates' else body
        return httpx.Response(200,headers={'Cache-Control':cache},stream=httpx.ByteStream(payload))
    return httpx.Client(base_url='http://127.0.0.1',transport=httpx.MockTransport(respond))


def runner(*args, **kwargs):
    assert not any(k.startswith(('AGENT_','UWE_')) for k in kwargs['env'])
    assert kwargs['timeout'] == 15
    return SimpleNamespace(returncode=0)


def test_healthy_check_retains_only_metrics(config):
    with fixture_client(config) as client:
        result=check_frontend(config,client=client,runner=runner)
    assert result['ok'], result
    assert result['metrics']['bootstrap']['samples']==3
    assert 'never retain this' not in json.dumps(result)


@pytest.mark.parametrize('options,expected',[
    ({'failures':True},'wiederholt'),
    ({'cache':'public'},'private Daten'),
    ({'restart':True},'aktiviert'),
    ({'body':b'x'*(300*1024)},'große Datenantwort'),
    ({'body':b'x'*(1024*1024+1)},'über 1 MiB'),
])
def test_check_reports_real_regressions(config,options,expected):
    with fixture_client(config,**options) as client:
        result=check_frontend(config,client=client,runner=runner)
    assert not result['ok']
    assert expected in ' '.join(result['issues'])


def test_single_slow_sample_does_not_raise_alarm(config,monkeypatch):
    # Asset, 3 bootstrap, 3 chats, 3 connections, root, updates: paired clock reads.
    ticks=iter(value for duration in [0,3,0,0,0,0,0,0,0,0,0,0] for value in [0,duration])
    monkeypatch.setattr('core.frontend_check.monotonic',lambda:next(ticks))
    with fixture_client(config) as client:
        assert check_frontend(config,client=client,runner=runner)['ok']


def test_repeated_slow_samples_raise_alarm(config,monkeypatch):
    ticks=iter(value for duration in [0,3,3,0,0,0,0,0,0,0,0,0] for value in [0,duration])
    monkeypatch.setattr('core.frontend_check.monotonic',lambda:next(ticks))
    with fixture_client(config) as client:
        result=check_frontend(config,client=client,runner=runner)
    assert not result['ok']
    assert result['metrics']['bootstrap']['medianMs']==3000


def test_job_default_pause_persistence_and_error_metrics(config,db,monkeypatch):
    settings,_,_,operations,storage,queue,runtime=services(config,db)
    storage.system_jobs=operations.managed_jobs
    storage.sync_jobs()
    assert storage.job('system-frontend')['status']=='active'
    settings.set_group('system',frontend_check=False)
    assert Settings(db).values['system']['frontend_check'] is False
    storage.sync_jobs()
    assert storage.job('system-frontend')['status']=='paused'
    details={'ok':False,'issues':['test failure'],'metrics':{'bootstrap':{'medianMs':3000}}}
    monkeypatch.setattr('core.operations.check_frontend',lambda _:details)
    with pytest.raises(FrontendCheckError):
        operations.run('frontend')
    record=db.rows("SELECT * FROM maintenance WHERE name='frontend'")[0]
    assert record['status']=='error'
    assert json.loads(record['details'])==details
    asyncio.run(runtime.close())


def test_job_waits_for_active_work_without_freezing_workers(config,db,monkeypatch):
    _,_,_,operations,storage,queue,runtime=services(config,db)
    storage.system_jobs=operations.managed_jobs
    storage.sync_jobs()
    queue.enqueue('system-frontend');run=queue.claim()
    runtime.adapter_active=1
    monkeypatch.setattr(operations,'run',lambda _:pytest.fail('must wait for idle'))
    asyncio.run(runtime.execute(run))
    assert queue.get(run['id'])['status']=='queued'
    assert not runtime.frozen
    asyncio.run(runtime.close())


def test_success_uses_existing_queue_without_a_worker(config,db,monkeypatch):
    _,_,_,operations,storage,queue,runtime=services(config,db)
    storage.system_jobs=operations.managed_jobs
    storage.sync_jobs()
    queue.enqueue('system-frontend');run=queue.claim()
    details={'ok':True,'issues':[],'metrics':{'bootstrap':{'medianMs':70}}}
    monkeypatch.setattr('core.operations.check_frontend',lambda _:details)
    asyncio.run(runtime.execute(run))
    assert queue.get(run['id'])['status']=='completed'
    assert json.loads(db.rows("SELECT details FROM maintenance WHERE name='frontend'")[0]['details'])==details
    assert not runtime.frozen
    asyncio.run(runtime.close())
