"""Consistent, encrypted snapshots and verified restoration to a staging folder."""
from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import threading
from contextlib import closing
from pathlib import Path
from time import time
from uuid import uuid4

from .files import atomic_write, sha256
from .secrets import read_secret, save_secret, register_secret

EXCLUDE_DIRS = {"node_modules", ".venv", ".git", "__pycache__", "secrets", "cache", "models"}


def inventory(source):
    files = {}
    for folder, dirs, names in os.walk(source, followlinks=False):
        root = Path(folder)
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS and not (root/d).is_symlink())
        for name in names:
            p=root/name
            if not p.is_symlink() and not name.startswith('.env') and name not in {'auth.json','credentials.json','.DS_Store'}:
                files[p.relative_to(source).as_posix()] = sha256(p)
    return files


def copy_stable(source, target):
    if source.is_symlink():
        raise ValueError("Verknüpfte Sicherungsquelle wird nicht verfolgt.")
    original = inventory(source)
    for folder, dirs, files in os.walk(source, followlinks=False):
        root = Path(folder)
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS and not (root / d).is_symlink())
        for name in sorted(files):
            p = root / name
            if p.is_symlink() or name.startswith(".env") or name in {"auth.json", "credentials.json", ".DS_Store"}:
                continue
            rel = p.relative_to(source)
            before = sha256(p)
            out = target / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, out)
            if sha256(out) != before or sha256(p) != before:
                raise ValueError("Dateien wurden während der Sicherung geändert. Bitte erneut sichern.")
    if inventory(source) != original:
        raise ValueError("Sicherungsquelle wurde inzwischen geändert. Bitte erneut sichern.")


