import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MessageDelivery } from '../message-delivery.mjs';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
async function fixture(t, opts = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'deliveries-'));
  t.after(() => rm(dir, {recursive:true,force:true}));
  const file = path.join(dir, 'messages.json'), active = new Map(), calls = [], errors = [];
  let q, n = 0;
  const io = {
    read: async () => { try { return JSON.parse(await readFile(file, 'utf8')); } catch(e) { if(e.code==='ENOENT') return null; throw e; } },
    write: async s => {await writeFile(file+'.tmp', JSON.stringify(s));await rename(file+'.tmp',file);},
    active: id => active.get(id), canSteer: () => opts.steer !== false,
    send: async (id, payload, delivery) => {
      const disk = await io.read();
      assert.equal(disk.messages.at(-1).status === 'dispatching' || disk.messages.some(m => m.status === 'dispatching'), true);
      if (opts.send) return opts.send({id,payload,delivery,active,calls,q});
      delivery.beforeCall();
      const turnId = delivery.targetTurnId || 'turn-'+ ++n;
      calls.push({id,payload,delivery,turnId}); active.set(id,turnId);
      return {turn: {id:turnId}};
    }, onError: e => errors.push(e),
  };
  q = await new MessageDelivery(io).init();
  const send = (id, intent='send', text=id) => q.enqueue('chat', {messageId:id,intent,text});
  const finish = async (id=active.get('chat'), status='completed') => {if(active.get('chat')===id) active.delete('chat');await q.finished('chat',{id,status});await q.settle('chat');};
  return {q,io,send,finish,active,calls,errors};
}
test('tool call stays active: normal input steers same task; Danach runs FIFO after completion', async t => {
  const f=await fixture(t);f.active.set('chat','original-tool-turn');
  await f.send('after-one','after');await f.send('after-two','after');await f.q.settle('chat');assert.equal(f.calls.length,0);
  await f.send('steer-one');await f.q.settle('chat');assert.equal(f.calls.length,1);assert.equal(f.calls[0].delivery.targetTurnId,'original-tool-turn');
  await f.finish();assert.equal(f.calls[1].payload.text,'after-one');
  await f.finish();assert.equal(f.calls[2].payload.text,'after-two');
  await f.finish();assert.equal(f.calls.length,3);assert.equal(f.errors.length,0);
});
test('concurrent duplicate submissions and retries after edit/delete cannot process twice', async t => {
  const f=await fixture(t);f.active.set('chat','busy');
  await Promise.all(Array.from({length:20},()=>f.send('same-message','after')));
  let m=(await f.q.list('chat')).messages[0];assert.equal((await f.q.list('chat')).messages.length,1);
  await f.q.edit('chat',m.id,m.revision,'edited');
  await assert.rejects(f.q.edit('chat',m.id,m.revision,'stale'),/inzwischen/);
  await f.send('same-message','after');m=(await f.q.list('chat')).messages[0];assert.equal(m.payload.text,'edited');
  await f.q.edit('chat',m.id,m.revision,'',true);await f.send('same-message','after');await f.finish();assert.equal(f.calls.length,0);
  await assert.rejects(f.send('same-message','after','different'),/anderem Inhalt/);
});
test('worker accepted but connection/ack lost: unknown is permanent and blocks blind retries', async t => {
  const f=await fixture(t,{send:async ({delivery,calls})=>{delivery.beforeCall();calls.push('accepted');throw Error('socket closed');}});
  await f.send('lost-ack');await f.q.settle('chat');
  assert.equal((await f.q.list('chat')).messages[0].status,'unknown');
  await f.send('lost-ack');await f.send('next-task','after');await f.q.settle('chat');assert.equal(f.calls.length,1);
  const restart=await new MessageDelivery(f.io).init();await restart.reconcile('chat',{turns:[]});await restart.settle('chat');assert.equal(f.calls.length,1);
});
test('finish before start response never leaves a phantom active predecessor', async t => {
  const response=deferred(), entered=deferred();let index=0;
  const f=await fixture(t,{send:async ({delivery,active,calls,q})=>{
    delivery.beforeCall();const id='fast-'+ ++index;calls.push(id);
    if(index===1){entered.resolve();await response.promise;}
    await q.finished('chat',{id,status:'completed'});active.delete('chat');return {turn:{id}};
  }});
  await f.send('fast-first');await entered.promise;await f.send('fast-second','after');response.resolve();await f.q.settle('chat');
  assert.deepEqual(f.calls,['fast-1','fast-2']);assert.ok((await f.q.list('chat')).messages.every(m=>m.status==='delivered'&&m.outcome==='completed'));
});
test('completion during preparation requeues unsent input as continuation before Danach', async t => {
  let first=true;
  const f=await fixture(t,{send:async({delivery,active,calls,q,payload})=>{
    if(first){first=false;active.delete('chat');await q.finished('chat',{id:'old',status:'completed'});throw Object.assign(Error('race'),{deliveryRace:true});}
    delivery.beforeCall();calls.push({payload,delivery});active.set('chat','continued');return {turn:{id:'continued'}};
  }});
  f.active.set('chat','old');await f.send('after-task','after');await f.send('addition');await f.q.settle('chat');
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.text,'addition');assert.equal(f.calls[0].delivery.continuation,true);
});
test('restart resumes only after exact predecessor completion; waiting stays editable', async t => {
  const f=await fixture(t);f.active.set('chat','persisted');await f.send('later-task','after');await f.q.settle('chat');f.active.clear();
  const restart=await new MessageDelivery(f.io).init();restart.kick('chat');await restart.settle('chat');assert.equal(f.calls.length,0);
  await restart.reconcile('chat',{turns:[{id:'other',status:'completed'}]});await restart.settle('chat');assert.equal(f.calls.length,0);
  await restart.reconcile('chat',{turns:[{id:'persisted',status:'completed'}]});await restart.settle('chat');assert.equal(f.calls.length,1);
});
test('crash after durable claim does not repeat delivery', async t => {
  const f=await fixture(t);await f.io.write({version:1,gates:{},messages:[{id:'claimed-task',chatId:'chat',status:'dispatching',revision:2,payload:{text:'unsafe'}}]});
  const restart=await new MessageDelivery(f.io).init();restart.kick('chat');await restart.settle('chat');assert.equal(f.calls.length,0);assert.equal((await restart.list('chat')).messages[0].status,'unknown');
});
test('unsupported steering waits without interrupting, then continues original task', async t => {
  const f=await fixture(t,{steer:false});f.active.set('chat','tool');await f.send('unsupported');await f.q.settle('chat');assert.equal(f.calls.length,0);
  await f.finish();assert.equal(f.calls[0].delivery.continuation,true);
});
test('edit versus claim has one winner; editing cannot change in-flight payload', async t => {
  const blocked=deferred(),entered=deferred();
  const f=await fixture(t,{send:async ({delivery,payload,calls})=>{delivery.beforeCall();calls.push(payload.text);entered.resolve();await blocked.promise;return {turn:{id:'one'}};}});
  await f.send('claimed-msg');await entered.promise;
  await assert.rejects(f.q.edit('chat','claimed-msg',1,'changed'),/inzwischen/);blocked.resolve();await f.q.settle('chat');assert.deepEqual(f.calls,['claimed-msg']);
});
test('stale completion cannot release a newer task; interruption pauses FIFO', async t => {
  const f=await fixture(t);await f.send('first-msg');await f.q.settle('chat');const first=f.active.get('chat');await f.send('second-msg','after');await f.send('third-msg','after');await f.finish();
  await f.q.finished('chat',{id:first,status:'completed'});await f.q.settle('chat');assert.equal(f.calls.length,2);
  await f.finish(undefined,'interrupted');assert.equal(f.calls.length,2);assert.equal((await f.q.list('chat')).blocked,true);
});
test('normal input during a pending start is attached to that start', async t => {
  const entered=deferred(),release=deferred();let index=0;
  const f=await fixture(t,{send:async({delivery,active,calls})=>{delivery.beforeCall();calls.push(delivery.targetTurnId);if(++index===1){entered.resolve();await release.promise;}active.set('chat','started');return {turn:{id:'started'}};}});
  await f.send('starting-msg');await entered.promise;await f.send('early-steer');release.resolve();await f.q.settle('chat');assert.deepEqual(f.calls,[null,'started']);
});
test('persistence failure prevents the worker call', async t => {
  const f=await fixture(t);const q=await new MessageDelivery({...f.io,write:async()=>{throw Error('disk full');}}).init().catch(e=>e);
  assert.match(q.message,/disk full/);assert.equal(f.calls.length,0);
});
test('explicit resume keeps unknown evidence without repeating it, and rejects stale approval', async t => {
  let first=true;
  const f=await fixture(t,{send:async({delivery,calls})=>{delivery.beforeCall();calls.push('call');if(first){first=false;throw Error('lost');}return {turn:{id:'new'}};}});
  await f.send('unknown-msg');await f.q.settle('chat');await f.send('waiting-msg','after');await f.q.settle('chat');
  const view=await f.q.list('chat');await assert.rejects(f.q.resume('chat','stale'),/geändert/);
  await f.q.resume('chat',view.pauseToken);await f.q.settle('chat');assert.equal(f.calls.length,2);
  assert.equal((await f.q.list('chat')).messages[0].status,'unknown');assert.ok((await f.q.list('chat')).messages[0].reviewedAt);
  await f.send('unknown-msg');await f.q.settle('chat');assert.equal(f.calls.length,2);
});
test('restart gate or another handoff leaves unattempted messages waiting', async t => {
  let paused=true;
  const f=await fixture(t,{send:async({delivery,calls})=>{if(paused)throw Object.assign(Error('restart'),{deliveryPaused:true});delivery.beforeCall();calls.push('once');return {turn:{id:'resumed'}};}});
  await f.send('paused-msg');await f.q.settle('chat');assert.equal((await f.q.list('chat')).messages[0].status,'waiting');assert.equal(f.calls.length,0);
  paused=false;f.q.kick('chat');await f.q.settle('chat');assert.equal(f.calls.length,1);
});
