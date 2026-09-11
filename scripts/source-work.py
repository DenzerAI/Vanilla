#!/usr/bin/env python3
"""Use the same source completion queue from a worker shell or the local core."""
import argparse
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.source_work import SourceWork


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path(os.environ.get("UWE_DATA_ROOT", ROOT / "data/control")))
    commands = parser.add_subparsers(dest="action", required=True)
    configure = commands.add_parser("configure")
    configure.add_argument("--repository", type=Path, required=True)
    configure.add_argument("--live-root", type=Path, required=True)
    begin = commands.add_parser("begin")
    begin.add_argument("name")
    begin.add_argument("--session", default="")
    ready = commands.add_parser("ready")
    ready.add_argument("id")
    commands.add_parser("status")
    commands.add_parser("watch", help="Process explicit handoffs under an existing local process manager")
    args = parser.parse_args()
    service = SourceWork(args.data)
    if args.action == "watch":
        if not service.status()["enabled"]:
            parser.error("Quellübergabe zuerst konfigurieren.")
        while True:
            service.tick()
            time.sleep(15)
    if args.action == "configure":
        result = service.configure(args.repository, args.live_root)
    elif args.action == "begin":
        result = service.begin(args.name, args.session)
    elif args.action == "ready":
        result = service.ready(args.id)
    else:
        result = service.status()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
