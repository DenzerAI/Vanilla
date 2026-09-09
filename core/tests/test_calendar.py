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
        assert c.read('default',body['start'],body['end'])['feeds']==[]
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
