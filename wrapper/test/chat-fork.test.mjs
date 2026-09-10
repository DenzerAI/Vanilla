import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerFork, romanNumber } from '../chat-fork.mjs';
import { assignChatTitle } from '../chat-title.mjs';
const source = () => ({id:'original',title:'Website überarbeiten',workerThreadId:'original',pinned:true,projectId:'default'});

test('first fork labels the original; nested and sibling forks share a sequence', () => {
  const original=source(), chats=[original];
  assert.equal(original.title,'Website überarbeiten');
  const second=registerFork(chats,original,'second');
  const third=registerFork(chats,second,'third');
  const fourth=registerFork(chats,original,'fourth');
  assert.deepEqual([original,second,third,fourth].map(c=>c.title),['I · Website überarbeiten','II · Website überarbeiten','III · Website überarbeiten','IV · Website überarbeiten']);
  assert.equal(original.pinned,true);
  assert.equal(second.pinned,false);
  assert.equal(second.workerThreadId,'second');
});

test('sequence survives persistence, archival and deletion of the latest member and root', () => {
  const original=source(), chats=[original];
  const second=registerFork(chats,original,'second');
  registerFork(chats,second,'third');
  second.archived=true;
  const reloaded=JSON.parse(JSON.stringify(chats.filter(c=>c.id==='second')));
  assert.equal(registerFork(reloaded,reloaded[0],'fourth').title,'IV · Website überarbeiten');
});

test('same titles are independent and user titles are never heuristically stripped', () => {
  const original=source(), other={...source(),id:'other'}, chats=[original,other];
  registerFork(chats,original,'second');
  assert.equal(other.title,'Website überarbeiten');
  other.title='IV · Kapitel · Kopie';
  assert.equal(registerFork(chats,other,'other-second').title,'II · IV · Kapitel · Kopie');
});

test('renaming a branch retains family identity and its next fork inherits the new title', () => {
  const original=source(), chats=[original];
  const second=registerFork(chats,original,'second');
  second.title='Neuer Ansatz';
  assert.equal(registerFork(chats,second,'third').title,'III · Neuer Ansatz');
  assert.equal(original.title,'I · Website überarbeiten');
});

test('pending automatic title generation cannot overwrite a numbered title', async () => {
  const original={...source(),title:'Neuer Chat'}, chats=[original];
  let finish;
  const pending=assignChatTitle({chat:original,text:'Website',save:async()=>{},emit:()=>{},generate:()=>new Promise(resolve=>{finish=resolve;})});
  await Promise.resolve();
  registerFork(chats,original,'second');
  finish('Anderer Titel');
  await pending;
  assert.equal(original.title,'I · Neuer Chat');
});

test('Roman notation includes subtractive forms', () => {
  assert.deepEqual([1,4,9,14,40,49,90,99,400,944].map(romanNumber),['I','IV','IX','XIV','XL','XLIX','XC','XCIX','CD','CMXLIV']);
});

const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const routeSource=server.slice(server.indexOf('route("POST", "/api/fork"'),server.indexOf('route("POST", "/api/respond"'));
function routeHarness(call) {
  const original=source(), chats=[original], events=[], saves=[];
  let handler;
  const dependencies={route:(method,url,fn)=>{handler=fn;},turnLocks:new Set(),active:new Map(),ensure:async()=>original,
    workers:{call},perms:()=>({}),store:{state:{chats},save:async()=>saves.push(structuredClone(chats)),exportThread:async()=>{}},
    registerFork,loaded:new Set(),toolsByThread:new Map(),mergeTools:t=>t,threadCache:new Map(),atomic:async()=>{},
    path:{join:()=>''},workspace:'',emit:event=>events.push(event)};
  Function(...Object.keys(dependencies),routeSource)(...Object.values(dependencies));
  return {handler,original,chats,events,saves};
}
test('native fork failure leaves the source title and metadata untouched', async () => {
  const h=routeHarness(async()=>{throw Error('native failure');});
  await assert.rejects(h.handler({id:'original'}),/native failure/);
  assert.deepEqual(h.original,source());
  assert.equal(h.chats.length,1);
  assert.equal(h.saves.length,0);
});

test('overlapping native forks allocate distinct numbers, save titles and notify other panels', async () => {
  const pending=[], calls=[];
  const h=routeHarness((method,args)=>{calls.push({method,args});return new Promise(resolve=>pending.push(resolve));});
  const first=h.handler({id:'original',beforeTurnId:'boundary'});
  const second=h.handler({id:'original'});
  await Promise.resolve();
  pending[1]({thread:{id:'second',turns:[]}});
  pending[0]({thread:{id:'third',turns:[]}});
  await Promise.all([first,second]);
  assert.deepEqual(h.chats.map(c=>c.title).sort(),['I · Website überarbeiten','II · Website überarbeiten','III · Website überarbeiten'].sort());
  assert.equal(calls[0].args.beforeTurnId,'boundary');
  assert.equal(calls[0].method,'thread/fork');
  assert.equal(h.saves.at(-1).length,3);
  assert.equal(h.events.filter(e=>e.method==='wrapper/chats').length,2);
});