class Backups:
    def __init__(self, db, config, settings, memory, password=None):
        self.db, self.config, self.settings, self.memory = db, config, settings, memory
        self.password = password or (lambda: read_secret("system-backup"))
        self.lock = threading.Lock()

    @property
    def binary(self):
        local = self.config.data / "bin/restic"
        return str(local) if local.is_file() else shutil.which("restic")

    @property
    def target(self):
        value = self.settings.values["backup"]["target"]
        if not value or not Path(value).is_absolute():
            raise ValueError("Bitte einen absoluten Sicherungsordner einrichten.")
        from .isolation import inside
        target = inside(self.config.root, value)
        if target.is_relative_to(self.config.workspace) or self.config.workspace.is_relative_to(target) or target.is_relative_to(self.config.data):
            raise ValueError("Sicherungsziel muss außerhalb des Workspace und der laufenden Systemdaten liegen.")
        return target

    def command(self, *args, cwd=None, timeout=180, password=None):
        if not self.binary:
            raise ValueError("Backup-Programm noch nicht installiert.")
        env = {**os.environ, "RESTIC_PASSWORD": password if password is not None else self.password(), "RESTIC_REPOSITORY": str(self.target), "RESTIC_CACHE_DIR": str(self.config.data / "backup-cache")}
        # A new launchd installation must not inherit proxy destinations or password commands.
        for key in ["RESTIC_PASSWORD_COMMAND", "RESTIC_PASSWORD_FILE", "RESTIC_REPOSITORY_FILE", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
            env.pop(key, None)
        r = subprocess.run([self.binary, *args], env=env, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        if r.returncode:
            raise ValueError("Sicherung fehlgeschlagen. Ziel, Schlüssel und freien Speicher prüfen.")
        return r.stdout

    def configure(self, target, password=None):
        previous = self.settings.read()
        self.settings.set_group("backup", target=target)
        try:
            directory = self.target
            if not (directory / "config").exists():
                if directory.exists() and any(directory.iterdir()):
                    raise ValueError("Bitte einen leeren Sicherungsordner auswählen.")
                if not password:
                    try:
                        password = self.password()
                    except ValueError:
                        password = secrets.token_urlsafe(48)
                directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                self.command("init", password=password)
            self.command("snapshots", "--json", password=password)
            if password:
                # Preserve the old repository key when connecting a different archive.
                try:
                    old_password = self.password()
                except ValueError:
                    old_password = None
                if old_password and old_password != password and previous['values']['backup']['target']:
                    import hashlib
                    archive_id = 'system-backup-' + hashlib.sha256(previous['values']['backup']['target'].encode()).hexdigest()[:12]
                    save_secret(archive_id, old_password)
                    register_secret(self.db, archive_id, 'Sicherung · vorheriges Ziel')
                save_secret("system-backup", password)
            register_secret(self.db, "system-backup", "System · Sicherung")
            self.settings.set_group("backup", enabled=True)
            return {"ok": True, "target": str(directory)}
        except Exception:
            self.settings.set_group("backup", **previous["values"]["backup"])
            raise

    def snapshots(self):
        if not self.settings.values["backup"]["target"]:
            return []
        return json.loads(self.command("snapshots", "--json", "--tag", "agent-core"))

    def snapshot(self):
        if not self.lock.acquire(blocking=False):
            raise ValueError("Eine Sicherung läuft bereits.")
        stage = self.config.data / "backup-staging/snapshot"
        try:
            shutil.rmtree(stage, ignore_errors=True)
            stage.mkdir(parents=True, mode=0o700)
            # Serialize app writes while copying DB and the corresponding files.
            with self.memory.lock, self.memory.knowledge.lock, self.db.lock:
                self.db.backup(stage / "database.sqlite3")
                copy_stable(self.config.workspace, stage / "workspace")
                if self.memory.git_dir.exists():
                    copy_stable(self.memory.git_dir, stage / "vault.git")
                sessions = self.config.data / "codex/sessions"
                if sessions.exists():
                    copy_stable(sessions, stage / "worker-sessions")
                archived = self.config.data / "codex/archived_sessions"
                if archived.exists():
                    copy_stable(archived, stage / "archived-sessions")
            # Vectors can be regenerated locally; exclude them from each snapshot.
            with closing(sqlite3.connect(stage / "database.sqlite3")) as cx:
                cx.execute("PRAGMA journal_mode=DELETE")
                cx.execute("DELETE FROM vectors")
                cx.commit()
                cx.execute("VACUUM")
            files = {p.relative_to(stage).as_posix(): sha256(p) for p in sorted(stage.rglob("*")) if p.is_file()}
            manifest = {"format": "agent-backup-v1", "created_at": time(), "schema": 2, "files": files, "models": "rebuild", "secrets": "keychain-reconnect"}
            atomic_write(stage / "manifest.json", json.dumps(manifest, indent=2))
            output = self.command("backup", ".", "--json", "--tag", "agent-core", cwd=stage)
            summaries = [json.loads(line) for line in output.splitlines() if line.startswith("{")]
            result = next((r for r in summaries if r.get("message_type") == "summary"), {})
            self.command("check", "--read-data-subset=5%")
            self.db.event("backup.completed", result.get("snapshot_id"), {"files": len(files)})
            return {"snapshot": result.get("snapshot_id"), "files": len(files), "bytes_added": result.get("data_added", 0)}
        finally:
            shutil.rmtree(stage, ignore_errors=True)
            self.lock.release()

    def prune(self):
        options = self.settings.values["backup"]
        with self.lock:
            self.command("forget", "--tag", "agent-core", "--group-by", "host,tags", "--keep-daily", str(options["daily"]), "--keep-weekly", str(options["weekly"]), "--keep-monthly", str(options["monthly"]))
            self.command("prune", "--max-unused", "10%")
        return {"ok": True}

    def stage_restore(self, snapshot):
        if not re.fullmatch(r"[0-9a-f]{8,64}", snapshot):
            raise ValueError("Ungültige Sicherungs-ID.")
        id = uuid4().hex
        destination = self.config.data / "restores" / id
        with self.lock:
            destination.mkdir(parents=True, mode=0o700)
            self.command("restore", snapshot, "--target", str(destination))
            candidates = []
            for p in destination.rglob("manifest.json"):
                try:
                    if json.loads(p.read_text()).get("format") == "agent-backup-v1":
                        candidates.append(p)
                except (ValueError, OSError, AttributeError):
                    continue
            if len(candidates) != 1:
                raise ValueError("Sicherungsmanifest fehlt oder ist mehrdeutig.")
            base = candidates[0].parent
            verify_restore(base)
            result = {"id": id, "snapshot": snapshot, "path": str(base), "verified": True, "created_at": time()}
            self.db.put("backup/restore/" + id, result)
            return result


def verify_restore(base):
    manifest = json.loads((base / "manifest.json").read_text())
    if manifest.get("format") != "agent-backup-v1":
        raise ValueError("Unbekanntes Sicherungsformat.")
    actual = set()
    for p in base.rglob('*'):
        if p.is_symlink():
            raise ValueError("Verknüpfung in der Wiederherstellung ist nicht zulässig.")
        if p.is_file() and p != base / 'manifest.json':
            actual.add(p.relative_to(base).as_posix())
    if actual != set(manifest['files']) or 'database.sqlite3' not in actual:
        raise ValueError("Dateibestand entspricht nicht dem Sicherungsmanifest.")
    for name, checksum in manifest["files"].items():
        p = base / name
        if p.is_symlink() or not p.resolve().is_relative_to(base.resolve()) or not p.is_file() or sha256(p) != checksum:
            raise ValueError("Wiederherstellung hat eine ungültige Prüfsumme oder einen ungültigen Pfad.")
    with closing(sqlite3.connect(f"file:{base / 'database.sqlite3'}?mode=ro&immutable=1", uri=True)) as cx:
        if cx.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("Gesicherte Datenbank ist nicht intakt.")
    return manifest
