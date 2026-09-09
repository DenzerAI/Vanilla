import {weatherDescription} from './weather-client.mjs';
export const conversationStarters = [
  {id:'plan',kind:'prompt',title:'Gemeinsam planen',description:'Aus einer Idee den nächsten Schritt machen.',prompt:'Lass uns gemeinsam planen. Frage mich zuerst, was ich erreichen möchte.'},
  {id:'file',kind:'prompt',title:'Eine Datei verstehen',description:'Das Wesentliche finden und besprechen.',prompt:'Ich möchte eine Datei mit dir besprechen. Bitte warte, bis ich sie angehängt habe.'},
  {id:'project',kind:'prompt',title:'Projekt erkunden',description:'Überblick gewinnen und weiterkommen.',prompt:'Gib mir einen kurzen Überblick über dieses Projekt und seine nächsten Schritte.'},
];
/** @param {{requests?: any[], notifications?: any[], chats?: any[], projectId?: string, jobs?: any[], entries?: any[], reports?: any[], now?: number, includeWeather?: boolean, userProfile?: {name?:string,location?:string}, profileError?: boolean, weather?:any}} options
 * @returns {any[]} */
export function chatStartFeed({requests=[],notifications=[],chats=[],projectId='default',jobs:scheduledJobs=[],entries=[],reports=[],now=Date.now(),includeWeather=false,userProfile={},profileError=false,weather=null}={}) {
  const result=[], seen=new Set();
  for(const request of requests) {
    const threadId=request.params?.threadId;
    const chat=chats.find(c=>c.id===threadId);
    if(chat && chat.projectId!==projectId)continue;
    if(threadId && seen.has(threadId))continue;
    if(threadId)seen.add(threadId);
    result.push({id:'request:'+request.id,kind:'request',title:chat?.title || 'Deine Antwort fehlt',description:'Hier braucht dein Agent kurz deine Rückmeldung.',threadId});
  }
  const sorted=[...notifications].sort((a,b)=>b.created_at-a.created_at);
  const finished=new Set(sorted.filter(n=>!n.id.startsWith('attention-')).map(n=>n.id));
  const jobs=new Set();
  const receipts=sorted.filter(n=>{
    if(n.id.startsWith('attention-') && finished.has(n.id.slice(10)))return false;
    const key=n.status==='completed'?(n.job_id || n.id):n.id;
    if(jobs.has(key))return false;jobs.add(key);
    return !n.read_at;
  }).sort((a,b)=>Number(a.status==='completed')-Number(b.status==='completed'));
  for(const notice of receipts)result.push({id:'notice:'+notice.id,kind:notice.status==='completed'?'report':'notice',title:notice.title.replace(/ · (Fertig|Braucht Aufmerksamkeit)$/, ''),description:String(notice.body||'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*_`]/g,'').replace(/\s+/g,' ').trim().slice(0,110),noticeId:notice.id});
  for(const chat of [...chats].sort((a,b)=>b.updatedAt-a.updatedAt)) {
    if(chat.projectId!==projectId || chat.archived || chat.channelOnly || chat.jobId || chat.briefingId || seen.has(chat.id) || chat.coreRunId || chat.lastTurnStatus!=='completed' || !chat.lastCompletedTurnId || chat.readTurnId===chat.lastCompletedTurnId)continue;
    result.push({id:'chat:'+chat.id,kind:'chat',title:chat.title,description:'Eine neue Antwort ist bereit.',threadId:chat.id});
  }
  const nextJob=scheduledJobs.filter(j=>!j.managed && j.status==='active' && (!j.projectId || j.projectId===projectId) && Number.isFinite(Date.parse(j.nextRun)) && Date.parse(j.nextRun)>now).sort((a,b)=>Date.parse(a.nextRun)-Date.parse(b.nextRun))[0];
  const latest=[...reports].sort((a,b)=>b.created_at-a.created_at)[0];
  const newReport=latest?{id:'notice:'+latest.id,kind:'report',title:latest.title.replace(/ · Fertig$/,''),description:previewText(latest.body),noticeId:latest.id}:result.find(i=>i.kind==='report');
  const recentChat=[...chats].filter(c=>c.projectId===projectId && !c.archived && !c.channelOnly && !c.jobId && !c.briefingId && !c.coreRunId && !seen.has(c.id) && c.lastTurnStatus==='completed').sort((a,b)=>b.updatedAt-a.updatedAt)[0];
  const continueCard=recentChat?{id:'chat:'+recentChat.id,kind:'chat',title:recentChat.title,description:'Hier kannst du das Gespräch fortsetzen.',continuation:true,threadId:recentChat.id}:null;
  const jobCard=nextJob?{id:'job:'+nextJob.id,kind:'job',title:nextJob.name,description:`Geplant: ${new Date(nextJob.nextRun).toLocaleString('de-DE',{weekday:'short',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}`,job:nextJob}:null;
  const urgent=result.filter(i=>i.kind==='request'||i.kind==='notice');
  const candidates=[...urgent.slice(0,2),...result.filter(i=>i.kind==='chat'),newReport,continueCard,jobCard,...urgent.slice(2)].filter(Boolean);
  const unique=new Set();const mixed=candidates.filter(item=>{if(unique.has(item.id))return false;unique.add(item.id);return true;});
  if(!mixed.length)mixed.push(conversationStarters[0]);
  const chosen=mixed.slice(0,includeWeather?4:5);
  if(includeWeather)chosen.push({id:'weather',kind:'weather',title:userProfile.location||'Dein Wetter',weather:profileError?null:weather,weatherConfigured:!!userProfile.location,description:profileError?'Dein Wetterort konnte nicht geladen werden.':userProfile.location?weatherDescription(weather):'Dein Ort ist noch nicht eingerichtet.'});
  return chosen;
}
export function startHeadline(kind, fallback) {
  return ({request:'Hier braucht es kurz dich.',notice:'Das sollten wir uns ansehen.',report:'Etwas Neues für dich.',chat:'Hier können wir weitermachen.'})[kind] || fallback;
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
 if(item.continuation)return 'Hier können wir weitermachen.';
 if(item.kind==='weather'&&item.weatherConfigured)return item.weather?.status==='ready'?'So sieht das Wetter bei dir aus.':'Dein Wetterort ist hinterlegt.';
 if(item.kind==='artifact') {
  const title=friendlyFileTitle(item.entry?.name||item.title);
  const short=title.length>24?title.slice(0,23).trimEnd()+'…':title;
  return `Machen wir bei „${short}“ weiter?`;
 }
 return ({request:'Hier brauche ich kurz deine Rückmeldung.',notice:'Schauen wir uns das kurz zusammen an?',report:'Dein Ergebnis ist da. Wollen wir reinschauen?',job:'Das steht als Nächstes an.',weather:'Für welchen Ort möchtest du das Wetter sehen?',chat:'Ich habe eine neue Antwort für dich.',prompt:'Was möchtest du heute mit mir angehen?'})[item.kind] || fallback;
}
export function headlinesForItem(item, fallback) {
 const first=headlineForItem(item,fallback);
 if(!item)return [first];
 const detail=({request:'Mit deiner Antwort können wir weitermachen.',notice:'Den Hinweis findest du auf der Karte.',report:'Dein Ergebnis liegt hier zum Ansehen bereit.',artifact:'Der letzte Stand liegt hier für dich bereit.',job:'Die Einzelheiten findest du auf der Karte.',weather:item.weatherConfigured?'Wetter und Ort findest du in deinem Profil.':'Deinen Ort kannst du im Profil festlegen.',chat:'Wir können direkt daran anknüpfen.',prompt:'Wir können mit einer kleinen Idee anfangen.'})[item.kind];
 return detail&&detail!==first?[first,detail]:[first];
}
