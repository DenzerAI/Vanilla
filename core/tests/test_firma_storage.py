import json
from core.config import Config
from core.database import Database
from core.storage import Storage, valid_record_key


def test_firma_confirmations_import_once_and_survive_backup(tmp_path):
    root = tmp_path / 'project'
    workspace = root / 'workspace'
    workspace.mkdir(parents=True)
    config = Config(root=root, workspace=workspace, data=root/'data', start_adapter=False)
    config.data.mkdir()
    key = 'control/firma.json'
    original = {'version': 1, 'items': {'start-ziel': {'fingerprint': 'version-a', 'threadId': 'chat-a'}}}
    (config.data/'firma.json').write_text(json.dumps(original))
    db = Database(config.data/'agent.sqlite3')
    storage = Storage(db, config)
    storage.import_legacy()
    assert db.get(key)['value'] == original
    newer = {'version': 1, 'items': {'start-ziel': {'fingerprint': 'version-b', 'threadId': 'chat-a'}}}
    db.put(key, newer)
    storage.import_legacy()
    assert db.get(key)['value'] == newer
    backup = config.data/'backup.sqlite3'
    db.backup(backup)
    db.close()
    restored = Database(backup)
    assert restored.get(key)['value'] == newer
    restored.close()
    assert not valid_record_key('control/../firma.json')


def test_shared_firma_chat_cannot_claim_private_storage(tmp_path):
    from core.app import create_app
    from fastapi.testclient import TestClient
    import asyncio
    app = create_app(Config(root=tmp_path, start_adapter=False))
    db = app.state.db
    chat = {'id': 'firma-example', 'title': 'Firma', 'projectId': 'default', 'firmaItemId': 'start-ziel'}
    db.put('control/state.json', {'chats': [chat], 'projects': []})
    client = TestClient(app)
    token = client.get('/api/auth/session').json()['token']
    result = client.post('/api/chat/privacy/setup', json={'id': 'firma-example', 'pin': '0042'}, headers={'x-uwe-token': token, 'x-chat-client': 'a' * 64})
    assert result.status_code == 409
    assert app.state.chat_privacy.record('firma-example') is None
    asyncio.run(app.state.runtime.client.aclose())
    db.close()
