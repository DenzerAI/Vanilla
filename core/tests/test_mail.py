import asyncio
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from core.config import Config
from core.database import Database
from core.mail import (
    Mail,
    Setup,
    Start,
    Admin,
    Draft,
    Send,
    ThreadAction,
    ProviderError,
    identifier,
    b64,
)


@pytest.fixture
def mail(tmp_path):
    config = Config(root=tmp_path, start_adapter=False)
    db = Database(config.data / "agent.sqlite3")
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(500))
    )
    service = Mail(db, config, client)
    yield service
    db.close()


def message(external="m1", text="Hallo"):
    return {
        "external": external,
        "thread": "t1",
        "subject": "Frage",
        "sender": "sender@example.test",
        "replyTo": "sender@example.test",
        "to": "inbox@example.test",
        "messageId": "<m1@example.test>",
        "time": "2026-09-08T10:00:00+00:00",
        "text": text,
        "outgoing": False,
        "attachments": [],
    }


async def account(mail, provider="gmail", project="default"):
    return (
        await mail.connect(
            project,
            provider,
            "inbox@example.test",
            "oauth",
            {
                "clientId": "synthetic-client",
                "clientSecret": "synthetic-secret",
                "access_token": "synthetic-token",
                "refresh_token": "synthetic-refresh",
                "expires": 9999999999,
            },
        )
    )["id"]


def install_transport(mail, fn):
    mail.client = httpx.AsyncClient(transport=httpx.MockTransport(fn))


def test_clean_install_and_encrypted_vault(mail):
    assert mail.accounts("default") == []
    assert all(not p["ready"] for p in mail.setup_status()["providers"])
    assert not (mail.config.data / "provider-vault/provider.key").exists()
    mail.setup(
        Setup(
            provider="gmail",
            clientId="synthetic-client",
            clientSecret="synthetic-secret",
        )
    )
    raw = mail.db.get("provider-vault/mail-app-gmail")["value"]
    assert "synthetic" not in raw
    assert (
        json.loads(mail.vault.read("mail-app-gmail"))["clientSecret"]
        == "synthetic-secret"
    )
    assert (
        mail.config.data / "provider-vault/provider.key"
    ).stat().st_mode & 0o777 == 0o600


def test_missing_key_does_not_create_replacement(mail):
    mail.vault.save("test", "synthetic")
    (mail.config.data / "provider-vault/provider.key").unlink()
    with pytest.raises(ValueError, match="Tresorschlüssel"):
        mail.vault.read("test")
    assert not (mail.config.data / "provider-vault/provider.key").exists()


@pytest.mark.asyncio
async def test_oauth_pkce_callback_single_use_session_bound(mail):
    mail.setup(
        Setup(
            provider="gmail",
            clientId="synthetic-client",
            clientSecret="synthetic-secret",
        )
    )
    flow = mail.start(Start(provider="gmail"), "session-one")
    q = parse_qs(urlsplit(flow["url"]).query)
    assert q["code_challenge_method"] == ["S256"]
    assert q["access_type"] == ["offline"]
    with pytest.raises(ValueError):
        mail.poll(flow["poll"], "session-two")
    calls = []

    def respond(r):
        calls.append(r)
        if "/token" in str(r.url):
            return httpx.Response(
                200,
                json={
                    "access_token": "token",
                    "refresh_token": "refresh",
                    "expires_in": 3600,
                },
            )
        return httpx.Response(200, json={"emailAddress": "inbox@example.test"})

    install_transport(mail, respond)
    assert await mail.callback_finish("gmail", q["state"][0], "synthetic-code", "")
    assert "code_verifier=" in calls[0].content.decode()
    assert mail.poll(flow["poll"], "session-one")["status"] == "connected"
    with pytest.raises(ValueError):
        await mail.callback_finish("gmail", q["state"][0], "synthetic-code", "")
    assert len(calls) == 2
    assert len(mail.accounts("default")) == 1


@pytest.mark.asyncio
async def test_denied_oauth_creates_no_account(mail):
    mail.setup(
        Setup(
            provider="gmail",
            clientId="synthetic-client",
            clientSecret="synthetic-secret",
        )
    )
    flow = mail.start(Start(provider="gmail"), "session")
    state = parse_qs(urlsplit(flow["url"]).query)["state"][0]
    assert not await mail.callback_finish("gmail", state, "", "access_denied")
    assert mail.accounts("default") == []


