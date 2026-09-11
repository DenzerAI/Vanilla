import test from 'node:test';
import assert from 'node:assert/strict';
import {chatStartFeed,startHeadline,headlineForItem,headlinesForItem,conversationStarters,reconcileFan,replyPreview} from '../ui/chat-start-feed.mjs';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
test('start prioritizes questions, deduplicates latest outputs and excludes read or other-project chats',()=>{
 const chats=[{id:'a',projectId:'default',title:'Frage'},{id:'b',projectId:'other',title:'Andere Frage'},{id:'c',projectId:'default',title:'Antwort',lastTurnStatus:'completed',lastCompletedTurnId:'x'},{id:'d',projectId:'default',jobId:'j',lastTurnStatus:'completed',lastCompletedTurnId:'x'}];
 const notifications=[{id:'new',job_id:'job',status:'completed',title:'Bericht',created_at:3,read_at:4},{id:'old',job_id:'job',status:'completed',title:'Alt',created_at:2},{id:'attention-end',status:'waiting',title:'Wartet',created_at:1},{id:'end',job_id:'other',status:'completed',title:'Fertig',created_at:3}];
 const feed=chatStartFeed({requests:[{id:'q1',params:{threadId:'a'}},{id:'q2',params:{threadId:'b'}}],chats,notifications});
 assert.deepEqual(feed.map(i=>i.id),['request:q1','chat:c:x','notice:end']);
 assert.equal(startHeadline(feed[0].kind,'Hallo'),'Hier braucht es kurz dich.');
 assert.deepEqual(chatStartFeed(),[conversationStarters[0]]);
 assert.ok(conversationStarters.every(i=>i.prompt&&!i.prompt.includes('input/beispiel.md')));
});
test('fan renders empty, single and multiple entries with accessible action names',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),dir=await mkdtemp(root+'.verify-fan-');
 try{
  const result=await build({entryPoints:[root+'ui/components/ui/attention-fan.tsx'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'}});
  const file=dir+'/fan.mjs';await writeFile(file,result.outputFiles[0].contents);
  const {AttentionFan}=await import(pathToFileURL(file));
  const render=items=>renderToStaticMarkup(React.createElement(AttentionFan,{items,onOpen:()=>{},reduceMotion:true}));
  const sunny=render([{id:'weather',kind:'weather',title:'Teststadt',description:'24 °C · Klar',weather:{status:'ready',temperature:24,code:0,isDay:true,high:26,low:12,time:1800000000000}}]);
  assert.match(sunny,/weather-temperature/);assert.match(sunny,/24°/);assert.match(sunny,/data-scene="sunny"/);assert.match(sunny,/data-night="false"/);assert.match(sunny,/H: 26°/);
  const snow=render([{id:'weather',kind:'weather',title:'Teststadt',description:'Schnee',weather:{status:'ready',temperature:-2,code:73,isDay:false,time:1800000000000}}]);
  assert.match(snow,/data-scene="snow"/);assert.match(snow,/data-night="true"/);assert.doesNotMatch(snow,/weather-sun/);assert.doesNotMatch(snow,/Unwetterwarnung/);
  const failed=render([{id:'weather',kind:'weather',title:'Teststadt',description:'Wetter konnte nicht geladen werden.',weather:{status:'error'}}]);
  assert.doesNotMatch(failed,/weather-scene/);assert.match(failed,/nicht geladen/);
  assert.equal(render([]),'');
  const single=render([conversationStarters[0]]);assert.match(single,/Gemeinsam planen öffnen/);assert.doesNotMatch(single,/Nächste Karte/);
  const many=render([...conversationStarters,{id:'4',kind:'notice',title:'Hinweis',description:'Neu'},{id:'5',kind:'report',title:'Ergebnis',description:'Neu'}]);
  assert.equal((many.match(/class="attention-fan-card/g)||[]).length,3);assert.match(many,/Nächste Karte/);assert.match(many,/aria-current="true"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('heading reflects the selected content, with a neutral fallback',()=>{
 assert.equal(headlineForItem({kind:'chat',title:'Angebot prüfen'},'Hallo'),'Ich habe eine neue Antwort für dich.');
 assert.equal(headlineForItem({kind:'request',title:'Termin planen'},'Hallo'),'Hier brauche ich kurz deine Rückmeldung.');
 assert.equal(headlineForItem(null,'Hallo'),'Hallo');
});

test('automatic phrases stay with the selected topic without inventing result contents',()=>{
 const lines=headlinesForItem({kind:'chat',title:'Angebot prüfen'},'Hallo');
 assert.equal(new Set(lines).size,2);
 assert.ok(lines.every(line=>!line.includes('Angebot prüfen')));
 assert.deepEqual(headlinesForItem(null,'Hallo'),['Hallo']);
});

test('start mixes real outputs and scheduled jobs while reserving a weather slot',()=>{
 const now=Date.parse('2026-09-09T12:00:00Z');
 const items=chatStartFeed({now,includeWeather:true,jobs:[{id:'later',name:'Später',status:'active',projectId:'default',nextRun:'2026-09-10T12:00:00Z'},{id:'next',name:'Nächster',status:'active',projectId:'default',nextRun:'2026-09-09T13:00:00Z'},{id:'paused',status:'paused',nextRun:'2026-09-09T12:30:00Z'}],entries:[{id:'f',name:'Entwurf.md',projectId:'default',modifiedAt:now,missing:false}],reports:[{id:'r',title:'Ergebnis',created_at:now/1000,body:'Die Auswertung liegt bereit.'}]});
 assert.deepEqual(items.map(i=>i.kind),['report','job','weather']);
 assert.equal(items[1].job.id,'next');
 assert.ok(headlinesForItem(items[0],'Hallo')[1].includes('Ergebnis'));
 assert.ok(items.length<=5);
});

test('weather card opens deterministic settings and reflects only the saved location',()=>{
 const unset=chatStartFeed({includeWeather:true}).find(i=>i.kind==='weather');
 assert.equal(unset.description,'Dein Ort ist noch nicht eingerichtet.');
 assert.equal(unset.prompt,undefined);
 const saved=chatStartFeed({includeWeather:true,userProfile:{location:'Beispielstadt'}}).find(i=>i.kind==='weather');
 assert.equal(saved.title,'Beispielstadt');
 assert.match(saved.description,/wird geladen/);
 const failed=chatStartFeed({includeWeather:true,profileError:true}).find(i=>i.kind==='weather');
 assert.match(failed.description,/nicht geladen/);
});

test('start offers real conversations instead of arbitrary file previews',()=>{
 const entry={id:'draft',name:'Projekt_Entwurf.md',projectId:'default',modifiedAt:Date.now()};
 assert.deepEqual(chatStartFeed({entries:[entry]}),[conversationStarters[0]]);
 const chats=[{id:'latest',title:'Projekt planen',projectId:'default',updatedAt:10,lastTurnStatus:'completed',lastCompletedTurnId:'done',readTurnId:'done'},
 {id:'other',projectId:'other',updatedAt:20,lastTurnStatus:'completed'},
 {id:'archived',projectId:'default',archived:true,updatedAt:30,lastTurnStatus:'completed'}];
 const items=chatStartFeed({entries:[entry],chats});
 assert.equal(items.length,1);
 assert.equal(items[0].threadId,'latest');
 assert.equal(items[0].entry,undefined);
 assert.equal(items[0].title,'Projekt planen');
});


test('all unread replies survive the old limit and only unread turns get reply cards',()=>{
 const chats=Array.from({length:12},(_,n)=>({id:'c'+n,title:'Thema '+n,projectId:'default',updatedAt:n,lastTurnStatus:'completed',lastCompletedTurnId:'turn'+n}));
 const hidden=[{...chats[0],id:'private',private:true},{...chats[0],id:'archived',archived:true},{...chats[0],id:'read',readTurnId:'turn0'},{...chats[0],id:'foreign',projectId:'foreign'}];
 const feed=chatStartFeed({chats:[...chats,...hidden],includeWeather:true});
 assert.equal(feed.filter(item=>item.kind==='chat').length,12);
 assert.equal(feed.at(-1).kind,'weather');
 assert.ok(feed.filter(item=>item.kind==='chat').every(item=>item.turnId&&!item.continuation));
 chats[0].readTurnId='turn0';
 assert.ok(!chatStartFeed({chats}).some(item=>item.id==='chat:c0:turn0'));
});

test('arrivals retain order and selection and precede persistent cards',()=>{
 const previous={ids:['a','b','weather','calendar'],selected:'b'};
 const incoming=[{id:'new',kind:'chat'},{id:'b',kind:'chat'},{id:'a',kind:'chat'},{id:'weather',kind:'weather'},{id:'calendar',kind:'calendar'}];
 const next=reconcileFan(previous,incoming);
 assert.deepEqual(next,{ids:['a','b','new','weather','calendar'],selected:'b'});
 assert.deepEqual(reconcileFan(next,incoming),next);
});

test('removing the selection picks its surviving neighbor even during a burst',()=>{
 const previous={ids:['a','b','c','d'],selected:'b'};
 assert.deepEqual(reconcileFan(previous,[{id:'new'},{id:'a'},{id:'d'}]),{ids:['a','d','new'],selected:'d'});
 assert.equal(reconcileFan({...previous,selected:'d'},[{id:'a'},{id:'b'}]).selected,'b');
 assert.deepEqual(reconcileFan(previous,[]),{ids:[],selected:''});
 assert.equal(reconcileFan(previous,[{id:'replacement'}]).selected,'replacement');
});

test('preview extracts only the requested completed final answer',()=>{
 const thread={turns:[{id:'old',status:'completed',items:[{type:'agentMessage',text:'Alt'}]},{id:'new',status:'completed',items:[{type:'agentMessage',phase:'commentary',text:'Zwischenstand'},{type:'tool',text:'Werkzeugtext'},{type:'agentMessage',phase:'final',text:'**Ergebnis** mit [Link](https://example.com).'}]}]};
 assert.equal(replyPreview(thread,'new'),'Ergebnis mit Link.');
 assert.equal(replyPreview(thread,'missing'),'');
 thread.turns[1].status='inProgress';
 assert.equal(replyPreview(thread,'new'),'');
});
