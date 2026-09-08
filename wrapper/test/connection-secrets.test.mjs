import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Storage } from '../storage.mjs';
import { createSecretStore, installIntegrationRoutes } from '../integrations.mjs';
import { installSpeechRoutes } from '../speech.mjs';
import { installDictationRoutes } from '../dictation.mjs';

async function fixture(t, { keys = new Map(), fetcher = async () => Response.json({ voices: [] }) } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'connection-secrets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Storage(path.join(root, 'workspace'), path.join(root, 'data'));
  await store.init();
  const keychain = {
    save: async (id, value) => { keys.set(id, value); },
    read: async id => keys.get(id),
    has: async id => keys.has(id),
    remove: async id => { keys.delete(id); },
  };
  const secrets = createSecretStore(store, keychain), routes = new Map();
  const options = { route: (m, u, fn) => routes.set(m + u, fn), dataRoot: store.dataRoot, store, secrets, fetcher, recordBoundary: async () => {} };
  await installIntegrationRoutes(options);
  await installSpeechRoutes(options);
  await installDictationRoutes(options);
  return { store, secrets, keychain, keys, call: (url, body = {}, method = 'POST') => routes.get(method + '/api' + url)(body) };
}

for (const provider of [
  { name: 'ElevenLabs', id: 'speech-elevenlabs', connect: '/speech/connect', disconnect: '/speech/disconnect', status: '/speech/status', flag: 'elevenlabs', settings: 'speech-settings.json', input: {} },
  { name: 'Groq', id: 'dictation-groq', connect: '/dictation/settings', disconnect: '/dictation/disconnect', status: '/dictation/status', flag: 'groq', settings: 'dictation-settings.json', input: { provider: 'local' } },
]) {
  test(`${provider.name}: connect indexes the same key, replacement reuses it, disconnect retains it, active keys cannot be deleted`, async t => {
    const f = await fixture(t);
    await f.call(provider.connect, { ...provider.input, key: 'synthetic-provider-key' });
    const status = await f.call(provider.status, {}, 'GET');
    assert.equal(status[provider.flag], true);
    assert.equal(status.provider, 'local');
    const list = await f.secrets.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, provider.id);
    assert.equal(list[0].provider, provider.name);
    assert.equal(await f.secrets.read(list[0].id), 'synthetic-provider-key');
    await assert.rejects(f.call('/secrets/delete', { id: provider.id }), /zuerst/);
    await assert.rejects(f.call('/secrets/save', { id: provider.id, value: 'bypass-validation' }), /Verbindung prüfen/);
    await f.call(provider.connect, { ...provider.input, key: 'replacement-provider-key' });
    assert.equal((await f.secrets.list()).length, 1);
    assert.equal(await f.secrets.read(provider.id), 'replacement-provider-key');
    for (const file of ['state.json', provider.settings]) {
      assert.doesNotMatch(await readFile(path.join(f.store.dataRoot, file), 'utf8'), /synthetic-provider-key|replacement-provider-key/);
    }
    const restarted = new Storage(f.store.root, f.store.dataRoot);
    await restarted.init();
    assert.equal(restarted.state.secrets[0].id, provider.id);
    await f.call(provider.disconnect);
    assert.equal((await f.call(provider.status, {}, 'GET'))[provider.flag], false);
    assert.equal(f.keys.has(provider.id), true);
    await f.call('/secrets/delete', { id: provider.id });
    assert.equal(f.keys.has(provider.id), false);
    assert.deepEqual(await f.secrets.list(), []);
  });

  test(`${provider.name}: failed validation preserves the previous key and stored settings`, async t => {
    let valid = true;
    const f = await fixture(t, { fetcher: async () => new Response('{}', { status: valid ? 200 : 401 }) });
    await f.call(provider.connect, { ...provider.input, key: 'working-key' });
    const before = await f.secrets.list();
    valid = false;
    await assert.rejects(f.call(provider.connect, { ...provider.input, key: 'invalid-key' }), /401/);
    assert.equal(await f.secrets.read(provider.id), 'working-key');
    assert.deepEqual(await f.secrets.list(), before);
    assert.equal((await f.call(provider.status, {}, 'GET'))[provider.flag], true);
  });
}

