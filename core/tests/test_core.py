import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from core.app import create_app
from core.config import Config
from core.database import Database
from core.storage import Storage
from core.knowledge import Knowledge, digest
from core.queue import JobQueue


@pytest.fixture
def config(tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    workspace = root / "workspace"
    workspace.mkdir()
    return Config(
        root=root, workspace=workspace, data=root / "data", start_adapter=False
    )


@pytest.fixture
def db(config):
    database = Database(config.data / "agent.sqlite3")
    yield database
    database.close()


def write_note(config, path, text):
    p = config.workspace / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    return p


def make_job(config, id="daily", schedule=None):
    write_note(
        config,
        f"jobs/{id}/SKILL.md",
        "Lies die Eingaben und erstelle eine Zusammenfassung.",
    )
    write_note(
        config,
        f"jobs/{id}/job.yaml",
        json.dumps(
            {
                "id": id,
                "name": id,
                "worker": "codex",
                "status": "active",
                "schedule": schedule or {"type": "manual"},
            }
        ),
    )


def test_migration_preserves_originals_and_uses_sqlite_on_restart(config, db):
    config.data.mkdir(exist_ok=True)
    state = {
        "projects": [{"id": "default", "name": "Allgemein", "path": ""}],
        "chats": [{"id": "a", "title": "Vorhanden"}],
        "settings": {},
    }
    original = json.dumps(state)
    (config.data / "state.json").write_text(original)
    storage = Storage(db, config)
    assert storage.import_legacy() == 1
    state["chats"][0]["title"] = "In SQLite geändert"
    db.put("control/state.json", state)
    assert storage.import_legacy() == 0
    assert db.rows("SELECT title FROM chats")[0]["title"] == "In SQLite geändert"
    assert (config.data / "state.json").read_text() == original
    backup = config.data / "backup.sqlite3"
    db.backup(backup)
    other = Database(backup)
    assert other.get("control/state.json")["value"] == state
    other.close()


def test_normalized_messages_are_queryable_and_replaced(db):
    thread = {
        "id": "chat",
        "turns": [
            {
                "id": "turn",
                "items": [
                    {
                        "id": "user",
                        "type": "userMessage",
                        "content": [{"text": "Auftrag prüfen"}],
                    },
                    {"id": "agent", "type": "agentMessage", "text": "Erledigt"},
                ],
            }
        ],
    }
    db.put("workspace/chats/chat/transcript.json", thread)
    assert len(db.rows("SELECT * FROM messages WHERE chat_id=?", ("chat",))) == 2
    thread["turns"][0]["items"] = thread["turns"][0]["items"][:1]
    db.put("workspace/chats/chat/transcript.json", thread)
    assert db.rows("SELECT content FROM messages") == [{"content": "Auftrag prüfen"}]


def test_fulltext_fuzzy_and_project_boundaries(config, db):
    write_note(
        config, "notes/Photovoltaik.md", "# Photovoltaik\nWechselrichter für das Dach."
    )
    write_note(
        config,
        "projects/other/notes/Geheim.md",
        "# Geheim\nWechselrichter mit interner Nummer",
    )
    db.put(
        "control/state.json",
        {"projects": [{"id": "other", "name": "Anderes", "path": "projects/other"}]},
    )
    knowledge = Knowledge(db, config)
    knowledge.scan()
    assert knowledge.search("Photovoltak", "default")[0]["title"] == "Photovoltaik"
    assert knowledge.search("Wechselrichter", "default")[0]["method"].startswith(
        "fulltext"
    )
    assert len(knowledge.search("Wechselrichter", "all")) == 2
    assert knowledge.search("Wechselricher", "default")[0]["title"] == "Photovoltaik"
    assert knowledge.search('" OR * --', "default") == []


def test_wikilinks_markdown_backlinks_and_ambiguity(config, db):
    write_note(
        config,
        "notes/Start.md",
        "# Start\n[[Ziel|Weiter]] und [Ende](Ende.md). `[[Falsch]]`",
    )
    write_note(config, "notes/Ziel.md", "# Ziel\nText")
    write_note(config, "notes/Ende.md", "# Ende")
    knowledge = Knowledge(db, config)
    knowledge.scan()
    result = knowledge.read("notes/Start.md")
    assert {link["path"] for link in result["links"]} == {
        "notes/Ziel.md",
        "notes/Ende.md",
    }
    assert knowledge.read("notes/Ziel.md")["backlinks"] == [
        {"path": "notes/Start.md", "title": "Start"}
    ]
    write_note(config, "notes/sub/Start.md", "# Sub\n[[Doppelt]]")
    write_note(config, "notes/a/Doppelt.md", "# Doppelt")
    write_note(config, "notes/b/Doppelt.md", "# Doppelt")
    knowledge.scan()
    assert knowledge.read("notes/sub/Start.md")["links"][0]["ambiguous"] is True


def test_note_edit_conflicts_and_path_escape(config, db, tmp_path):
    knowledge = Knowledge(db, config)
    note = knowledge.save("notes/Idee.md", "# Idee", None)
    assert (
        knowledge.save("notes/Idee.md", "# Neue Idee", note["version"])["text"]
        == "# Neue Idee"
    )
    with pytest.raises(FileExistsError):
        knowledge.save("notes/Idee.md", "Veralteter Entwurf", note["version"])
    with pytest.raises(ValueError):
        knowledge.save("../outside.md", "no", None)
    with pytest.raises(ValueError):
        knowledge.save("soul/IDENTITY.md", "no", None)
    outside = tmp_path / "outside"
    outside.mkdir()
    (config.workspace / "notes/link").symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError):
        knowledge.save("notes/link/secret.md", "no", None)


