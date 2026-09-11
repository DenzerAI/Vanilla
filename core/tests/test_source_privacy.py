"""Actual Git indexes, hooks and two installations; all contents are synthetic."""
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest

ROOT = Path(__file__).resolve().parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), ROOT / 'scripts' / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


guard = module('security-scan')
sync = module('source-sync')


def git(root, *args, check=True):
    return subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, check=check)


def write(root, name, value):
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(value)


def commit(root, message='Synthetic source change'):
    # Construct fixture history, including deliberately unsafe commits. The
    # actual installed hooks are exercised separately below without this flag.
    git(root, '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-qm', message)


def identity(root):
    git(root, 'config', 'user.name', 'Synthetic reviewer')
    git(root, 'config', 'user.email', 'reviewer@example.invalid')
    git(root, 'config', 'commit.gpgsign', 'false')


@pytest.fixture
def repo(tmp_path, monkeypatch):
    monkeypatch.delenv('COMPANY_BASE', raising=False)
    root = tmp_path / 'source'
    root.mkdir()
    git(root, 'init', '-q', '-b', 'main')
    identity(root)
    paths = ['.gitignore', 'system/source-policy.json', 'backend/company-base.mjs',
             'wrapper/isolation.mjs', 'scripts/security-scan.py', 'scripts/source-sync.py',
             'scripts/init-company.mjs', 'scripts/install-git-hooks.mjs',
             'scripts/verify-source-adoption.mjs', 'scripts/verify-design-adoption.mjs',
             '.githooks/pre-commit', '.githooks/pre-merge-commit', '.githooks/pre-push', '.githooks/commit-msg']
    for name in paths:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / name, target)
    shutil.copytree(ROOT / 'templates', root / 'templates')
    # This fixture isolates privacy and index protection; module behavior has its own real-tree tests.
    write(root, 'scripts/verify-modules.py', 'raise SystemExit(0)\n')
    write(root, 'core/example.py', 'VERSION = 1\n')
    git(root, 'add', '.')
    commit(root, 'Synthetic base')
    return root


def install(root):
    subprocess.run(['node', 'scripts/install-git-hooks.mjs'], cwd=root, check=True, capture_output=True)
    subprocess.run(['node', 'scripts/init-company.mjs'], cwd=root, check=True, capture_output=True)


def test_initialized_company_data_is_local_and_never_reseeded(repo):
    install(repo)
    assert git(repo, 'config', '--get', 'core.hooksPath').stdout.strip() == '.githooks'
    for name in ['firmenbasis/FIRMA.md', 'firmenbasis/custom/SKILL.md',
                 'workspaces/default/soul/IDENTITY.md', 'data/control/agent.sqlite3', '.env']:
        write(repo, name, 'Synthetic local contents that must stay on this installation.\n')
    install(repo)
    git(repo, 'add', '-A')
    assert git(repo, 'diff', '--cached', '--name-only').stdout == ''
    assert (repo / 'firmenbasis/FIRMA.md').read_text().startswith('Synthetic local contents')
    scanner = guard.Scanner(repo)
    scanner.index()
    assert scanner.findings == []


@pytest.mark.parametrize('name', ['firmenbasis/FIRMA.md', 'firmenbasis/customer/SKILL.md',
    'data/control/agent.sqlite3', 'workspaces/default/soul/IDENTITY.md', '.env',
    'brain/MEMORY.md', 'wrapper/customers.csv', 'core/account.json', 'wrapper/ui/assets/crm/customers.json'])
def test_forced_runtime_or_content_files_are_rejected(repo, name):
    write(repo, name, 'Synthetic confidential contents\n')
    git(repo, 'add', '-f', name)
    scanner = guard.Scanner(repo)
    scanner.index()
    assert any(f['type'] == 'non-source-path' and f['file'] == name for f in scanner.findings)


def test_staged_blob_is_scanned_even_when_working_file_is_clean(repo):
    secret = 'sk-' + 'A9bC' * 12
    write(repo, 'core/example.py', 'VALUE = ' + repr(secret) + '\n')
    git(repo, 'add', 'core/example.py')
    write(repo, 'core/example.py', 'VALUE = None\n')
    scanner = guard.Scanner(repo)
    scanner.index()
    assert any(f['type'] == 'provider-token' for f in scanner.findings)
    assert secret not in json.dumps(scanner.findings)


def test_local_company_prose_cannot_be_copied_into_source(repo):
    content = 'This fictional internal project has a confidential delivery arrangement.'
    write(repo, 'firmenbasis/FIRMA.md', content)
    write(repo, 'docs/copied.md', content)
    git(repo, 'add', 'docs/copied.md')
    scanner = guard.Scanner(repo)
    scanner.index()
    assert any(f['type'] == 'local-company-content' for f in scanner.findings)
    assert content not in json.dumps(scanner.findings)


