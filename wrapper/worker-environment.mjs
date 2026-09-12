import path from 'node:path';
import {mkdir, readdir, realpath, readFile, stat} from 'node:fs/promises';

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
  const profileKeys = {codex:'CODEX_HOME', 'claw-code':'CLAUDE_CONFIG_DIR', hermes:'HERMES_HOME', openclaw:'OPENCLAW_STATE_DIR', gemini:null, kimi:null};
  if (workerId !== undefined && !Object.hasOwn(profileKeys, workerId)) throw Error('Unbekanntes Worker-Profil.');
  let auth;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (workerId !== undefined) {
    const authFile = path.join(root, 'worker-auth.json');
    try {
      if (!inside(await realpath(authFile))) throw Error('Worker-Anmeldung liegt außerhalb dieser Installation.');
      auth = JSON.parse(await readFile(authFile, 'utf8'));
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (auth !== undefined && (!object(auth) || auth.version !== 1
      || (auth.environment !== undefined && !object(auth.environment))
      || (auth.profileLinks !== undefined && !object(auth.profileLinks)))) throw Error('Unbekanntes Format der Worker-Anmeldung.');
  }
  const links = auth?.profileLinks?.[workerId] ?? {};
  if (!object(links) || Object.entries(links).some(([name,target]) => !name || name.split('/').some(part => !part || part === '.' || part === '..')
    || name.includes('\\') || typeof target !== 'string' || !path.isAbsolute(target))) throw Error('Ungültige Worker-Profilbindung.');
  const profileFolder = folders[profileKeys[workerId]];
  const boundLink = (file, target) => profileFolder && links[path.relative(path.join(root,profileFolder),file).split(path.sep).join('/')] === target;
  async function nativeShim(file, target) {
    // Codex creates executable aliases itself on every startup. These are
    // temporary tool entrypoints, never account, plugin or configuration links.
    const relative = path.relative(path.join(root, 'codex', 'tmp', 'arg0'), file).split(path.sep).join('/');
    if (!/^codex-arg[^/]+\/(applypatch|apply_patch|codex-execve-wrapper)$/.test(relative)
      || !['codex', 'codex.exe'].includes(path.basename(target))) return false;
    const info = await stat(target);
    return info.isFile() && Boolean(info.mode & 0o111);
  }
  async function swiftShim(file, target) {
    // SwiftPM links its config and cache folders from XDG_CONFIG_HOME into the
    // user's Library on every build (Xcode, xcodebuild). Neither holds credentials.
    const relative = path.relative(path.join(root, folders.HOME, '.config', 'swiftpm'), file).split(path.sep).join('/');
    if (!['configuration', 'cache', 'security'].includes(relative)) return false;
    return /\/Library\/(org\.swift\.swiftpm|Caches\/org\.swift\.swiftpm)(\/|$)/.test(target);
  }
  async function verify(dir) {
    if (!inside(await realpath(dir))) throw Error('Worker-Profil verweist außerhalb dieser Installation. Bitte ein eigenes Profil einrichten.');
    for (const e of await readdir(dir, {withFileTypes:true})) {
      const file = path.join(dir,e.name);
      if (e.isSymbolicLink()) {
        const target = await realpath(file);
        if (!inside(target) && !boundLink(file, target) && !await nativeShim(file, target) && !await swiftShim(file, target)) throw Error('Worker-Profil enthält einen fremden Anschluss. Bitte ein eigenes Profil einrichten.');
      }
      if (e.isDirectory()) await verify(file);
    }
  }
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
    if (auth !== undefined) {
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
