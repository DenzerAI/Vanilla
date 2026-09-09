// The app also owns empty and export-only chats with no persisted native rollout.
// Only that specific absence is harmless; connection and storage errors still fail.
export function chatArchiveUpdater({store, workers, active, turnLocks, voiceSessions, loaded, restartGate, emit}) {
  return async function updateChat(id, change) {
    const chat = store.chat(id);
    if (change.archived !== undefined && typeof change.archived !== 'boolean')
      throw new Error('Der Archivstatus muss wahr oder falsch sein.');
    if (turnLocks.has(id) || restartGate.restarting)
      throw new Error('Bitte die laufende Übertragung abwarten.');
    const archiveChanged = change.archived !== undefined && !!chat.archived !== change.archived;
    if (archiveChanged && (active.has(id) || voiceSessions.has(id)))
      throw new Error('Bitte zuerst die laufende Antwort oder Sprachsession stoppen.');
    turnLocks.add(id);
    const previous = {...chat};
    try {
      if (archiveChanged) {
        try {
          await workers.call(change.archived ? 'thread/archive' : 'thread/unarchive', {threadId:id});
        } catch (error) {
          if (!/^no (?:archived )?rollout found for thread id\s+/i.test(error.message || '')) throw error;
        }
        chat.archived = change.archived;
        loaded.delete(id);
      }
      if (change.title !== undefined) {
        chat.title = String(change.title).trim().slice(0, 160) || 'Neuer Chat';
        chat.titleRevision = (chat.titleRevision || 0) + 1;
        chat.titleStatus = 'manual';
      }
      if (change.pinned !== undefined) chat.pinned = !!change.pinned;
      await store.save();
      emit({method:'wrapper/chats'});
      return chat;
    } catch (error) {
      for (const key of ['archived', 'title', 'titleRevision', 'titleStatus', 'pinned']) {
        if (Object.hasOwn(previous, key)) chat[key] = previous[key];
        else delete chat[key];
      }
      throw error;
    } finally {
      turnLocks.delete(id);
    }
  };
}
