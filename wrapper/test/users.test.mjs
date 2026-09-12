import test from 'node:test';
import assert from 'node:assert/strict';
import { requestUser, runAs, currentUser, visibleChats, canSeeChat, newChatOwner, OWNER } from '../users.mjs';

test('Kopfzeilen des Kerns bestimmen den Benutzer; ohne Kern gilt der Eigentümer', () => {
  assert.deepEqual(requestUser({}, false), OWNER);
  assert.deepEqual(requestUser({}, true), OWNER);
  assert.deepEqual(requestUser({'x-agent-user-id':'u1','x-agent-user-role':'member'}, true), {id:'u1', role:'member'});
  assert.deepEqual(requestUser({'x-agent-user-id':'u1','x-agent-user-role':'admin'}, true), {id:'u1', role:'member'});
  assert.deepEqual(requestUser({'x-agent-user-id':'u1','x-agent-user-role':'member'}, false), OWNER);
});

test('Mitglieder sehen nur eigene Chats, Eigentümer alles', () => {
  const chats = [{id:'a', ownerId:'u1'}, {id:'b'}, {id:'c', ownerId:'u2'}];
  assert.deepEqual(visibleChats(chats, {id:'u1', role:'member'}).map(c => c.id), ['a']);
  assert.deepEqual(visibleChats(chats, {id:'u9', role:'owner'}).map(c => c.id), ['a', 'b', 'c']);
  assert.equal(canSeeChat(undefined, {id:'u1', role:'member'}), false);
  assert.equal(canSeeChat(undefined, OWNER), true);
});

test('Anfragekontext trägt den Benutzer und bestimmt den Besitzer neuer Chats', async () => {
  assert.deepEqual(currentUser(), OWNER);
  assert.equal(newChatOwner(), null);
  await runAs({id:'u1', role:'member'}, async () => {
    await new Promise(r => setTimeout(r, 1));
    assert.equal(currentUser().id, 'u1');
    assert.equal(newChatOwner(), 'u1');
  });
  await runAs({id:'o2', role:'owner'}, async () => assert.equal(newChatOwner(), 'o2'));
  await runAs(OWNER, async () => assert.equal(newChatOwner(), null));
  assert.deepEqual(currentUser(), OWNER);
});

test('eine Kennung ohne ausdrückliche Eigentümer-Rolle ist ein Mitglied', () => {
  assert.deepEqual(requestUser({'x-agent-user-id':'u1'}, true), {id:'u1', role:'member'});
  assert.deepEqual(requestUser({'x-agent-user-id':'u1','x-agent-user-role':'owner'}, true), {id:'u1', role:'owner'});
});
