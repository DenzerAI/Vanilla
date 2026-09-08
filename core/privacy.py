"""Local pre-dispatch checks. Never claims control over native worker traffic."""
from __future__ import annotations

import json
import re
from time import time
from typing import Literal
from uuid import uuid4

from pydantic import Field, model_validator
from .settings import Options

LEGAL_DATE = "2026-09-08"
DSK = "https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf"
DSK_SYSTEMS = "https://www.datenschutzkonferenz-online.de/media/oh/DSK-OH_KI-Systeme.pdf"
AI = "https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act"
LITERACY = "https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers"
REQUIREMENTS = [
    {"id": "purpose", "title": "Zweck und Rechtsgrundlage", "description": "Wofür werden welche Daten benötigt? Rechtsgrundlage je Verarbeitung festhalten, bei sensiblen Daten zusätzlich Art. 9 prüfen.", "law": "DSGVO Art. 5, 6, 9", "source": DSK},
    {"id": "providers", "title": "Anbieter und Verträge", "description": "Rollen, Auftragsverarbeitung, Unterauftragnehmer, Speicherfristen und Nutzung zum Training anhand des konkreten Vertrags prüfen.", "law": "DSGVO Art. 28", "source": DSK},
    {"id": "transfers", "title": "Verarbeitung außerhalb des EWR", "description": "Verarbeitungsorte und Zugriffe aus Drittländern ermitteln. Falls erforderlich Übermittlungsgrundlage und zusätzliche Maßnahmen dokumentieren.", "law": "DSGVO Art. 44–49", "source": DSK},
    {"id": "transparency", "title": "Betroffene informieren", "description": "Verständliche Informationen zu Zweck, Empfängern, Fristen und Rechten bereitstellen.", "law": "DSGVO Art. 12–14", "source": DSK},
    {"id": "rights", "title": "Auskunft, Berichtigung und Löschung", "description": "Verfahren für Chats, Dateien, Memory, Versionen, Sicherungen und Anbieter festlegen. Ausblenden im Memory löscht diese Kopien nicht.", "law": "DSGVO Art. 15–22", "source": DSK_SYSTEMS},
    {"id": "security", "title": "Zugriff und Sicherheit", "description": "Berechtigungen, Geräteschutz, Sicherung und Wiederherstellung prüfen. Lokaler Betrieb allein schützt keine frei zugreifenden Worker.", "law": "DSGVO Art. 25, 32", "source": DSK_SYSTEMS},
    {"id": "risk", "title": "Risiken und Folgenabschätzung", "description": "Hohes Risiko prüfen und gegebenenfalls eine Datenschutz-Folgenabschätzung durchführen; Entscheidungen mit erheblichen Folgen gesondert bewerten.", "law": "DSGVO Art. 22, 35", "source": DSK},
    {"id": "operations", "title": "Verantwortung und Vorfälle", "description": "Zuständigkeit, Verarbeitungsverzeichnis soweit erforderlich und Vorgehen bei Datenschutzverletzungen mit Meldefristen festlegen.", "law": "DSGVO Art. 24, 30, 33–34", "source": DSK_SYSTEMS},
    {"id": "ai", "title": "KI-Einsatz einordnen", "description": "Rolle, verbotene Anwendungen, mögliche Hochrisiko-Einstufung und einschlägige Transparenzpflichten prüfen. Pflichten hängen vom Einsatz ab.", "law": "KI-Verordnung, insbesondere Art. 5, 6, 50", "source": AI},
    {"id": "literacy", "title": "Mitarbeitende befähigen", "description": "Einweisung in Nutzen, Grenzen, Datenschutz und menschliche Kontrolle dokumentieren. Kein pauschales Zertifikat erforderlich.", "law": "KI-Verordnung Art. 4", "source": LITERACY},
]


class Review(Options):
    status: Literal["open", "documented", "not_applicable"] = "open"
    note: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def evidence(self):
        if self.status != "open" and len(self.note.strip()) < 10:
            raise ValueError("Dokumentierte Prüfpunkte benötigen einen Nachweis oder eine Begründung.")
        return self


class PrivacyOptions(Options):
    pause_handoffs: bool = False
    block_secrets: bool = True
    block_contacts: bool = False
    block_attachments: bool = False
    audit_days: int = Field(default=30, ge=1, le=90)
    reviews: dict[str, Review] = Field(default_factory=dict)

    @model_validator(mode="after")
    def known_reviews(self):
        if set(self.reviews) - {r["id"] for r in REQUIREMENTS}:
            raise ValueError("Unbekannter Datenschutz-Prüfpunkt.")
        return self


KINDS = Literal["worker", "title", "voice", "connector", "service", "image", "dictation-groq", "speech-elevenlabs", "local-test"]


class Handoff(Options):
    kind: KINDS
    text: str = Field(default="", max_length=2000000, repr=False)
    attachments: int = Field(default=0, ge=0, le=10000)
    opaque: bool = False


# Deliberately narrow patterns; no inferred identity and no anonymization claim.
PATTERNS = {
    "credentials": re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~-]{16,}|\b(?:password|passwort|api[_ -]?key)\s*[:=]\s*[\"']?[^\s\"']{8,}", re.I),
    "email": re.compile(r"\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+\b", re.I),
    "iban": re.compile(r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b", re.I),
}


