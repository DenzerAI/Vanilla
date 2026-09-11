"""Local, opt-in source completion. Git owns source; this journal owns progress."""
from __future__ import annotations

from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

from .files import atomic_write


def environment():
    # Verification must not inherit a running installation or its provider secrets.
    return {k: v for k, v in os.environ.items() if k in
            {"PATH", "HOME", "TMPDIR", "TEMP", "SYSTEMROOT", "LANG", "LC_ALL"}}


def command(root, args, log=None, timeout=1800):
    result = subprocess.run(args, cwd=root, env=environment(), capture_output=True, timeout=timeout)
    if log:
        with Path(log).open("ab") as out:
            out.write(("\n$ " + args[0] + " " + args[1] + "\n").encode())
            out.write(result.stdout + result.stderr)
    if result.returncode:
        raise ValueError("Schritt fehlgeschlagen: " + args[0] + " " + args[1])
    return result.stdout.decode().strip()


def git(root, *args):
    return command(root, ["git", *args])


def tree_digest(root):
    names = git(root, "ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0")
    digest = hashlib.sha256()
    for name in sorted(set(filter(None, names))):
        p = root / name
        if p.is_symlink():
            raise ValueError("Symbolische Links gehören nicht in die Quellübergabe.")
        digest.update(name.encode() + b"\0")
        digest.update(p.read_bytes() if p.exists() else b"<deleted>")
    return digest.hexdigest()


