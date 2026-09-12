"""Benutzerkonten je Installation: Eigentümer und Mitglieder, Chats mit Besitzer.

Eigentümer verwalten Konten und sehen alle Chats. Mitglieder sehen nur ihre eigenen.
Private Chats schützt weiterhin die Chat-PIN; Benutzer sind keine Sandbox.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
from time import time

from fastapi import APIRouter, HTTPException, Request

ROLES = ("owner", "member")
CODE_USER = {"id": "owner", "name": "Zugangscode", "role": "owner"}
NAME = re.compile(r"[^\s]{1}[^\r\n\t]{0,58}[^\s]{1}|[^\s]{2}")


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32).hex()


def public(row):
    return {"id": row["id"], "name": row["name"], "role": row["role"], "createdAt": row["created_at"], "disabled": bool(row["disabled"])}


class Users:
    def __init__(self, db):
        self.db = db

    def count(self):
        return self.db.rows("SELECT COUNT(*) AS n FROM users WHERE disabled=0")[0]["n"]

    def list(self):
        return [public(r) for r in self.db.rows("SELECT * FROM users ORDER BY created_at")]

    def get(self, id):
        rows = self.db.rows("SELECT * FROM users WHERE id=? AND disabled=0", (id,))
        return public(rows[0]) if rows else None

    def owners(self):
        return self.db.rows("SELECT id FROM users WHERE role='owner' AND disabled=0")

    def validate(self, name=None, password=None, role=None):
        if name is not None and (not isinstance(name, str) or not NAME.fullmatch(name.strip())):
            raise HTTPException(400, "Bitte einen Namen mit 2 bis 60 Zeichen eingeben.")
        if password is not None and (not isinstance(password, str) or len(password) < 8 or len(password) > 200):
            raise HTTPException(400, "Das Passwort braucht mindestens 8 Zeichen.")
        if role is not None and role not in ROLES:
            raise HTTPException(400, "Unbekannte Rolle.")

    def create(self, name, password, role="member"):
        self.validate(name, password, role)
        name = name.strip()
        if self.db.rows("SELECT 1 FROM users WHERE name=? COLLATE NOCASE", (name,)):
            raise HTTPException(409, "Diesen Namen gibt es schon.")
        salt = secrets.token_hex(16)
        row = {"id": secrets.token_hex(8), "name": name, "role": role, "salt": salt, "hash": password_hash(password, salt), "created_at": time(), "disabled": 0}
        with self.db.transaction() as cx:
            cx.execute("INSERT INTO users(id,name,role,salt,hash,created_at,disabled) VALUES(?,?,?,?,?,?,?)", tuple(row.values()))
        return public(row)

    def verify(self, name, password):
        if not isinstance(name, str) or not isinstance(password, str):
            return None
        rows = self.db.rows("SELECT * FROM users WHERE name=? COLLATE NOCASE AND disabled=0", (name.strip(),))
        # Gleiche Rechenzeit, ob der Name existiert oder nicht.
        row = rows[0] if rows else {"salt": "00" * 16, "hash": "00" * 32}
        ok = hmac.compare_digest(row["hash"], password_hash(password, row["salt"]))
        return public(row) if rows and ok else None

    def set_password(self, id, password):
        self.validate(password=password)
        salt = secrets.token_hex(16)
        with self.db.transaction() as cx:
            if not cx.execute("UPDATE users SET salt=?,hash=? WHERE id=?", (salt, password_hash(password, salt), id)).rowcount:
                raise HTTPException(404, "Benutzer nicht gefunden.")
            cx.execute("DELETE FROM sessions WHERE user_id=?", (id,))
        return {"ok": True}

    def set_role(self, id, role):
        self.validate(role=role)
        if role == "member" and [o["id"] for o in self.owners()] == [id]:
            raise HTTPException(409, "Mindestens ein Eigentümer muss bleiben.")
        with self.db.transaction() as cx:
            if not cx.execute("UPDATE users SET role=? WHERE id=?", (role, id)).rowcount:
                raise HTTPException(404, "Benutzer nicht gefunden.")
        return self.get(id)

    def remove(self, id):
        if [o["id"] for o in self.owners()] == [id]:
            raise HTTPException(409, "Der letzte Eigentümer kann nicht entfernt werden.")
        with self.db.transaction() as cx:
            if not cx.execute("DELETE FROM users WHERE id=?", (id,)).rowcount:
                raise HTTPException(404, "Benutzer nicht gefunden.")
            cx.execute("DELETE FROM sessions WHERE user_id=?", (id,))
        return {"ok": True}

    # Chat-Besitz. Chats ohne Besitzer gehören der Installation, also den Eigentümern.

    def chat_owner(self, chat_id):
        rows = self.db.rows("SELECT owner_id FROM chats WHERE id=?", (chat_id,))
        return rows[0]["owner_id"] if rows else None

    def allowed(self, user, chat_id):
        if not user or user["role"] == "owner" or not isinstance(chat_id, str):
            return True
        rows = self.db.rows("SELECT owner_id FROM chats WHERE id=?", (chat_id,))
        return not rows or rows[0]["owner_id"] == user["id"]

    def require(self, user, chat_id):
        if not self.allowed(user, chat_id):
            raise HTTPException(403, "Dieser Chat gehört einem anderen Benutzer.")

    def require_path(self, user, path):
        """Dateiwege wie chats/<id>/transcript.json unterliegen demselben Besitz.

        Für Dateien gilt fail-closed: ein Chat, den die Liste nicht kennt, gehört keinem Mitglied.
        """
        chat_id = path_chat_id(path)
        if chat_id and user and user["role"] != "owner" and self.chat_owner(chat_id) != user["id"]:
            raise HTTPException(403, "Dieser Chat gehört einem anderen Benutzer.")

    async def stream(self, frames, user):
        """Mitglieder bekommen keine Ereignisse fremder Chats."""
        if not user or user["role"] == "owner":
            async for frame in frames:
                yield frame
            return
        async for frame in frames:
            keep = []
            for line in frame.splitlines():
                if line.startswith("data:"):
                    try:
                        value = json.loads(line[5:])
                    except ValueError:
                        keep.append(line)
                        continue
                    if not self.allowed(user, chat_id_of(value)):
                        continue
                    # Aktive Chats fremder Benutzer bleiben unsichtbar.
                    if isinstance(value, dict) and isinstance(value.get("active"), dict):
                        value = {**value, "active": {k: v for k, v in value["active"].items() if self.allowed(user, k)}}
                        line = "data:" + json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                keep.append(line)
            if any(l.startswith("data:") for l in keep) or not any(l.startswith("data:") for l in frame.splitlines()):
                yield "\n".join(keep) + ("\n\n" if frame.endswith("\n\n") else "\n" if frame.endswith("\n") else "")


def path_chat_id(path):
    if not isinstance(path, str):
        return None
    parts = [part for part in re.split(r"[/\\]", path) if part]
    for index, part in enumerate(parts[:-1]):
        if part == "chats":
            return parts[index + 1].split(".")[0]
    return None


def chat_id_of(value, depth=0):
    if not isinstance(value, dict) or depth > 2:
        return None
    id = value.get("threadId") or value.get("chatId") or value.get("chat_id") or value.get("thread_id")
    if not id and isinstance(value.get("thread"), dict):
        id = value["thread"].get("id")
    if not id and isinstance(value.get("params"), dict):
        p = value["params"]
        id = p.get("entity_id") if str(p.get("kind", "")).startswith("chat") else None
        if not id and value.get("method") == "chat/privacy":
            id = p.get("id")
        # Rückfragen tragen ihre Thread-ID eine Ebene tiefer (wrapper/request → params.params.threadId).
        id = id or chat_id_of(p, depth + 1)
    return id if isinstance(id, str) else None


def routes(users, code_configured=lambda: True, set_access=None):
    router = APIRouter()

    def me(request):
        return getattr(request.state, "user", None) or CODE_USER

    def owner_only(request):
        if me(request)["role"] != "owner":
            raise HTTPException(403, "Nur Eigentümer verwalten Benutzer.")

    @router.get("/api/users")
    async def list_users(request: Request):
        user = me(request)
        return {"users": users.list() if user["role"] == "owner" else [u for u in users.list() if u["id"] == user["id"]], "me": user, "accessConfigured": bool(code_configured())}

    @router.post("/api/users")
    async def create_user(request: Request):
        owner_only(request)
        body = await request.json()
        if not code_configured():
            # Ohne Zugangsschlüssel gäbe es keinen Rückweg, wenn der letzte Eigentümer sein Passwort verliert.
            key = body.get("accessKey")
            if not isinstance(key, str) or len(key) < 8:
                raise HTTPException(409, "Für das erste Konto braucht die Installation einen Rückweg-Schlüssel mit mindestens 8 Zeichen.")
            if body.get("role", "member") != "owner":
                raise HTTPException(409, "Das erste Konto muss ein Eigentümer sein.")
            users.validate(body.get("name"), body.get("password"), "owner")
            if set_access is None:
                raise HTTPException(503, "Zugangsschlüssel können hier nicht gesetzt werden.")
            import asyncio
            await asyncio.to_thread(set_access, key)
        return users.create(body.get("name"), body.get("password"), body.get("role", "member"))

    @router.post("/api/users/{id}/password")
    async def change_password(id: str, request: Request):
        user = me(request)
        if user["role"] != "owner" and user["id"] != id:
            raise HTTPException(403, "Nur das eigene Passwort kann geändert werden.")
        body = await request.json()
        if user["id"] == id and user["role"] != "owner" and not users.verify(user["name"], str(body.get("current", ""))):
            raise HTTPException(403, "Das aktuelle Passwort stimmt nicht.")
        return users.set_password(id, body.get("password"))

    @router.post("/api/users/{id}/role")
    async def change_role(id: str, request: Request):
        owner_only(request)
        body = await request.json()
        return users.set_role(id, body.get("role"))

    @router.post("/api/users/{id}/remove")
    async def remove_user(id: str, request: Request):
        owner_only(request)
        if me(request)["id"] == id:
            raise HTTPException(409, "Du kannst dich nicht selbst entfernen.")
        return users.remove(id)

    return router
