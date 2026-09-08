#!/usr/bin/env python3
"""Real start on the required ports, fresh local state, guaranteed process cleanup."""
import argparse
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import build_opener, ProxyHandler
urlopen = build_opener(ProxyHandler({})).open

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=1989)
parser.add_argument('--adapter-port', type=int, default=1990)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
for port in (args.port, args.adapter_port):
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(('127.0.0.1', port))  # Never replace an existing listener.
(root / '.verify').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='http-', dir=root / '.verify') as folder:
    folder = Path(folder)
    env = {k: os.environ[k] for k in ('PATH', 'LANG') if k in os.environ}
    env.update(UWE_PORT=str(args.port), AGENT_ADAPTER_PORT=str(args.adapter_port), UWE_WORKSPACE=str(folder / 'workspace'), UWE_DATA_ROOT=str(folder / 'data'),
               TMPDIR=str(folder), PYTHONDONTWRITEBYTECODE='1')
    log = (folder / 'server.log').open('w+')
    process = subprocess.Popen([sys.executable, '-m', 'core'], cwd=root, env=env, stdout=log, stderr=log, start_new_session=True)
    checks = []
    health = {}
    try:
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            try:
                with urlopen(f'http://127.0.0.1:{args.port}/healthz', timeout=2) as response:
                    health = json.load(response)
                    if response.status == 200 and health['checks'].get('adapter', {}).get('ok'):
                        break
            except OSError:
                pass
            if process.poll() is not None:
                raise RuntimeError('Core exited before readiness')
            time.sleep(.2)
        else:
            raise RuntimeError('Core/adapter readiness timed out: ' + json.dumps(health))
        for endpoint in ('/healthz', '/api/core/status', '/api/bootstrap'):
            with urlopen(f'http://127.0.0.1:{args.port}' + endpoint, timeout=10) as response:
                result = json.load(response)
                assert response.status == 200
                checks.append({'endpoint': endpoint, 'status': response.status})
                if endpoint == '/api/core/status':
                    assert result['backend'] == 'FastAPI' and result['storage'] == 'SQLite'
                    assert result['runtimeError'] is None
        with urlopen(f'http://127.0.0.1:{args.adapter_port}/api/bootstrap', timeout=3) as response:
            raise AssertionError('Private adapter unexpectedly accessible')
    except Exception as error:
        from urllib.error import HTTPError
        if not isinstance(error, HTTPError) or error.code != 403 or len(checks) != 3:
            raise
        checks.append({'endpoint': f'private adapter ({args.adapter_port})', 'status': error.code})
    finally:
        process.terminate()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
        log.flush()
        text = (folder / 'server.log').read_text()
        lines = [line for line in text.splitlines() if any(x in line for x in ('Application startup complete', 'Shutting down', 'Application shutdown complete', 'Finished server process'))]
        print(json.dumps({'http': checks, 'exit_code': process.returncode, 'log_excerpt': lines}, ensure_ascii=False))
        (root / '.verify/last-start.log').write_text(text)
        log.close()
    assert process.returncode in (0, -signal.SIGTERM)
    assert 'Application shutdown complete.' in text
    for port in (args.port, args.adapter_port):
        with socket.socket() as sock:
            assert sock.connect_ex(('127.0.0.1', port)) != 0, 'Listener survived shutdown'
    print(f'PASS: ports {args.port}/{args.adapter_port} closed; temporary runtime removed on exit.')
