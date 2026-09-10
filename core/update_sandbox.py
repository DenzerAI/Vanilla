"""Local Docker test environment. Only neutral candidates enter the container."""
from __future__ import annotations

import hashlib
import asyncio
import io
import tarfile
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from uuid import uuid4

from .update_operator import read, write

INPUTS = ('package.json', 'package-lock.json', 'wrapper/package.json', 'wrapper/package-lock.json', 'requirements.lock', 'pyproject.toml')


def host_env():
    return {k: v for k, v in os.environ.items() if k in {'PATH', 'HOME', 'USER', 'LANG', 'TMPDIR'}}


def docker(binary, *args):
    try:
        r = subprocess.run([binary, *args], env=host_env(), capture_output=True, timeout=30)
        if r.returncode or len(r.stdout) > 2_000_000:
            raise ValueError()
        return r.stdout.decode()
    except (OSError, ValueError, subprocess.SubprocessError):
        raise ValueError('Die lokale Container-Prüfumgebung ist nicht erreichbar. Einrichtung nach docs/UPDATES.md prüfen.') from None


def fingerprint(root):
    return hashlib.sha256(json.dumps({name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in INPUTS}, sort_keys=True).encode()).hexdigest()


def local_context(binary, name=None):
    name = name or docker(binary, 'context', 'show').strip()
    if not re.fullmatch(r'[a-zA-Z0-9_.-]{1,100}', name):
        raise ValueError('Ungültiger Container-Kontext.')
    value = json.loads(docker(binary, 'context', 'inspect', name))[0]
    endpoint = value.get('Endpoints', {}).get('docker', {}).get('Host', '')
    if not endpoint.startswith('unix:///'):
        raise ValueError('Kandidatencode darf nur an eine lokal eingerichtete Container-Engine übergeben werden.')
    return {'context': name, 'endpoint': endpoint}


def environment(config):
    profile = read(config.data / 'updates/sandbox.json', {})
    binary = shutil.which('docker')
    if not binary or profile.get('schemaVersion') != 1 or not re.fullmatch(r'sha256:[a-f0-9]{64}', profile.get('image', '')):
        raise ValueError('Die isolierte Updateprüfung fehlt. Einmalige Einrichtung nach docs/UPDATES.md erforderlich.')
    connection = local_context(binary, profile.get('context'))
    if connection.get('endpoint') != profile.get('endpoint') or profile.get('inputs') != fingerprint(config.root):
        raise ValueError('Prüfumgebung passt nicht mehr zur Installation. Einrichtung erneut prüfen.')
    image = json.loads(docker(binary, '--context', connection['context'], 'image', 'inspect', profile['image']))[0]
    if (image.get('Id') != profile['image'] or image.get('Os') != 'linux'
            or image.get('Config', {}).get('Labels', {}).get('io.vanilla.update.inputs') != profile['inputs']):
        raise ValueError('Das vorbereitete Prüfabbild ist nicht bestätigt.')
    return {**profile, 'binary': binary}


def start(profile, inputs, directory):
    inputs = inputs.resolve()
    if ',' in str(inputs) or inputs.is_symlink():
        raise ValueError('Ungültiger neutraler Prüfbestand.')
    lease = {'name': 'vanilla-check-' + uuid4().hex, 'owner': uuid4().hex,
             'binary': profile['binary'], 'context': profile['context']}
    write(directory / 'runner.json', lease)
    args = ['--context', profile['context'], 'run', '--detach', '--rm', '--pull=never', '--name', lease['name'],
            '--label', 'io.vanilla.update.owner=' + lease['owner'], '--network=none', '--read-only', '--cap-drop=ALL',
            '--security-opt=no-new-privileges', '--pids-limit=512', '--memory=4g', '--cpus=2', '--log-driver=none',
            '--user', str(os.getuid()) + ':' + str(os.getgid()), '--tmpfs', '/tmp:rw,exec,nosuid,nodev,size=512m',
            '--tmpfs', f'/candidate:rw,exec,nosuid,nodev,size=2g,uid={os.getuid()},gid={os.getgid()},mode=0700',
            '--mount', 'type=bind,src=' + str(inputs) + ',dst=/input,readonly',
            '--workdir=/candidate', '--entrypoint=/bin/sleep', profile['image'], '3600']
    docker(profile['binary'], *args)
    return {**profile, **lease}


def command(container, directory, argv, env):
    inside = lambda value: value.replace(str(directory.resolve()), '/candidate')
    container_env = {k: inside(v) for k, v in env.items() if k not in {'PATH', 'GIT_CONFIG_GLOBAL'}}
    container_env.update(PATH='/usr/local/bin:/usr/bin:/bin', GIT_CONFIG_GLOBAL='/dev/null')
    return [container['binary'], '--context', container['context'], 'exec', container['name'], '/usr/bin/env', '-i',
            *[k + '=' + v for k, v in container_env.items()], *[inside(a) for a in argv]]


