import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageOutbox,deliveryView} from '../ui/message-outbox.mjs';
import {MessageDelivery} from '../message-outbox-server.mjs';
const flush=()=>new Promise(r=>setTimeout(r,15));
const input=(key='12345678-1234-1234-1234-123456789012')=>({clientMessageId:key,id:'chat',localId:'chat',text:'Hallo',attachments:[]});
const fixture=async(send=async()=>({turn:{id:'turn'}}))=>{
 let disk, calls=0;
 const store={state:{},chat:id=>({id}),save:async()=>{disk=structuredClone(store.state);}};
 const queue=await new MessageDelivery({store,createChat:async()=>({thread:{id:'new-chat'}}),send:async(...args)=>{calls++;return send(...args);}}).init();
 return {store,queue,disk:()=>disk,calls:()=>calls};
};
test('acceptance is durable while slow worker runs independently; duplicate retries dispatch once',async()=>{
 let finish;const f=await fixture(()=>new Promise(r=>finish=r));
 const [a,b]=await Promise.all([f.queue.accept(input()),f.queue.accept(input())]);
 assert.equal(a.status,'accepted');assert.equal(b.clientMessageId,a.clientMessageId);
 assert.equal(f.disk().messageDelivery.entries.length,1);
 await flush();assert.equal(f.calls(),1);
 f.queue.kick();assert.equal(f.calls(),1);
 finish({turn:{id:'turn'}});await flush();
 assert.equal(f.queue.get(a.clientMessageId).status,'started');
 await f.queue.accept(input());assert.equal(f.calls(),1);
 await assert.rejects(f.queue.accept({...input(),text:'Anderer Inhalt'}),/anderen Inhalt/);
});
test('new chat creation is not duplicated when a polling tick occurs during save',async()=>{
 const f=await fixture();
 const payload={...input(),id:null,localId:'local',chat:{projectId:'default'}};
 await f.queue.accept(payload);
 for(let i=0;i<10;i++){f.queue.kick();await flush();}
 assert.equal(f.calls(),1);assert.equal(f.queue.get(payload.clientMessageId).chatId,'new-chat');
});
test('lost worker acknowledgement and restart never replay an uncertain side effect',async()=>{
 const f=await fixture(async()=>{throw Error('Verbindung unterbrochen');});
 await f.queue.accept(input());await flush();
 assert.equal(f.queue.get(input().clientMessageId).status,'unknown');
 await f.queue.accept(input());f.queue.kick();await flush();assert.equal(f.calls(),1);
 f.store.state.messageDelivery.entries[0].phase='dispatching';
 await new MessageDelivery({store:f.store}).init();
 assert.equal(f.queue.get(input().clientMessageId).status,'unknown');
});
test('storage failure does not acknowledge acceptance or start a worker',async()=>{
 const f=await fixture();f.store.save=async()=>{throw Error('disk full');};
 await assert.rejects(f.queue.accept(input()),/disk full/);
 assert.equal(f.calls(),0);assert.equal(f.queue.entries.length,0);
});
test('queued receipts recover, and same-chat messages are serialized',async()=>{
 const f=await fixture();let finish;
 f.queue.paused=()=>true;
 // Simulate a previously saved queued message.
 f.store.state.messageDelivery.entries.push({clientMessageId:input().clientMessageId,chatId:'chat',status:'accepted',phase:'queued',payload:input()});
 f.queue.send=()=>new Promise(r=>finish=r);
 f.queue.paused=()=>false;f.queue.kick();await flush();
 const two={...input('22345678-1234-1234-1234-123456789012'),text:'Zweite Nachricht'};
 await f.queue.accept(two);await flush();
 assert.equal(f.queue.inflight.size,1);
 finish({turn:{id:'first'}});await flush();
 f.queue.send=async()=>({turn:{id:'second'}});f.queue.kick();await flush();
 assert.equal(f.queue.get(two.clientMessageId).turnId,'second');
});
test('browser outbox survives a lost HTTP acknowledgement and retries the same identity',async t=>{
 const memory=new Map();let calls=0;let resolve;
 const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k),keys:()=>[...memory.keys()]};
 const sender=createMessageOutbox({storage,api:async(url,payload)=>{calls++;if(calls===1)throw Error('offline');return new Promise(r=>resolve=()=>r({...payload,chatId:'chat',status:'accepted'}));}});
 t.after(()=>sender.stop());sender.start('workspace');sender.enqueue(input());await flush();
 assert.equal(sender.snapshot()[0].status,'offline');
 assert.equal(JSON.parse([...memory.values()][0]).entry.text,'Hallo');
 sender.stop();
 const second=createMessageOutbox({storage,api:async(url,payload)=>({...payload,chatId:'chat',status:'started',turnId:'turn'})});
 t.after(()=>second.stop());second.start('workspace');await flush();
 assert.equal(second.snapshot()[0].clientMessageId,input().clientMessageId);
 assert.equal(second.snapshot()[0].status,'started');
});
test('a quota error preserves the draft and never sends',()=>{
 let sends=0;const sender=createMessageOutbox({storage:{getItem:()=>null,keys:()=>[],removeItem:()=>{},setItem:()=>{throw Error('quota');}},api:async()=>{sends++;}});
 sender.start('workspace');
 assert.throws(()=>sender.enqueue(input()),/lokal nicht gespeichert/);
 assert.equal(sends,0);assert.equal(sender.snapshot().length,0);sender.stop();
});
test('receipts reconcile identical messages once each in the acknowledged turn only',()=>{
 const item=id=>({id,type:'userMessage',content:[{type:'text',text:'Hallo'}]});
 const thread={turns:[{id:'old',items:[item('old')]},{id:'turn',items:[item('one'),item('two')]}]};
 const receipt=id=>({clientMessageId:id,turnId:'turn',status:'started',text:'Hallo'});
 const turns=deliveryView(thread,[receipt('a'),receipt('b')]);
 assert.equal(turns.length,2);assert.equal(turns[1].items[0].delivery.clientMessageId,'a');
 assert.equal(turns[1].items[1].delivery.clientMessageId,'b');assert.equal(turns[0].items[0].delivery,undefined);
});
test('native receipt proves dispatch even if the later RPC response is lost',async()=>{
 let fail;const f=await fixture(()=>new Promise((resolve,reject)=>fail=reject));
 await f.queue.accept(input());await flush();
 await f.queue.observe({method:'item/completed',params:{threadId:'chat',turnId:'turn',item:{id:'native',type:'userMessage',content:[{type:'text',text:'Hallo'}]}}});
 fail(Error('lost response'));await flush();
 assert.equal(f.queue.get(input().clientMessageId).status,'started');
 assert.equal(f.queue.get(input().clientMessageId).itemId,'native');
 await new MessageDelivery({store:f.store}).init();
 assert.equal(f.queue.get(input().clientMessageId).status,'started');
});
test('attachment receipts reconcile with the native attachment text',()=>{
 const receipt={clientMessageId:'file',turnId:'turn',status:'started',text:'Ansehen',attachments:[{path:'input/file.pdf'}]};
 const thread={turns:[{id:'turn',items:[{id:'native',type:'userMessage',content:[{type:'text',text:'Ansehen'},{type:'text',text:'Angehängte Datei: /workspace/input/file.pdf\nLies diese Datei für den Auftrag.'}]}]}]};
 assert.equal(deliveryView(thread,[receipt]).length,1);
 assert.equal(deliveryView(thread,[receipt])[0].items[0].delivery.clientMessageId,'file');
});
test('one tab saving cannot erase another tab pending message',async t=>{
 const values=new Map(), storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),keys:()=>[...values.keys()]};
 const sender=()=>createMessageOutbox({storage,api:async()=>new Promise(()=>{})});
 const a=sender(),b=sender();t.after(()=>{a.stop();b.stop();});
 a.start('workspace');b.start('workspace');
 a.enqueue(input());b.enqueue(input('22345678-1234-1234-1234-123456789012'));
 assert.equal(values.size,2);
});


