import path from 'node:path';
import {mkdir, readdir, realpath} from 'node:fs/promises';

// Only operating-system plumbing crosses from the launcher to an agent.
// Provider keys, proxy credentials and host profile variables are not plumbing.
export function workerEnvironment(env = process.env) {
  return Object.fromEntries(['PATH','LANG','LC_ALL','LC_CTYPE','TZ','SystemRoot','WINDIR','PATHEXT']
    .filter(key => typeof env[key] === 'string').map(key => [key, env[key]]));
}

export async function installationEnvironment(dataRoot) {
  const root = await realpath(dataRoot);
  const folders = {HOME:'worker-home',USERPROFILE:'worker-home',CODEX_HOME:'codex',
    CLAUDE_CONFIG_DIR:'claude',HERMES_HOME:'hermes',OPENCLAW_STATE_DIR:'openclaw',
    XDG_CONFIG_HOME:'worker-home/.config',XDG_DATA_HOME:'worker-home/.local/share',
    XDG_CACHE_HOME:'worker-home/.cache',TMPDIR:'worker-home/tmp',TEMP:'worker-home/tmp',TMP:'worker-home/tmp'};
  const inside = file => file === root || file.startsWith(root + path.sep);
  async function verify(dir) {
    if (!inside(await realpath(dir))) throw Error('Worker-Profil verweist außerhalb dieser Installation. Bitte ein eigenes Profil einrichten.');
    for (const e of await readdir(dir, {withFileTypes:true})) {
      const file = path.join(dir,e.name);
      if (e.isSymbolicLink() && !inside(await realpath(file))) throw Error('Worker-Profil enthält einen fremden Anschluss. Bitte ein eigenes Profil einrichten.');
      if (e.isDirectory()) await verify(file);
    }
  }
  const result = {};
  for (const [key,folder] of Object.entries(folders)) {
    const dir = path.join(root,folder);
    await mkdir(dir,{recursive:true,mode:0o700});
    if (!inside(await realpath(dir))) throw Error('Worker-Profil liegt außerhalb dieser Installation.');
    result[key] = dir;
  }
  for (const folder of ['codex','claude','hermes','openclaw','worker-home']) await verify(path.join(root,folder));
  return result;
}
