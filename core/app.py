from __future__ import annotations
from .modules import Modules, routes as module_routes

import asyncio
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from time import time
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, Request, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    StreamingResponse,
)
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from .chat_privacy import ChatPrivacy
from .frontend import asset_response
from fastapi import HTTPException

from .devices import Devices
from .device_network import DeviceNetwork
from .device_api import routes as device_routes
from .config import Config
from .database import Database
from .crm import CRM
from .crm_api import routes as crm_routes
from .storage import Storage, valid_record_key
from .knowledge import Knowledge
from .queue import JobQueue
from .runtime import Runtime
from .events import event_stream
from .settings import Settings
from .memory import Memory
from .operations import Operations
from .api import routes as operations_routes
from .routines import Routines, validate_schedule, instant
from .mail import Mail, routes as mail_routes
from .mail_workflow import MailWorkflow, routes as mail_workflow_routes
from .messenger import Messenger, routes as messenger_routes
from .calendar import Calendar, routes as calendar_routes
from .github import GitHub
from .contributions import Contributions
from .product_updates import Updates
from .update_api import routes as update_routes


class NoteInput(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    text: str = Field(max_length=2_000_000)
    version: str | None = None
    projectId: str = "default"


class ContextInput(BaseModel):
    query: str = Field(max_length=20000)
    projectId: str = "default"
    chatId: str | None = None
    maxCharacters: int = Field(default=8000, ge=500, le=16000)


def create_app(config=None):
    config = config or Config.environment()
    config.workspace.mkdir(parents=True, exist_ok=True)
    db = Database(config.data / "agent.sqlite3")
    crm = CRM(db)
    storage = Storage(db, config)
    storage.import_legacy()
    knowledge = Knowledge(db, config)
    settings = Settings(db)
    memory = Memory(db, config, knowledge, settings)
    memory.crm = crm
    privacy = ChatPrivacy(db, memory)
    memory.chat_privacy = privacy
    knowledge.chat_privacy = privacy
    operations = Operations(db, config, settings, knowledge, memory)
    devices = Devices(db, config)
    network = DeviceNetwork(operations)
    storage.system_jobs = operations.managed_jobs
    queue = JobQueue(db, storage, config.timezone)
    runtime = Runtime(config, queue, knowledge, operations)
    routines = Routines(storage, runtime, memory)
    mail = Mail(db, config)
    mail.workflow = MailWorkflow(mail, crm, routines)
    messenger = Messenger(db, config, mail.project)
    calendar = Calendar(db, config, runtime, mail.project)
    github = GitHub(db, config)
    contributions = Contributions(db, config, github)
    updates = Updates(db, config, runtime, github, contributions)
    runtime.product_updates = updates
    local_csrf = secrets.token_urlsafe(32)
    login_attempts = {}

    @asynccontextmanager
    async def lifespan(app):
        updates.recover()
        if not runtime.restore_hold and not runtime.update_hold:
            queue.recover()
            await asyncio.to_thread(knowledge.scan)
        await runtime.start()
        if not runtime.restore_hold and not runtime.update_hold:
            mail.task = asyncio.create_task(mail.loop())
            messenger.task = asyncio.create_task(messenger.loop())
            calendar.task = asyncio.create_task(calendar.loop())
        yield
        await updates.close()
        await github.close()
        await calendar.close()
        await messenger.close()
        await mail.close()
        await runtime.close()
        await asyncio.to_thread(devices.close)
        await asyncio.to_thread(network.close)
        db.close()

    app = FastAPI(
        title="Agent Core",
        version=updates.product["version"] or "unknown",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.db, app.state.knowledge, app.state.queue, app.state.runtime = (
        db,
        knowledge,
        queue,
        runtime,
    )
    app.state.operations = operations
    app.state.crm = crm
    app.state.mail = mail
    app.state.messenger = messenger
    app.state.chat_privacy = privacy

    app.state.github, app.state.product_updates = github, updates

    app.state.devices = devices
    app.state.device_network = network

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse(
            {
                "error": "Ungültige Eingabe.",
                "fields": [".".join(map(str, e["loc"])) for e in error.errors()],
            },
            status_code=422,
        )

    @app.exception_handler(ValueError)
    async def value_error(request, error):
        return JSONResponse({"error": str(error)}, status_code=400)

    @app.exception_handler(FileNotFoundError)
    async def missing_error(request, error):
        return JSONResponse({"error": "Datei nicht gefunden."}, status_code=404)

    @app.exception_handler(FileExistsError)
    async def conflict_error(request, error):
        return JSONResponse({"error": str(error)}, status_code=409)

    @app.middleware("http")
    async def access(request: Request, call_next):
        if runtime.frozen and request.method not in {"GET", "HEAD", "OPTIONS"} and request.url.path not in ({"/api/auth/login", "/api/system/backups/resume"} if runtime.restore_hold else {"/api/auth/login"}) and not request.url.path.startswith("/internal/"):
            return JSONResponse({"error": "Wiederherstellung prüfen und unter Speicher & Sicherung fortsetzen." if runtime.restore_hold else "Sicherung oder Neustart läuft. Bitte kurz warten."}, status_code=503)
        host = request.headers.get("host", "")
        allowed = {f"127.0.0.1:{config.port}", f"localhost:{config.port}", "testserver"}
        if config.public_origin:
            allowed.add(urlsplit(config.public_origin).netloc)
        if host not in allowed:
            return JSONResponse({"error": "Unbekannter Host."}, status_code=403)
        origin = request.headers.get("origin")
        origins = {
            f"http://127.0.0.1:{config.port}",
            f"http://localhost:{config.port}",
            config.public_origin,
        }
        if origin and origin not in origins:
            return JSONResponse({"error": "Fremder Ursprung."}, status_code=403)
        if request.url.path in {"/internal/update-operator", "/internal/maintenance/resume"}:
            from .files import read_json
            hold = read_json(config.data / "updates/maintenance.json", {})
            if not hold.get("nonce") or not hmac.compare_digest(request.headers.get("x-agent-update", ""), hold["nonce"]):
                return JSONResponse({"error": "Operatoranschluss geschützt."}, status_code=403)
            return await call_next(request)
        # Protect adapter callbacks before any public route or static fallback.
        if request.url.path.startswith("/internal/"):
            if not hmac.compare_digest(
                request.headers.get("x-agent-internal", ""), config.adapter_token
            ):
                return JSONResponse(
                    {"error": "Interner Anschluss geschützt."}, status_code=403
                )
            return await call_next(request)
        if (
            request.headers.get("content-length", "").isdigit()
            and int(request.headers["content-length"]) > 34 * 1024 * 1024
        ):
            return JSONResponse({"error": "Anfrage zu groß."}, status_code=413)
        request.state.csrf = local_csrf
        token = request.cookies.get("agent_session", "")
        session = (
            db.rows(
                "SELECT csrf FROM sessions WHERE digest=? AND expires_at>?",
                (hashlib.sha256(token.encode()).hexdigest(), time()),
            )
            if token
            else []
        )
        if config.login_required:
            authorization = request.headers.get("authorization", "")
            bearer = len(config.access_token) >= 32 and hmac.compare_digest(authorization, "Bearer " + config.access_token)
            if (
                not session
                and not bearer
                and request.url.path not in {"/api/mail/oauth/callback/gmail", "/api/mail/oauth/callback/outlook"}
                and request.url.path
                not in {"/login", "/login.js", "/login.css", "/api/auth/login", "/healthz"}
            ):
                if request.url.path.startswith("/api/"):
                    return JSONResponse({"error": "Bitte anmelden."}, status_code=401)
                return HTMLResponse(LOGIN_PAGE)
            if session:
                request.state.csrf = session[0]["csrf"]
        else:
            bearer = False
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and request.url.path != "/api/auth/login"
            and not bearer
        ):
            if not hmac.compare_digest(
                request.headers.get("x-uwe-token", ""), request.state.csrf
            ):
                return JSONResponse(
                    {"error": "Sitzung abgelaufen. Bitte neu laden."}, status_code=403
                )
        client = request.headers.get("x-chat-client", "")
        request.state.chat_client = client
        if request.url.path.startswith('/api/') and not request.url.path.startswith('/api/chat/privacy/'):
            data = dict(request.query_params)
            if 'application/json' in request.headers.get('content-type', ''):
                try:
                    parsed = await request.json()
                    if isinstance(parsed, dict):
                        data.update(parsed)
                except ValueError:
                    pass
            try:
                for key in ('id', 'chatId', 'threadId', 'sourceChatId'):
                    id = data.get(key)
                    if isinstance(id, str):
                        privacy.require(id, client)
                        if privacy.record(id) and request.url.path in {'/api/fork', '/api/chat/provider', '/api/memory/compact'}:
                            raise HTTPException(409, 'Bei privaten Chats ist diese Aktion nicht verfügbar.')
                for key in ('path', 'file', 'directory'):
                    if privacy.path_private(data.get(key)):
                        raise HTTPException(423, 'Diese Chatdatei ist privat.')
            except HTTPException as error:
                return JSONResponse({'error': error.detail}, status_code=error.status_code)
        writing = request.method not in {"GET", "HEAD", "OPTIONS"}
        if writing: runtime.active_writes += 1
        try:
            response = await call_next(request)
        finally:
            if writing: runtime.active_writes -= 1
        if request.url.path.startswith('/api/') and 'application/json' in response.headers.get('content-type', '') and response.status_code == 200:
            raw = b''.join([chunk async for chunk in response.body_iterator])
            payload = json.loads(raw)
            if not request.url.path.startswith('/api/chat/privacy/'):
                try:
                    for key in ('id', 'chatId', 'threadId', 'sourceChatId'):
                        if isinstance(data.get(key), str):
                            privacy.require(data[key], client)
                except HTTPException as error:
                    return JSONResponse({'error': error.detail}, status_code=error.status_code, background=response.background, headers={'Cache-Control':'no-store'})
            omit = request.url.path in {'/api/search', '/api/knowledge/search', '/api/notifications', '/api/planner/results'}
            payload = privacy.sanitize(payload, client, omit)
            if request.url.path == '/api/search' and isinstance(payload, dict):
                payload['total'] = len(payload.get('results', []))
            headers = {k: v for k, v in response.headers.items() if k.lower() != 'content-length'}
            response = JSONResponse(payload, status_code=response.status_code, headers=headers, background=response.background)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        else:
            response.headers.setdefault("Cache-Control", "no-store")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'",
        )
        return response

    @app.get('/api/chat/privacy/status')
    async def chat_privacy_status(id: str, request: Request):
        return {'private': bool(privacy.record(id)), 'locked': not privacy.allowed(id, request.state.chat_client)}

    @app.post('/api/chat/privacy/{action}')
    async def chat_privacy_action(action: str, request: Request):
        body = await request.json()
        try:
            return await asyncio.to_thread(privacy.change, action, body.get('id'), body.get('pin'), request.state.chat_client)
        except HTTPException as error:
            return JSONResponse({'error': error.detail}, status_code=error.status_code)

    @app.get("/api/core/status")
    async def status():
        return {
            "backend": "FastAPI",
            "storage": "SQLite",
            "schema": 2,
            "knowledgeDocuments": db.rows("SELECT count(*) n FROM documents")[0]["n"],
            "embeddings": knowledge.embeddings.status(),
            "runtimeError": runtime.error,
            "remoteLogin": config.login_required,
        }

    @app.get("/healthz")
    async def health():
        return {"checks": operations.checks()}

    app.include_router(operations_routes(operations, queue))
    app.include_router(crm_routes(crm, memory))
    app.include_router(mail_routes(mail))
    app.include_router(messenger_routes(messenger))
    app.include_router(mail_workflow_routes(mail.workflow))
    app.include_router(calendar_routes(calendar))
    app.include_router(update_routes(github, updates, contributions))

    @app.post("/internal/update-operator")
    async def update_operator(request: Request):
        from .files import read_json
        from .update_operator import write, matches_source, tree_files, seal_installed
        from .update_source import Source
        body = await request.json()
        hold = read_json(config.data / "updates/maintenance.json", {})
        if body.get("id") != hold.get("id"):
            raise ValueError("Operatorauftrag passt nicht zur Betriebspause.")
        directory = config.data / "updates" / hold["id"]
        instruction = read_json(directory / "install.json", {})
        run = db.get("updates/run/" + hold["id"])["value"]
        if not run or instruction.get("approvalHash") != run.get("approvalHash"):
            raise ValueError("Updatefreigabe fehlt oder wurde verändert.")
        action = body.get("action")
        if action == "quiesce":
            runtime.update_hold = runtime.frozen = True
            if await runtime.has_active_work():
                raise ValueError("Aktive Arbeit verhindert die Umstellung.")
            for task in [mail.task, calendar.task, messenger.task]:
                if task:
                    task.cancel()
            await asyncio.gather(*[t for t in [mail.task, calendar.task, messenger.task] if t], return_exceptions=True)
            if Source(config).inventory(db)["hash"] != run["inventory"]["hash"]:
                raise ValueError("Aufträge oder Konfiguration wurden verändert. Erneute Vorbereitung erforderlich.")
            if (await asyncio.to_thread(Source(config).read))["hash"] != run["sourceHash"] or await updates.releases.latest() != run["release"]:
                raise ValueError("Quellstand oder Releasefreigabe wurde verändert. Erneute Vorbereitung erforderlich.")
            return {"paused": True}
        async def update_health():
            adapter = await runtime.request("GET", "/api/updates") if config.start_adapter else {"updateHold": True}
            files = instruction["before"] if read_json(directory / "operator-state.json", {}).get("phase") in {"restoring", "not-installed", "stopped", "backing-up", "backed-up"} else instruction["after"]
            valid = matches_source(config.root, files)
            if files is instruction["after"]:
                valid = valid and tree_files(config.root / "wrapper/dist") == instruction["build"]
            with db.lock:
                valid = valid and db.connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            if read_json(directory / "decision.json", {}).get("phase") == "decided":
                return {"ready": bool(valid), "held": runtime.update_hold}
            valid = valid and Source(config).inventory(db)["hash"] == run["inventory"]["hash"]
            return {"ready": bool(runtime.update_hold and valid and adapter.get("updateHold")), "held": runtime.update_hold}
        if action == "health":
            return await update_health()
        if action in {"commit", "restore"}:
            state = "installed" if action == "commit" else "restored"
            decision = read_json(directory / "decision.json", {})
            if decision and decision.get("action") != action:
                raise ValueError("Eine bereits begonnene Betriebsentscheidung darf nicht gewechselt werden.")
            if not (await update_health())["ready"]:
                raise ValueError("Betriebsprüfung noch nicht bestanden. Schreibpause bleibt erhalten.")
            # A durable commit decision forbids rollback once new work can resume.
            write(directory / "decision.json", {"id": run["id"], "action": action, "phase": "decided"})
            if action == "commit":
                await asyncio.to_thread(seal_installed, config.root, config.data, instruction)
            if config.start_adapter:
                await runtime.request("POST", "/api/system/update-hold", json={"hold": False, "channels": instruction.get("channels", [])})
            runtime.update_hold = runtime.frozen = False
            if mail.task is None or mail.task.done():
                mail.task = asyncio.create_task(mail.loop())
            if messenger.task is None or messenger.task.done():
                messenger.task = asyncio.create_task(messenger.loop())
            if calendar.task is None or calendar.task.done():
                calendar.task = asyncio.create_task(calendar.loop())
            updates.journal(run, state=state, phase="Aktualisiert" if action == "commit" else "Wiederhergestellt", error="")
            if action == "commit":
                updates.save(installed={"version": instruction["version"], "commit": instruction["candidate"]["commit"], "at": time()})
            write(directory / "decision.json", {"id": run["id"], "action": action, "phase": "completed"})
            (config.data / "updates/maintenance.json").unlink(missing_ok=True)
            updates.notice(state + "-" + run["id"], "Aktualisiert" if action == "commit" else "Wiederhergestellt", "Die Installation ist wieder verfügbar.", subject=run["id"])
            return {"ok": True, "state": state}
        raise ValueError("Unbekannte Operatoraktion.")

    @app.post("/internal/maintenance/resume")
    async def resume_maintenance(request: Request):
        # A local release operator starts the new version under the maintenance hold, verifies it,
        # and then lifts the hold in place instead of restarting a second time.
        from .files import read_json
        body = await request.json()
        hold = read_json(config.data / "updates/maintenance.json", {})
        if not hold or body.get("id") != hold.get("id"):
            raise ValueError("Auftrag passt nicht zur Wartungspause.")
        if not runtime.update_hold:
            return {"resumed": False, "reason": "Keine Wartungspause aktiv."}
        if config.start_adapter:
            channels = body.get("channels", [])
            if not isinstance(channels, list):
                raise ValueError("Anschlussliste ungültig.")
            await runtime.request("POST", "/api/system/update-hold", json={"hold": False, "channels": channels})
        runtime.update_hold = runtime.frozen = False
        queue.recover()
        await asyncio.to_thread(knowledge.scan)
        if mail.task is None or mail.task.done():
            mail.task = asyncio.create_task(mail.loop())
        if messenger.task is None or messenger.task.done():
            messenger.task = asyncio.create_task(messenger.loop())
        if calendar.task is None or calendar.task.done():
            calendar.task = asyncio.create_task(calendar.loop())
        (config.data / "updates/maintenance.json").unlink(missing_ok=True)
        return {"resumed": True}
    app.include_router(module_routes(Modules(config), runtime, mail))

    app.include_router(device_routes(devices, network))

    @app.get("/api/auth/session")
    async def session(request: Request):
        return {"token": request.state.csrf, "loginRequired": config.login_required}

    @app.post("/api/auth/login")
    async def login(request: Request):
        ip = request.client.host if request.client else "local"
        previous = [t for t in login_attempts.get(ip, []) if time() - t < 60]
        login_attempts[ip] = previous
        if len(previous) >= 10:
            return JSONResponse(
                {"error": "Zu viele Versuche. Bitte eine Minute warten."},
                status_code=429,
            )
        body = await request.json()
        if not config.login_required or not hmac.compare_digest(
            str(body.get("token", "")), config.login_password or config.access_token
        ):
            previous.append(time())
            return JSONResponse({"error": "Zugangscode stimmt nicht."}, status_code=401)
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with db.transaction() as cx:
            cx.execute("DELETE FROM sessions WHERE expires_at<?", (time(),))
            cx.execute(
                "INSERT INTO sessions VALUES(?,?,?)",
                (hashlib.sha256(token.encode()).hexdigest(), csrf, time() + 86400 * 7),
            )
        response = JSONResponse({"ok": True})
        response.set_cookie(
            "agent_session",
            token,
            httponly=True,
            secure=bool(config.public_origin and request.headers.get("host") == urlsplit(config.public_origin).netloc),
            samesite="strict",
            max_age=86400 * 7,
        )
        return response

    @app.post("/api/auth/logout")
    async def logout(request: Request):
        token = request.cookies.get("agent_session", "")
        with db.transaction() as cx:
            cx.execute(
                "DELETE FROM sessions WHERE digest=?",
                (hashlib.sha256(token.encode()).hexdigest(),),
            )
        response = JSONResponse({"ok": True})
        response.delete_cookie("agent_session")
        return response

    @app.get('/internal/chat-privacy/ids')
    async def private_chat_ids():
        # The adapter only needs exclusions, never PIN hashes or unlock grants.
        return {'ids': sorted(privacy.records())}

    @app.get("/internal/storage")
    async def record(key: str):
        if not valid_record_key(key):
            raise ValueError("Unzulässiger Datensatz.")
        return db.get(key)

    @app.post("/internal/storage")
    async def store_record(request: Request):
        body = await request.json()
        if not valid_record_key(body.get("key", "")):
            raise ValueError("Unzulässiger Datensatz.")
        value = db.put(
                body["key"],
                body["value"],
                only_if_missing=body.get("importOnly", False),
            )
        memory.queue_capture(body["key"], value)
        return {"value": value}

    @app.post("/internal/jobs/finish")
    async def finish(request: Request):
        b = await request.json()
        return queue.finish(b["id"], b["status"], b.get("result"), b.get("error"))

    @app.post('/internal/routines/tool')
    @app.post('/api/routines/tool')
    async def routine_tool(request: Request):
        b = await request.json()
        if not isinstance(b, dict) or not isinstance(b.get('arguments'), dict):
            raise ValueError('Werkzeugargumente fehlen.')
        try:
            return await routines.tool(b.get('name'), b['arguments'])
        except (RuntimeError, httpx.HTTPError):
            return JSONResponse({'error': 'Worker-Anschluss ist nicht erreichbar. Verbindung prüfen und erneut versuchen; dieselbe requestKey beibehalten.'}, status_code=503)

    @app.get('/api/notifications')
    async def notifications(before: float | None = None):
        return runtime.notifications.list(before)

    @app.get('/api/planner/results')
    async def planner_results():
        return runtime.notifications.results()

    @app.post('/internal/planner/result')
    async def planner_result(request: Request):
        item = runtime.notifications.get((await request.json()).get('id', ''))
        if item['status'] != 'completed':
            raise ValueError('Dieser Bericht ist noch nicht abgeschlossen.')
        return item

    @app.get('/api/notifications/preference')
    async def notification_preference():
        return db.get('notifications/preference')['value'] or {'target': 'app', 'when': 'always'}

    @app.post('/api/notifications/preference')
    async def save_notification_preference(request: Request):
        value = await routines.validate_notification(await request.json())
        return db.put('notifications/preference', value)

    @app.post('/api/notifications/read')
    async def notification_read(request: Request):
        return runtime.notifications.read((await request.json()).get('id', ''))

    @app.get('/api/notifications/item')
    async def notification_item(id: str):
        return runtime.notifications.get(id)

    @app.post('/internal/jobs/attention')
    async def job_attention(request: Request):
        b = await request.json()
        return runtime.notifications.attention(queue.get(b['id']))

    @app.post('/api/jobs/notify')
    async def private_notification_delivery():
        return JSONResponse({'error': 'Versand erfolgt ausschließlich durch den Zeitplaner.'}, status_code=403)

    @app.post("/internal/context")
    @app.post("/api/knowledge/context")
    async def context(b: ContextInput):
        return await asyncio.to_thread(
            memory.context, b.query, b.projectId, b.chatId, b.maxCharacters
        )

    @app.get("/api/knowledge/search")
    async def search(
        q: str = Query(default="", max_length=500),
        projectId: str = "all",
        limit: int = Query(default=30, ge=1, le=100),
    ):
        return {
            "results": await asyncio.to_thread(knowledge.search, q, projectId, limit),
            "embeddings": knowledge.embeddings.status(),
        }

    @app.post("/api/knowledge/reindex")
    async def reindex():
        result = await asyncio.to_thread(knowledge.scan)
        result["embeddingIndex"] = await asyncio.to_thread(knowledge.embed)
        return result

    @app.get("/api/knowledge/note")
    async def note(path: str):
        return await asyncio.to_thread(knowledge.read, path)

    @app.post("/api/knowledge/note")
    async def save_note(b: NoteInput):
        return await asyncio.to_thread(
            memory.save, b.path, b.text, b.version, b.projectId
        )

    @app.get("/api/core/executions")
    async def executions(status: str | None = None):
        if status and status not in {
            "queued",
            "dispatching",
            "running",
            "completed",
            "failed",
            "interrupted",
            "cancelled",
        }:
            raise ValueError("Unbekannter Status.")
        return {
            "runs": db.rows(
                "SELECT * FROM executions"
                + (" WHERE status=?" if status else "")
                + " ORDER BY created_at DESC LIMIT 200",
                (status,) if status else (),
            )
        }

    @app.post("/api/jobs/run")
    async def run(request: Request):
        b = await request.json()
        await asyncio.to_thread(storage.sync_jobs)
        queued = queue.enqueue(b.get("id", ""))
        return {"runId": queued["id"], "status": queued["status"], "queued": True}

    @app.get("/api/jobs")
    async def jobs():
        jobs = await asyncio.to_thread(storage.sync_jobs)
        for job in jobs:
            runs = db.rows(
                "SELECT * FROM executions WHERE job_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
                (job["id"],),
            )
            if runs:
                run = runs[0]
                job["lastRun"] = {
                    **(job.get("lastRun") or {}),
                    "status": run["status"],
                    "coreRunId": run["id"],
                    "runId": run["adapter_run_id"] or run["id"],
                    "threadId": run["thread_id"],
                    "error": run["error"],
                }
        return jobs

    @app.post("/api/jobs/save")
    async def save_job(request: Request):
        body = await request.json()
        validate_schedule(body.get('schedule') or {'type': 'manual'})
        if 'notification' in body:
            body['notification'] = await routines.validate_notification(body['notification'], check_ready=body.get('status')=='active')
        id = body.get("id", "")
        if id in {j["id"] for j in operations.managed_jobs()}:
            enabled = body.get("status") == "active"
            if id == "system-backup":
                if enabled:
                    # Verify the configured archive and key before enabling its schedule.
                    await asyncio.to_thread(operations.backups.command, "snapshots", "--json")
                settings.set_group("backup", enabled=enabled)
            elif id == "system-frontend":
                settings.set_group("system", frontend_check=enabled)
            elif id == "system-memory":
                settings.set_group("memory", dreaming=enabled)
            else:
                raise ValueError("Diesen Systemauftrag über die Systemeinstellungen bedienen.")
            storage.sync_jobs()
            return storage.job(id)
        previous = next((j for j in storage.sync_jobs() if j['id']==id), None)
        schedule = body.get('schedule') or {'type':'manual'}
        if schedule['type'] != 'manual' and (not previous or previous.get('schedule') != schedule or (previous.get('status') != 'active' and body.get('status') == 'active')):
            schedule['startAt'] = datetime.now(timezone.utc).isoformat()
            schedule.setdefault('timezone', config.timezone)
            body['schedule'] = schedule
        if schedule['type']=='once' and body.get('status')=='active' and instant(schedule['at'])<=datetime.now(timezone.utc):
            raise ValueError('Der einmalige Termin muss in der Zukunft liegen.')
        if not previous and 'notification' not in body:
            body['notification'] = await routines.validate_notification(db.get('notifications/preference')['value'] or {'target':'app','when':'always'})
        try:
            result = await runtime.request("POST", "/api/jobs/save", json=body)
        except RuntimeError as error:
            raise ValueError(str(error)) from error
        storage.sync_jobs()
        db.event("job.changed", result.get("id"), {})
        return result

    @app.get("/api/core/context-routes")
    async def routes(chatId: str | None = None):
        return {
            "routes": db.rows(
                "SELECT * FROM context_routes"
                + (" WHERE chat_id=?" if chatId else "")
                + " ORDER BY created_at DESC LIMIT 50",
                (chatId,) if chatId else (),
            )
        }

    @app.get("/api/events")
    async def events(request: Request):
        return StreamingResponse(
            privacy.stream(event_stream(runtime, db, request.headers.get("last-event-id", "")), request.query_params.get("client", "")), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"}
        )

    @app.api_route("/api/{route:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def adapter(route: str, request: Request):
        # No browser credentials or arbitrary forwarding headers reach the private adapter.
        url = config.adapter_url + "/api/" + route
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 34 * 1024 * 1024:
                return JSONResponse({"error": "Anfrage zu groß."}, status_code=413)
        if route == 'respond':
            try:
                request_body = json.loads(body)
                upstream = await runtime.client.get(config.adapter_url + '/api/bootstrap', headers=runtime.headers)
                upstream.raise_for_status()
                pending = next((r for r in upstream.json().get('requests', []) if str(r.get('id')) == str(request_body.get('id'))), None)
                if pending:
                    privacy.require(pending.get('params', {}).get('threadId'), request.state.chat_client)
            except HTTPException as error:
                return JSONResponse({'error': error.detail}, status_code=error.status_code)
            except (httpx.HTTPError, ValueError):
                return JSONResponse({'error': 'Rückfrage kann gerade nicht geprüft werden.'}, status_code=503)
        headers = {**runtime.headers}
        if request.headers.get("content-type"):
            headers["content-type"] = request.headers["content-type"]
        try:
            outgoing = runtime.client.build_request(
                request.method,
                url,
                params=request.query_params,
                content=bytes(body),
                headers=headers,
                timeout=None if route == "events" else 120,
            )
            response = await runtime.client.send(outgoing, stream=True)
        except httpx.HTTPError:
            return JSONResponse(
                {
                    "error": "Worker-Anschluss startet oder ist nicht erreichbar. Bitte erneut versuchen."
                },
                status_code=503,
            )
        if route == "bootstrap" and response.status_code == 200:
            payload = json.loads(await response.aread())
            await response.aclose()
            payload["token"] = request.state.csrf
            payload["features"] = {
                **payload.get("features", {}),
                "mailInbox": True,
                "messengerInbox": True,
                "chatPrivacy": True,
                "knowledge": True,
                "sqlite": True,
                "crmCore": True,
                "deviceConnections": True,
                "operations": True,
                "routines": True,
                "jobConfiguration": True,

                "github": True,
                "productUpdates": True,
            }
            return JSONResponse(payload)
        forwarded = {
            k: v
            for k, v in response.headers.items()
            if k.lower()
            in {"content-type", "content-disposition", "content-security-policy"}
        }
        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=forwarded,
            background=BackgroundTask(response.aclose),
        )

    @app.get("/{path:path}")
    async def frontend(path: str, request: Request):
        if path == "login":
            return HTMLResponse(LOGIN_PAGE)
        directory = (config.root / "wrapper/dist").resolve()
        target = (directory / (path or "index.html")).resolve()
        if not target.is_relative_to(directory) or not target.is_file():
            return JSONResponse({"error": "Datei nicht gefunden."}, status_code=404)
        if target.suffix in {".br", ".gz"}:
            return JSONResponse({"error": "Datei nicht gefunden."}, status_code=404)
        return asset_response(request, directory, target)

    return app


LOGIN_PAGE = """<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent · Anmelden</title><link rel="stylesheet" href="/login.css"><main><h1>Dein Arbeitsbereich</h1><p>Mit deinem Zugangscode anmelden.</p><form id="login"><label for="token">Zugangscode</label><input id="token" name="token" type="password" autocomplete="current-password" required><button>Anmelden</button><p role="alert" id="error"></p></form></main><script src="/login.js"></script></html>"""
