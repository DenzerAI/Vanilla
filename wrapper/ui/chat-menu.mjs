// One order for the single-chat header and every chat in the split view.
const groups = [
  ['new', 'pin', 'rename'],
  ['audio'],
  ['fork', 'compact', 'share'],
  ['open', 'privacy', 'privacy-remove'],
  ['maximize-panel', 'close-panel'],
  ['archive'],
];
export function arrangeChatMenu(items, extraItems = []) {
  const byId = new Map([...items, ...extraItems].map(item => [item.id, item]));
  const result = [];
  for (const group of groups) {
    const entries = group.map(id => byId.get(id)).filter(Boolean);
    for (const [index, item] of entries.entries()) {
      result.push({...item, separatorBefore:result.length > 0 && index === 0});
      byId.delete(item.id);
    }
  }
  // Preserve future actions until they are assigned to a documented group.
  for (const item of byId.values()) result.push({...item, separatorBefore:result.length > 0});
  return result;
}
