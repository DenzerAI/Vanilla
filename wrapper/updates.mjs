import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function fingerprint(root, recursive = false) {
  const hash = createHash('sha256');
  async function visit(dir) {
    for (const entry of (await readdir(dir, {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) await visit(file);
      else if (entry.isFile() && (recursive || /\.(mjs|json|py)$/.test(entry.name))) {
        hash.update(path.relative(root,file)); hash.update(await readFile(file));
      }
    }
  }
  await visit(root); return hash.digest('hex');
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
