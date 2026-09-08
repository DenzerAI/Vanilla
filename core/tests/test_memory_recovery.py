"""Shared memory must survive pauses, one bad source and concurrent deliveries."""
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from threading import Event

import pytest

from core.tests.test_core import config, db, write_note
from core.knowledge import Knowledge
from core.memory import Memory
from core.settings import Settings


def services(config, db):
    settings = Settings(db)
    knowledge = Knowledge(db, config)
    return settings, knowledge, Memory(db, config, knowledge, settings)


def source(db, memory, chat='chat1', turns=1):
    thread = {'id': chat, 'turns': [
        {'id': f'turn{i}', 'status': 'completed', 'items': [
            {'type': 'agentMessage', 'text': f'Suchbarer Projektbeschluss {i}.'}
        ]} for i in range(turns)
    ]}
    key = f'workspace/chats/{chat}/transcript.json'
    db.put(key, thread)
    memory.queue_capture(key, thread)
    return key, thread


def test_paused_capture_survives_restart_and_resumes_once(config, db):
    settings, knowledge, memory = services(config, db)
    db.put('control/state.json', {'chats': [{'id': 'chat1', 'projectId': 'default'}]})
    settings.set_group('memory', capture=False)
    source(db, memory)
    assert memory.flush()['pending'] == 1
    restarted = Memory(db, config, knowledge, settings)
    assert restarted.pending == {'chat1'}
    settings.set_group('memory', capture=True)
    assert restarted.flush()['captured'] == 1
    assert restarted.flush()['captured'] == 0
    knowledge.scan()
    assert knowledge.search('Projektbeschluss', 'default')


def test_bad_source_does_not_block_other_chats_and_is_retried(config, db, monkeypatch):
    _, _, memory = services(config, db)
    db.put('control/state.json', {'chats': [{'id': id, 'projectId': 'default'} for id in ['a', 'b']]})
    source(db, memory, 'a')
    source(db, memory, 'b')
    original = memory.capture
    def broken(id):
        if id == 'a':
            raise OSError('temporary read failure')
        return original(id)
    monkeypatch.setattr(memory, 'capture', broken)
    with pytest.raises(ValueError, match='1 Gespräch'):
        memory.flush()
    assert memory.pending == {'a'}
    assert db.rows('SELECT chat_id FROM memory_sources') == [{'chat_id': 'b'}]
    assert memory.dream()['entries'] == 1
    assert memory.pending == {'a'}
    monkeypatch.setattr(memory, 'capture', original)
    assert memory.flush()['captured'] == 1
    assert memory.pending == set()


def test_delivery_during_flush_keeps_new_turn_pending(config, db, monkeypatch):
    _, _, memory = services(config, db)
    db.put('control/state.json', {'chats': [{'id': 'chat1', 'projectId': 'default'}]})
    source(db, memory)
    captured, release = Event(), Event()
    original = memory.capture
    def delayed(id):
        count = original(id)
        captured.set()
        assert release.wait(5)
        return count
    monkeypatch.setattr(memory, 'capture', delayed)
    with ThreadPoolExecutor(2) as pool:
        first = pool.submit(memory.flush)
        assert captured.wait(5)
        # Persist a second turn while the first capture is still being acknowledged.
        thread = db.get('workspace/chats/chat1/transcript.json')['value']
        thread['turns'].append({'id': 'new', 'status': 'completed', 'items': [{'type': 'agentMessage', 'text': 'Neuer Beschluss.'}]})
        db.put('workspace/chats/chat1/transcript.json', thread)
        queued = pool.submit(memory.queue_capture, 'workspace/chats/chat1/transcript.json', thread)
        try:
            # The enqueue must wait until the existing capture is acknowledged.
            with pytest.raises(FutureTimeout):
                queued.result(timeout=0.1)
        finally:
            release.set()
        first.result(timeout=5)
        queued.result(timeout=5)
    assert memory.pending == {'chat1'}
    monkeypatch.setattr(memory, 'capture', original)
    assert memory.flush()['captured'] == 1
    assert len(db.rows('SELECT id FROM memory_sources')) == 2


def test_shared_notes_are_filtered_before_ranking_and_never_share_private_notes(config, db):
    settings, knowledge, memory = services(config, db)
    db.put('control/state.json', {'projects': [{'id': 'project1', 'name': 'Projekt', 'path': 'projects/project1'}]})
    (config.workspace / 'projects/project1').mkdir(parents=True)
    for i in range(8):
        write_note(config, f'notes/Private{i}.md', '# Projektbeschluss\nProjektbeschluss bleibt vertraulich.')
    shared = write_note(config, 'notes/shared/Freigabe.md', '# Freigabe\nProjektbeschluss gemeinsam verfügbar.')
    knowledge.scan()
    assert memory.context('Projektbeschluss', 'project1')['sources'] == []
    settings.set_group('memory', shared_notes=True)
    result = memory.context('Projektbeschluss', 'project1')
    assert [s['path'] for s in result['sources']] == ['notes/shared/Freigabe.md']
    assert 'vertraulich' not in str(result)
    # A deleted shared source must not break the prompt or leak stale index text.
    shared.unlink()
    assert memory.context('Projektbeschluss', 'project1')['sources'] == []
