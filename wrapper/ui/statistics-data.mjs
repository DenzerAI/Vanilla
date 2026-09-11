import {addTokens} from '../usage.mjs';
// Shared, deterministic calendar arithmetic for the server report and its UI.
export function epoch(value) {
 if(value==null||value==='')return null;
 const n=typeof value==='number'?value:Date.parse(value);
 return Number.isFinite(n)?(typeof value==='number'&&n<1e12?n*1000:n):null;
}
export function localParts(value,timeZone) {
 const date=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(value);
 const p=Object.fromEntries(date.map(p=>[p.type,p.value]));
 return {day:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour)};
}
export function shiftDay(day,delta) {return new Date(Date.parse(day+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);}
export function summarizeStatistics(data,days=0) {
 const today=localParts(data.generatedAt,data.timeZone).day,from=days?shiftDay(today,1-days):'';
 const events=data.events.filter(e=>e.day?e.day<=today&&(!from||e.day>=from):!days);
 const dates=new Map(),hours=Array(24).fill(0),models=new Map(),sessions=new Set();
 let messages=0;
 for(const e of events){sessions.add(e.session);messages+=e.messages;if(e.day){dates.set(e.day,(dates.get(e.day)||0)+e.messages);hours[e.hour]+=e.messages;}const model=e.model!=='Unbekannt'&&typeof e.effort==='string'&&e.effort?`${e.model} · ${e.effort.charAt(0).toUpperCase()+e.effort.slice(1)}`:e.model;models.set(model,(models.get(model)||0)+1);}
 const active=[...dates.keys()].sort();let longest=0,run=0,previous='';
 for(const day of active){run=previous&&shiftDay(previous,1)===day?run+1:1;longest=Math.max(longest,run);previous=day;}
 let streak=0,cursor=dates.has(today)?today:shiftDay(today,-1);
 while(dates.has(cursor)){streak++;cursor=shiftDay(cursor,-1);}
 const modelList=[...models].map(([name,turns])=>({name,turns})).sort((a,b)=>b.turns-a.turns||a.name.localeCompare(b.name));
 const known=modelList.filter(m=>m.name!=='Unbekannt');
 const peak=hours.some(Boolean)?hours.indexOf(Math.max(...hours)):null;
 const usageEvents=events.filter(e=>e.usage?.total);
 const periodUsage=usageEvents.reduce((sum,e)=>addTokens(sum,e.usage.total),{});
 const usage=days?periodUsage:data.usage||{};
 const usageModels=new Map();
 for(const e of usageEvents){
  const rows=e.usage.models?.length?e.usage.models:[{model:e.model,tokens:e.usage.total}];
  for(const row of rows){const key=e.workerId+':'+row.model;usageModels.set(key,{name:row.model,workerId:e.workerId,tokens:addTokens(usageModels.get(key)?.tokens,row.tokens)});}
 }
 const first=from||active[0]||today;
 // Bound the visual to the last 26 weeks; numerical totals retain the full period.
 const chartFrom=first<shiftDay(today,-181)?shiftDay(today,-181):first;
 const calendar=[];for(let day=chartFrom;day<=today;day=shiftDay(day,1))calendar.push({day,count:dates.get(day)||0});
 return {sessions:sessions.size,messages,activeDays:active.length,streak,longest,peak,preferred:known[0]?.name||'Noch unbekannt',models:modelList,calendar,chartFrom,from:from||null,usage,usageModels:[...usageModels.values()],usageTurns:usageEvents.filter(e=>!e.usage.partial).length,periodTurns:events.length,tokens:days?(usage.totalTokens??null):data.tokens,totalSessions:data.totalSessions};
}
export const formatStat=value=>Number.isFinite(value)?new Intl.NumberFormat('de-DE',{notation:value>=1000000?'compact':'standard',maximumFractionDigits:1}).format(value):'–';