class SourceWork:
    def __init__(self, data):
        self.directory = Path(data) / "source-work"
        self.file = self.directory / "state.json"

    @contextmanager
    def locked(self, blocking=True):
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (self.directory / "lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB))
            except BlockingIOError:
                yield None
                return
            state = json.loads(self.file.read_text()) if self.file.exists() else {"version": 1, "entries": []}
            if state.get("version") != 1:
                raise ValueError("Unbekannte Quellübergabe-Version.")
            yield state

    def save(self, state):
        atomic_write(self.file, json.dumps(state, ensure_ascii=False, indent=2))

    def status(self):
        if not self.file.exists():
            return {"enabled": False, "entries": []}
        # atomic_write makes a read safe while a long verification holds the writer lock.
        state = json.loads(self.file.read_text())
        result = {"enabled": bool(state.get("repository")), "entries": [
            {k: row[k] for k in ("id", "name", "status", "commit", "candidateCommit", "reason", "updatedAt") if k in row}
            for row in state["entries"]]}
        release = self.directory.parent / "source-release/state.json"
        if release.exists():
            data = json.loads(release.read_text())
            result["release"] = {"error": data.get("error"), "releases": [
                {k: row[k] for k in ("target", "phase", "activationPhase", "reason", "publishedAt") if k in row}
                for row in data.get("releases", [])]}
        return result

    def configure(self, repository, live_root):
        repository, live_root = Path(repository).resolve(), Path(live_root).resolve()
        if repository == live_root:
            raise ValueError("Der Integrationsordner muss von der laufenden App getrennt sein.")
        if Path(git(repository, "rev-parse", "--show-toplevel")) != repository:
            raise ValueError("Ein vollständiger Entwicklungsordner ist erforderlich.")
        if git(repository, "status", "--porcelain"):
            raise ValueError("Entwicklungsstand zuerst committen.")
        git(repository, "symbolic-ref", "--short", "HEAD")
        required = ["scripts/security-scan.py", "scripts/source-sync.py", "scripts/verify-modules.py", ".githooks/pre-commit"]
        if any(not (repository / p).is_file() for p in required):
            raise ValueError("Die gemeinsamen Quellprüfungen fehlen.")
        with self.locked() as state:
            if state.get("repository") and state["repository"] != str(repository):
                raise ValueError("Bestehende Quellübergabe nicht auf ein anderes Repository umstellen.")
            state.update(repository=str(repository), liveRoot=str(live_root))
            self.save(state)
        return self.status()

    def begin(self, name, session=""):
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,60}", name):
            raise ValueError("Kurzen Arbeitsnamen mit Kleinbuchstaben, Ziffern und Bindestrichen verwenden.")
        with self.locked() as state:
            repository = Path(state["repository"])
            if git(repository, "status", "--porcelain"):
                raise ValueError("Der gemeinsame Entwicklungsstand enthält offene Änderungen.")
            existing = next((x for x in state["entries"] if x["name"] == name and x["status"] == "working"), None)
            if existing:
                return existing
            identifier = uuid.uuid4().hex
            path = repository / ".verify" / "source-work" / identifier
            base = git(repository, "rev-parse", "HEAD")
            git(repository, "worktree", "add", "-b", "work/" + name + "-" + identifier[:8], str(path), base)
            command(path, ["npm", "run", "source:setup"])
            row = {"id": identifier, "name": name, "path": str(path), "base": base,
                   "session": session, "status": "working", "updatedAt": time.time()}
            state["entries"].append(row)
            self.save(state)
            return row

    def ready(self, identifier):
        with self.locked() as state:
            row = next(x for x in state["entries"] if x["id"] == identifier)
            if row["status"] in {"queued", "checking", "ready", "integrated"}:
                return row
            if row["status"] not in {"working", "blocked"}:
                raise ValueError("Dieser Arbeitsstand kann nicht erneut eingereiht werden.")
            root = Path(row["path"])
            if git(root, "diff", "--cached", "--name-only"):
                raise ValueError("Vorgemerkte Änderungen zuerst selbst abschließen.")
            row.update(status="queued", digest=tree_digest(root), queuedHead=git(root, "rev-parse", "HEAD"),
                       reason="", updatedAt=time.time())
            self.save(state)
            return row

    def session_started(self, session):
        # A resumed writer withdraws its pending handoff instead of racing a commit.
        with self.locked() as state:
            for row in state["entries"]:
                if row.get("session") == session and row["status"] == "queued":
                    row.update(status="working", reason="Session arbeitet weiter.", updatedAt=time.time())
            self.save(state)

    def dependencies(self, root, repository, log):
        for relative in ["", "wrapper"]:
            folder = root / relative
            source = repository / relative
            stamp = folder / ".cache/source-dependencies"
            locked = hashlib.sha256((folder / "package-lock.json").read_bytes()).hexdigest()
            if (folder / "node_modules").is_symlink() and (source / "package-lock.json").read_bytes() != (folder / "package-lock.json").read_bytes():
                (folder / "node_modules").unlink()
            if (folder / "node_modules").exists() and not (folder / "node_modules").is_symlink() and (not stamp.exists() or stamp.read_text() != locked):
                command(folder, ["npm", "ci", "--ignore-scripts", "--cache", ".cache/npm", "--no-audit", "--no-fund"], log)
            if not (folder / "node_modules").exists():
                if ((source / "node_modules").exists() and
                    (source / "package-lock.json").read_bytes() == (folder / "package-lock.json").read_bytes()):
                    (folder / "node_modules").symlink_to(source / "node_modules", target_is_directory=True)
                else:
                    command(folder, ["npm", "ci", "--ignore-scripts", "--cache", ".cache/npm", "--no-audit", "--no-fund"], log)
            atomic_write(stamp, locked)
        python = root / ".venv/bin/python"
        if not python.exists():
            command(root, ["python3", "-m", "venv", ".venv"], log)
        stamp = root / ".venv/source-dependencies"
        locked = hashlib.sha256((root / "requirements.lock").read_bytes() + b"pytest>=8,<10;pytest-asyncio>=1,<2").hexdigest()
        if not stamp.exists() or stamp.read_text() != locked:
            command(root, [str(python), "-m", "pip", "install", "-r", "requirements.lock", "pytest>=8,<10", "pytest-asyncio>=1,<2"], log)
            atomic_write(stamp, locked)
        return python

    def verify(self, root, repository, log):
        python = self.dependencies(root, repository, log)
        for args in [["npm", "run", "modules:verify"], ["npm", "run", "ui:prepare"],
                     ["npm", "test"], [str(python), "-m", "pytest", "-q"],
                     ["npm", "run", "typecheck"]]:
            command(root, args, log)
        if git(root, "status", "--porcelain"):
            raise ValueError("Die Prüfung hat Quelländerungen hinterlassen. Erneut prüfen und committen.")

    def tick(self, idle=True):
        if not idle or not self.file.exists():
            return self.status()
        with self.locked(blocking=False) as state:
            if state is None or not state.get("repository"):
                return self.status()
            # A crashed verification is never silently declared successful or replayed.
            for entry in state["entries"]:
                if entry["status"] == "checking":
                    entry.update(status="blocked", reason="Prüfung unterbrochen. Arbeitsstand prüfen und erneut bereitmelden.")
            row = next((x for x in state["entries"] if x["status"] == "queued"), None)
            if row is None:
                self.save(state)
                return self.status()
            row.update(status="checking", updatedAt=time.time())
            self.save(state)
            root, repository = Path(row["path"]), Path(state["repository"])
            log = self.directory / (row["id"] + ".log")
            try:
                if tree_digest(root) != row["digest"] or git(root, "rev-parse", "HEAD") != row["queuedHead"]:
                    raise ValueError("Nach der Bereitmeldung wurde weitergearbeitet. Erneut bereitmelden.")
                if git(root, "diff", "--cached", "--name-only"):
                    raise ValueError("Fremde vorgemerkte Änderungen gefunden.")
                self.dependencies(root, repository, log)
                if git(root, "status", "--porcelain"):
                    git(root, "add", "--all")
                    command(root, ["git", "commit", "-m", "Complete source work: " + row["name"]], log)
                if tree_digest(root) != row["digest"] or git(root, "status", "--porcelain"):
                    raise ValueError("Quellen haben sich während des Commits verändert. Erneut bereitmelden.")
                row["commit"] = git(root, "rev-parse", "HEAD")
                self.save(state)
                if git(repository, "status", "--porcelain"):
                    raise ValueError("Gemeinsamer Entwicklungsstand enthält offene Änderungen.")
                parent = git(repository, "rev-parse", "HEAD")
                candidate = repository / ".verify/source-candidates" / uuid.uuid4().hex
                git(repository, "worktree", "add", "-b", "candidate/" + candidate.name, str(candidate), parent)
                row["candidatePath"] = str(candidate)
                self.save(state)
                command(candidate, ["npm", "run", "source:setup"], log)
                self.dependencies(candidate, repository, log)
                command(candidate, ["python3", "scripts/source-sync.py", row["commit"]], log)
                row["candidatePath"] = str(candidate)
                row["candidateCommit"] = git(candidate, "rev-parse", "HEAD")
                self.save(state)
                self.verify(candidate, repository, log)
                if git(repository, "rev-parse", "HEAD") != parent or git(repository, "status", "--porcelain"):
                    raise ValueError("Der gemeinsame Stand hat sich während der Prüfung geändert.")
                command(repository, ["python3", "scripts/source-sync.py", row["candidateCommit"]], log)
                row.update(status="integrated", reason="Zusammengeführt und automatisch geprüft; Live-Aktivierung separat erforderlich.")
            except Exception as error:
                row.update(status="blocked", reason=str(error)[:300])
            row["updatedAt"] = time.time()
            self.save(state)
        return self.status()
