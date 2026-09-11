import {calendarReport,calendarPrompt} from './ui/calendar-day.mjs';
export function calendarChatOpener({store,readDay,openBriefing,sendTurn,isRestarting=()=>false}) {
 const pending=new Map();
 return async input=>{
  if(!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(input.requestId||''))throw Error('Ungültige Tagesanfrage.');
  if(isRestarting())throw Error('Der Server startet neu. Bitte kurz warten.');
  const projectId=input.projectId||'default';await store.projectRoot(projectId);
  const id='calendar-'+projectId+'-'+input.requestId;
  if(pending.has(id))return pending.get(id);
  const work=(async()=>{
   let chat=store.state.chats.find(c=>c.briefingId===id);
   if(chat?.calendarReportReady){const result=await openBriefing({id});return {...result,meta:chat,summaryError:chat.calendarSummaryError||''};}
   const data=await readDay(projectId);
   if(!data?.date||!Array.isArray(data.events))throw Error('Der Tageskalender ist gerade nicht erreichbar.');
   const result=await openBriefing({id,kind:'calendar',title:'Dein Tag',body:calendarReport(data),created_at:Date.parse(data.now)/1000,projectId},input.selection);
   chat=store.chat(result.thread.id);chat.calendarReportReady=true;
   chat.calendarSummaryError='Der Tagesbericht ist da. Die Einordnung konnte noch nicht bestätigt werden.';
   await store.save();
   try{await sendTurn(chat.id,{text:calendarPrompt});chat.calendarSummaryError='';}catch{}
   await store.save();return {...result,meta:chat,summaryError:chat.calendarSummaryError};
  })().finally(()=>pending.delete(id));pending.set(id,work);return work;
 };
}