test('delivery rendering preserves history references and memoizes acknowledged turns',()=>{
  const history={id:'old',items:[{id:'large',type:'tool',output:'x'.repeat(1000000)}]};
  const user={id:'user',type:'userMessage',content:[{type:'text',text:'Hello'}]};
  const answer={id:'answer',type:'agentMessage',text:'Streaming'};
  const turn={id:'turn',items:[user,answer]};
  const thread={turns:[history,turn]};
  const receipt={clientMessageId:'receipt',turnId:'turn',status:'accepted',text:'Hello'};
  const first=deliveryView(thread,[receipt]);
  const second=deliveryView(thread,[receipt]);
  assert.equal(first[0],history);assert.equal(second[1],first[1]);
  assert.equal(first[1].items[1],answer);assert.equal(user.delivery,undefined);
  receipt.status='started';
  const third=deliveryView(thread,[receipt]);
  assert.notEqual(third[1],first[1]);assert.equal(third[1].items[0].delivery.status,'started');
  assert.equal(first[1].items[0].delivery.status,'accepted');
  assert.equal(deliveryView(thread,[])[0],history);
});

test('selected next engine is durably queued without blocking a different chat',async()=>{
  const calls=[];const f=await fixture(async(id,payload)=>{calls.push({id,payload});return {turn:{id:'next'}};});
  let active=true;
  f.queue.locked=(id,payload)=>id==='chat' && active && !!payload.nextSelection;
  const selection={workerId:'hermes',model:null,selectionId:'selected'};
  await f.queue.accept({...input(),nextSelection:selection});
  await flush();assert.equal(f.calls(),0);
  assert.deepEqual(f.disk().messageDelivery.entries[0].payload.nextSelection,selection);
  await f.queue.accept({...input('42345678-1234-1234-1234-123456789012'),id:'other'});
  await flush();assert.equal(calls[0].id,'other');
  active=false;f.queue.kick();await flush();
  assert.equal(calls[1].id,'chat');assert.deepEqual(calls[1].payload.nextSelection,selection);
  f.queue.kick();await flush();assert.equal(calls.length,2);
});

