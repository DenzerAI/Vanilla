import asyncio
import json
from time import time

import httpx
import pytest
from fastapi.testclient import TestClient

from core.app import create_app
from core.config import Config


@pytest.fixture
def fixture(tmp_path):
    app = create_app(Config(root=tmp_path, start_adapter=False))
    db = app.state.db
    chat = {'id': 'private-example', 'title': 'Confidential example', 'projectId': 'default'}
    public = {'id': 'public-example', 'title': 'Public example', 'projectId': 'default'}
    db.put('control/state.json', {'chats': [chat, public], 'projects': []})
    thread = {'id': chat['id'], 'turns': [{'id': 'turn-one', 'status': 'completed', 'items': [{'id': 'answer', 'type': 'agentMessage', 'text': 'Confidential body'}]}]}
    db.put('workspace/chats/private-example/transcript.json', thread)
    requests = []

    def adapter(request):
        requests.append(request)
        route = request.url.path
        if route.endswith('/thread'):
            return httpx.Response(200, json={'thread': thread})
        if route.endswith('/thread/item'):
            return httpx.Response(200, json={'item': {'id':'tool', 'aggregatedOutput':'Confidential tool result'}})
        if route.endswith('/search'):
            return httpx.Response(200, json={'results': [{**chat, 'snippet': 'Confidential body'}], 'total': 1})
        return httpx.Response(200, json={'chats': [chat, public], 'active': {chat['id']: 'turn-one'}, 'requests': [{'id': 'ask', 'params': {'threadId': chat['id'], 'text': 'Confidential request'}}]})

    app.state.runtime.client = httpx.AsyncClient(transport=httpx.MockTransport(adapter))
    client = TestClient(app)
    client.headers.update({'x-uwe-token': client.get('/api/auth/session').json()['token'], 'x-chat-client': 'a' * 64})
    yield app, client, requests
    asyncio.run(app.state.runtime.client.aclose())
    db.close()


def call(client, action, pin=None):
    return client.post('/api/chat/privacy/' + action, json={'id': 'private-example', **({'pin': pin} if pin is not None else {})})


def test_deferred_tool_details_keep_chat_privacy_and_never_cache(fixture):
    app, client, requests = fixture
    assert call(client, 'setup', '0042').status_code == 200
    url = '/api/thread/item?id=private-example&turnId=turn-one&itemId=tool'
    count = len(requests)
    assert client.get(url).status_code == 423
    assert len(requests) == count
    assert call(client, 'unlock', '0042').status_code == 200
    response = client.get(url)
    assert response.json()['item']['aggregatedOutput'] == 'Confidential tool result'
    assert response.headers['cache-control'] == 'no-store'
    assert client.get(url, headers={'x-chat-client':'b'*64}).status_code == 423
    assert call(client, 'lock').status_code == 200
    assert client.get(url).status_code == 423


def test_setup_masks_lists_and_enforces_every_chat_route(fixture):
    app, client, requests = fixture
    assert call(client, 'setup', '0042').status_code == 200
    result = client.get('/api/bootstrap').json()
    assert result['chats'][0]['title'] == 'Privater Chat'
    assert result['chats'][0]['locked'] is True
    assert result['chats'][1]['title'] == 'Public example'
    assert result['requests'] == [] and result['active'] == {}
    assert 'Confidential' not in json.dumps(result)
    before = len(requests)
    for route in ('turn', 'stop', 'fork', 'turn/delete', 'chat/update', 'worker-command', 'worker-session', 'voice/start', 'chat/read', 'chat/provider', 'messages', 'messages/edit', 'messages/resume'):
        assert client.post('/api/' + route, json={'id': 'private-example'}).status_code == 423
    assert client.get('/api/thread?id=private-example').status_code == 423
    assert client.get('/api/messages?id=private-example').status_code == 423
    assert client.get('/api/worker-commands?id=private-example').status_code == 423
    assert len(requests) == before
    for route in ('file/raw', 'file/text', 'file/info', 'file/preview', 'agent/files'):
        assert client.get('/api/' + route, params={'path': 'chats/private-example/transcript.json'}).status_code == 423
    assert client.get('/api/search?q=confidential').json()['results'] == []
    record = app.state.chat_privacy.record('private-example')
    assert '0042' not in json.dumps(record)
    assert app.state.operations.memory.capture('private-example') == 0