@pytest.mark.asyncio
async def test_mailbox_and_project_isolation_duplicate_ingestion(mail):
    id = await account(mail)
    a = mail.account(id, "default")
    mail.ingest(a, [message()], {})
    tid = identifier(id, "t1")
    mail.mark(ThreadAction(id=tid, revision=1))
    mail.ingest(a, [message()], {})
    assert mail.detail(tid, "default")["thread"]["revision"] == 1
    assert mail.detail(tid, "default")["thread"]["seen"] == 1
    mail.mark(ThreadAction(id=tid, done=True))
    mail.ingest(a, [message("m2")], {})
    mail.mark(ThreadAction(id=tid, revision=1))
    t = mail.detail(tid, "default")["thread"]
    assert t["revision"] == 2 and t["seen"] == 1 and not t["done"]
    with pytest.raises(ValueError):
        mail.detail(tid, "another-project")
    id2 = (await mail.connect("default", "gmail", "second@example.test", "oauth", {}))[
        "id"
    ]
    mail.ingest(mail.account(id2, "default"), [message()], {})
    assert len(mail.threads("default")["conversations"]) == 2


@pytest.mark.asyncio
async def test_draft_conflict_and_new_message_prevent_send(mail):
    id = await account(mail)
    a = mail.account(id, "default")
    mail.ingest(a, [message()], {})
    tid = identifier(id, "t1")
    mail.draft(Draft(id=tid, revision=1, version=0, text="Antwort"))
    with pytest.raises(FileExistsError):
        mail.draft(Draft(id=tid, revision=1, version=0, text="Überschreiben"))
    mail.ingest(a, [message("m2")], {})
    with pytest.raises(FileExistsError, match="Neue Nachrichten"):
        await mail.send(Send(id=tid, version=1))
    assert not mail.db.rows("SELECT * FROM mail_sends")


@pytest.mark.asyncio
async def test_send_is_single_and_threaded(mail):
    id = await account(mail)
    mail.ingest(mail.account(id, "default"), [message()], {})
    tid = identifier(id, "t1")
    mail.draft(Draft(id=tid, revision=1, version=0, text="Antwort"))
    requests = []

    def respond(r):
        requests.append(r)
        return httpx.Response(200, json={"id": "sent"})

    install_transport(mail, respond)
    assert (await mail.send(Send(id=tid, version=1)))["state"] == "accepted"
    assert json.loads(requests[0].content)["threadId"] == "t1"
    with pytest.raises(FileExistsError):
        await mail.send(Send(id=tid, version=1))
    assert len(requests) == 1
    assert mail.detail(tid, "default")["draft"]["text"] == ""


@pytest.mark.asyncio
async def test_ambiguous_send_never_retries(mail):
    id = await account(mail)
    mail.ingest(mail.account(id, "default"), [message()], {})
    tid = identifier(id, "t1")
    mail.draft(Draft(id=tid, revision=1, version=0, text="Antwort"))
    requests = []

    def respond(r):
        requests.append(r)
        raise httpx.ReadTimeout("synthetic-timeout")

    install_transport(mail, respond)
    assert (await mail.send(Send(id=tid, version=1)))["state"] == "unknown"
    mail.draft(Draft(id=tid, revision=1, version=1, text="Antwort erneut"))
    with pytest.raises(ValueError, match="ungeklärt"):
        await mail.send(Send(id=tid, version=2))
    assert len(requests) == 1


@pytest.mark.asyncio
async def test_recovery_marks_inflight_send_unknown(mail):
    with mail.db.transaction() as cx:
        cx.execute("INSERT INTO mail_sends VALUES('s','t',1,'sending','')")
    second = Mail(mail.db, mail.config, mail.client)
    assert mail.db.rows("SELECT state FROM mail_sends")[0]["state"] == "unknown"


@pytest.mark.asyncio
async def test_disconnect_stops_access_retains_projection(mail):
    id = await account(mail)
    mail.ingest(mail.account(id, "default"), [message()], {})
    await mail.disconnect(id, "default")
    with pytest.raises(ValueError, match="getrennt"):
        await mail.sync(id, "default")
    assert mail.threads("default")["conversations"]
    assert not mail.vault.has("mail-account-" + id)


@pytest.mark.asyncio
async def test_gmail_history_cursor_only_after_all_pages(mail):
    id = await account(mail)
    payload = {
        "id": "m1",
        "threadId": "t1",
        "internalDate": "1000",
        "payload": {
            "mimeType": "text/plain",
            "body": {"data": b64(b"hello")},
            "headers": [],
        },
    }

    def respond(r):
        path = r.url.path
        if path.endswith("/profile"):
            return httpx.Response(200, json={"historyId": "h1"})
        if path.endswith("/messages"):
            return httpx.Response(200, json={"messages": [{"id": "m1"}]})
        if path.endswith("/m1"):
            return httpx.Response(200, json=payload)
        if path.endswith("/history"):
            return httpx.Response(
                200, json={"historyId": "h2", "history": [{"messages": [{"id": "m1"}]}]}
            )
        raise AssertionError(path)

    install_transport(mail, respond)
    await mail.sync(id, "default")
    await mail.sync(id, "default")
    assert json.loads(mail.account(id, "default")["cursor"]) == {"history": "h2"}
    assert mail.threads("default")["conversations"][0]["revision"] == 1


