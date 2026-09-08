import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const run = (...args) => spawnSync('git', ['-C', root, ...args], {encoding:'utf8'});
const repository = run('rev-parse', '--show-toplevel');
if (repository.status !== 0) {
  if (existsSync(new URL('../.git', import.meta.url))) throw Error('Git-Prüfungen konnten nicht eingerichtet werden.');
  console.log('Quellarchiv ohne Git. Git-Prüfungen werden in einem Clone eingerichtet.');
} else {
  const current = run('config', '--get', 'core.hooksPath').stdout.trim();
  if (current && current !== '.githooks') throw Error('Ein anderer Git-Hook-Pfad ist eingerichtet. Datenschutz- und Design-Hooks müssen vor dem Weiterarbeiten zusammengeführt werden.');
  for (const name of ['pre-commit','pre-merge-commit','pre-push','commit-msg'])
    chmodSync(new URL('../.githooks/' + name, import.meta.url), 0o755);
  if (run('config', '--local', 'core.hooksPath', '.githooks').status !== 0) throw Error('Git-Hooks konnten nicht aktiviert werden.');
  console.log('Lokale Prüfungen für Commit, Merge und Push sind aktiviert.');
}
