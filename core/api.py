"""The settings UI, automation jobs and MCP use the same core services."""
import asyncio
import json
import os
import signal
import sys
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .files import atomic_write, sync_directory
from .knowledge import LocalEmbeddings
from .service import install
from .settings import SettingsUpdate


class Action(BaseModel):
    action: str = Field(max_length=30)


class AccessInput(BaseModel):
    password: str = Field(min_length=8, max_length=1000, repr=False)


class BackupInput(BaseModel):
    target: str = Field(default="", max_length=1000)
    password: str | None = Field(default=None, max_length=1000, repr=False)


class SnapshotInput(BaseModel):
    snapshot: str = Field(pattern=r"^[0-9a-f]{8,64}$")


class MemoryArguments(BaseModel):
    projectId: str = Field(min_length=1, max_length=100)
    query: str = Field(default="", max_length=20000)
    chatId: str = Field(default='',max_length=150)
    turnId: str = Field(default='',max_length=150)
    offset: int = Field(default=0,ge=0,le=100000000)
    limit: int = Field(default=20000,ge=1,le=20000)
    path: str = Field(default="", max_length=1000)
    text: str = Field(default="", max_length=1000000)
    version: str | None = Field(default=None, max_length=128)


class MemoryTool(BaseModel):
    name: str = Field(max_length=50)
    arguments: MemoryArguments


