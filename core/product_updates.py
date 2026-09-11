"""Durable update coordinator; approval is bound to exact source and inventory."""
from __future__ import annotations

import asyncio
import json
import secrets
import subprocess
from time import time
from uuid import uuid4

from .releases import Releases, compatibility
from .update_source import Source, digest, git


class Updates:
    def __init__(self, db, config, runtime, github, contributions):
        self.db, self.config, self.runtime = db, config, runtime
        self.github, self.contributions = github, contributions
        self.releases = Releases(github)
        self.lock = asyncio.Lock()
        self.tasks = set()

    def settings(self):
        return self.db.get("updates/settings")["value"] or {"revision": 0, "automatic": True, "notifications": True, "worker": "", "model": "", "budgetMinutes": 30}

    def state(self):
        return self.db.get("updates/state")["value"] or {"checkedAt": None, "nextCheck": 0, "release": None, "installed": None, "error": "", "current": None}

    def save(self, **changes):
        value = {**self.state(), **changes}
        self.db.put("updates/state", value)
        self.db.event("update.changed", "updates", {})
        return value

    def status(self):
        value = self.state()
        current = self.db.get("updates/run/" + value["current"])["value"] if value["current"] else None
        if current and current["state"] == "installing":
            from .files import read_json
            operator = read_json(self.config.data / "updates" / current["id"] / "operator-state.json", {})
            if operator.get("phase") == "recovery-required":
                current = {**current, "state": "recovery-required", "error": operator.get("error", "Betriebszustand benötigt Wiederherstellung.")}
        installed = value["installed"]
        release = value["release"]
        available = bool(release and (not installed or tuple(map(int, release["manifest"]["version"].split("."))) > tuple(map(int, installed["version"].split(".")))))
        return {**value, "settings": self.settings(), "run": current, "available": available,
                "checking": bool(self.db.rows("SELECT id FROM executions WHERE job_id='system-update-check' AND status IN ('queued','dispatching','running')")),
                "role": self.contributions.settings()["role"], "github": self.github.status(),
                "source": "https://github.com/DenzerAI/Vanilla/blob/main/UPDATE.md"}

    def configure(self, values, revision):
        current = self.settings()
        if current["revision"] != revision:
            raise ValueError("Updateeinstellungen wurden inzwischen geändert. Erneut laden.")
        self.db.put("updates/settings", {**current, **values, "revision": revision + 1})
        return self.status()

    def notice(self, key, title, body, status="completed", kind="update", subject=None):
        if self.settings()["notifications"]:
            self.runtime.notifications.system("vanilla-" + key, kind, subject or key, title, body, status)

    def schedule(self):
        if self.settings()["automatic"] and self.state()["nextCheck"] <= time():
            return self.runtime.queue.enqueue("system-update-check", "vanilla-release-check:" + str(int(self.state()["nextCheck"])))

    async def check(self):
        async with self.lock:
            try:
                release = await self.releases.latest()
                previous = self.state()["release"]
                if release:
                    key = "updates/release-seen/" + str(release["manifest"]["releaseId"])
                    known = self.db.get(key)["value"]
                    if known and known != release["digest"]:
                        raise ValueError("Eine bekannte Versionsdatei wurde verändert. Veröffentlichung klären.")
                    self.db.put(key, release["digest"])
                if release and previous and release["manifest"]["releaseId"] == previous["manifest"]["releaseId"] and release["digest"] != previous["digest"]:
                    raise ValueError("Eine bereits bekannte Versionsdatei wurde nachträglich verändert. Freigabe klären.")
                self.save(release=release, checkedAt=time(), nextCheck=time() + 86400 + secrets.randbelow(1801), error="")
                current = self.status()["run"]
                if current and current["state"] == "ready" and current["release"] != release:
                    self.journal(current, state="needs-review", approval=None, error="Die Releasefreigabe wurde verändert oder zurückgezogen. Erneut vorbereiten.")
                if release and self.status()["available"]:
                    m = release["manifest"]
                    self.notice("release-" + str(m["releaseId"]), "Update verfügbar", m["version"] + " · " + m["summary"])
                if self.contributions.settings()["role"] == "origin" and self.github.status()["connected"]:
                    try:
                        for item in await self.contributions.inbox():
                            self.notice(item["id"], "Neuer Beitrag", item["repository"]["name"], kind="contribution", subject=item["id"])
                    except ValueError:
                        self.db.put("contributions/check", {"checkedAt": time(), "error": "Beitragseingang konnte nicht geprüft werden. GitHub-Verbindung prüfen."})
            except Exception as error:
                message = str(error) if isinstance(error, ValueError) else "Updatequelle konnte nicht vollständig geprüft werden. Später erneut versuchen."
                self.save(error=message, nextCheck=time() + max(3600, getattr(error, "retry_after", 0)) + secrets.randbelow(600))
            return self.status()

    def journal(self, run, **changes):
        stored = self.db.get("updates/run/" + run["id"])["value"]
        if stored:
            run = stored
        run = {**run, **changes, "revision": run.get("revision", 0) + 1, "updatedAt": time()}
        self.db.put("updates/run/" + run["id"], run)
        self.db.event("update.changed", run["id"], {})
        return run

    async def prepare(self, release_id, key):
        async with self.lock:
            known = self.db.get("updates/request/" + key)["value"]
            if known:
                return self.db.get("updates/run/" + known)["value"]
            current = self.status()["run"]
            if current and current["state"] in {"preparing", "ready", "installing"}:
                return current
            if current:
                from .update_sandbox import cleanup
                await asyncio.to_thread(cleanup, self.config.data / "updates" / current["id"])
            release = self.state()["release"]
            if not release or release["manifest"]["releaseId"] != release_id or not self.status()["available"] or self.state()["error"]:
                raise ValueError("Zuerst die aktuell freigegebene Version prüfen.")
            settings = self.settings()
            if not settings["worker"] or not settings["model"] or not self.config.start_adapter:
                raise ValueError("Zuerst unter Updates ein verfügbares Modell für die Agentenprüfung auswählen.")
            run = self.journal({"id": uuid4().hex, "createdAt": time(), "state": "preparing", "phase": "Bestand prüfen", "release": release,
                                "worker": settings["worker"], "model": settings["model"], "budgetMinutes": settings["budgetMinutes"], "checks": [], "approval": None, "error": ""})
            self.db.put("updates/request/" + key, run["id"])
            self.save(current=run["id"])
            task = asyncio.create_task(self.prepare_run(run))
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
            return run

    async def prepare_run(self, run):
        try:
            m = run["release"]["manifest"]
            fresh = await self.releases.latest()
            if fresh != run["release"]:
                raise ValueError("Die Releasefreigabe hat sich verändert. Erneut prüfen.")
            try:
                node = int((await asyncio.to_thread(subprocess.check_output, ["node", "--version"], timeout=5)).decode().lstrip("v").split(".")[0])
            except (OSError, ValueError, subprocess.SubprocessError):
                raise ValueError("Die benötigte Node-Laufzeit ist nicht prüfbar.") from None
            issue = compatibility(m, (self.state()["installed"] or {}).get("version"), node)
            if issue:
                raise ValueError(issue)
            from .update_operator import validate_host
            await asyncio.to_thread(validate_host, self.config)
            from .update_sandbox import environment
            await asyncio.to_thread(environment, self.config)
            models = await self.runtime.request("GET", "/api/system/update-review/models")
            if not any(model["worker"] == run["worker"] and model["model"] == run["model"] for model in models.get("models", [])):
                raise ValueError("Das gewählte Prüfmodell ist nicht verfügbar. Unter Updates neu auswählen.")
            source = Source(self.config)
            snapshot = await asyncio.to_thread(source.read)
            inventory = await asyncio.to_thread(source.inventory, self.db)
            run = self.journal(run, sourceCommit=snapshot["head"], sourceHash=snapshot["hash"], inventory=inventory)
            role = self.contributions.settings()["role"]
            if role == "customer":
                run = self.journal(run, phase="Eigenen Code bereitstellen")
                receipt = await self.contributions.share()
                if receipt["sourceHash"] != snapshot["hash"]:
                    raise ValueError("Der Code wurde während der Bereitstellung geändert. Vorbereitung erneut starten.")
                run = self.journal(run, contribution={"id": receipt["id"], "commit": receipt["commit"], "sourceHash": receipt["sourceHash"]})
            else:
                async with self.github.oauth_lock:
                    if (await self.github.check(write=True))["name"] != "DenzerAI/Vanilla":
                        raise ValueError("Die Ursprungsrechte sind nicht bestätigt.")
            run = self.journal(run, phase="Code zusammenführen")
            directory = self.config.data / "updates" / run["id"] / "candidate"
            candidate = await asyncio.to_thread(source.candidate, snapshot, m["commit"], directory)
            run = self.journal(run, candidate=candidate, phase="Agent und Prüfungen vorbereiten")
            from .update_checks import Preparation
            result = await Preparation(self.config, self.runtime).run(directory, run, {k: run[k] for k in ("worker", "model", "budgetMinutes")})
            if (await asyncio.to_thread(source.read))["hash"] != snapshot["hash"] or source.inventory(self.db)["hash"] != inventory["hash"]:
                raise ValueError("Eigener Code oder Auftragskonfiguration wurde zwischenzeitlich geändert. Erneut vorbereiten.")
            run = self.journal(run, **result, state="ready", phase="Bereit")
            self.notice("ready-" + run["id"], "Update bereit", "Eigener Code und Aufträge sind abgeglichen. Die geprüfte Version kann jetzt freigegeben werden.", subject=run["id"])
        except asyncio.CancelledError:
            self.journal(run, state="needs-review", phase="Unterbrochen", error="Vorbereitung unterbrochen. Bestand erneut prüfen; nichts wurde installiert.")
            raise
        except Exception as error:
            # Only controlled error messages leave the runner; no subprocess/provider output.
            message = str(error) if isinstance(error, ValueError) else "Die Vorbereitung konnte nicht abgeschlossen werden. Lokalen Prüfbedarf klären."
            self.journal(run, state="needs-review", phase="Klärung nötig", error=message[:1000],
                         **({"review": error.review["report"], "effort": error.review["effort"]} if hasattr(error, "review") else {}))
            self.notice("review-" + run["id"], "Update braucht Klärung", message[:1000], "failed", subject=run["id"])

    async def cancel(self, id, revision):
        async with self.lock:
            run = self.status()["run"]
            if not run or run["id"] != id or run["revision"] != revision or run["state"] == "installing":
                raise ValueError("Updateauftrag wurde geändert oder wird bereits installiert.")
            if self.config.start_adapter:
                await self.runtime.request("POST", "/api/system/update-review/cancel", json={"id": id})
            for task in list(self.tasks):
                task.cancel()
            await asyncio.gather(*self.tasks, return_exceptions=True)
            return self.journal(run, state="cancelled", phase="Abgebrochen", approval=None)

    async def install(self, id, revision):
        async with self.lock:
            run = self.status()["run"]
            if not run or run["id"] != id or run["revision"] != revision or run["state"] != "ready":
                raise ValueError("Die Freigabe gehört nicht zum aktuellen geprüften Updateauftrag.")
            from .update_checks import Preparation
            return await Preparation(self.config, self.runtime).install(run, self)

    def recover(self):
        run = self.status()["run"]
        if run and run["state"] == "preparing":
            from .update_sandbox import cleanup
            try:
                cleanup(self.config.data / "updates" / run["id"])
            except Exception:
                self.journal(run, state="needs-review", error="Vorbereitung unterbrochen. Prüfcontainer noch nicht bestätigt beendet; lokale Engine prüfen.")
            else:
                self.journal(run, state="needs-review", error="Vorbereitung durch Neustart unterbrochen. Bestand erneut prüfen; keine Aktion wird blind wiederholt.")
        for row in self.db.rows("SELECT key,value FROM records WHERE key LIKE 'contributions/item/%'"):
            item = json.loads(row["value"])
            if item.get("state") == "reviewing":
                self.contributions.save(item, state="needs-review", error="Agentenprüfung durch Neustart unterbrochen. Erneut prüfen.")

    async def close(self):
        run = self.status()["run"]
        if run and run["state"] == "preparing" and self.config.start_adapter:
            try:
                await self.runtime.request("POST", "/api/system/update-review/cancel", json={"id": run["id"]})
            except Exception:
                pass  # Shutdown still cancels the local task; provider budget remains bounded.
        for task in self.tasks:
            task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)
