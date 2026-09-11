import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadPaneReply } from '../ui/pane-attention.mjs';

const ready = {foreground:true, visible:true, selected:true, chatId:'a', loadedChatId:'a', loading:false, running:false, completed:true, unread:true};
test('only the selected loaded panel acknowledges its answer without composer focus', () => {
  const panes = ['a','b','c','d'].map(chatId => ({...ready, chatId, loadedChatId:chatId, selected:chatId==='a'}));
  assert.deepEqual(panes.map(canReadPaneReply), [true,false,false,false]);
  panes.forEach(p => { p.selected = p.chatId === 'c'; });
  assert.deepEqual(panes.map(canReadPaneReply), [false,false,true,false]);
});
test('skeleton and stale content during chat switching cannot acknowledge an answer', () => {
  for (const change of [{loading:true},{loadedChatId:undefined},{loadedChatId:'previous'},{chatId:null,loadedChatId:null}]) {
    assert.equal(canReadPaneReply({...ready,...change}), false, JSON.stringify(change));
  }
});
test('loaded text can be read at any scroll position without touching the composer', () => {
  assert.equal(canReadPaneReply({...ready, away:true, engagedChatId:undefined}), true);
});
test('background, hidden panels and streaming remain unread', () => {
  assert.equal(canReadPaneReply(ready), true);
  for (const change of [{foreground:false},{visible:false},{selected:false},{running:true},{completed:false},{unread:false}]) {
    assert.equal(canReadPaneReply({...ready,...change}), false, JSON.stringify(change));
  }
});
