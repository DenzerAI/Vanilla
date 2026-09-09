"""Bounded calendar projections from explicitly configured service connections."""
import asyncio
import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Request
from pydantic import BaseModel


def window(start, end):
    a, b = date.fromisoformat(start), date.fromisoformat(end)
    if not 0 < (b-a).days <= 93:
        raise ValueError('Kalenderzeitraum: 1 bis 93 Tage; Ende exklusiv.')
    return a, b


class Sync(BaseModel):
    id: str
    projectId: str = 'default'
    start: str
    end: str


class Calendar:
    def __init__(self, db, config, runtime, project):
        self.db, self.config, self.runtime, self.project = db, config, runtime, project
        self.lock = asyncio.Lock()
        self.task = None
        with db.lock:
            db.connection.execute('CREATE TABLE IF NOT EXISTS calendar_windows(connection TEXT NOT NULL, project TEXT NOT NULL, start TEXT NOT NULL, end TEXT NOT NULL, data TEXT NOT NULL, synced TEXT, error TEXT NOT NULL, PRIMARY KEY(connection,project,start,end))')

    def normalize(self, items, connection, start, end):
        result = []
        zone = ZoneInfo(self.config.timezone)
        if not isinstance(items, list) or len(items)>10000:
            raise ValueError('Kalenderantwort ist ungültig oder zu groß.')
        for e in items:
            if not isinstance(e.get('id'), str) or not e['id']:
                raise ValueError('Externe Termin-ID fehlt.')
            if e.get('isCancelled'): continue
            all_day = e.get('isAllDay') is True
            # Graph is requested in UTC; never guess a non-UTC Windows zone.
            def instant(part):
                value = datetime.fromisoformat(part['dateTime'].replace('Z','+00:00'))
                if value.tzinfo is None:
                    if part.get('timeZone') not in {'UTC','Etc/UTC'}:
                        raise ValueError('Anbieter hat die angeforderte UTC-Zeitzone nicht geliefert.')
                    value = value.replace(tzinfo=timezone.utc)
                return value.astimezone(zone)
            if all_day:
                # All-day boundaries are calendar dates, not instants to shift.
                a=instant(e['start']).date();b=instant(e['end']).date()
                first,last=a,b
            else:
                a,b=instant(e['start']),instant(e['end'])
                first,last=a.date(),(b-timedelta(microseconds=1)).date()+timedelta(days=1)
            if b<=a: raise ValueError('Kalenderende liegt nicht nach Beginn.')
            day=max(first,date.fromisoformat(start));until=min(last,date.fromisoformat(end))
            while day<until:
                result.append({'id':hashlib.sha256((connection+':'+e['id']).encode()).hexdigest()+':'+day.isoformat(),
                    'externalId':e['id'],'connectionId':connection,'title':str(e.get('subject') or 'Ohne Titel')[:1000],
                    'date':day.isoformat(),'start':'' if all_day else a.strftime('%H:%M') if day==first else '00:00',
                    'end':'' if all_day else b.strftime('%H:%M') if day==b.date() else '24:00',
                    'startsAt':a.isoformat(),'endsAt':b.isoformat(),'allDay':all_day,'timezone':self.config.timezone,
                    'location':str((e.get('location') or {}).get('displayName',''))[:2000],
                    'source':'Microsoft Kalender · '+connection,'sourceRevision':e.get('changeKey'),
                    'seriesId':e.get('seriesMasterId'),'readOnly':True})
                day+=timedelta(days=1)
        return result

    async def sync(self, body):
        b=Sync.model_validate(body);self.project(b.projectId);window(b.start,b.end)
        async with self.lock:
            services=await self.runtime.request('GET','/api/services')
            source=next((c for c in services['connections'] if c['id']==b.id and c.get('projectId','default')==b.projectId and c['provider']=='microsoft-graph'),None)
            if not source: raise ValueError('Microsoft-Kalenderanschluss in diesem Projekt nicht gefunden.')
            try:
                zone=ZoneInfo(self.config.timezone)
                bounds={k:datetime.combine(date.fromisoformat(getattr(b,k)),datetime.min.time(),zone).isoformat() for k in ['start','end']}
                answer=await self.runtime.request('POST','/api/services/action',json={'id':b.id,'action':'calendar','input':bounds},timeout=120)
                if answer.get('complete') is not True: raise ValueError('Kalenderabruf unvollständig; bisherigen Stand beibehalten.')
                latest=await self.runtime.request('GET','/api/services')
                if next((c for c in latest['connections'] if c['id']==b.id),None)!=source:
                    raise ValueError('Kalenderanschluss wurde inzwischen geändert. Erneut abgleichen.')
                events=self.normalize(answer['value'],b.id,b.start,b.end)
                now=datetime.now(timezone.utc).isoformat()
                with self.db.transaction() as cx:
                    # One authoritative window per connection: no stale overlapping copies.
                    cx.execute('DELETE FROM calendar_windows WHERE connection=? AND project=?',(b.id,b.projectId))
                    cx.execute('INSERT INTO calendar_windows VALUES(?,?,?,?,?,?,?)',(b.id,b.projectId,b.start,b.end,json.dumps(events),now,''))
                return {'count':len(events),'syncedAt':now,'start':b.start,'end':b.end}
            except Exception:
                with self.db.transaction() as cx:
                    rows=cx.execute('SELECT 1 FROM calendar_windows WHERE connection=? AND project=?',(b.id,b.projectId)).fetchall()
                    if rows: cx.execute('UPDATE calendar_windows SET error=? WHERE connection=? AND project=?',('Letzter Abgleich fehlgeschlagen. Stand prüfen.',b.id,b.projectId))
                    else: cx.execute('INSERT INTO calendar_windows VALUES(?,?,?,?,?,?,?)',(b.id,b.projectId,b.start,b.end,'[]',None,'Noch kein erfolgreicher Abgleich.'))
                raise

    async def loop(self):
        while True:
            try:
                sources=await self.runtime.request('GET','/api/services')
                for c in sources['connections']:
                    if c['provider']!='microsoft-graph': continue
                    today=datetime.now(ZoneInfo(self.config.timezone)).date()
                    # Preserve a deliberately selected view window while it remains useful.
                    old=self.db.rows('SELECT start,end FROM calendar_windows WHERE connection=? AND project=?',(c['id'],c.get('projectId','default')))
                    bounds=old[0] if old and old[0]['end']>today.isoformat() else {'start':(today-timedelta(days=7)).isoformat(),'end':(today+timedelta(days=62)).isoformat()}
                    try: await self.sync({'id':c['id'],'projectId':c.get('projectId','default'),**bounds})
                    except Exception: pass  # Per-feed status retains the failure; other feeds continue.
            except Exception: pass  # Adapter availability is reported by system status.
            await asyncio.sleep(300)

    async def close(self):
        if self.task:
            self.task.cancel()
            try: await self.task
            except asyncio.CancelledError: pass

    def read(self, project, start, end):
        self.project(project);window(start,end)
        feeds=self.db.rows('SELECT * FROM calendar_windows WHERE project=?',(project,))
        return {'events':sorted([e for f in feeds for e in json.loads(f['data']) if start<=e['date']<end],key=lambda e:(e['date'],not e['allDay'],e['start'],e['id'])),
                'feeds':[{k:v for k,v in f.items() if k!='data'}|{'covered':f['start']<=start and f['end']>=end} for f in feeds],
                'start':start,'end':end,'timezone':self.config.timezone,'readOnly':True}


def routes(calendar):
    router=APIRouter()
    @router.get('/api/calendar/events')
    async def events(projectId: str='default', start: str='',end: str=''):
        today=date.today()
        return calendar.read(projectId,start or today.isoformat(),end or (today+timedelta(days=31)).isoformat())
    @router.post('/api/calendar/sync')
    async def sync(b: Sync): return await calendar.sync(b)
    @router.post('/api/calendar/tool')
    @router.post('/internal/calendar/tool')
    async def tool(request: Request):
        b=await request.json();a=b.get('arguments') or {}
        if b.get('name')=='calendar_sync': return await calendar.sync(a)
        if b.get('name')=='calendar_list': return calendar.read(a.get('projectId','default'),a.get('start',''),a.get('end',''))
        raise ValueError('Unbekanntes Kalenderwerkzeug.')
    return router
