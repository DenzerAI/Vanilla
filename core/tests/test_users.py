"""Benutzerkonten: Anmeldung, Rollen, Chat-Besitz, Ereignisfilter."""
import json

import pytest
from fastapi.testclient import TestClient

from core.app import create_app
from core.config import Config


@pytest.fixture
def config(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    workspace = root / "workspace"
    workspace.mkdir()
    return Config(root=root, workspace=workspace, data=root / "data", start_adapter=False)


def login(client, **body):
    return client.post("/api/auth/login", json=body)


def csrf(client):
    return {"x-uwe-token": client.get("/api/auth/session").json()["token"]}


def state(client, config, chats):
    # Der Adapter schreibt die Chatliste als Record; der Kern normalisiert sie in die chats-Tabelle.
    return client.post("/internal/storage", headers={"x-agent-internal": config.adapter_token}, json={"key": "control/state.json", "value": {"chats": chats, "projects": []}})


def make(config):
    config.access_token = "a" * 40
    app = create_app(config)
    return app


def test_owner_creates_members_and_login_by_name(config):
    app = make(config)
    with TestClient(app) as client:
        assert login(client, token=config.access_token).status_code == 200
        session = client.get("/api/auth/session").json()
        assert session["user"]["role"] == "owner" and session["accounts"] is False
        headers = csrf(client)
        assert client.post("/api/users", headers=headers, json={"name": "C", "password": "geheim123"}).status_code == 400
        assert client.post("/api/users", headers=headers, json={"name": "Christian", "password": "kurz"}).status_code == 400
        owner = client.post("/api/users", headers=headers, json={"name": "Christian", "password": "geheim123", "role": "owner"}).json()
        member = client.post("/api/users", headers=headers, json={"name": "Lena", "password": "lena-geheim"}).json()
        assert client.post("/api/users", headers=headers, json={"name": "lena", "password": "lena-geheim"}).status_code == 409
        assert [u["name"] for u in client.get("/api/users").json()["users"]] == ["Christian", "Lena"]
        client.post("/api/auth/logout", headers=headers)
        assert client.get("/api/core/status").status_code == 401
        assert login(client, name="Lena", password="falsch").status_code == 401
        response = login(client, name="lena", password="lena-geheim")
        assert response.status_code == 200 and response.json()["user"]["id"] == member["id"]
        me = client.get("/api/auth/session").json()["user"]
        assert me["name"] == "Lena" and me["role"] == "member"
        # Mitglieder verwalten keine Konten, ändern aber ihr eigenes Passwort.
        headers = csrf(client)
        assert client.post("/api/users", headers=headers, json={"name": "X", "password": "xxxxxxxx"}).status_code == 403
        assert client.post(f"/api/users/{owner['id']}/password", headers=headers, json={"password": "neu-neu-neu"}).status_code == 403
        assert client.post(f"/api/users/{member['id']}/password", headers=headers, json={"current": "falsch", "password": "neu-neu-neu"}).status_code == 403
        assert client.post(f"/api/users/{member['id']}/password", headers=headers, json={"current": "lena-geheim", "password": "neu-neu-neu"}).status_code == 200
        # Passwortwechsel beendet die Sitzung.
        assert client.get("/api/core/status").status_code == 401
        assert login(client, name="Lena", password="neu-neu-neu").status_code == 200


def test_last_owner_and_self_removal_are_protected(config):
    app = make(config)
    with TestClient(app) as client:
        login(client, token=config.access_token)
        headers = csrf(client)
        owner = client.post("/api/users", headers=headers, json={"name": "Christian", "password": "geheim123", "role": "owner"}).json()
        assert client.post(f"/api/users/{owner['id']}/role", headers=headers, json={"role": "member"}).status_code == 409
        assert client.post(f"/api/users/{owner['id']}/remove", headers=headers).status_code == 409
        client.post("/api/auth/logout", headers=headers)
        login(client, name="Christian", password="geheim123")
        headers = csrf(client)
        assert client.post(f"/api/users/{owner['id']}/remove", headers=headers).status_code == 409
        second = client.post("/api/users", headers=headers, json={"name": "Katharina", "password": "geheim123", "role": "owner"}).json()
        assert client.post(f"/api/users/{owner['id']}/role", headers=headers, json={"role": "member"}).status_code == 200
        assert client.post(f"/api/users/{second['id']}/remove", headers=headers).status_code == 403


def test_members_only_see_their_own_chats(config):
    app = make(config)
    with TestClient(app) as client:
        login(client, token=config.access_token)
        headers = csrf(client)
        member = client.post("/api/users", headers=headers, json={"name": "Lena", "password": "lena-geheim"}).json()
        client.post("/api/auth/logout", headers=headers)
        login(client, name="Lena", password="lena-geheim")
        assert state(client, config, [
            {"id": "mine", "title": "Meiner", "ownerId": member["id"], "updatedAt": 2},
            {"id": "shared", "title": "Installation", "updatedAt": 1},
            {"id": "other", "title": "Fremd", "ownerId": "someone", "updatedAt": 3},
        ]).status_code == 200
        assert client.get("/api/chat/privacy/status?id=mine").status_code == 200
        assert client.get("/api/chat/privacy/status?id=shared").status_code == 403
        assert client.get("/api/chat/privacy/status?id=other").status_code == 403
        assert client.get("/api/chat/privacy/status?id=unknown").status_code == 200
        headers = csrf(client)
        client.post("/api/auth/logout", headers=headers)
        login(client, token=config.access_token)
        for id in ("mine", "shared", "other"):
            assert client.get(f"/api/chat/privacy/status?id={id}").status_code == 200


def test_removed_member_loses_session_and_legacy_code_keeps_working(config):
    app = make(config)
    with TestClient(app) as client:
        login(client, token=config.access_token)
        headers = csrf(client)
        member = client.post("/api/users", headers=headers, json={"name": "Lena", "password": "lena-geheim"}).json()
        other = TestClient(app)
        assert login(other, name="Lena", password="lena-geheim").status_code == 200
        assert other.get("/api/core/status").status_code == 200
        assert client.post(f"/api/users/{member['id']}/remove", headers=headers).status_code == 200
        assert other.get("/api/core/status").status_code == 401
        assert client.get("/api/auth/session").json()["user"]["role"] == "owner"


def test_event_stream_hides_foreign_chats_for_members():
    import asyncio
    from core.users import Users, chat_id_of

    class DB:
        def rows(self, sql, params=()):
            return [{"owner_id": {"mine": "u1", "other": "u2"}.get(params[0])}] if params and params[0] in ("mine", "other") else []

    users = Users(DB())
    member = {"id": "u1", "name": "Lena", "role": "member"}

    async def frames():
        for value in ({"method": "thread/update", "params": {"threadId": "mine"}}, {"method": "thread/update", "params": {"threadId": "other"}}, {"method": "wrapper/state", "active": {"mine": 1, "other": 1}}):
            yield "id: 1\ndata:" + json.dumps(value) + "\n\n"

    async def collect(user):
        return [f async for f in users.stream(frames(), user)]

    kept = asyncio.run(collect(member))
    assert len(kept) == 2 and "other" not in kept[1] and "mine" in kept[1]
    assert len(asyncio.run(collect({"id": "x", "role": "owner"}))) == 3
    assert chat_id_of({"params": {"kind": "chat.title", "entity_id": "abc"}}) == "abc"


def test_member_cannot_read_foreign_chat_files_or_create_accounts_without_code(config):
    app = make(config)
    with TestClient(app) as client:
        login(client, token=config.access_token)
        headers = csrf(client)
        member = client.post("/api/users", headers=headers, json={"name": "Lena", "password": "lena-geheim"}).json()
        state(client, config, [{"id": "mine", "ownerId": member["id"]}, {"id": "other", "ownerId": "x"}])
        client.post("/api/auth/logout", headers=headers)
        login(client, name="Lena", password="lena-geheim")
        assert client.get("/api/file/text?path=chats/other/transcript.json").status_code == 403
        assert client.get("/api/file/raw?path=workspace/chats/other.md").status_code == 403
        assert client.get("/api/files?path=chats/other").status_code == 403
        # Eigene und chatfremde Pfade gehen an den Adapter (hier nicht gestartet → 503, nicht 403).
        assert client.get("/api/file/text?path=chats/mine/transcript.json").status_code == 503
        assert client.get("/api/file/text?path=notes/a.md").status_code == 503


def test_first_account_requires_access_code(config):
    app = create_app(config)
    with TestClient(app) as client:
        headers = csrf(client)
        response = client.post("/api/users", headers=headers, json={"name": "Christian", "password": "geheim123", "role": "owner"})
        assert response.status_code == 409 and "Zugangsschlüssel" in response.json()["error"]


def test_nested_request_events_and_paths_are_recognized():
    from core.users import chat_id_of, path_chat_id
    assert chat_id_of({"method": "wrapper/request", "params": {"id": 7, "params": {"threadId": "t1", "turnId": "u"}}}) == "t1"
    assert chat_id_of({"method": "chat/privacy", "params": {"id": "t2"}}) == "t2"
    assert chat_id_of({"method": "core/event", "params": {"kind": "chat.title", "entity_id": "t3"}}) == "t3"
    assert path_chat_id("chats/abc/transcript.json") == "abc"
    assert path_chat_id("workspace/chats/abc.md") == "abc"
    assert path_chat_id("notes/chats.md") is None
    assert path_chat_id("chats") is None
