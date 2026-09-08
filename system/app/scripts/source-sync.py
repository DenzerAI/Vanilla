#!/usr/bin/env python3
"""Merge inspected application source while preserving this installation's company files."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = ROOT.parents[1] if ROOT.name == 'app' and ROOT.parent.name == 'system' else ROOT
spec = importlib.util.spec_from_file_location('source_guard', ROOT / 'scripts/security-scan.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


def run(root, *args):
    result = subprocess.run(args, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Never echo diffs, commit messages or dependency output into a shared log.
        raise ValueError('Command failed: ' + args[0] + ' ' + args[1])
    return result.stdout


def require_clean_source(root):
    if guard.git(root, 'diff', '--cached', '--name-only'):
        raise ValueError('Commit or separately preserve staged changes before merging.')
    for name in guard.git(root, 'diff', '--name-only', '-z').split(b'\0'):
        if name and not name.startswith(b'firmenbasis/'):
            raise ValueError('Commit or separately preserve source changes before merging.')
    if guard.git(root, 'ls-files', '--others', '--exclude-standard', '-z'):
        raise ValueError('Commit or separately preserve new source files before merging.')
    for marker in ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']:
        p = Path(guard.git(root, 'rev-parse', '--git-path', marker).decode().strip())
        if (p if p.is_absolute() else root / p).exists():
            raise ValueError('Finish the current Git operation before merging.')


def snapshot_company(root, directory):
    base = root / 'firmenbasis'
    if base.is_symlink():
        raise ValueError('Company directory cannot be a symlink during source migration.')
    if not base.exists():
        return False
    for parent, dirs, files in os.walk(base, followlinks=False):
        if any((Path(parent) / name).is_symlink() for name in dirs + files):
            raise ValueError('Resolve company symlinks before source migration.')
    shutil.copytree(base, directory / 'firmenbasis')
    return True


def restore_company(root, directory, previous):
    base = directory / 'firmenbasis'
    if not base.exists():
        return
    for saved in sorted(base.rglob('*')):
        name = saved.relative_to(directory).as_posix()
        target = root / name
        if target.is_symlink():
            raise ValueError('Company path changed concurrently. Preserved copy remains in the local recovery directory.')
        if saved.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        raw = saved.read_bytes()
        if target.exists() and target.read_bytes() not in (raw, previous.get(name)):
            raise ValueError('Company file changed concurrently. Preserved copy remains in the local recovery directory.')
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != raw:
            shutil.copy2(saved, target)


def merge(root, target, check_only=False):
    root = root.resolve()
    if Path(guard.git(root, 'rev-parse', '--show-toplevel').decode().strip()).resolve() != root:
        raise ValueError('Run source merge in the source checkout root.')
    require_clean_source(root)
    head = guard.git(root, 'rev-parse', 'HEAD').decode().strip()
    target = guard.git(root, 'rev-parse', '--verify', '--end-of-options', target + '^{commit}').decode().strip()
    scanner = guard.Scanner(root)
    scanner.history(head)
    scanner.history(target)
    if scanner.findings:
        return {'merged': False, 'findings': scanner.findings}
    candidate = guard.git(root, 'merge-tree', '--write-tree', head, target).splitlines()[0].decode()
    fast_forward = subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor', head, target], capture_output=True).returncode == 0
    scanner.tree(candidate)
    if scanner.findings:
        return {'merged': False, 'findings': scanner.findings}
    if check_only:
        return {'checked': True, 'tree': candidate, 'findings': []}
    if subprocess.run(['git', '-C', str(root), 'merge-base', '--is-ancestor', target, head], capture_output=True).returncode == 0:
        return {'merged': False, 'alreadyIncluded': True, 'findings': []}

    # The first adoption removes formerly tracked company templates. Preserve the
    # actual local files BEFORE Git can remove them, including unstaged edits.
    recovery = root / '.verify/source-sync'
    if not recovery.resolve().is_relative_to(root):
        raise ValueError('Recovery directory must stay inside this installation.')
    recovery.mkdir(parents=True, exist_ok=True, mode=0o700)
    directory = Path(tempfile.mkdtemp(prefix='migration-', dir=recovery))
    previous = {}
    for row in filter(None, guard.git(root, 'ls-tree', '-rz', head, '--', 'firmenbasis').split(b'\0')):
        meta, name = row.split(b'\t', 1)
        mode, kind, oid = meta.decode().split()
        if mode not in {'100644','100755'} or kind != 'blob':
            raise ValueError('Unsupported legacy company entry.')
        previous[name.decode()] = guard.git(root, 'cat-file', 'blob', oid)
    if previous:
        snapshot_company(root, directory)
    (directory / 'state.json').write_text(json.dumps({'before':head, 'target':target, 'state':'prepared'}))
    started = False
    try:
        if previous:
            for saved in (directory / 'firmenbasis').rglob('*'):
                current = root / saved.relative_to(directory)
                if saved.is_file() and (current.is_symlink() or not current.is_file() or current.read_bytes() != saved.read_bytes()):
                    raise ValueError('Company files changed during migration preparation; no Git replacement was started.')
            guard.git(root, 'restore', '--worktree', '--source=HEAD', '--', 'firmenbasis')
        started = True
        run(root, 'git', 'merge', '--no-ff', '--no-commit', target)
        restore_company(root, directory, previous)
        staged = guard.Scanner(root)
        staged.index()
        if staged.findings:
            raise ValueError('Merged index did not pass the source check.')
        source = root/'system/app' if (root/'system/app/core').is_dir() else root
        run(root, 'node', str(source/'scripts/install-git-hooks.mjs'))
        run(root, 'node', str(source/'scripts/init-company.mjs'))
        run(root, 'git', 'commit', '-m', 'Merge verified application source')
        if fast_forward:
            # Hooks have checked this exact tree. Keep the incoming revision for
            # deployments that require equality with origin/main. Only the merge
            # commit created by this transaction is replaced; no files are reset.
            checked = guard.git(root, 'rev-parse', 'HEAD').decode().strip()
            if guard.git(root, 'rev-parse', 'HEAD^{tree}') != guard.git(root, 'rev-parse', target + '^{tree}'):
                raise ValueError('Checked source differs from the incoming revision.')
            guard.git(root, 'update-ref', '-m', 'Adopt verified source', 'HEAD', target, checked)
        (directory / 'state.json').write_text(json.dumps({'before':head, 'target':target, 'state':'complete'}))
        return {'merged': True, 'revision':guard.git(root,'rev-parse','HEAD').decode().strip(), 'findings': []}
    except BaseException:
        if started:
            subprocess.run(['git','-C',str(root),'merge','--abort'], capture_output=True)
        restore_company(root, directory, previous)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('revision', help='Already fetched branch or commit; no implicit remote or push.')
    parser.add_argument('--root', type=Path, default=REPOSITORY)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        result = merge(args.root, args.revision, args.check)
        print(json.dumps(result))
        return bool(result.get('findings'))
    except (OSError, ValueError) as error:
        print(json.dumps({'merged':False, 'error':str(error)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
