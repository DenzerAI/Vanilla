"""Gmail app-password transport; fixed provider hosts and read-only mailbox access."""
import imaplib
import re
import smtplib
import ssl
from contextlib import contextmanager
from datetime import timezone
from email import policy
from email.parser import BytesParser
from email.utils import parseaddr, parsedate_to_datetime, make_msgid

MAX_MESSAGE = 25_000_000
BATCH = 100


@contextmanager
def mailbox(address, password):
    m = None
    try:
        m = imaplib.IMAP4_SSL('imap.gmail.com', 993, ssl_context=ssl.create_default_context(), timeout=30)
        m.login(address, password)
        status, boxes = m.list()
        if status != 'OK':
            raise ValueError('Gmail-Ordner konnten nicht gelesen werden.')
        folder = None
        for box in boxes or []:
            if box and re.search(rb'\\All(?:\s|\))', box, re.I):
                match = re.match(rb'\([^)]*\)\s+(?:"[^"]*"|NIL)\s+(.+)$', box)
                if match:
                    folder = match[1].decode('ascii')
                    break
        if not folder:
            raise ValueError('Gmail-Ordner Alle Nachrichten fehlt. In Gmail für IMAP freigeben.')
        if m.select(folder, readonly=True)[0] != 'OK':
            raise ValueError('Gmail-Ordner konnte nicht geöffnet werden.')
        yield m
    except (imaplib.IMAP4.error, OSError) as exc:
        raise ValueError('Gmail-IMAP nicht erreichbar oder App-Passwort abgelehnt.') from None
    finally:
        if m:
            try:
                m.logout()
            except (imaplib.IMAP4.error, OSError):
                pass


def checked(result):
    status, data = result
    if status != 'OK':
        raise ValueError('Gmail-Abgleich konnte nicht abgeschlossen werden.')
    return data


def fetch(m, uid):
    meta = b' '.join(x for x in checked(m.uid('FETCH', str(uid), '(RFC822.SIZE X-GM-MSGID X-GM-THRID)')) if isinstance(x, bytes))
    size = re.search(rb'RFC822.SIZE (\d+)', meta)
    mid = re.search(rb'X-GM-MSGID (\d+)', meta)
    tid = re.search(rb'X-GM-THRID (\d+)', meta)
    if not size or not mid or not tid:
        raise ValueError('Gmail-Nachrichtenkennung fehlt. Abgleich erneut starten.')
    if int(size[1]) > MAX_MESSAGE:
        # Keep bounded text and stable identity; oversized originals remain at Gmail.
        parts = checked(m.uid('FETCH', str(uid), '(BODY.PEEK[HEADER])'))
        oversized = True
    else:
        parts = checked(m.uid('FETCH', str(uid), '(BODY.PEEK[])'))
        oversized = False
    raw = next((x[1] for x in parts if isinstance(x, tuple)), None)
    if raw is None or len(raw) > MAX_MESSAGE:
        raise ValueError('Gmail-Nachricht konnte nicht vollständig geladen werden.')
    return format(int(mid[1]), 'x'), format(int(tid[1]), 'x'), raw, oversized