test('stale entries from an older page get their workspace back and phantom chats can be discarded',async t=>{
 const memory=new Map();
 const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k),keys:()=>[...memory.keys()]};
 memory.set('agent-message-outbox-v1:workspace:abc',JSON.stringify({version:1,entry:{clientMessageId:'abc',localId:'outbox-abc',chatId:null,projectId:'default',
  text:'Hallo',attachments:[],status:'failed',error:'Arbeitsbereich fehlt.',payload:{clientMessageId:'abc',localId:'outbox-abc',id:null,text:'Hallo',attachments:[]}}}));
 const seen=[];
 const sender=createMessageOutbox({storage,api:async(url,payload)=>{seen.push(payload);return {...payload,clientMessageId:'abc',chatId:'chat',status:'accepted'};}});
 t.after(()=>sender.stop());sender.start('workspace');await flush();
 assert.equal(sender.snapshot()[0].payload.chat.projectId,'default');
 assert.equal(seen.length,0);
 sender.retry('abc');await flush();
 assert.equal(seen[0].chat.projectId,'default');
 sender.stop();
 memory.clear();
 memory.set('agent-message-outbox-v1:workspace:xyz',JSON.stringify({version:1,entry:{clientMessageId:'xyz',localId:'outbox-xyz',chatId:null,projectId:'default',text:'Weg',attachments:[],status:'failed',payload:{}}}));
 let published;
 const second=createMessageOutbox({storage,api:async()=>{throw Error('nie');},changed:e=>{published=e;}});
 t.after(()=>second.stop());second.start('workspace');
 assert.equal(second.discard('outbox-xyz'),true);
 assert.equal(memory.size,0);assert.deepEqual(published,[]);
 assert.equal(second.discard('outbox-xyz'),false);
});

