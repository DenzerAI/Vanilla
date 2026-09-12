"""Local, conservative inbox triage. No provider writes or model requests."""
import json
import re
from email.utils import parseaddr
from time import time
from fastapi import APIRouter
from pydantic import BaseModel

CATEGORIES = {'focus':'Fokus', 'promotion':'Werbung & Newsletter', 'receipts':'Belege & Bestellungen', 'updates':'Benachrichtigungen'}
VERSION = 1


def classify(messages):
    ordered = sorted(messages, key=lambda m: m.get('time', ''))
    incoming = [m for m in ordered if not m.get('outgoing')]
    def result(category, reason):
        return {'category':category, 'label':CATEGORIES[category], 'reason':reason, 'source':'automatic', 'version':VERSION}
    if not incoming:
        return result('focus', 'Eigene Nachricht oder noch kein vollständiger Eingang. Bleibt im Fokus.')
    m = incoming[-1]
    subject = (m.get('subject') or '').casefold()
    body = (m.get('text') or '')[:16000].casefold()
    sender = parseaddr(m.get('sender') or '')[1].casefold()
    signals = m.get('triageSignals') or {}
    labels = set(signals.get('labels') or [])
    # A bulk sender can also report a real problem. These exceptions win.
    if re.search(r'mahn(?:ung|stufe)|überfällig|overdue|payment (?:failed|declined)|zahlung.{0,30}(?:fehlgeschlagen|abgelehnt)|(?:sicherheits|security).{0,20}(?:warn|alert)|ungewöhnliche.{0,15}anmeldung|konto.{0,20}(?:gesperrt|sperrung)|action required|handlung erforderlich|frist(?:ablauf|setzung)', subject):
        return result('focus', 'Möglicher Zahlungs-, Sicherheits- oder Fristfall. Bleibt im Fokus.')
    if any(x.get('outgoing') for x in ordered) or re.match(r'\s*(?:re|aw|fwd|wg)\s*:', subject):
        return result('focus', 'Antwort oder bestehender Austausch. Bleibt im Fokus.')
    if m.get('oversized'):
        return result('focus', 'Nachricht nicht vollständig vorhanden. Bleibt im Fokus.')
    if re.search(r'\b(?:rechnung|invoice|receipt|zahlungsbeleg|bestellbestätigung|auftragsbestätigung|order confirmation|versandbestätigung|shipping confirmation|lieferbestätigung)\b', subject):
        return result('receipts', 'Betreff kennzeichnet einen Beleg oder eine Bestellbestätigung.')
    bulk = bool(signals.get('listUnsubscribe') or signals.get('listId')) or bool(re.search(r'\bunsubscribe\b|newsletter abbestellen|vom newsletter abmelden|abbestellen|e-mail-einstellungen|email preferences', body))
    marketing = bool(re.search(r'newsletter|rabatt|gutschein|\bcoupon\b|\bsale\b|sonderangebot|\bdeal(?:s)?\b|\d+\s*%|nur (?:heute|für kurze zeit)|sparen|angebot(?:e)?|new arrivals', subject))
    if 'CATEGORY_PROMOTIONS' in labels or (bulk and (marketing or re.search(r'newsletter|marketing|news@|offers@', sender))):
        return result('promotion', 'Werbekategorie des Anbieters oder Rundmail-Merkmal zusammen mit Werbeinhalt erkannt.')
    if bulk and re.search(r'newsletter|weekly digest|wochenrückblick|daily digest', subject):
        return result('promotion', 'Wiederkehrender Newsletter mit Abmeldemöglichkeit erkannt.')
    if re.search(r'\b(?:lieferstatus|sendungsverfolgung|paketankündigung|tracking update|delivery update|wöchentliche zusammenfassung|weekly summary|aktivitätsübersicht)\b', subject):
        return result('updates', 'Betreff kennzeichnet eine routinemäßige Statusmeldung.')
    return result('focus', 'Keine eindeutige Routine- oder Werbezuordnung. Bleibt im Fokus.')


class Correction(BaseModel):
    id: str
    projectId: str = 'default'
    category: str  # auto removes the explicit local override


class InboxTriage:
    def __init__(self, db, mail):
        self.db, self.mail = db, mail
        with db.transaction() as cx:
            cx.execute('CREATE TABLE IF NOT EXISTS inbox_triage_overrides(thread TEXT PRIMARY KEY,category TEXT NOT NULL,updated REAL NOT NULL)')
        self.cache = {}

    def annotate(self, rows):
        if not rows:return rows
        ids = [r['id'] for r in rows]
        marks = ','.join('?' for _ in ids)
        grouped = {id:[] for id in ids}
        for m in self.db.rows(f'SELECT thread,data FROM mail_messages WHERE thread IN ({marks})', ids):
            grouped[m['thread']].append(json.loads(m['data']))
        overrides = {r['thread']:r['category'] for r in self.db.rows(f'SELECT thread,category FROM inbox_triage_overrides WHERE thread IN ({marks})',ids)}
        for row in rows:
            key = (row['id'], row['revision'])
            if key not in self.cache:
                if len(self.cache)>10000:self.cache.clear()
                self.cache[key] = classify(grouped[row['id']])
            triage = dict(self.cache[key])
            if row['id'] in overrides:
                category = overrides[row['id']]
                triage.update(category=category,label=CATEGORIES[category],reason='Für dieses Gespräch von dir festgelegt.',source='manual')
            messages = sorted(grouped[row['id']],key=lambda m:m.get('time',''))
            latest = messages[-1] if messages else {}
            row.update(triage=triage, preview=re.sub(r'\s+',' ',latest.get('text') or latest.get('subject') or row['subject'])[:180])
        return rows

    def correct(self, b):
        self.mail.thread(b.id, b.projectId)  # account/workspace scope, also rejects messenger IDs
        if b.category not in {*CATEGORIES, 'auto'}:raise ValueError('Unbekannte Inbox-Einordnung.')
        with self.db.transaction() as cx:
            if b.category == 'auto':cx.execute('DELETE FROM inbox_triage_overrides WHERE thread=?',(b.id,))
            else:cx.execute('INSERT INTO inbox_triage_overrides VALUES(?,?,?) ON CONFLICT(thread) DO UPDATE SET category=excluded.category,updated=excluded.updated',(b.id,b.category,time()))
        self.db.event('mail.changed', b.id, {})
        return {'ok':True}


def routes(triage):
    router = APIRouter()
    @router.post('/api/inbox/triage')
    def correct(b:Correction):return triage.correct(b)
    return router