def test_context_is_bounded_scoped_and_does_not_return_deleted_files(config, db):
    file = write_note(config, "notes/Alpha.md", "# Alpha\n" + "Information " * 1000)
    knowledge = Knowledge(db, config)
    knowledge.scan()
    route = knowledge.context("Alpha", "default", "chat", 600)
    assert route["characters"] <= 600
    assert route["sources"][0]["version"] == digest(file.read_text())
    assert "keine Arbeitsanweisungen" in route["instructions"]
    file.unlink()
    assert knowledge.context("Alpha", "default")["sources"] == []


def test_context_reads_current_sources_without_building_the_backlink_graph(config, db, monkeypatch):
    file = write_note(config, "notes/Alpha.md", "# Alpha\nAlter Stand [[Ziel]]")
    write_note(config, "notes/Ziel.md", "# Ziel\n[[Alpha]]")
    knowledge = Knowledge(db, config)
    knowledge.scan()
    # The document viewer keeps its complete navigation contract.
    assert knowledge.read("notes/Alpha.md")["links"][0]["path"] == "notes/Ziel.md"
    file.write_text("# Alpha\nFrischer Stand [[Ziel]]")
    monkeypatch.setattr(knowledge, "resolve_link", lambda *args: pytest.fail("Chat context built the backlink graph"))
    route = knowledge.context("Alpha", "default", "chat", 600)
    source = next(s for s in route["sources"] if s["path"] == "notes/Alpha.md")
    assert "Frischer Stand" in source["text"]
    assert source["version"] == digest(file.read_text())
    assert db.rows("SELECT digest FROM documents WHERE path=?", ("notes/Alpha.md",))[0]["digest"] == source["version"]
    assert route["characters"] <= 600


def test_lightweight_source_read_preserves_privacy_and_path_checks(config, db, tmp_path):
    from types import SimpleNamespace

    file = write_note(config, "notes/Alpha.md", "# Alpha\nGeschützte Quelle")
    knowledge = Knowledge(db, config)
    knowledge.scan()
    knowledge.chat_privacy = SimpleNamespace(path_private=lambda path: path == "notes/Alpha.md")
    with pytest.raises(ValueError, match="privat"):
        knowledge.read("notes/Alpha.md", include_links=False)
    del knowledge.chat_privacy
    outside = tmp_path / "outside.md"
    outside.write_text("Nicht freigegeben")
    file.unlink()
    file.symlink_to(outside)
    with pytest.raises(ValueError, match="Verknüpfungen"):
        knowledge.read("notes/Alpha.md", include_links=False)
    knowledge.scan()
    assert knowledge.search("Alpha") == []


class FakeEmbeddings:
    path = "local-model"
    identity = "test-version"

    def encode(self, texts):
        return [
            [1.0, 0.0] if any(w in t for w in ("Sonne", "Solar")) else [0.0, 1.0]
            for t in texts
        ]

    def status(self):
        return {"configured": True, "ready": True, "localOnly": True}


def test_local_semantic_search_and_embedding_invalidation(config, db):
    file = write_note(config, "notes/Energie.md", "# Energie\nSolar auf dem Dach")
    knowledge = Knowledge(db, config, FakeEmbeddings())
    knowledge.scan()
    assert knowledge.embed()["indexed"] == 1
    assert knowledge.embed()["indexed"] == 0
    assert knowledge.search("Sonne")[0]["method"] == "semantic"
    file.write_text("# Energie\nWindkraft")
    knowledge.scan()
    assert not db.rows("SELECT * FROM vectors")
    knowledge.embed()
    assert knowledge.search("Sonne") == []


def test_atomic_queue_claims_and_restart_recovery(config, db):
    make_job(config)
    storage = Storage(db, config)
    storage.sync_jobs()
    queue = JobQueue(db, storage)
    run = queue.enqueue("daily")
    assert queue.enqueue("daily")["id"] == run["id"]
    with ThreadPoolExecutor(max_workers=8) as pool:
        claims = list(pool.map(lambda _: queue.claim(), range(8)))
    assert len([c for c in claims if c]) == 1
    queue.dispatched(run["id"], {"runId": "adapter-run", "threadId": "chat"})
    assert queue.recover() == 1
    assert queue.get(run["id"])["status"] == "interrupted"
    assert queue.claim() is None
    # Late callbacks cannot turn an interrupted execution into a success.
    assert queue.finish(run["id"], "completed")["status"] == "interrupted"