test('explicit recovery preserves attachments, deduplicates concurrent retries and old confirmations',async()=>{
 const sent=[];const f=await fixture(async(id,payload)=>{sent.push(structuredClone(payload));throw Error('lost');});
 await f.queue.accept({...input(),attachments:[{path:'input/document.pdf'}]});await flush();
 const receipt=f.queue.get(input().clientMessageId);
 const action={clientMessageId:receipt.clientMessageId,id:'chat',action:'retry',revision:receipt.revision,text:'Geändert'};
 await assert.rejects(f.queue.action(action),/bestätigen/);
 await Promise.all([f.queue.action({...action,confirmed:true}),f.queue.action({...action,confirmed:true})]);await flush();
 assert.equal(sent.length,2);assert.equal(sent[1].text,'Geändert');assert.deepEqual(sent[1].attachments,[{path:'input/document.pdf'}]);
 await f.queue.action({...action,confirmed:true});await flush();assert.equal(sent.length,2);
});
test('discard persists across restart and stale submissions cannot resurrect a message',async()=>{
 const f=await fixture(async()=>{throw Error('lost');});await f.queue.accept(input());await flush();
 const old=f.queue.get(input().clientMessageId);
 await f.queue.action({clientMessageId:old.clientMessageId,id:'chat',action:'discard',revision:old.revision});
 const restored=await new MessageDelivery({store:f.store}).init();
 assert.equal(restored.get(old.clientMessageId).status,'cancelled');
 assert.equal((await restored.accept(input())).status,'cancelled');
 assert.equal(deliveryView({turns:[]},restored.list('chat')).length,0);
 const local=input('22345678-1234-1234-1234-123456789012');
 await restored.action({clientMessageId:local.clientMessageId,id:'chat',action:'discard'});
 assert.equal((await restored.accept(local)).status,'cancelled');
});
test('recovery refuses wrong chat, active dispatch, and restores state after a failed save',async()=>{
 let finish;const f=await fixture(()=>new Promise(r=>finish=r));await f.queue.accept(input());await flush();
 let receipt=f.queue.get(input().clientMessageId);
 const action={clientMessageId:receipt.clientMessageId,id:'chat',action:'discard',revision:receipt.revision};
 await assert.rejects(f.queue.action({...action,id:'other'}),/anderen Chat/);
 await assert.rejects(f.queue.action(action),/status/);
 finish({turn:{id:'turn'}});await flush();
 receipt=f.queue.entries[0];receipt.status='unknown';receipt.phase='dispatching';
 f.store.save=async()=>{throw Error('disk full');};
 await assert.rejects(f.queue.action({...action,revision:receipt.revision}),/disk full/);
 assert.equal(receipt.status,'unknown');
});
test('browser recovery retains a durable tombstone and clears a late confirmed error',async t=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k),keys:()=>[...memory.keys()]};
 const f=await fixture(async()=>{throw Error('lost');});await f.queue.accept(input());await flush();
 const api=async(url,body)=>body?f.queue.action(body):f.queue.get(input().clientMessageId);
 const sender=createMessageOutbox({storage,api});t.after(()=>sender.stop());sender.start('test');sender.merge(f.queue.list('chat'));
 await sender.recover(input().clientMessageId,'discard');sender.stop();
 const next=createMessageOutbox({storage,api});t.after(()=>next.stop());next.start('test');await flush();
 assert.equal(next.snapshot()[0].status,'cancelled');assert.equal(deliveryView({},next.snapshot()).length,0);
 const confirmed={...input(),status:'started',turnId:'turn',revision:100,error:''};
 next.merge([{...confirmed,clientMessageId:'late',status:'unknown',revision:99,error:'lost'}]);next.merge([{...confirmed,clientMessageId:'late'}]);
 assert.equal(next.snapshot().find(e=>e.clientMessageId==='late').error,'');
});
