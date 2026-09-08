import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, symlink, writeFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { requireBearer, requestBudget } from '../backend/security.mjs';
import { ArtifactStore } from '../backend/artifacts.mjs';
import { Store } from '../backend/store.mjs';

test('HTTP gate fails closed for absent config, weak config, missing, invalid and wrong token type', async t => {
  const token = 'synthetic-test-token-'.repeat(3);
  for (const configured of ['', 'weak', token]) {
    const server = http.createServer((req, res) => {
      if (requireBearer(req, res, configured)) res.end('ok');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => server.close());
    for (const authorization of ['', 'Bearer invalid', 'Basic ' + token, 'Bearer ' + token]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}`, { headers: { authorization } });
      assert.equal(response.status, configured.length < 32 ? 503 : authorization === 'Bearer ' + token ? 200 : 401);
      await response.text();
    }
  }
});
test('bounded request budget expires and cannot be selected by forwarded identity', () => {
  let time = 0;
  const allowed = requestBudget({ limit: 2, windowMs: 10, now: () => time });
  assert.equal(allowed(), true); assert.equal(allowed(), true); assert.equal(allowed(), false);
  time = 10; assert.equal(allowed(), true);
});
test('artifact traversal, hidden files, symlink download and write escapes are denied', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'security-synthetic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ArtifactStore(root, { baseUrl: 'http://example.invalid' }); await store.init();
  const input = filename => [{ filename, contentBase64: Buffer.from('synthetic').toString('base64') }];
  for (const name of ['../x', '/tmp/x', '.env', '..\\x']) await assert.rejects(store.publish('run', input(name)));
  await mkdir(path.join(root, 'outside')); await writeFile(path.join(root, 'outside', 'secret'), 'synthetic');
  await symlink(path.join(root, 'outside'), path.join(store.directory, 'escape'));
  assert.equal(await store.resolveSafe('escape', 'secret'), null);
  await assert.rejects(store.publish('escape', input('file')));
  await symlink(path.join(root, 'outside', 'secret'), path.join(store.directory, 'run', 'link'));
  assert.equal(await store.resolveSafe('run', 'link'), null);
  await assert.rejects(store.publish('run', input('link')));
  const [file] = await store.publish('run', input('ok.txt'));
  assert.equal((await stat(file.path)).mode & 0o777, 0o600);
  await assert.rejects(store.publish('run', input('ok.txt')));
});
test('unknown object and completed-run replay cannot mutate state', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'security-synthetic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(root); await store.init();
  assert.equal(await store.getOrder('other-owner-id'), null);
  assert.equal(await store.getOrder('../secret'), null);
  await store.createOrder({ title: 'synthetic', instructions: 'synthetic' });
  const { run } = await store.claimNext('test');
  await store.finishRun(run.id, { result: 'synthetic' });
  await assert.rejects(store.finishRun(run.id, { result: 'replayed' }));
});
