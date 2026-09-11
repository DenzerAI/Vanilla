import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Firma} from '../firma.mjs';
import {firmaItems,firmaSteps} from '../firma-catalog.mjs';
async function fixture(t,overrides={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'firma-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const workspace=path.join(root,'workspace'),company=path.join(root,'company'),data=path.join(root,'data');
 for(const folder of [workspace,company,data,path.join(workspace,'firma')])await mkdir(folder,{recursive:true});
 let created=0,sent=0;
 const store={root:workspace,dataRoot:data,state:{chats:[]},save:async()=>{},chat(id){const c=this.state.chats.find(c=>c.id===id);if(!c)throw Error('Missing chat');return c;}};
 const deps={store,companyRoot:company,newChat:async()=>{const id='chat-'+(++created);store.state.chats.push({id,projectId:'default'});return {thread:{id}};},sendTurn:async()=>{sent++;},emit:()=>{},updateChat:async(id,b)=>Object.assign(store.chat(id),b),...overrides};
 const service=await new Firma(deps).init();
 async function draft(id=firmaItems[0].id,change={}){
  const item=firmaItems.find(x=>x.id===id),p=path.join(workspace,'firma',id+'.md');
  await writeFile(p,'# Bestätigbare Grundlage\nEin konkreter fachlicher Inhalt mit Verantwortlichen, Ziel und Ergebnis.');
  const doc={version:1,itemId:id,summary:'Die fachlichen Grundlagen sind mit dem Betrieb geprüft und dokumentiert.',reviewReady:true,openQuestions:[],evidence:Object.fromEntries(item.criteria.map(c=>[c.id,{finding:'Die konkrete Anforderung ist in der angegebenen Quelle nachvollziehbar beschrieben.',scope:'workspace',path:'firma/'+id+'.md'}])),...change};
  await writeFile(path.join(workspace,'firma',id+'.json'),JSON.stringify(doc));return doc;
 }
 async function review(id=firmaItems[0].id){await service.open(id);await draft(id);const chat=service.chatFor(id);await service.capture(chat,{id:'turn-review',status:'completed',items:[]});return {chat,result:await service.read(id)};}
 return {root,workspace,company,data,store,service,deps,draft,review,created:()=>created,sent:()=>sent};
}
test('32 scoped points are empty initially and opening deduplicates native chat and kickoff',async t=>{
 const f=await fixture(t);const initial=await f.service.state();assert.equal(initial.total,32);assert.equal(initial.complete,0);assert.equal(initial.steps.length,8);assert.ok(initial.steps.every(s=>s.items.length===4));
 const [a,b]=await Promise.all([f.service.open(firmaItems[0].id),f.service.open(firmaItems[0].id)]);assert.equal(a.thread.id,b.thread.id);assert.equal(f.created(),1);assert.equal(f.sent(),1);assert.equal((await f.service.state()).complete,0);
 f.store.chat(a.thread.id).archived=true;await f.service.open(firmaItems[0].id);assert.equal(f.sent(),1);assert.equal(f.store.chat(a.thread.id).archived,false);
 const restored=await new Firma(f.deps).init();assert.equal((await restored.open(firmaItems[0].id)).thread.id,a.thread.id);assert.equal(f.sent(),1);
});
test('evidence and completed review are required; ready is not a completion',async t=>{
 const f=await fixture(t);await f.service.open(firmaItems[0].id);const chat=f.service.chatFor(firmaItems[0].id);
 await f.draft(undefined,{openQuestions:['Ziel fehlt']});assert.equal((await f.service.read(firmaItems[0].id)).ready,false);
 await f.draft();assert.equal((await f.service.state()).complete,0);assert.equal((await f.service.review(chat)).review,null);
 await f.service.capture(chat,{id:'failed',status:'failed'});assert.equal(chat.firmaReview,null);
 await f.service.capture(chat,{id:'completed',status:'completed'});const result=await f.service.read(firmaItems[0].id);
 await assert.rejects(f.service.confirmFromMessage(chat,'Bestätigt 123456789abc'),/unverändert/);
 assert.equal(await f.service.confirmFromMessage(chat,'ja'),false);
 await f.service.confirmFromMessage(chat,'Bestätigt '+result.code);assert.equal((await f.service.state()).complete,1);
 const restored=await new Firma(f.deps).init();assert.equal((await restored.state()).complete,1);
 assert.equal((await f.service.review(chat)).review,null);
});
test('changing sources or proposal invalidates approval and prevents stale confirmations',async t=>{
 const f=await fixture(t);const {chat,result}=await f.review();await writeFile(path.join(f.workspace,'firma',firmaItems[0].id+'.md'),'# Geänderte Grundlage\nDie fachliche Entscheidung wurde inzwischen geändert.');
 await assert.rejects(f.service.confirmFromMessage(chat,'Bestätigt '+result.code),/unverändert/);
 await f.service.capture(chat,{id:'new-review',status:'completed'});const r=await f.service.read(firmaItems[0].id);await f.service.confirmFromMessage(chat,'Bestätigt '+r.code);assert.equal((await f.service.state()).complete,1);
 await f.draft(undefined,{summary:'Diese Zusammenfassung verändert den bereits geprüften Ergebnisstand.'});assert.equal((await f.service.state()).complete,0);assert.equal((await f.service.state()).steps[0].items[0].status,'review');
});
test('later phases can be prepared but cannot bypass the preceding evidence',async t=>{
 const f=await fixture(t);const id=firmaSteps[1].items[0].id;const {chat,result}=await f.review(id);
 assert.equal((await f.service.review(chat)).review.unlocked,false);await assert.rejects(f.service.confirmFromMessage(chat,'Bestätigt '+result.code),/Vorherige Schritte/);
 for(const item of firmaSteps[0].items){const {chat,result}=await f.review(item.id);await f.service.confirmFromMessage(chat,'Bestätigt '+result.code);}
 await f.service.capture(chat,{id:'again',status:'completed'});await f.service.confirmFromMessage(chat,'Bestätigt '+result.code);assert.equal((await f.service.state()).complete,5);
 await f.draft(firmaItems[0].id,{openQuestions:['Neue offene Frage']});const state=await f.service.state();assert.equal(state.complete,3);assert.equal(state.steps[1].items[0].status,'review');
});
test('path escape, missing and malformed evidence never count as ready',async t=>{
 const f=await fixture(t);await assert.rejects(f.service.open('../../outside'),/nicht vorhanden/);const d=await f.draft();
 d.evidence.c1.path='../outside.md';await f.draft(undefined,d);assert.equal((await f.service.read(firmaItems[0].id)).ready,false);
 await f.draft(undefined,{evidence:{}});assert.equal((await f.service.read(firmaItems[0].id)).ready,false);
 await f.draft();await rm(path.join(f.workspace,'firma',firmaItems[0].id+'.md'));assert.equal((await f.service.read(firmaItems[0].id)).ready,false);
 await writeFile(path.join(f.workspace,'firma',firmaItems[0].id+'.json'),'{broken');assert.equal((await f.service.state()).complete,0);
 await rm(path.join(f.workspace,'firma'),{recursive:true});await symlink(f.company,path.join(f.workspace,'firma'));await assert.rejects(f.service.open(firmaItems[0].id),/Verknüpfung/);
});
test('unconfirmed kickoff failure preserves a single chat without blindly retrying',async t=>{
 const f=await fixture(t,{sendTurn:async()=>{throw Error('Unknown worker state');}});const first=await f.service.open(firmaItems[0].id);assert.ok(first.startError);const second=await f.service.open(firmaItems[0].id);assert.equal(first.thread.id,second.thread.id);assert.equal(f.created(),1);
});
test('every turn gets fresh scoped instructions and current gaps; ordinary chats stay unchanged',async t=>{
 const f=await fixture(t);const {chat}=await f.review();const context=await f.service.context(chat);assert.match(context,/Frage nur fehlende/);assert.match(context,/firma\/start-ziel.json/);assert.match(context,/Ergebnis prüfen und Bestätigen/);assert.match(context,/Andere Ergebnisdateien nur lesen/);assert.equal(await f.service.context({}), '');
 await f.draft(undefined,{openQuestions:['Vertretung fehlt']});assert.match(await f.service.context(chat),/Vertretung fehlt/);
});
test('two installations cannot share progress',async t=>{const a=await fixture(t),b=await fixture(t);const {chat,result}=await a.review();await a.service.confirmFromMessage(chat,'Bestätigt '+result.code);assert.equal((await b.service.state()).complete,0);});

test('forking a company work chat cannot copy its assignment or approval',async t=>{
 const {registerFork}=await import('../chat-fork.mjs');
 const f=await fixture(t);const {chat}=await f.review();
 const fork=registerFork(f.store.state.chats,chat,'forked');
 assert.equal(fork.firmaItemId,null);assert.equal(fork.firmaReview,null);
 assert.equal((await f.service.open(firmaItems[0].id)).thread.id,chat.id);
 assert.equal((await f.service.review(fork)).review,null);
});
