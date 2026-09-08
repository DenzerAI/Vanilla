"""Chat tools use the same manifests and scheduler as the jobs form."""
import asyncio
import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def instant(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if result.tzinfo is None:
            raise ValueError()
        return result
    except (ValueError, TypeError, AttributeError):
        raise ValueError('Zeitpunkt mit Datum und Zeitzone angeben.') from None


def validate_schedule(schedule):
    if not isinstance(schedule, dict):
        raise ValueError('Zeitplan muss ein Objekt sein.')
    kind = schedule.get('type')
    if kind not in {'manual', 'daily', 'weekdays', 'weekly', 'once', 'interval', 'event'}:
        raise ValueError('Dieser Zeitplan wird nicht unterstützt.')
    try:
        ZoneInfo(schedule.get('timezone', 'Europe/Berlin'))
    except (ZoneInfoNotFoundError, TypeError, ValueError):
        raise ValueError('Unbekannte Zeitzone.') from None
    if kind in {'daily', 'weekdays', 'weekly'} and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', str(schedule.get('time', ''))):
        raise ValueError('Uhrzeit als HH:MM angeben.')
    if kind == 'weekly' and (not isinstance(schedule.get('days'), list) or not schedule['days'] or any(type(d) is not int or not 0 <= d <= 6 for d in schedule['days'])):
        raise ValueError('Wochentage: 0 = Montag bis 6 = Sonntag.')
    if kind == 'once':
        instant(schedule.get('at'))
    if schedule.get('startAt'):
        instant(schedule['startAt'])
    if kind == 'interval' and (type(schedule.get('minutes')) is not int or not 1 <= schedule['minutes'] <= 525600):
        raise ValueError('Intervall muss zwischen 1 und 525600 Minuten liegen.')
    if kind == 'event' and schedule.get('event') not in {'memory.captured', 'memory.changed', 'job.finished'}:
        raise ValueError('Unbekanntes Ereignis.')
    return schedule


def next_run(schedule, now=None):
    now = now or datetime.now(timezone.utc)
    zone = ZoneInfo(schedule.get('timezone', 'Europe/Berlin'))
    start = instant(schedule['startAt']) if schedule.get('startAt') else now
    now = max(now, start).astimezone(zone)
    kind = schedule['type']
    if kind == 'once':
        return schedule['at']
    if kind == 'interval':
        anchor = instant(schedule.get('startAt', now.isoformat()))
        seconds = schedule['minutes'] * 60
        n = max(1, int((now.timestamp() - anchor.timestamp()) // seconds) + 1)
        return datetime.fromtimestamp(anchor.timestamp() + n * seconds, zone).isoformat()
    if kind not in {'daily', 'weekdays', 'weekly'}:
        return None
    hour, minute = map(int, schedule['time'].split(':'))
    for offset in range(8):
        day = now + timedelta(days=offset)
        due = day.replace(hour=hour, minute=minute, second=0, microsecond=0, fold=0)
        if due.timestamp() <= now.timestamp() or (kind == 'weekdays' and day.weekday() >= 5) or (kind == 'weekly' and day.weekday() not in schedule['days']):
            continue
        # A missing spring-forward hour becomes the first corresponding real instant.
        return datetime.fromtimestamp(due.timestamp(), zone).isoformat()


def revision(job):
    values = {k: v for k, v in job.items() if k not in {'lastRun', 'lastSlot', 'revision', 'nextRun'}}
    return hashlib.sha256(json.dumps(values, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


class Routines:
    def __init__(self, storage, runtime, memory):
        self.storage, self.runtime, self.memory = storage, runtime, memory
        self.lock = asyncio.Lock()

    async def targets(self):
        return await self.runtime.request('GET', '/api/jobs/notification-targets')

    async def validate_notification(self, value, *, check_ready=True):
        if not isinstance(value, dict) or value.get('when', 'always') not in {'always', 'errors'}:
            raise ValueError('Benachrichtigung: always oder errors wählen.')
        target = value.get('target', 'app')
        if not isinstance(target, str) or (target != 'app' and not re.fullmatch('[a-f0-9]{64}', target)):
            raise ValueError('Ungültiges Benachrichtigungsziel.')
        if target != 'app' and check_ready:
            targets = await self.targets()
            if not any(t['id'] == target and t['ready'] for t in targets['targets']):
                raise ValueError('Benachrichtigungsziel ist nicht bereit. Verbindung prüfen oder App wählen.')
        return {'when': value.get('when', 'always'), 'target': target}

    def present(self, job):
        due = next_run(job['schedule']) if job.get('status') == 'active' else None
        if job['schedule']['type'] == 'once' and self.storage.db.rows('SELECT id FROM executions WHERE slot=?', (f"{job['id']}:once:{instant(job['schedule']['at']).astimezone(timezone.utc).isoformat()}",)):
            due = None
        return {**job, 'revision': revision(job), 'nextRun': due}

    async def tool(self, name, a):
        project = a.get('projectId', 'default')
        self.memory.project_prefix(project)
        if name == 'routine_capabilities':
            targets = await self.targets()
            return {**targets, 'preference': self.storage.db.get('notifications/preference')['value'] or {'target':'app','when':'always'}, 'timezone': self.runtime.config.timezone, 'now': datetime.now(timezone.utc).isoformat(), 'schedules': ['once', 'daily', 'weekdays', 'weekly', 'interval'], 'delivery': 'App always retains results. External delivery requires an explicitly selected ready target or the user-saved preference. The host must be awake and the service running.'}
        async with self.lock:
            jobs = self.storage.sync_jobs()
            own = [j for j in jobs if j.get('projectId', 'default') == project and not j.get('managed') and not j['id'].startswith('system-')]
            if name == 'routine_list':
                return {'jobs': [self.present(j) for j in own if j.get('status') != 'invalid']}
            if name == 'routine_create':
                key = a.get('requestKey', '')
                if not isinstance(key, str) or not 8 <= len(key) <= 150:
                    raise ValueError('Stabile requestKey für diesen Auftrag angeben; bei Wiederholung beibehalten.')
                id = 'routine-' + hashlib.sha256((project + ':' + key).encode()).hexdigest()[:24]
                old = next((j for j in own if j['id'] == id), None)
                if old:
                    return {'created': False, 'job': self.present(old)}
                job = {'id': id, 'projectId': project, 'worker': 'auto', 'status': 'active', 'requestKey': key}
            elif name == 'routine_update':
                job = next((j for j in own if j['id'] == a.get('id')), None)
                if not job:
                    raise ValueError('Routine in diesem Projekt nicht gefunden.')
                if a.get('revision') != revision(job):
                    raise FileExistsError('Routine wurde geändert. Erst erneut lesen, dann ändern.')
            else:
                raise ValueError('Unbekanntes Routine-Werkzeug.')
            for key in ['name', 'instructions', 'schedule', 'notification', 'status']:
                if key in a:
                    job[key] = a[key]
            for key in ['name', 'instructions']:
                if not isinstance(job.get(key), str) or not job[key].strip() or len(job[key]) > (200 if key == 'name' else 30000):
                    raise ValueError('Name und ausführbare Arbeitsanweisung angeben.')
            if job['status'] not in {'active', 'paused'}:
                raise ValueError('Status: active oder paused.')
            schedule = validate_schedule(dict(job.get('schedule') or {}))
            if schedule['type'] not in {'once', 'daily', 'weekdays', 'weekly', 'interval'}:
                raise ValueError('Für Routinen einen zeitlichen Auslöser wählen.')
            if name == 'routine_create' or 'schedule' in a or (a.get('status') == 'active' and job.get('status') == 'active'):
                schedule['startAt'] = datetime.now(timezone.utc).isoformat()
            schedule.setdefault('timezone', self.runtime.config.timezone)
            if job['status'] == 'active' and schedule['type'] == 'once' and instant(schedule['at']) <= datetime.now(timezone.utc):
                raise ValueError('Der einmalige Termin muss in der Zukunft liegen.')
            job['schedule'] = schedule
            preference = self.storage.db.get('notifications/preference')['value'] or {'target': 'app', 'when': 'always'}
            job['notification'] = await self.validate_notification(job.get('notification', preference), check_ready=job['status']=='active' or 'notification' in a)
            if job['status'] == 'active':
                readiness = await self.runtime.request('GET', '/api/jobs/readiness')
                if not readiness.get('ready'):
                    raise ValueError('Kein ausführbarer Standard-Worker verbunden. Erst unter Worker verbinden.')
            saved = await self.runtime.request('POST', '/api/jobs/save', json=job)
            self.storage.sync_jobs()
            self.storage.db.event('job.changed', saved['id'], {})
            return {'created': name == 'routine_create', 'job': self.present(saved)}