def normalize(address, mid, tid, raw, oversized=False):
    from .mail import plain
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    texts, htmls, attachments = [], [], []
    for index, part in enumerate(msg.walk()):
        if part.is_multipart():
            continue
        content = part.get_payload(decode=True) or b''
        if part.get_filename() or part.get_content_disposition() == 'attachment':
            attachments.append({'id': str(index), 'name': part.get_filename() or 'Anhang', 'size': len(content)})
        elif part.get_content_type() in ('text/plain', 'text/html'):
            try:
                value = content.decode(part.get_content_charset() or 'utf-8', errors='replace')
            except LookupError:
                value = content.decode('utf-8', errors='replace')
            (texts if part.get_content_type() == 'text/plain' else htmls).append(value)
    try:
        date = parsedate_to_datetime(str(msg.get('Date', '')))
        date = (date if date.tzinfo else date.replace(tzinfo=timezone.utc)).isoformat()
    except (ValueError, TypeError, OverflowError):
        date = '1970-01-01T00:00:00+00:00'
    return {'external': mid, 'thread': tid, 'subject': str(msg.get('Subject', '')), 'sender': str(msg.get('From', '')), 'to': str(msg.get('To', '')), 'replyTo': str(msg.get('Reply-To') or msg.get('From', '')), 'messageId': str(msg.get('Message-ID', '')), 'time': date, 'text': ('Nachricht über 25 MB. Bitte direkt in Gmail öffnen.' if oversized else ('\n'.join(texts) or plain('\n'.join(htmls)))[:100000]), 'outgoing': parseaddr(str(msg.get('From', '')))[1].lower() == address.lower(), 'attachments': attachments, 'hasAttachments': bool(attachments), 'oversized': oversized, 'triageSignals': {'listUnsubscribe': bool(msg.get('List-Unsubscribe')), 'listId': bool(msg.get('List-Id'))}}


def sync(address, password, cursor):
    with mailbox(address, password) as m:
        validity = str((m.response('UIDVALIDITY')[1] or [b''])[0].decode())
        if not validity:
            raise ValueError('Gmail-Ordnerkennung fehlt.')
        initial = cursor.get('imapValidity') != validity
        if initial:
            raw = checked(m.uid('SEARCH', None, 'X-GM-RAW', '"newer_than:30d -in:trash -in:spam"'))
        else:
            raw = checked(m.uid('SEARCH', None, 'UID', str(int(cursor.get('imapUid', 0)) + 1) + ':*'))
        ids = sorted({int(x) for x in (raw[0] or b'').split()})
        if not initial:
            ids = [uid for uid in ids if uid > int(cursor.get('imapUid', 0))]
        selected = ids[-BATCH:] if initial else ids[:BATCH]
        messages = [normalize(address, *fetch(m, uid)) for uid in selected]
        return messages, {'imapValidity': validity, 'imapUid': max(selected, default=int(cursor.get('imapUid', 0))), 'initialLimited': len(ids) > BATCH if initial else cursor.get('initialLimited', False), 'initialDays': 30, 'initialLimit': BATCH, 'pending': max(0, len(ids)-len(selected)) if not initial else 0}


def attachment(address, password, mid, part_id):
    if not re.fullmatch(r'[0-9a-f]+', mid) or not str(part_id).isdigit():
        raise ValueError('Ungültiger Anhang.')
    with mailbox(address, password) as m:
        ids = checked(m.uid('SEARCH', None, 'X-GM-MSGID', str(int(mid, 16))))[0].split()
        if len(ids) != 1:
            raise ValueError('Nachricht nicht mehr im Gmail-Postfach vorhanden.')
        actual, _, raw, oversized = fetch(m, int(ids[0]))
        if oversized or actual != mid:
            raise ValueError('Großen Anhang bitte direkt in Gmail öffnen.')
        parts = list(BytesParser(policy=policy.default).parsebytes(raw).walk())
        if int(part_id) >= len(parts):
            raise ValueError('Anhang nicht gefunden.')
        part = parts[int(part_id)]
        if not part.get_filename() and part.get_content_disposition() != 'attachment':
            raise ValueError('Anhang nicht gefunden.')
        data = part.get_payload(decode=True) or b''
        if len(data) > 8_000_000:
            raise ValueError('Anhänge über 8 MB bitte im Anbieterpostfach öffnen.')
        return data, part.get_filename() or 'Anhang'


def send(address, password, message):
    message['Message-ID'] = make_msgid()
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context(), timeout=30) as smtp:
            smtp.login(address, password)
            refused = smtp.send_message(message)
            if refused:
                raise ValueError('Gmail hat den Versand nicht bestätigt.')
    except (smtplib.SMTPException, OSError):
        # No retries: the caller's durable reservation records uncertainty.
        raise ValueError('Gmail-SMTP hat den Versand nicht bestätigt.') from None
