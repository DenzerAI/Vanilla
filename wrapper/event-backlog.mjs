// Numbered event frames with a bounded replay window for reconnecting browsers.
// Contract: surfaces/chat.md, section Ereignisstrom mit Nachlieferung.
export function createEventBacklog({limit = 2000, bytes = 4 * 1024 * 1024, epoch = Date.now().toString(36)} = {}) {
  const frames = [];
  let sequence = 0, size = 0;
  const parse = value => {
    const match = /^([0-9a-z]+)\.(\d+)$/.exec(String(value ?? ''));
    return match && match[1] === epoch ? Number(match[2]) : null;
  };
  return {
    epoch,
    get sequence() { return sequence; },
    next() { sequence += 1; return `${epoch}.${sequence}`; },
    remember(id, line) {
      frames.push({id: parse(id), line});
      size += line.length;
      while (frames.length > limit || size > bytes) size -= frames.shift().line.length;
    },
    // null: unknown, from another server life or outside the window → the caller sends a resync.
    // []: nothing was missed. Otherwise the frames after the given id, in order.
    since(lastId) {
      const last = parse(lastId);
      if (last === null || last > sequence) return null;
      if (last === sequence) return [];
      if (!frames.length || frames[0].id > last + 1) return null;
      return frames.filter(frame => frame.id > last).map(frame => frame.line);
    },
  };
}
