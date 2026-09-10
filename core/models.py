"""Pinned local search assets. Downloads happen only during explicit setup."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import fcntl
import json
import importlib.util
import math
import os
import platform
import shutil
import subprocess
import urllib.request
from pathlib import Path

from .files import atomic_write, sha256

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
REVISION = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"
# Exact upstream revision; SHA-256 of the actual files, not Git blob hashes.
FILES = {
    "1_Pooling/config.json": (190, "4be450dde3b0273bb9787637cfbd28fe04a7ba6ab9d36ac48e92b11e350ffc23"),
    "config.json": (645, "6300193cb75e01cf80c96decef7187dfb33094d97cc1490b7ead6ff134476e4e"),
    "config_sentence_transformers.json": (122, "b8c64b5cece00d8424b4896ea75b512b6008576088497609dfeb6bd63e6d36b8"),
    "model.safetensors": (470641600, "eaa086f0ffee582aeb45b36e34cdd1fe2d6de2bef61f8a559a1bbc9bd955917b"),
    "modules.json": (229, "8f4b264b80206c830bebbdcae377e137925650a433b689343a63bdc9b3145460"),
    "sentence_bert_config.json": (53, "70f4448f31320443fe3557cacea5abf2dcc4915dda8c80646bec9f3bb0aa5a1f"),
    "special_tokens_map.json": (239, "378eb3bf733eb16e65792d7e3fda5b8a4631387ca04d2015199c4d4f22ae554d"),
    "tokenizer.json": (9081518, "2c3387be76557bd40970cec13153b3bbf80407865484b209e655e5e4729076b8"),
    "tokenizer_config.json": (526, "5036ea374ffedd706e3bef33e2e0d6953cb868ef8a490e76e32ba0faa37a6b9b"),
}
DIMENSIONS = 384
BATCH_SIZE = 8


def resource_profile(destination):
    system, arch = platform.system(), platform.machine().lower()
    if system not in {"Darwin", "Linux"} or arch not in {"arm64", "aarch64", "x86_64", "amd64"}:
        raise ValueError("Lokale Suche unterstützt macOS/Linux auf ARM64 oder x86-64.")
    if system == "Darwin":
        version = platform.mac_ver()[0]
        if arch != "arm64" or not version or int(version.split(".")[0]) < 14:
            raise ValueError("Die festgelegte Suchlaufzeit benötigt macOS 14+ auf Apple Silicon; Intel-Macs werden nicht unterstützt.")
    if system == "Linux":
        libc, version = platform.libc_ver()
        if libc != "glibc" or tuple(int(p) for p in version.split(".")[:2]) < (2, 28):
            raise ValueError("Die festgelegte Suchlaufzeit benötigt Linux mit glibc 2.28 oder neuer.")
    ram = None
    try:
        if system == "Darwin":
            ram = int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], stderr=subprocess.DEVNULL, timeout=5))
        else:
            ram = os.sysconf("SC_PHYS_PAGES") * os.sysconf("SC_PAGE_SIZE")
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    # Conservative shared-host profile, no GPU/MPS allocation or model server.
    if ram is not None and ram < 4 * 1024**3:
        raise ValueError("Das lokale Suchmodell benötigt einen Rechner mit mindestens 4 GiB RAM.")
    parent = Path(destination)
    while not parent.exists():
        parent = parent.parent
    free = shutil.disk_usage(parent).free
    threads = max(1, min(2, (os.cpu_count() or 2) // 2))
    return {"system": system, "architecture": arch, "ramBytes": ram,
            "freeBytes": free, "threads": threads, "batchSize": BATCH_SIZE, "device": "cpu"}


@contextmanager
def model_lock(destination, *, exclusive=False):
    lock = Path(destination).with_name("." + Path(destination).name + ".install.lock")
    lock.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if lock.is_symlink():
        raise ValueError("Ungültige Suchmodell-Sperrdatei.")
    with lock.open("a") as handle:
        try:
            fcntl.flock(handle, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Das Suchmodell wird gerade eingerichtet. Bitte anschließend erneut versuchen.") from None
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def valid_file(destination, name):
    file = Path(destination) / name
    if any(p.is_symlink() for p in [file, *file.parents]):
        return False
    size, checksum = FILES[name]
    return file.is_file() and file.stat().st_size == size and sha256(file) == checksum


def verify_model(destination):
    invalid = [name for name in FILES if not valid_file(destination, name)]
    if invalid:
        raise ValueError("Suchmodell fehlt oder ist beschädigt. Modell reparieren: " + ", ".join(invalid))
    return REVISION


def load_model(destination):
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    import torch
    from sentence_transformers import SentenceTransformer
    profile = resource_profile(destination)
    torch.set_num_threads(profile["threads"])
    return SentenceTransformer(str(destination), device="cpu", local_files_only=True,
                               trust_remote_code=False, token=False)


def probe_model(destination):
    model = load_model(destination)
    texts = ["Die Solaranlage erzeugt Strom.", "Photovoltaik liefert Energie.", "Ein Kuchen wird im Ofen gebacken."]
    vectors = model.encode(texts, batch_size=BATCH_SIZE, normalize_embeddings=True,
                           show_progress_bar=False).tolist()
    if len(vectors) != 3 or any(len(v) != DIMENSIONS or not all(math.isfinite(x) for x in v) for v in vectors):
        raise ValueError("Das Suchmodell liefert keine gültigen Suchvektoren.")
    similarity = lambda a, b: sum(x * y for x, y in zip(a, b))
    if similarity(vectors[0], vectors[1]) <= similarity(vectors[0], vectors[2]):
        raise ValueError("Die deutsche Bedeutungsprüfung des Suchmodells ist fehlgeschlagen.")
    return {"dimensions": DIMENSIONS, "localOnly": True}


def download_file(destination, name):
    # Only public assets; urllib does not load Hugging Face accounts or caches.
    size, checksum = FILES[name]
    partial = destination / ".download" / (name.replace("/", "_") + ".part")
    partial.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if partial.is_symlink() or partial.parent.is_symlink():
        raise ValueError("Ungültiger Suchmodell-Downloadpfad.")
    offset = partial.stat().st_size if partial.exists() else 0
    if offset >= size:
        if offset == size and sha256(partial) == checksum:
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            os.replace(partial, target)
            return
        partial.unlink()
        offset = 0
    request = urllib.request.Request(f"https://huggingface.co/{MODEL}/resolve/{REVISION}/{name}",
                                     headers={"Range": f"bytes={offset}-"} if offset else {})
    with urllib.request.urlopen(request, timeout=60) as response:
        resumed = bool(offset and response.status == 206)
        if resumed and not response.headers.get("Content-Range", "").startswith(f"bytes {offset}-"):
            raise ValueError("Ungültige Fortsetzung des Modelldownloads.")
        received = offset if resumed else 0
        with partial.open("ab" if resumed else "wb") as output:
            while chunk := response.read(1024 * 1024):
                received += len(chunk)
                if received > size:
                    raise ValueError("Modelldownload überschreitet die erwartete Dateigröße.")
                output.write(chunk)
            output.flush()
            os.fsync(output.fileno())
    if partial.stat().st_size != size or sha256(partial) != checksum:
        # A short response can resume; a full but corrupt response must restart.
        if partial.stat().st_size >= size:
            partial.unlink()
        raise ValueError("Modelldownload unvollständig oder Prüfsumme falsch. Einrichtung erneut ausführen.")
    target = destination / name
    target.parent.mkdir(parents=True, exist_ok=True)
    os.replace(partial, target)


def install_model(destination):
    from .isolation import ROOT, inside
    destination = inside(ROOT, destination)
    for package in ("torch", "sentence_transformers"):
        if importlib.util.find_spec(package) is None:
            raise ImportError("Die lokale Suchlaufzeit fehlt. Den Systeminstaller ausführen.")
    with model_lock(destination, exclusive=True):
        profile = resource_profile(destination)
        # Reject symlink components before downloading or replacing local files.
        for file in [destination / name for name in FILES] + [destination / "source.json", destination / ".download"]:
            if any(p.is_symlink() for p in [file, *file.parents]):
                raise ValueError("Suchmodelldateien dürfen keine Symlinks sein.")
        missing = [name for name in FILES if not valid_file(destination, name)]
        required = sum(FILES[name][0] for name in missing) + 256 * 1024**2
        if profile["freeBytes"] < required:
            raise ValueError("Zu wenig freier Speicher für das lokale Suchmodell und seine Reparatur.")
        destination.mkdir(parents=True, exist_ok=True, mode=0o700)
        (destination / "source.json").unlink(missing_ok=True)
        for name in missing:
            print("Suchmodell herunterladen:", name, flush=True)
            download_file(destination, name)
        verify_model(destination)
        probe = probe_model(destination)
        atomic_write(destination / "source.json", json.dumps({"repository": MODEL, "revision": REVISION,
                     "verified": True, "profile": profile, **probe}, indent=2) + "\n")
    return str(destination)


def main():
    from .isolation import ROOT, inside
    parser = argparse.ArgumentParser(description="Lokales Suchmodell installieren oder reparieren.")
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--preflight", action="store_true", help="Plattform und Speicher vor der Laufzeitinstallation prüfen")
    parser.add_argument("--check", action="store_true", help="Nur vorhandene Dateien und lokale Berechnung prüfen")
    args = parser.parse_args()
    data = Path(os.environ.get("UWE_DATA_ROOT", str(ROOT / "data/control")))
    destination = inside(ROOT, args.destination or data / "models/embeddings")
    if args.preflight:
        profile = resource_profile(destination)
        if profile["freeBytes"] < 2 * 1024**3:
            raise ValueError("Für Laufzeit und Suchmodell sind mindestens 2 GiB freier Speicher erforderlich.")
        print(json.dumps(profile))
    elif args.check:
        with model_lock(destination):
            verify_model(destination)
            print(json.dumps(probe_model(destination)))
    else:
        print(f"Suchmodell geprüft und installiert: {install_model(destination)}")


if __name__ == "__main__":
    main()
