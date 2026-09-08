import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnreadReply, markReplyRead } from '../chat-read-state.mjs';
test('read receipts survive serialization and newer answers become unread again',()=>{
 const chat={lastTurnStatus:'completed',lastCompletedTurnId:'first'};
 assert.equal(hasUnreadReply(chat),true);
 assert.equal(markReplyRead(chat,'first'),true);
 const restored=JSON.parse(JSON.stringify(chat));
 assert.equal(hasUnreadReply(restored),false);
 restored.lastCompletedTurnId='second';
 assert.equal(hasUnreadReply(restored),true);
 assert.equal(markReplyRead(restored,'first'),false);
 assert.equal(hasUnreadReply(restored),true);
 assert.equal(markReplyRead(restored,'second'),true);
 assert.equal(markReplyRead(restored,'second'),false);
});
test('legacy completed chats start unread; running and failed chats are not unread completions',()=>{
 assert.equal(hasUnreadReply({lastTurnStatus:'completed'}),true);
 assert.equal(hasUnreadReply({lastTurnStatus:'inProgress'}),false);
 assert.equal(hasUnreadReply({lastTurnStatus:'failed'}),false);
});
