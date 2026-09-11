import asyncio
import pytest
from core.calendar import Calendar
from core.tests.test_core import config, db


class Adapter:
    def __init__(self):
        self.source={'id':'calendar-test','provider':'microsoft-graph','projectId':'default'}
        self.events=[];self.complete=True;self.fail=False
    async def request(self,method,path,**kwargs):
        if path=='/api/services': return {'connections':[self.source]}
        if self.fail: raise ValueError('synthetic provider failure')
        return {'value':self.events,'complete':self.complete}


def event(id='meeting',start='2026-10-25T00:30:00',end='2026-10-25T02:30:00',**fields):
    return {'id':id,'subject':'Besprechung','start':{'dateTime':start,'timeZone':'UTC'},'end':{'dateTime':end,'timeZone':'UTC'},**fields}


def test_calendar_window_dst_recurrence_deletion_failure_and_projects(config,db):
    adapter=Adapter();c=Calendar(db,config,adapter,lambda project:None)
    db.put('control/state.json',{'connections':[{**adapter.source,'kind':'service'}]})
    body={'id':'calendar-test','projectId':'default','start':'2026-10-01','end':'2026-11-01'}
    async def scenario():
        assert c.read('default',body['start'],body['end'])['feeds'][0]['synced'] is None
        adapter.events=[event(seriesMasterId='series'),event('cancelled',isCancelled=True)]
        await c.sync(body)
        e=c.read('default',body['start'],body['end'])['events'][0]
        assert not c.read('default',body['start'],body['end'])['feeds'][0]['error']
        assert e['start']=='02:30' and e['end']=='03:30' and e['seriesId']=='series'
        again=Calendar(db,config,adapter,lambda project:None)
        assert again.read('default',body['start'],body['end'])['events'][0]['id']==e['id']
        adapter.fail=True
        with pytest.raises(ValueError): await c.sync(body)
        old=c.read('default',body['start'],body['end']);assert old['events'] and old['feeds'][0]['error']
        adapter.fail=False;adapter.complete=False
        with pytest.raises(ValueError): await c.sync(body)
        adapter.complete=True;adapter.events=[]
        await c.sync(body)
        assert c.read('default',body['start'],body['end'])['events']==[]
        with pytest.raises(ValueError):await c.sync({**body,'projectId':'other'})
        assert c.read('other',body['start'],body['end'])['feeds']==[]
        db.put('control/state.json',{'connections':[]})
        assert 'nicht mehr eingerichtet' in c.read('default',body['start'],body['end'])['feeds'][0]['error']
    asyncio.run(scenario())


def test_multiday_all_day_and_window_limits(config,db):
    c=Calendar(db,config,Adapter(),lambda project:None)
    items=c.normalize([event(start='2026-10-24T22:00:00',end='2026-10-26T23:00:00',isAllDay=True)],'test','2026-10-01','2026-11-01')
    assert [e['date'] for e in items]==['2026-10-25','2026-10-26']
    assert all(e['allDay'] for e in items)
    with pytest.raises(ValueError):c.read('default','2026-01-01','2027-01-01')


def test_native_calendar_survives_reopen_and_keeps_projects_revisions_and_sources(config,db):
    from uuid import uuid4
    c=Calendar(db,config,Adapter(),lambda project:None)
    body={'id':str(uuid4()),'title':'Abstimmung','date':'2026-09-10','start':'10:00','end':'11:00'}
    a=c.save_local(body);assert a['revision']==1 and a['source']=='Vanilla' and not a['readOnly']
    assert c.save_local(body)==a  # idempotent retry
    again=Calendar(db,config,Adapter(),lambda project:None)
    assert again.read('default','2026-09-10','2026-09-11')['events'][0]['id']==a['id']
    assert not again.read('other','2026-09-10','2026-09-11')['events']
    with pytest.raises(ValueError):again.save_local({**body,'title':'Geändert'})
    b=again.save_local({**body,'title':'Geändert','revision':1});assert b['revision']==2
    with pytest.raises(ValueError):again.delete_local({'id':a['id'],'revision':1})
    again.delete_local({'id':a['id'],'revision':2})
    assert not again.read('default','2026-09-10','2026-09-11')['events']
    with pytest.raises(ValueError):c.save_local(body)  # deleted IDs cannot resurrect on a delayed create retry
    with pytest.raises(ValueError):c.save_local({**body,'id':'external-source'})
    with pytest.raises(ValueError):c.save_local({**body,'start':'11:00','end':'10:00'})
    with pytest.raises(ValueError):c.save_local({**body,'date':'2026-03-29','start':'02:30','end':'04:00'})
    with pytest.raises(ValueError):c.save_local({**body,'date':'2026-10-25','start':'02:30','end':'04:00'})
    d=c.save_local({**body,'id':str(uuid4()),'allDay':True});assert d['allDay'] and d['startsAt']!=d['endsAt']


def test_saved_but_unsynced_connection_is_incomplete(config,db):
    c=Calendar(db,config,Adapter(),lambda project:None)
    db.put('control/state.json',{'connections':[{'id':'calendar-test','kind':'service','provider':'microsoft-graph','projectId':'default'}]})
    value=c.read('default','2026-09-10','2026-09-11')
    assert value['localReady'] and value['feeds'][0]['error'] and not value['feeds'][0]['synced']
