import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadPaneReply } from '../ui/pane-attention.mjs';

const ready = {foreground:true, visible:true, selected:true, engagedChatId:'a', chatId:'a', away:false, running:false, completed:true, unread:true};
test('four visible completed chats only acknowledge the intentionally selected composer', () => {
  const panes = ['a','b','c','d'].map(chatId => ({...ready, chatId, engagedChatId:undefined, selected:chatId==='a'}));
  assert.deepEqual(panes.map(canReadPaneReply), [false,false,false,false]);
  panes.forEach(p => { p.selected = p.chatId === 'c'; });
  panes[2].engagedChatId = 'c';
  assert.deepEqual(panes.map(canReadPaneReply), [false,false,true,false]);
  panes.forEach(p => { p.selected = p.chatId === 'b'; });
  panes[1].engagedChatId = 'b';
  assert.deepEqual(panes.map(canReadPaneReply), [false,true,false,false]);
});
test('restoration and chat replacement do not transfer an old read acknowledgement', () => {
  assert.equal(canReadPaneReply({...ready, engagedChatId:undefined}), false);
  assert.equal(canReadPaneReply({...ready, chatId:'new-chat'}), false);
  assert.equal(canReadPaneReply({...ready, chatId:null, engagedChatId:null}), false);
});
test('selection still requires a visible finished reply at the reading position', () => {
  assert.equal(canReadPaneReply(ready), true);
  for (const change of [{foreground:false},{visible:false},{selected:false},{away:true},{running:true},{completed:false},{unread:false}]) {
    assert.equal(canReadPaneReply({...ready,...change}), false, JSON.stringify(change));
  }
});
