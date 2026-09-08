import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { searchScore, searchText } from './ui/search-match.mjs';

function messages(thread) {
  return (thread?.turns || []).flatMap(turn => (turn.items || []).flatMap(item => {
    if (item.type === 'agentMessage') return [String(item.text || '')];
    if (item.type === 'userMessage') return [(item.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('\n')];
    return [];
  }));
}
function excerpt(text, query) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const terms = searchText(query).trim().split(/\s+/).filter(Boolean);
  const normalized = searchText(clean);
  const hits = terms.map(term => normalized.indexOf(term)).filter(index => index >= 0);
  const start = Math.max(0, (hits.length ? Math.min(...hits) : 0) - 55);
  return (start ? '…' : '') + clean.slice(start, start + 220) + (clean.length > start + 220 ? '…' : '');
}

/** Reads local conversation exports, never starts or resumes a worker. */
export async function searchConversations({workspace, chats, projects = [], threadCache = new Map(), query = '', chatFile = (id,...parts)=>path.join(workspace,'chats',id,...parts)}) {
  query = String(query).trim().slice(0, 160);
  const results = [];
  let unavailable = 0, cursor = 0;
  const candidates = chats.filter(c => !c.channelOnly && c.id && path.basename(c.id) === c.id && !['.', '..'].includes(c.id));
  async function scan() {
    while (cursor < candidates.length) {
      const chat = candidates[cursor++];
      const project = projects.find(p => p.id === (chat.projectId || 'default'));
      const titleScore = searchScore(chat.title, query);
      let text = [], thread = threadCache.get(chat.id);
      if (query) {
        if (!thread) {
          try { thread = JSON.parse(await readFile(chatFile(chat.id, 'transcript.json'), 'utf8')); }
          catch { unavailable++; }
        }
        text = messages(thread);
      }
      const matching = query ? text.find(message => searchScore(message, query)) : '';
      const contentScore = matching ? searchScore(matching, query) : searchScore(text.join('\n'), query);
      const projectScore = query ? searchScore(project?.name || '', query) : 0;
      if (!titleScore && !contentScore && !projectScore) continue;
      results.push({kind:'chat', id:chat.id, title:chat.title, detail:[project?.name, chat.archived ? 'Archiviert' : ''].filter(Boolean).join(' · '), snippet:excerpt(matching || text.join(' '), query), updatedAt:chat.updatedAt || 0, score:titleScore * 3 + contentScore + projectScore});
    }
  }
  await Promise.all(Array.from({length:Math.min(6,candidates.length)}, scan));
  if (query) for (const project of projects) {
    const score = searchScore(project.name, query);
    if (score) results.push({kind:'project', id:project.id, title:project.name, detail:'Projekt', snippet:'', score:score * 2, updatedAt:0});
  }
  results.sort((a,b) => b.score - a.score || b.updatedAt - a.updatedAt);
  return {results:results.slice(0, 50), total:results.length, unavailable};
}
