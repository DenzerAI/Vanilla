"""Installation integrity and actual offline semantic search (opt-in model fixture)."""
import hashlib
import io
import json
import os
from pathlib import Path
from contextlib import closing

import pytest

from core import models, isolation
from core.config import Config
from core.database import Database
from core.knowledge import Knowledge, LocalEmbeddings


@pytest.fixture
def assets(tmp_path, monkeypatch):
    monkeypatch.setattr(isolation, 'ROOT', tmp_path.resolve())
    content = {'modules.json': b'[]', 'model.safetensors': b'synthetic-weights'}
    monkeypatch.setattr(models, 'FILES', {name: (len(value), hashlib.sha256(value).hexdigest()) for name, value in content.items()})
    monkeypatch.setattr(models.importlib.util, 'find_spec', lambda name: True)
    monkeypatch.setattr(models, 'probe_model', lambda path: {'dimensions': 384, 'localOnly': True})
    monkeypatch.setattr(models, 'resource_profile', lambda path: {'freeBytes': 10**10})
    downloaded = []
    def download(path, name):
        downloaded.append(name)
        (path / name).write_bytes(content[name])
    monkeypatch.setattr(models, 'download_file', download)
    return tmp_path.resolve() / 'models', content, downloaded


def test_install_rechecks_content_and_repairs_only_damaged_files(assets, monkeypatch):
    path, content, calls = assets
    models.install_model(path)
    assert json.loads((path / 'source.json').read_text())['verified']
    calls.clear()
    models.install_model(path)
    assert calls == []
    (path / 'model.safetensors').write_bytes(b'x' * len(content['model.safetensors']))
    models.install_model(path)
    assert calls == ['model.safetensors']
    models.verify_model(path)


def test_marker_without_weights_is_not_an_installation(assets):
    path, _, calls = assets
    path.mkdir()
    (path / 'modules.json').write_text('[]')
    (path / 'source.json').write_text('{}')
    with pytest.raises(ValueError, match='beschädigt'):
        models.verify_model(path)
    models.install_model(path)
    assert calls == ['model.safetensors']


def test_failed_probe_never_leaves_success_marker(assets, monkeypatch):
    path, _, calls = assets
    models.install_model(path)
    calls.clear()
    def fail(path):
        raise ValueError('synthetic inference failure')
    monkeypatch.setattr(models, 'probe_model', fail)
    with pytest.raises(ValueError, match='inference'):
        models.install_model(path)
    assert not (path / 'source.json').exists()
    assert calls == []


def test_interrupted_install_retains_verified_files(assets, monkeypatch):
    path, _, calls = assets
    original = models.download_file
    def fail(path, name):
        if name == 'model.safetensors':
            raise OSError('interrupted')
        original(path, name)
    monkeypatch.setattr(models, 'download_file', fail)
    with pytest.raises(OSError):
        models.install_model(path)
    monkeypatch.setattr(models, 'download_file', original)
    calls.clear()
    models.install_model(path)
    assert calls == ['model.safetensors']


def test_install_lock_and_symlinks(assets):
    path, _, _ = assets
    with models.model_lock(path, exclusive=True):
        with pytest.raises(ValueError, match='gerade'):
            models.install_model(path)
    path.mkdir()
    target = path.parent / 'untouched'
    target.write_text('original')
    (path / 'model.safetensors').symlink_to(target)
    with pytest.raises(ValueError, match='Symlink'):
        models.install_model(path)
    assert target.read_text() == 'original'