def test_unlock_is_tab_scoped_expiring_and_lock_revokes_all(fixture):
    app, client, _ = fixture
    privacy = app.state.chat_privacy
    assert call(client, 'setup', '0042').status_code == 200
    assert call(client, 'unlock', '0000').status_code == 403
    assert call(client, 'unlock', '0042').status_code == 200
    assert client.get('/api/thread?id=private-example').json()['thread']['turns']
    assert client.get('/api/bootstrap').json()['chats'][0]['locked'] is False
    assert client.get('/api/thread?id=private-example', headers={'x-chat-client': 'b' * 64}).status_code == 423
    assert client.get('/api/thread?id=private-example', headers={'x-chat-client': ''}).status_code == 423
    assert client.get('/api/search?q=confidential').json()['results'] == []
    privacy.grants['private-example', 'a'*64] = time() - 1
    assert client.get('/api/thread?id=private-example').status_code == 423
    assert call(client, 'touch').status_code == 423
    assert call(client, 'unlock', '0042').status_code == 200
    client.headers['x-chat-client'] = 'b'*64
    assert call(client, 'unlock', '0042').status_code == 200
    assert call(client, 'lock').status_code == 200
    assert not privacy.allowed('private-example', 'a'*64)
    assert not privacy.allowed('private-example', 'b'*64)


def test_pin_validation_throttling_persistence_and_removal(fixture):
    app, client, _ = fixture
    for pin in ('', '123', '12345', 'abcd', 1234, '١٢٣٤'):
        assert call(client, 'setup', pin).status_code == 400
    assert call(client, 'setup', '0042').status_code == 200
    assert call(client, 'setup', '9876').status_code == 409
    for _ in range(5):
        assert call(client, 'unlock', '0000').status_code == 403
    assert call(client, 'unlock', '0042').status_code == 429
    from core.chat_privacy import ChatPrivacy
    restarted = ChatPrivacy(app.state.db, app.state.operations.memory)
    assert restarted.record('private-example')['retryAt'] > time()
    record = restarted.record('private-example')
    record['retryAt'] = 0
    app.state.db.put('chat-privacy/private-example', record)
    assert call(client, 'remove', '0000').status_code == 403
    record['retryAt'] = 0
    app.state.db.put('chat-privacy/private-example', record)
    assert call(client, 'remove', '0042').status_code == 200
    assert client.get('/api/bootstrap').json()['chats'][0]['title'] == 'Confidential example'
    assert 'private-example' in app.state.operations.memory.settings.values['memory']['excluded_chats']


def test_stream_filters_deltas_requests_replay_and_nested_threads(fixture):
    app, client, _ = fixture
    call(client, 'setup', '0042')
    privacy = app.state.chat_privacy
    events = [
        {'method': 'item/agentMessage/delta', 'params': {'threadId': 'private-example', 'delta': 'Confidential delta'}},
        {'method': 'wrapper/request', 'params': {'id': 'ask', 'params': {'threadId': 'private-example', 'text': 'Confidential request'}}},
        {'method': 'wrapper/thread', 'params': {'thread': {'id': 'private-example', 'turns': ['Confidential body']}}},
        {'method': 'core/event', 'params': {'kind': 'memory.changed', 'entity_id': 'private-example', 'payload': {'text': 'Confidential event'}}},
        {'method': 'core/event', 'params': {'kind': 'chat.privacy', 'entity_id': 'private-example', 'payload': {}}},
        {'method': 'wrapper/chats'},
    ]

    async def read():
        async def frames():
            for event in events:
                yield 'data: ' + json.dumps(event) + '\n\n'
        return ''.join([frame async for frame in privacy.stream(frames(), 'a'*64)])

    result = asyncio.run(read())
    assert 'Confidential' not in result
    assert 'chat/privacy' in result and 'private-example' in result
    assert 'wrapper/chats' in result


def test_existing_memory_is_removed_and_cleanup_failure_stays_private(fixture, monkeypatch):
    app, client, _ = fixture
    memory = app.state.operations.memory
    assert memory.capture('private-example') == 1
    memory.dream()
    memory.knowledge.scan()
    assert memory.knowledge.search('Confidential', 'default')
    assert call(client, 'setup', '0042').status_code == 200
    assert not memory.knowledge.search('Confidential', 'default')
    assert memory.capture('private-example') == 0


def test_failed_memory_cleanup_quarantines_sources(fixture, monkeypatch):
    app, client, _ = fixture
    memory = app.state.operations.memory
    memory.capture('private-example')
    memory.dream()
    memory.knowledge.scan()
    def fail(id):
        raise OSError('test failure')
    monkeypatch.setattr(memory, 'forget_chat', fail)
    assert call(client, 'setup', '0042').status_code == 503
    assert client.get('/api/thread?id=private-example').status_code == 423
    assert not memory.knowledge.search('Confidential', 'default')
    assert client.get('/api/file/text?path=brain/memory/Ergebnisse.md').status_code == 423


def test_respond_and_report_alias_cannot_bypass_lock(fixture):
    app, client, _ = fixture
    call(client, 'setup', '0042')
    assert client.post('/api/respond', json={'id':'ask','result':'Confidential choice'}).status_code == 423
    with app.state.db.transaction() as cx:
        cx.execute("UPDATE chats SET data=json_set(data,'$.briefingId','report-example') WHERE id='private-example'")
    assert app.state.chat_privacy.sanitize({'id':'report-example','body':'Confidential report'}, omit=True) is None
    assert client.get('/api/notifications/item?id=report-example').status_code == 423
