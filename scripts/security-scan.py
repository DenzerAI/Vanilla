#!/usr/bin/env python3
"""Local source-only gate. Findings never contain matched values or file contents."""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = {'data', 'workspaces', 'firmenbasis', 'brain', 'soul', 'notes', 'input',
             'output', 'chats', 'secrets', 'credentials', 'logs', 'uploads',
             'attachments', 'transcripts', 'backups', 'runtime', 'workspace',
             'node_modules', '.venv', '.git', '.cache', '.verify', '.security-audit'}
ROOT_FILES = {'.gitignore', '.env.example', 'AGENTS.md', 'README.md', 'UPDATE.md', 'SECURITY.md',
              'package.json', 'package-lock.json', 'pyproject.toml',
              'requirements.lock', 'requirements-embeddings.lock',
              'requirements-speech.lock', 'configure-agent-uptime.sh'}
PATTERNS = [
    'backend/*.mjs', 'frontend/*.js', 'frontend/*.css', 'frontend/index.html',
    'scripts/*.py', 'scripts/*.mjs', 'test/*.mjs', 'core/*.py',
    'core/tests/*.py', 'core/tests/*.cjs', 'jobs/briefings/*.py',
    'system/*.md', 'system/*.mjs', 'system/source-policy.json', 'system/modules.json', 'docs/*.md',
    'examples/*.py', '.githooks/pre-commit', '.githooks/commit-msg',
    '.githooks/pre-merge-commit', '.githooks/pre-push', '.github/workflows/*.yml',
    'wrapper/*.mjs', 'wrapper/*.md', 'wrapper/*.ts', 'wrapper/.gitignore',
    'wrapper/package.json', 'wrapper/package-lock.json', 'wrapper/tsconfig.json',
    'wrapper/components.json', 'wrapper/test/*.mjs', 'wrapper/surfaces/*.md',
    'wrapper/scripts/*.mjs', 'wrapper/scripts/*.py', 'wrapper/scripts/design-*.json',
    'wrapper/public/*.js', 'wrapper/public/*.css', 'wrapper/public/*.svg',
    'wrapper/public/*.webmanifest',
    'wrapper/public/app-icon-192.png', 'wrapper/public/app-icon-512.png',
    'wrapper/public/app-icon-1024.png', 'wrapper/public/apple-touch-icon.png',
    'wrapper/public/favicon-32.png',
]
RULES = {
    'private-key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'provider-token': re.compile(rb'(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[A-Z0-9]{16})'),
    'email': re.compile(rb'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}'),
    'phone': re.compile(rb'(?<!\w)(?:\+49|0049|\+1)[ ()\d/-]{7,}\d'),
    'personal-path': re.compile(rb'/(?:Users|home)/[^\s/]+/'),
    'jwt': re.compile(rb'eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}'),
    'credential-literal': re.compile(rb'''(?i)\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd)\b["']?\s*[:=]\s*["']([^\s"']{8,})["']'''),
    'url-credentials': re.compile(rb'https?://[^\s/<>"\x27:]+:[^\s/<>"\x27@]+@[^\s/<>"\x27]+'),
}
PLACEHOLDER = re.compile(rb'(?i)^(?:synthetic|fixture|test[-_]|example|placeholder|change[-_]?me|your[-_]|<|\$\{)')