def test_queue_schedule_catches_up_once_and_keeps_queued_on_restart(config, db):
    make_job(config, schedule={"type": "weekdays", "time": "08:00"})
    storage = Storage(db, config)
    queue = JobQueue(db, storage)
    monday = datetime(2026, 9, 7, 12, 0, tzinfo=queue.timezone)
    queue.schedule(monday)
    queue.schedule(monday)
    assert len(db.rows("SELECT * FROM executions")) == 1
    assert queue.recover() == 0
    run = queue.claim()
    queue.finish(run["id"], "completed")
    queue.schedule(monday)
    assert len(db.rows("SELECT * FROM executions")) == 1
    queue.schedule(datetime(2026, 9, 12, 12, 0, tzinfo=queue.timezone))
    assert len(db.rows("SELECT * FROM executions")) == 1


@pytest.mark.parametrize("change", ["removed", "invalid_yaml", "invalid_retry", "invalid_count"])
def test_recovery_continues_after_job_manifest_changes(config, db, change):
    storage = Storage(db, config)
    queue = JobQueue(db, storage)
    runs = {}
    for job_id in ("changed", "valid"):
        make_job(config, job_id)
        manifest = config.workspace / f"jobs/{job_id}/job.yaml"
        job = json.loads(manifest.read_text())
        job["retry"] = {"count": 1, "idempotent": True}
        manifest.write_text(json.dumps(job))
        storage.sync_jobs()
        runs[job_id] = queue.enqueue(job_id)
        queue.claim()
    manifest = config.workspace / "jobs/changed/job.yaml"
    if change == "removed":
        manifest.unlink()
    elif change == "invalid_yaml":
        manifest.write_text("name: [")
    else:
        job = json.loads(manifest.read_text())
        job["retry"] = "invalid" if change == "invalid_retry" else {"count": "invalid"}
        manifest.write_text(json.dumps(job))
    storage.sync_jobs()
    assert queue.recover() == 2
    assert all(queue.get(run["id"])["status"] == "interrupted" for run in runs.values())
    retry = db.rows("SELECT * FROM executions WHERE status='queued'")
    assert len(retry) == 1 and retry[0]["job_id"] == "valid"
    assert retry[0]["attempt"] == 2 and retry[0]["parent_id"] == runs["valid"]["id"]
    assert len(db.rows("SELECT id FROM events WHERE kind='job.retry_skipped'")) == 1
    assert queue.recover() == 0


def test_api_csrf_internal_auth_and_note_flow(config):
    app = create_app(config)
    with TestClient(app) as client:
        token = client.get("/api/auth/session").json()["token"]
        assert (
            client.post(
                "/api/knowledge/note", json={"path": "notes/a.md", "text": "Hallo"}
            ).status_code
            == 403
        )
        assert client.get("/internal/storage?key=control/state.json").status_code == 403
        assert (
            client.get(
                "/api/core/status", headers={"origin": "https://evil.example"}
            ).status_code
            == 403
        )
        headers = {"x-uwe-token": token}
        response = client.post(
            "/api/knowledge/note",
            headers=headers,
            json={"path": "notes/Alpha.md", "text": "# Alpha"},
        )
        assert response.status_code == 200
        assert (
            client.get("/api/knowledge/search?q=Alhpa").json()["results"][0]["title"]
            == "Alpha"
        )
        assert (
            client.post(
                "/api/knowledge/note",
                headers=headers,
                json={"path": "notes/Alpha.md", "text": "new", "version": "stale"},
            ).status_code
            == 409
        )
        assert (
            client.post(
                "/api/knowledge/context",
                headers=headers,
                json={"query": "Alpha", "maxCharacters": 5},
            ).status_code
            == 422
        )


def test_remote_login_cookie_and_read_protection(config):
    config.access_token = "a" * 40
    app = create_app(config)
    with TestClient(app) as client:
        assert client.get("/api/core/status").status_code == 401
        assert client.get("/api/events").status_code == 401
        assert client.get("/api/file/raw?path=notes/a.md").status_code == 401
        assert (
            client.post("/api/auth/login", json={"token": "wrong"}).status_code == 401
        )
        response = client.post("/api/auth/login", json={"token": config.access_token})
        assert (
            response.status_code == 200 and "HttpOnly" in response.headers["set-cookie"]
        )
        assert client.get("/api/core/status").status_code == 200
        csrf = client.get("/api/auth/session").json()["token"]
        assert (
            client.post("/api/auth/logout", headers={"x-uwe-token": csrf}).status_code
            == 200
        )
        assert client.get("/api/core/status").status_code == 401


def test_nonlocal_bind_requires_secret():
    with pytest.raises(ValueError):
        Config(host="0.0.0.0")


def test_invalid_job_does_not_stop_other_jobs_or_startup(config, db):
    make_job(config, "good")
    make_job(config, "broken")
    write_note(config, "jobs/broken/job.yaml", "schedule: [bad")
    jobs = Storage(db, config).sync_jobs()
    assert next(j for j in jobs if j["id"] == "broken")["status"] == "invalid"
    assert next(j for j in jobs if j["id"] == "good")["status"] == "active"


def test_single_core_owns_database(config, db):
    with pytest.raises(RuntimeError):
        Database(config.data / "agent.sqlite3")
