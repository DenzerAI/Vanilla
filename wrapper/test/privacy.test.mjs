import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {checkHandoff, workerHandoff} from '../privacy.mjs';
import {Workers} from '../workers.mjs';

test('privacy checks only pass a validated release, and propagate offline failure', async () => {
  await assert.rejects(checkHandoff('worker', {text:'sample'}, async () => ({allowed:false, reason:'credentials'})), /Zugangsdaten/);
  await assert.rejects(checkHandoff('worker', {}, async () => null), /nicht freigegeben/);
  await assert.rejects(checkHandoff('worker', {}, async () => ({allowed:'false'})), /nicht freigegeben/);
  await assert.rejects(checkHandoff('worker', {}, async () => {throw Error('offline');}), /offline/);
  await checkHandoff('worker', {text:'sample', attachments:1}, async (path, body) => {
    assert.equal(path, 'privacy/check'); assert.equal(body.text, 'sample'); assert.equal(body.attachments, 1);
    return {allowed:true};
  });
});

test('worker preflight includes company context, steering text, and every supported attachment form', () => {
  const p = {input:[{type:'text', text:'Nachricht'}, {type:'text', text:'Angehängte Datei: /tmp/a.pdf'}, {type:'localImage', path:'/tmp/a.png'}], collaborationMode:{settings:{developer_instructions:'Gemeinsamer Kontext'}}};
  const result = workerHandoff(p);
  assert.match(result.text, /Gemeinsamer Kontext/); assert.match(result.text, /Nachricht/); assert.equal(result.attachments, 2);
  assert.equal(workerHandoff({input:[{type:'text',text:'Nachtrag'}]}).text, 'Nachtrag');
});

test('a blocked worker handoff never starts or invokes the adapter, including realtime', async () => {
  class Adapter extends EventEmitter {start() {assert.fail('Must not start');} call() {assert.fail('Must not call');}}
  const worker = new Workers({store:{chat:()=>({workerId:'codex'}), dataRoot:'/tmp'}, root:'/tmp', codex:new Adapter(), checkHandoff:async () => {throw Error('blocked');}});
  for(const method of ['turn/start','turn/steer','thread/realtime/start']) await assert.rejects(worker.call(method,{threadId:'chat',input:[]}), /blocked/);
});
