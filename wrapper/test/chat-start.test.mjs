import test from 'node:test';
import assert from 'node:assert/strict';
import {chatStartFeed,startHeadline,headlineForItem,headlinesForItem,conversationStarters,reconcileFan,replyPreview,entryTime,inboxAction} from '../ui/chat-start-feed.mjs';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
test('start prioritizes questions, deduplicates latest outputs and excludes read or other-project chats',()=>{
 const chats=[{id:'a',projectId:'default',title:'Frage'},{id:'b',projectId:'other',title:'Andere Frage'},{id:'c',projectId:'default',title:'Antwort',lastTurnStatus:'completed',lastCompletedTurnId:'x'},{id:'d',projectId:'default',jobId:'j',lastTurnStatus:'completed',lastCompletedTurnId:'x'}];
 const notifications=[{id:'new',job_id:'job',status:'completed',title:'Bericht',created_at:3,read_at:4},{id:'old',job_id:'job',status:'completed',title:'Alt',created_at:2},{id:'attention-end',status:'waiting',title:'Wartet',created_at:1},{id:'end',job_id:'other',status:'completed',title:'Fertig',created_at:3}];
 const feed=chatStartFeed({requests:[{id:'q1',params:{threadId:'a'}},{id:'q2',params:{threadId:'b'}}],chats,notifications});
 assert.deepEqual(feed.map(i=>i.id),['request:q1','inbox']);
 assert.deepEqual(feed[1].entries.map(i=>i.id),['notice:end','chat:c:x']);
 assert.equal(feed[1].count,2);
 assert.equal(feed[1].lead.id,'notice:end');
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
  const lead={id:'chat:a:t',kind:'chat',title:'Neueste Antwort',threadId:'a',turnId:'t',at:Date.now()};
  const inbox=render([{id:'inbox',kind:'inbox',title:'Posteingang',description:'3 neue Einträge warten auf dich.',count:3,lead,entries:[lead,{id:'notice:n',kind:'notice',title:'Hinweis',at:Date.now()},{id:'notice:r',kind:'report',title:'Ergebnis',at:Date.now()}]}]);
  assert.equal((inbox.match(/attention-fan-stack-row/g)||[]).length,3);
  assert.match(inbox,/Posteingang/);assert.match(inbox,/attention-fan-count">3</);
  assert.match(inbox,/Neueste Antwort/);assert.match(inbox,/Antwort ansehen/);
  assert.doesNotMatch(inbox,/Hinweis ansehen/);
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

test('routine results reach the start through the single inbox card',()=>{
 const now=Date.parse('2026-09-09T12:00:00Z');
 const items=chatStartFeed({now,includeWeather:true,entries:[{id:'f',name:'Entwurf.md',projectId:'default',modifiedAt:now,missing:false}],reports:[{id:'r',title:'Ergebnis',created_at:now/1000,body:'Die Auswertung liegt bereit.'}]});
 assert.deepEqual(items.map(i=>i.kind),['inbox','weather']);
 assert.equal(items[0].lead.kind,'report');
 assert.equal(items[0].lead.noticeId,'r');
 assert.equal(inboxAction(items[0].lead.kind),'Ergebnis besprechen');
 assert.equal(entryTime(items[0].lead.at,now),entryTime(now,now));
 assert.ok(headlinesForItem(items[0],'Hallo')[1].includes('neuesten Eintrag'));
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


test('unread replies collapse into one inbox card instead of one card each',()=>{
 const chats=Array.from({length:12},(_,n)=>({id:'c'+n,title:'Thema '+n,projectId:'default',updatedAt:n,lastTurnStatus:'completed',lastCompletedTurnId:'turn'+n}));
 const hidden=[{...chats[0],id:'private',private:true},{...chats[0],id:'archived',archived:true},{...chats[0],id:'read',readTurnId:'turn0'},{...chats[0],id:'foreign',projectId:'foreign'}];
 const feed=chatStartFeed({chats:[...chats,...hidden],includeWeather:true});
 const inbox=feed.find(item=>item.kind==='inbox');
 assert.equal(feed.filter(item=>item.kind==='inbox').length,1);
 assert.equal(inbox.count,12);
 assert.equal(inbox.entries.length,3);
 assert.equal(inbox.lead.id,'chat:c11:turn11');
 assert.ok(inbox.entries.every(item=>item.turnId&&!item.continuation));
 chats[0].readTurnId='turn0';
 assert.ok(!chatStartFeed({chats}).find(item=>item.kind==='inbox').entries.some(item=>item.id==='chat:c0:turn0'));
});

test('the fixed feed order survives updates and keeps the chosen card',()=>{
 const previous={ids:['inbox','weather','calendar'],selected:'weather'};
 const incoming=[{id:'request:q',kind:'request'},{id:'inbox',kind:'inbox'},{id:'calendar',kind:'calendar'},{id:'weather',kind:'weather'}];
 const next=reconcileFan(previous,incoming);
 assert.deepEqual(next,{ids:['request:q','inbox','calendar','weather'],selected:'weather'});
 assert.deepEqual(reconcileFan(next,incoming),next);
});

test('removing the selection picks its surviving neighbor even during a burst',()=>{
 const previous={ids:['a','b','c','d'],selected:'b'};
 assert.deepEqual(reconcileFan(previous,[{id:'new'},{id:'a'},{id:'d'}]),{ids:['new','a','d'],selected:'d'});
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

test('calendar, weather, statistics and allowances always stay in the fan',()=>{
 const chats=Array.from({length:12},(_,i)=>({id:'c'+i,title:'Thema',projectId:'default',updatedAt:i,lastTurnStatus:'completed',lastCompletedTurnId:'t'+i}));
 const feed=chatStartFeed({chats,includeWeather:true,includeCalendar:true,includeStatistics:true,includeAllowances:true,now:new Date(2026,8,11,12).getTime()});
 assert.deepEqual(feed.map(i=>i.kind),['inbox','calendar','weather','statistics','allowances','prompt','prompt']);
 assert.equal(feed[1].title,'Dein Tag');
 assert.equal(feed[1].calendar,null);
 assert.equal(chatStartFeed({includeCalendar:true,calendar:{error:true}})[1].calendar.error,true);
 assert.equal(feed[1].prompt,undefined);
 assert.equal(new Set(feed.map(i=>i.id)).size,feed.length);
 const quiet=chatStartFeed({includeWeather:true,includeCalendar:true,includeStatistics:true,includeAllowances:true});
 assert.deepEqual(quiet.map(i=>i.kind),['prompt','calendar','weather','statistics','allowances','prompt','prompt']);
});
