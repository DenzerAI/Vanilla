"""Durable run receipts. Completion and receipt commit in the same transaction."""
import json
from time import time
from .database import dump


def record_completion(cx, run, status, result, error):
    job = json.loads(run['job_snapshot'] or '{}')
    policy = job.get('notification') or {'when': 'errors' if run['job_id'].startswith('system-') else 'always', 'target': 'app'}
    if status == 'cancelled' or (policy.get('when') == 'errors' and status == 'completed'):
        return
    target = policy.get('target', 'app')
    title = (job.get('name') or run['job_id']) + (' · Fertig' if status == 'completed' else ' · Braucht Aufmerksamkeit')
    text = (result or {}).get('text') if isinstance(result, dict) else None
    body = str(error or text or ('Das Ergebnis ist beim Auftrag verfügbar.' if status == 'completed' else 'Ausführung prüfen.'))[:30000]
    cx.execute('INSERT OR IGNORE INTO job_notifications(id,job_id,title,body,status,created_at,target,delivery) VALUES(?,?,?,?,?,?,?,?)',
               (run['id'], run['job_id'], title, body, status, time(), target, 'pending' if target != 'app' else 'app'))
    cx.execute("INSERT INTO events(kind,entity_id,payload,created_at) VALUES('notification.created',?,?,?)", (run['id'], dump({'title': title}), time()))


class Notifications:
    def __init__(self, db):
        self.db = db
        with db.transaction() as cx:
            columns = {row[1] for row in cx.execute('PRAGMA table_info(job_notifications)')}
            if 'kind' not in columns:
                cx.execute("ALTER TABLE job_notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'job'")
            if 'subject_id' not in columns:
                cx.execute("ALTER TABLE job_notifications ADD COLUMN subject_id TEXT")

    def system(self, id, kind, subject, title, body, status='completed'):
        if kind not in {'update', 'contribution', 'ai-update'}:
            raise ValueError('Unbekannte Systembenachrichtigung.')
        with self.db.transaction() as cx:
            inserted = cx.execute("INSERT OR IGNORE INTO job_notifications(id,job_id,title,body,status,created_at,target,delivery,kind,subject_id) VALUES(?,'',?,?,?,?, 'app','app',?,?)",
                                  (id, title, body, status, time(), kind, subject)).rowcount
            if inserted:
                cx.execute("INSERT INTO events(kind,entity_id,payload,created_at) VALUES('notification.created',?,?,?)", (id, dump({'title': title}), time()))

    def attention(self, run):
        if run['status'] not in {'dispatching', 'running'}:
            return {'ok': True}
        id = 'attention-' + run['id']
        with self.db.transaction() as cx:
            if not cx.execute('SELECT 1 FROM job_notifications WHERE id=?', (id,)).fetchone():
                record_completion(cx, {**run, 'id': id}, 'waiting', {}, 'Die Routine braucht eine Antwort oder Freigabe. Öffne ihren Chat, damit sie weiterarbeiten kann.')
        return {'ok': True}

    def list(self, before=None):
        rows = self.db.rows('SELECT * FROM job_notifications' + (' WHERE created_at<?' if before is not None else '') + ' ORDER BY created_at DESC,id DESC LIMIT 50', (before,) if before is not None else ())
        return {'items': rows, 'unread': self.db.rows('SELECT count(*) n FROM job_notifications WHERE read_at IS NULL')[0]['n'], 'next': rows[-1]['created_at'] if len(rows) == 50 else None}

    def results(self):
        return {'items': self.db.rows("SELECT * FROM job_notifications WHERE status='completed' AND kind='job' ORDER BY created_at DESC,id DESC LIMIT 5")}

    def read(self, id):
        with self.db.transaction() as cx:
            cx.execute('UPDATE job_notifications SET read_at=coalesce(read_at,?) WHERE id=?', (time(), id))
        self.db.event('notification.read', id, {})
        return {'ok': True}

    def get(self, id):
        rows = self.db.rows('SELECT * FROM job_notifications WHERE id=?', (id,))
        if not rows:
            raise ValueError('Benachrichtigung nicht gefunden.')
        return rows[0]

    def recover(self):
        with self.db.transaction() as cx:
            cx.execute("UPDATE job_notifications SET delivery='unknown',delivery_error='Versand beim Neustart unbestätigt. Kein automatischer Doppelversand.' WHERE delivery='sending'")

    async def deliver_next(self, runtime):
        with self.db.transaction() as cx:
            row = cx.execute("SELECT * FROM job_notifications WHERE delivery='pending' ORDER BY created_at LIMIT 1").fetchone()
            if not row:
                return
            row = dict(row)
            cx.execute("UPDATE job_notifications SET delivery='sending' WHERE id=?", (row['id'],))
        try:
            # No automatic HTTP retry: an interrupted response may already have sent.
            origin = getattr(getattr(runtime, 'config', None), 'public_origin', '')
            link = '\n\nErgebnis öffnen: ' + origin + '/?view=jobs&notification=' + row['id'] if origin else ''
            outcome = await runtime.request('POST', '/api/jobs/notify', json={'id': row['id'], 'target': row['target'], 'text': row['title'] + '\n\n' + row['body'][:3200] + link}, timeout=45)
            state, error = outcome['status'], outcome.get('error')
            if state not in {'sent', 'failed', 'unknown'}:
                raise ValueError('Unbekannte Versandantwort.')
        except Exception:
            state, error = 'unknown', 'Zustellung unbestätigt. Ergebnis hier öffnen; kein automatischer Doppelversand.'
        with self.db.transaction() as cx:
            cx.execute('UPDATE job_notifications SET delivery=?,delivery_error=? WHERE id=?', (state, error, row['id']))
        self.db.event('notification.delivery', row['id'], {'status': state})
