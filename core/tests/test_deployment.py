import importlib.util
import json
from pathlib import Path
import subprocess

import pytest


def script(name):
    path = Path(__file__).resolve().parents[2] / 'scripts' / (name + '.py')
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_export_rejects_even_git_tracked_runtime_files(tmp_path):
    export = script('publish-source')
    subprocess.run(['git', 'init', '-q', str(tmp_path)], check=True)
    (tmp_path / 'data').mkdir()
    (tmp_path / 'data/agent.sqlite3').write_text('synthetic')
    subprocess.run(['git', '-C', str(tmp_path), 'add', '.'], check=True)
    with pytest.raises(ValueError, match='prohibited'):
        export.source_files(tmp_path)


def test_export_rejects_symlinks(tmp_path):
    export = script('publish-source')
    subprocess.run(['git', 'init', '-q', str(tmp_path)], check=True)
    (tmp_path / 'real.py').write_text('synthetic')
    (tmp_path / 'linked.py').symlink_to('real.py')
    with pytest.raises(ValueError, match='prohibited'):
        export.source_files(tmp_path)


def test_temporary_runtime_cannot_activate_even_with_own_git(tmp_path):
    host = script('host-service')
    (tmp_path / '.git').mkdir()
    with pytest.raises(ValueError, match='stable'):
        host.stable_root(tmp_path)


def test_https_preserves_existing_443_and_other_handlers(monkeypatch):
    host = script('host-service')
    origin = 'https://test.tail-example.ts.net:1989'
    before = {'TCP': {'443': {'HTTPS': True}},
              'Web': {'test.tail-example.ts.net:443': {'Handlers': {'/': {'Proxy': 'http://localhost:8890'}}}}}
    after = json.loads(json.dumps(before))
    after['TCP']['1989'] = {'HTTPS': True}
    after['Web']['test.tail-example.ts.net:1989'] = {'Handlers': {'/': {'Proxy': 'http://127.0.0.1:1989'}}}
    answers = iter([json.dumps({'BackendState': 'Running', 'Self': {'DNSName': 'test.tail-example.ts.net.'}}),
                    json.dumps(before), '', json.dumps(after)])
    calls, checks = [], []
    def command(*args):
        calls.append(args)
        return next(answers)
    monkeypatch.setattr(host, 'command', command)
    monkeypatch.setattr(host, 'ready', lambda *args: checks.append(args))
    host.serve('test-tailscale', origin)
    assert calls[2] == ('test-tailscale', 'serve', '--https=1989', '--bg', 'http://127.0.0.1:1989')
    assert checks == [(), (origin,)]


@pytest.mark.parametrize('config', [
    {'Web': {'test.tail-example.ts.net:1989': {'Handlers': {'/': {'Proxy': 'http://localhost:7777'}}}}},
    {'TCP': {'1989': {'TCPForward': 'localhost:7777'}}},
    {'AllowFunnel': {'test.tail-example.ts.net:1989': True}},
])
def test_https_refuses_occupied_or_public_port(monkeypatch, config):
    host = script('host-service')
    calls = []
    def command(*args):
        calls.append(args)
        if len(calls) == 1:
            return json.dumps({'BackendState': 'Running', 'Self': {'DNSName': 'test.tail-example.ts.net.'}})
        return json.dumps(config)
    monkeypatch.setattr(host, 'command', command)
    with pytest.raises(ValueError):
        host.serve('test-tailscale', 'https://test.tail-example.ts.net:1989')
    assert len(calls) == 2  # Read-only checks; no mutation.


def test_native_cli_failure_is_not_retried(monkeypatch):
    host = script('host-service')
    calls = []
    def command(*args):
        calls.append(args)
        raise subprocess.CalledProcessError(134, args)
    monkeypatch.setattr(host, 'command', command)
    with pytest.raises(subprocess.CalledProcessError):
        host.serve('test-tailscale', 'https://test.tail-example.ts.net:1989')
    assert len(calls) == 1


@pytest.mark.parametrize('change', ['revision', 'build', 'origin', 'heartbeat'])
def test_loaded_service_cannot_hide_stale_or_partial_deployment(tmp_path, monkeypatch, change):
    from core.config import Config
    host = script('host-service')
    config = Config(root=tmp_path)
    directory = config.data / 'services'
    directory.mkdir(parents=True)
    (directory / 'host-activation.json').write_text(json.dumps({
        'revision': 'expected', 'build_sha256': 'expected', 'origin': 'https://test.tail-example.ts.net:1989'}))
    monkeypatch.setattr(host, 'revision', lambda: 'changed' if change == 'revision' else 'expected')
    monkeypatch.setattr(host, 'build_digest', lambda: 'changed' if change == 'build' else 'expected')
    monkeypatch.setattr(host, 'loaded', lambda name: not (change == 'heartbeat' and name.endswith('.heartbeat')))
    origin = 'https://other.tail-example.ts.net:1989' if change == 'origin' else 'https://test.tail-example.ts.net:1989'
    with pytest.raises(ValueError):
        host.require_deployment(config, origin)


def test_managed_https_does_not_launch_native_cli(monkeypatch):
    from core.operations import Operations
    from types import SimpleNamespace
    import httpx
    op = Operations.__new__(Operations)
    op.config = SimpleNamespace(public_origin='https://test.tail-example.ts.net:1989')
    op.network_cache = (0, {})
    monkeypatch.setenv('VANILLA_MANAGED_HTTPS', '1')
    monkeypatch.setattr(subprocess, 'run', lambda *a, **k: pytest.fail('Native CLI was launched'))
    def unavailable(*a, **k):
        raise httpx.ConnectError('synthetic unavailable endpoint')
    monkeypatch.setattr(httpx.Client, 'get', unavailable)
    assert op.tailscale()['serving'] is False
    assert op.tailscale()['certificateVerified'] is False
