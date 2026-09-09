import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chatArchiveUpdater} from '../chat-archive.mjs';
import {briefingChatOpener} from '../briefing-chat.mjs';

function fixture(overrides = {}) {
  const chat = {id:'chat-test', title:'Tagesbericht', archived:false};
  const calls = [], events = [];
  const store = {chat(id) {assert.equal(id, chat.id); return chat;}, save:async()=>{}, state:{chats:[chat]}};
  const deps = {store, workers:{call:async(method, params)=>{calls.push([method, params]);}},
    active:new Map(), turnLocks:new Set(), voiceSessions:new Set(), loaded:new Set([chat.id]),
    restartGate:{restarting:false}, emit:event=>events.push(event), ...overrides};
  return {chat, calls, events, ...deps, update:chatArchiveUpdater(deps)};
}

test('archive and restore synchronize native storage and persist across reloads', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'archive-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const f = fixture();
  f.store.save = () => writeFile(path.join(root,'state.json'),JSON.stringify(f.chat));
  const transcript = path.join(root,'transcript.json');
  await writeFile(transcript, JSON.stringify({turns:[{text:'Gespeicherter Bericht'}]}));
  const before = await readFile(transcript,'utf8');
  await f.update(f.chat.id,{archived:true});
  assert.equal(JSON.parse(await readFile(path.join(root,'state.json'))).archived,true);
  assert.equal(f.loaded.has(f.chat.id),false);
  await f.update(f.chat.id,{archived:false});
  assert.equal(JSON.parse(await readFile(path.join(root,'state.json'))).archived,false);
  assert.deepEqual(f.calls.map(c=>c[0]),['thread/archive','thread/unarchive']);
  assert.equal(await readFile(transcript,'utf8'),before);
  assert.equal(f.events.length,2);
});

test('empty and export-only chats can archive and restore without a native rollout', async () => {
  const f = fixture({workers:{call:async method=>{
    assert.equal(method,'thread/archive','local-only restore must not acquire a second native writer');
    throw Error('no rollout found for thread id chat-test');
  }}});
  await f.update(f.chat.id,{archived:true});
  assert.equal(f.chat.archived,true);
  assert.equal(f.chat.archiveLocalOnly,true);
  // The marker also survives reconstructing the updater after a restart.
  const restore = chatArchiveUpdater(f);
  await restore(f.chat.id,{archived:false});
  assert.equal(f.chat.archived,false);
  assert.equal(f.chat.archiveLocalOnly,undefined);
  assert.equal(f.loaded.has(f.chat.id),true,'the existing empty session remains usable');
  assert.equal(f.events.length,2);
});

test('legacy archives without a native file can still be restored', async () => {
  const f = fixture({workers:{call:async()=>{throw Error('no archived rollout found for thread id chat-test');}}});
  f.chat.archived=true;
  await f.update(f.chat.id,{archived:false});
  assert.equal(f.chat.archived,false);
});

test('unrelated failures never report archive success or partially rename the chat', async () => {
  for (const message of ['Worker offline','Permission denied','rollout storage is corrupt']) {
    const f = fixture({workers:{call:async()=>{throw Error(message);}}});
    await assert.rejects(f.update(f.chat.id,{archived:true,title:'Umbenannt',pinned:true}),new RegExp(message));
    assert.equal(f.chat.archived,false);
    assert.equal(f.chat.title,'Tagesbericht');
    assert.equal(f.chat.pinned,undefined);
    assert.equal(f.events.length,0);
    assert.equal(f.turnLocks.size,0);
  }
});

test('storage failure restores the visible state and frees the mutation lock', async () => {
  const f=fixture(); f.store.save=async()=>{throw Error('Disk full');};
  await assert.rejects(f.update(f.chat.id,{archived:true}),/Disk full/);
  assert.equal(f.chat.archived,false); assert.equal(f.events.length,0); assert.equal(f.turnLocks.size,0);
});

test('active answers, sends, voice and restart prevent native mutations', async () => {
  for (const state of ['active','turnLocks','voiceSessions','restartGate']) {
    const f=fixture();
    if (state==='active') f.active.set(f.chat.id,'turn');
    else if(state==='restartGate') f.restartGate.restarting=true;
    else f[state].add(f.chat.id);
    await assert.rejects(f.update(f.chat.id,{archived:true}),/Bitte/);
    assert.equal(f.calls.length,0); assert.equal(f.chat.archived,false);
  }
});

test('same-state retries are idempotent and invalid archive input is rejected', async () => {
  const f=fixture();
  await f.update(f.chat.id,{archived:false});
  await assert.rejects(f.update(f.chat.id,{archived:'false'}),/Archivstatus/);
  assert.equal(f.calls.length,0);
  await f.update(f.chat.id,{archived:true});
  await f.update(f.chat.id,{archived:true});
  assert.equal(f.calls.length,1);
});

test('concurrent mutations share the send lock until persistence finishes', async () => {
  let release;
  const f=fixture({workers:{call:()=>new Promise(resolve=>{release=resolve;})}});
  const first=f.update(f.chat.id,{archived:true});
  assert.equal(f.turnLocks.has(f.chat.id),true);
  await assert.rejects(f.update(f.chat.id,{archived:true}),/Übertragung/);
  release({}); await first;
  assert.equal(f.turnLocks.size,0);
});

test('opening archived reports uses native restore and keeps archive state on failure', async () => {
  const f=fixture(); f.chat.archived=true; f.chat.briefingId='report';
  const open=briefingChatOpener({...f, newChat:()=>assert.fail('existing chat must be reused'),cache:new Map(),updateChat:f.update});
  assert.equal((await open({id:'report'})).thread.id,f.chat.id);
  assert.equal(f.calls[0][0],'thread/unarchive'); assert.equal(f.chat.archived,false);
  f.chat.archived=true;
  f.workers.call=async()=>{throw Error('Worker offline');};
  await assert.rejects(open({id:'report'}),/Worker offline/);
  assert.equal(f.chat.archived,true);
});
