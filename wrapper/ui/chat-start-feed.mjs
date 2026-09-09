import {weatherDescription} from './weather-client.mjs';
import {libraryTimestamp} from './library-order.mjs';
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
  const artifact=[...entries].filter(e=>!e.missing && e.projectId===projectId).sort((a,b)=>libraryTimestamp(b)-libraryTimestamp(a))[0];
  const latest=[...reports].sort((a,b)=>b.created_at-a.created_at)[0];
  const newReport=latest?{id:'notice:'+latest.id,kind:'report',title:latest.title.replace(/ · Fertig$/,''),description:previewText(latest.body),noticeId:latest.id}:result.find(i=>i.kind==='report');
  const fileCard=artifact?{id:'artifact:'+artifact.id,kind:'artifact',title:artifact.name,description:`Zuletzt erstellt oder überarbeitet · ${new Date(libraryTimestamp(artifact)).toLocaleString('de-DE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`,entry:artifact}:null;
  const jobCard=nextJob?{id:'job:'+nextJob.id,kind:'job',title:nextJob.name,description:`Geplant: ${new Date(nextJob.nextRun).toLocaleString('de-DE',{weekday:'short',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}`,job:nextJob}:null;
  const urgent=result.filter(i=>i.kind==='request'||i.kind==='notice');
  const candidates=[...urgent.slice(0,2),fileCard,jobCard,artifact?.jobId && artifact.jobId===latest?.job_id?null:newReport,...result.filter(i=>i.kind==='chat'),...urgent.slice(2)].filter(Boolean);
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
export function headlineForItem(item, fallback) {
 if(!item)return fallback;
 if(item.kind==='weather')return item.description==='Dein Ort ist noch nicht eingerichtet.'?'Für dein Wetter fehlt noch dein Ort.':'Hier kannst du deinen Wetterort einstellen.';
 return ({request:'Deine Rückmeldung wird gebraucht.',notice:'Ein Hinweis braucht Aufmerksamkeit.',report:'Ein neues Ergebnis liegt bereit.',artifact:'Hier kannst du direkt weitermachen.',job:'Der nächste Auftrag ist geplant.',weather:'Für dein Wetter fehlt noch dein Ort.',chat:'Eine neue Antwort wartet auf dich.',prompt:'Was möchtest du voranbringen?'})[item.kind] || fallback;
}
export function headlinesForItem(item, fallback) {
 const first=headlineForItem(item,fallback);
 if(!item)return [first];
 const detail=({request:'Öffne die Rückfrage, damit die Arbeit weitergehen kann.',notice:previewText(item.description),report:previewText(item.description),artifact:'Deine letzte Datei liegt hier für dich bereit.',job:item.description,weather:'Du findest den Ort unter Einstellungen → Dein Profil.',chat:'Im Gespräch findest du das Ergebnis und kannst direkt daran anknüpfen.',prompt:'Beschreibe kurz dein Ziel. Den nächsten Schritt planen wir gemeinsam.'})[item.kind];
 return detail&&detail!==first?[first,detail]:[first];
}
