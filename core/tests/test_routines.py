import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from core.app import create_app
from core.database import Database
from core.notifications import Notifications
from core.queue import JobQueue
from core.routines import Routines, next_run, validate_schedule
from core.storage import Storage
from core.mcp import tools
from core.tests.test_core import config, db, make_job, write_note


def scheduled(config, db, schedule, **changes):
    make_job(config, schedule=schedule)
    p=config.workspace/'jobs/daily/job.yaml'
    value=json.loads(p.read_text());value.update(changes);p.write_text(json.dumps(value))
    storage=Storage(db,config);storage.sync_jobs()
    return JobQueue(db,storage)


def test_future_daily_does_not_immediately_catch_up_on_creation(config,db):
    q=scheduled(config,db,{'type':'daily','time':'08:00','timezone':'Europe/Berlin','startAt':'2026-09-08T20:00:00+02:00'})
    q.schedule(datetime.fromisoformat('2026-09-08T20:01:00+02:00'))
    assert not db.rows('SELECT * FROM executions')
    q.schedule(datetime.fromisoformat('2026-09-09T08:00:00+02:00'))
    assert len(db.rows('SELECT * FROM executions'))==1
    assert next_run(q.storage.job('daily')['schedule'],datetime.fromisoformat('2026-09-08T20:00:00+02:00'))=='2026-09-09T08:00:00+02:00'


def test_weekly_timezone_and_dst_repeat_only_once(config,db):
    q=scheduled(config,db,{'type':'weekly','days':[6],'time':'02:30','timezone':'Europe/Berlin'})
    q.schedule(datetime.fromisoformat('2026-10-25T00:30:00+00:00'))
    run=q.claim();assert run
    q.finish(run['id'],'completed',{'text':'Done'})
    q.schedule(datetime.fromisoformat('2026-10-25T01:30:00+00:00'))
    assert len(db.rows('SELECT * FROM executions'))==1


def test_once_catches_missed_time_without_repeating(config,db):
    q=scheduled(config,db,{'type':'once','at':'2026-09-08T08:00:00+02:00'})
    q.schedule(datetime.fromisoformat('2026-09-07T08:00:00+02:00'));assert not q.claim()
    q.schedule(datetime.fromisoformat('2026-09-09T08:00:00+02:00'))
    run=q.claim();q.finish(run['id'],'completed')
    q.schedule(datetime.fromisoformat('2026-09-10T08:00:00+02:00'))
    assert len(db.rows('SELECT * FROM executions'))==1


def test_interval_waits_full_interval_and_skips_backlog(config,db):
    q=scheduled(config,db,{'type':'interval','minutes':60,'startAt':'2026-09-08T08:17:00+00:00'})
    q.schedule(datetime.fromisoformat('2026-09-08T08:59:00+00:00'));assert not q.claim()
    q.schedule(datetime.fromisoformat('2026-09-08T12:20:00+00:00'))
    run=q.claim();assert run['slot'].endswith(':4')
    q.finish(run['id'],'completed')
    q.schedule(datetime.fromisoformat('2026-09-08T12:30:00+00:00'));assert not q.claim()


@pytest.mark.parametrize('schedule',[
    {'type':'weekly','days':[],'time':'08:00'},
    {'type':'weekly','days':[True],'time':'08:00'},
    {'type':'daily','time':'25:00'},
    {'type':'daily','time':'08:00','timezone':'Missing/Zone'},
    {'type':'once','at':'2026-09-08T08:00'},
    {'type':'interval','minutes':0},
    {'type':'cron','cron':'* * * * *'},
])
def test_invalid_schedule_is_never_silently_downgraded(schedule):
    with pytest.raises(ValueError):validate_schedule(schedule)


def test_notifications_commit_once_recover_and_keep_read_status(config,db):
    q=scheduled(config,db,{'type':'manual'},notification={'target':'app','when':'always'})
    run=q.enqueue('daily');q.claim();q.finish(run['id'],'completed',{'text':'Your report'})
    q.finish(run['id'],'failed',error='late duplicate')
    n=Notifications(db)
    assert n.list()['unread']==1
    assert n.list()['items'][0]['body']=='Your report'
    n.read(run['id']);assert n.list()['unread']==0
    other=q.enqueue('daily');q.claim();q.recover()
    assert n.list()['items'][0]['status']=='interrupted'
    assert n.list()['unread']==1