def test_changed_template_and_unreviewed_image_are_blocked(repo):
    write(repo, 'templates/firmenbasis/FIRMA.md', '# A fictional company profile\n')
    write(repo, 'wrapper/ui/assets/customer.png', 'synthetic image bytes')
    git(repo, 'add', '-f', 'templates/firmenbasis/FIRMA.md', 'wrapper/ui/assets/customer.png')
    scanner = guard.Scanner(repo)
    scanner.index()
    assert {'changed-neutral-template','unreviewed-asset'} <= {f['type'] for f in scanner.findings}


def test_unstaged_policy_cannot_authorize_staged_company_template(repo):
    content = '# Fictional private company facts\n'
    name = 'templates/firmenbasis/FIRMA.md'
    write(repo, name, content)
    git(repo, 'add', name)
    policy = json.loads((repo / 'system/source-policy.json').read_text())
    policy['neutralTemplates'][name] = hashlib.sha256(content.encode()).hexdigest()
    write(repo, 'system/source-policy.json', json.dumps(policy))
    result = subprocess.run(['python3','scripts/security-scan.py','--index'],cwd=repo,capture_output=True,text=True)
    assert result.returncode == 1
    assert 'changed-neutral-template' in result.stdout


def test_symlink_is_rejected_without_reading_target(repo, tmp_path):
    outside = tmp_path / 'private.txt'
    outside.write_text('Synthetic outside data')
    (repo / 'core/link.py').symlink_to(outside)
    git(repo, 'add', 'core/link.py')
    scanner = guard.Scanner(repo)
    scanner.index()
    assert any(f['type'] == 'symlink-or-submodule' for f in scanner.findings)


def test_actual_commit_hook_rejects_private_file(repo):
    install(repo)
    write(repo, 'firmenbasis/FIRMA.md', 'Synthetic private company information')
    git(repo, 'add', '-f', 'firmenbasis/FIRMA.md')
    before = git(repo, 'rev-parse', 'HEAD').stdout
    result = git(repo, 'commit', '-m', 'Synthetic invalid change', check=False)
    assert result.returncode != 0
    assert 'non-source-path' in result.stdout + result.stderr
    assert git(repo, 'rev-parse', 'HEAD').stdout == before


def test_actual_message_hook_rejects_private_contact(repo):
    install(repo)
    write(repo, 'core/example.py', 'VERSION = 2\n')
    git(repo, 'add', 'core/example.py')
    contact = 'private-person' + '@' + 'private-company.de'
    result = git(repo, 'commit', '-m', 'Contact ' + contact, check=False)
    assert result.returncode != 0
    assert 'email' in result.stdout + result.stderr
    assert contact not in result.stdout + result.stderr


def test_validation_cannot_replace_the_index_that_was_checked(repo):
    write(repo, 'scripts/verify-design-adoption.mjs',
          "import {writeFileSync} from 'node:fs';\n"
          "import {execFileSync} from 'node:child_process';\n"
          "writeFileSync('core/example.py','VERSION = 99\\n');\n"
          "execFileSync('git',['add','core/example.py']);\n")
    git(repo, 'add', 'scripts/verify-design-adoption.mjs')
    commit(repo, 'Synthetic index-mutating validator fixture')
    install(repo)
    write(repo, 'core/example.py', 'VERSION = 2\n')
    git(repo, 'add', 'core/example.py')
    before = git(repo, 'rev-parse', 'HEAD').stdout
    result = git(repo, 'commit', '-m', 'Synthetic guarded change', check=False)
    assert result.returncode != 0
    assert 'während der Prüfung verändert' in result.stdout + result.stderr
    assert git(repo, 'rev-parse', 'HEAD').stdout == before


def test_actual_push_hook_blocks_secret_removed_in_later_commit(repo, tmp_path):
    secret = 'sk-' + 'G7xy' * 12
    write(repo, 'core/example.py', 'VALUE = ' + repr(secret) + '\n')
    git(repo, 'add', 'core/example.py')
    commit(repo, 'Synthetic unsafe fixture')
    write(repo, 'core/example.py', 'VALUE = None\n')
    git(repo, 'add', 'core/example.py')
    commit(repo)
    install(repo)
    remote = tmp_path / 'remote.git'
    git(tmp_path, 'init', '--bare', '-q', str(remote))
    git(repo, 'remote', 'add', 'origin', str(remote))
    result = git(repo, 'push', 'origin', 'HEAD:main', check=False)
    assert result.returncode != 0
    assert 'provider-token' in result.stdout + result.stderr
    assert secret not in result.stdout + result.stderr
    assert git(remote, 'rev-list', '--all').stdout == ''


