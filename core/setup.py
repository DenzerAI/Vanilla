"""Explicit installation of pinned, local runtime assets."""
from __future__ import annotations

import argparse
import bz2
import hashlib
import json
import os
import platform
import urllib.request
from pathlib import Path

from .files import atomic_write

RESTIC_VERSION = "0.19.1"
SUMS_SHA256 = "fb520966ee01d2a3d4219c66762c66efa56300833b6f639f36082b7462f91cb8"


def install_restic(data: Path):
    from .isolation import ROOT, inside
    data = inside(ROOT, data)
    binary = data / "bin/restic"
    if binary.exists():
        return str(binary)
    system = {"Darwin": "darwin", "Linux": "linux"}.get(platform.system())
    arch = {"arm64": "arm64", "aarch64": "arm64", "x86_64": "amd64"}.get(platform.machine())
    if not system or not arch:
        raise ValueError("Diese Plattform benötigt eine manuelle restic-Installation.")
    base = f"https://github.com/restic/restic/releases/download/v{RESTIC_VERSION}/"
    with urllib.request.urlopen(base + "SHA256SUMS", timeout=30) as r:
        sums = r.read(100000)
    if hashlib.sha256(sums).hexdigest() != SUMS_SHA256:
        raise ValueError("Prüfsumme des Installationsmanifests stimmt nicht.")
    name = f"restic_{RESTIC_VERSION}_{system}_{arch}.bz2"
    expected = next((line.split()[0] for line in sums.decode().splitlines() if line.split()[-1].lstrip("*") == name), None)
    with urllib.request.urlopen(base + name, timeout=60) as r:
        content = r.read(64 * 1024 * 1024)
    if not expected or hashlib.sha256(content).hexdigest() != expected:
        raise ValueError("Prüfsumme des Backup-Programms stimmt nicht.")
    binary.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = binary.with_suffix(".download")
    temp.write_bytes(bz2.decompress(content))
    temp.chmod(0o700)
    os.replace(temp, binary)
    atomic_write(binary.parent / "restic-source.json", json.dumps({"version": RESTIC_VERSION, "url": base + name, "sha256": expected}))
    return str(binary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path(__file__).resolve().parent.parent / "data/control")
    parser.add_argument("--embeddings", action="store_true")
    args = parser.parse_args()
    if args.embeddings:
        from .models import install_model
        print("Lokale Suche:", install_model(args.data / "models/embeddings"))
    print("Backup-Programm:", install_restic(args.data))


if __name__ == "__main__":
    main()
