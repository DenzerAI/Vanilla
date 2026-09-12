// Meldungen, die die Figur auf der Schreibzeile als Sprechblase zeigt.
// Nur Fakten aus anderen Chats und Hintergrund-Jobs; der eigene Chat zeigt
// seinen Stand über die Figur selbst.
export const NOTE_MS = 20_000;
export const NOTE_LIMIT = 8;

const key = (note) => `${note.kind}:${note.chatId || note.noticeId || note.id}`;

export function addNote(notes, note, now = Date.now()) {
  const next = activeNotes(notes, now).filter((n) => key(n) !== key(note));
  next.push({ ...note, id: note.id || `${key(note)}:${now}`, at: now });
  return next.slice(-NOTE_LIMIT);
}

export function activeNotes(notes, now = Date.now()) {
  return notes.filter((n) => !n.dismissed && now - n.at < NOTE_MS);
}

export function dismissNote(notes, id) {
  return notes.map((n) => (n.id === id ? { ...n, dismissed: true } : n));
}

export function dropChatNotes(notes, chatId, kinds = null) {
  return notes.filter((n) => n.chatId !== chatId || (kinds && !kinds.includes(n.kind)));
}

export function noteText(note, chatTitle) {
  const title = (chatTitle || note.title || "").trim() || "Ein anderer Chat";
  if (note.kind === "done") return `${title} ist fertig`;
  if (note.kind === "failed") return `${title} ist fehlgeschlagen`;
  if (note.kind === "approval") return `${title} braucht eine Freigabe`;
  if (note.kind === "job") return `${title} ist fertig`;
  return title;
}
