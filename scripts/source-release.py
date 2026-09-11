#!/usr/bin/env python3
"""Run under the existing process manager, independently of the app lifecycle."""
import argparse
import fcntl
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from core.source_release import SourceRelease

parser = argparse.ArgumentParser()
parser.add_argument('--data', type=Path, required=True)
commands = parser.add_subparsers(dest='action', required=True)
configure = commands.add_parser('configure')
configure.add_argument('--remote', required=True)
configure.add_argument('--branch', required=True)
configure.add_argument('--github', required=True)
configure.add_argument('--operator-json', required=True)
commands.add_parser('watch')
commands.add_parser('status')
args = parser.parse_args()
service = SourceRelease(args.data)
if args.action == 'configure':
    service.configure(args.remote, args.branch, args.github, json.loads(args.operator_json))
elif args.action == 'watch':
    if not service.config_file.exists():
        parser.error('Veröffentlichungsdienst zuerst ausdrücklich konfigurieren.')
    with (service.directory / 'lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        while True:
            try:
                service.tick()
            except Exception as error:
                state = service.read()
                state['error'] = str(error)[:300]
                service.save(state)
            time.sleep(15)
else:
    print(json.dumps(service.read(), ensure_ascii=False, indent=2))
