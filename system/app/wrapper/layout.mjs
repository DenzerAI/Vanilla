import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync, readFileSync, realpathSync} from 'node:fs';

export const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const installationRoot = process.env.VANILLA_ROOT
  ? realpathSync(process.env.VANILLA_ROOT)
  : sourceRoot.endsWith(path.join('system','app')) ? path.resolve(sourceRoot,'../..') : sourceRoot;
export const modernLayout = process.env.VANILLA_LAYOUT === '2';
export const orderDataRoot = root => path.join(root, layoutManifest(root) ? 'system/data/order' : 'data');
export const orderMemoryRoot = root => layoutManifest(root) ? path.join(orderDataRoot(root),'brain') : path.join(root,'brain');
export function layoutManifest(root = installationRoot) {
  const file = path.join(root, 'system', 'layout.json');
  if (!existsSync(file)) return null;
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (value.version !== 2) throw Error('Unbekannte Workspace-Struktur.');
  return value;
}
export function identityPath(root = installationRoot, workspace = root) {
  return modernLayout || existsSync(path.join(root,'IDENTITY.md'))
    ? path.join(root,'IDENTITY.md') : path.join(workspace,'soul/IDENTITY.md');
}
export function workspaceName(value) {
  const name = String(value || '').normalize('NFC').trim();
  if (!name || name.length > 80 || /[\x00-\x1f<>:"/\\|?*]/.test(name)
    || name.startsWith('.') || /[. ]$/.test(name)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
    throw Error('Bitte einen Ordnernamen mit 1 bis 80 Zeichen ohne /, \\, : oder reservierte Sonderzeichen eingeben.');
  return name;
}
export function knowledgeScopes(value = []) {
  if (!Array.isArray(value) || value.some(scope => !['company','personal'].includes(scope)))
    throw Error('Unbekannter Wissensbereich.');
  return [...new Set(value)];
}
// Aliases retain historical links. They never grant access past a caller's root.
export function resolveAlias(root, relative, manifest = layoutManifest(root)) {
  if (!manifest) return relative;
  let value = relative;
  const aliases = Object.entries(manifest.aliases || {}).sort((a,b)=>b[0].length-a[0].length);
  for (let turn=0; turn<32; turn++) {
    const match = aliases.find(([from])=>value === from || value.startsWith(from+'/'));
    if (!match) return value;
    const next = match[1] + value.slice(match[0].length);
    if (next === value) return value;
    value = next;
  }
  throw Error('Zirkulärer alter Dateiverweis.');
}
