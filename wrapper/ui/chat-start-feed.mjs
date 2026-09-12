import {weatherDescription} from './weather-client.mjs';
export const conversationStarters = [
  {id:'plan',kind:'prompt',title:'Gemeinsam planen',description:'Aus einer Idee den nächsten Schritt machen.',prompt:'Lass uns gemeinsam planen. Frage mich zuerst, was ich erreichen möchte.'},
  {id:'file',kind:'prompt',title:'Eine Datei verstehen',description:'Das Wesentliche finden und besprechen.',prompt:'Ich möchte eine Datei mit dir besprechen. Bitte warte, bis ich sie angehängt habe.'},
  {id:'project',kind:'prompt',title:'Projekt erkunden',description:'Überblick gewinnen und weiterkommen.',prompt:'Gib mir einen kurzen Überblick über dieses Projekt und seine nächsten Schritte.'},
];
/** Notification timestamps arrive in seconds, chat timestamps in milliseconds. */
function millis(value) {
 const number=Number(value)||0;
 return number&&number<1e12?number*1000:number;
}
/** @param {{requests?: any[], notifications?: any[], chats?: any[], projectId?: string, jobs?: any[], entries?: any[], reports?: any[], now?: number, includeWeather?: boolean, includeCalendar?: boolean, calendar?:any, userProfile?: {name?:string,location?:string}, profileError?: boolean, weather?:any, includeStatistics?:boolean, statistics?:any,includeAllowances?:boolean,allowances?:any}} options
 * @returns {any[]} */
