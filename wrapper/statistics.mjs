import {tokens as readTokens,addTokens} from './usage.mjs';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {safeName} from './storage.mjs';
import {epoch,localParts,summarizeStatistics,formatStat} from './ui/statistics-data.mjs';

/** Only local exports; no worker resumes, provider calls, prompts or private chats. */
export async function collectStatistics({store,threadCache=new Map(),projectId='default',timeZone='Europe/Berlin',now=Date.now(),isPrivate=async()=>false}) {
 new Intl.DateTimeFormat('de',{timeZone}).format(now);
 const chats=store.state.chats.filter(c=>(c.projectId||'default')===projectId&&!c.private&&!c.channelOnly&&!c.jobId&&!c.coreRunId&&!c.briefingId).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
 const loaded=Array(chats.length).fill(null);let cursor=0;
 const scan=async()=>{while(cursor<chats.length){const index=cursor++,chat=chats[index];
  if(await isPrivate(chat.id))continue;
  try{loaded[index]={chat,thread:threadCache.get(chat.id)||JSON.parse(await readFile(path.join(store.root,'chats',safeName(chat.id),'transcript.json'),'utf8'))};}
  catch{loaded[index]={chat,thread:null};}
 }};
 await Promise.all(Array.from({length:Math.min(6,chats.length)},scan));
 const events=[],seen=new Set();let missing=0,undated=0,unknownModels=0,tokens=0,tokenSessions=0,usage={};
 for(const {chat,thread} of loaded.filter(Boolean)){
  if(!thread){missing++;continue;}
  let duplicate=false,hasOwn=false;
  for(const [n,turn] of (thread.turns||[]).entries()){
   if(String(turn.id||'').startsWith('briefing-'))continue;
   const key=turn.id?String(turn.id):`${chat.id}:${n}`;
   if(seen.has(key)){duplicate=true;continue;}seen.add(key);
   const items=turn.items||[],count=items.filter(i=>i.type==='userMessage').length+(items.some(i=>i.type==='agentMessage'&&i.phase!=='commentary')?1:0);
   if(!count)continue;hasOwn=true;
   const recorded=chat.statisticsTurns?.[turn.id];
   const time=epoch(turn.startedAt??turn.completedAt??recorded?.startedAt);
   if(time===null)undated++;else if(time>now)continue;
   const rawModel=turn.model||recorded?.model;
   const model=typeof rawModel==='string'&&rawModel.trim()?rawModel.trim():'Unbekannt';if(model==='Unbekannt')unknownModels++;
   events.push({usage:recorded?.usage||turn.usage||null,workerId:recorded?.workerId||chat.workerId||'codex',...time===null?{day:null,hour:null}:localParts(time,timeZone),session:chat.id,messages:count,model:String(model).slice(0,100),effort:turn.reasoningEffort||recorded?.effort||null});
  }
  // Native cumulative totals cannot be safely split by date or inherited fork history.
  const total=chat.tokenUsage?.total?.totalTokens;
  if(!duplicate&&!chat.forkFamilyId&&!chat.handoffSnapshot&&hasOwn&&Number.isFinite(total)&&total>=0){tokens+=total;tokenSessions++;usage=addTokens(usage,readTokens(chat.tokenUsage.total));}
 }
 if(missing&&missing===loaded.filter(Boolean).length)throw Error('Die gespeicherten Gesprächsverläufe konnten nicht geladen werden. Bitte erneut versuchen.');
 return {version:1,projectId,generatedAt:now,timeZone,events,totalSessions:loaded.filter(Boolean).length,tokens:tokenSessions?tokens:null,usage,coverage:{missing,undated,unknownModels,tokenSessions,availableSessions:loaded.filter(Boolean).length-missing}};
}
export function statisticsReportText(data) {
 const sections=[[0,'Gesamt'],[30,'Letzte 30 Tage'],[7,'Letzte 7 Tage']].map(([days,label])=>{
  const s=summarizeStatistics(data,days);
  return `### ${label}\n\n| Kennzahl | Wert |\n| --- | --- |\n| Gespräche mit datierter Aktivität | ${s.sessions} |\n| Nachrichten | ${s.messages} |\n| Aktive Tage | ${s.activeDays} |\n| Aktuelle Serie | ${s.streak} Tage |\n| Längste Serie | ${s.longest} Tage |\n| Häufigste Uhrzeit | ${s.peak===null?'–':s.peak+' Uhr'} |\n| Häufigstes belegtes Modell | ${s.preferred.replace(/[|\n\r]/g,' ')} |\n| Erfasste Tokens | ${formatStat(s.tokens)} |\n| Eingabe-Tokens | ${formatStat(s.usage?.inputTokens)} |\n| Ausgabe-Tokens | ${formatStat(s.usage?.outputTokens)} |\n| Cache gelesen | ${formatStat(s.usage?.cachedInputTokens)} |\n| Cache geschrieben | ${formatStat(s.usage?.cacheCreationInputTokens)} |\n\nModelle nach belegten Gesprächsrunden: ${s.models.map(m=>`${m.name.replace(/[|\n\r]/g,' ')}: ${m.turns}`).join(', ')||'Noch keine Daten'}.`;
 });
 return `# Statistik\n\nStand: ${new Date(data.generatedAt).toLocaleString('de-DE',{timeZone:data.timeZone})} (${data.timeZone}).\n\n${sections.join('\n\n')}\n\nGezählt werden gespeicherte normale Gespräche dieses Workspaces, auch archivierte. Private Chats, Aufträge und Berichtschats sind ausgeschlossen. Nachrichten zählen Nutzereingaben und die finale Antwort pro Runde; Werkzeuge und Zwischenmeldungen zählen nicht. Übernommene Runden werden nur einmal gezählt. Eine Serie bleibt bis zum Ende des heutigen Tages bestehen, wenn gestern Aktivität war.\n\nDatenabdeckung: ${data.coverage.availableSessions} von ${data.totalSessions} Gesprächsverläufen lesbar; ${data.coverage.undated} Runden ohne Datum; ${data.coverage.unknownModels} Runden ohne belegtes Modell. Tokens sind verarbeitete Textbausteine einschließlich erneut verarbeitetem Kontext, kein Maß für geschriebene Wörter oder Produktivität. Native Gesamtsummen liegen für ${data.coverage.tokenSessions} Gespräche vor; nach Zeitraum und für übernommene Verläufe sind sie nicht verlässlich aufteilbar. Fehlende Angaben erscheinen als „–“. Dies ist ein gespeicherter Bericht; spätere Aktivität verändert ihn nicht.`;
}
export function statisticsChatOpener({store,collect,openBriefing}) {
 const pending=new Map();
 return async input=>{
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.requestId||''))throw Error('Ungültige Statistikanfrage.');
  const projectId=input.projectId||'default';await store.projectRoot(projectId);
  const id=`statistics-${projectId}-${input.requestId}`;
  if(pending.has(id))return pending.get(id);
  const work=(async()=>{
   const existing=store.state.chats.find(c=>c.briefingId===id);
   if(existing)return {...await openBriefing({id}),meta:existing};
   const data=await collect(projectId,input.timeZone);
   const result=await openBriefing({id,kind:'statistics',title:'Statistik',body:statisticsReportText(data),created_at:data.generatedAt/1000,projectId,statisticsSnapshot:{...data,id}},input.selection);
   const chat=store.chat(result.thread.id);chat.statisticsSnapshot={...data,id};await store.save();
   return {...result,meta:chat};
  })().finally(()=>pending.delete(id));pending.set(id,work);return work;
 };
}
