import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileThreadSnapshot} from '../ui/thread-update.mjs';

const snapshot = (status, text) => ({id:'c1', turns:[{id:'t1', status, items:[
  {id:'item-1', type:'userMessage', content:[{type:'text', text:'Frage'}]},
  {id:'item-2', type:'agentMessage', text}]}]});

test('a saved transcript with renumbered ids does not duplicate the streamed answer', () => {
  const live = {id:'c1', turns:[{id:'t1', status:'inProgress', items:[
    {id:'01a0-user', type:'userMessage', content:[{type:'text', text:'Frage'}]},
    {id:'msg_abc', type:'agentMessage', text:'Antwort komplett'}]}]};
  const merged = reconcileThreadSnapshot(live, snapshot('completed', 'Antwort komplett'));
  assert.deepEqual(merged.turns[0].items.map(item => item.type), ['userMessage', 'agentMessage']);
  assert.equal(merged.turns[0].status, 'completed');
});

test('a late read keeps the longer streamed text even under a different id', () => {
  const live = {id:'c1', turns:[{id:'t1', status:'inProgress', items:[
    {id:'msg_abc', type:'agentMessage', text:'Antwort komplett und länger'}]}]};
  const merged = reconcileThreadSnapshot(live, snapshot('inProgress', 'Antwort'));
  const answers = merged.turns[0].items.filter(item => item.type === 'agentMessage');
  assert.equal(answers.length, 1);
  assert.equal(answers[0].text, 'Antwort komplett und länger');
});

test('items missing from a stale snapshot stay visible', () => {
  const live = {id:'c1', turns:[{id:'t1', status:'inProgress', items:[
    {id:'msg_abc', type:'agentMessage', text:'Erste Antwort'},
    {id:'tool-1', type:'commandExecution', command:'ls'}]}]};
  const merged = reconcileThreadSnapshot(live, {id:'c1', turns:[{id:'t1', status:'inProgress', items:[]}]});
  assert.deepEqual(merged.turns[0].items.map(item => item.id), ['msg_abc', 'tool-1']);
});

test('pending client items are dropped once the transcript knows the turn', () => {
  const live = {id:'c1', turns:[{id:'t1', status:'inProgress', items:[
    {id:'pending-1', type:'userMessage', clientPending:true, content:[{type:'text', text:'Frage'}]}]}]};
  const merged = reconcileThreadSnapshot(live, snapshot('completed', 'Antwort'));
  assert.equal(merged.turns[0].items.some(item => item.clientPending), false);
});
