import test from 'node:test';
import assert from 'node:assert/strict';
import {collectStatistics,statisticsReportText,statisticsChatOpener} from '../statistics.mjs';
import {summarizeStatistics,localParts,shiftDay} from '../ui/statistics-data.mjs';
import {headlinesForItem,chatStartFeed,reconcileFan} from '../ui/chat-start-feed.mjs';
const now=Date.parse('2026-03-30T12:00:00Z');
const turn=(id,day,model='Example A')=>({id,startedAt:Date.parse(day+'T12:00:00Z')/1000,model,items:[{type:'userMessage'},{type:'agentMessage',phase:'commentary'},{type:'tool'},{type:'agentMessage',phase:'final'},{type:'agentMessage',phase:'final'}]});
const chat=(id,extra={})=>({id,projectId:'default',workerId:'test',...extra});
const collect=async(chats,threads,extra={})=>collectStatistics({store:{root:'/nonexistent',state:{chats}},threadCache:new Map(Object.entries(threads)),now,...extra});
test('counts human-facing messages, deduplicates inherited rounds and skips isolated scopes',async()=>{
 const shared=turn('shared','2026-03-28');
 const data=await collect([chat('a'),chat('b'),chat('private',{private:true}),chat('job',{jobId:'j'}),chat('report',{briefingId:'r'}),chat('foreign',{projectId:'other'})],{a:{turns:[shared]},b:{turns:[shared,turn('new','2026-03-29')]},private:{turns:[turn('secret','2026-03-30')]}});
 const s=summarizeStatistics(data);assert.equal(s.messages,4);assert.equal(s.sessions,2);assert.equal(s.streak,2);assert.equal(s.longest,2);assert.equal(data.totalSessions,2);
});
test('checks core privacy before reading an unmarked chat and fails closed on lookup failure',async()=>{
 const data=await collect([chat('secret'),chat('public')],{secret:{turns:[turn('s','2026-03-30')]},public:{turns:[]}},{isPrivate:async id=>id==='secret'});
 assert.equal(data.totalSessions,1);assert.equal(data.events.length,0);
 await assert.rejects(collect([chat('x')],{}, {isPrivate:async()=>{throw Error('offline');}}),/offline/);
});
test('uses local dates across DST and preserves a yesterday streak until today ends',async()=>{
 assert.equal(localParts(Date.parse('2026-03-29T22:30:00Z'),'Europe/Berlin').day,'2026-03-30');assert.equal(shiftDay('2026-03-29',1),'2026-03-30');
 const data=await collect([chat('a')],{a:{turns:[turn('1','2026-03-27'),turn('2','2026-03-28'),turn('3','2026-03-29')]}});
 assert.equal(summarizeStatistics(data).streak,3);
 assert.equal(summarizeStatistics({...data,generatedAt:now+86400000}).streak,0);
});
test('records unknown coverage rather than inventing old models, timestamps or tokens',async()=>{
 const t=turn('u','2026-03-29');delete t.model;
 const data=await collect([chat('a',{model:'Current does not prove history'}),chat('missing')],{a:{turns:[t,{id:'undated',items:[{type:'userMessage'}]}]}});
 assert.equal(data.coverage.missing,1);assert.equal(data.coverage.undated,1);assert.equal(data.coverage.unknownModels,2);assert.equal(summarizeStatistics(data).messages,3);assert.equal(summarizeStatistics(data,7).messages,2);assert.equal(summarizeStatistics(data).preferred,'Noch unbekannt');assert.equal(data.tokens,null);
});
test('uses recorded per-turn model and time and never splits cumulative tokens into periods',async()=>{
 const data=await collect([chat('a',{statisticsTurns:{a:{startedAt:now,model:'Example B',effort:'medium'}},tokenUsage:{total:{totalTokens:120}}}),chat('fork',{forkFamilyId:'family',tokenUsage:{total:{totalTokens:800}}})],{a:{turns:[{id:'a',items:[{type:'userMessage'}]}]},fork:{turns:[turn('f','2026-03-29')]}});
 assert.equal(data.tokens,120);assert.equal(data.coverage.tokenSessions,1);assert.equal(summarizeStatistics(data,7).tokens,null);assert.ok(data.events.some(e=>e.model==='Example B'&&e.effort==='medium'));
});
test('periods include today and exclude future days; all counts outlive the bounded chart',async()=>{
 const data=await collect([chat('a')],{a:{turns:[turn('old','2025-01-01'),turn('edge','2026-03-24'),turn('outside','2026-03-23'),turn('future','2026-03-31')]}});
 assert.equal(summarizeStatistics(data,7).messages,2);assert.equal(summarizeStatistics(data).messages,6);assert.equal(summarizeStatistics(data).calendar.length,182);
});
test('saved text contains all periods, model counts and source limitations for followup questions',async()=>{
 const data=await collect([chat('a')],{a:{turns:[turn('1','2026-03-29')]}});const body=statisticsReportText(data);
 for(const term of ['Gesamt','Letzte 30 Tage','Letzte 7 Tage','Example A','Zwischenmeldungen','gespeicherter Bericht'])assert.ok(body.includes(term),term);
});
test('one snapshot per request id, simultaneous clicks and reload retries start no second chat',async()=>{
 let count=0;const store={state:{chats:[]},projectRoot:async()=>'/workspace',chat:id=>store.state.chats.find(c=>c.id===id),save:async()=>{}};
 const data=await collect([],{});
 const open=statisticsChatOpener({store,collect:async()=>data,openBriefing:async item=>{const old=store.state.chats.find(c=>c.briefingId===item.id);if(old)return {thread:{id:old.id}};count++;await new Promise(r=>setTimeout(r,10));store.state.chats.push({id:'created',briefingId:item.id});return {thread:{id:'created'}};}});
 const input={requestId:'10000000-0000-4000-8000-000000000001'};
 const [a,b]=await Promise.all([open(input),open(input)]);assert.equal(a.thread.id,b.thread.id);assert.equal(count,1);await open(input);assert.equal(count,1);assert.equal(store.chat('created').statisticsSnapshot.version,1);
 await assert.rejects(open({requestId:'../bad'}));
});
test('personal greeting is optional and statistics remain a persistent service card',()=>{
 assert.equal(headlinesForItem({kind:'chat'},'Hallo','Alex Beispiel')[0],'Hey Alex, ich habe eine neue Antwort für dich.');
 assert.equal(headlinesForItem({kind:'chat'},'Hallo')[0],'Ich habe eine neue Antwort für dich.');
 const feed=chatStartFeed({includeStatistics:true});assert.equal(feed.at(-1).kind,'statistics');
 assert.deepEqual(reconcileFan({ids:['statistics'],selected:'statistics'},[{id:'new',kind:'chat'},feed.at(-1)]).ids,['new','statistics']);
});

test('an entirely unavailable history is an error, not a zero-use report',async()=>{await assert.rejects(collect([chat('unavailable')],{}),/nicht geladen/);});

test('keeps newly recorded effort visible without assuming effort for history',()=>{
 const data={generatedAt:now,timeZone:'Europe/Berlin',events:[{day:'2026-03-30',hour:12,session:'a',messages:2,model:'Example A',effort:'medium'},{day:'2026-03-30',hour:12,session:'a',messages:2,model:'Example A'}]};
 assert.deepEqual(summarizeStatistics(data).models.map(m=>m.name).sort(),['Example A','Example A · Medium']);
});
