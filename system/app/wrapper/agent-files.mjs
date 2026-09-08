import {readdir, lstat, realpath} from 'node:fs/promises';
import path from 'node:path';
import {inside} from './storage.mjs';
import {resolveAlias} from './layout.mjs';
export async function agentFilePath(root, relative='') {
  relative = resolveAlias(root,relative);
  if (String(relative).split(/[\\/]/).some(part=>/^(data|secrets)$/i.test(part))) throw new Error('Geschützter Pfad.');
  const resolved = await inside(root,relative);
  const canonicalRoot = await realpath(root);
  const parts = path.relative(canonicalRoot,resolved).split(path.sep);
  if (parts.some(part=>part.startsWith('.') || /^(data|secrets|node_modules)$/i.test(part))) throw new Error('Geschützter Pfad.');
  return resolved;
}
export async function agentFiles(root, relative='') {
  root=await realpath(root);
  const dir=await agentFilePath(root,relative);
  const entries=await readdir(dir,{withFileTypes:true});
  return {root,path:relative,files:await Promise.all(entries.sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name)).map(async entry=>{
    const relativePath=path.relative(root,path.join(dir,entry.name));
    let accessible=true;
    try { await agentFilePath(root,relativePath); } catch { accessible=false; }
    const info=await lstat(path.join(dir,entry.name));
    return {name:entry.name,path:relativePath,directory:entry.isDirectory(),symlink:entry.isSymbolicLink(),accessible,size:info.size};
  }))};
}