export function chatStartFeed({requests=[],notifications=[],chats=[],projectId='default',jobs:scheduledJobs=[],entries=[],reports=[],now=Date.now(),includeWeather=false,includeCalendar=false,calendar=null,userProfile={},profileError=false,weather=null,includeStatistics=false,statistics=null,includeAllowances=false,allowances=null}={}) {
  const cards=[], seen=new Set();
  const questions=[];
  for(const request of requests) {
    const threadId=request.params?.threadId;
    const chat=chats.find(c=>c.id===threadId);
    if(chat && chat.projectId!==projectId)continue;
    if(threadId && seen.has(threadId))continue;
    if(threadId)seen.add(threadId);
    questions.push({id:'request:'+request.id,kind:'request',title:chat?.title || 'Deine Antwort fehlt',description:'Hier braucht dein Agent kurz deine Rückmeldung.',threadId});
  }
  if(questions.length)cards.push({...questions[0],count:questions.length,description:questions.length>1?`${questions.length} offene Rückfragen warten auf dich.`:questions[0].description});

  const sorted=[...notifications].sort((a,b)=>b.created_at-a.created_at);
  const finished=new Set(sorted.filter(n=>!n.id.startsWith('attention-')).map(n=>n.id));
  const jobs=new Set();
  const receipts=sorted.filter(n=>{
    if(n.id.startsWith('attention-') && finished.has(n.id.slice(10)))return false;
    const key=n.kind==='ai-update'?'ai:'+n.subject_id:n.status==='completed'?(n.job_id || n.id):n.id;
    if(jobs.has(key))return false;jobs.add(key);
    return !n.read_at;
  });
  const inbox=receipts.map(notice=>({id:'notice:'+notice.id,kind:notice.status==='completed'?'report':'notice',title:notice.title.replace(/ · (Fertig|Braucht Aufmerksamkeit)$/, ''),description:previewText(notice.body,110),noticeId:notice.id,at:millis(notice.created_at)}));
  const unread=new Set();
  for(const chat of chats) {
    if(chat.projectId!==projectId || chat.archived || chat.private || chat.channelOnly || chat.jobId || chat.briefingId || seen.has(chat.id) || chat.coreRunId || chat.lastTurnStatus!=='completed' || !chat.lastCompletedTurnId || chat.readTurnId===chat.lastCompletedTurnId)continue;
    unread.add(chat.id);
    inbox.push({id:'chat:'+chat.id+':'+chat.lastCompletedTurnId,kind:'chat',title:chat.title,description:'',threadId:chat.id,turnId:chat.lastCompletedTurnId,at:millis(chat.updatedAt)});
  }
  const latest=[...reports].sort((a,b)=>b.created_at-a.created_at)[0];
  if(latest && !inbox.some(item=>item.noticeId===latest.id))inbox.push({id:'notice:'+latest.id,kind:'report',title:latest.title.replace(/ · Fertig$/,''),description:previewText(latest.body),noticeId:latest.id,at:millis(latest.created_at)});
  inbox.sort((a,b)=>(a.kind==='notice'?0:1)-(b.kind==='notice'?0:1) || b.at-a.at);
  if(inbox.length)cards.push({id:'inbox',kind:'inbox',title:'Posteingang',description:inboxDescription(inbox),entries:inbox.slice(0,3),count:inbox.length,lead:inbox[0]});

  const recentChat=[...chats].filter(c=>c.projectId===projectId && !c.archived && !c.private && !c.channelOnly && !c.jobId && !c.briefingId && !c.coreRunId && !seen.has(c.id) && !unread.has(c.id) && c.lastTurnStatus==='completed').sort((a,b)=>b.updatedAt-a.updatedAt)[0];
  if(recentChat)cards.push({id:'continue:'+recentChat.id,kind:'chat',title:recentChat.title,description:'Hier kannst du das Gespräch fortsetzen.',continuation:true,threadId:recentChat.id});

  if(!cards.length)cards.push(conversationStarters[0]);
  if(includeCalendar)cards.push({id:'calendar',kind:'calendar',title:'Dein Tag',description:'Termine und freie Zeit gemeinsam planen',calendar});
  if(includeWeather)cards.push({id:'weather',kind:'weather',title:userProfile.location||'Dein Wetter',weather:profileError?null:weather,weatherConfigured:!!userProfile.location,description:profileError?'Dein Wetterort konnte nicht geladen werden.':userProfile.location?weatherDescription(weather):'Dein Ort ist noch nicht eingerichtet.'});
  if(includeStatistics)cards.push({id:"statistics",kind:"statistics",title:"Statistik",description:"Dein Arbeitsrhythmus mit deinem Agenten.",statistics});
  if(includeAllowances)cards.push({id:'allowances',kind:'allowances',title:'Kontingente',description:'Deine verfügbaren Kontingente und Reset-Zeiten.',allowances});
  if(includeCalendar && includeWeather && includeStatistics && includeAllowances) {
    for(const starter of conversationStarters) {
      if(cards.length>=7)break;
      if(!cards.some(card=>card.id===starter.id))cards.push(starter);
    }
  }
  return cards;
}
export function entryTime(at, now=Date.now()) {
 if(!at)return '';
 const date=new Date(at), today=new Date(now);
 const sameDay=date.toDateString()===today.toDateString();
 return sameDay?date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):date.toLocaleDateString('de-DE',{day:'numeric',month:'short'});
}
export const inboxKindLabel={notice:'Hinweis',report:'Ergebnis',chat:'Antwort'};
export function inboxAction(kind) {
 return ({chat:'Antwort ansehen',report:'Ergebnis besprechen',notice:'Hinweis ansehen'})[kind] || 'Ansehen';
}
export function inboxDescription(entries) {
 const count=entries.length;
 if(count===1)return 'Ein neuer Eintrag wartet auf dich.';
 return `${count} neue Einträge warten auf dich.`;
}
export function startHeadline(kind, fallback) {
  return ({request:'Hier braucht es kurz dich.',notice:'Das sollten wir uns ansehen.',report:'Etwas Neues für dich.',chat:'Hier können wir weitermachen.',inbox:'Das ist neu für dich.'})[kind] || fallback;
}

