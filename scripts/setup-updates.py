#!/usr/bin/env python3
"""One-time host setup. The web app can request an update, never install services."""
import argparse
import hashlib
import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from core.config import Config
from core.service import label
from core.update_operator import write, read, hash_file


def setup(config):
    if sys.platform != 'darwin' or not (config.root / '.git').is_dir() or not (config.data / 'services/host-activation.json').is_file():
        raise ValueError('Zuerst den regulären macOS-Dienst aus einem festen Quellclone einrichten.')
    if (config.data / 'updates/maintenance.json').exists():
        raise ValueError('Zuerst die laufende Umstellung oder Wiederherstellung abschließen.')
    name = label(config) + '.updates'
    file = Path.home() / 'Library/LaunchAgents' / (name + '.plist')
    directory = config.data / 'updates/operator'
    existing = plistlib.loads(file.read_bytes()) if file.is_file() else None
    if file.is_symlink() or existing and existing.get('WorkingDirectory') != str(directory):
        raise ValueError('Vorhandene fremde Dienstdefinition bleibt unverändert.')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    source = config.root / 'core/update_operator.py'
    target = directory / 'operator.py'
    if target.is_symlink():
        raise ValueError('Ungültiger Operatorpfad.')
    shutil.copy2(source, target)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_bytes(plistlib.dumps({'Label':name, 'ProgramArguments':[str(config.root / '.venv/bin/python'),str(target),'--watch',str(config.data)],
        'WorkingDirectory':str(directory),'EnvironmentVariables':{'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':str(Path.home())},
        'RunAtLoad':True,'StartInterval':15,'Umask':0o077}))
    file.chmod(0o600)
    domain='gui/'+str(os.getuid())
    loaded=subprocess.run(['launchctl','print',domain+'/'+name],capture_output=True,timeout=5).returncode==0
    if loaded:
        subprocess.run(['launchctl','bootout',domain+'/'+name],check=True,capture_output=True,timeout=30)
    subprocess.run(['launchctl','bootstrap',domain,str(file)],check=True,capture_output=True,timeout=30)
    write(config.data / 'updates/operator.json', {'schemaVersion':1,'externalState':'none','driver':'launchd','operatorHash':hash_file(target)})
    return {'ready':True,'driver':'launchd'}


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--standard-data-only',action='store_true',help='Confirm that this installation has no unregistered external module data or system jobs.')
    args=parser.parse_args()
    if not args.standard_data_only:
        parser.error('Zusätzliche Datenablagen und externe Cronjobs zuerst prüfen; dann --standard-data-only verwenden.')
    import json
    print(json.dumps(setup(Config.environment())))
