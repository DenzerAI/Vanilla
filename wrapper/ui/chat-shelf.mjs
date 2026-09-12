import {marked} from 'marked';
import {collectChatArtifacts, localFilePath} from './artifact-content.mjs';
import {generatedImageItems, toolImages} from './tool-content.mjs';

// Only successful, structured creation receipts count as jobs. Never parse tool
// arguments or infer an executed action from an assistant's description.
export function shelfJobs(item = {}) {
  if (item.status !== 'completed') return [];
  if (Array.isArray(item.shelfJobs)) return item.shelfJobs;
  const jobs = new Map();
  function visit(value, depth = 0) {
    if (depth > 7 || value == null) return;
    if (typeof value === 'string') {
      if (value.length > 250000) return;
      try { visit(JSON.parse(value), depth + 1); } catch {}
      return;
    }
    if (typeof value !== 'object' || value.isError || value.is_error || (typeof value.exit_code === 'number' && value.exit_code !== 0)) return;
    if (Array.isArray(value)) { value.slice(0,100).forEach(v=>visit(v,depth+1)); return; }
    const job = value.job;
    if (value.created === true && typeof job?.id === 'string' && /^[\w-]{1,150}$/.test(job.id) && typeof job.name === 'string') {
      jobs.set(job.id, {jobId:job.id, name:job.name.slice(0,200)});
    }
    for (const key of ['result','output','content','structuredContent','text']) if (value[key] != null) visit(value[key],depth+1);
  }
  visit(item.result ?? item.output ?? item.toolContent ?? item.contentItems ?? item.aggregatedOutput);
  return [...jobs.values()];
}

export function shelfTime(value) {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const number = Date.parse(value);
  return Number.isFinite(number) ? number : null;
}

export function collectShelfEntries(turns = [], workspace = '', directory = workspace) {
  const entries = new Map();
  const add = (entry) => {
    const previous = entries.get(entry.id);
    if (!previous) entries.set(entry.id,entry);
    else if (entry.time && entry.time !== previous.time) previous.updatedAt = entry.time;
  };
  for (const turn of turns || []) {
    for (const item of turn.items || []) {
      const upload = item.type === 'userMessage';
      const time = shelfTime(item.createdAt ?? item.timestamp ?? (upload ? turn.startedAt : turn.completedAt ?? turn.startedAt));
      const meta = {time, turnId:turn.id, origin:upload?'Hochgeladen':'Ergebnis'};
      const addFile = (value, label, rootRelative = false) => {
        const path = localFilePath(value,workspace,rootRelative ? workspace : directory);
        if (path) add({...meta,id:'file:'+path,kind:'file',path,name:label || path.split('/').pop()});
      };
      if (upload) {
        for (const block of item.content || []) {
          if (block.path) addFile(block.path, null, !block.path.startsWith('/'));
          // This is the existing server's exact non-media attachment envelope.
          const match = block.type === 'text' && /^Angehängte Datei: ([^\n]+)\nLies diese Datei für den Auftrag\.$/.exec(block.text || '');
          if (match) addFile(match[1]);
        }
      }
      if ((upload || item.type === 'agentMessage') && item.phase !== 'commentary' && !['failed','inProgress','interrupted'].includes(item.status) && (upload || !['inProgress','running'].includes(turn.status))) {
        const texts = upload ? (item.content || []).filter(b=>b.type==='text').map(b=>b.text || '') : [item.text || ''];
        for (const text of texts) marked.walkTokens(marked.lexer(text), token => {
          if (!['link','image'].includes(token.type)) return;
          const path = localFilePath(token.href,workspace,directory);
          if (path) { addFile(token.href); return; }
          if (token.type !== 'link' || !/^https?:\/\//i.test(token.href || '') || /^\[?\d+\]?$/.test(token.text || '')) return;
          try {
            const url = new URL(token.href);
            if (url.username || url.password) return;
            add({...meta,id:'link:'+url.href,kind:'link',url:url.href,name:token.text || url.hostname,origin:upload?'Von dir':'Link'});
          } catch {}
        });
      }
      for (const file of collectChatArtifacts([item],workspace,directory)) addFile(file.path, null, true);
      for (const job of shelfJobs(item)) add({...meta,...job,id:'job:'+job.jobId,kind:'job',origin:'Auftrag angelegt'});
      for (const generated of generatedImageItems([item])) {
        if (generated.path || generated.savedPath) continue;
        toolImages(generated).forEach((image,index)=>add({...meta,id:`image:${turn.id}:${item.id}:${index}`,kind:'image',name:`Erzeugtes Bild ${index+1}`,dataUrl:`data:${image.mimeType};base64,${image.data}`,origin:'Ergebnis'}));
      }
    }
  }
  // Transcript order is authoritative, even when historic timestamps are absent.
  return [...entries.values()];
}
