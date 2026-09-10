import {saveHandoff, joinHandoff} from './chat-handoff.mjs';
import {briefingText} from './ui/planner-briefings.mjs';

// One durable conversation per report, including simultaneous clicks in two windows.
export function briefingChatOpener({store, newChat, cache, emit, updateChat}) {
  const pending = new Map();
  return function open(item, selection = {}) {
    if (pending.has(item.id)) return pending.get(item.id);
    const work = (async () => {
      const existing = store.state.chats.find(c => c.briefingId === item.id);
      if (existing) {
        if (existing.archived) await updateChat(existing.id, {archived:false});
        return {thread:{id:existing.id}};
      }
      const result = await newChat({title:item.title + (item.demo ? ' · Beispiel' : '') + ' · ' + new Date(item.created_at*1000).toLocaleDateString('de-DE'),
        ...selection, projectId:item.projectId || 'default', cwd:await store.projectRoot(item.projectId || 'default')});
      const chat = store.chat(result.thread.id);
      const snapshot = {id:chat.id, turns:[{id:'briefing-' + item.id, status:'completed',
        startedAt:item.created_at, completedAt:item.created_at,
        items:[{id:'briefing-message-' + item.id, type:'agentMessage', phase:'final', text:briefingText(item)}]}]};
      chat.handoffSnapshot = await saveHandoff(store, chat.id, snapshot);
      chat.briefingId = item.id;
      chat.contextOrigin = 'report';
      const thread = joinHandoff(chat.id, snapshot, result.thread);
      cache.set(chat.id, thread);
      await store.exportThread(thread);
      await store.save();
      emit({method:'wrapper/chats'});
      return {thread};
    })().finally(() => pending.delete(item.id));
    pending.set(item.id, work);
    return work;
  };
}
