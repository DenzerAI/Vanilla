// Coalesces streamed text deltas so one token is not one render; other events keep their order.
// Contract: surfaces/chat.md, section Ereignisstrom mit Nachlieferung.
const DELTA_METHODS = new Set(['item/agentMessage/delta', 'item/plan/delta', 'item/commandExecution/outputDelta', 'item/reasoning/summaryTextDelta']);

const defaultSchedule = callback => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : setTimeout(callback, 16);

export function createEventBatcher(apply, {schedule = defaultSchedule} = {}) {
  let pending = [], merged = new Map(), scheduled = false;
  const flush = () => {
    scheduled = false;
    if (!pending.length) return;
    const batch = pending;
    pending = []; merged = new Map();
    for (const event of batch) apply(event);
  };
  return {
    push(event) {
      const params = event?.params || {};
      if (DELTA_METHODS.has(event?.method) && typeof params.delta === 'string') {
        const key = JSON.stringify([event.method, params.threadId, params.turnId, params.itemId, params.summaryIndex ?? null]);
        const existing = merged.get(key);
        if (existing) existing.params.delta += params.delta;
        else {
          const copy = {...event, params: {...params}};
          merged.set(key, copy);
          pending.push(copy);
        }
        if (!scheduled) { scheduled = true; schedule(flush); }
        return;
      }
      flush();
      apply(event);
    },
    flush,
    get pending() { return pending.length; },
  };
}
