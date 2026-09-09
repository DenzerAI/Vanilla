import test from 'node:test';
import assert from 'node:assert/strict';
import {chatStartFeed,startHeadline,headlineForItem,headlinesForItem,conversationStarters} from '../ui/chat-start-feed.mjs';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
test('start prioritizes questions, deduplicates latest outputs and excludes read or other-project chats',()=>{
 const chats=[{id:'a',projectId:'default',title:'Frage'},{id:'b',projectId:'other',title:'Andere Frage'},{id:'c',projectId:'default',title:'Antwort',lastTurnStatus:'completed',lastCompletedTurnId:'x'},{id:'d',projectId:'default',jobId:'j',lastTurnStatus:'completed',lastCompletedTurnId:'x'}];
 const notifications=[{id:'new',job_id:'job',status:'completed',title:'Bericht',created_at:3,read_at:4},{id:'old',job_id:'job',status:'completed',title:'Alt',created_at:2},{id:'attention-end',status:'waiting',title:'Wartet',created_at:1},{id:'end',job_id:'other',status:'completed',title:'Fertig',created_at:3}];
 const feed=chatStartFeed({requests:[{id:'q1',params:{threadId:'a'}},{id:'q2',params:{threadId:'b'}}],chats,notifications});
 assert.deepEqual(feed.map(i=>i.id),['request:q1','notice:end','chat:c']);
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
  assert.equal(render([]),'');
  const single=render([conversationStarters[0]]);assert.match(single,/Gemeinsam planen öffnen/);assert.doesNotMatch(single,/Nächste Karte/);
  const many=render([...conversationStarters,{id:'4',kind:'notice',title:'Hinweis',description:'Neu'},{id:'5',kind:'report',title:'Ergebnis',description:'Neu'}]);
  assert.equal((many.match(/class="attention-fan-card/g)||[]).length,3);assert.match(many,/Nächste Karte/);assert.match(many,/aria-current="true"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('heading reflects the selected content, with a neutral fallback',()=>{
 assert.equal(headlineForItem({kind:'chat',title:'Angebot prüfen'},'Hallo'),'Eine neue Antwort wartet auf dich.');
 assert.equal(headlineForItem({kind:'request',title:'Termin planen'},'Hallo'),'Deine Rückmeldung wird gebraucht.');
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
 assert.deepEqual(items.map(i=>i.kind),['artifact','job','report','weather']);
 assert.equal(items[1].job.id,'next');
 assert.ok(headlinesForItem(items[2],'Hallo')[1].includes('Auswertung'));
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