@pytest.mark.asyncio
async def test_gmail_failure_preserves_cursor(mail):
    id = await account(mail)
    with mail.db.transaction() as cx:
        cx.execute(
            "UPDATE mail_accounts SET cursor=? WHERE id=?",
            (json.dumps({"history": "h0"}), id),
        )

    def respond(r):
        if r.url.path.endswith("/profile"):
            return httpx.Response(200, json={"historyId": "h1"})
        if r.url.path.endswith("/history"):
            return httpx.Response(
                200,
                json={"historyId": "h2", "history": [{"messages": [{"id": "bad"}]}]},
            )
        return httpx.Response(503)

    install_transport(mail, respond)
    with pytest.raises(ValueError):
        await mail.sync(id, "default")
    assert json.loads(mail.account(id, "default")["cursor"]) == {"history": "h0"}
    assert mail.account(id, "default")["status"] == "error"


@pytest.mark.asyncio
async def test_graph_nextlink_cannot_leak_token(mail):
    id = await account(mail, "outlook")
    requests = []

    def respond(r):
        requests.append(r)
        return httpx.Response(
            200, json={"value": [], "@odata.nextLink": "https://attacker.example/path"}
        )

    install_transport(mail, respond)
    with pytest.raises(ValueError, match="Fortsetzungslink"):
        await mail.sync(id, "default")
    assert len(requests) == 1
    assert json.loads(mail.account(id, "default")["cursor"]) == {}


def test_html_is_text_and_no_scripts(mail):
    result = mail.normalize_graph(
        {"address": "inbox@example.test"},
        {
            "id": "m",
            "body": {
                "contentType": "html",
                "content": '<script>secret()</script><p>Hello<img src="https://tracker.example"></p>',
            },
        },
    )
    assert result["text"] == "Hello"


@pytest.mark.asyncio
async def test_admin_checks_mailbox_before_persisting(mail):
    install_transport(
        mail,
        lambda r: (
            httpx.Response(200, json={"access_token": "token"})
            if r.url.path.endswith("/token")
            else httpx.Response(403)
        ),
    )
    with pytest.raises(ValueError, match="Freigabe"):
        await mail.admin(
            Admin(
                tenantId="11111111-1111-1111-1111-111111111111",
                clientId="22222222-2222-2222-2222-222222222222",
                clientSecret="synthetic",
                mailbox="inbox@example.test",
            )
        )
    assert mail.accounts("default") == []


def test_http_auth_and_internal_vault_boundary(tmp_path):
    from fastapi.testclient import TestClient
    from core.app import create_app

    config = Config(root=tmp_path, start_adapter=False, access_token="x" * 40)
    with TestClient(create_app(config)) as client:
        assert client.get("/api/mail/accounts").status_code == 401
        assert (
            client.get(
                "/api/mail/oauth/callback/gmail?state=wrong&code=synthetic"
            ).status_code
            == 400
        )
        client.headers["Authorization"] = "Bearer " + "x" * 40
        assert client.get("/api/mail/setup").status_code == 200
        assert (
            client.post(
                "/internal/provider-secrets", json={"action": "read", "id": "test"}
            ).status_code
            == 403
        )
        client.headers["x-agent-internal"] = config.adapter_token
        assert (
            client.post(
                "/internal/provider-secrets",
                json={"action": "save", "id": "test", "value": "synthetic-secret"},
            ).status_code
            == 200
        )
        assert client.post(
            "/internal/provider-secrets", json={"action": "read", "id": "test"}
        ).json() == {"value": "synthetic-secret"}
        assert (
            client.post(
                "/internal/provider-secrets",
                json={"action": "read", "id": "system-access"},
            ).status_code
            == 400
        )
        assert "synthetic-secret" not in client.get("/api/mail/setup").text
        assert client.post(
            "/api/inbox/tool",
            json={"name": "inbox_accounts", "arguments": {"projectId": "default"}},
        ).json() == {"accounts": []}
        assert (
            client.post(
                "/api/inbox/tool",
                json={"name": "inbox_accounts", "arguments": {"projectId": "missing"}},
            ).status_code
            == 400
        )
        del client.headers["Authorization"]
        del client.headers["x-agent-internal"]
        assert (
            client.post(
                "/api/mail/setup",
                json={
                    "provider": "gmail",
                    "clientId": "id",
                    "clientSecret": "synthetic",
                },
            ).status_code
            == 401
        )


