import {activityDetailLabel, changeStats} from './ui/activity-detail.mjs';
import {generatedImageItems} from './ui/tool-content.mjs';

// This projection is exclusively for the browser. Native history is never changed.
export function browserThread(thread) {
  return {...thread, turns:(thread.turns || []).map(turn=>({...turn, items:(turn.items || []).map(item=>{
    if (!item.id || item.status === 'inProgress' || ['userMessage','agentMessage','plan','reasoning'].includes(item.type)
      || JSON.stringify(item).length <= 4096 || generatedImageItems([item]).length) return item;
    const summary = {};
    for (const key of ['id','type','status','server','tool','toolName','name','workerId','path','savedPath']) {
      if (item[key] !== undefined) summary[key] = item[key];
    }
    if (Array.isArray(item.artifacts)) summary.artifacts = item.artifacts.map(({path,name})=>({path,name}));
    if (Array.isArray(item.changes)) summary.changes = item.changes.map(({path,kind})=>({path,kind}));
    return {...summary, detailsDeferred:true,
      displayLabel:activityDetailLabel(item, false),
      displayLiveLabel:activityDetailLabel(item, true),
      displayDiffStats:changeStats(item.changes || [])};
  })}))};
}

export function threadItem(thread, turnId, itemId) {
  const item = thread?.turns?.find(turn=>turn.id===turnId)?.items?.find(item=>item.id===itemId);
  if (!item) throw new Error('Dieser Arbeitsschritt ist nicht mehr vorhanden. Bitte den Chat erneut öffnen.');
  return {item};
}

// Full histories can exceed the core event-frame limit. Keep the stream usable;
// oversized visual histories are fetched through the existing HTTP resync path.
export function threadEventFrame(event) {
  const projected=event.method === 'wrapper/thread' && event.params?.thread
    ? {...event,params:{...event.params,thread:browserThread(event.params.thread)}} : event;
  const payload=JSON.stringify(projected);
  return `data: ${event.method === 'wrapper/thread' && payload.length > 1900000
    ? JSON.stringify({method:'wrapper/resync'}) : payload}\n\n`;
}
