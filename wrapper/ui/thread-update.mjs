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
