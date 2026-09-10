#!/usr/bin/env python3
"""CI/operator acceptance of the actual isolated runner with neutral fixtures."""
import asyncio
from pathlib import Path
import subprocess
import sys
import socket
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.config import Config
from core.update_checks import Preparation, execute
from core.update_sandbox import environment, start, cleanup


async def verify(config):
    profile = environment(config)
    staging = config.data / 'updates'; staging.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='sandbox-acceptance-', dir=staging) as temporary:
        parent = Path(temporary); candidate = parent / 'candidate'
        subprocess.run(['git', 'clone', '--no-hardlinks', '--quiet', str(config.root), str(candidate)], check=True)
        # This marker remains outside the only container mount.
        sentinel = parent / 'private-marker'; sentinel.write_text('Synthetic private fixture')
        probe = """import pathlib,socket,threading
outside=pathlib.Path(__import__('sys').argv[1]);assert not outside.exists()
assert not pathlib.Path('/input/.git').exists()
assert not pathlib.Path('/var/run/docker.sock').exists()
try:
 pathlib.Path('/input/public.txt').write_text('forbidden')
except OSError:pass
else:raise AssertionError('Source input is writable')
try:
 socket.create_connection(('127.0.0.1',int(__import__('sys').argv[2])),timeout=1)
except OSError:pass
else:raise AssertionError('Host service is reachable')
try:
 socket.create_connection(('192.0.2.1',443),timeout=1)
except OSError:pass
else:raise AssertionError('External network is reachable')
s=socket.socket();s.bind(('127.0.0.1',0));s.listen()
def reply():
 c,_=s.accept();c.sendall(b'fixture');c.close()
t=threading.Thread(target=reply);t.start()
with socket.create_connection(s.getsockname()) as c:assert c.recv(20)==b'fixture'
t.join();s.close()
"""
        inputs=parent/'probe-input'; inputs.mkdir(); (inputs/'public.txt').write_text('Synthetic neutral input')
        try:
            with socket.socket() as host:
                host.bind(('127.0.0.1',0)); host.listen()
                try:
                    container=start(profile,inputs,parent)
                    await execute(candidate, ['/usr/local/bin/python', '-c', probe, str(sentinel),str(host.getsockname()[1])], 'Isolationsgrenzen', container=container)
                finally:
                    cleanup(parent)
            checks = await Preparation(config, SimpleNamespace(product_updates=None)).technical(candidate, {'id':'fixture'})
        except Exception:
            # Explicit acceptance command uses only a clean, public fixture clone.
            for log in sorted((parent / 'checks').glob('*.log')):
                content = log.read_text(errors='replace')
                lines = content.splitlines()
                failures = [i for i, line in enumerate(lines) if line.startswith('not ok ') or line.startswith('FAILED ')]
                for i in failures[:20]:
                    print('\n'.join(lines[max(0, i-2):i+45])[:6000])
                print(content[-12000:])
            raise
        print('Isolationsgrenzen und alle', len(checks), 'Kandidatenprüfungen bestanden.')


if __name__ == '__main__':
    asyncio.run(verify(Config.environment()))
