"""Fixed technical gates. Untrusted candidates run without production access."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import signal
from pathlib import Path
from time import time

from .update_source import Source, digest, git
from .update_sandbox import INPUTS

DEPENDENCIES = INPUTS


class ReviewRequired(ValueError):
    def __init__(self, review):
        super().__init__("Die Agentenprüfung meldet Anpassungsbedarf. Bericht in den Updatedetails prüfen.")
        self.review = review


async def execute(directory, command, name, seconds=600, *, container):
    env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": "/tmp/vanilla-home",
           "TMPDIR": "/tmp/vanilla-tests", "LANG": "C.UTF-8", "PYTHONPATH": str(directory),
           "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0"}
    env.update(AGENT_REQUIRE_RESTIC="1", AGENT_TEST_RESTIC=str(directory / ".verify/bin/restic"))
    from . import update_sandbox
    argv = update_sandbox.command(container, directory, command, env)
    try:
        process = await asyncio.create_subprocess_exec(*argv, cwd=directory, env=update_sandbox.host_env(), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
    except OSError:
        raise ValueError("Die isolierte Prüfung konnte nicht gestartet werden.") from None
    collected = bytearray()
    async def consume():
        while chunk := await process.stdout.read(65536):
            collected.extend(chunk)
            if len(collected) > 4_000_000:
                raise ValueError("Eine Prüfung überschreitet die erlaubte Ausgabemenge.")
        await process.wait()
    started = time()
    try:
        await asyncio.wait_for(consume(), seconds)
    except BaseException:
        if process.returncode is None:
            os.killpg(process.pid, signal.SIGKILL)
            await process.wait()
        raise
    # Keep only a receipt, never pass arbitrary executable output to a provider or UI.
    log = directory.parent / "checks" / (hashlib.sha256(name.encode()).hexdigest()[:16] + ".log")
    log.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with log.open("wb") as stream:
        os.chmod(log, 0o600)
        stream.write(collected)
    receipt = {"name": name, "ok": process.returncode == 0, "seconds": round(time() - started, 2), "outputHash": hashlib.sha256(collected).hexdigest()}
    if not receipt["ok"]:
        raise ValueError(name + " fehlgeschlagen. Kandidat bleibt zur lokalen Klärung erhalten.")
    return receipt


class Preparation:
    def __init__(self, config, runtime):
        self.config, self.runtime = config, runtime

    async def run(self, directory, run, settings):
        checks = await self.technical(directory, run)
        # The agent receives the complete diff or the task stops before any provider call.
        diff = await asyncio.to_thread(git, directory, "diff", "--no-ext-diff", "--no-textconv", run["candidate"]["sourceCommit"], run["candidate"]["commit"])
        if len(diff) > 350000:
            raise ValueError("Der vollständige Codevergleich überschreitet das Agentenbudget. In kleinere Updates aufteilen.")
        if not settings["worker"] or not settings["model"]:
            raise ValueError("Unter Updates ein Modell für die Agentenprüfung auswählen.")
        review = await self.runtime.request("POST", "/api/system/update-review/run", json={"id": run["id"], "worker": settings["worker"], "model": settings["model"],
            "budgetSeconds": settings["budgetMinutes"] * 60, "text": "Prüfe diesen vollständigen Codevergleich auf Kompatibilität, erhaltene eigene Module und notwendige Anpassungen. Die festen Tests sind unabhängig erfolgreich durchgelaufen.\n" + diff.decode()}, timeout=settings["budgetMinutes"] * 60 + 60)
        if review["report"]["needsChanges"] or review["report"]["issues"]:
            raise ReviewRequired(review)
        from .update_operator import validate_host, backup_probe
        host = await asyncio.to_thread(validate_host, self.config)
        backup = await asyncio.to_thread(backup_probe, self.config, directory.parent / "restore-check", self.runtime.queue.db)
        # Tests must not mutate the verified source after the merge.
        if git(directory, "diff", "--name-only", "HEAD") or git(directory, "diff", "--cached", "--name-only", "HEAD"):
            raise ValueError("Eine Prüfung hat den Kandidatencode verändert. Neue Prüfung erforderlich.")
        from .update_operator import tree_files
        candidate_hash = Source(self.config).candidate_source(directory, run["release"]["manifest"]["commit"]).read()["hash"]
        build_hash = digest(tree_files(directory / "wrapper/dist"))
        return {"checks": checks, "review": review["report"], "effort": review["effort"], "backup": backup, "host": host,
                "candidateHash": candidate_hash, "buildHash": build_hash,
                "approvalHash": digest({"candidate": run["candidate"], "source": run["sourceHash"], "inventory": run["inventory"]["hash"], "candidateHash": candidate_hash, "buildHash": build_hash, "checks": checks, "backup": backup, "host": host})}

    async def technical(self, directory, run):
        from . import update_sandbox
        container = await asyncio.to_thread(update_sandbox.environment, self.config)
        for name in update_sandbox.INPUTS:
            before, after = self.config.root / name, directory / name
            if not before.is_file() or not after.is_file() or before.read_bytes() != after.read_bytes():
                raise ValueError("Geänderte Laufzeitabhängigkeiten benötigen eine separat vorbereitete Prüfumgebung. Keine Installation begonnen.")
        source = Source(self.config)
        if run.get("release"):
            candidate_source = source.candidate_source(directory, run["release"]["manifest"]["commit"])
        else:
            candidate_source = Source(type("CandidateConfig", (), {"root": directory})(), trusted_root=self.config.root)
        snapshot = await asyncio.to_thread(candidate_source.read)
        inputs = directory.parent / "test-input"
        await asyncio.to_thread(source.save, snapshot, inputs)
        checks = []
        try:
            container = await asyncio.to_thread(update_sandbox.start, container, inputs, directory.parent)
            await execute(directory, ["/usr/local/bin/python", "-c", update_sandbox.INITIALIZE], "Prüfumgebung vorbereiten", container=container)
            python = str(directory / ".venv/bin/python")
            for name, command in [
                ("Lokale Firmenbasis", ["node", "scripts/init-company.mjs"]),
                ("Datenschutz", [python, "scripts/security-scan.py", "--index"]),
                ("Modulverträge", [python, "scripts/verify-modules.py"]),
                ("Oberfläche und Typen", ["npm", "run", "ui:prepare"]),
                ("Funktionen", ["npm", "test"]),
                ("Kernfunktionen", [python, "-m", "pytest", "-q"]),
                ("Oberflächenstand", ["npm", "run", "ui:verify"]),
            ]:
                if self.runtime.product_updates:
                    self.runtime.product_updates.journal(run, checks=list(checks), phase=name)
                checks.append(await execute(directory, command, name, container=container))
                await execute(directory, ["/usr/local/bin/python", "-c", update_sandbox.VERIFY_SOURCE], "Quellbestand unverändert", container=container)
            await update_sandbox.copy_build(container, directory / "wrapper/dist")
            # The isolated test Git repository has no customer history. Bind the
            # exported UI metadata back to the actual integration commit.
            metadata = directory / "wrapper/dist/version.json"
            manifest = json.loads(metadata.read_text())
            manifest.update(sourceRevision=git(directory, "rev-parse", "HEAD").decode().strip(), sourceDirty=False)
            metadata.write_text(json.dumps(manifest))
        finally:
            await asyncio.to_thread(update_sandbox.cleanup, directory.parent)
        return checks

    async def install(self, run, updates):
        from .update_operator import request_install
        if updates.contributions.lock.locked():
            raise ValueError("Ein Codeaustausch läuft noch. Nach dessen Abschluss erneut installieren.")
        source = Source(self.config)
        if (await asyncio.to_thread(source.read))["hash"] != run["sourceHash"] or source.inventory(self.runtime.queue.db)["hash"] != run["inventory"]["hash"]:
            updates.journal(run, state="needs-review", approval=None, error="Eigener Code oder Aufträge wurden geändert. Bitte erneut vorbereiten.")
            raise ValueError("Die geprüfte Ausgangslage ist nicht mehr aktuell.")
        if await updates.releases.latest() != run["release"]:
            raise ValueError("Die Veröffentlichung wurde verändert oder zurückgezogen. Erneut prüfen.")
        if updates.contributions.settings()["role"] == "customer":
            async with updates.github.oauth_lock:
                repo = await updates.contributions.authorize()
                receipt = updates.db.get("contributions/item/" + run["contribution"]["id"])["value"]
                ref = await updates.github.request("GET", f"/repositories/{repo['id']}/git/ref/{receipt['ref']}")
                if ref.get("object", {}).get("sha") != run["contribution"]["commit"]:
                    raise ValueError("Der bereitgestellte Codestand ist nicht mehr bestätigt.")
        else:
            async with updates.github.oauth_lock:
                if (await updates.github.check(write=True))["name"] != "DenzerAI/Vanilla":
                    raise ValueError("Die Ursprungsrechte sind nicht mehr bestätigt.")
        if await self.runtime.has_active_work():
            raise ValueError("Es läuft noch Arbeit. Nach deren Abschluss erneut installieren.")
        return await request_install(self.config, self.runtime, updates, run)
