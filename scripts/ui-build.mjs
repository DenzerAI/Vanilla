import {createHash} from 'node:crypto';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprint} from '../wrapper/updates.mjs';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const digest = data => createHash('sha256').update(data).digest('hex');
export async function uiSourceVersion(root = repositoryRoot) {
  const wrapper = path.join(root, 'wrapper');
  return digest(JSON.stringify(await Promise.all([
    fingerprint(path.join(wrapper, 'ui'), true),
    fingerprint(path.join(wrapper, 'public'), true),
    fingerprint(wrapper),
    fingerprint(path.join(root, 'system'), true),
    ...['build.mjs', 'vite.config.ts', 'package-lock.json'].map(file => readFile(path.join(wrapper, file), 'utf8')),
    readFile(path.join(root, 'scripts/ui-build.mjs'), 'utf8'),
  ])));
}
export async function recordUiBuild(root = repositoryRoot, uiVersion = undefined) {
  const directory = path.join(root, 'wrapper/dist'), files = {};
  async function visit(relative = '') {
    for (const entry of (await readdir(path.join(directory, relative), {withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw Error('UI-Build enthält einen symbolischen Link.');
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile() && name !== 'version.json') files[name] = digest(await readFile(path.join(directory, name)));
    }
  }
  await visit();
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], {cwd:root, encoding:'utf8'});
  const status = spawnSync('git', ['status', '--porcelain'], {cwd:root, encoding:'utf8'});
  const product = JSON.parse(await readFile(path.join(root, 'system/version.json'), 'utf8'));
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(product.version || '')) throw Error('Produktversion fehlt oder ist ungültig.');
  const manifest = {format:1, productVersion:product.version, uiVersion:uiVersion || await uiSourceVersion(root), sourceRevision:revision.status===0?revision.stdout.trim():null, sourceDirty:status.status===0?!!status.stdout.trim():null, files};
  await writeFile(path.join(directory, 'version.json'), JSON.stringify(manifest));
  return manifest;
}
export async function verifyUiBuild(root = repositoryRoot) {
  const directory = path.join(root, 'wrapper/dist');
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(directory, 'version.json'), 'utf8')); }
  catch { throw Error('UI-Build fehlt. npm run control:build ausführen.'); }
  if (manifest.format !== 1 || !manifest.files || manifest.uiVersion !== await uiSourceVersion(root))
    throw Error('UI-Build passt nicht zum aktuellen Quellcode. npm run control:build ausführen.');
  const product = JSON.parse(await readFile(path.join(root, 'system/version.json'), 'utf8'));
  if (manifest.productVersion !== product.version) throw Error('UI-Build enthält eine abweichende Produktversion.');
  for (const required of ['index.html', 'app.js', 'app.css', 'blueprint.html', 'blueprint.js'])
    if (!manifest.files[required]) throw Error('UI-Build ist unvollständig: '+required);
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (name.includes('\\') || path.posix.isAbsolute(name) || name.split('/').some(part=>!part || part==='.' || part==='..'))
      throw Error('Ungültiger Dateipfad im UI-Build.');
    let actual;
    try { actual = digest(await readFile(path.join(directory, name))); }
    catch { throw Error('UI-Builddatei fehlt: '+name); }
    if (actual !== expected) throw Error('UI-Builddatei wurde verändert: '+name);
  }
  return {ok:true, productVersion:manifest.productVersion, uiVersion:manifest.uiVersion, sourceRevision:manifest.sourceRevision, sourceDirty:manifest.sourceDirty};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await verifyUiBuild(), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