def test_successful_system_jobs_are_quiet_but_failures_notify(config,db):
    q=scheduled(config,db,{'type':'manual'},notification={'target':'app','when':'errors'})
    run=q.enqueue('daily');q.finish(run['id'],'completed');assert not Notifications(db).list()['items']
    run=q.enqueue('daily');q.finish(run['id'],'failed',error='Missing data')
    assert Notifications(db).list()['items'][0]['body']=='Missing data'


def test_attention_deduplicates_and_completion_still_arrives(config,db):
    q=scheduled(config,db,{'type':'manual'})
    run=q.enqueue('daily');run=q.claim();n=Notifications(db)
    n.attention(run);n.attention(run)
    assert n.list()['unread']==1
    q.finish(run['id'],'completed')
    assert n.list()['unread']==2


def test_external_send_ambiguous_is_not_retried(config,db):
    q=scheduled(config,db,{'type':'manual'},notification={'target':'a'*64,'when':'always'})
    run=q.enqueue('daily');q.finish(run['id'],'completed')
    n=Notifications(db);calls=[]
    async def request(*args,**kwargs):
        calls.append(kwargs);raise TimeoutError()
    async def scenario():
        await n.deliver_next(SimpleNamespace(request=request));await n.deliver_next(SimpleNamespace(request=request))
    asyncio.run(scenario())
    assert len(calls)==1
    assert n.list()['items'][0]['delivery']=='unknown'
    with db.transaction() as cx:cx.execute("UPDATE job_notifications SET delivery='sending'")
    n.recover();assert n.list()['items'][0]['delivery']=='unknown'


class FakeAdapter:
    def __init__(self,config):self.config=config;self.ready=True;self.saved=[]
    async def request(self,method,url,**kwargs):
        if url.endswith('readiness'):return {'ready':self.ready}
        if url.endswith('notification-targets'):return {'targets':[]}
        job=kwargs['json'];self.saved.append(job)
        write_note(self.config,f"jobs/{job['id']}/job.yaml",json.dumps({k:v for k,v in job.items() if k!='instructions'}))
        write_note(self.config,f"jobs/{job['id']}/SKILL.md",job['instructions'])
        return job


def test_chat_tools_create_retry_list_edit_pause_and_reject_wrong_project(config,db):
    storage=Storage(db,config);adapter=FakeAdapter(config)
    r=Routines(storage,adapter,SimpleNamespace(project_prefix=lambda project:project))
    a={'projectId':'default','requestKey':'same-chat-request','name':'Daily report','instructions':'Read the input report and summarize it.','schedule':{'type':'daily','time':'08:00'}}
    async def scenario():
        first=await r.tool('routine_create',a);again=await r.tool('routine_create',a)
        assert first['created'] and not again['created'] and len(adapter.saved)==1
        assert first['job']['notification']=={'target':'app','when':'always'}
        jobs=await r.tool('routine_list',{'projectId':'default'});job=jobs['jobs'][0]
        with pytest.raises(ValueError):await r.tool('routine_update',{'projectId':'other','id':job['id'],'revision':job['revision'],'status':'paused'})
        adapter.ready=False
        paused=await r.tool('routine_update',{'projectId':'default','id':job['id'],'revision':job['revision'],'status':'paused'})
        assert paused['job']['status']=='paused'
        with pytest.raises(FileExistsError):await r.tool('routine_update',{'projectId':'default','id':job['id'],'revision':job['revision'],'name':'Late overwrite'})
        with pytest.raises(ValueError):await r.tool('routine_create',{**a,'requestKey':'missing-worker-2'})
        with pytest.raises(ValueError):await r.tool('routine_create',{**a,'requestKey':'missing-target-3','notification':{'target':'b'*64,'when':'always'}})
    asyncio.run(scenario())


def test_bridge_exposes_mutations_as_mutations():
    catalog={t['name']:t for t in tools()}
    assert not catalog['routine_create']['annotations']['readOnlyHint']
    assert catalog['routine_list']['annotations']['readOnlyHint']


