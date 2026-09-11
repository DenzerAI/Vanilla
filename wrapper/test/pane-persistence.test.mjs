import test from 'node:test';
import assert from 'node:assert/strict';
import {readPaneLayout, readPaneSession, writePaneState} from '../ui/pane-persistence.mjs';
import {visiblePanes, selectPaneCount} from '../ui/chat-layout.mjs';
const storage = () => { const values = new Map(); return {getItem:key=>values.get(key), setItem:(key,value)=>values.set(key,value)}; };
test('four panes retain sessions and weights across a fresh read, including hidden panes', () => {
  const disk = storage();
  writePaneState('layout', {order:[0,1,2,3], active:3, weights:{2:1.4,3:0.6}}, disk);
  for (let id=0; id<4; id++) writePaneState(`session:${id}`, {chatId:`thread-${id}`,projectId:`project-${id}`},disk);
  const restored = readPaneLayout(disk);
  assert.deepEqual(restored, {order:[0,1,2,3],active:3,weights:{2:1.4,3:0.6}});
  assert.deepEqual(visiblePanes(restored.order,restored.active,900),[2,3]);
  for (let id=0; id<4; id++) assert.deepEqual(readPaneSession(id,disk), {chatId:`thread-${id}`,projectId:`project-${id}`});
  const order = selectPaneCount(restored.order,restored.active,1);
  writePaneState('layout', {...restored,order},disk);
  assert.deepEqual(readPaneLayout(disk).order,[3]);
  assert.equal(readPaneSession(0,disk).chatId,'thread-0');
});
test('new drafts replace the previous session association', () => {
  const disk=storage();
  writePaneState('session:2',{chatId:'thread-2',projectId:'default'},disk);
  writePaneState('session:2',{chatId:null,projectId:'another-project'},disk);
  assert.deepEqual(readPaneSession(2,disk),{chatId:null,projectId:'another-project'});
});
test('invalid and unavailable storage fall back safely', () => {
  const disk=storage();
  disk.setItem('chat-panes:v1:layout','invalid json');
  assert.deepEqual(readPaneLayout(disk),{order:[0],active:0,weights:{}});
  writePaneState('layout',{order:[3,3,-1,9,'0',2],active:1,weights:{3:-1,2:2}},disk);
  assert.deepEqual(readPaneLayout(disk),{order:[3,2],active:3,weights:{2:2}});
  const blocked = {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.equal(writePaneState('layout',{},blocked),false);
  assert.deepEqual(readPaneSession(1,blocked),{chatId:null,projectId:'default'});
});
