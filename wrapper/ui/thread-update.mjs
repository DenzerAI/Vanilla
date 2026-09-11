// Preserve completed turns and large tool payloads when a new streaming item arrives.
export function copyThreadForEvent(previous, params) {
  const turns = [...(previous.turns || [])];
  const index = turns.findIndex(turn=>turn.id===params.turnId || turn.id===params.turn?.id);
  const target = index >= 0 ? index : turns.findIndex(turn=>turn.clientPending && params.turn);
  if (target >= 0) {
    const turn = turns[target];
    turns[target] = {...turn,items:(turn.items || []).map(item=>item.id===params.itemId
      ? {...item,...(item.summary ? {summary:[...item.summary]} : {})}
      : item)};
  }
  return {...previous,turns};
}

function messageText(item) {
  if (typeof item?.text === 'string') return item.text;
  return (item?.content || []).filter(part => part?.type === 'text').map(part => part.text || '').join('\n');
}

function sameMessage(a, b) {
  if (!a || !b || a.type !== b.type || !['userMessage', 'agentMessage', 'plan', 'reasoning'].includes(a.type)) return false;
  const left = messageText(a), right = messageText(b);
  if (!left && !right) return false;
  return left.startsWith(right) || right.startsWith(left);
}

// Background snapshots may predate streamed items or fall back to a saved transcript.
// Explicit history edits still replace the thread directly at their action handler.
export function reconcileThreadSnapshot(current, incoming) {
  if (!current || current.id !== incoming?.id) return incoming;
  const previous = new Map((current.turns || []).map(turn => [turn.id, turn]));
  const turns = (incoming.turns || []).map(turn => {
    const old = previous.get(turn.id);
    previous.delete(turn.id);
    if (!old) return turn;
    const items = new Map((old.items || []).map(item => [item.id, item]));
    // Streamed items carry provider ids (msg_…); the saved transcript renumbers them (item-N).
    // Match by id first, then by content, so one answer is never shown twice.
    const counterpart = item => items.get(item.id)
      || [...items.values()].find(live => live.id !== item.id && sameMessage(live, item));
    const merged = (turn.items || []).map(item => {
      const live = counterpart(item);
      if (live) items.delete(live.id);
      // A late read must not truncate an answer already shown by the event stream.
      return live && typeof live.text === 'string' && typeof item.text === 'string'
        && live.text.length > item.text.length && live.text.startsWith(item.text) ? live : item;
    });
    merged.push(...[...items.values()].filter(item => !item.clientPending));
    return {...old, ...turn, items:merged,
      status:old.status && old.status !== 'inProgress' && turn.status === 'inProgress' ? old.status : turn.status};
  });
  // Missing turns in a cached response are not a deletion instruction.
  const missing = [...previous.values()].filter(turn => !turn.clientPending);
  const order = new Map((current.turns || []).map((turn,index) => [turn.id,index]));
  return {...current, ...incoming, turns:[...turns,...missing].sort((a,b)=>(order.get(a.id) ?? Infinity)-(order.get(b.id) ?? Infinity))};
}