class Privacy:
    def __init__(self, db, settings, config, knowledge):
        self.db, self.settings, self.config, self.knowledge = db, settings, config, knowledge
        with db.transaction() as cx:
            cx.execute("CREATE TABLE IF NOT EXISTS privacy_events(id TEXT PRIMARY KEY, created_at REAL NOT NULL, kind TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, characters INTEGER NOT NULL, attachments INTEGER NOT NULL, findings TEXT NOT NULL, policy_version INTEGER NOT NULL)")
            cx.execute("CREATE INDEX IF NOT EXISTS privacy_events_date ON privacy_events(created_at)")

    def options(self):
        return PrivacyOptions.model_validate(self.db.get("privacy/settings")["value"] or {}).model_dump()

    def read(self):
        return {"version": self.db.get("privacy/version")["value"] or 0, "values": self.options()}

    def save(self, version, values):
        with self.db.lock:
            current = self.read()
            if current["version"] != version:
                raise FileExistsError("Datenschutz wurde inzwischen geändert. Bitte neu laden; dein Entwurf bleibt erhalten.")
            # Existing records and database transaction, no competing configuration files.
            with self.db.transaction() as cx:
                cx.executemany("INSERT INTO records VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", [("privacy/settings", json.dumps(values.model_dump()), time()), ("privacy/version", json.dumps(version + 1), time())])
            self.cleanup()
            return self.read()

    def evaluate(self, handoff, options=None):
        v = options or self.options()
        findings = {name: len(pattern.findall(handoff.text)) for name, pattern in PATTERNS.items()}
        reason = "allowed"
        if v["pause_handoffs"] and handoff.kind != "local-test":
            reason = "paused"
        elif v["block_attachments"] and handoff.attachments:
            reason = "attachments"
        elif handoff.opaque and (v["block_contacts"] or v["block_attachments"]):
            reason = "uninspectable"
        elif v["block_secrets"] and findings["credentials"]:
            reason = "credentials"
        elif v["block_contacts"] and (findings["email"] or findings["iban"]):
            reason = "contacts"
        return {"allowed": reason == "allowed", "reason": reason, "findings": findings, "characters": len(handoff.text), "attachments": handoff.attachments, "textInspected": not handoff.opaque}

    def check(self, handoff):
        with self.db.lock:
            policy = self.read()
            result = self.evaluate(handoff, policy["values"])
            with self.db.transaction() as cx:
                cx.execute("INSERT INTO privacy_events VALUES(?,?,?,?,?,?,?,?,?)", (uuid4().hex, time(), handoff.kind, "allowed" if result["allowed"] else "blocked", result["reason"], result["characters"], result["attachments"], json.dumps(result["findings"]), policy["version"]))
            return result

    def cleanup(self):
        with self.db.transaction() as cx:
            return cx.execute("DELETE FROM privacy_events WHERE created_at<?", (time() - self.options()["audit_days"] * 86400,)).rowcount

    def status(self):
        policy = self.read()
        days = policy["values"]["audit_days"]
        rows = self.db.rows("SELECT decision,count(*) n FROM privacy_events WHERE created_at>=? GROUP BY decision", (time() - days * 86400,))
        counts = {r["decision"]: r["n"] for r in rows}
        total, blocked = sum(counts.values()), counts.get("blocked", 0)
        done = sum(r["status"] != "open" for r in policy["values"]["reviews"].values())
        return {"settings": policy, "checkedAt": time(), "legalDate": LEGAL_DATE, "requirements": REQUIREMENTS,
                "documentation": {"completed": done, "total": len(REQUIREMENTS), "percent": round(done / len(REQUIREMENTS) * 100)},
                "handoffs": {"total": total, "blocked": blocked, "allowed": counts.get("allowed", 0), "blockedPercent": round(blocked / total * 100, 1) if total else None, "days": days},
                "data": {"documents": self.db.rows("SELECT count(*) n FROM documents")[0]["n"], "lastScan": self.knowledge.last_scan, "searchLocal": True, "capture": self.settings.values["memory"]["capture"], "maintenance": self.settings.values["memory"]["dreaming"], "sharedNotes": self.settings.values["memory"]["shared_notes"]},
                "limits": ["Geprüft werden neue Übergaben über die angeschlossenen Wrapper-Prüfstellen, keine bestätigten Zustellungen.", "Native Worker-Werkzeuge, bestehende Sitzungsinhalte, laufende Aufträge, Python-Skripte und direkte Anbieterzugriffe sind nicht vollständig kontrolliert. Rein lokale Modelltests bleiben möglich.", "Textmuster erkennen keine beliebigen Namen, Gesundheitsdaten oder Personenbezüge. Anhänge werden nicht inhaltlich analysiert.", "Dokumentationsstand ist eine Selbstauskunft, keine rechtliche Freigabe oder DSGVO-Konformitätsquote."]}

    def export(self):
        status = self.status()
        rows = self.db.rows("SELECT * FROM privacy_events WHERE created_at>=? ORDER BY created_at DESC LIMIT 10001", (time() - self.options()["audit_days"] * 86400,))
        return {**status, "events": [{**r, "findings": json.loads(r["findings"])} for r in rows[:10000]], "truncated": len(rows) > 10000}
