import json
from pathlib import Path

from core.source_release import SourceRelease, REQUIRED_CHECKS, check_state
from core.source_work import git
from core.tests.test_source_work import queue  # shared real-Git fixture


def checks(target, conclusion='success'):
    return [{'id': i + 1, 'name': n, 'head_sha': target, 'app': {'slug': 'github-actions'},
             'status': 'completed', 'conclusion': conclusion} for i, n in enumerate(sorted(REQUIRED_CHECKS))]


def test_only_exact_complete_successful_actions_allow_activation():
    assert check_state(checks('old'), 'new') == 'waiting-for-checks'
    assert check_state(checks('new')[:-1], 'new') == 'waiting-for-checks'
    assert check_state(checks('new', 'skipped'), 'new') == 'checks-failed'
    assert check_state(checks('new'), 'new') == 'checked'
    latest = {**checks('new')[0], 'id': 100, 'conclusion': 'failure'}
    assert check_state(checks('new') + [latest], 'new') == 'checks-failed'


def test_push_does_not_wait_for_other_sessions_or_blocked_activation(queue, tmp_path):
    work, repo = queue
    remote = tmp_path / 'remote.git'
    git(repo, 'init', '--bare', str(remote))
    git(repo, 'remote', 'add', 'origin', str(remote))
    pending = work.begin('still-working', 'another-chat')
    done = work.begin('done', 'finished-chat')
    (Path(done['path']) / 'feature.txt').write_text('finished')
    work.ready(done['id'])
    assert work.tick()['entries'][1]['status'] == 'integrated'
    service = SourceRelease(work.directory.parent)
    service.configure('origin', 'main', 'example/project', ['/usr/bin/true'])
    config = json.loads(service.config_file.read_text())
    state = {'version': 1, 'releases': [{'target': 'earlier', 'phase': 'activation-blocked'}]}
    service.publish(state, config)
    first = git(repo, 'rev-parse', 'HEAD')
    assert git(repo, 'ls-remote', 'origin', 'refs/heads/main').split()[0] == first
    assert work.status()['entries'][0]['status'] == 'working'
    (Path(pending['path']) / 'later.txt').write_text('finished later')
    work.ready(pending['id'])
    assert work.tick()['entries'][0]['status'] == 'integrated'
    service.publish(state, config)
    assert len(state['releases']) == 3
    assert state['releases'][-1]['target'] != first
    assert git(repo, 'ls-remote', 'origin', 'refs/heads/main').split()[0] == state['releases'][-1]['target']
    service.publish(state, config)
    assert len(state['releases']) == 3


def test_unknown_activation_blocks_new_switch_but_keeps_next_release(queue, tmp_path, monkeypatch):
    work, _ = queue
    service = SourceRelease(work.directory.parent)
    service.directory.mkdir()
    service.config_file.write_text(json.dumps({'operator': ['/usr/bin/true']}))
    attempt = tmp_path / 'attempt'
    attempt.mkdir()
    service.save({'version': 1, 'releases': [
        {'target': 'a', 'phase': 'activating', 'attempt': str(attempt)},
        {'target': 'b', 'phase': 'checked'}]})
    monkeypatch.setattr(service, 'publish', lambda *_: None)
    state = service.tick()
    assert [r['phase'] for r in state['releases']] == ['activation-blocked', 'checked']


def test_live_receipt_must_match_commit(queue, tmp_path, monkeypatch):
    work, _ = queue
    service = SourceRelease(work.directory.parent)
    service.directory.mkdir()
    service.config_file.write_text(json.dumps({'operator': ['/usr/bin/true']}))
    attempt = tmp_path / 'attempt'
    attempt.mkdir()
    (attempt / 'status.json').write_text(json.dumps({'phase': 'live', 'target': 'wrong'}))
    service.save({'version': 1, 'releases': [{'target': 'right', 'phase': 'activating', 'attempt': str(attempt)}]})
    monkeypatch.setattr(service, 'publish', lambda *_: None)
    assert service.tick()['releases'][0]['phase'] == 'activation-blocked'
