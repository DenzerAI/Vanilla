import json
from contextlib import contextmanager
from email.message import EmailMessage

import pytest
from core import mail_imap
from core.mail import GmailPassword, Draft, Send, identifier
from test_mail import mail


def raw():
    m = EmailMessage()
    m['From'] = 'sender@example.test'
    m['To'] = 'inbox@example.test'
    m['Subject'] = 'Frage'
    m['Date'] = 'Sat, 12 Sep 2026 10:00:00 +0000'
    m['Message-ID'] = '<source@example.test>'
    m.set_content('Nachricht')
    m.add_attachment(b'example', maintype='application', subtype='pdf', filename='Beleg.pdf')
    return m.as_bytes()


class FakeMailbox:
    def __init__(self, ids=b'5 6'):
        self.ids = ids
        self.calls = []
    def response(self, key):
        return key, [b'7']
    def uid(self, *args):
        self.calls.append(args)
        if args[0] == 'SEARCH':
            return 'OK', [self.ids]
        if 'RFC822.SIZE' in args[-1]:
            return 'OK', [b'1 (RFC822.SIZE 400 X-GM-MSGID 123 X-GM-THRID 456)']
        return 'OK', [(b'1 FETCH', raw())]


def fake_mailbox(monkeypatch, m):
    @contextmanager
    def opened(*args):
        yield m
    monkeypatch.setattr(mail_imap, 'mailbox', opened)


def test_bounded_initial_incremental_and_reset(monkeypatch):
    m = FakeMailbox(b' '.join(str(x).encode() for x in range(1, 150)))
    fake_mailbox(monkeypatch, m)
    messages, cursor = mail_imap.sync('inbox@example.test', 'synthetic', {})
    assert len(messages) == 100
    assert cursor['initialLimited'] and cursor['imapUid'] == 149
    assert messages[0]['external'] == '7b' and messages[0]['thread'] == '1c8'
    assert all('PEEK' in c[-1] for c in m.calls if c[0] == 'FETCH' and 'RFC822.SIZE' not in c[-1])
    m.ids = b'149 150 151'
    messages, cursor = mail_imap.sync('inbox@example.test', 'synthetic', cursor)
    assert len(messages) == 2 and cursor['imapUid'] == 151
    assert ('SEARCH', None, 'UID', '150:*') in m.calls
    m.ids = b'3'
    _, reset = mail_imap.sync('inbox@example.test', 'synthetic', {'imapValidity': 'old', 'imapUid': 500})
    assert reset['imapUid'] == 3


def test_mime_and_attachment(monkeypatch):
    m = FakeMailbox(b'5')
    fake_mailbox(monkeypatch, m)
    messages, _ = mail_imap.sync('inbox@example.test', 'synthetic', {})
    item = messages[0]
    assert item['text'].strip() == 'Nachricht'
    assert not item['outgoing']
    assert item['attachments'][0]['name'] == 'Beleg.pdf'
    data, name = mail_imap.attachment('inbox@example.test', 'synthetic', '7b', item['attachments'][0]['id'])
    assert (data, name) == (b'example', 'Beleg.pdf')
    with pytest.raises(ValueError):
        mail_imap.attachment('inbox@example.test', 'synthetic', '7b', '0')


@pytest.mark.asyncio
async def test_service_connect_sync_reply_and_disconnect(mail, monkeypatch):
    fake_mailbox(monkeypatch, FakeMailbox(b'5'))
    account = await mail.gmail_password(GmailPassword(address='inbox@example.test', password='synthetic'))
    aid = account['id']
    assert mail.account(aid, 'default')['mode'] == 'imap'
    assert 'synthetic' not in json.dumps(mail.accounts('default'))
    assert (await mail.sync(aid, 'default'))['received'] == 1
    tid = identifier(aid, '1c8')
    revision = mail.detail(tid, 'default')['thread']['revision']
    await mail.sync(aid, 'default')
    assert mail.detail(tid, 'default')['thread']['revision'] == revision
    mid = identifier(aid, '7b')
    entries = await mail.attachments(mid, 'default')
    assert await mail.attachments(mid, 'default', entries[0]['id']) == (b'example', 'Beleg.pdf')
    mail.draft(Draft(id=tid, revision=revision, text='Antwort', version=0))
    sent = []
    monkeypatch.setattr(mail_imap, 'send', lambda address, password, msg: sent.append(msg))
    result = await mail.send(Send(id=tid, version=1))
    assert result['state'] == 'accepted'
    assert sent[0]['In-Reply-To'] == '<source@example.test>'
    assert sent[0]['To'] == 'sender@example.test'
    await mail.disconnect(aid, 'default')
    assert not mail.vault.has('mail-account-' + aid)


@pytest.mark.asyncio
async def test_failed_login_does_not_save(mail, monkeypatch):
    @contextmanager
    def denied(*args):
        raise ValueError('Anmeldung fehlgeschlagen')
        yield
    monkeypatch.setattr(mail_imap, 'mailbox', denied)
    with pytest.raises(ValueError):
        await mail.gmail_password(GmailPassword(address='inbox@example.test', password='synthetic'))
    assert mail.accounts('default') == []


def test_smtp_disconnect_is_uncertain(monkeypatch):
    class Broken:
        def __init__(self, *args, **kwargs):
            raise OSError('network')
    monkeypatch.setattr(mail_imap.smtplib, 'SMTP_SSL', Broken)
    with pytest.raises(ValueError, match='nicht bestätigt'):
        mail_imap.send('inbox@example.test', 'synthetic', EmailMessage())


def test_internal_password_endpoint_requires_internal_auth(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from core.app import create_app
    from core.config import Config
    fake_mailbox(monkeypatch, FakeMailbox())
    config = Config(root=tmp_path, start_adapter=False)
    with TestClient(create_app(config)) as client:
        payload = {'address': 'inbox@example.test', 'password': 'synthetic'}
        assert client.post('/internal/mail/gmail-password', json=payload).status_code == 403
        response = client.post('/internal/mail/gmail-password', json=payload, headers={'x-agent-internal': config.adapter_token})
        assert response.status_code == 200
        assert 'synthetic' not in response.text


@pytest.mark.asyncio
async def test_smtp_uncertainty_blocks_second_send(mail, monkeypatch):
    fake_mailbox(monkeypatch, FakeMailbox(b'5'))
    aid = (await mail.gmail_password(GmailPassword(address='inbox@example.test', password='synthetic')))['id']
    await mail.sync(aid, 'default')
    tid = identifier(aid, '1c8')
    mail.draft(Draft(id=tid, revision=1, text='Antwort', version=0))
    def broken(*args):
        raise ValueError('Keine Bestätigung')
    monkeypatch.setattr(mail_imap, 'send', broken)
    assert (await mail.send(Send(id=tid, version=1)))['state'] == 'unknown'
    with pytest.raises(ValueError, match='ungeklärt'):
        await mail.send(Send(id=tid, version=1))
