export const conversationStarters = [
  {id:'plan',kind:'prompt',title:'Gemeinsam planen',description:'Aus einer Idee den nächsten Schritt machen.',prompt:'Lass uns gemeinsam planen. Frage mich zuerst, was ich erreichen möchte.'},
  {id:'file',kind:'prompt',title:'Eine Datei verstehen',description:'Das Wesentliche finden und besprechen.',prompt:'Ich möchte eine Datei mit dir besprechen. Bitte warte, bis ich sie angehängt habe.'},
  {id:'project',kind:'prompt',title:'Projekt erkunden',description:'Überblick gewinnen und weiterkommen.',prompt:'Gib mir einen kurzen Überblick über dieses Projekt und seine nächsten Schritte.'},
];
/** @param {{requests?: any[], notifications?: any[], chats?: any[], projectId?: string}} options */
export function chatStartFeed({requests=[],notifications=[],chats=[],projectId='default'}={}) {
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
  return result.length?result.slice(0,5):conversationStarters;
}
export function startHeadline(kind, fallback) {
  return ({request:'Hier braucht es kurz dich.',notice:'Das sollten wir uns ansehen.',report:'Etwas Neues für dich.',chat:'Hier können wir weitermachen.'})[kind] || fallback;
}