def test_foreign_hooks_and_explicit_missing_company_are_not_overwritten(repo):
    git(repo, 'config', 'core.hooksPath', 'existing-hooks')
    result = subprocess.run(['node','scripts/install-git-hooks.mjs'],cwd=repo,capture_output=True)
    assert result.returncode != 0
    assert git(repo,'config','--get','core.hooksPath').stdout.strip() == 'existing-hooks'
    env = {**os.environ, 'COMPANY_BASE':str(repo / 'data/missing-company')}
    result = subprocess.run(['node','scripts/init-company.mjs'],cwd=repo,env=env,capture_output=True)
    assert result.returncode != 0
    assert not (repo / 'data/missing-company').exists()


def test_two_installations_exchange_structure_and_preserve_legacy_company_data(repo, tmp_path):
    # Simulate the old release with tracked neutral templates, then its migration.
    shutil.copytree(repo / 'templates/firmenbasis', repo / 'firmenbasis')
    git(repo, 'add', '-f', 'firmenbasis')
    commit(repo, 'Synthetic legacy version')
    other = tmp_path / 'other'
    git(tmp_path, 'clone', '-q', str(repo), str(other))
    identity(other)
    private_a = 'Fictional company A retains its own internal operating instructions.'
    private_b = 'Fictional company B retains entirely different internal operating instructions.'
    write(other, 'firmenbasis/FIRMA.md', private_b)
    write(other, 'firmenbasis/custom/SKILL.md', 'Fictional private workflow for company B.')
    write(other, 'data/control/agent.sqlite3', 'Fictional database B')
    git(repo, 'rm', '-r', '--cached', 'firmenbasis')
    write(repo, 'core/example.py', 'VERSION = 2\n')
    git(repo, 'add', 'core/example.py')
    commit(repo, 'Separate company data from application structure')
    write(repo, 'firmenbasis/FIRMA.md', private_a)
    git(other, 'fetch', '-q', 'origin')
    assert sync.merge(other, 'origin/main')['merged']
    assert git(other, 'rev-parse', 'HEAD').stdout == git(repo, 'rev-parse', 'HEAD').stdout
    assert (other / 'firmenbasis/FIRMA.md').read_text() == private_b
    assert (other / 'firmenbasis/custom/SKILL.md').read_text().endswith('company B.')
    assert (other / 'data/control/agent.sqlite3').read_text() == 'Fictional database B'
    assert (other / 'core/example.py').read_text() == 'VERSION = 2\n'
    assert git(other, 'ls-files', '--', 'firmenbasis', 'data').stdout == ''
    write(other, 'core/example.py', 'VERSION = 3\n')
    git(other, 'add', 'core/example.py')
    git(other, 'commit', '-qm', 'Improve neutral application structure')
    git(repo, 'fetch', '-q', str(other), 'main')
    assert sync.merge(repo, 'FETCH_HEAD')['merged']
    assert (repo / 'firmenbasis/FIRMA.md').read_text() == private_a
    assert (repo / 'core/example.py').read_text() == 'VERSION = 3\n'
    scanner = guard.Scanner(repo)
    scanner.tree('HEAD')
    scanner.history('HEAD')
    assert scanner.findings == []


def test_diverged_source_branches_merge_without_exchanging_company_data(repo):
    install(repo)
    write(repo, 'firmenbasis/FIRMA.md', 'Fictional local company description that belongs only here.')
    git(repo, 'checkout', '-qb', 'other-feature')
    write(repo, 'core/other_feature.py', 'ENABLED = True\n')
    git(repo, 'add', 'core/other_feature.py')
    commit(repo)
    git(repo, 'checkout', '-q', 'main')
    write(repo, 'core/local_feature.py', 'ENABLED = True\n')
    git(repo, 'add', 'core/local_feature.py')
    commit(repo)
    assert sync.merge(repo, 'other-feature')['merged']
    assert (repo / 'core/local_feature.py').is_file()
    assert (repo / 'core/other_feature.py').is_file()
    assert (repo / 'firmenbasis/FIRMA.md').read_text().endswith('only here.')
    assert len(git(repo,'rev-list','--parents','-n','1','HEAD').stdout.split()) == 3


