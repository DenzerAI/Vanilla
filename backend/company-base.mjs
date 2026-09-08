import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import {localPath} from '../wrapper/isolation.mjs';

export function companyRoot(root) {
  return localPath(process.env.COMPANY_BASE || path.join(root, 'firmenbasis'));
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
