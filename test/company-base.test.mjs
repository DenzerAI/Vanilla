import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, cp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { companyInstructions, loadCompanyBase, readCompanyFile } from '../backend/company-base.mjs';
import { buildBootstrap } from '../backend/bootstrap.mjs';

test('fresh shared context, selective loading and extension without code changes', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'company-base-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = path.join(root, 'firmenbasis');
  await cp(new URL('../firmenbasis', import.meta.url), base, { recursive: true });
  for (const dir of ['soul', 'brain', 'skills']) await mkdir(path.join(root, dir));
  await mkdir(path.join(root, 'workspaces/default/soul'), { recursive: true });
  await writeFile(path.join(root, 'workspaces/default/soul/IDENTITY.md'), 'Anzeigename: Gemeinsam');
  await writeFile(path.join(root, 'soul/IDENTITY.md'), 'Anzeigename: Veraltet');
  await writeFile(path.join(root, 'brain/learnings.ndjson'), '');
  await writeFile(path.join(base, 'FIRMA.md'), 'Firma: Testbetrieb Nord');
  const first = await buildBootstrap(root, 'hermes');
  assert.match(first.soul[0].content, /Anzeigename: Gemeinsam/);
  assert.doesNotMatch(first.soul[0].content, /Veraltet/);
  assert.equal(first.companyBase.company.content, 'Firma: Testbetrieb Nord');
  assert.equal(first.skills.length, 1);
  assert.equal(first.skills[0].content, undefined);
  const skill = await readCompanyFile(base, first.skills[0].path);
  assert.match(skill.content, /name: report-result/);
  const before = await readFile(path.join(base, 'report-result/SKILL.md'), 'utf8');
  await writeFile(path.join(base, 'FIRMA.md'), 'Firma: Testbetrieb Süd');
  assert.match(await companyInstructions(base), /Testbetrieb Süd/);
  assert.equal((await buildBootstrap(root, 'codex')).companyBase.company.content, 'Firma: Testbetrieb Süd');
  assert.equal(await readFile(path.join(base, 'report-result/SKILL.md'), 'utf8'), before);
  await mkdir(path.join(base, 'kundenanfragen'));
  await writeFile(path.join(base, 'kundenanfragen/SKILL.md'), '---\nname: kundenanfragen\ndescription: Kundenanfragen prüfen.\n---\nPrüfe die Anfrage.');
  await writeFile(path.join(base, 'AGENTS.md'), (await readFile(path.join(base, 'AGENTS.md'), 'utf8')) + '\n- [kundenanfragen/SKILL.md](kundenanfragen/SKILL.md): Kundenanfragen prüfen.\n');
  assert.equal((await loadCompanyBase(base)).workflows.length, 2);
  assert.match((await readCompanyFile(base, 'kundenanfragen/SKILL.md')).content, /Prüfe die Anfrage/);
  await symlink(path.join(root, 'brain/learnings.ndjson'), path.join(base, 'escape.md'));
  for (const name of ['../brain/MEMORY.md', '/etc/passwd', '.env.md', 'escape.md', null]) {
    await assert.rejects(() => readCompanyFile(base, name));
  }
  await rm(path.join(base, 'FIRMA.md'));
  await assert.rejects(() => companyInstructions(base));
});
