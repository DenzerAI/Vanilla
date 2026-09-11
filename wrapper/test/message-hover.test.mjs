import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageHover, messageHoverAttribute} from '../ui/message-hover.mjs';

function node(kind, parent = null) {
  const attrs = new Map();
  const self = {
    kind, parent,
    attrs,
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: name => attrs.delete(name),
    hasAttribute: name => attrs.has(name),
    matches: selector => selector.split(',').map(s => s.trim()).includes('.' + kind),
    closest(selector) { let n = self; while (n) { if (n.matches?.(selector)) return n; n = n.parent; } return null; },
  };
  return self;
}

function pane() {
  const events = {}, timers = new Map(); let id = 0;
  let underPointer = null;
  const doc = {elementFromPoint: () => underPointer};
  const element = {
    ownerDocument: doc,
    addEventListener: (name, listener) => events[name] = listener,
    removeEventListener: name => delete events[name],
    contains: () => true,
  };
  const controller = createMessageHover(element, {
    setTimeout: (callback, delay) => { timers.set(++id, {callback, delay}); return id; },
    clearTimeout: key => timers.delete(key),
  });
  const first = node('agent-message'), second = node('user-message-row');
  const textInFirst = node('p', first), textInSecond = node('p', second);
  const settle = () => { const pending = [...timers.values()]; timers.clear(); for (const t of pending) t.callback(); };
  return {events, controller, first, second, textInFirst, textInSecond, timers, settle, setUnderPointer: n => { underPointer = n; }};
}

const marked = n => n.hasAttribute(messageHoverAttribute);

test('the message under the pointer is marked and released when the pointer leaves', () => {
  const p = pane();
  p.events.pointermove({pointerType:'mouse', clientX:10, clientY:20, target:p.textInFirst});
  assert.ok(marked(p.first));
  p.events.pointermove({pointerType:'mouse', clientX:10, clientY:60, target:p.textInSecond});
  assert.ok(!marked(p.first));
  assert.ok(marked(p.second));
  p.events.pointerleave();
  assert.ok(!marked(p.second));
  assert.equal(p.controller.current, null);
});

test('scrolling hides the row immediately and re-marks the message that settled under the pointer', () => {
  const p = pane();
  p.events.pointermove({pointerType:'mouse', clientX:10, clientY:20, target:p.textInFirst});
  assert.ok(marked(p.first));
  p.events.scroll();
  assert.ok(!marked(p.first), 'stale hover must not survive the scroll');
  p.events.scroll();
  assert.equal(p.timers.size, 1, 'one settle timer per scroll burst');
  p.setUnderPointer(p.textInSecond);
  p.settle();
  assert.ok(marked(p.second));
  assert.ok(!marked(p.first));
});

test('pointer moves during a scroll wait for the settle instead of marking stale targets', () => {
  const p = pane();
  p.events.pointermove({pointerType:'mouse', clientX:10, clientY:20, target:p.textInFirst});
  p.events.scroll();
  p.events.pointermove({pointerType:'mouse', clientX:10, clientY:21, target:p.textInFirst});
  assert.ok(!marked(p.first));
  p.setUnderPointer(null);
  p.settle();
  assert.equal(p.controller.current, null);
});

test('touch contact never marks a message and dispose clears everything', () => {
  const p = pane();
  p.events.pointermove({pointerType:'touch', clientX:10, clientY:20, target:p.textInFirst});
  assert.ok(!marked(p.first));
  p.events.pointermove({pointerType:'mouse', clientX:10, clientY:20, target:p.textInFirst});
  p.events.scroll();
  p.controller.dispose();
  assert.equal(p.timers.size, 0);
  assert.ok(!marked(p.first));
  assert.deepEqual(Object.keys(p.events), []);
});