INITIALIZE = r"""import pathlib,shutil,subprocess,os
root=pathlib.Path('/candidate')
for name in ('/tmp/vanilla-home','/tmp/vanilla-tests'):
 pathlib.Path(name).mkdir(parents=True,exist_ok=True)
for p in pathlib.Path('/input').iterdir():
 if p.is_dir():shutil.copytree(p,root/p.name)
 else:shutil.copy2(p,root/p.name)
for name in ('.venv','node_modules','wrapper/node_modules'):
 shutil.copytree('/opt/vanilla/'+name,root/name,symlinks=True)
(root/'.verify/bin').mkdir(parents=True,exist_ok=True)
(root/'.verify/tmp').mkdir(parents=True,exist_ok=True)
(root/'.verify/home').mkdir(parents=True,exist_ok=True)
shutil.copy2('/opt/vanilla/.verify/bin/restic',root/'.verify/bin/restic')
subprocess.run(['git','init','-q'],check=True)
files=b'\0'.join(str(p.relative_to('/input')).encode() for p in pathlib.Path('/input').rglob('*') if p.is_file())+b'\0'
subprocess.run(['git','-c','core.hooksPath=/dev/null','add','--force','--pathspec-from-file=-','--pathspec-file-nul'],input=files,check=True)
subprocess.run(['git','-c','core.hooksPath=/dev/null','-c','user.name=Vanilla check','-c','user.email=source@example.invalid','commit','-qm','Neutral check fixture'],check=True)
"""

VERIFY_SOURCE = r"""import pathlib,hashlib
for p in pathlib.Path('/input').rglob('*'):
 if p.is_file():
  target=pathlib.Path('/candidate')/p.relative_to('/input')
  assert target.is_file() and not target.is_symlink() and hashlib.sha256(target.read_bytes()).digest()==hashlib.sha256(p.read_bytes()).digest(), 'Source changed during checks'
  assert bool(target.stat().st_mode&0o111)==bool(p.stat().st_mode&0o111), 'Source mode changed during checks'
"""


def extract_build(raw, destination):
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
        size = count = 0
        for entry in archive:
            path = Path(entry.name)
            if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] != 'dist' or not (entry.isdir() or entry.isfile()):
                raise ValueError('Oberflächenbuild enthält einen ungeeigneten Archivpfad.')
            size += entry.size; count += 1
            if size > 100_000_000 or count > 10000:
                raise ValueError('Oberflächenbuild überschreitet das erlaubte Budget.')
            target = destination.joinpath(*path.parts[1:])
            if target.is_symlink() or any(p.is_symlink() for p in target.parents if p.is_relative_to(destination)):
                raise ValueError('Oberflächenbuild enthält eine Verknüpfung.')
            if entry.isdir():target.mkdir(parents=True,exist_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True)
                with archive.extractfile(entry) as source, target.open('xb') as stream:
                    shutil.copyfileobj(source,stream)
                target.chmod(0o644)


async def copy_build(container, destination):
    # Export from the running mount namespace: docker cp does not reliably
    # expose tmpfs contents through the daemon's container filesystem view.
    process = await asyncio.create_subprocess_exec(container['binary'], '--context', container['context'], 'exec',
        container['name'], '/usr/bin/env', '-i', '/bin/tar', '-C', '/candidate/wrapper', '-cf', '-', 'dist',
        env=host_env(), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
    raw = bytearray()
    async def consume():
        while chunk := await process.stdout.read(65536):
            raw.extend(chunk)
            if len(raw) > 128_000_000:raise ValueError('Oberflächenbuild überschreitet das erlaubte Budget.')
        await process.wait()
    try:
        await asyncio.wait_for(consume(),90)
        if process.returncode:raise ValueError('Oberflächenbuild konnte nicht abgeholt werden.')
        await asyncio.to_thread(extract_build, raw, destination)
    finally:
        if process.returncode is None:
            process.kill(); await process.wait()


def cleanup(directory):
    file = directory / 'runner.json'
    lease = read(file, {})
    if not lease:
        return
    if not re.fullmatch(r'vanilla-check-[a-f0-9]{32}', lease.get('name', '')):
        raise ValueError('Unklarer Prüfcontainer. Lokalen Betriebszustand klären.')
    binary = shutil.which('docker')
    if not binary:
        raise ValueError('Prüfcontainer konnte noch nicht beendet werden. Lokale Engine starten.')
    prefix = [binary, '--context', lease['context']]
    result = subprocess.run([*prefix, 'inspect', '--type=container', lease['name']], env=host_env(), capture_output=True, timeout=10)
    if result.returncode:
        remaining = docker(binary, '--context', lease['context'], 'ps', '--all', '--filter', 'label=io.vanilla.update.owner=' + lease['owner'], '--format', '{{.Names}}').strip()
        if remaining:
            raise ValueError('Prüfcontainer wurde noch nicht vollständig beendet.')
        file.unlink(missing_ok=True)
        return
    container = json.loads(result.stdout)[0]
    if container.get('Config', {}).get('Labels', {}).get('io.vanilla.update.owner') != lease.get('owner'):
        raise ValueError('Prüfcontainer gehört nicht zu diesem Auftrag.')
    subprocess.run([*prefix, 'rm', '--force', lease['name']], env=host_env(), check=True, capture_output=True, timeout=20)
    file.unlink(missing_ok=True)
