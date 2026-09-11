import path from 'node:path';
import {mkdir, readdir, realpath, readFile} from 'node:fs/promises';

// Only operating-system plumbing crosses from the launcher to an agent.
// Provider keys, proxy credentials and host profile variables are not plumbing.
export function workerEnvironment(env = process.env) {
  return Object.fromEntries(['PATH','LANG','LC_ALL','LC_CTYPE','TZ','SystemRoot','WINDIR','PATHEXT']
    .filter(key => typeof env[key] === 'string').map(key => [key, env[key]]));
}

export async function installationEnvironment(dataRoot, workerId, environment = process.env) {
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
  const profileKeys = {codex:'CODEX_HOME', 'claw-code':'CLAUDE_CONFIG_DIR', hermes:'HERMES_HOME', openclaw:'OPENCLAW_STATE_DIR', gemini:null, kimi:null};
  if (workerId !== undefined && !Object.hasOwn(profileKeys, workerId)) throw Error('Unbekanntes Worker-Profil.');
  const nativeKeys = ['CODEX_HOME','CLAUDE_CONFIG_DIR','HERMES_HOME','OPENCLAW_STATE_DIR'];
  const selected = Object.entries(folders).filter(([key]) => workerId === undefined || !nativeKeys.includes(key) || key === profileKeys[workerId]);
  const result = {};
  for (const [key,folder] of selected) {
    const dir = path.join(root,folder);
    await mkdir(dir,{recursive:true,mode:0o700});
    if (!inside(await realpath(dir))) throw Error('Worker-Profil liegt außerhalb dieser Installation.');
    result[key] = dir;
  }
  for (const folder of new Set(selected.map(([, folder]) => folder))) await verify(path.join(root,folder));
  // A deployed installation can explicitly bind its own service credential.
  // New installations never adopt ambient provider credentials by default.
  if (workerId === 'claw-code') {
    const authFile = path.join(root, 'worker-auth.json');
    let auth;
    try {
      if (!inside(await realpath(authFile))) throw Error('Worker-Anmeldung liegt außerhalb dieser Installation.');
      auth = JSON.parse(await readFile(authFile, 'utf8'));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (auth !== undefined) {
      if (!auth || Array.isArray(auth) || auth.version !== 1 || !auth.environment || typeof auth.environment !== 'object' || Array.isArray(auth.environment)) throw Error('Unbekanntes Format der Worker-Anmeldung.');
      const source = auth.environment?.['claw-code'];
      if (source !== undefined) {
        const key = new Map([['oauth','CLAUDE_CODE_OAUTH_TOKEN'], ['api-key','ANTHROPIC_API_KEY']]).get(source);
        if (!key) throw Error('Unbekannte Claude-Anmeldequelle.');
        if (typeof environment[key] !== 'string' || !environment[key].trim()) throw Error('Der konfigurierte Claude-Zugang fehlt im Dienst. Bitte Dienstanmeldung prüfen.');
        result[key] = environment[key];
      }
    }
  }
  return result;
}
