// One scroll owner per pane. Layout changes never decide whether the user
// wants to follow; upward input pauses immediately, before the next token.
export function createChatScroll(element, following, onAway, Observer = ResizeObserver) {
  let lastTop = element.scrollTop;
  let content;
  let touchY;
  const maxTop = () => Math.max(0, element.scrollHeight - element.clientHeight);
  const setFollowing = (value) => {
    following.current = value;
    element.style.overflowAnchor = value ? 'none' : 'auto';
    onAway(!value);
  };
  const observer = new Observer(() => sync());
  observer.observe(element);
  function sync() {
    const changed = content !== element.firstElementChild;
    if (changed) {
      if (content) observer.unobserve(content);
      content = element.firstElementChild;
      if (content) observer.observe(content);
    }
    // Hidden panes retain their position and resume when measurable again.
    if (!element.clientHeight) return;
    // The start screen has no latest message to follow. Keep its top stable
    // when cards load or attachments increase the composer height.
    if (content?.matches?.('.chat-start')) {
      element.style.overflowAnchor = 'none';
      onAway(false);
      if (changed) element.scrollTop = 0;
      lastTop = element.scrollTop;
      return;
    }
    setFollowing(following.current);
    if (following.current) element.scrollTop = maxTop();
    lastTop = element.scrollTop;
  }
  function scroll() {
    if (content?.matches?.('.chat-start')) return;
    const top = element.scrollTop;
    // Shrinking tool output can clamp scrollTop without any user input.
    const expected = Math.min(lastTop, maxTop());
    if (top < expected - 1) setFollowing(false);
    else if (top > lastTop + 1 && maxTop() - top <= 24) setFollowing(true);
    lastTop = top;
  }
  const pause = () => { if (!content?.matches?.('.chat-start')) setFollowing(false); };
  const wheel = (event) => { if (event.deltaY < 0) pause(); };
  const touchStart = (event) => { touchY = event.touches[0]?.clientY; };
  const touchMove = (event) => {
    const y = event.touches[0]?.clientY;
    if (y > touchY) pause();
    touchY = y;
  };
  const key = (event) => {
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) pause();
  };
  const listeners = {scroll, wheel, touchstart: touchStart, touchmove: touchMove, keydown: key};
  for (const [name, listener] of Object.entries(listeners)) element.addEventListener(name, listener, {passive: true});
  return {
    element,
    sync,
    dispose() {
      observer.disconnect();
      for (const [name, listener] of Object.entries(listeners)) element.removeEventListener(name, listener);
    },
  };
}
