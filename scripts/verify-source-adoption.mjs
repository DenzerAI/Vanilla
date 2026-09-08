import {spawnSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const local = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.AGENT_PYTHON || (existsSync(local) ? local : 'python3');
const mode = process.argv[2] || 'commit';
const git = (...args) => {
  const result = spawnSync('git', args, {cwd:root, encoding:'utf8'});
  if (result.status !== 0) throw Error('Git-Zustand konnte nicht geprüft werden.');
  return result.stdout.trim();
};
const before = mode === 'message' ? null : git('write-tree');
const input = mode === 'push' ? readFileSync(0) : undefined;
const args = mode === 'push' ? ['--push'] : mode === 'message' ? ['--message', process.argv[3]] : ['--index'];
const privacy = spawnSync(python, ['scripts/security-scan.py', ...args], {cwd:root, input, stdio:[input ? 'pipe' : 'inherit','inherit','inherit']});
if (privacy.status !== 0) process.exit(privacy.status || 1);
if (mode !== 'message') {
  const design = spawnSync(process.execPath, ['scripts/verify-design-adoption.mjs', mode], {cwd:root, input, stdio:[input ? 'pipe' : 'inherit','inherit','inherit']});
  if (before !== git('write-tree')) throw Error('Der vorgemerkte Git-Inhalt hat sich während der Prüfung verändert. Commit oder Push wurde gestoppt.');
  process.exit(design.status ?? 1);
}
