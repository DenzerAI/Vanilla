"""Per-chat screen privacy. Grants are ephemeral, tab-specific and checked in Python.

This is not encryption or isolation from administrators, tools, or exported files.
"""
import hashlib
import hmac
import json
import re
import secrets
import threading
from time import time

from fastapi import HTTPException


class ChatPrivacy:
    idle_seconds = 300

    def __init__(self, db, memory):
        self.db, self.memory = db, memory
        self.grants = {}
        self.lock = threading.RLock()
        # Snapshot of the privacy records while one payload is being filtered; None outside.
        self._snapshot = None
        try:
            with db.transaction() as cx:
                cx.execute("CREATE INDEX IF NOT EXISTS chats_briefing_id ON chats(json_extract(data,'$.briefingId'))")
        except Exception:
            pass

    def records(self):
        return {r['key'].removeprefix('chat-privacy/'): json.loads(r['value'])
                for r in self.db.rows("SELECT key,value FROM records WHERE key LIKE 'chat-privacy/%'")
                if r['value'] != 'null'}

    def record(self, id):
        if self._snapshot is not None:
            return self._snapshot['records'].get(str(id))
        return self.db.get('chat-privacy/' + str(id))['value']

    def allowed(self, id, client):
        return not self.record(id) or self.grants.get((id, client), 0) > time()

    def related(self, id):
        if not isinstance(id, str) or not id or self.record(id):
            return id
        run = id.removeprefix('attention-')
        rows = self.db.rows("SELECT thread_id AS id FROM executions WHERE id=? UNION SELECT id FROM chats WHERE json_extract(data,'$.briefingId')=?", (run, id))
        return next((r['id'] for r in rows if r['id'] and self.record(r['id'])), id)

    def require(self, id, client):
        id = self.related(id)
        if id and not self.allowed(id, client):
            raise HTTPException(423, 'Chat gesperrt. Bitte mit PIN entsperren.')

    def change(self, action, id, pin, client):
        if not isinstance(id, str) or not self.db.rows('SELECT id FROM chats WHERE id=?', (id,)):
            raise HTTPException(404, 'Chat nicht gefunden.')
        if not re.fullmatch(r'[a-zA-Z0-9_-]{32,100}', client):
            raise HTTPException(400, 'Bitte die App neu laden.')
        with self.lock:
            record = self.record(id)
            if action == 'lock':
                if not record:
                    raise HTTPException(409, 'Zuerst eine PIN festlegen.')
                self.revoke(id)
                return {'ok': True, 'locked': True}
            if action == 'touch':
                self.require(id, client)
                if record:
                    self.grants[id, client] = time() + self.idle_seconds
                return {'ok': True}
            if action not in {'setup', 'unlock', 'remove'}:
                raise HTTPException(404, 'Unbekannte Aktion.')
            if not isinstance(pin, str) or not re.fullmatch(r'[0-9]{4}', pin):
                raise HTTPException(400, 'Bitte genau vier Ziffern eingeben.')
            if action == 'setup':
                chat = self.db.rows('SELECT data FROM chats WHERE id=?', (id,))[0]
                if json.loads(chat['data']).get('firmaItemId'):
                    raise HTTPException(409, 'Firma-Arbeitschats gehören zur gemeinsamen Firmenablage. Für persönliche Inhalte bitte einen separaten privaten Chat verwenden.')
                if record:
                    raise HTTPException(409, 'Dieser Chat hat bereits eine PIN.')
                salt = secrets.token_hex(16)
                paths = {r['path'] for r in self.db.rows('SELECT path FROM memory_sources WHERE chat_id=?', (id,))}
                project = self.db.rows('SELECT project_id FROM chats WHERE id=?', (id,))[0]['project_id'] or 'default'
                prefix = self.memory.project_prefix(project)
                paths.update({prefix + 'brain/memory/Ergebnisse.md', prefix + 'brain/continuations/' + id + '.md'})
                record = {'salt': salt, 'hash': self.pin_hash(pin, salt), 'failures': 0, 'retryAt': 0, 'pendingPaths': sorted(paths)}
                # Persist protection first: cleanup errors must never leave the chat public.
                self.db.put('chat-privacy/' + id, record)
                self.revoke(id)
                try:
                    self.memory.forget_chat(id)
                    record['pendingPaths'] = []
                    self.db.put('chat-privacy/' + id, record)
                    self.memory.knowledge.scan()
                except Exception as error:
                    # Quarantined sources stay unreadable if cleanup or versioning fails.
                    raise HTTPException(503, 'Chat gesperrt. Die Bereinigung des gemeinsamen Gedächtnisses konnte nicht abgeschlossen werden.') from error
                return {'ok': True, 'locked': True}
            if not record:
                raise HTTPException(409, 'Dieser Chat ist nicht geschützt.')
            if record.get('retryAt', 0) > time():
                raise HTTPException(429, 'Zu viele Versuche. Bitte in einer Minute erneut versuchen.')
            if not hmac.compare_digest(record['hash'], self.pin_hash(pin, record['salt'])):
                record['failures'] = record.get('failures', 0) + 1
                if record['failures'] >= 5:
                    record['retryAt'] = time() + 60
                self.db.put('chat-privacy/' + id, record)
                raise HTTPException(403, 'Die PIN stimmt nicht.')
            record.update(failures=0, retryAt=0)
            self.db.put('chat-privacy/' + id, record)
            if action == 'remove':
                self.db.put('chat-privacy/' + id, None)
                self.revoke(id)
                return {'ok': True, 'locked': False}
            self.grants[id, client] = time() + self.idle_seconds
            return {'ok': True, 'locked': False, 'expiresIn': self.idle_seconds}

    @staticmethod
    def pin_hash(pin, salt):
        return hashlib.scrypt(pin.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()

    def revoke(self, id):
        self.grants = {k: v for k, v in self.grants.items() if k[0] != id and v > time()}
        self.db.event('chat.privacy', id, {})

    def path_private(self, path):
        if not isinstance(path, str):
            return False
        # Covers raw transcripts, daily notes, continuations and chat-owned artifacts.
        paths = {path}
        workspace = self._snapshot['workspace'] if self._snapshot is not None else self.memory.config.workspace.resolve()
        for base in (workspace, self.memory.config.root):
            try:
                candidate = (base / path).resolve()
            except (OSError, ValueError, RuntimeError):
                return True
            if candidate.is_relative_to(workspace):
                paths.add(candidate.relative_to(workspace).as_posix())
        parts = [part for candidate in paths for part in re.split(r'[/\\]', candidate)]
        records = self._snapshot['records'] if self._snapshot is not None else self.records()
        if any(paths.intersection(r.get('pendingPaths', [])) for r in records.values()):
            return True
        if any(part == id or part.startswith(id + '.') for id in records for part in parts):
            return True
        return any(self.db.get('memory/hidden/' + candidate)['value'] for candidate in paths)

    def sanitize(self, value, client='', omit=False):
        """Filter mixed lists and streams at delivery time, including queued events."""
        if self._snapshot is not None:
            return self._filter(value, client, omit)
        # Large payloads (the library lists thousands of files) must not re-read the
        # privacy records and re-resolve the workspace for every single entry.
        self._snapshot = {'records': self.records(), 'workspace': self.memory.config.workspace.resolve()}
        try:
            return self._filter(value, client, omit)
        finally:
            self._snapshot = None

    def _filter(self, value, client, omit):
        if isinstance(value, list):
            return [v for item in value if (v := self._filter(item, client, omit)) is not None]
        if not isinstance(value, dict):
            return value
        id = value.get('threadId') or value.get('chatId') or value.get('chat_id') or value.get('thread_id')
        if not id and isinstance(value.get('thread'), dict):
            id = value['thread'].get('id')
        if not id and isinstance(value.get('params'), dict):
            p = value['params']
            id = p.get('threadId') or p.get('thread', {}).get('id')
        if not id:
            id = self.related(value.get('id', ''))
        id = self.related(id)
        if id and self.record(id):
            if omit:
                return None
            if not self.allowed(id, client):
                if 'title' in value and 'method' not in value:
                    return {**{k: value[k] for k in ('id', 'projectId', 'archived', 'pinned', 'updatedAt') if k in value},
                            'title': 'Privater Chat', 'private': True, 'locked': True}
                return None
            value = {**value, 'private': True, 'locked': False}
        if self.path_private(value.get('path')):
            return None
        result = {}
        for key, item in value.items():
            if key == 'active' and isinstance(item, dict):
                result[key] = {k: v for k, v in item.items() if self.allowed(k, client)}
            else:
                result[key] = self._filter(item, client, omit)
        return result

    async def stream(self, frames, client):
        async for frame in frames:
            lines = frame.splitlines()
            result = []
            for line in lines:
                if line.startswith('data:'):
                    value = json.loads(line[5:])
                    if value.get('method') == 'core/event':
                        p = value.get('params', {})
                        if p.get('kind') == 'chat.privacy':
                            value = {'method': 'chat/privacy', 'params': {'id': p['entity_id']}}
                        elif self.record(self.related(p.get('entity_id', ''))):
                            continue
                    if value.get('method') != 'chat/privacy':
                        value = self.sanitize(value, client)
                    if value is None:
                        continue
                    line = 'data: ' + json.dumps(value)
                result.append(line)
            yield '\n'.join(result) + '\n\n'
