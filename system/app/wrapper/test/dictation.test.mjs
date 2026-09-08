import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DictationStore, installDictationRoutes } from '../dictation.mjs';
async function fixture(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'dictation-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }
test('audio survives restart, duplicate requests and conflicting retransmission', async t => {
  const root = await fixture(t), id = randomUUID(), s = new DictationStore(root);
  await s.create({ id });
  const b = { id, seq: 0, audio: Buffer.from([0, 1, 2, 3]).toString('base64') };
  await Promise.all([s.append(b), s.append(b)]);
  await assert.rejects(s.append({ ...b, audio: 'AQIDBA==' }), /kollidiert/);
  const restored = new DictationStore(root);
  assert.equal((await restored.audio(id)).subarray(44).toString('hex'), '00010203');
  await restored.update(id, { state:'trash' });
  assert.equal((await restored.audio(id)).length, 48);
  await restored.create({ id });
  assert.equal((await restored.meta(id)).state, 'trash');
});
test('missing chunks cannot silently create a shortened recording', async t => {
  const s = new DictationStore(await fixture(t)), id = randomUUID(); await s.create({ id });
  await s.append({ id, seq:1, audio:'AAAAAA==' });
  await assert.rejects(s.audio(id), /fehlen/);
  await s.append({ id, seq:0, audio:'AAAAAA==' });
  assert.equal((await s.audio(id)).length, 52);
  await assert.rejects(s.append({ id, seq:-1, audio:'AAAAAA==' }));
  await assert.rejects(s.create({ id:'../../etc' }));
});
test('failed local recognition preserves audio and error across restart', async t => {
  const root = await fixture(t), routes = new Map();
  const s = await installDictationRoutes({ route:(m,u,f) => routes.set(m+u,f), dataRoot:root, recordBoundary:async()=>{} });
  const id = randomUUID(); await s.create({ id }); await s.append({ id, seq:0, audio:'AAAAAA==' });
  await routes.get('POST/api/dictation/transcribe')({ id, provider:'local' });
  for (let i=0; i<100; i++) { if ((await s.meta(id)).error) break; await new Promise(r=>setTimeout(r,20)); }
  assert.match((await s.meta(id)).error, /Audio bleibt/);
  assert.equal((await s.audio(id)).length,48);
  assert.equal((await readFile(path.join(s.dir(id),'audio.wav'))).length,48);
  await assert.rejects(routes.get('POST/api/dictation/settings')({ provider:'groq' }), /Schlüssel/);
  await assert.rejects(routes.get('POST/api/dictation/finish')({ id,count:2 }), /unvollständig/);
});
