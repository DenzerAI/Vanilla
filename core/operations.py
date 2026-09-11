from __future__ import annotations

import json
import os
import re
import secrets
import shutil
import subprocess
from pathlib import Path
from time import time
from datetime import datetime
from zoneinfo import ZoneInfo

from .backups import Backups
from .database import dump
from .files import atomic_write, read_json
from .provider_vault import ProviderVault
from .service import label, service_status


class Operations:
    def __init__(self, db, config, settings, knowledge, memory):
        self.db, self.config, self.settings, self.knowledge, self.memory = db, config, settings, knowledge, memory
        self.backups = Backups(db, config, settings, memory)
        self.runtime = None
        self.started = time()
        self.network_cache = (0, {})

    def managed_jobs(self):
        values = self.settings.values
        definitions = [
            ("memory", "Memory pflegen", values["memory"]["dreaming"], {"type": "daily", "time": values["memory"]["dream_time"]}),
            ("backup", "System sichern", values["backup"]["enabled"], {"type": "daily", "time": values["backup"]["time"]}),
            ("cleanup", "Speicher pflegen", True, {"type": "daily", "time": "04:00"}),
            ("index", "Suchindex aktualisieren", False, {"type": "manual"}),
            ("update-check", "Vanilla-Updates prüfen", True, {"type": "manual"}),
        ]
        descriptions = {
            'update-check': 'Prüft verfügbare Vanilla-Versionen über den bestehenden Updateanschluss. Installiert keine Version ohne Aktivierungsauftrag.',
            'memory': 'Verdichtet gespeicherte Gesprächsauszüge lokal, verlinkt die Quellen und schreibt einen Pflegebericht. Originalgespräche bleiben erhalten.',
            'backup': 'Erstellt eine verschlüsselte Sicherung von Datenbank und Arbeitsdateien. Benötigt ein eingerichtetes Sicherungsziel und einen verfügbaren Sicherungsschlüssel.',
            'cleanup': 'Bereinigt alte Ereignisse und Protokolle nach den Aufbewahrungsfristen. Gespräche und Arbeitsdateien bleiben erhalten.',
            'index': 'Aktualisiert die lokale Suche. Der Hintergrunddienst prüft Dateien bereits alle 30 Sekunden; dieser Auftrag erlaubt eine zusätzliche manuelle Aktualisierung.',
        }
        return [{"id": "system-" + handler, "name": name, "worker": "python", "managed": True, "status": "active" if enabled else "paused", "schedule": schedule, "description": descriptions[handler], "instructions": descriptions[handler], "python": {"handler": handler, "timeout": 600, "input": {}}, "retry": {"count": 0, "idempotent": True}} for handler, name, enabled, schedule in definitions]

    def update_monitor(self):
        v = self.settings.values
        atomic_write(self.config.data / "monitor.json", dump({"enabled": v["system"]["heartbeat"], "auto_restart": v["system"]["auto_restart"], "minimum_free_mb": v["retention"]["minimum_free_mb"], "label": label(self.config)}))

    def record(self, name, status, details):
        old = self.db.rows("SELECT status FROM maintenance WHERE name=?", (name,))
        with self.db.transaction() as cx:
            cx.execute("INSERT INTO maintenance VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at,details=excluded.details", (name, status, time(), dump(details)))
        if not old or old[0]["status"] != status:
            self.db.event("system.health", name, {"status": status, "details": details, "notify": self.should_notify()})

    def should_notify(self):
        options = self.settings.values['system']
        now = datetime.now(ZoneInfo(self.config.timezone)).strftime('%H:%M')
        start, end = options['quiet_start'], options['quiet_end']
        quiet = start <= now < end if start < end else now >= start or now < end
        return options['notifications'] and not (options['quiet_hours'] and quiet)

    def checks(self):
        runtime = self.runtime
        checks = {"scheduler": {"ok": bool(runtime and time() - runtime.last_schedule < 90), "message": "Auftragsplanung"}, "index": {"ok": time() - self.knowledge.last_scan < 180, "message": "Suchindex"}}
        if self.config.start_adapter:
            checks["adapter"] = {"ok": bool(runtime and runtime.process and runtime.process.returncode is None and not runtime.error), "message": "Worker-Anschluss"}
        checks['leases'] = {'ok': not bool(self.db.rows("SELECT id FROM executions WHERE status IN ('running','dispatching') AND lease_until<?", (time(),))), 'message':'Rückmeldungen laufender Aufträge'}
        checks['automations'] = {'ok': not bool(self.db.rows("SELECT id FROM jobs j WHERE j.status='invalid' OR (j.status='active' AND (SELECT status FROM executions e WHERE e.job_id=j.id ORDER BY created_at DESC LIMIT 1) IN ('failed','interrupted'))")), 'message':'Automationen'}
        checks['embeddings'] = {'ok': bool(self.knowledge.embeddings.status().get('ready')), 'message':'Lokale Suchberechnung'}
        if self.config.public_origin:
            network = self.network_cache[1]
            checks['tailscale'] = {'ok': bool(network.get('connected') and network.get('serving') and time()-self.network_cache[0]<120), 'message':'Privater HTTPS-Zugang'}
        backup = self.backup_status()
        checks['backup'] = {'ok':backup['state']=='ready','state':backup['state'],'message':backup['message']}
        if runtime and runtime.restore_hold:
            checks['recovery'] = {'ok':False,'state':'paused','message':'Wiederherstellung wartet auf Prüfung und Fortsetzen.'}
        return checks

    def backup_status(self):
        options = self.settings.values['backup']
        last = self.db.get('backup/last-success')['value']
        if last and last.get('target') != options['target']: last = None
        target_error = None
        if options['target']:
            try:
                if not (self.backups.target/'config').is_file():
                    target_error = 'Sicherungsarchiv ist nicht erreichbar oder nicht eingerichtet.'
            except (ValueError,OSError) as error:
                target_error = str(error)[:200]
        rows = self.db.rows("SELECT * FROM maintenance WHERE name='backup'")
        attempt = rows[0] if rows else None
        if not options['target']:
            state,message = 'unconfigured','Noch kein Sicherungsziel eingerichtet.'
        elif not options['enabled']:
            state,message = 'disabled','Automatische Sicherung ist ausgeschaltet.'
        elif not self.backups.binary:
            state,message = 'error','Backup-Programm fehlt.'
        elif target_error:
            state,message = 'error',target_error
        elif attempt and attempt['status']=='running':
            active = bool(self.db.rows("SELECT id FROM executions WHERE job_id='system-backup' AND status IN ('dispatching','running')"))
            state,message = ('running','Sicherung läuft.') if active else ('error','Letzter Sicherungsversuch wurde unterbrochen.')
        elif attempt and attempt['status']=='error':
            state,message = 'error','Letzter Sicherungsversuch fehlgeschlagen.'
        elif not last:
            state,message = 'degraded','Ziel eingerichtet; erste bestätigte Sicherung fehlt.'
        elif not 0 <= time()-last['checked_at'] < 90000:
            state,message = 'stale','Letzte bestätigte Sicherung ist älter als 25 Stunden.'
        else:
            state,message = 'ready','Letzte Sicherung erstellt und stichprobenartig geprüft.'
        return {'state':state,'message':message,'last_success':last,'last_attempt':attempt}

    def status(self):
        from .source_work import SourceWork
        heartbeat = read_json(self.config.data / "heartbeat.json", None)
        enabled = self.settings.values['system']['heartbeat']
        fresh = bool(heartbeat and 0 <= time()-heartbeat.get('checked_at',0) < 150)
        heartbeat = {**(heartbeat or {}),'ok':bool(enabled and fresh and heartbeat.get('ok')),'state':'disabled' if not enabled else 'unconfigured' if not heartbeat else 'stale' if not fresh else 'ready' if heartbeat.get('ok') else 'error'}
        recovery = {'paused':bool(self.runtime and self.runtime.restore_hold),'last':read_json(self.config.data/'restore-last.json',None)}
        return {"sourceWork": SourceWork(self.config.data).status(), "backup":self.backup_status(), "recovery":recovery, "settings": self.settings.read(), "checks": self.checks(), "heartbeat": heartbeat, "service": service_status(self.config), "embeddings": self.knowledge.embeddings.status(), "maintenance": self.db.rows("SELECT * FROM maintenance ORDER BY name"), "memory": {"sources": self.db.rows("SELECT count(*) n FROM memory_sources WHERE forgotten=0")[0]["n"], "pending": len(self.memory.pending), "mode": "local-extractive", "changes": self.db.rows("SELECT * FROM memory_changes ORDER BY created_at DESC LIMIT 20")}, "storage": {"free_mb": shutil.disk_usage(self.config.data).free // 1024**2, "database_bytes": (self.config.data / "agent.sqlite3").stat().st_size}, "backup_installed": bool(self.backups.binary), "vault": ProviderVault(self.config.data / "provider-vault", self.db).status(), "access": {"enabled": self.config.login_required, "origin": self.config.public_origin}, "stream": {"connected": bool(self.runtime and self.runtime.stream.connected), "clients": len(self.runtime.stream.clients) if self.runtime else 0}}

    def run(self, handler):
        try:
            if handler == "health":
                result = {"checks": self.checks()}
            elif handler == "index":
                result = self.knowledge.scan()
                result["embeddingIndex"] = self.knowledge.embed()
            elif handler == "memory":
                result = self.memory.dream()
            elif handler == "backup":
                self.record(handler,"running",{})
                result = self.backups.snapshot()
            elif handler == "cleanup":
                result = self.cleanup()
            else:
                raise ValueError("Unbekannte Systemfunktion.")
            state = "error" if handler == "index" and not result["embeddingIndex"].get("ready") else "ok"
            self.record(handler, state, result)
            return result
        except Exception as error:
            self.record(handler, "error", {"message": str(error)[:200]})
            raise

    def cleanup(self):
        values = self.settings.values["retention"]
        now = time()
        with self.db.transaction() as cx:
            events = cx.execute("DELETE FROM events WHERE created_at<?", (now - values["events_days"] * 86400,)).rowcount
            cx.execute("DELETE FROM context_routes WHERE created_at<?", (now - values["events_days"] * 86400,))
            cx.execute("DELETE FROM sessions WHERE expires_at<?", (now,))
            # Preserve schedule slots so cleanup never re-enqueues an already run slot.
            cx.execute("UPDATE executions SET result='{}',progress=NULL,error=NULL WHERE status NOT IN ('queued','dispatching','running') AND finished_at<?", (now - values["runs_days"] * 86400,))
        cleared = 0
        logs = self.config.data / "logs"
        for p in logs.glob("*.log"):
            if p.is_symlink():
                continue
            if p.stat().st_size > 1024 * 1024:
                with p.open("rb+") as f:
                    f.seek(-128 * 1024, 2)
                    tail = f.read()
                    f.seek(0)
                    f.write(tail)
                    f.truncate()
                cleared += 1
        for p in (self.config.data / "job-logs").glob("*.log"):
            if p.is_file() and not p.is_symlink() and p.stat().st_mtime < now - values["logs_days"] * 86400:
                p.unlink()
                cleared += 1
        if self.settings.values["backup"]["enabled"]:
            self.backups.prune()
        # Only remove old verified staging copies, never applied restore safety copies.
        with self.backups.lock:
            pending = read_json(self.config.data / 'restore-pending.json', {})
            for p in (self.config.data / 'restores').glob('*'):
                protected = pending.get('path') and Path(pending['path']).is_relative_to(p)
                if p.is_dir() and not p.is_symlink() and not protected and p.stat().st_mtime < now - values['logs_days']*86400:
                    shutil.rmtree(p)
                    cleared += 1
        return {"events_removed": events, "logs_cleaned": cleared}

    def configure_access(self, password):
        if len(password) < 8:
            raise ValueError("Bitte mindestens acht Zeichen verwenden.")
        api_token = secrets.token_urlsafe(48)
        vault = ProviderVault(self.config.data / 'provider-vault', self.db)
        host_path = self.config.data / 'host.json'
        with self.db.lock:
            old_host = host_path.read_text() if host_path.exists() else None
            host = json.loads(old_host) if old_host else {}
            encrypted = {name: vault.encrypt(name, value) for name, value in
                         [('system-access', password), ('system-api', api_token)]}
            # Both credentials and their metadata commit together. A failed
            # host-file write leaves the previous login and browser sessions valid.
            wrote_host = False
            try:
                with self.db.transaction() as cx:
                    for name, value in encrypted.items():
                        cx.execute('INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',
                                   (vault.name(name), dump(value), time()))
                    state = self.db.get('control/state.json')['value']
                    if state:
                        state['secrets'] = [s for s in state.get('secrets', []) if s['id'] not in encrypted] + [
                            {'id': 'system-access', 'name': 'System · Anmeldung', 'system': True},
                            {'id': 'system-api', 'name': 'System · Lokale Werkzeuge', 'system': True}]
                        cx.execute('UPDATE records SET value=?,updated_at=? WHERE key=?', (dump(state), time(), 'control/state.json'))
                    cx.execute('DELETE FROM sessions')
                    atomic_write(host_path, dump({**host, 'access_enabled': True}))
                    wrote_host = True
            except BaseException:
                if wrote_host:
                    if old_host is None: host_path.unlink(missing_ok=True)
                    else: atomic_write(host_path, old_host)
                raise
            self.config.login_password, self.config.access_token = password, api_token
        return {"ok": True, "loginRequired": True}

    def tailscale_binary(self):
        return shutil.which("tailscale") or ("/Applications/Tailscale.app/Contents/MacOS/Tailscale" if Path("/Applications/Tailscale.app/Contents/MacOS/Tailscale").is_file() else None)

    def tailscale_env(self):
        # The macOS app CLI requires TERM even when called without a terminal.
        return {**{k:os.environ[k] for k in ('PATH','HOME','USER','LOGNAME','TMPDIR','LANG') if k in os.environ}, 'TERM':'dumb'}

    def tailscale(self, force=False):
        if not force and time() - self.network_cache[0] < 30:
            return self.network_cache[1]
        if os.getenv('VANILLA_MANAGED_HTTPS') == '1':
            # Host operator owns Serve. The app checks HTTPS without launching the native CLI.
            import httpx
            origin = self.config.public_origin
            ok = False
            try:
                with httpx.Client(trust_env=False, timeout=5) as client:
                    response = client.get(origin + '/api/core/status')
                    ok = response.status_code == 200 and response.json().get('backend') == 'FastAPI'
            except (httpx.HTTPError, ValueError):
                pass
            result = {'managed': True, 'connected': ok, 'serving': ok, 'url': origin,
                      'certificateVerified': ok}
            self.network_cache = (time(), result)
            return result
        binary = self.tailscale_binary()
        if not binary:
            return {"installed": False, "connected": False, "serving": False}
        try:
            r = subprocess.run([binary, "status", "--json"], env=self.tailscale_env(), capture_output=True, text=True, timeout=10)
            status = json.loads(r.stdout) if r.returncode == 0 else {}
            r = subprocess.run([binary, "serve", "status", "--json"], env=self.tailscale_env(), capture_output=True, text=True, timeout=10)
            serve = json.loads(r.stdout) if r.returncode == 0 else {}
            dns = status.get("Self", {}).get("DNSName", "").rstrip(".")
            handlers = [h for value in serve.get("Web", {}).values() for h in value.get("Handlers", {}).values()]
            expected = f"http://127.0.0.1:{self.config.port}"
            result = {"installed": True, "connected": status.get("BackendState") == "Running", "dns": dns, "url": "https://" + dns if dns else "", "serving": any(h.get("Proxy", "").rstrip("/") == expected for h in handlers), "occupied": bool(handlers) and not any(h.get("Proxy", "").rstrip("/") == expected for h in handlers), "health": status.get("Health") or []}
            approval = read_json(self.config.data / 'host.json', {}).get('serve_approval_url')
            if approval and not result['serving']:
                result.update(requiresApproval=True, approvalUrl=approval)
        except (ValueError, OSError, subprocess.SubprocessError):
            result = {"installed": True, "connected": False, "serving": False, "error": "Tailscale antwortet nicht."}
        self.network_cache = (time(), result)
        return result

    def enable_serve(self):
        raise ValueError("Globale Tailscale-Freigaben sind in der isolierten Vanilla-Basis deaktiviert.")
