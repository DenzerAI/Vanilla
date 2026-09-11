import gzip

from fastapi.testclient import TestClient

from core.app import create_app
from core.config import Config


def test_static_cache_compression_and_private_boundaries(tmp_path):
    directory = tmp_path / 'wrapper/dist'
    (directory / 'assets').mkdir(parents=True)
    body = b'/* public application code */' * 100
    target = directory / 'assets/app-12345678.js'
    target.write_bytes(body)
    target.with_suffix('.js.gz').write_bytes(gzip.compress(body))
    (directory / 'index.html').write_text('<html>Current version</html>')
    (directory / 'version.json').write_text('{"uiVersion":"current"}')
    (directory / 'login.css').write_text('body { color: black; }')
    app = create_app(Config(root=tmp_path))
    try:
        client = TestClient(app)
        compressed = client.get('/assets/app-12345678.js', headers={'Accept-Encoding':'gzip'})
        assert compressed.content == body
        assert compressed.headers['content-encoding'] == 'gzip'
        assert compressed.headers['cache-control'] == 'public, max-age=31536000, immutable'
        assert compressed.headers['vary'] == 'Accept-Encoding'
        assert 'javascript' in compressed.headers['content-type']
        unchanged = client.get('/assets/app-12345678.js', headers={'Accept-Encoding':'gzip','If-None-Match':compressed.headers['etag']})
        assert unchanged.status_code == 304 and not unchanged.content
        for accepted in ('identity', 'gzip;q=0', 'gzip;q=invalid'):
            plain = client.get('/assets/app-12345678.js', headers={'Accept-Encoding':accepted})
            assert plain.content == body and 'content-encoding' not in plain.headers
        assert client.get('/assets/app-12345678.js', headers={'Accept-Encoding':'*;q=0.5'}).headers['content-encoding'] == 'gzip'
        assert client.get('/assets/app-missing123.js').status_code == 404
        assert client.get('/assets/app-12345678.js.gz').status_code == 404
        for path in ('/', '/index.html', '/version.json', '/api/auth/session'):
            assert client.get(path).headers['cache-control'] == 'no-store'
        assert client.get('/login.css').headers['cache-control'] == 'no-cache'
        partial = client.get('/assets/app-12345678.js', headers={'Range':'bytes=0-9','Accept-Encoding':'gzip'})
        assert partial.status_code == 206 and partial.content == body[:10]
        assert 'content-encoding' not in partial.headers
    finally:
        app.state.db.close()
