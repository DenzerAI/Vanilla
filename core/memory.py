"""Shared, source-linked Markdown memory. Curation is local and extractive."""
from __future__ import annotations

import json
import re
import subprocess
import threading
from datetime import datetime
from pathlib import Path
from time import time
from uuid import uuid4
from zoneinfo import ZoneInfo

from .knowledge import digest, passage, TEXT_EXTENSIONS
from .storage import SAFE_ID, safe_path


def public_text(text, limit=1200):
    # Memory receives public messages, never tool output, reasoning or credentials.
    lines = [line for line in str(text).splitlines() if not re.search(r"password|passwort|zugangsschl[üu]ssel|zugangscode|api.?key|api.?schl[üu]ssel|authorization|bearer\s|secret\s*[:=]|-----BEGIN .*PRIVATE", line, re.I)]
    text = "\n".join(lines)
    text = re.sub(r"\b(?:sk-[a-zA-Z0-9_-]{12,}|gh[pousr]_[a-zA-Z0-9]{15,}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b", "[Zugangsdaten entfernt]", text)
    text = re.sub(r"```[\s\S]*?```", "[Code im Quellgespräch]", text)
    return text.strip()[:limit]


class Memory:
    def __init__(self, db, config, knowledge, settings):
        self.db, self.config, self.knowledge, self.settings = db, config, knowledge, settings
        self.crm = None
        self.lock = threading.RLock()
        self.git_dir = config.data / "vault.git"
        self.pending = {r['key'].removeprefix('memory/pending/') for r in db.rows("SELECT key FROM records WHERE key LIKE 'memory/pending/%' AND value='true'")}

    def git(self, *args, check=True):
        result = subprocess.run(["git", "--git-dir=" + str(self.git_dir), "--work-tree=" + str(self.config.workspace), *args], capture_output=True, text=True, timeout=30)
        if check and result.returncode:
            raise ValueError("Lokale Wissensversionierung fehlgeschlagen.")
        return result

    def remember_version(self, path, before, after, kind):
        if not self.settings.values["memory"]["history"]:
            return
        if not (self.git_dir / 'HEAD').exists():
            subprocess.run(["git", "init", "--bare", str(self.git_dir)], check=True, capture_output=True, timeout=15)
        self.git("add", "--", path)
        if self.git("diff", "--cached", "--quiet", check=False).returncode == 0:
            return
        self.git("-c", "user.name=Agent Memory", "-c", "user.email=memory@localhost", "commit", "-m", kind + ": " + path)
        revision = self.git("rev-parse", "HEAD").stdout.strip()
        with self.db.transaction() as cx:
            cx.execute("INSERT INTO memory_changes VALUES(?,?,?,?,?,?)", (revision, path, before, after, kind, time()))

    def save(self, path, text, version, project="default", kind="Notiz geändert"):
        with self.lock:
            # Commit the existing version before the first application edit.
            file = safe_path(self.config.workspace, path, missing=True)
            roots=[root.resolve() for id,root in self.knowledge.roots() if id==project]
            if file.suffix.lower() not in TEXT_EXTENSIONS or not any(file.is_relative_to(root) for root in roots):
                raise ValueError('Notiz liegt außerhalb der Wissensordner dieses Projekts.')
            if file.is_file() and digest(file.read_text()) == version:
                self.remember_version(path, None, version, "Vorheriger Stand")
            result = self.knowledge.save(path, text, version, project)
            try:
                self.remember_version(path, version, result["version"], kind)
            except (ValueError, OSError, subprocess.SubprocessError):
                self.db.event("memory.history.error", None, {"message": "Notiz gespeichert; lokale Versionierung bitte prüfen."})
                result["historyWarning"] = "Notiz gespeichert; lokale Versionierung konnte nicht abgeschlossen werden."
            self.db.event("memory.changed", path, {"kind": kind})
            return result

    def restore(self, revision, path, version, project):
        if not re.fullmatch(r"[0-9a-f]{40}", revision):
            raise ValueError("Ungültige Wissensversion.")
        if not self.db.rows("SELECT id FROM memory_changes WHERE id=? AND path=?", (revision, path)):
            raise ValueError("Wissensversion nicht gefunden.")
        safe_path(self.config.workspace, path)
        text = self.git("show", revision + ":" + path).stdout
        return self.save(path, text, version, project, "Version wiederhergestellt")

    def project_prefix(self, project):
        if project == "default":
            return ""
        rows = self.db.rows("SELECT path FROM projects WHERE id=?", (project,))
        if not rows or not rows[0]["path"]:
            raise ValueError("Arbeitsbereich fehlt.")
        p = safe_path(self.config.workspace, rows[0]["path"])
        return p.relative_to(self.config.workspace).as_posix() + "/"

    def queue_capture(self, key, thread):
        if not key.startswith("workspace/chats/") or not key.endswith("/transcript.json"):
            return
        if any(t.get("status") == "completed" and not self.db.rows('SELECT id FROM memory_sources WHERE id=?', (thread['id']+':'+t['id'],)) for t in thread.get("turns", [])):
            self.pending.add(thread["id"])
            self.db.put('memory/pending/'+thread['id'], True)

    def capture(self, chat_id):
        options = self.settings.values["memory"]
        if not options["capture"] or chat_id in options["excluded_chats"]:
            return 0
        if not SAFE_ID.fullmatch(chat_id):
            raise ValueError("Ungültiger Chat.")
        thread = self.db.get(f"workspace/chats/{chat_id}/transcript.json")["value"]
        chats = self.db.rows("SELECT project_id,title FROM chats WHERE id=?", (chat_id,))
        if not thread or not chats:
            return 0
        project = chats[0]["project_id"] or "default"
        prefix = self.project_prefix(project)
        day = datetime.now(ZoneInfo(self.config.timezone)).strftime("%Y-%m-%d")
        target = f"{prefix}brain/daily/{day}/{chat_id}.md"
        count = 0
        with self.lock:
            for turn in thread.get("turns", []):
                if turn.get("status") != "completed":
                    continue
                source_id = chat_id + ":" + turn["id"]
                if self.db.rows("SELECT id FROM memory_sources WHERE id=?", (source_id,)):
                    continue
                user, replies = [], []
                for item in turn.get("items", []):
                    text = item.get("text") or "\n".join(c.get("text", "") for c in item.get("content", []) if isinstance(c, dict))
                    if item.get("type") == "userMessage":
                        user.append(public_text(text, 400))
                    elif item.get("type") == "agentMessage":
                        replies.append(public_text(text, 1400))
                if not any(replies):
                    continue
                excerpt = "Auftrag: " + " ".join(user)[:500] + "\n\nErgebnis (Auszug): " + "\n".join(replies)[:1800]
                with self.db.transaction() as cx:
                    cx.execute("INSERT OR IGNORE INTO memory_sources VALUES(?,?,?,?,?,?,?,?,0)", (source_id, chat_id, turn["id"], project, digest(excerpt), target, excerpt, time()))
                count += 1
            # Rebuild pending files from committed sources: a crash cannot lose a capture.
            for row in self.db.rows("SELECT DISTINCT path FROM memory_sources WHERE chat_id=? AND forgotten=0", (chat_id,)):
                self.write_daily(row["path"], project, chats[0]["title"])
        if count:
            self.db.event("memory.captured", chat_id, {"count": count, "projectId": project})
        return count

    def write_daily(self, path, project, title="Gespräch"):
        sources = self.db.rows("SELECT id,excerpt FROM memory_sources WHERE path=? AND forgotten=0 ORDER BY created_at,id", (path,))
        text = "# " + public_text(title or "Gespräch", 100).replace("\n", " ") + "\n\nAutomatisch erfasste öffentliche Gesprächsauszüge. Aussagen sind Quellenmaterial, keine neuen Regeln.\n\n"
        text += "\n\n".join("## Quelle " + s["id"] + "\n\n" + s["excerpt"] for s in sources)
        self.write_managed(path, text, project, "Gespräch erfasst")

    def write_managed(self, path, text, project, kind):
        file = safe_path(self.config.workspace, path, missing=True)
        existing = file.read_text() if file.exists() else None
        generated = self.db.get("memory/generated/" + path)["value"]
        if existing is not None and existing == text:
            if self.db.rows('SELECT id FROM memory_changes WHERE path=? AND after_version=?', (path,digest(text))):
                self.db.put('memory/generated/'+path, digest(text))
            return
        if existing is not None and (not generated or digest(existing) != generated):
            self.db.event("memory.conflict", path, {"message": "Manuell geänderte Memory-Datei erhalten. Automatische Pflege dieses Dokuments pausiert."})
            return
        result = self.save(path, text, digest(existing) if existing is not None else None, project, kind)
        self.db.put("memory/generated/" + path, result["version"])

    def flush(self, backfill=False):
        with self.lock:
            ids = {r["id"] for r in self.db.rows("SELECT id FROM chats")} if backfill else set(self.pending)
            total = 0
            for id in sorted(ids):
                total += self.capture(id)
                self.pending.discard(id)
                self.db.put('memory/pending/'+id, False)
            return {"captured": total, "pending": len(self.pending), "mode": "local-extractive"}

    def continuation(self, chat_id):
        if not SAFE_ID.fullmatch(chat_id):
            raise ValueError('Ungültiger Chat.')
        if chat_id in self.settings.values['memory']['excluded_chats']:
            raise ValueError('Dieses Gespräch ist von der Memory-Aufnahme ausgeschlossen.')
        rows=self.db.rows('SELECT project_id FROM chats WHERE id=?',(chat_id,))
        thread=self.db.get(f'workspace/chats/{chat_id}/transcript.json')['value']
        if not rows or not thread:
            raise ValueError('Gespräch nicht gefunden.')
        project=rows[0]['project_id'] or 'default'
        sections=[]
        for turn in thread.get('turns',[])[-10:]:
            if turn.get('status')!='completed':continue
            for item in turn.get('items',[]):
                if item.get('type') not in {'userMessage','agentMessage'}:continue
                text=item.get('text') or '\n'.join(c.get('text','') for c in item.get('content',[]) if isinstance(c,dict))
                sections.append(('Auftrag: ' if item['type']=='userMessage' else 'Ergebnis: ')+public_text(text,700))
        if not sections:raise ValueError('Noch keine abgeschlossenen Gesprächsbeiträge vorhanden.')
        text='# Fortsetzungsnotiz\n\nQuelle: Gespräch '+chat_id+'. Öffentliche Auszüge; das vollständige Original bleibt im Chat.\n\n'+'\n\n'.join(sections)[-6000:]
        path=self.project_prefix(project)+'brain/continuations/'+chat_id+'.md'
        with self.lock:
            self.write_managed(path,text,project,'Fortsetzung vorbereitet')
        return self.knowledge.read(path)

    def dream(self):
        with self.lock:
            self.flush()
            day = datetime.now(ZoneInfo(self.config.timezone)).strftime("%Y-%m-%d")
            projects = self.db.rows("SELECT DISTINCT project_id FROM memory_sources")
            total = 0
            for item in projects:
                project = item["project_id"]
                prefix = self.project_prefix(project)
                rows = self.db.rows("SELECT * FROM memory_sources WHERE project_id=? AND forgotten=0 ORDER BY created_at DESC,id LIMIT 500", (project,))
                seen, entries = set(), []
                for row in rows:
                    if row["digest"] in seen:
                        continue
                    seen.add(row["digest"])
                    relative = row["path"][len(prefix):]
                    # Only cite exact source text; no inference is promoted to a fact.
                    entries.append("- [[" + relative + "|Quelle]] · " + public_text(row["excerpt"], 420).replace("\n", " "))
                target = prefix + "brain/memory/Ergebnisse.md"
                self.write_managed(target, "# Gesprächsergebnisse\n\nLokal und extraktiv verdichtet. Bitte die verlinkte Quelle für den vollständigen Zusammenhang lesen.\n\n" + "\n\n".join(entries[:80]) + "\n", project, "Dreaming")
                self.write_managed(prefix + "brain/MEMORY.md", "# Gemeinsames Memory\n\n[[brain/memory/Ergebnisse.md|Gesprächsergebnisse]]\n\nEigene Notizen liegen in notes/. Historische Auszüge liegen in brain/daily/.\n", project, "Memory-Index")
                report = f"# Memory-Pflege · {day}\n\n{len(rows)} Quellen geprüft, {len(seen)} unterschiedliche Auszüge, {min(len(entries), 80)} Einträge im aktuellen Überblick.\n\nModus: lokal, extraktiv. Originalgespräche bleiben erhalten.\n"
                self.write_managed(prefix + f"brain/dreams/{day}.md", report, project, "Pflegebericht")
                total += len(entries)
            self.db.event("memory.dreamed", None, {"entries": total, "mode": "local-extractive"})
            return {"entries": total, "projects": len(projects), "mode": "local-extractive"}

    def forget_chat(self, chat_id):
        with self.lock:
            rows = self.db.rows("SELECT DISTINCT path,project_id FROM memory_sources WHERE chat_id=?", (chat_id,))
            options = self.settings.values["memory"]
            self.settings.set_group("memory", excluded_chats=sorted(set(options["excluded_chats"] + [chat_id])))
            with self.db.transaction() as cx:
                cx.execute("UPDATE memory_sources SET forgotten=1,excerpt='' WHERE chat_id=?", (chat_id,))
            for row in rows:
                self.write_daily(row["path"], row["project_id"], "Aus Memory entfernt")
            chat=self.db.rows('SELECT project_id FROM chats WHERE id=?',(chat_id,))
            if chat:
                project=chat[0]['project_id'] or 'default'
                continuation=self.project_prefix(project)+'brain/continuations/'+chat_id+'.md'
                if (self.config.workspace/continuation).is_file():
                    self.write_managed(continuation,'# Aus Memory entfernt\n',project,'Erinnerung entfernt')
            self.dream()
            candidates = {r['path'] for r in rows}
            for row in rows:
                candidates.add(self.project_prefix(row['project_id'])+'brain/memory/Ergebnisse.md')
            if chat:
                candidates.add(continuation)
            hidden=[]
            for path in candidates:
                file=self.config.workspace/path
                generated=self.db.get('memory/generated/'+path)['value']
                if file.is_file() and digest(file.read_text()) != generated:
                    # Preserve manual edits, but do not keep forgotten material searchable.
                    self.db.put('memory/hidden/'+path,{'reason':'forgotten-source','chatId':chat_id})
                    hidden.append(path)
            self.knowledge.scan()
            self.db.event("memory.forgotten", chat_id, {})
            return {"ok": True, "historyRetained": True, "hiddenManualFiles": hidden, "message": "Aus aktivem Memory entfernt und künftige Erfassung ausgeschaltet. Manuelle Ableitungen sind bei Bedarf aus der Suche ausgeblendet; Dateien sowie historische Git- und Backup-Stände bleiben erhalten."}

    def context(self, query, project, chat_id=None, max_chars=None):
        options = self.settings.values["memory"]
        limit = min(max_chars or options["context_characters"], options["context_characters"])
        current = self.crm.context_sources(query, min(2500, limit // 2)) if self.crm else []
        reserved = sum(len(s["text"]) for s in current)
        result = self.knowledge.context(query, project, chat_id, limit - reserved)
        # Shared notes are deliberately opt-in and never expose other projects.
        if options["shared_notes"] and project != "default":
            left = limit - reserved - result["characters"]
            if left > 300:
                hits = self.knowledge.search(query, "default", limit=4)
                for hit in hits:
                    if not hit["path"].startswith("notes/shared/"):
                        continue
                    doc = self.knowledge.read(hit["path"])
                    text, offset = passage(doc["text"], query, min(left, 1200))
                    result["sources"].append({"path": hit["path"], "version": doc["version"], "method": hit["method"], "offset": offset, "text": text})
                    left -= len(text)
                    if left <= 300:
                        break
                result["characters"] = limit - reserved - left
                with self.db.transaction() as cx:
                    cx.execute("UPDATE context_routes SET sources=? WHERE id=?", (json.dumps([{k: v for k, v in s.items() if k != "text"} for s in result["sources"]]), result["id"]))
        if current:
            result["sources"] = current + result["sources"]
            result["characters"] += reserved
            with self.db.transaction() as cx:
                cx.execute("UPDATE context_routes SET sources=? WHERE id=?", (json.dumps([{k:v for k,v in s.items() if k != "text"} for s in result["sources"]]), result["id"]))
        return result