def test_http_setup_requires_csrf(tmp_path):
    from fastapi.testclient import TestClient
    from core.app import create_app

    with TestClient(create_app(Config(root=tmp_path, start_adapter=False))) as client:
        body = {
            "provider": "gmail",
            "clientId": "synthetic-id",
            "clientSecret": "synthetic-secret",
        }
        assert client.post("/api/mail/setup", json=body).status_code == 403
        client.headers["x-uwe-token"] = client.get("/api/auth/session").json()["token"]
        assert client.post("/api/mail/setup", json=body).status_code == 200
        response = client.post("/api/mail/oauth/start", json={"provider": "gmail"})
        assert response.status_code == 200
        assert "synthetic-secret" not in response.text


@pytest.mark.asyncio
async def test_refresh_token_rotates_and_persists(mail):
    id = await account(mail)
    a = mail.account(id, "default")
    c = json.loads(mail.vault.read(a["secret_id"]))
    c["expires"] = 0
    mail.vault.save(a["secret_id"], json.dumps(c))
    install_transport(
        mail,
        lambda r: httpx.Response(
            200,
            json={
                "access_token": "synthetic-new-token",
                "refresh_token": "synthetic-rotated-refresh",
                "expires_in": 3600,
            },
        ),
    )
    assert await mail.obtain(a) == "synthetic-new-token"
    stored = json.loads(mail.vault.read(a["secret_id"]))
    assert stored["refresh_token"] == "synthetic-rotated-refresh"
    assert (
        "synthetic-rotated-refresh"
        not in mail.db.get("provider-vault/" + a["secret_id"])["value"]
    )


@pytest.mark.asyncio
async def test_attachment_is_scoped_to_project(mail):
    id = await account(mail)
    m = message()
    m["attachments"] = [{"id": "attachment", "name": "hello.txt", "size": 5}]
    mail.ingest(mail.account(id, "default"), [m], {})
    install_transport(mail, lambda r: httpx.Response(200, json={"data": b64(b"hello")}))
    mid = identifier(id, "m1")
    with pytest.raises(ValueError):
        await mail.attachments(mid, "other", "attachment")
    assert await mail.attachments(mid, "default", "attachment") == (
        b"hello",
        "hello.txt",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("provider", ["gmail", "outlook"])
async def test_new_message_keeps_explicit_recipient_and_single_send(mail, provider):
    from core.mail import Compose

    id = await account(mail, provider)
    tid = mail.compose(
        Compose(
            accountId=id, recipient="recipient@example.test", subject="Neue Nachricht"
        )
    )["id"]
    assert mail.detail(tid, "default")["messages"] == []
    mail.draft(Draft(id=tid, version=0, revision=0, text="Eine neue Nachricht."))
    requests = []

    def respond(r):
        requests.append(r)
        return httpx.Response(202 if provider == "outlook" else 200, json={})

    install_transport(mail, respond)
    assert (await mail.send(Send(id=tid, version=1)))["state"] == "accepted"
    value = json.loads(requests[0].content)
    if provider == "gmail":
        from core.mail import unb64

        assert "threadId" not in value
        assert b"To: recipient@example.test" in unb64(value["raw"])
    else:
        assert requests[0].url.path.endswith("/sendMail")
        assert (
            value["message"]["toRecipients"][0]["emailAddress"]["address"]
            == "recipient@example.test"
        )
    assert len(requests) == 1


def test_oauth_access_logs_hide_codes():
    import logging
    from core.mail import OAuthLogFilter

    record = logging.LogRecord(
        "uvicorn.access",
        20,
        "",
        0,
        "%s %s %s %s %s",
        (
            "ip",
            "GET",
            "/api/mail/oauth/callback/gmail?code=synthetic-code&state=synthetic-state",
            "HTTP/1.1",
            200,
        ),
        None,
    )
    assert OAuthLogFilter().filter(record)
    assert "synthetic" not in record.getMessage()


@pytest.mark.asyncio
async def test_malformed_provider_response_is_visible_and_does_not_advance(mail):
    id = await account(mail)
    install_transport(mail, lambda r: httpx.Response(200, json={}))
    with pytest.raises(ValueError, match="unvollständig"):
        await mail.sync(id, "default")
    assert mail.account(id, "default")["status"] == "error"
    assert json.loads(mail.account(id, "default")["cursor"]) == {}
