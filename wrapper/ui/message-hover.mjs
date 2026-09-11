// Pointer contact with a message is tracked explicitly instead of relying on :hover.
// Browsers keep a stale :hover while the conversation scrolls under a resting pointer
// (Safari until the next mouse move, Chromium until the scroll settles), so action rows
// of a message that already moved away stayed visible. This marks exactly the message
// under the pointer and re-evaluates it once scrolling has settled.
export const messageHoverSelector = '.agent-message, .user-message-row';
export const messageHoverAttribute = 'data-pointer-hover';
export const messageHoverSettle = 120;

export function createMessageHover(element, options = {}) {
  const selector = options.selector || messageHoverSelector;
  const attribute = options.attribute || messageHoverAttribute;
  const settle = options.settle ?? messageHoverSettle;
  const setTimer = options.setTimeout || setTimeout;
  const clearTimer = options.clearTimeout || clearTimeout;
  const doc = element.ownerDocument;
  let current = null, point = null, timer = null, disposed = false;
  function mark(next) {
    if (next === current) return;
    current?.removeAttribute(attribute);
    current = next || null;
    current?.setAttribute(attribute, '');
  }
  function fromPoint() {
    if (!point) return null;
    const target = doc?.elementFromPoint?.(point.x, point.y);
    return target && element.contains(target) ? target.closest(selector) : null;
  }
  const move = event => {
    if (event.pointerType === 'touch') return;
    point = {x: event.clientX, y: event.clientY};
    if (timer !== null) return; // still scrolling: settle handler decides
    mark(event.target?.closest?.(selector) || null);
  };
  const leave = () => { point = null; mark(null); };
  const scroll = () => {
    if (!point) return;
    mark(null);
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => { timer = null; if (!disposed) mark(fromPoint()); }, settle);
  };
  const listeners = {pointermove:move, pointerleave:leave, pointercancel:leave, scroll};
  for (const [name, listener] of Object.entries(listeners)) element.addEventListener(name, listener, {passive:true});
  return {
    element,
    get current() { return current; },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      mark(null);
      for (const [name, listener] of Object.entries(listeners)) element.removeEventListener(name, listener);
    },
  };
}
