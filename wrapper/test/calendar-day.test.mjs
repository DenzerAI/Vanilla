import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarCard,calendarGaps,calendarState,calendarReport} from '../ui/calendar-day.mjs';
import {calendarChatOpener} from '../calendar-chat.mjs';
const data={date:'2026-09-10',now:'2026-09-10T09:35:00+02:00',timezone:'Europe/Berlin',localReady:true,feeds:[],windowStart:'2026-09-10T08:00:00+02:00',windowEnd:'2026-09-10T18:00:00+02:00',events:[{id:'a',title:'Abstimmung',source:'Vanilla',date:'2026-09-10',start:'10:00',end:'11:00',startsAt:'2026-09-10T10:00:00+02:00',endsAt:'2026-09-10T11:00:00+02:00'}]};
const now=Date.parse(data.now);
test('next appointment counts down using calendar timezone, including current and rollover states',()=>{
 const c=calendarCard(data,now);assert.equal(c.relative,'in 25 Min.');assert.equal(c.week,37);
 assert.equal(calendarCard(data,now+30*60000).relative,'Läuft gerade');
 assert.equal(calendarCard(data,Date.parse('2026-09-10T22:05:00Z')).state,'loading');
 assert.equal(calendarCard({...data,date:'2021-01-01'},Date.parse('2021-01-01T12:00Z')).week,53);
});
test('gaps merge overlapping busy times and never claim availability from incomplete or all-day calendars',()=>{
 assert.deepEqual(calendarGaps(data,now),[[now,Date.parse(data.events[0].startsAt)],[Date.parse(data.events[0].endsAt),Date.parse(data.windowEnd)]]);
 const more={...data,events:[...data.events,{...data.events[0],id:'b',startsAt:'2026-09-10T10:30:00+02:00',endsAt:'2026-09-10T12:00:00+02:00'}]};
 assert.equal(calendarGaps(more,now)[1][0],Date.parse('2026-09-10T12:00+02:00'));
 assert.equal(calendarState({...data,feeds:[{error:'offline'}]},now),'stale');
 assert.deepEqual(calendarGaps({...data,feeds:[{error:'offline'}]},now),[]);
 assert.deepEqual(calendarGaps({...data,events:[{allDay:true}]},now),[]);
 assert.match(calendarReport(data),/08:00–18:00/);assert.match(calendarReport(data),/Abstimmung/);
});
test('explicit day click preserves workspace and deduplicates summary dispatch while failed reads create no chat',async()=>{
 let creates=0,turns=0;const chats=[];const store={state:{chats},projectRoot:async()=>'/example',chat:id=>chats.find(c=>c.id===id),save:async()=>{}};
 const open=calendarChatOpener({store,readDay:async()=>data,openBriefing:async item=>{let chat=chats.find(c=>c.briefingId===item.id);if(!chat){chat={id:String(++creates),briefingId:item.id,projectId:item.projectId};chats.push(chat);}return {thread:{id:chat.id}};},sendTurn:async()=>{turns++;}});
 const request={requestId:'11111111-1111-4111-8111-111111111111',projectId:'example'};
 const [a,b]=await Promise.all([open(request),open(request)]);await open(request);assert.equal(a.thread.id,b.thread.id);assert.equal(creates,1);assert.equal(turns,1);assert.equal(a.meta.projectId,'example');
 const fail=calendarChatOpener({store,readDay:async()=>{throw Error('offline');},openBriefing:async()=>{creates++;},sendTurn:async()=>{}});
 await assert.rejects(fail({...request,requestId:'22222222-2222-4222-8222-222222222222'}));assert.equal(creates,1);
});
