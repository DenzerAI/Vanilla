from __future__ import annotations

import asyncio
import json
import os
import signal
import sys
from pathlib import Path
from time import time

import httpx

from .files import atomic_write
from .storage import safe_path
from .streaming import StreamHub


class Runtime:
    """One local scheduler, supervised adapter and bounded Python job processes."""

    def __init__(self, config, queue, knowledge, operations=None):
        self.config, self.queue, self.knowledge, self.operations = config, queue, knowledge, operations
        self.process = None
        self.tasks = []
        self.running = {}
        self.python_processes = {}
        self.maintenance_tasks = set()
        self.error = None
        self.last_schedule = 0
        self.last_adapter_check = 0
        self.adapter_active = 0
        self.next_restart = 0
        self.restart_delay = 5
        self.stopping = False
        self.frozen = False
        self.maintenance_lock = asyncio.Lock()
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(60, connect=3), trust_env=False)
        self.stream = StreamHub(self, queue.db)
        if operations:
            operations.runtime = self

    @property
    def headers(self):
        return {"x-agent-internal": self.config.adapter_token, "x-uwe-token": self.config.adapter_token}

    async def request(self, method, path, **kwargs):
        response = await self.client.request(method, self.config.adapter_url + path, headers=self.headers, **kwargs)
        if response.is_error:
            try:
                message = response.json().get("error", "Worker-Anschluss nicht verfügbar.")
            except ValueError:
                message = "Worker-Anschluss nicht verfügbar."
            raise RuntimeError(message)
        return response.json()

    async def has_active_work(self):
        if any(not t.done() for t in self.running.values()) or any(not t.done() for t in self.maintenance_tasks):
            return True
        if self.config.start_adapter:
            status = await self.request("GET", "/api/updates", timeout=5)
            self.adapter_active = status.get("activeCount", 0)
        return bool(self.adapter_active or self.queue.db.rows("SELECT id FROM executions WHERE status IN ('dispatching','running')"))

    async def spawn_adapter(self):
        env = {**os.environ, "UWE_PORT": str(self.config.adapter_port), "UWE_WORKSPACE": str(self.config.workspace), "UWE_DATA_ROOT": str(self.config.data), "AGENT_CORE_URL": f"http://127.0.0.1:{self.config.port}", "AGENT_INTERNAL_TOKEN": self.config.adapter_token, "AGENT_PYTHON": sys.executable}
        if self.config.layout:
            env.update(VANILLA_LAYOUT='2', VANILLA_ROOT=str(self.config.root))
        self.process = await asyncio.create_subprocess_exec("node", str(self.config.source / "wrapper/server.mjs"), cwd=self.config.source, env=env)
        self.last_adapter_check = 0

    async def start(self):
        if self.config.start_adapter:
            await self.spawn_adapter()
        await self.stream.start()
        if self.operations:
            self.operations.update_monitor()
        self.tasks = [asyncio.create_task(self.run_jobs()), asyncio.create_task(self.index_files()), asyncio.create_task(self.maintain())]

    async def supervise(self):
        if not self.config.start_adapter:
            return
        if self.process and self.process.returncode is not None:
            self.error = "Worker-Anschluss beendet; Wiederanlauf wird geprüft."
            if time() >= self.next_restart and self.operations and self.operations.settings.values["system"]["auto_restart"]:
                for row in self.queue.db.rows("SELECT id FROM executions WHERE status IN ('dispatching','running') AND thread_id IS NOT NULL"):
                    self.queue.finish(row["id"], "interrupted", error="Worker-Anschluss wurde beendet. Externe Ergebnisse vor erneutem Start prüfen.")
                await self.spawn_adapter()
                self.next_restart = time() + self.restart_delay
                self.restart_delay = min(300, self.restart_delay * 2)
        if self.process and self.process.returncode is None and time() - self.last_adapter_check > 15:
            try:
                status = await self.request("GET", "/api/updates", timeout=5)
                self.adapter_active = status.get("activeCount", 0)
                self.last_adapter_check = time()
                self.error = None
                self.restart_delay = 5
            except Exception:
                self.error = "Worker-Anschluss ist noch nicht erreichbar."

    async def run_jobs(self):
        while True:
            try:
                await self.supervise()
                await asyncio.to_thread(self.queue.schedule)
                self.last_schedule = time()
                limit = self.operations.settings.values["system"]["parallel_jobs"] if self.operations else 1
                self.running = {id: task for id, task in self.running.items() if not task.done()}
                active = self.queue.db.rows("SELECT id FROM executions WHERE status IN ('dispatching','running')")
                if len(active) < limit and not self.stopping and not self.frozen:
                    run = self.queue.claim()
                    if run:
                        self.running[run["id"]] = asyncio.create_task(self.execute(run))
                for row in active:
                    if row["id"] in self.running or not self.error:
                        self.queue.renew(row["id"])
                active_now = self.queue.db.rows("SELECT count(*) n FROM executions WHERE status IN ('dispatching','running')")[0]['n']
                atomic_write(self.config.data / "runtime.json", json.dumps({"pid": os.getpid(), "checked_at": time(), "active": max(active_now, self.adapter_active)}))
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self.error = str(error)[:200]
            await asyncio.sleep(3)

    async def execute(self, run):
        try:
            job = self.queue.storage.job(run["job_id"])
            if job.get("worker") == "python":
                self.queue.dispatched(run["id"], {"runId": run["id"]})
                handler = job.get("python", {}).get("handler", "script")
                if handler == "script":
                    result = await self.execute_script(job, run)
                else:
                    async with self.maintenance_lock:
                        if handler == "backup":
                            self.frozen = True
                            if self.config.start_adapter:
                                current = await self.request("GET", "/api/updates", timeout=5)
                                self.adapter_active = current.get("activeCount", 0)
                            others = self.queue.db.rows("SELECT id FROM executions WHERE status IN ('dispatching','running') AND id<>?", (run["id"],))
                            if self.adapter_active or others:
                                self.queue.defer(run["id"], 60)
                                return
                        task = asyncio.create_task(asyncio.to_thread(self.operations.run, handler))
                        self.maintenance_tasks.add(task)
                        try:
                            result = await asyncio.shield(task)
                        finally:
                            if task.done():
                                self.maintenance_tasks.discard(task)
                self.queue.finish(run["id"], "completed", result)
            else:
                if not self.config.start_adapter:
                    raise ValueError("Worker-Anschluss ist ausgeschaltet. Python-Aufträge bleiben verfügbar.")
                result = await self.request("POST", "/api/jobs/run", json={"id": run["job_id"], "coreRunId": run["id"]})
                self.queue.dispatched(run["id"], result)
                if "threadId" not in result:
                    self.queue.finish(run["id"], "completed", result)
        except asyncio.CancelledError:
            self.queue.finish(run["id"], "interrupted", error="Ausführung wurde unterbrochen.")
            raise
        except Exception as error:
            self.queue.finish(run["id"], "failed", error=str(error)[:500])
            try:
                self.queue.retry(run["id"])
            except (ValueError, TypeError):
                pass
        finally:
            if 'handler' in locals() and handler == "backup":
                self.frozen = False

    async def stop_process(self, process):
        if process.returncode is not None:
            return
        try:
            os.killpg(process.pid, signal.SIGTERM)
            await asyncio.wait_for(process.wait(), 5)
        except TimeoutError:
            os.killpg(process.pid, signal.SIGKILL)
            await process.wait()
        except ProcessLookupError:
            pass

    async def execute_script(self, job, run):
        options = job.get("python", {})
        folder = safe_path(self.config.workspace, job.get('path') or "jobs/" + job["id"])
        script = safe_path(folder, options.get("script", "script.py"))
        if script.suffix != ".py":
            raise ValueError("Python-Aufträge benötigen eine .py-Datei im Auftragsordner.")
        output = folder / "output" / run["id"]
        output.mkdir(parents=True, exist_ok=True, mode=0o700)
        inputs = {"runId": run["id"], "jobId": job["id"], "input": options.get("input", {}), "output": str(output)}
        atomic_write(output / "request.json", json.dumps(inputs, ensure_ascii=False))
        env = {k: os.environ[k] for k in ("PATH", "HOME", "LANG", "TMPDIR") if k in os.environ}
        env.update({"PYTHONUNBUFFERED": "1", "TZ": self.config.timezone})
        process = await asyncio.create_subprocess_exec(sys.executable, "-I", str(script), cwd=folder, env=env, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, start_new_session=True)
        self.python_processes[run["id"]] = process
        async def bounded(reader):
            data = bytearray()
            while chunk := await reader.read(8192):
                if len(data) + len(chunk) > 1024 * 1024:
                    raise ValueError("Python-Ausgabe überschreitet 1 MiB. Große Ergebnisse bitte als Datei speichern.")
                data.extend(chunk)
            return data.decode("utf-8", errors="replace")
        try:
            process.stdin.write(json.dumps(inputs).encode())
            await process.stdin.drain()
            process.stdin.close()
            async with asyncio.timeout(int(options.get("timeout", 300))):
                stdout, stderr, code = await asyncio.gather(bounded(process.stdout), bounded(process.stderr), process.wait())
            log = self.config.data / "job-logs" / (run["id"] + ".log")
            atomic_write(log, (stdout + "\n" + stderr)[-1024 * 1024:])
            if code:
                raise ValueError(f"Python-Auftrag mit Exit-Code {code} beendet. Laufprotokoll öffnen.")
            try:
                result = json.loads(stdout) if stdout.strip() else {}
            except ValueError:
                result = {"text": stdout[:16000]}
            payload = {"exitCode": code, "output": str(output.relative_to(self.config.workspace)), "result": result}
            atomic_write(output / "result.json", json.dumps(payload, ensure_ascii=False))
            return payload
        except TimeoutError:
            raise ValueError("Zeitlimit des Python-Auftrags erreicht.")
        finally:
            await self.stop_process(process)
            self.python_processes.pop(run["id"], None)

    async def cancel(self, id):
        run = self.queue.get(id)
        if run["status"] == "queued":
            return self.queue.finish(id, "cancelled")
        if id in self.python_processes:
            await self.stop_process(self.python_processes[id])
            self.running[id].cancel()
            await asyncio.gather(self.running[id], return_exceptions=True)
            return self.queue.get(id)
        if run["thread_id"]:
            await self.request("POST", "/api/stop", json={"id": run["thread_id"]})
            return {"status": "stopping"}
        if id in self.running:
            raise ValueError("Dieser Wartungsschritt wird sicher zu Ende geführt. Der nächste Start kann pausiert werden.")
        return self.queue.get(id)

    async def index_files(self):
        while True:
            try:
                await asyncio.to_thread(self.knowledge.scan)
                if self.knowledge.embeddings.path:
                    await asyncio.to_thread(self.knowledge.embed)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                self.queue.db.event("index.error", None, {"error": str(error)[:200]})
            await asyncio.sleep(30)

    async def maintain(self):
        while True:
            try:
                if self.operations:
                    await asyncio.to_thread(self.operations.memory.flush)
                    if self.config.public_origin:
                        await asyncio.to_thread(self.operations.tailscale)
                    monitor = read_monitor = self.config.data / "heartbeat.json"
                    if monitor.exists() and self.operations.settings.values['system']['heartbeat']:
                        state = json.loads(read_monitor.read_text())
                        self.operations.record("heartbeat", "ok" if state.get("ok") and time() - state.get("checked_at", 0) < 150 else "error", {"checked_at": state.get("checked_at"), "checks": state.get("checks", {})})
            except asyncio.CancelledError:
                raise
            except Exception as error:
                if self.operations:
                    self.operations.record("memory-capture", "error", {"message": str(error)[:200]})
            await asyncio.sleep(10)

    async def close(self):
        self.stopping = True
        for task in [*self.tasks, *self.running.values()]:
            task.cancel()
        await asyncio.gather(*self.tasks, *self.running.values(), return_exceptions=True)
        if self.maintenance_tasks:
            await asyncio.gather(*self.maintenance_tasks, return_exceptions=True)
        await self.stream.close()
        if self.process and self.process.returncode is None:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), 10)
            except TimeoutError:
                self.process.kill()
                await self.process.wait()
        await self.client.aclose()
