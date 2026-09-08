#!/usr/bin/env python3
"""Publish only the scanned Vanilla tree, keeping the destination's own history."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def run(*args, cwd=ROOT, capture=True):
    return subprocess.run(args, cwd=cwd, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def source_files(root=ROOT):
    names = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '.'], cwd=root
    ).decode().split('\0')
    files = []
    forbidden = {'.git', '.venv', 'node_modules', 'data', 'workspaces', '.cache', '.verify',
                 '__pycache__', '.pytest_cache', 'logs', 'dist', 'credentials', 'secrets'}
    for name in sorted(set(filter(None, names))):
        path = root / name
        if not path.exists():
            continue  # Deliberately deleted source files remain deleted in the export.
        if (name.startswith('firmenbasis/') or set(Path(name).parts) & forbidden or path.is_symlink()
                or not path.resolve().is_relative_to(root.resolve()) or not path.is_file()
                or path.name.startswith('.env') or path.suffix in {'.db', '.sqlite3', '.log', '.pem', '.key'}):
            raise ValueError('Export contains a prohibited file: ' + name)
        files.append(name)
    for required in ('core/app.py', 'requirements.lock', 'package-lock.json', 'wrapper/package-lock.json'):
        if required not in files:
            raise ValueError('Incomplete source tree: ' + required)
    return files


def export(destination):
    destination = Path(destination)
    # Refuse source adoption before copying or committing an invalid UI.
    run("npm", "--prefix", "wrapper", "run", "design:verify", capture=False)
    files = source_files()
    for name in files:
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    run(sys.executable, 'scripts/security-scan.py', '--directory', '.', cwd=destination, capture=False)
    digest = hashlib.sha256()
    for name in files:
        digest.update(name.encode() + b'\0' + (destination / name).read_bytes() + b'\0')
    return files, digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--export', type=Path, help='New empty directory, no Git history')
    group.add_argument('--publish', help='Explicit private owner/vanilla-agent repository')
    args = parser.parse_args()
    if args.export:
        args.export.mkdir(parents=True, exist_ok=False)
        files, digest = export(args.export)
        print(json.dumps({'files': len(files), 'sha256': digest}))
        return
    repo = args.publish
    if len(repo.split('/')) != 2 or repo.split('/')[1] != 'vanilla-agent':
        raise ValueError('Only an explicitly named owner/vanilla-agent destination is allowed.')
    info = json.loads(run('gh', 'repo', 'view', repo, '--json', 'nameWithOwner,isPrivate,url,defaultBranchRef'))
    if not info['isPrivate'] or info['nameWithOwner'].lower() != repo.lower():
        raise ValueError('The destination must be the requested private repository.')
    branch = (info.get('defaultBranchRef') or {}).get('name')
    if branch and branch != 'main':
        raise ValueError('Expected destination branch main.')
    scratch = ROOT / '.verify'
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='publish-', dir=scratch) as directory:
        clone = Path(directory) / 'source'
        run('gh', 'repo', 'clone', repo, str(clone))
        if not branch:
            run('git', 'checkout', '-b', 'main', cwd=clone)
        run('git', 'rm', '-r', '--ignore-unmatch', '.', cwd=clone)
        files, digest = export(clone)
        # Every admitted file was checked by source_files and the isolated scanner.
        subprocess.run(['git', 'add', '-f', '--pathspec-from-file=-', '--pathspec-file-nul'],
                       cwd=clone, input=('\0'.join(files) + '\0').encode(), check=True)
        changed = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=clone).returncode
        if changed == 1:
            run('git', '-c', 'user.name=Vanilla Maintainer', '-c', 'user.email=maintainer@example.invalid',
                'commit', '-m', 'Synchronize verified Vanilla source', cwd=clone)
            run('git', 'push', 'origin', 'HEAD:main', cwd=clone, capture=False)
        elif changed:
            raise RuntimeError('Unable to inspect staged changes.')
        revision = run('git', 'rev-parse', 'HEAD', cwd=clone).strip()
        remote = run('gh', 'api', f'repos/{repo}/commits/main', '--jq', '.sha').strip()
        visibility = json.loads(run('gh', 'repo', 'view', repo, '--json', 'isPrivate'))
        if revision != remote or not visibility['isPrivate']:
            raise RuntimeError('Remote revision or private visibility verification failed.')
        print(json.dumps({'repository': info['url'], 'private': True, 'commit': revision,
                          'source_sha256': digest, 'files': len(files)}))


if __name__ == '__main__':
    main()