@pytest.mark.parametrize('resume', [True, False])
def test_download_resumes_or_restarts_when_server_ignores_range(tmp_path, monkeypatch, resume):
    content = b'complete model asset'
    monkeypatch.setattr(models, 'FILES', {'model': (len(content), hashlib.sha256(content).hexdigest())})
    partial = tmp_path / '.download/model.part'
    partial.parent.mkdir()
    partial.write_bytes(content[:5])
    def response(request, timeout):
        assert request.headers['Range'] == 'bytes=5-'
        r = io.BytesIO(content[5:] if resume else content)
        r.status = 206 if resume else 200
        r.headers = {'Content-Range': f'bytes 5-{len(content)-1}/{len(content)}'} if resume else {}
        return r
    monkeypatch.setattr(models.urllib.request, 'urlopen', response)
    models.download_file(tmp_path, 'model')
    assert (tmp_path / 'model').read_bytes() == content
    assert not partial.exists()


def test_download_rejects_corrupt_complete_response(tmp_path, monkeypatch):
    monkeypatch.setattr(models, 'FILES', {'model': (4, hashlib.sha256(b'good').hexdigest())})
    def response(*args, **kwargs):
        r = io.BytesIO(b'evil'); r.status = 200; r.headers = {}; return r
    monkeypatch.setattr(models.urllib.request, 'urlopen', response)
    with pytest.raises(ValueError, match='Prüfsumme'):
        models.download_file(tmp_path, 'model')
    assert not (tmp_path / 'model').exists()
    assert not (tmp_path / '.download/model.part').exists()


def test_low_disk_fails_before_downloading(assets, monkeypatch):
    path, _, calls = assets
    monkeypatch.setattr(models, 'resource_profile', lambda path: {'freeBytes': 100})
    with pytest.raises(ValueError, match='Speicher'):
        models.install_model(path)
    assert not calls


def test_hardware_profiles_are_cpu_bounded(tmp_path, monkeypatch):
    monkeypatch.setattr(models.platform, 'system', lambda: 'Linux')
    monkeypatch.setattr(models.platform, 'machine', lambda: 'aarch64')
    monkeypatch.setattr(models.platform, 'libc_ver', lambda: ('glibc', '2.28'))
    monkeypatch.setattr(models.os, 'sysconf', lambda key: 4096 if key == 'SC_PAGE_SIZE' else 4 * 1024**2)
    monkeypatch.setattr(models.os, 'cpu_count', lambda: 64)
    profile = models.resource_profile(tmp_path)
    assert profile['threads'] == 2 and profile['device'] == 'cpu' and profile['batchSize'] == 8
    monkeypatch.setattr(models.os, 'sysconf', lambda key: 1024)
    with pytest.raises(ValueError, match='RAM'):
        models.resource_profile(tmp_path)
    monkeypatch.setattr(models.platform, 'system', lambda: 'Windows')
    with pytest.raises(ValueError, match='unterstützt'):
        models.resource_profile(tmp_path)


def test_failed_inference_is_not_ready(tmp_path, monkeypatch):
    model_path = tmp_path / 'custom'; model_path.mkdir()
    (model_path / 'config.json').write_text('{}')
    config = Config(root=tmp_path, embedding_model=str(model_path))
    embeddings = LocalEmbeddings(config)
    assert embeddings.status()['state'] == 'installed'
    class Broken:
        def encode(self, *args, **kwargs):
            raise ValueError('synthetic')
    monkeypatch.setattr(models, 'load_model', lambda path: Broken())
    assert embeddings.encode(['text']) is None
    assert embeddings.status()['state'] == 'error' and not embeddings.status()['ready']


def test_empty_index_probes_model_and_missing_model_keeps_word_search(tmp_path):
    config = Config(root=tmp_path)
    with closing(Database(config.data / 'agent.sqlite3')) as db:
        knowledge = Knowledge(db, config)
        assert not knowledge.embed()['ready']
        knowledge.index('notes/test.md', 'default', 'Ein Windrad erzeugt Strom.')
        assert knowledge.search('Windrad')[0]['path'] == 'notes/test.md'
        assert knowledge.embeddings.status()['state'] == 'missing'


