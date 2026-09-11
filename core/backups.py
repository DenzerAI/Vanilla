"""Consistent, encrypted snapshots and verified restoration to a staging folder."""
from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import subprocess
import threading
from contextlib import closing
from pathlib import Path
from time import time
from uuid import uuid4

from .files import atomic_write, sha256
from .secrets import read_secret
from .database import dump

ADAPTER_FILES = ("channels.json", "message-delivery.json")

EXCLUDE_DIRS = {"node_modules", ".venv", ".git", "__pycache__", "secrets", "cache", "models"}


def snapshot_paths(config):
    from .isolation import inside
    company = inside(config.root, os.environ.get('COMPANY_BASE') or 'firmenbasis')
    return [('workspace',config.workspace),('vault.git',config.data/'vault.git'),
            ('provider-vault',config.data/'provider-vault'),('company',company),
            ('dictations',config.data/'dictations'),
            ('worker-sessions',config.data/'codex/sessions'),
            ('archived-sessions',config.data/'codex/archived_sessions')]


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
        self.password = password or (lambda: read_secret("system-backup", self.config, self.db))
        self.lock = threading.Lock()

    @property
    def binary(self):
        local = self.config.data / "bin/restic"
        return str(local) if local.is_file() else shutil.which("restic")

    @property
    def target(self):
        return self.validate_target(self.settings.values["backup"]["target"])

    def validate_target(self, value):
        if not value or not Path(value).is_absolute():
            raise ValueError("Bitte einen absoluten Sicherungsordner einrichten.")
        target = Path(value).resolve()
        if Path(value).is_symlink():
            raise ValueError('Sicherungsziel darf keine Verknüpfung sein.')
        for _, source in snapshot_paths(self.config):
            source = source.resolve()
            if target.is_relative_to(source) or source.is_relative_to(target):
                raise ValueError("Sicherungsziel muss außerhalb der gesicherten Ordner liegen.")
        if target.is_relative_to(self.config.data) or self.config.data.is_relative_to(target):
            raise ValueError("Sicherungsziel muss außerhalb der laufenden Systemdaten liegen.")
        if not target.is_relative_to(self.config.root) and not target.parent.is_dir():
            raise ValueError('Das externe Ziel ist nicht erreichbar. Laufwerk zuerst verbinden und Zielordner prüfen.')
        return target

    def command(self, *args, cwd=None, timeout=180, password=None, target=None):
        if not self.binary:
            raise ValueError("Backup-Programm noch nicht installiert.")
        env = {**{k:v for k,v in os.environ.items() if not k.startswith("RESTIC_")}, "RESTIC_PASSWORD": password if password is not None else self.password(), "RESTIC_REPOSITORY": str(target if target is not None else self.target), "RESTIC_CACHE_DIR": str(self.config.data / "backup-cache")}
        # A new launchd installation must not inherit proxy destinations or password commands.
        for key in ["RESTIC_PASSWORD_COMMAND", "RESTIC_PASSWORD_FILE", "RESTIC_REPOSITORY_FILE", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]:
            env.pop(key, None)
        r = subprocess.run([self.binary, *args], env=env, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        if r.returncode:
            raise ValueError("Sicherung fehlgeschlagen. Ziel, Schlüssel und freien Speicher prüfen.")
        return r.stdout

    def configure(self, target, password=None):
        from .provider_vault import ProviderVault
        import hashlib
        with self.lock:
            previous = self.settings.read()
            directory = self.validate_target(target)
            if not password:
                try:
                    password = self.password()
                except ValueError:
                    raise ValueError('Bitte einen eigenen Sicherungsschlüssel eingeben und getrennt vom Gerät aufbewahren.') from None
            if not (directory / "config").exists():
                if directory.exists() and any(directory.iterdir()):
                    raise ValueError("Bitte einen leeren Sicherungsordner auswählen.")
                directory.mkdir(parents=True, exist_ok=True, mode=0o700)
                self.command("init", password=password, target=directory)
            self.command("snapshots", "--json", password=password, target=directory)
            # Repository validation never publishes an unverified target. The
            # target, ciphertext and secret metadata then commit atomically.
            with self.db.lock:
                if self.settings.read()['version'] != previous['version']:
                    raise FileExistsError('Einstellungen wurden inzwischen geändert. Bitte erneut verbinden.')
                vault = ProviderVault(self.config.data/'provider-vault', self.db)
                values = {'system-backup': password}
                old_target = previous['values']['backup']['target']
                if old_target and old_target != str(directory):
                    # Do not silently discard an unreadable old archive key.
                    values['system-backup-' + hashlib.sha256(old_target.encode()).hexdigest()[:12]] = self.password()
                encrypted = {name:vault.encrypt(name,value) for name,value in values.items()}
                previous['version'] += 1
                previous['values']['backup'].update(target=str(directory), enabled=True)
                with self.db.transaction() as cx:
                    records = {'system/settings':previous, **{vault.name(k):v for k,v in encrypted.items()}}
                    state = self.db.get('control/state.json')['value']
                    if state:
                        state['secrets'] = [v for v in state.get('secrets',[]) if v['id'] not in encrypted] + [
                            {'id':name,'name':'System · Sicherung' if name=='system-backup' else 'Sicherung · vorheriges Ziel','system':True} for name in encrypted]
                        records['control/state.json'] = state
                    for key,value in records.items():
                        cx.execute('INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at', (key,dump(value),time()))
            return {"ok": True, "target": str(directory)}

    def discard_staging(self):
        # Called on startup while this installation owns the SQLite lock.
        stage = self.config.data / "backup-staging"
        if stage.is_symlink():
            raise ValueError('Ungültiger Sicherungs-Arbeitsordner.')
        if stage.exists():
            shutil.rmtree(stage)

    def snapshots(self):
        if not self.settings.values["backup"]["target"]:
            return []
        return json.loads(self.command("snapshots", "--json", "--tag", "agent-core"))

    def snapshot(self):
        if not self.lock.acquire(blocking=False):
            raise ValueError("Eine Sicherung läuft bereits.")
        stage = self.config.data / "backup-staging/snapshot"
        try:
            self.discard_staging()
            stage.mkdir(parents=True, mode=0o700)
            # Serialize app writes while copying DB and the corresponding files.
            with self.memory.lock, self.memory.knowledge.lock, self.db.lock:
                self.db.backup(stage / "database.sqlite3")
                for name,source in snapshot_paths(self.config):
                    (stage/name).mkdir(mode=0o700)
                    if name == 'provider-vault':
                        from .provider_vault import ProviderVault
                        vault = ProviderVault(source, self.db)
                        if vault.records():
                            # Only the private staging directory of an encrypted
                            # restic snapshot may contain the recovery key.
                            atomic_write(stage/name/'provider.key', vault.key().decode('ascii'))
                    elif source.exists(): copy_stable(source,stage/name)
                    elif name=='company' and os.environ.get('COMPANY_BASE'):
                        raise ValueError('Die konfigurierte Firmenbasis fehlt; Sicherung wurde nicht erstellt.')
                (stage/'adapter-state').mkdir(mode=0o700)
                for name in ADAPTER_FILES:
                    source = self.config.data/name
                    if source.is_symlink():
                        raise ValueError('Verknüpfte Nachrichtenablage wird nicht gesichert.')
                    if source.exists():
                        before = sha256(source)
                        shutil.copy2(source,stage/'adapter-state'/name)
                        if sha256(source)!=before or sha256(stage/'adapter-state'/name)!=before:
                            raise ValueError('Nachrichtenablage wurde während der Sicherung geändert.')
                # Host-specific addresses/services are re-established on the new host.
                from .files import read_json
                host=read_json(self.config.data/'host.json',{})
                atomic_write(stage/'host.json',json.dumps({'access_enabled':bool(host.get('access_enabled'))}))
            # Vectors can be regenerated locally; exclude them from each snapshot.
            with closing(sqlite3.connect(stage / "database.sqlite3")) as cx:
                cx.execute("PRAGMA journal_mode=DELETE")
                cx.execute("DELETE FROM vectors")
                cx.commit()
                cx.execute("VACUUM")
            files = {p.relative_to(stage).as_posix(): sha256(p) for p in sorted(stage.rglob("*")) if p.is_file()}
            manifest = {"format": "agent-backup-v1", "created_at": time(), "schema": 4, "files": files, "models": "rebuild", "secrets": "installation-vault; native worker login reconnect", "roots":[name for name,_ in snapshot_paths(self.config)]+["adapter-state"]}
            atomic_write(stage / "manifest.json", json.dumps(manifest, indent=2))
            output = self.command("backup", ".", "--json", "--tag", "agent-core", cwd=stage)
            summaries = [json.loads(line) for line in output.splitlines() if line.startswith("{")]
            result = next((r for r in summaries if r.get("message_type") == "summary"), {})
            if not re.fullmatch(r'[0-9a-f]{64}', result.get('snapshot_id') or ''):
                raise ValueError('Sicherung lieferte keinen bestätigten Snapshot.')
            self.command("check", "--read-data-subset=5%")
            self.db.put('backup/last-success', {'snapshot':result['snapshot_id'],'checked_at':time(),'target':str(self.target),'verification':'repository-subset-5-percent'})
            self.db.event("backup.completed", result.get("snapshot_id"), {"files": len(files)})
            return {"snapshot": result.get("snapshot_id"), "files": len(files), "bytes_added": result.get("data_added", 0)}
        finally:
            try:
                if stage.exists(): shutil.rmtree(stage)
            finally:
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
            try:
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
            except BaseException:
                if destination.exists(): shutil.rmtree(destination)
                raise



def verify_restore(base):
    manifest = json.loads((base / "manifest.json").read_text())
    if manifest.get("format") != "agent-backup-v1":
        raise ValueError("Unbekanntes Sicherungsformat.")
    if manifest.get('schema',2) not in {2,3,4}:
        raise ValueError('Unbekannte Sicherungsversion.')
    if manifest.get('schema',2)>=3:
        if not (base/'host.json').is_file() or not (base/'workspace').is_dir() or not (base/'company').is_dir():
            raise ValueError('Sicherung enthält nicht alle erforderlichen Installationsbestandteile.')
        host=json.loads((base/'host.json').read_text())
        if set(host)!={'access_enabled'} or not isinstance(host['access_enabled'],bool):
            raise ValueError('Ungültige Zugangseinstellungen in der Sicherung.')
    if manifest.get('schema',2)>=3:
        roots = {'workspace','vault.git','provider-vault','company','dictations','worker-sessions','archived-sessions'}
        if manifest['schema']>=4: roots.add('adapter-state')
        if set(manifest.get('roots',[])) != roots or any(not (base/name).is_dir() for name in roots):
            raise ValueError('Sicherungswurzeln fehlen oder sind unbekannt.')
        if {p.name for p in base.iterdir()} != roots | {'manifest.json','host.json','database.sqlite3'}:
            raise ValueError('Unbekannte Installationsbestandteile in der Sicherung.')
        if manifest['schema']>=4 and any(p.name not in ADAPTER_FILES or not p.is_file() for p in (base/'adapter-state').iterdir()):
            raise ValueError('Unbekannte Nachrichtenablage in der Sicherung.')
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
        encrypted=cx.execute("SELECT key,value FROM records WHERE key LIKE 'provider-vault/%'").fetchall()
        if encrypted:
            from cryptography.fernet import Fernet, InvalidToken
            try:
                cipher=Fernet((base/'provider-vault/provider.key').read_bytes())
                for _,value in encrypted: cipher.decrypt(json.loads(value).encode())
            except (OSError, ValueError, InvalidToken):
                raise ValueError('Tresorschlüssel und gesicherte Zugänge passen nicht zusammen.') from None
        if manifest.get('schema',2)>=3 and host['access_enabled'] and not {'provider-vault/system-access','provider-vault/system-api'} <= {k for k,_ in encrypted}:
            raise ValueError('Aktivierter Zugang ohne vollständige Zugangsdaten.')
    return manifest


def verify_apply(base,config):
    from .files import read_json
    base=Path(base).resolve()
    if not base.is_relative_to((config.data/'restores').resolve()):
        raise ValueError('Wiederherstellung liegt außerhalb des geprüften Ordners.')
    manifest=verify_restore(base)
    current=read_json(config.data/'host.json',{})
    restored=read_json(base/'host.json',{}) if manifest.get('schema',2)>=3 else {}
    if current.get('access_enabled') and not restored.get('access_enabled'):
        raise ValueError('Diese Sicherung enthält keine eigene App-Anmeldung. In einer neuen lokalen Installation wiederherstellen; der bestehende Zugang wird nicht abgeschaltet.')
    return manifest
