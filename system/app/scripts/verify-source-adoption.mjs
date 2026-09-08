import {spawnSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const repository = spawnSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).stdout.trim();
if (!repository) throw Error('Git-Wurzel konnte nicht bestimmt werden.');
const gitEnv = {...process.env};
if (gitEnv.GIT_WORK_TREE) gitEnv.GIT_WORK_TREE = path.resolve(gitEnv.GIT_WORK_TREE);
if (gitEnv.GIT_DIR) gitEnv.GIT_DIR = path.resolve(gitEnv.GIT_DIR);
if (gitEnv.GIT_INDEX_FILE) gitEnv.GIT_INDEX_FILE = path.resolve(gitEnv.GIT_INDEX_FILE);
const local = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.AGENT_PYTHON || (existsSync(local) ? local : 'python3');
const mode = process.argv[2] || 'commit';
const git = (...args) => {
  const result = spawnSync('git', args, {cwd:repository, env:gitEnv, encoding:'utf8'});
  if (result.status !== 0) throw Error('Git-Zustand konnte nicht geprüft werden.');
  return result.stdout.trim();
};
const before = mode === 'message' ? null : git('write-tree');
const input = mode === 'push' ? readFileSync(0) : undefined;
const args = mode === 'push' ? ['--push'] : mode === 'message' ? ['--message', process.argv[3]] : ['--index'];
const privacy = spawnSync(python, [path.join(root,'scripts/security-scan.py'), '--root',repository, ...args], {cwd:repository, env:gitEnv, input, stdio:[input ? 'pipe' : 'inherit','inherit','inherit']});
if (privacy.status !== 0) process.exit(privacy.status || 1);
if (mode !== 'message') {
  const design = spawnSync(process.execPath, [path.join(root,'scripts/verify-design-adoption.mjs'), mode], {cwd:repository, env:gitEnv, input, stdio:[input ? 'pipe' : 'inherit','inherit','inherit']});
  if (before !== git('write-tree')) throw Error('Der vorgemerkte Git-Inhalt hat sich während der Prüfung verändert. Commit oder Push wurde gestoppt.');
  process.exit(design.status ?? 1);
}
