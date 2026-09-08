import { readFile, realpath, cp, rename, access, rm, chmod } from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {localPath} from '../wrapper/isolation.mjs';

export function companyRoot(root) {
  root = realpathSync(path.resolve(root));
  const base = localPath(process.env.COMPANY_BASE || path.join(root, 'firmenbasis'), root);
  const relative = path.relative(root, base);
  if (relative === 'templates' || relative.startsWith('templates' + path.sep))
    throw new Error('Firmenwissen benötigt einen lokalen Datenordner; Vorlagen sind keine Firmenbasis.');
  const repository = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {encoding:'utf8'});
  if (repository.status === 0) {
    const tracked = spawnSync('git', ['-C', root, 'ls-files', '-z', '--', base], {encoding:'utf8'});
    const ignored = spawnSync('git', ['-C', root, 'check-ignore', '--no-index', '--', base + path.sep], {encoding:'utf8'});
    if (tracked.status !== 0 || tracked.stdout || ignored.status !== 0)
      throw new Error('Firmenwissen muss außerhalb der Git-Quellen liegen. Zuerst den geschützten Code-Übernahmeweg aus docs/CODE-SYNC.md verwenden.');
  } else if (!['firmenbasis','data','workspaces'].includes(relative.split(path.sep)[0])) {
    throw new Error('Firmenwissen benötigt einen lokalen Firmenbasis- oder Datenordner.');
  }
  return base;
}

// Seed a new installation once. Existing or explicitly configured bases are
// validated, never repaired with template contents or replaced during an update.
export async function ensureCompanyBase(root) {
  const base = companyRoot(root);
  try { await access(base); }
  catch (error) {
    if (error.code !== 'ENOENT' || process.env.COMPANY_BASE) throw error;
    const temporary = path.join(path.dirname(base), '.company-init-' + randomUUID());
    try {
      await cp(path.join(root, 'templates/firmenbasis'), temporary, {recursive:true, errorOnExist:true, force:false});
      await chmod(temporary, 0o700);
      await loadCompanyBase(temporary);
      try { await rename(temporary, base); }
      catch (error) { if (!['EEXIST','ENOTEMPTY'].includes(error.code)) throw error; }
    } finally { await rm(temporary, {recursive:true, force:true}); }
  }
  await loadCompanyBase(base);
  return base;
}

// Markdown sources inside the base can be read without exposing other files.
export async function readCompanyFile(base, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) ||
      relative.split(/[\\/]/).some(part => part.startsWith('.')) || !relative.endsWith('.md')) {
    throw new Error('Ungültiger Firmenbasis-Pfad.');
  }
  const canonical = await realpath(base);
  const file = await realpath(path.resolve(base, relative));
  if (!file.startsWith(canonical + path.sep)) throw new Error('Pfad außerhalb der Firmenbasis.');
  return { path: relative, content: await readFile(file, 'utf8') };
}

export async function loadCompanyBase(base) {
  const rules = await readCompanyFile(base, 'AGENTS.md');
  const company = await readCompanyFile(base, 'FIRMA.md');
  const paths = [...rules.content.matchAll(/\]\(([a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md)\)/g)]
    .map(match => match[1]);
  const workflows = [...new Set(paths)].map(relative => ({
    path: relative,
    absolutePath: path.join(base, relative),
    endpoint: `/api/company-base?file=${encodeURIComponent(relative)}`,
  }));
  return { root: base, rules, company, workflows };
}

export async function companyInstructions(base) {
  const context = await loadCompanyBase(base);
  return `Gemeinsame Firmenbasis: ${base}
Frisch geladene Quellen (relative Links beziehen sich auf ${base}):
${context.rules.path}:\n${context.rules.content}
${context.company.path}:\n${context.company.content}`;
}
