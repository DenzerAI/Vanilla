import {chatScrollMotion} from './design-system.mjs';

// One interruptible animation per pane. Only deliberate downward input or the
// latest button resumes following; layout/anchoring events cannot do so.
export function createChatScroll(element, following, onAway, Observer = ResizeObserver, options = {}) {
  const request = options.requestFrame || requestAnimationFrame;
  const cancel = options.cancelFrame || cancelAnimationFrame;
  const now = options.now || (() => performance.now());
  const reduced = options.reducedMotion || (() =>
    element.ownerDocument.documentElement.dataset.reduceMotion === 'on' ||
    element.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let lastTop = element.scrollTop, content, touchY, frame = null, previous = null;
  let lastFollowing = following.current, downwardUntil = 0, pointerDown = false, disposed = false;
  const maxTop = () => Math.max(0, element.scrollHeight - element.clientHeight);
  const isStart = () => content?.matches?.('.chat-start');
  function stop() {
    if (frame !== null) cancel(frame);
    frame = null;
    previous = null;
  }
  function setFollowing(value) {
    following.current = lastFollowing = value;
    element.style.overflowAnchor = value ? 'none' : 'auto';
    onAway(!value);
    if (!value) stop();
  }
  function pause() {
    downwardUntil = 0;
    if (!isStart()) setFollowing(false);
  }
  function movedUp() {
    // Browser clamping after tool collapse is not upward user input.
    return element.scrollTop < Math.min(lastTop, maxTop()) - 1;
  }
  function write(top) {
    element.scrollTop = top;
    lastTop = element.scrollTop;
  }
  function tick(time) {
    frame = null;
    if (disposed || !following.current || !element.clientHeight || isStart()) { stop(); return; }
    // A native scrollbar movement may precede its queued scroll event.
    if (movedUp()) { pause(); lastTop = element.scrollTop; return; }
    const target = maxTop(), distance = target - element.scrollTop;
    if (reduced() || Math.abs(distance) <= chatScrollMotion.settle) {
      write(target); previous = null; return;
    }
    const delta = previous === null ? 16 : Math.min(chatScrollMotion.maxFrame, time - previous);
    previous = time;
    const step = Math.min(Math.abs(distance), Math.max(1, Math.abs(distance) * (1 - Math.exp(-delta / chatScrollMotion.response))));
    write(element.scrollTop + Math.sign(distance) * step);
    frame = request(tick);
  }
  function schedule() {
    if (frame === null && following.current && element.clientHeight && !disposed) frame = request(tick);
  }
  const observer = new Observer(() => sync());
  observer.observe(element);
  function sync() {
    if (disposed) return;
    const changed = content !== element.firstElementChild;
    if (changed) {
      stop();
      if (content) observer.unobserve(content);
      content = element.firstElementChild;
      if (content) observer.observe(content);
    }
    if (!element.clientHeight) { stop(); return; }
    if (isStart()) {
      stop(); element.style.overflowAnchor = 'none'; onAway(false);
      if (changed) write(0);
      lastTop = element.scrollTop;
      return;
    }
    const explicitResume = following.current && !lastFollowing;
    if (explicitResume) { downwardUntil = 0; lastTop = element.scrollTop; }
    if (!changed && !explicitResume && following.current && movedUp()) pause();
    setFollowing(following.current);
    if (following.current) {
      if (changed || reduced()) { stop(); write(maxTop()); }
      else schedule();
    } else if (changed) lastTop = element.scrollTop;
  }
  function scroll() {
    if (isStart()) return;
    const top = element.scrollTop;
    if (movedUp()) pause();
    else if (!following.current && top > lastTop + 1 && maxTop() - top <= 2 &&
      (now() < downwardUntil || pointerDown)) {
      setFollowing(true); downwardUntil = 0; schedule();
    }
    lastTop = top;
  }
  const down = () => { downwardUntil = now() + chatScrollMotion.inputWindow; };
  const wheel = event => { if (event.deltaY < 0) pause(); else if (event.deltaY > 0) down(); };
  const touchStart = event => { touchY = event.touches[0]?.clientY; };
  const touchMove = event => {
    const y = event.touches[0]?.clientY;
    if (y > touchY) pause(); else if (y < touchY) down();
    touchY = y;
  };
  const key = event => {
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) pause();
    else if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) down();
  };
  const pointerStart = event => {
    const rect = element.getBoundingClientRect();
    pointerDown = event.pointerType === 'mouse' && (event.clientX >= rect.right - 16 || event.clientX <= rect.left + 16);
    if (pointerDown) pause();
  };
  const pointerEnd = () => { pointerDown = false; };
  const listeners = {scroll, wheel, touchstart:touchStart, touchmove:touchMove, keydown:key, pointerdown:pointerStart};
  for (const [name, listener] of Object.entries(listeners)) element.addEventListener(name, listener, {passive:true});
  const doc = element.ownerDocument;
  doc?.addEventListener('pointerup', pointerEnd, {passive:true});
  doc?.addEventListener('pointercancel', pointerEnd, {passive:true});
  return {
    element, sync,
    resume() { downwardUntil = 0; lastTop = element.scrollTop; setFollowing(true); schedule(); },
    dispose() {
      disposed = true; stop(); observer.disconnect();
      for (const [name, listener] of Object.entries(listeners)) element.removeEventListener(name, listener);
      doc?.removeEventListener('pointerup', pointerEnd);
      doc?.removeEventListener('pointercancel', pointerEnd);
    },
  };
}
