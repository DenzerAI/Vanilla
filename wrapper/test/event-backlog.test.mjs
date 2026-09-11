import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventBacklog} from '../event-backlog.mjs';
import {threadEventFrame} from '../thread-view.mjs';

test('frames carry increasing ids and reconnects replay exactly the missed frames', () => {
  const backlog = createEventBacklog({epoch: 'life1'});
  const ids = [];
  for (let n = 1; n <= 5; n += 1) {
    const id = backlog.next();
    ids.push(id);
    backlog.remember(id, threadEventFrame({method: 'item/agentMessage/delta', params: {delta: 'part ' + n}}, id));
  }
  assert.deepEqual(ids, ['life1.1', 'life1.2', 'life1.3', 'life1.4', 'life1.5']);
  assert.deepEqual(backlog.since('life1.5'), []);
  const missed = backlog.since('life1.3');
  assert.equal(missed.length, 2);
  assert.match(missed[0], /^id: life1\.4\ndata: /);
  assert.match(missed[1], /part 5/);
  assert.equal(backlog.since('life1.9'), null);
  assert.equal(backlog.since('life0.3'), null);
  assert.equal(backlog.since(undefined), null);
  assert.equal(backlog.since('garbage'), null);
});

test('the window is bounded and a client behind the window gets a resync instead of a partial replay', () => {
  const backlog = createEventBacklog({epoch: 'e', limit: 3});
  for (let n = 1; n <= 6; n += 1) { const id = backlog.next(); backlog.remember(id, `id: ${id}\ndata: {}\n\n`); }
  assert.equal(backlog.since('e.2'), null);
  assert.equal(backlog.since('e.3').length, 3);
  const small = createEventBacklog({epoch: 'e', bytes: 40});
  for (let n = 1; n <= 4; n += 1) { const id = small.next(); small.remember(id, `id: ${id}\ndata: {"n":${n}}\n\n`); }
  assert.ok(small.since('e.1') === null);
  assert.equal(small.since('e.3').length, 1);
});

test('frames without an id stay byte-identical and oversized histories still fall back to a resync', () => {
  const plain = threadEventFrame({method: 'wrapper/chats'});
  assert.equal(plain, 'data: {"method":"wrapper/chats"}\n\n');
  const huge = threadEventFrame({method: 'wrapper/thread', params: {thread: {id: 't', turns: [{id: 'x', items: [{id: 'm', type: 'agentMessage', text: 'a'.repeat(2000000)}]}]}}}, 'e.7');
  assert.equal(huge, 'id: e.7\ndata: {"method":"wrapper/resync"}\n\n');
});