def test_real_german_search_offline_and_long_passages(tmp_path, monkeypatch):
    fixture = os.getenv('VANILLA_TEST_EMBEDDING_MODEL')
    if not fixture:
        pytest.skip('Set VANILLA_TEST_EMBEDDING_MODEL to the explicitly installed model directory')
    source = Path(fixture).resolve()
    # Fixture stays local to its own installation; test data stays isolated.
    root = source.parents[1]
    config = Config(root=root, data=root / '.verify/semantic-test-data',
                    workspace=root / '.verify/semantic-test-workspace', embedding_model=str(source))
    import socket
    def no_network(*args, **kwargs):
        raise AssertionError('Offline inference tried to access the network')
    monkeypatch.setattr(socket.socket, 'connect', no_network)
    monkeypatch.setattr(socket.socket, 'connect_ex', no_network)
    models.verify_model(source)
    assert models.probe_model(source)['dimensions'] == 384
    database = Database(tmp_path / 'search.sqlite3')
    try:
        knowledge = Knowledge(database, config)
        knowledge.index('notes/one.md', 'default', 'Die Solaranlage auf dem Dach erzeugt elektrischen Strom.')
        knowledge.index('notes/two.md', 'default', 'Ein Kuchen wird im Backofen gebacken.')
        knowledge.index('notes/three.md', 'default', ('Holztische stehen im Lager. ' * 120) + 'Bei Feuer verlassen alle Mitarbeiter das Gebäude über den Notausgang.')
        knowledge.index('notes/private.md', 'other', 'Photovoltaik liefert Energie.')
        assert knowledge.embed()['indexed'] == 4
        assert knowledge.embed()['indexed'] == 0
        hit = knowledge.search('Photovoltaik liefert Energie', project='default')[0]
        assert hit['path'] == 'notes/one.md' and 'semantic' in hit['method']
        hit = knowledge.search('Evakuierung im Brandfall', project='default')[0]
        assert hit['path'] == 'notes/three.md' and 'Notausgang' in hit['passage']
        assert all(r['projectId'] == 'default' for r in knowledge.search('Photovoltaik', project='default'))
        knowledge.index('notes/one.md', 'default', 'Das Dokument ist jetzt leer.')
        assert not database.rows("SELECT * FROM vectors WHERE path='notes/one.md'")
    finally:
        database.close()


def test_missing_runtime_fails_before_download(assets, monkeypatch):
    path, _, calls = assets
    monkeypatch.setattr(models.importlib.util, 'find_spec', lambda name: None)
    with pytest.raises(ImportError, match='Suchlaufzeit'):
        models.install_model(path)
    assert calls == []


def test_setup_does_not_confirm_failed_index(tmp_path, monkeypatch):
    import asyncio
    import threading
    from types import SimpleNamespace
    from core import api
    monkeypatch.setattr(models, 'install_model', lambda path: str(path))
    monkeypatch.setattr(api, 'LocalEmbeddings', lambda config: object())
    operation = SimpleNamespace(config=SimpleNamespace(data=tmp_path, embedding_model=''),
                               knowledge=SimpleNamespace(lock=threading.RLock()),
                               run=lambda action: {'embeddingIndex': {'ready': False, 'error': 'synthetic failure'}})
    router = api.routes(operation, None)
    endpoint = next(r.endpoint for r in router.routes if r.path == '/api/system/setup')
    with pytest.raises(ValueError, match='synthetic failure'):
        asyncio.run(endpoint(api.Action(action='embeddings')))


def test_unavailable_embeddings_remain_in_system_checks(tmp_path):
    from core.tests.test_operations import services
    config = Config(root=tmp_path, start_adapter=False)
    with closing(Database(config.data / 'agent.sqlite3')) as db:
        _, _, _, operations, _, _, _ = services(config, db)
        assert operations.checks()['embeddings']['ok'] is False
        assert operations.run('index')['embeddingIndex']['ready'] is False
        assert db.rows("SELECT status FROM maintenance WHERE name='index'")[0]['status'] == 'error'