def routes(operations, queue):
    router = APIRouter()
    o = operations

    @router.get("/api/system/mcp")
    async def mcp_config():
        return {"mcpServers": {"shared_memory": {"command": sys.executable, "args": [str(o.config.root / "core/mcp.py"), "--port", str(o.config.port), "--data", str(o.config.data)]}}}

    @router.post("/internal/memory/tool")
    @router.post("/api/memory/tool")
    async def memory_tool(b: MemoryTool):
        a = b.arguments
        o.memory.project_prefix(a.projectId)
        if b.name == "memory_original":
            return await asyncio.to_thread(o.memory.original,a.chatId,a.turnId,a.projectId,a.offset,a.limit)
        if b.name == "memory_search":
            return {"results": await asyncio.to_thread(o.knowledge.search, a.query[:500], a.projectId, 20)}
        if b.name == "memory_context":
            return await asyncio.to_thread(o.memory.context, a.query, a.projectId)
        if b.name == "memory_write":
            return await asyncio.to_thread(o.memory.save, a.path, a.text, a.version, a.projectId)
        if b.name == "memory_read":
            note = await asyncio.to_thread(o.knowledge.read, a.path)
            if note["projectId"] != a.projectId:
                raise ValueError("Notiz gehört zu einem anderen Projekt.")
            return note
        raise ValueError("Unbekanntes Memory-Werkzeug.")

    @router.get("/api/system/source-work")
    async def source_work_status():
        from .source_work import SourceWork
        return SourceWork(o.config.data).status()

    @router.get("/api/system/status")
    async def status():
        return await asyncio.to_thread(o.status)

    @router.get("/api/system/settings")
    async def settings():
        return o.settings.read()

    @router.post("/api/system/settings")
    async def save_settings(update: SettingsUpdate):
        result = o.settings.save(update)
        o.update_monitor()
        return result

    @router.post("/api/system/service")
    async def service(b: Action):
        if b.action != "install":
            raise ValueError("Unbekannte Dienstaktion.")
        return await asyncio.to_thread(install, o.config)

    @router.post("/api/system/access")
    async def access(b: AccessInput):
        return await asyncio.to_thread(o.configure_access, b.password)

    @router.get("/api/system/tailscale")
    async def tailscale():
        return await asyncio.to_thread(o.tailscale, True)

    @router.post("/api/system/tailscale")
    async def configure_tailscale(b: Action):
        if b.action != "serve":
            raise ValueError("Unbekannte Netzwerkaktion.")
        return await asyncio.to_thread(o.enable_serve)

    @router.post("/api/system/setup")
    async def setup(b: Action):
        if b.action == "backup":
            from .setup import install_restic
            return {"path": await asyncio.to_thread(install_restic, o.config.data)}
        if b.action == "embeddings":
            from .models import install_model
            try:
                await asyncio.to_thread(install_model, o.config.data / "models/embeddings")
            except ImportError:
                raise ValueError("Die lokale Suchlaufzeit fehlt. Den mitgelieferten Systeminstaller ausführen.")
            o.config.embedding_model = str(o.config.data / "models/embeddings")
            def activate_search():
                with o.knowledge.lock:
                    o.knowledge.embeddings = LocalEmbeddings(o.config)
                    result = o.run("index")
                    if not result["embeddingIndex"].get("ready"):
                        raise ValueError(result["embeddingIndex"].get("error") or "Lokale Suche ist noch nicht einsatzbereit.")
                    return result
            return await asyncio.to_thread(activate_search)
        if b.action == "test-embeddings":
            vectors = await asyncio.to_thread(o.knowledge.embeddings.encode, ["Die Solaranlage erzeugt Strom.", "Photovoltaik liefert Energie."])
            if not vectors:
                raise ValueError("Lokale Suche ist noch nicht einsatzbereit.")
            return {"ok": True, "dimensions": len(vectors[0]), "localOnly": True}
        raise ValueError("Unbekannte Einrichtung.")

    @router.post("/api/system/backup/setup")
    async def backup_setup(b: BackupInput):
        target = b.target or str(o.config.data.parent / "backups")
        return await asyncio.to_thread(o.backups.configure, target, b.password)

    @router.get("/api/system/backups")
    async def backups():
        return {"snapshots": await asyncio.to_thread(o.backups.snapshots)}

    @router.post("/api/system/backups/restore")
    async def stage_restore(b: SnapshotInput):
        return await asyncio.to_thread(o.backups.stage_restore, b.snapshot)

    async def restart(record=None, resume=False):
        runtime = o.runtime
        async with runtime.maintenance_lock:
            previous = getattr(runtime, "_frozen", runtime.frozen)
            runtime.frozen = True
            pending = o.config.data / 'restore-pending.json'
            marker = o.config.data / 'restart.json'
            hold = o.config.data / 'restore-hold.json'
            old_hold = hold.read_text() if resume and hold.exists() else None
            staged = marked = adapter_held = False
            try:
                if runtime.active_writes > 1 or await runtime.has_active_work():
                    raise ValueError("Bitte laufende Aufträge und Gespräche vor dem Neustart beenden.")
                if runtime.config.start_adapter:
                    adapter_held = True
                    try:
                        await runtime.request('POST','/api/system/backup-hold',json={'hold':True})
                    except RuntimeError as error:
                        # An adapter refusal is an expected conflict, not an HTTP 500.
                        # Keep the existing rollback/release path and JSON error contract.
                        raise ValueError(str(error)) from None
                if record:
                    from .backups import verify_apply
                    await asyncio.to_thread(verify_apply, record['path'], o.config)
                    if pending.exists():
                        raise ValueError('Eine Wiederherstellung ist bereits vorgemerkt.')
                    atomic_write(pending, json.dumps(record))
                    staged = True
                atomic_write(marker, '{"requested":true}')
                marked = True
                if resume:
                    if old_hold is None:
                        raise ValueError('Keine Wiederherstellung wartet auf Prüfung.')
                    hold.unlink()
                async def stop():
                    await asyncio.sleep(0.5)
                    if runtime.shutdown:
                        runtime.shutdown()
                    else:
                        os.kill(os.getpid(), signal.SIGTERM)
                asyncio.create_task(stop())
                return {"ok": True, "restarting": True}
            except BaseException:
                if staged: pending.unlink(missing_ok=True)
                if marked: marker.unlink(missing_ok=True)
                if old_hold is not None: atomic_write(hold,old_hold)
                sync_directory(o.config.data)
                if adapter_held:
                    try:
                        await runtime.request('POST','/api/system/backup-hold',json={'hold':False})
                    except Exception:
                        # A lost release acknowledgement keeps this core paused.
                        raise ValueError('Wartungspause konnte nicht aufgehoben werden. Anschluss prüfen.') from None
                runtime.frozen = previous
                raise

    @router.post("/api/system/restart")
    async def restart_system():
        return await restart()

    @router.post("/internal/restart")
    async def restart_from_adapter():
        if o.runtime.python_processes or o.runtime.maintenance_tasks:
            raise ValueError("Bitte laufende Python- oder Wartungsaufträge zuerst beenden.")
        o.runtime.adapter_active = 0
        return await restart()

    @router.post("/api/system/backups/resume")
    async def resume_restore():
        return await restart(resume=True)

    @router.post("/api/system/backups/apply")
    async def apply_restore(request: Request):
        b = await request.json()
        record = o.db.get("backup/restore/" + str(b.get("id", "")))["value"]
        if not record or not record["verified"]:
            raise ValueError("Zuerst eine Sicherung wiederherstellen und prüfen.")
        return await restart(record)

    @router.post("/api/memory/capture")
    async def capture(request: Request):
        b = await request.json()
        return await asyncio.to_thread(o.memory.flush, b.get("backfill") is True)

    @router.post('/api/memory/compact')
    async def compact(request: Request):
        b=await request.json()
        return await asyncio.to_thread(o.memory.continuation,str(b.get('chatId','')))

    @router.post("/api/memory/forget")
    async def forget(request: Request):
        b = await request.json()
        return await asyncio.to_thread(o.memory.forget_chat, str(b.get("chatId", "")))

    @router.post("/api/memory/restore")
    async def restore_memory(request: Request):
        b = await request.json()
        return await asyncio.to_thread(o.memory.restore, b.get("revision", ""), b.get("path", ""), b.get("version"), b.get("projectId", "default"))

    @router.get("/api/core/executions/{id}")
    async def execution(id: str):
        run = queue.get(id)
        file = o.config.data / "job-logs" / (id + ".log")
        return {"run": {**run, "result": json.loads(run["result"] or "{}")}, "log": file.read_text()[-64000:] if file.is_file() else ""}

    @router.post("/api/core/executions/{id}/cancel")
    async def cancel(id: str):
        return await o.runtime.cancel(id)

    return router
