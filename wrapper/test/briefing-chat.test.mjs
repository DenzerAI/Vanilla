import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {briefingChatOpener} from '../briefing-chat.mjs';
import {handoffSnapshot, handoffInstructions, joinHandoff} from '../chat-handoff.mjs';
import {demoBriefings} from '../ui/planner-briefings.mjs';

test('opening a report stores its assistant message and preserves context after reopening', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'briefing-chat-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  let created = 0, exported;
  const store = {root, state:{chats:[]}, chat(id){return this.state.chats.find(c=>c.id===id);},
    projectRoot:async()=>root, save:async()=>{}, exportThread:async thread=>{exported=thread;}};
  const cache = new Map();
  const newChat = async () => {created++; store.state.chats.push({id:'report-chat'});return {thread:{id:'report-chat',turns:[]}};};
  const open = briefingChatOpener({store, newChat, cache, emit:()=>{}});
  const item = {id:'run-1', title:'Tagesbericht', body:'Die Abgabe ist am Freitag. Noch offen: Entwurf prüfen.',created_at:1788944400};
  const [a,b] = await Promise.all([open(item),open(item)]);
  assert.equal(created,1); assert.equal(a.thread.id,b.thread.id);
  assert.equal(exported.turns[0].items[0].type,'agentMessage');
  assert.match(exported.turns[0].items[0].text,/Abgabe ist am Freitag/);
  const chat = store.chat(a.thread.id);
  const saved = JSON.parse(JSON.stringify(chat));
  assert.match(await handoffInstructions(store, saved),/gespeicherten Bericht/);
  assert.match(await handoffInstructions(store, saved),/Entwurf prüfen/);
  const snapshot = await handoffSnapshot(store, saved);
  const next = joinHandoff(saved.id,snapshot,{turns:[{id:'question',items:[]}]});
  assert.deepEqual(next.turns.map(t=>t.id),['briefing-run-1','question']);
  chat.archived = true;
  const reopened = briefingChatOpener({store,newChat,cache,emit:()=>{}});
  assert.equal((await reopened(item)).thread.id, saved.id);
  assert.equal(chat.archived,false); assert.equal(created,1);
});

test('failed chat creation can be retried and examples retain their own historical dates', async () => {
  const store = {state:{chats:[]},projectRoot:async()=>'/tmp'};
  let attempts=0;
  const open=briefingChatOpener({store,newChat:async()=>{attempts++;throw Error('Worker offline');},cache:new Map(),emit:()=>{}});
  const reports=demoBriefings('2026-01-01');
  assert.equal(reports.length,4);
  assert.equal(reports[1].date,'2025-12-31');
  assert.notEqual(reports[0].body,reports[1].body);
  await assert.rejects(open(reports[0]),/Worker offline/);
  await assert.rejects(open(reports[0]),/Worker offline/);
  assert.equal(attempts,2);
});
