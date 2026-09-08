import json
from time import time

import pytest
from fastapi.testclient import TestClient
from core.app import create_app
from core.knowledge import Knowledge
from core.settings import Settings
from core.privacy import Privacy, PrivacyOptions, Handoff
from core.tests.test_core import config, db, write_note


def service(config, db):
    return Privacy(db, Settings(db), config, Knowledge(db, config))


def test_preflight_blocks_secrets_without_storing_content(config, db):
    privacy = service(config, db)
    secret = 'sk-' + 'testonly0123456789' * 3
    result = privacy.check(Handoff(kind='worker', text='Bitte prüfen: ' + secret))
    assert not result['allowed'] and result['reason'] == 'credentials'
    report = privacy.export()
    assert secret not in json.dumps(report)
    assert report['handoffs']['blockedPercent'] == 100
    assert report['events'][0]['findings']['credentials'] == 1
    assert report['events'][0]['policy_version'] == 0


def test_options_persist_conflict_and_unknown_review(config, db):
    p = service(config, db)
    options = PrivacyOptions(block_contacts=True, reviews={'purpose': {'status': 'documented', 'note': 'Prüfung in internem Verzeichnis vom 08.09.2026.'}})
    p.save(0, options)
    with pytest.raises(FileExistsError):
        p.save(0, PrivacyOptions())
    restored = service(config, db)
    assert restored.read()['version'] == 1
    assert restored.status()['documentation']['percent'] == 10
    assert not restored.check(Handoff(kind='worker', text='kontakt@example.org'))['allowed']
    with pytest.raises(ValueError):
        PrivacyOptions(reviews={'invented': {'status': 'open'}})
    with pytest.raises(ValueError):
        PrivacyOptions(reviews={'purpose': {'status': 'not_applicable'}})


def test_pause_applies_to_every_registered_external_handoff(config, db):
    p = service(config, db)
    p.save(0, PrivacyOptions(pause_handoffs=True))
    for kind in ['worker', 'title', 'voice', 'connector', 'service', 'image', 'dictation-groq', 'speech-elevenlabs']:
        assert p.check(Handoff(kind=kind, text='Beispiel'))['reason'] == 'paused'
    assert p.check(Handoff(kind='local-test', text='Beispiel'))['allowed']
    assert p.status()['handoffs']['total'] == 9
    assert p.status()['handoffs']['blockedPercent'] == 88.9


def test_contacts_attachments_audio_and_empty_statistics(config, db):
    p = service(config, db)
    assert p.status()['handoffs']['blockedPercent'] is None
    assert p.evaluate(Handoff(kind='worker', text='Jana Muster hat Gesundheitsdaten.'))['allowed']
    p.save(0, PrivacyOptions(block_contacts=True, block_attachments=True))
    assert p.evaluate(Handoff(kind='worker', text='a@example.org'))['reason'] == 'contacts'
    assert p.evaluate(Handoff(kind='worker', text='DE89 3704 0044 0532 0130 00'))['reason'] == 'contacts'
    assert p.evaluate(Handoff(kind='worker', attachments=1))['reason'] == 'attachments'
    assert p.evaluate(Handoff(kind='voice', opaque=True))['reason'] == 'uninspectable'
    assert p.status()['handoffs']['total'] == 0  # previews never inflate the audit


def test_audit_retention_and_failed_write_fail_closed(config, db, monkeypatch):
    p = service(config, db)
    p.check(Handoff(kind='worker', text='Beispiel'))
    with db.transaction() as cx:
        cx.execute('UPDATE privacy_events SET created_at=?', (time() - 10 * 86400,))
    p.save(0, PrivacyOptions(audit_days=7))
    assert p.export()['events'] == []
    with db.transaction() as cx:
        cx.execute('DROP TABLE privacy_events')
    with pytest.raises(Exception):
        p.check(Handoff(kind='worker', text='No audit, no release'))


def test_authenticated_api_preview_export_and_internal_boundary(config):
    with TestClient(create_app(config)) as client:
        assert client.post('/api/privacy/settings', json={'version':0,'values':{}}).status_code == 403
        client.headers['x-uwe-token'] = client.get('/api/auth/session').json()['token']
        preview = client.post('/api/privacy/preview', json={'kind':'worker', 'text':'sk-' + '1234567890' * 4})
        assert preview.status_code == 200 and not preview.json()['allowed']
        assert client.get('/api/privacy/status').json()['handoffs']['total'] == 0
        assert client.post('/api/privacy/settings', json={'version':0,'values':{'block_contacts':True}}).status_code == 200
        assert client.post('/api/privacy/settings', json={'version':0,'values':{}}).status_code == 409
        assert client.post('/internal/privacy/check', json={'kind':'worker'}).status_code == 403
        internal = client.post('/internal/privacy/check', headers={'x-agent-internal':config.adapter_token}, json={'kind':'worker','text':'a@example.org'})
        assert internal.status_code == 200 and not internal.json()['allowed']
        export = client.get('/api/privacy/export')
        assert export.headers['cache-control'] == 'no-store'
        assert 'a@example.org' not in export.text
        assert 'attachment' in export.headers['content-disposition']


def test_search_never_returns_stale_hidden_or_escaped_text(config, db, tmp_path):
    k = Knowledge(db, config)
    file = write_note(config, 'notes/Example.md', '# Example\nAlter vertraulicher Text zum Turm.')
    k.scan()
    assert k.search('Turm', 'default')
    file.write_text('# Example\nFreigegebener neuer Text.')
    assert k.search('Turm', 'default') == []
    assert k.search('', 'default') == []
    k.scan()
    assert k.search('Freigegebener', 'default')
    db.put('memory/hidden/notes/Example.md', True)
    assert k.search('Freigegebener', 'default') == []
    with db.transaction() as cx:
        cx.execute("DELETE FROM records WHERE key LIKE 'memory/hidden/%'")
    file.unlink()
    assert k.search('Freigegebener', 'default') == []
    outside = tmp_path / 'outside.txt'
    outside.write_text('# Example\nFreigegebener neuer Text.')
    file.symlink_to(outside)
    assert k.search('Freigegebener', 'default') == []


def test_search_skips_invalid_hits_before_limit_and_keeps_projects(config, db):
    k = Knowledge(db, config)
    first = write_note(config, 'notes/A.md', '# Suchbegriff\nSuchbegriff')
    write_note(config, 'notes/B.md', '# Suchbegriff\nSuchbegriff')
    k.scan(); first.unlink()
    assert len(k.search('Suchbegriff', 'default', limit=1)) == 1
    assert k.search('Suchbegriff', 'other') == []
