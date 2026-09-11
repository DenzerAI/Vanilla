import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { validTitle, assignChatTitle, generateTitle, TITLE_RULES } from '../chat-title.mjs';

test('only compact complete titles are accepted', () => {
  assert.equal(validTitle('  Angebot für Dachsanierung  '), 'Angebot für Dachsanierung');
  for (const text of ['Zu lang'.repeat(9), 'Ein Titel…', 'Ein Titel...', 'Titel.','Titel\nErklärung', '# Überschrift', '"Zitat"', '']) assert.equal(validTitle(text), null);
});
const chat = () => ({ title: 'Neuer Chat', model: 'selected-model', cwd: '/workspace' });
const noop = async () => {};
test('first message uses selected model, is generated once and broadcasts update', async () => {
  const c = chat(); let calls = 0, events = 0;
  const args = { chat: c, text: 'Bitte ein Angebot erstellen', save: noop, emit: () => events++, generate: async (_, p) => {
    calls++; assert.equal(p.model, 'selected-model'); assert.equal(p.text, args.text); return 'Angebot erstellen';
  }};
  await assignChatTitle(args);
  await assignChatTitle({ ...args, text: 'Weitere Nachricht' });
  assert.equal(c.title, 'Angebot erstellen'); assert.equal(c.titleStatus, 'generated');
  assert.equal(calls, 1); assert.equal(events, 1);
});
test('manual titles and concurrent manual edits are preserved', async () => {
  const c = chat(); let release;
  const work = assignChatTitle({ chat: c, text: 'Auftrag', save: noop, emit: noop, generate: () => new Promise(r => release = r) });
  await new Promise(r => setImmediate(r));
  c.title = 'Meine Benennung'; c.titleRevision = 1; c.titleStatus = 'manual';
  release('Modelltitel'); await work;
  assert.equal(c.title, 'Meine Benennung'); assert.equal(c.titleStatus, 'manual');
  await assignChatTitle({ chat: c, text: 'Auftrag', generate: () => assert.fail('must not run') });
});
test('failure leaves complete neutral fallback without throwing into chat', async () => {
  const c = chat();
  await assignChatTitle({ chat: c, text: 'Auftrag', save: noop, emit: noop, generate: async () => { throw Error('offline'); } });
  assert.equal(c.title, 'Neues Anliegen'); assert.equal(c.titleStatus, 'failed');
});
test('Codex title request uses isolated thread and collects item events', async () => {
  const adapter = new EventEmitter(); const calls = [];
  adapter.call = async (method, p) => {
    calls.push({ method, p });
    if (method === 'thread/start') return { thread: { id: 'title-only' } };
    if (method === 'turn/start') {
      setImmediate(() => {
        adapter.emit('notification', { method: 'item/completed', params: { threadId: 'other', item: { id: 'x', type: 'agentMessage', text: 'Wrong' } } });
        adapter.emit('notification', { method: 'item/completed', params: { threadId: 'title-only', item: { id: 'y', type: 'agentMessage', text: 'Dachsanierung planen' } } });
        adapter.emit('notification', { method: 'turn/completed', params: { threadId: 'title-only', turn: { status: 'completed', items: [] } } });
      });
      return { turn: { id: 'turn-title' } };
    }
    return {};
  };
  assert.equal(await generateTitle(adapter, { model: 'chosen', cwd: '/tmp', text: 'Dach sanieren' }), 'Dachsanierung planen');
  assert.equal(calls[0].p.model, 'chosen'); assert.equal(calls[0].p.ephemeral, true);
  assert.equal(calls[0].p.baseInstructions, TITLE_RULES);
  assert.equal(adapter.listenerCount('notification'), 0);
});
test('ACP uses same model and an isolated session', async () => {
  const rpc = new EventEmitter(); const calls = [];
  rpc.write = () => {};
  rpc.call = async (method, p) => {
    calls.push({ method, p });
    if (method === 'session/new') return { sessionId: 'title', models: { currentModelId: 'default' } };
    if (method === 'session/prompt') {
      rpc.emit('message', { method: 'session/update', params: { sessionId: 'title', update: { sessionUpdate: 'agent_message_chunk', content: { text: 'Angebot prüfen' } } } });
      return { stopReason: 'end_turn' };
    }
    return {};
  };
  assert.equal(await generateTitle({ rpc }, { cwd: '/tmp', model: 'chosen', text: 'Angebot' }), 'Angebot prüfen');
  assert.equal(calls[1].p.modelId, 'chosen'); assert.equal(rpc.listenerCount('message'), 0);
});
test('ACP config options select the chat model natively', async () => {
  const rpc = new EventEmitter(); const calls = [];
  rpc.write = () => {};
  const options = [{ id: 'model', type: 'select', category: 'model', currentValue: 'default',
    options: [{ value: 'default', name: 'Standard' }, { value: 'claude-opus-5', name: 'Opus' }] }];
  rpc.call = async (method, p) => {
    calls.push({ method, p });
    if (method === 'session/new') return { sessionId: 'title', configOptions: options };
    if (method === 'session/set_config_option') return { configOptions: options };
    if (method === 'session/prompt') {
      rpc.emit('message', { method: 'session/update', params: { sessionId: 'title', update: { sessionUpdate: 'agent_message_chunk', content: { text: 'Titel vergeben' } } } });
      return { stopReason: 'end_turn' };
    }
    return {};
  };
  assert.equal(await generateTitle({ rpc }, { cwd: '/tmp', model: 'claude-opus-5', text: 'Kein Titel' }), 'Titel vergeben');
  assert.deepEqual(calls[1], { method: 'session/set_config_option', p: { sessionId: 'title', configId: 'model', value: 'claude-opus-5' } });
});
test('an unusable model selection still yields a generated title', async () => {
  const rpc = new EventEmitter();
  rpc.write = () => {};
  rpc.call = async (method) => {
    if (method === 'session/new') return { sessionId: 'title', configOptions: [{ id: 'model', type: 'select', category: 'model', currentValue: 'default', options: [{ value: 'default' }] }] };
    if (method === 'session/set_config_option') throw new Error('Method not found');
    if (method === 'session/prompt') {
      rpc.emit('message', { method: 'session/update', params: { sessionId: 'title', update: { sessionUpdate: 'agent_message_chunk', content: { text: 'Titel trotzdem' } } } });
      return { stopReason: 'end_turn' };
    }
    return {};
  };
  assert.equal(await generateTitle({ rpc }, { cwd: '/tmp', model: 'entfallenes-modell', text: 'Kein Titel' }), 'Titel trotzdem');
});
test('invalid model titles are retried once and never cut mid-word', async () => {
  const c = chat(); let calls = 0;
  await assignChatTitle({ chat: c, text: 'Auftrag', save: noop, emit: noop, generate: async () => { calls++; return null; } });
  assert.equal(calls, 2); assert.equal(c.title, 'Neues Anliegen');
});
test('timeout releases notification listeners and stops the isolated turn', async () => {
  const adapter = new EventEmitter(); const calls = [];
  adapter.call = async method => {
    calls.push(method);
    if (method === 'thread/start') return { thread: { id: 'title' } };
    if (method === 'turn/start') return { turn: { id: 'turn' } };
    return {};
  };
  await assert.rejects(generateTitle(adapter, { model: 'chosen', cwd: '/tmp', text: 'Auftrag' }, 5), /zu lange/);
  assert.equal(adapter.listenerCount('notification'), 0);
  assert.ok(calls.includes('turn/interrupt')); assert.ok(calls.includes('thread/archive'));
});

 test('word and character limits apply independently, counting Unicode characters', () => {
  assert.equal(validTitle('a'.repeat(28)), 'a'.repeat(28));
  assert.equal(validTitle('a'.repeat(29)), null);
  assert.equal(validTitle('𐐀'.repeat(28)), '𐐀'.repeat(28));
  assert.equal(validTitle('𐐀'.repeat(29)), null);
  assert.equal(validTitle('Ein kurzer Titel passt'), 'Ein kurzer Titel passt');
  assert.equal(validTitle('So ein Titel ist lang'), null);
  assert.equal(validTitle('Workspace-Buttons'), 'Workspace-Buttons');
});
