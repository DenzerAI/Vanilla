import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function fingerprint(root, recursive = false, exclude = []) {
  const hash = createHash('sha256');
  async function visit(dir) {
    for (const entry of (await readdir(dir, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (exclude.includes(path.relative(root, file))) continue;
      if (entry.isDirectory() && recursive) await visit(file);
      else if (entry.isFile() && (recursive || /\.(mjs|json|py)$/.test(entry.name))) {
        hash.update(path.relative(root,file)); hash.update(await readFile(file));
      }
    }
  }
  await visit(root); return hash.digest('hex');
}

// Build tooling and package metadata do not describe the running server.
// Keep shared UI modules here when they are imported by server-side modules.
export async function serverFingerprint(root) {
  const wrapper = path.join(root, 'wrapper');
  const manifest = JSON.parse(await readFile(path.join(wrapper, 'package.json'), 'utf8'));
  let lock = {};
  try { lock = JSON.parse(await readFile(path.join(wrapper, 'package-lock.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const runtimeLock = Object.entries(lock.packages || {}).filter(([name, pkg]) => name && !pkg.dev)
    .map(([name, pkg]) => [name, pkg.version, pkg.resolved, pkg.integrity, pkg.link]).sort(([a], [b]) => a.localeCompare(b));
  const runtimeDependencies = Object.entries({...manifest.dependencies, ...manifest.optionalDependencies}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(await Promise.all([
    fingerprint(wrapper, false, ['build.mjs', 'package.json', 'package-lock.json']),
    ...['backend', 'system', 'core'].map(dir => fingerprint(path.join(root, dir))),
    ...['appearance.mjs', 'tool-content.mjs', 'artifact-content.mjs', 'agent-avatars.mjs', 'connection-catalog.mjs']
      .map(file => readFile(path.join(wrapper, 'ui', file), 'utf8')),
    JSON.stringify(runtimeDependencies), JSON.stringify(runtimeLock),
  ]));
}

export function createRestartGate({sessions, restart}) {
  const confirmations = new Map();
  let restarting = false;
  return {
    get restarting() { return restarting; },
    async request(body = {}) {
      if (restarting) throw new Error('Der Server wird bereits neu gestartet.');
      const current = sessions().sort();
      if (current.length) {
        const prior = confirmations.get(body.confirmation);
        confirmations.clear();
        if (!prior || prior.expires < Date.now() || JSON.stringify(current) !== prior.signature) {
          const confirmation = randomUUID();
          confirmations.set(confirmation, {signature:JSON.stringify(current), expires:Date.now()+60000});
          return {confirmationRequired:true, confirmation, count:current.length};
        }
      }
      restarting = true;
      try { await restart(); } catch(error) { restarting = false; throw error; }
      return {restarting:true};
    },
  };
}