def test_private_ref_names_and_nested_tag_messages_are_rejected(repo):
    contact = 'private-contact' + '@' + 'private-company.de'
    git(repo, 'tag', '-a', 'inner', '-m', 'Contact ' + contact)
    git(repo, 'tag', '-a', 'outer', 'inner', '-m', 'Synthetic outer tag')
    oid = git(repo, 'rev-parse', 'outer').stdout.strip()
    scanner = guard.Scanner(repo)
    scanner.push(f'refs/tags/outer {oid} refs/tags/outer ' + '0' * 40)
    assert any(f['file'] == '<tag-message>' for f in scanner.findings)
    assert contact not in json.dumps(scanner.findings)
    scanner = guard.Scanner(repo)
    scanner.push(f'HEAD {git(repo,"rev-parse","HEAD").stdout.strip()} refs/heads/{contact} ' + '0' * 40)
    assert any(f['file'] == '<git-ref>' for f in scanner.findings)
    assert contact not in json.dumps(scanner.findings)


def test_incoming_private_history_is_rejected_before_any_local_change(repo):
    base = git(repo, 'rev-parse', 'HEAD').stdout.strip()
    git(repo, 'checkout', '-qb', 'unsafe')
    write(repo, 'firmenbasis/FIRMA.md', 'Synthetic private content in an incoming revision')
    git(repo, 'add', '-f', 'firmenbasis/FIRMA.md')
    commit(repo)
    git(repo, 'rm', 'firmenbasis/FIRMA.md')
    commit(repo)
    git(repo, 'checkout', '-q', 'main')
    result = sync.merge(repo, 'unsafe')
    assert result['findings']
    assert git(repo, 'rev-parse', 'HEAD').stdout.strip() == base
    assert not (repo / '.verify/source-sync').exists()


def test_failed_merge_check_restores_local_company_and_source(repo):
    shutil.copytree(repo / 'templates/firmenbasis', repo / 'firmenbasis')
    git(repo, 'add', '-f', 'firmenbasis')
    commit(repo)
    git(repo, 'checkout', '-qb', 'new-version')
    git(repo, 'rm', '-r', '--cached', 'firmenbasis')
    write(repo, 'wrapper/ui/invalid.ts', 'export const example = 1;\n')
    git(repo, 'add', 'wrapper/ui/invalid.ts')
    commit(repo)
    # Ignore the remaining local company copy before checking out the legacy ref.
    shutil.rmtree(repo / 'firmenbasis')
    git(repo, 'checkout', '-q', 'main')
    before = git(repo, 'rev-parse', 'HEAD').stdout
    content = 'Fictional local company contents preserved after a rejected build.'
    write(repo, 'firmenbasis/FIRMA.md', content)
    with pytest.raises(ValueError):
        sync.merge(repo, 'new-version')  # Fixture deliberately has no UI dependencies.
    assert git(repo, 'rev-parse', 'HEAD').stdout == before
    assert (repo / 'firmenbasis/FIRMA.md').read_text() == content
    assert git(repo, 'diff', '--cached', '--name-only').stdout == ''


def test_truetype_fonts_require_an_exact_reviewed_hash(repo):
    name = 'wrapper/ui/assets/fonts/Fixture.ttf'
    raw = b'\x00\x01\x00\x00synthetic-font-fixture'
    scanner = guard.Scanner(repo)
    scanner.entry(name, raw)
    assert [finding['type'] for finding in scanner.findings] == ['unreviewed-asset']
    policy = json.loads((repo / 'system/source-policy.json').read_text())
    policy['reviewedBinaryAssets'][name] = hashlib.sha256(raw).hexdigest()
    scanner = guard.Scanner(repo, policy)
    scanner.entry(name, raw)
    assert scanner.findings == []
    scanner.entry(name, raw + b'changed')
    assert scanner.findings[-1]['type'] == 'unreviewed-asset'


def test_reviewed_neutral_template_may_share_a_local_instruction(repo):
    name = 'templates/firmenbasis/AGENTS.md'
    raw = (repo / name).read_bytes()
    scanner = guard.Scanner(repo)
    scanner.private_terms = {raw.splitlines()[5].strip().lower()}
    scanner.entry(name, raw)
    assert not scanner.findings
    scanner.entry(name, raw + b'\nChanged template\n')
    assert any(x['type'] == 'changed-neutral-template' for x in scanner.findings)


def test_historical_asset_review_does_not_allow_old_asset_in_new_index(repo):
    name = 'wrapper/public/app-icon.svg'
    raw = b'<svg xmlns="http://www.w3.org/2000/svg"><title>Fixture</title></svg>'
    scanner = guard.Scanner(repo)
    scanner.policy['legacyReviewedAssets'] = {name: [hashlib.sha256(raw).hexdigest()]}
    scanner.entry(name, raw, historical=True)
    assert not scanner.findings
    scanner.entry(name, raw)
    assert any(x['type'] == 'unreviewed-asset' for x in scanner.findings)
