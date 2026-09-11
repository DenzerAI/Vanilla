import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventBatcher} from '../ui/event-batcher.mjs';

function harness() {
  const applied = [], scheduled = [];
  const batcher = createEventBatcher(event => applied.push(event), {schedule: callback => scheduled.push(callback)});
  return {applied, scheduled, batcher, tick() { const callbacks = scheduled.splice(0); for (const callback of callbacks) callback(); }};
}

test('deltas of one item are merged into one render while other events keep their order', () => {
  const {applied, scheduled, batcher, tick} = harness();
  batcher.push({method: 'turn/started', params: {threadId: 't', turn: {id: 'turn'}}});
  batcher.push({method: 'item/agentMessage/delta', params: {threadId: 't', turnId: 'turn', itemId: 'a', delta: 'Hal'}});
  batcher.push({method: 'item/agentMessage/delta', params: {threadId: 't', turnId: 'turn', itemId: 'a', delta: 'lo'}});
  batcher.push({method: 'item/reasoning/summaryTextDelta', params: {threadId: 't', turnId: 'turn', itemId: 'r', summaryIndex: 0, delta: 'denkt'}});
  batcher.push({method: 'item/agentMessage/delta', params: {threadId: 't', turnId: 'turn', itemId: 'a', delta: ' Welt'}});
  assert.equal(applied.length, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(batcher.pending, 2);
  tick();
  assert.deepEqual(applied.map(event => event.method), ['turn/started', 'item/agentMessage/delta', 'item/reasoning/summaryTextDelta']);
  assert.equal(applied[1].params.delta, 'Hallo Welt');
  assert.equal(applied[2].params.delta, 'denkt');
  assert.equal(batcher.pending, 0);
});

test('a non-delta event flushes pending deltas first so completion never precedes its text', () => {
  const {applied, batcher} = harness();
  batcher.push({method: 'item/agentMessage/delta', params: {threadId: 't', turnId: 'turn', itemId: 'a', delta: 'Ende.'}});
  batcher.push({method: 'item/completed', params: {threadId: 't', turnId: 'turn', item: {id: 'a', type: 'agentMessage', text: 'Ende.'}}});
  assert.deepEqual(applied.map(event => event.method), ['item/agentMessage/delta', 'item/completed']);
  batcher.push({method: 'item/commandExecution/outputDelta', params: {threadId: 't', turnId: 'turn', itemId: 'c', delta: 'x'}});
  batcher.push({method: 'item/commandExecution/outputDelta', params: {threadId: 'other', turnId: 'turn', itemId: 'c', delta: 'y'}});
  batcher.flush();
  assert.equal(applied.length, 4);
  assert.equal(applied[2].params.delta, 'x');
  assert.equal(applied[3].params.threadId, 'other');
});

test('the original event objects are not mutated by merging', () => {
  const {applied, batcher, tick} = harness();
  const first = {method: 'item/plan/delta', params: {threadId: 't', turnId: 'turn', itemId: 'p', delta: 'a'}};
  batcher.push(first);
  batcher.push({method: 'item/plan/delta', params: {threadId: 't', turnId: 'turn', itemId: 'p', delta: 'b'}});
  tick();
  assert.equal(first.params.delta, 'a');
  assert.equal(applied[0].params.delta, 'ab');
});