export function previewText(body,limit=140) {
 const text=String(body||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*_`]/g,'').replace(/\s+/g,' ').trim();
 return text.length>limit?text.slice(0,limit).replace(/\s+\S*$/,'')+' …':text;
}
export function friendlyFileTitle(name='') {
 return String(name).replace(/\.[a-z0-9]{1,10}$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim() || 'Dein letzter Stand';
}
export function headlineForItem(item, fallback) {
 if(!item)return fallback;
 if(item.kind==='calendar')return 'Schauen wir auf deinen Tag.';
 if(item.kind==='allowances')return 'Deine Kontingente im Blick.';
 if(item.kind==='statistics')return item.statistics?.events?.length?'So sieht unsere Zusammenarbeit bisher aus.':'Hier entsteht unser gemeinsamer Arbeitsrhythmus.';
 if(item.kind==='inbox')return item.count>1?'Es ist einiges für dich zusammengekommen.':'Ich habe etwas Neues für dich.';
 if(item.continuation)return 'Hier können wir weitermachen.';
 if(item.kind==='weather'&&item.weatherConfigured)return item.weather?.status==='ready'?'So sieht das Wetter bei dir aus.':'Dein Wetterort ist hinterlegt.';
 if(item.kind==='artifact') {
  const title=friendlyFileTitle(item.entry?.name||item.title);
  const short=title.length>24?title.slice(0,23).trimEnd()+'…':title;
  return `Machen wir bei „${short}“ weiter?`;
 }
 return ({request:'Hier brauche ich kurz deine Rückmeldung.',notice:'Schauen wir uns das kurz zusammen an?',report:'Dein Ergebnis ist da. Wollen wir reinschauen?',job:'Das steht als Nächstes an.',weather:'Für welchen Ort möchtest du das Wetter sehen?',chat:'Ich habe eine neue Antwort für dich.',prompt:'Was möchtest du heute mit mir angehen?'})[item.kind] || fallback;
}
export function headlinesForItem(item, fallback, name='') {
 const line=headlineForItem(item,fallback);
 const personal=String(name).trim().split(/\s+/)[0].slice(0,32);
 const first=personal?`Hey ${personal}, ${line[0].toLocaleLowerCase('de')}${line.slice(1)}`:line;
 if(!item)return [first];
 const detail=({calendar:'Deine Termine und wo noch Luft ist.',allowances:'Ein Klick öffnet Nutzung in den Einstellungen mit allen Kontingenten und Reset-Zeiten.',statistics:'Ein Klick öffnet deine Statistik im Chat.',request:'Mit deiner Antwort können wir weitermachen.',notice:'Den Hinweis findest du auf der Karte.',report:'Dein Ergebnis liegt hier zum Ansehen bereit.',artifact:'Der letzte Stand liegt hier für dich bereit.',job:'Die Einzelheiten findest du auf der Karte.',inbox:'Ein Klick öffnet den neuesten Eintrag.',weather:item.weatherConfigured?'Ein Klick öffnet deinen Wetterbericht mit Sieben-Tage-Ausblick.':'Deinen Ort kannst du im Profil festlegen.',chat:'Wir können direkt daran anknüpfen.',prompt:'Wir können mit einer kleinen Idee anfangen.'})[item.kind];
 return detail&&detail!==first?[first,detail]:[first];
}

/** The feed order is fixed; only the chosen card survives an update.
 * @param {{ids:string[],selected:string}} previous
 * @param {{id:string}[]} items
 * @returns {{ids:string[],selected:string}} */
export function reconcileFan(previous, items) {
 const ids=items.map(item=>item.id);
 const available=new Set(ids);
 const oldIndex=previous.ids.indexOf(previous.selected);
 const neighbor=previous.ids.slice(oldIndex+1).find(id=>available.has(id)) || previous.ids.slice(0,Math.max(0,oldIndex)).reverse().find(id=>available.has(id));
 return {ids,selected:available.has(previous.selected)?previous.selected:neighbor||ids[0]||''};
}

export function replyPreview(thread, turnId) {
 const turn=thread?.turns?.find(turn=>turn.id===turnId);
 if(turn?.status!=='completed')return '';
 const reply=turn.items?.filter(item=>item.type==='agentMessage'&&item.phase!=='commentary').at(-1);
 return previewText(reply?.text);
}
