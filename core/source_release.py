"""Opt-in publication queue; a configured local operator owns live activation."""
from pathlib import Path
import json
import re
import subprocess
import time

from .files import atomic_write
from .source_work import SourceWork, command, environment, git

REQUIRED_CHECKS = {'source-privacy', 'design', 'customer-base (ubuntu-latest)',
                   'customer-base (macos-latest)', 'update-sandbox'}


def check_state(checks, target):
    latest = {}
    for check in checks:
        if check.get('head_sha') == target and check.get('app', {}).get('slug') == 'github-actions':
            name = check['name']
            if check.get('id', 0) > latest.get(name, {}).get('id', -1):
                latest[name] = check
    if any(name not in latest for name in REQUIRED_CHECKS):
        return 'waiting-for-checks'
    if any(latest[name]['status'] != 'completed' for name in REQUIRED_CHECKS):
        return 'waiting-for-checks'
    return 'checked' if all(latest[name].get('conclusion') == 'success' for name in REQUIRED_CHECKS) else 'checks-failed'


class SourceRelease:
    def __init__(self, data):
        self.work = SourceWork(data)
        self.directory = Path(data) / 'source-release'
        self.config_file = self.directory / 'config.json'
        self.file = self.directory / 'state.json'
        self.process = None

    def save(self, state):
        state['updatedAt'] = time.time()
        atomic_write(self.file, json.dumps(state, ensure_ascii=False, indent=2))

    def read(self):
        return json.loads(self.file.read_text()) if self.file.exists() else {'version': 1, 'releases': []}

    def configure(self, remote, branch, github, operator):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+', remote) or not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', github):
            raise ValueError('Git-Remote und GitHub-Repository ausdrücklich angeben.')
        if not operator or not Path(operator[0]).is_absolute() or not Path(operator[0]).is_file():
            raise ValueError('Lokalen Aktivierungsanschluss als absolute Befehlsliste angeben.')
        with self.work.locked() as work:
            root = Path(work['repository'])
            git(root, 'check-ref-format', 'refs/heads/' + branch)
            git(root, 'remote', 'get-url', remote)
            if git(root, 'symbolic-ref', '--short', 'HEAD') != branch:
                raise ValueError('Veröffentlichungszweig muss dem Integrationszweig entsprechen.')
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        config = {'remote': remote, 'branch': branch, 'github': github, 'operator': operator}
        if self.config_file.exists() and json.loads(self.config_file.read_text()) != config:
            raise ValueError('Bestehenden Veröffentlichungsdienst vor einer Umstellung stoppen und prüfen.')
        atomic_write(self.config_file, json.dumps(config))

    def publish(self, state, config):
        # Only the integration writer is locked. Running chats never gate a push.
        with self.work.locked(blocking=False) as work:
            if work is None:
                return
            root = Path(work['repository'])
            target = git(root, 'rev-parse', 'HEAD')
            if any(r['target'] == target for r in state['releases']):
                return
            if not any(r.get('candidateCommit') == target and r['status'] == 'integrated' for r in work['entries']):
                raise ValueError('Integrationsstand hat keinen erfolgreichen Übergabenachweis.')
            if git(root, 'status', '--porcelain') or git(root, 'symbolic-ref', '--short', 'HEAD') != config['branch']:
                raise ValueError('Integrationszweig wurde außerhalb der Warteschlange verändert.')
            command(root, ['git', 'push', config['remote'], target + ':refs/heads/' + config['branch']], self.directory / 'publish.log')
            remote = git(root, 'ls-remote', config['remote'], 'refs/heads/' + config['branch']).split()
            if not remote or remote[0] != target:
                raise ValueError('Gepushter Stand konnte nicht bestätigt werden.')
            state['releases'].append({'target': target, 'phase': 'published', 'publishedAt': time.time()})
            self.save(state)

    def tick(self):
        if not self.config_file.exists():
            return {'enabled': False}
        config, state = json.loads(self.config_file.read_text()), self.read()
        try:
            self.publish(state, config)
            state.pop('error', None)
        except Exception as error:
            state['error'] = str(error)[:300]
        # A previous activation is reconciled before another can start.
        running = next((r for r in state['releases'] if r['phase'] == 'activating'), None)
        if running:
            receipt = Path(running['attempt']) / 'status.json'
            observed = json.loads(receipt.read_text()) if receipt.exists() else {}
            running['activationPhase'] = observed.get('phase', 'preparing')
            newer = [r for r in state['releases'] if r['phase'] == 'checked' and r.get('publishedAt', 0) > running.get('publishedAt', 0)]
            if newer and observed.get('phase') == 'waiting-for-sessions' and self.process is not None and self.process.poll() is None:
                # Nothing is stopped or replaced while the operator waits: the newest checked commit takes this window.
                self.process.terminate()
                try:
                    self.process.wait(30)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait()
                observed = json.loads(receipt.read_text()) if receipt.exists() else {}
                if observed.get('phase') == 'waiting-for-sessions':
                    running.update(phase='superseded', supersededBy=newer[-1]['target'],
                                   reason='Vor dem Neustart durch den neueren geprüften Stand ersetzt.')
                    self.process = None
            if running['phase'] == 'activating' and (self.process is None or self.process.poll() is not None):
                if observed.get('phase') == 'live' and observed.get('target') == running['target']:
                    running.update(phase='live', verification=observed.get('verification', {}))
                else:
                    running.update(phase='activation-blocked', reason=observed.get('error', 'Aktivierung unterbrochen; Rückkehrjournal prüfen.'))
                self.process = None
        for row in state['releases']:
            if row['phase'] in {'published', 'waiting-for-checks', 'checks-failed'}:
                try:
                    payload = command(self.directory, ['gh', 'api', '--paginate', '--slurp',
                        'repos/' + config['github'] + '/commits/' + row['target'] + '/check-runs?per_page=100'], timeout=60)
                    checks = [c for page in json.loads(payload) for c in page['check_runs']]
                    row['phase'] = check_state(checks, row['target'])
                    atomic_write(self.directory / (row['target'] + '-checks.json'), json.dumps(checks))
                    row.pop('reason', None)
                except Exception as error:
                    row['reason'] = str(error)[:300]
        # A failed/unknown activation stops deployment, never publication.
        blocked = any(r['phase'] in {'activating', 'activation-blocked'} for r in state['releases'])
        candidates = [r for r in state['releases'] if r['phase'] == 'checked']
        if not blocked and candidates:
            row = candidates[-1]
            for older in candidates[:-1]:
                older.update(phase='superseded', supersededBy=row['target'])
            attempt = self.directory / 'attempts' / row['target']
            attempt.mkdir(parents=True, exist_ok=False)
            row.update(phase='activating', attempt=str(attempt), activationPhase='preparing')
            self.save(state)
            try:
                with (attempt / 'operator.log').open('ab') as log:
                    self.process = subprocess.Popen([*config['operator'], '--target', row['target'], '--attempt', str(attempt)],
                        cwd=self.directory, env=environment(), stdout=log, stderr=subprocess.STDOUT)
            except Exception as error:
                row.update(phase='activation-blocked', reason=str(error)[:300])
        self.save(state)
        return state
