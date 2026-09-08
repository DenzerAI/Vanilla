"""Explicit one-time download. Normal application startup never downloads models."""

import argparse
import json
from pathlib import Path
from .config import Config

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
REVISION = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"


def install_model(destination):
    from huggingface_hub import snapshot_download
    from .isolation import ROOT, inside
    destination = inside(ROOT, destination)
    if (destination / "modules.json").is_file() and (destination / "source.json").is_file():
        return str(destination)
    snapshot_download(MODEL, revision=REVISION, local_dir=destination, allow_patterns=["*.json", "*.txt", "*.safetensors", "1_Pooling/*", "README.md"])
    (destination / "source.json").write_text(json.dumps({"repository": MODEL, "revision": REVISION}, indent=2) + "\n")
    return str(destination)


def main():
    parser = argparse.ArgumentParser(
        description="Ein mehrsprachiges lokales Embedding-Modell installieren."
    )
    parser.add_argument("--destination", type=Path)
    args = parser.parse_args()
    destination = (
        args.destination or Config.environment().data / "models/embeddings"
    ).resolve()
    print(f"Modell lokal gespeichert: {install_model(destination)}\nRevision: {REVISION}")



if __name__ == "__main__":
    main()
