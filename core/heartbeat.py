"""Independent one-minute health check. Runs even when FastAPI has stopped."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path
from time import time
from urllib.request import urlopen

from .files import atomic_write, read_json


def check(data: Path, port=1989, restart=False):
    previous = read_json(data / "heartbeat.json", {})
    checks = {}
    try:
        with urlopen(f"http://127.0.0.1:{port}/healthz", timeout=5) as response:
            health = json.load(response)
        values = health.get('checks')
        if not isinstance(values,dict) or not values or any(not isinstance(v,dict) or not isinstance(v.get('ok'),bool) for v in values.values()):
            raise ValueError('Unvollständige Systemprüfung.')
        checks.update(values)
        checks["api"] = {"ok": True, "message": "Erreichbar"}
    except Exception:
        checks["api"] = {"ok": False, "message": "Anwendung antwortet nicht."}
    free_mb = shutil.disk_usage(data).free // 1024**2
    minimum = read_json(data / "monitor.json", {}).get("minimum_free_mb", 1024)
    checks["disk"] = {"ok": free_mb >= minimum, "message": f"{free_mb} MiB frei"}
    ok = all(value.get("ok", False) for value in checks.values())
    failures = 0 if ok else previous.get("failures", 0) + 1
    api_failures = 0 if checks["api"]["ok"] else previous.get("api_failures", 0) + 1
    last_restart = previous.get("last_restart", 0)
    result = {"ok": ok, "checked_at": time(), "checks": checks, "failures": failures, "api_failures": api_failures, "last_restart": last_restart}
    atomic_write(data / "heartbeat.json", json.dumps(result))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path(__file__).resolve().parent.parent / "data/control")
    parser.add_argument("--port", type=int, default=1989)
    args = parser.parse_args()
    from .isolation import ROOT, inside, port
    args.data = inside(ROOT, args.data)
    args.port = port(args.port)
    args.data.mkdir(parents=True, exist_ok=True, mode=0o700)
    settings = read_json(args.data / "monitor.json", {})
    if settings.get("enabled", True):
        result = check(args.data, args.port, settings.get("auto_restart", True))
        if not result["ok"]:
            print("Systemprüfung: Aufmerksamkeit erforderlich.")


if __name__ == "__main__":
    main()
