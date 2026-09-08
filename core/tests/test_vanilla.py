from pathlib import Path
import subprocess
import pytest
from core.config import Config
from core.secrets import read_secret, save_secret
from core.service import install


def test_external_paths_and_symlink_escape_are_rejected(tmp_path):
    root = tmp_path / 'project'
    root.mkdir()
    outside = tmp_path / 'outside'
    outside.mkdir()
    (root / 'escape').symlink_to(outside, target_is_directory=True)
    for name in ('workspace', 'data', 'embedding_model'):
        for path in (outside, root / 'escape/child'):
            with pytest.raises(ValueError, match='Projektordner'):
                Config(root=root, **{name: str(path) if name == 'embedding_model' else path})
    assert list(outside.iterdir()) == []


@pytest.mark.parametrize('port', [8890, 9090, 80, 65536])
def test_reserved_ports_are_refused(port):
    with pytest.raises(ValueError, match='Port'):
        Config(port=port)
    with pytest.raises(ValueError, match='Port'):
        Config(adapter_port=port)


def test_default_ports_and_paths():
    config = Config()
    assert (config.port, config.adapter_port) == (1989, 1990)
    assert config.data == config.root / 'data/control'
    assert config.workspace == config.root / 'workspaces/default'


def test_host_keychain_and_service_activation_never_run(tmp_path, monkeypatch):
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('Host command attempted'))
    for action in (lambda: read_secret('test'), lambda: save_secret('test', 'synthetic'), lambda: install(Config(root=tmp_path), activate=True)):
        with pytest.raises(ValueError):
            action()
