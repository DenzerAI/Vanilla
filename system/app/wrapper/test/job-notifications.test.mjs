import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationTargets,sendJobNotification} from '../job-notifications.mjs';
import {Storage} from '../storage.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('only configured allowlisted destinations are available; recipients cannot be invented', async()=>{
  const entries=[{id:'chat-bot',provider:'telegram',name:'Team bot',secretId:'vault-ref',checkedAt:'2026-01-01',config:{allowedUsers:['12345']}},{id:'mail',provider:'microsoft-graph',config:{allowedUsers:['12345']}}];
  const calls=[];
  const services={list:()=>entries,get:id=>entries.find(c=>c.id===id)};
  const channels={state:{sessions:{}},sendTelegram:async(...args)=>calls.push(args)};
  const targets=notificationTargets(services,channels);
  assert.equal(targets.length,1);assert.equal(targets[0].ready,true);
  assert.equal((await sendJobNotification(services,channels,{target:'invented',text:'Hello'})).status,'failed');
  assert.equal(calls.length,0);
  assert.equal((await sendJobNotification(services,channels,{target:targets[0].id,text:'Report'})).status,'sent');
  assert.equal(calls[0][1],'12345');
  entries[0].config.allowedUsers=[];
  assert.equal((await sendJobNotification(services,channels,{target:targets[0].id,text:'Report'})).status,'failed');
});

test('WhatsApp requires the existing authorized conversation and an active receiver',()=>{
  const c={id:'wa',provider:'whatsapp-local',name:'Messages',config:{allowedUsers:['12345']}};
  const services={list:()=>[c]},channels={state:{sessions:{}},status:()=>({runtimeStatus:'running'})};
  assert.equal(notificationTargets(services,channels)[0].ready,false);
  channels.state.sessions.one={connectionId:'wa',sender:'12345',chatId:'wa-chat-1'};
  assert.equal(notificationTargets(services,channels)[0].ready,true);
  channels.status=()=>({runtimeStatus:'stopped'});
  assert.equal(notificationTargets(services,channels)[0].ready,false);
});

test('uncertain provider response is never labelled delivered',async()=>{
  const c={id:'bot',provider:'telegram',name:'Bot',secretId:'ref',checkedAt:'2026-01-01',config:{allowedUsers:['12345']}};
  const services={list:()=>[c],get:()=>c},channels={state:{sessions:{}},sendTelegram:async()=>{throw Error('timeout');}};
  assert.equal((await sendJobNotification(services,channels,{target:notificationTargets(services,channels)[0].id,text:'Report'})).status,'unknown');
});

test('finishing a running job preserves edits, pause, project and notification target',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'routine-contract-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const store=new Storage(path.join(dir,'workspace'),path.join(dir,'data'));await store.init();
  const old=await store.saveJob({id:'daily',name:'Daily',instructions:'First task',projectId:'demo',status:'active',schedule:{type:'weekly',days:[0,4],time:'08:00'},notification:{target:'app',when:'always'}});
  await store.saveJob({...old,status:'paused',instructions:'Updated task',notification:{target:'app',when:'errors'}});
  await store.saveJobRun(old.id,{lastRun:{status:'completed'}});
  const current=(await store.jobs())[0];
  assert.equal(current.status,'paused');assert.equal(current.instructions,'Updated task');assert.equal(current.projectId,'demo');assert.equal(current.notification.when,'errors');assert.equal(current.lastRun.status,'completed');
  await assert.rejects(store.saveJob({...current,schedule:{type:'weekly',time:'08:00',days:[]}}));
  await assert.rejects(store.saveJob({...current,schedule:{type:'once',at:'2026-01-01T08:00'}}));
});
