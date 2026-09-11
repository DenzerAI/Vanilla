from fastapi.testclient import TestClient
from core.app import create_app
from core.config import Config


def test_statistics_exclusions_are_internal_and_never_contain_pin_material(tmp_path):
    app = create_app(Config(root=tmp_path, start_adapter=False))
    db = app.state.db
    db.put('chat-privacy/private-example', {'hash': 'example-sensitive-hash', 'salt': 'example-salt'})
    db.put('chat-privacy/removed-example', None)
    client = TestClient(app)
    assert client.get('/internal/chat-privacy/ids').status_code == 403
    response = client.get('/internal/chat-privacy/ids', headers=app.state.runtime.headers)
    assert response.status_code == 200
    assert response.json() == {'ids': ['private-example']}
    assert 'hash' not in response.text and 'salt' not in response.text
    db.close()