def test_notification_api_protects_writes_and_direct_send(config):
    app=create_app(config)
    with TestClient(app) as client:
        assert client.get('/api/notifications').json()['unread']==0
        assert client.get('/api/planner/results').json()=={'items':[]}
        assert client.post('/internal/planner/result',json={'id':'x'}).status_code==403
        assert client.post('/api/notifications/read',json={'id':'x'}).status_code==403
        assert client.post('/internal/jobs/attention',json={'id':'x'}).status_code==403
        token=client.get('/api/auth/session').json()['token']
        assert client.post('/api/jobs/notify',headers={'x-uwe-token':token},json={}).status_code==403
        assert client.post('/api/notifications/preference',headers={'x-uwe-token':token},json={'target':'app','when':'always'}).status_code==200
        assert client.get('/api/notifications/preference').json()['target']=='app'


def test_spring_dst_prediction_matches_scheduler(config,db):
    schedule={'type':'daily','time':'02:30','timezone':'Europe/Berlin'}
    q=scheduled(config,db,schedule)
    assert next_run(schedule,datetime.fromisoformat('2026-03-29T00:00:00+01:00'))=='2026-03-29T03:30:00+02:00'
    q.schedule(datetime.fromisoformat('2026-03-29T03:00:00+02:00'));assert not q.claim()
    q.schedule(datetime.fromisoformat('2026-03-29T03:30:00+02:00'));assert q.claim()


def test_equivalent_once_timestamp_never_replays(config,db):
    q=scheduled(config,db,{'type':'once','at':'2026-09-08T08:00:00+02:00'})
    q.schedule(datetime.fromisoformat('2026-09-08T08:00:00+02:00'));run=q.claim();q.finish(run['id'],'completed')
    p=config.workspace/'jobs/daily/job.yaml';data=json.loads(p.read_text());data['schedule']['at']='2026-09-08T06:00:00.000Z';p.write_text(json.dumps(data))
    q.schedule(datetime.fromisoformat('2026-09-08T08:01:00+02:00'))
    assert len(db.rows('SELECT * FROM executions'))==1


def test_planner_results_keep_latest_five_completed_even_beyond_notification_page(config, db):
    with db.transaction() as cx:
        for index in range(65):
            cx.execute('INSERT INTO job_notifications(id,job_id,title,body,status,created_at,target,delivery) VALUES(?,?,?,?,?,?,?,?)',
                       (f'report-{index:02}', 'daily', 'Routine result', f'Report {index}', 'completed' if index < 10 else 'failed', index, 'app', 'app'))
    notifications = Notifications(db)
    assert all(row['status'] == 'failed' for row in notifications.list()['items'])
    results = notifications.results()['items']
    assert [row['id'] for row in results] == ['report-09', 'report-08', 'report-07', 'report-06', 'report-05']
    assert all(row['read_at'] is None for row in results)


def test_categories_remain_independent_from_project_and_persist_through_native_tools(config, db):
    storage = Storage(db, config)
    adapter = FakeAdapter(config)
    routines = Routines(storage, adapter, SimpleNamespace(project_prefix=lambda project: project))
    async def scenario():
        result = await routines.tool('routine_create', {'projectId': 'default', 'requestKey': 'category-create', 'name': 'Report', 'instructions': 'Prepare the requested report.', 'category': 'Marketing', 'schedule': {'type': 'daily', 'time': '08:00'}})
        job = result['job']
        assert job['category'] == 'Marketing'
        assert job['projectId'] == 'default'
        updated = await routines.tool('routine_update', {'projectId': 'default', 'id': job['id'], 'revision': job['revision'], 'category': 'Immobilien'})
        assert updated['job']['category'] == 'Immobilien'
        assert updated['job']['projectId'] == 'default'
        restarted = Storage(db, config)
        restarted.sync_jobs()
        assert restarted.job(job['id'])['category'] == 'Immobilien'
        with pytest.raises(ValueError):
            await routines.tool('routine_update', {'projectId': 'default', 'id': job['id'], 'revision': updated['job']['revision'], 'category': ['bad']})
        assert restarted.job(job['id'])['category'] == 'Immobilien'
    asyncio.run(scenario())
