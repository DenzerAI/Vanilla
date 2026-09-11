import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {weatherChatOpener,weatherReportText,weatherSummaryPrompt} from '../weather-report.mjs';
import {briefingChatOpener} from '../briefing-chat.mjs';
import {handoffInstructions} from '../chat-handoff.mjs';
import {createWeatherService} from '../weather.mjs';

const at=Date.parse('2026-01-01T08:00:00Z');
function forecast(){return {temperature:0,code:0,feelsLike:-2,wind:0,gusts:8,time:at,fetchedAt:at,timezone:'America/Los_Angeles',
 daily:Array.from({length:7},(_,i)=>({time:at+i*86400000,code:i===2?63:0,low:-2,high:4,probability:i===2?80:0,precipitation:i===2?3:null,gusts:20})),
 hourly:Array.from({length:24},(_,i)=>({time:at+i*3600000,temperature:i,code:0,probability:0}))};}

test('report preserves actual values, local dates, missing fields, source and seven rows',()=>{
 const text=weatherReportText('Teststadt',forecast());
 assert.match(text,/Jetzt: 0 °C/);assert.match(text,/Wind 0 km\/h/);
 assert.match(text,/America\/Los_Angeles/);assert.match(text,/00:00/);
 assert.match(text,/80 %/);assert.match(text,/3 mm/);assert.match(text,/\| – \|/);
 assert.equal(text.split('\n').filter(l=>l.startsWith('| ')&&l.includes('20 km/h')).length,7);
 assert.match(text,/Open-Meteo/);assert.match(text,/Abgerufen/);
 assert.doesNotMatch(text,/Routine-Ergebnis/);
 assert.ok(!weatherReportText('<script>|\nTest',forecast()).includes('<script>'));
 const prompt=weatherSummaryPrompt('Teststadt');
 assert.match(prompt,/keine Baustelle/);assert.match(prompt,/anderem Standort/);assert.match(prompt,/keine stundengenaue Regenankündigung/);
});

test('one click creates one durable project conversation and one summary, including retries after reconnect',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'weather-chat-'));t.after(()=>rm(root,{recursive:true,force:true}));
 let created=0,sent=0,fetched=0,options,prompt;
 const store={root,state:{chats:[]},chat(id){return this.state.chats.find(c=>c.id===id);},projectRoot:async id=>{assert.equal(id,'site');return root;},save:async()=>{},exportThread:async()=>{}};
 const openBriefing=briefingChatOpener({store,cache:new Map(),emit:()=>{},newChat:async opts=>{options=opts;const chat={id:'weather-'+(++created),projectId:opts.projectId};store.state.chats.push(chat);return {thread:{id:chat.id,turns:[]}};}});
 const deps={store,openBriefing,readProfile:async()=>'Wetterort: Teststadt\nWetterkoordinaten: 0, 0',weather:{forecast:async(lat,lon)=>{assert.equal(lat,0);assert.equal(lon,0);fetched++;return forecast();}},sendTurn:async(id,b)=>{sent++;prompt=b.text;}};
 const open=weatherChatOpener(deps),input={requestId:'00000000-0000-4000-8000-000000000001',projectId:'site',selection:{worker:'codex',model:'selected-model'}};
 const [a,b]=await Promise.all([open(input),open(input)]);
 assert.equal(a.thread.id,b.thread.id);assert.equal(created,1);assert.equal(sent,1);assert.equal(fetched,1);
 assert.equal(options.projectId,'site');assert.equal(options.model,'selected-model');assert.equal(options.worker,'codex');
 assert.match(prompt,/Teststadt/);
 assert.match(await handoffInstructions(store,store.chat(a.thread.id)),/Sieben Tage/);
 const reconnected=weatherChatOpener(deps);assert.equal((await reconnected(input)).thread.id,a.thread.id);assert.equal(sent,1);assert.equal(fetched,1);
 await open({...input,requestId:'00000000-0000-4000-8000-000000000002'});assert.equal(created,2);assert.equal(sent,2);
});

test('fetch failure creates no chat; summary failure keeps a readable report without resending',async()=>{
 let created=0,sent=0,offline=true;
 const store={state:{chats:[]},projectRoot:async()=>'/tmp',save:async()=>{},chat(id){return this.state.chats.find(c=>c.id===id);}};
 const open=weatherChatOpener({store,readProfile:async()=>'Wetterort: Teststadt\nWetterkoordinaten: 0, 0',weather:{forecast:async()=>{if(offline)throw Error('Wetter offline');return forecast();}},openBriefing:async item=>{let chat=store.state.chats.find(c=>c.briefingId===item.id);if(!chat){created++;chat={id:'one',briefingId:item.id};store.state.chats.push(chat);}return {thread:{id:chat.id}};},sendTurn:async()=>{sent++;throw Error('Worker offline');}});
 const input={requestId:'00000000-0000-4000-8000-000000000001'};
 await assert.rejects(open(input),/Wetter offline/);assert.equal(created,0);
 offline=false;const report=await open(input);assert.match(report.summaryError,/Einordnung/);assert.equal(created,1);
 await open(input);assert.equal(sent,1);
 await assert.rejects(open({requestId:'invalid'}),/Ungültige/);
});

test('forecast validates completeness and retrieves fresh data for each new report',async()=>{
 let calls=0;
 const raw={timezone:'America/Los_Angeles',current:{temperature_2m:0,weather_code:0,time:at/1000,is_day:0},daily:{time:Array.from({length:7},(_,i)=>at/1000+i*86400),weather_code:Array(7).fill(0),temperature_2m_min:Array(7).fill(-2),temperature_2m_max:Array(7).fill(4)},hourly:{time:[at/1000-3600,at/1000,at/1000+3600],temperature_2m:[9,0,1],weather_code:[0,0,0]}};
 const service=createWeatherService({now:()=>at,fetcher:async url=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('forecast_days'),'7');return {ok:true,json:async()=>raw};}});
 const data=await service.forecast(0,0);assert.equal(data.daily.length,7);assert.equal(data.hourly.length,2);assert.equal(data.hourly[0].temperature,0);assert.equal(data.isDay,false);
 await service.forecast(0,0);assert.equal(calls,2);
 raw.daily.time.pop();await assert.rejects(service.forecast(0,0),/unvollständig/);
});