def git(root, *args, input=None):
    result = subprocess.run(['git', '-C', str(root), *args], input=input,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ValueError('Git source inspection failed: ' + args[0])
    return result.stdout


def source_path(name):
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or any(ord(c) < 32 for c in name):
        return False
    if name.startswith('templates/firmenbasis/'):
        return name in {'templates/firmenbasis/AGENTS.md', 'templates/firmenbasis/FIRMA.md',
                        'templates/firmenbasis/report-result/SKILL.md'}
    if (any(part in FORBIDDEN or part.startswith(('credentials', '.env')) for part in p.parts)
            or any(part.startswith('backup') for part in p.parts[:-1])):
        return name == '.env.example'
    if name in ROOT_FILES:
        return True
    if name.startswith('wrapper/ui/'):
        if '/assets/' in name:
            return (p.suffix in {'.png', '.svg', '.woff2', '.ttf'} or p.name in {'sources.json', 'voice-brands-sources.json', 'LICENSE'}
                    or p.name.endswith('-LICENSE.txt'))
        return p.suffix in {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'} or name in {'wrapper/ui/index.html', 'wrapper/ui/blueprint.html'}
    return any(name.count('/') == pattern.count('/') and fnmatch.fnmatchcase(name, pattern) for pattern in PATTERNS)


class Scanner:
    def __init__(self, root, policy=None):
        self.root = Path(root).resolve()
        self.policy = policy or json.loads((ROOT / 'system/source-policy.json').read_text())
        self.findings = []
        self.scanned = 0
        self.seen = set()
        self.blobs = {}
        self.private_terms = self.local_terms()

    def policy_snapshot(self, revision):
        self.policy = json.loads(git(self.root, 'show', revision + ':system/source-policy.json'))
        self.seen.clear()
        self.private_terms = self.local_terms()

    def local_terms(self):
        """Read only this installation's company text; no credential stores or services."""
        neutral = set()
        for name in self.policy['neutralTemplates']:
            p = ROOT / name
            if p.is_file():
                neutral.update(line.strip().lower() for line in p.read_bytes().splitlines())
        bases = {self.root / 'firmenbasis'}
        if os.getenv('COMPANY_BASE'):
            configured = (self.root / os.environ['COMPANY_BASE']).resolve()
            if configured.is_relative_to(self.root):
                bases.add(configured)
        terms = set()
        for base in bases:
            if base.is_symlink() or not base.is_dir():
                continue
            for parent, dirs, files in os.walk(base, followlinks=False):
                dirs[:] = [d for d in dirs if not d.startswith('.') and not (Path(parent) / d).is_symlink()]
                for name in files:
                    p = Path(parent) / name
                    explicit = name == 'private-terms.txt'
                    if p.is_symlink() or (p.suffix != '.md' and not explicit) or p.stat().st_size > 2_000_000:
                        continue
                    for line in p.read_bytes().splitlines():
                        line = line.strip().lower()
                        if line in neutral or not line or line.startswith(b'<!--'):
                            continue
                        if (4 if explicit else 24) <= len(line) <= 1000:
                            terms.add(line)
        return terms

    def add(self, kind, name, raw=None, offset=0, revision=None):
        finding = {'type': kind, 'file': name}
        if raw is not None:
            finding['line'] = raw[:offset].count(b'\n') + 1
        if revision:
            finding['revision'] = revision[:12]
        self.findings.append(finding)

    def text(self, name, raw, revision=None):
        for kind, pattern in RULES.items():
            for match in pattern.finditer(raw):
                value = match.group(1) if kind == 'credential-literal' else match.group()
                if hashlib.sha256(value).hexdigest() in self.policy.get('syntheticLiterals', {}).get(name, {}).get(kind, []):
                    continue
                if kind == 'email' and (value.endswith((b'@s.whatsapp.net', b'@g.us')) or
                    re.search(rb'@(?:[^@.]+\.)*example\.(?:com|org|net|invalid)$', value) or
                    value.endswith((b'.invalid', b'.test')) or PurePosixPath(name).name == 'package-lock.json' or
                    'LICENSE' in PurePosixPath(name).name):
                    continue
                if kind == 'credential-literal' and PLACEHOLDER.search(value):
                    continue
                self.add(kind, name, raw, match.start(), revision)
        lower = raw.lower()
        for value in self.private_terms:
            offset = lower.find(value)
            if offset >= 0:
                self.add('local-company-content', name, raw, offset, revision)
                break

    def entry(self, name, raw, mode='100644', historical=False, revision=None):
        digest = hashlib.sha256(raw).hexdigest()
        key = (name, digest, mode, historical)
        if key in self.seen:
            return
        self.seen.add(key)
        self.scanned += 1
        before = len(self.findings)
        self.text('<file-name>', name.encode(), revision)
        if len(self.findings) > before:
            return
        if mode not in {'100644', '100755'}:
            self.add('symlink-or-submodule', name, revision=revision)
            return
        if historical and digest in self.policy['legacyNeutralTemplates'].get(name, []):
            return
        if not source_path(name):
            self.add('non-source-path', name, revision=revision)
            return
        if name.startswith('templates/') and digest != self.policy['neutralTemplates'].get(name):
            self.add('changed-neutral-template', name, revision=revision)
        if PurePosixPath(name).suffix in {'.png', '.woff2', '.svg', '.ttf'}:
            if digest != self.policy['reviewedBinaryAssets'].get(name):
                self.add('unreviewed-asset', name, revision=revision)
            return
        if len(raw) > 5_000_000 or b'\0' in raw:
            self.add('binary-or-oversized-source', name, revision=revision)
            return
        try:
            raw.decode('utf-8')
        except UnicodeDecodeError:
            self.add('non-text-source', name, revision=revision)
            return
        self.text(name, raw, revision)

    def index(self):
        self.policy_snapshot('')  # Read the staged policy, never an unstaged relaxation.
        for row in filter(None, git(self.root, 'ls-files', '--stage', '-z').split(b'\0')):
            meta, name = row.split(b'\t', 1)
            mode, oid, stage = meta.decode().split()
            name = name.decode()
            if stage != '0':
                self.add('unresolved-merge', name)
                continue
            raw = self.blob(oid) if mode != '160000' else b''
            self.entry(name, raw, mode)

    def tree(self, revision, historical=False):
        for row in filter(None, git(self.root, 'ls-tree', '-rz', revision).split(b'\0')):
            meta, name = row.split(b'\t', 1)
            mode, kind, oid = meta.decode().split()
            raw = self.blob(oid) if kind == 'blob' else b''
            self.entry(name.decode(), raw, mode, historical, revision)

    def blob(self, oid):
        if oid not in self.blobs:
            self.blobs[oid] = git(self.root, 'cat-file', 'blob', oid)
        return self.blobs[oid]

    def history(self, revision):
        if git(self.root, 'rev-parse', '--is-shallow-repository').strip() == b'true':
            raise ValueError('Complete Git history is required for source checks.')
        for commit in git(self.root, 'rev-list', revision).decode().splitlines():
            self.tree(commit, historical=True)
            self.text('<commit-message>', git(self.root, 'show', '-s', '--format=%B', commit), commit)

    def push(self, rows):
        for row in rows.splitlines():
            _local_ref, local_oid, remote_ref, _remote_oid = row.split()
            if set(local_oid) == {'0'}:
                continue
            if not remote_ref.startswith(('refs/heads/', 'refs/tags/')):
                self.add('non-source-ref', '<git-ref>')
                continue
            revision = git(self.root, 'rev-parse', local_oid + '^{commit}').decode().strip()
            self.policy_snapshot(revision)
            self.text('<git-ref>', remote_ref.encode())
            tagged = local_oid
            while git(self.root, 'cat-file', '-t', tagged).strip() == b'tag':
                tag = git(self.root, 'cat-file', 'tag', tagged)
                self.text('<tag-message>', tag.split(b'\n\n', 1)[-1], tagged)
                tagged = tag.splitlines()[0].decode().split()[1]
            self.tree(revision)
            self.history(revision)

    def directory(self, directory):
        directory = Path(directory)
        for parent, dirs, files in os.walk(directory, followlinks=False):
            dirs[:] = [d for d in dirs if d != '.git']
            for d in list(dirs):
                p = Path(parent) / d
                if p.is_symlink():
                    self.entry(p.relative_to(directory).as_posix(), b'', '120000')
                    dirs.remove(d)
            for name in files:
                p = Path(parent) / name
                self.entry(p.relative_to(directory).as_posix(), b'' if p.is_symlink() else p.read_bytes(),
                           '120000' if p.is_symlink() else '100644')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--index', action='store_true')
    group.add_argument('--push', action='store_true')
    group.add_argument('--revision')
    group.add_argument('--incoming')
    group.add_argument('--directory', type=Path)
    group.add_argument('--message', type=Path)
    args = parser.parse_args()
    try:
        scanner = Scanner(args.root)
        if args.push:
            scanner.push(sys.stdin.read())
        elif args.incoming:
            scanner.history(args.incoming)
        elif args.revision:
            scanner.policy_snapshot(args.revision)
            scanner.tree(args.revision)
            scanner.history(args.revision)
        elif args.directory:
            scanner.directory(args.directory)
        elif args.message:
            scanner.text('<commit-message>', args.message.read_bytes())
        else:
            scanner.index()
        print(json.dumps({'scanned': scanner.scanned, 'findings': scanner.findings,
                          'limits': 'Local patterns, protected paths, reviewed assets and local company text; no semantic guarantee for arbitrary or encoded contents.'}))
        return 1 if scanner.findings else 0
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({'error': 'Source check could not complete.', 'kind': type(error).__name__}))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
