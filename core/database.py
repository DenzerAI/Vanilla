from __future__ import annotations

import json
import sqlite3
import threading
import fcntl
from contextlib import contextmanager, closing
from pathlib import Path
from time import time


SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY, applied_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS records(key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)), updated_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chats(id TEXT PRIMARY KEY, project_id TEXT, title TEXT, worker_id TEXT, archived INTEGER NOT NULL DEFAULT 0, updated_at REAL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS chats_project ON chats(project_id, updated_at);
CREATE TABLE IF NOT EXISTS messages(chat_id TEXT NOT NULL, turn_id TEXT NOT NULL, item_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(chat_id,turn_id,item_id));
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, name TEXT NOT NULL, worker TEXT NOT NULL, status TEXT NOT NULL, manifest TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS job_notifications(id TEXT PRIMARY KEY, job_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, created_at REAL NOT NULL, read_at REAL, target TEXT NOT NULL, delivery TEXT NOT NULL, delivery_error TEXT);
CREATE INDEX IF NOT EXISTS job_notifications_unread ON job_notifications(read_at,created_at);
CREATE TABLE IF NOT EXISTS executions(id TEXT PRIMARY KEY, job_id TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('queued','dispatching','running','completed','failed','interrupted','cancelled')), slot TEXT UNIQUE, created_at REAL NOT NULL, started_at REAL, finished_at REAL, adapter_run_id TEXT, thread_id TEXT, error TEXT, result TEXT);
CREATE INDEX IF NOT EXISTS executions_status ON executions(status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS execution_one_active_job ON executions(job_id) WHERE status IN ('queued','dispatching','running');
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, entity_id TEXT, payload TEXT NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, digest TEXT NOT NULL, updated_at REAL NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(path UNINDEXED,title,content, tokenize='unicode61 remove_diacritics 2');
CREATE VIRTUAL TABLE IF NOT EXISTS document_vocab USING fts5vocab(document_fts,'row');
CREATE TABLE IF NOT EXISTS links(source TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, target TEXT NOT NULL, label TEXT NOT NULL, PRIMARY KEY(source,target,label));
CREATE INDEX IF NOT EXISTS links_target ON links(target);
CREATE TABLE IF NOT EXISTS vectors(path TEXT NOT NULL REFERENCES documents(path) ON DELETE CASCADE, chunk INTEGER NOT NULL, model TEXT NOT NULL, digest TEXT NOT NULL, text TEXT NOT NULL, vector TEXT NOT NULL, PRIMARY KEY(path,chunk,model));
CREATE TABLE IF NOT EXISTS context_routes(id TEXT PRIMARY KEY, chat_id TEXT, query TEXT NOT NULL, project_id TEXT NOT NULL, sources TEXT NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS memory_sources(id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, turn_id TEXT NOT NULL, project_id TEXT NOT NULL, digest TEXT NOT NULL, path TEXT NOT NULL, excerpt TEXT NOT NULL, created_at REAL NOT NULL, forgotten INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS memory_project ON memory_sources(project_id,created_at);
CREATE TABLE IF NOT EXISTS memory_changes(id TEXT PRIMARY KEY, path TEXT NOT NULL, before_version TEXT, after_version TEXT NOT NULL, kind TEXT NOT NULL, created_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS maintenance(name TEXT PRIMARY KEY, status TEXT NOT NULL, checked_at REAL NOT NULL, details TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('owner','developer','member')), salt TEXT NOT NULL, hash TEXT NOT NULL, created_at REAL NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);
"""


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


class Database:
    def __init__(self, file: Path):
        file.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.file = file
        self.owner = open(str(file) + ".lock", "a+")
        try:
            fcntl.flock(self.owner, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.owner.close()
            raise RuntimeError(
                "Dieser SQLite-Arbeitsbereich wird bereits von einem anderen Python-Kern verwendet."
            )
        self.lock = threading.RLock()
        self.connection = sqlite3.connect(
            file, check_same_thread=False, isolation_level=None, timeout=10
        )
        file.chmod(0o600)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA foreign_keys=ON")
        self.connection.execute("PRAGMA busy_timeout=10000")
        self.connection.executescript(SCHEMA)
        self.connection.execute(
            "INSERT OR IGNORE INTO schema_versions VALUES(1,?)", (time(),)
        )
        columns = {r["name"] for r in self.connection.execute("PRAGMA table_info(executions)")}
        for name, definition in {"job_snapshot": "TEXT", "lease_until": "REAL", "attempt": "INTEGER NOT NULL DEFAULT 1", "parent_id": "TEXT", "progress": "TEXT", "not_before": "REAL NOT NULL DEFAULT 0"}.items():
            if name not in columns:
                self.connection.execute(f"ALTER TABLE executions ADD COLUMN {name} {definition}")
        self.connection.execute("INSERT OR IGNORE INTO schema_versions VALUES(2,?)", (time(),))
        # Version 3: Benutzerkonten, Sitzungen je Benutzer, Chats mit Besitzer.
        for table, name, definition in (("sessions", "user_id", "TEXT"), ("chats", "owner_id", "TEXT")):
            if name not in {r["name"] for r in self.connection.execute(f"PRAGMA table_info({table})")}:
                self.connection.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
        self.connection.execute("CREATE INDEX IF NOT EXISTS chats_owner ON chats(owner_id)")
        self.connection.execute("INSERT OR IGNORE INTO schema_versions VALUES(3,?)", (time(),))
        # Version 4: Rolle Entwickler. SQLite kann CHECK nicht ändern, also Tabelle neu aufbauen.
        definition = self.connection.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").fetchone()
        if definition and "'developer'" not in definition["sql"]:
            self.connection.executescript(
                "BEGIN; ALTER TABLE users RENAME TO users_v3;"
                "CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL CHECK(role IN ('owner','developer','member')), salt TEXT NOT NULL, hash TEXT NOT NULL, created_at REAL NOT NULL, disabled INTEGER NOT NULL DEFAULT 0);"
                "INSERT INTO users SELECT id,name,role,salt,hash,created_at,disabled FROM users_v3; DROP TABLE users_v3; COMMIT;"
            )
        self.connection.execute("INSERT OR IGNORE INTO schema_versions VALUES(4,?)", (time(),))

    @contextmanager
    def transaction(self):
        with self.lock:
            self.connection.execute("BEGIN IMMEDIATE")
            try:
                yield self.connection
                self.connection.execute("COMMIT")
            except BaseException:
                self.connection.execute("ROLLBACK")
                raise

    def rows(self, sql, parameters=()):
        with self.lock:
            return [dict(row) for row in self.connection.execute(sql, parameters)]

    def get(self, key):
        rows = self.rows("SELECT value FROM records WHERE key=?", (key,))
        return {
            "found": bool(rows),
            "value": json.loads(rows[0]["value"]) if rows else None,
        }

    def put(self, key, value, *, only_if_missing=False):
        with self.transaction() as cx:
            if key == 'control/state.json':
                old = cx.execute('SELECT value FROM records WHERE key=?', (key,)).fetchone()
                protected = [s for s in json.loads(old['value']).get('secrets',[]) if s.get('system')] if old else []
                if protected:
                    value = {**value, 'secrets': [s for s in value.get('secrets',[]) if s['id'] not in {p['id'] for p in protected}] + protected}
            if (
                only_if_missing
                and cx.execute("SELECT 1 FROM records WHERE key=?", (key,)).fetchone()
            ):
                return self.get(key)["value"]
            cx.execute(
                "INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
                (key, dump(value), time()),
            )
            self.normalize(cx, key, value)
        return value

    def normalize(self, cx, key, value):
        if key == "control/state.json":
            cx.execute("DELETE FROM chats")
            cx.execute("DELETE FROM projects")
            for p in value.get("projects", []):
                cx.execute(
                    "INSERT INTO projects VALUES(?,?,?,?)",
                    (p["id"], p["name"], p.get("path", ""), dump(p)),
                )
            for c in value.get("chats", []):
                cx.execute(
                    "INSERT INTO chats(id,project_id,title,worker_id,archived,updated_at,data,owner_id) VALUES(?,?,?,?,?,?,?,?)",
                    (
                        c["id"],
                        c.get("projectId", "default"),
                        c.get("title", ""),
                        c.get("workerId", "codex"),
                        int(bool(c.get("archived"))),
                        c.get("updatedAt", 0),
                        dump(c),
                        c.get("ownerId") or None,
                    ),
                )
        if key.startswith("workspace/chats/") and key.endswith("/transcript.json"):
            chat_id = value["id"]
            cx.execute("DELETE FROM messages WHERE chat_id=?", (chat_id,))
            for turn in value.get("turns", []):
                for number, item in enumerate(turn.get("items", [])):
                    if item.get("type") not in {"userMessage", "agentMessage", "plan"}:
                        continue
                    text = item.get("text") or "\n".join(
                        c.get("text", "")
                        for c in item.get("content", [])
                        if isinstance(c, dict)
                    )
                    cx.execute(
                        "INSERT OR REPLACE INTO messages VALUES(?,?,?,?,?,?)",
                        (
                            chat_id,
                            turn["id"],
                            item.get("id", str(number)),
                            item["type"],
                            text,
                            dump(item),
                        ),
                    )

    def event(self, kind, entity_id, payload):
        with self.transaction() as cx:
            cx.execute(
                "INSERT INTO events(kind,entity_id,payload,created_at) VALUES(?,?,?,?)",
                (kind, entity_id, dump(payload), time()),
            )

    def backup(self, destination: Path):
        with self.lock, closing(sqlite3.connect(destination)) as target:
            self.connection.backup(target)
        destination.chmod(0o600)

    def close(self):
        with self.lock:
            self.connection.close()
            self.owner.close()
