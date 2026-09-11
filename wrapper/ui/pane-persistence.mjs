const prefix = 'chat-panes:v1:';
const validSlot = id => Number.isInteger(id) && id >= 0 && id < 4;
function read(key, storage) {
  try { return JSON.parse((storage ?? globalThis.localStorage).getItem(prefix + key)) || {}; }
  catch { return {}; }
}
export function writePaneState(key, value, storage) {
  try { (storage ?? globalThis.localStorage).setItem(prefix + key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function readPaneLayout(storage) {
  const saved = read('layout', storage);
  const order = Array.isArray(saved.order) ? [...new Set(saved.order.filter(validSlot))] : [];
  if (!order.length) order.push(0);
  const active = order.includes(saved.active) ? saved.active : order[0];
  const weights = {};
  for (const id of order) {
    const value = saved.weights?.[id];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) weights[id] = value;
  }
  return {order, active, weights};
}
export function readPaneSession(slot, storage) {
  const saved = read(`session:${slot}`, storage);
  return {
    chatId: typeof saved.chatId === 'string' && saved.chatId ? saved.chatId : null,
    projectId: typeof saved.projectId === 'string' && saved.projectId ? saved.projectId : 'default',
  };
}
