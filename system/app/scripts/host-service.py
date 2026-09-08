#!/usr/bin/env python3
"""Operator-only launchd/Serve setup for this isolated 1989/1990 instance."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.config import Config
from core.layout import ROOT as INSTALLATION
SOURCE = ROOT
ROOT = INSTALLATION
from core.service import install, label
import httpx


def command(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=30).stdout.strip()


def stable_root(root=ROOT):
    resolved = root.resolve()
    if (not (root / '.git').is_dir() or resolved.is_relative_to(Path(tempfile.gettempdir()).resolve())
            or any(part in {'werkbank', 'worktrees', '.verify'} for part in resolved.parts)):
        raise ValueError('Host services require a stable, standalone Git clone outside temporary worktrees.')


def revision():
    if command('git', '-C', str(ROOT), 'status', '--porcelain'):
        raise ValueError('Commit or discard local source changes before deployment.')
    local = command('git', '-C', str(ROOT), 'rev-parse', 'HEAD')
    remote = command('git', '-C', str(ROOT), 'ls-remote', 'origin', 'refs/heads/main').split()[0]
    if local != remote:
        raise ValueError('Runtime source differs from origin/main.')
    return local


def build_digest():
    dist = SOURCE / 'wrapper/dist'
    if not (dist / 'index.html').is_file() or not (dist / 'version.json').is_file():
        raise ValueError('The central verification gate must build the UI first.')
    digest = hashlib.sha256()
    for path in sorted(dist.rglob('*')):
        if path.is_symlink():
            raise ValueError('Build contains a symbolic link.')
        if path.is_file():
            digest.update(str(path.relative_to(dist)).encode() + b'\0' + path.read_bytes() + b'\0')
    return digest.hexdigest()


def require_free_ports():
    for port in (1989, 1990):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', port))


def loaded(name):
    result = subprocess.run(['launchctl', 'print', f'gui/{os.getuid()}/{name}'], capture_output=True)
    return result.returncode == 0


def ready(origin='http://127.0.0.1:1989', timeout=45):
    deadline = time.monotonic() + timeout
    with httpx.Client(trust_env=False, timeout=4) as client:
        while time.monotonic() < deadline:
            try:
                response = client.get(origin + '/api/core/status')
                response.raise_for_status()
                status = response.json()
                health = client.get(origin + '/healthz')
                health.raise_for_status()
                if (status.get('backend') == 'FastAPI' and status.get('storage') == 'SQLite'
                        and not status.get('runtimeError') and health.json()['checks']['adapter']['ok']):
                    return status
            except (httpx.HTTPError, ValueError, KeyError):
                pass
            time.sleep(.3)
    raise RuntimeError('Core and adapter did not become ready.')


def service_install(config, origin):
    seal = json.loads((ROOT / '.verify/build.json').read_text())
    if seal != {'revision': revision(), 'build_sha256': build_digest()}:
        raise ValueError('The UI build does not match the verified source revision.')
    node = shutil.which('node')
    if not node or not (SOURCE / '.venv/bin/python').is_file():
        raise ValueError('Install the project dependencies first.')
    name = label(config)
    if loaded(name):
        raise ValueError('Service already loaded. Use status or restart; configuration is unchanged.')
    require_free_ports()  # Never terminate another listener, including predecessors.
    install(config)  # Reuse the existing local templates; app activation stays forbidden.
    destination = Path.home() / 'Library/LaunchAgents'
    destination.mkdir(parents=True, exist_ok=True)
    for suffix in ('', '.heartbeat'):
        file = config.data / 'services' / (name + suffix + '.plist')
        definition = plistlib.loads(file.read_bytes())
        definition['ProgramArguments'][0] = str(SOURCE / '.venv/bin/python')
        definition['EnvironmentVariables'].update(
            PATH=str(Path(node).parent) + ':/usr/bin:/bin:/usr/sbin:/sbin',
            AGENT_PUBLIC_ORIGIN=origin, VANILLA_MANAGED_HTTPS='1')
        definition['SoftResourceLimits'] = {'NumberOfFiles': 8192}
        definition['HardResourceLimits'] = {'NumberOfFiles': 8192}
        target = destination / file.name
        if target.is_symlink() or (target.exists() and plistlib.loads(target.read_bytes()).get('WorkingDirectory') != str(ROOT)):
            raise ValueError('Refusing to replace a foreign service definition.')
        target.write_bytes(plistlib.dumps(definition))
        target.chmod(0o600)
        if not loaded(name + suffix):
            command('launchctl', 'bootstrap', f'gui/{os.getuid()}', str(target))
    ready()
    (config.data / 'services/host-activation.json').write_text(json.dumps({**seal, 'origin': origin}))


def require_deployment(config, origin=None):
    record = json.loads((config.data / 'services/host-activation.json').read_text())
    if record.get('revision') != revision() or record.get('build_sha256') != build_digest():
        raise ValueError('The running deployment no longer matches the source and UI build.')
    if origin is not None and record.get('origin') != origin:
        raise ValueError('The loaded service uses a different HTTPS origin. Stop and reinstall it.')
    if not all(loaded(label(config) + suffix) for suffix in ('', '.heartbeat')):
        raise ValueError('The core and heartbeat services must both be loaded.')
    return record


def serve(binary, origin):
    # No retry after a failed native CLI call and no reset/set-config/global changes.
    status = json.loads(command(binary, 'status', '--json'))
    dns = status.get('Self', {}).get('DNSName', '').rstrip('.')
    if status.get('BackendState') != 'Running' or origin != f'https://{dns}:1989':
        raise ValueError('Live tailnet DNS does not match the requested HTTPS origin.')
    before = json.loads(command(binary, 'serve', 'status', '--json'))
    key = f'{dns}:1989'
    expected = {'Handlers': {'/': {'Proxy': 'http://127.0.0.1:1989'}}}
    if before.get('AllowFunnel', {}).get(key):
        raise ValueError('Public Funnel is enabled for the target; refusing to change it.')
    existing = before.get('Web', {}).get(key)
    if existing and existing != expected:
        raise ValueError('The target HTTPS port is occupied by another handler.')
    if before.get('TCP', {}).get('1989') and not existing:
        raise ValueError('The target TCP port is already configured.')
    ready()
    if existing != expected:
        command(binary, 'serve', '--https=1989', '--bg', 'http://127.0.0.1:1989')
    after = json.loads(command(binary, 'serve', 'status', '--json'))
    for section in ('Web', 'TCP', 'AllowFunnel'):
        old = {k: v for k, v in before.get(section, {}).items() if k not in {key, '1989'}}
        new = {k: v for k, v in after.get(section, {}).items() if k not in {key, '1989'}}
        if old != new:
            raise RuntimeError('An unrelated Serve setting changed; operator inspection required.')
    if after.get('Web', {}).get(key) != expected or after.get('AllowFunnel', {}).get(key):
        raise RuntimeError('Private HTTPS configuration verification failed.')
    ready(origin)  # httpx uses real certificate verification, including hostname.
    print(json.dumps({'https': origin, 'certificate_verified': True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['seal-build', 'install', 'start', 'status', 'restart', 'stop', 'https'])
    parser.add_argument('--origin', default='')
    parser.add_argument('--tailscale', default='/Applications/Tailscale.app/Contents/MacOS/Tailscale')
    args = parser.parse_args()
    stable_root()
    config = Config(root=ROOT)  # Fixed 1989/1990 and project-only paths; no host environment import.
    seal = ROOT / '.verify/build.json'
    if args.action == 'seal-build':
        seal.parent.mkdir(exist_ok=True)
        seal.write_text(json.dumps({'revision': revision(), 'build_sha256': build_digest()}))
    elif args.action == 'status':
        deployment = require_deployment(config)
        print(json.dumps({'loaded': loaded(label(config)), 'heartbeat_loaded': loaded(label(config) + '.heartbeat'),
                          'source_revision': deployment['revision'], 'source_matches_deployment': True}))
        ready()
    elif args.action in {'restart', 'stop'}:
        if not loaded(label(config)):
            raise ValueError('This service is not loaded; refusing to touch an unknown listener.')
        # The existing endpoint freezes new work and refuses active chats/jobs.
        before = json.loads((config.data / 'runtime.json').read_text())['pid']
        with httpx.Client(trust_env=False, timeout=10) as client:
            token = client.get('http://127.0.0.1:1989/api/auth/session').json()['token']
            response = client.post('http://127.0.0.1:1989/api/system/restart', headers={'x-uwe-token': token})
            response.raise_for_status()
        if args.action == 'stop':
            # Suppress the core's self-exec branch before asking launchd for a graceful stop.
            (config.data / 'restart.json').unlink(missing_ok=True)
            for suffix in ('.heartbeat', ''):
                if loaded(label(config) + suffix):
                    command('launchctl', 'bootout', f'gui/{os.getuid()}/{label(config)}{suffix}')
            deadline = time.monotonic() + 30
            while True:
                try:
                    require_free_ports()
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Vanilla listeners survived the graceful stop.')
                    time.sleep(.3)
            print(json.dumps({'stopped': True}))
            return
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            if json.loads((config.data / 'runtime.json').read_text())['pid'] != before:
                ready()
                print(json.dumps({'restarted': True, 'keepalive_loaded': loaded(label(config))}))
                return
            time.sleep(.3)
        raise RuntimeError('Restart did not produce a new process.')
    else:
        parsed = urlsplit(args.origin)
        if parsed.scheme != 'https' or parsed.port != 1989 or not (parsed.hostname or '').endswith('.ts.net') or parsed.path or parsed.query or parsed.fragment or parsed.username:
            raise ValueError('Expected https://<tailnet-host>.ts.net:1989 without path or credentials.')
        if args.action == 'https':
            require_deployment(config, args.origin)
            serve(args.tailscale, args.origin)
        elif args.action == 'start' and loaded(label(config)):
            require_deployment(config, args.origin)
            ready()
        else:
            service_install(config, args.origin)


if __name__ == '__main__':
    main()
