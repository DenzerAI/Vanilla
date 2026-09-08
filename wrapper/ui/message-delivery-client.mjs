const prefix = 'agent-message-outbox-v1:';
function changed() { window.dispatchEvent(new Event('message-outbox')); }
export function localMessages(chatId) {
  const messages = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const raw = localStorage.getItem(key);
    if (raw) { const m = JSON.parse(raw); if (m.id === chatId) messages.push(m); }
  }
  return messages;
}
// One key per message prevents different tabs from overwriting each other's outbox.
export function stageMessage(body) {
  localStorage.setItem(prefix + body.messageId, JSON.stringify(body));
  changed();
}
export async function deliverMessage(api, body) {
  const result = await api('/messages', body);
  localStorage.removeItem(prefix + body.messageId);
  changed();
  return result;
}
export function reconcileLocal(messages) {
  let removed = false;
  for (const m of messages) if (localStorage.getItem(prefix + m.id) !== null) {
    localStorage.removeItem(prefix + m.id); removed = true;
  }
  if (removed) changed();
}