test('legacy provider keys are indexed without reading their values, including after disconnect', async t => {
  const f = await fixture(t, { keys: new Map([['dictation-groq', 'legacy-groq'], ['speech-elevenlabs', 'legacy-elevenlabs']]) });
  f.keychain.read = () => { throw new Error('must not read passwords for listing'); };
  assert.deepEqual((await f.secrets.list()).map(s => s.provider), ['Groq', 'ElevenLabs']);
  assert.equal((await f.secrets.list()).length, 2);
  assert.doesNotMatch(await readFile(path.join(f.store.dataRoot, 'state.json'), 'utf8'), /legacy-groq|legacy-elevenlabs/);
});

test('a token entered in a connection creates a secret reference without replacing a shared secret', async t => {
  const f = await fixture(t);
  const shared = await f.call('/secrets/save', { name: 'Shared', value: 'shared-key' });
  const first = await f.call('/connections/save', { name: 'First', kind: 'webhook', url: 'https://example.com', secretId: shared.id });
  const second = await f.call('/connections/save', { name: 'Second', kind: 'webhook', url: 'https://example.org', secretId: shared.id, secretValue: 'new-connection-key' });
  assert.notEqual(second.secretId, shared.id);
  assert.equal(first.secretId, shared.id);
  assert.equal(await f.secrets.read(shared.id), 'shared-key');
  assert.equal(await f.secrets.read(second.secretId), 'new-connection-key');
  assert.equal((await f.secrets.list()).length, 2);
  assert.doesNotMatch(JSON.stringify(second), /new-connection-key/);
  assert.doesNotMatch(await readFile(path.join(f.store.dataRoot, 'state.json'), 'utf8'), /shared-key|new-connection-key/);
  await assert.rejects(f.call('/secrets/delete', { id: second.secretId }), /noch von einer Verbindung/);
  await f.call('/connections/delete', { id: second.id });
  assert.equal(f.keys.has(second.secretId), true);
  await f.call('/secrets/delete', { id: second.secretId });
  assert.equal(f.keys.has(second.secretId), false);
});

test('a keychain failure cannot publish a secret or connection as saved', async t => {
  const f = await fixture(t);
  f.keychain.save = async () => { throw new Error('Keychain locked'); };
  await assert.rejects(f.call('/connections/save', { name: 'Fail', url: 'https://example.com', kind: 'webhook', secretValue: 'unsaved-key' }), /Keychain locked/);
  assert.deepEqual(f.store.state.connections, []);
  assert.deepEqual(f.store.state.secrets, []);
});

test('deleting a key cannot race past an in-flight provider connection', async t => {
  let begin, release;
  const started = new Promise(r => { begin = r; });
  const network = new Promise(r => { release = r; });
  const f = await fixture(t, { fetcher: async () => { begin(); await network; return Response.json({ voices: [] }); } });
  const connecting = f.call('/speech/connect', { key: 'pending-key' });
  await started;
  const removing = f.call('/secrets/delete', { id: 'speech-elevenlabs' });
  release();
  await connecting;
  await assert.rejects(removing, /zuerst/);
  assert.equal(await f.secrets.read('speech-elevenlabs'), 'pending-key');
});

test('generic connections retain provider and category across renaming and reject unknown categories', async t=>{
 const f=await fixture(t);
 const saved=await f.call('/connections/save',{name:'Designstudio',kind:'link',provider:'higgsfield',category:'design',url:'https://example.com'});
 const entry=f.store.state.connections[0];
 assert.equal(entry.provider,'higgsfield');assert.equal(entry.category,'design');
 await f.call('/connections/save',{id:entry.id,name:'Neuer Name',kind:'link',url:'https://example.com'});
 assert.equal(f.store.state.connections[0].provider,'higgsfield');assert.equal(f.store.state.connections[0].category,'design');
 await assert.rejects(f.call('/connections/save',{name:'Ungültig',kind:'link',url:'https://example.com',category:'unknown'}),/Unbekannte Verbindungskategorie/);
 assert.equal(f.store.state.connections.length,1);
});
