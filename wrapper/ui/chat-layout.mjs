// Pane identity is independent of the number of columns currently visible.
export const MIN_CHAT_WIDTH = 400;
export function visiblePanes(order, active, width, maximized = false) {
  const capacity = Math.max(1, Math.floor((width + 6) / (MIN_CHAT_WIDTH + 6)));
  const count = maximized ? 1 : Math.min(order.length, capacity);
  if (count >= order.length) return order;
  const index = Math.max(0, order.indexOf(active));
  const start = Math.min(Math.max(0, index - count + 1), order.length - count);
  return order.slice(start, start + count);
}
export function selectPaneCount(order, active, count) {
  const size = Math.max(1, Math.min(4, count));
  const kept = order.includes(active) ? order : [active, ...order];
  if (size < kept.length) {
    const next = kept.slice(0, size);
    if (!next.includes(active)) next[size - 1] = active;
    return next;
  }
  return [...kept, ...[0, 1, 2, 3].filter((id) => !kept.includes(id))]
    .slice(0, size)
    .sort((a, b) => a - b);
}
export function conversationText(thread, title = "Chat") {
  const messages = (thread?.turns || []).flatMap((turn) =>
    (turn.items || []).flatMap((item) => {
      if (item.type === "userMessage")
        return [
          `## Du\n\n${(item.content || []).map((c) => (c.type === "text" ? c.text : c.path ? `[Anhang: ${c.path.split("/").pop()}]` : "[Anhang]")).join("\n")}`,
        ];
      if (item.type === "agentMessage")
        return [`## Agent\n\n${item.text || ""}`];
      return [];
    }),
  );
  return `# ${title}\n\n${messages.join("\n\n")}\n`;
}

// One field spans all visible conversations; hidden drafts do not enable it.
export function sharedParticlesEnabled(mode = 'on', sessions = []) {
  return mode === 'all' || (mode === 'on' && sessions.some(session => session?.welcome));
}
