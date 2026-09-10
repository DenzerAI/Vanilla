#!/usr/bin/env python3
"""Explicit host setup: build dependencies without any customer code or data."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.config import Config
from core.update_source import Source
from core.update_sandbox import INPUTS, docker, fingerprint, host_env, local_context, environment
from core.update_operator import write


def setup(config):
    Source(config).read()  # Existing privacy/module gate before any build context leaves.
    binary = shutil.which('docker')
    if not binary:
        raise ValueError('Zuerst eine lokale Docker-kompatible Linux-Engine einrichten und starten.')
    connection = local_context(binary)
    key = fingerprint(config.root)
    config.data.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='update-image-', dir=config.data) as temporary:
        directory = Path(temporary)
        for name in [*INPUTS, 'core/__init__.py', 'core/setup.py', 'core/files.py', 'core/isolation.py']:
            target = directory / name; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(config.root / name, target)
        # Official images are resolved at explicit setup time; execution later uses
        # the resulting immutable local image ID, with pulling disabled.
        (directory / 'Dockerfile').write_text('''FROM node:22-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/ /usr/local/
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates passwd && rm -rf /var/lib/apt/lists/*
ARG VANILLA_UID
ARG VANILLA_GID
RUN if ! getent group "$VANILLA_GID" >/dev/null; then groupadd -g "$VANILLA_GID" updatecheck; fi && if ! getent passwd "$VANILLA_UID" >/dev/null; then useradd -u "$VANILLA_UID" -g "$VANILLA_GID" -d /candidate/.verify/home -M updatecheck; fi
WORKDIR /opt/vanilla
COPY package.json package-lock.json requirements.lock pyproject.toml ./
COPY wrapper/package.json wrapper/package-lock.json ./wrapper/
RUN npm ci --ignore-scripts && npm ci --prefix wrapper --ignore-scripts && python -m venv .venv && .venv/bin/python -m pip install -r requirements.lock pytest==9.1.1 pytest-asyncio==1.4.0
COPY core/ ./core/
RUN .venv/bin/python -m core.setup --data .verify/runtime && mkdir -p .verify/bin && cp .verify/runtime/bin/restic .verify/bin/restic && chmod -R a+rX /opt/vanilla && chmod a+rx .verify/bin/restic
''')
        image_file = directory / 'image-id'
        subprocess.run([binary, '--context', connection['context'], 'build', '--pull', '--label', 'io.vanilla.update.inputs=' + key,
                        '--build-arg', 'VANILLA_UID=' + str(os.getuid()), '--build-arg', 'VANILLA_GID=' + str(os.getgid()), '--iidfile', str(image_file), str(directory)], env=host_env(), check=True, timeout=1800)
        image = image_file.read_text().strip()
    write(config.data / 'updates/sandbox.json', {'schemaVersion': 1, **connection, 'image': image, 'inputs': key})
    environment(config)
    return {'ready': True, 'image': image}


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    print(json.dumps(setup(Config.environment())))
