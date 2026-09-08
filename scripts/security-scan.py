#!/usr/bin/env python3
"""Scan only the Vanilla deliverable. Never read parent Git history or host secrets."""
import json
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXCLUDE = {'.git', '.venv', 'node_modules', '.cache', '.verify', '__pycache__', '.pytest_cache'}
RULES = {
    'private-key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'provider-token': re.compile(rb'(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[A-Z0-9]{16})'),
    'email': re.compile(rb'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}'),
    'phone': re.compile(rb'(?<!\w)(?:\+49|0049|\+1)[ ()\d/-]{7,}\d'),
    'personal-path': re.compile(rb'/(?:Users|home)/[^\s/]+/'),
    'customer-name': re.compile(('(?i)' + '|'.join(['Chris'+'tian', 'Kla'+'us', 'ms-'+'solar'+'technik', 'Denz'+'er'])).encode()),
}
findings = []
scanned = 0
for base, dirs, files in os.walk(ROOT, followlinks=False):
    for directory in dirs:
        p = pathlib.Path(base, directory)
        if p.is_symlink() and directory not in EXCLUDE:
            findings.append({'type': 'symlink', 'file': str(p.relative_to(ROOT))})
    dirs[:] = [d for d in dirs if d not in EXCLUDE and not d.endswith('.egg-info') and not pathlib.Path(base, d).is_symlink()]
    for name in files:
        p = pathlib.Path(base, name)
        rel = p.relative_to(ROOT).as_posix()
        if name.endswith('.log'):
            continue
        if p.is_symlink():
            findings.append({'type': 'symlink', 'file': rel})
            continue
        if name.startswith('.env') or name.endswith(('.env', '.db', '.sqlite', '.sqlite3', '.pem', '.key', '.p12', '.pfx')) or any(x in {'data', 'workspaces', 'runtime', 'workspace'} for x in p.relative_to(ROOT).parts):
            findings.append({'type': 'runtime-or-secret-file', 'file': rel})
        raw = p.read_bytes()
        scanned += 1
        for kind, pattern in RULES.items():
            for match in pattern.finditer(raw):
                value = match.group()
                # Synthetic fixtures and mandatory third-party license attribution.
                if kind == 'email' and (value.endswith((b'@s.whatsapp.net', b'@g.us')) or b'example.' in value or name == 'package-lock.json' or 'LICENSE' in name):
                    continue
                # Provenance is deliberately documented, not deployed company identity.
                if kind == 'customer-name' and rel == 'README.md':
                    continue
                findings.append({'type': kind, 'file': rel, 'line': raw[:match.start()].count(b'\n') + 1})
print(json.dumps({'scanned': scanned, 'findings': findings, 'limits': 'Pattern scan, no proof against unknown names or encoded secrets; dependencies and temporary verification files excluded.'}, ensure_ascii=False))
raise SystemExit(bool(findings))
