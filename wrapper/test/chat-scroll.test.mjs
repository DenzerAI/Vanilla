import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatScroll} from '../ui/chat-scroll.mjs';

function pane(height = 600) {
  const events = {};
  let observer;
  const following = {current: true};
  const away = [];
  const element = {
    scrollTop: 0, scrollHeight: 1600, clientHeight: height,
    firstElementChild: {}, style: {},
    addEventListener: (name, listener) => events[name] = listener,
    removeEventListener: name => delete events[name],
  };
  class Observer {
    constructor(callback) { this.resize = callback; observer = this; }
    observe() {} unobserve() {} disconnect() { this.disconnected = true; }
  }
  const controller = createChatScroll(element, following, value => away.push(value), Observer);
  controller.sync();
  return {element, following, controller, events, observer, away};
}

test('streaming and tool height changes follow the bottom without changing intent', () => {
  for (const viewport of [300, 800]) {
    const p = pane(viewport);
    for (const height of [1800, 2450, 1700, 2900, 1850]) {
      p.element.scrollHeight = height;
      // Browsers clamp the offset when a completed tool becomes compact.
      p.element.scrollTop = Math.min(p.element.scrollTop, height - viewport);
      p.events.scroll();
      p.observer.resize();
      assert.equal(p.element.scrollTop, height - viewport);
      assert.equal(p.following.current, true);
    }
  }
});
test('upward input pauses even within the old 150px threshold and before a token arrives', () => {
  const p = pane();
  p.events.wheel({deltaY: -10});
  p.element.scrollTop -= 10;
  p.events.scroll();
  p.element.scrollHeight += 1000;
  p.controller.sync();
  p.observer.resize();
  assert.equal(p.element.scrollTop, 990);
  assert.equal(p.following.current, false);
  assert.equal(p.element.style.overflowAnchor, 'auto');
});
test('manual return to bottom resumes, and the latest button can resume explicitly', () => {
  const p = pane();
  p.events.wheel({deltaY:-100});
  p.element.scrollTop = 600;
  p.events.scroll();
  p.element.scrollTop = 1000;
  p.events.scroll();
  assert.equal(p.following.current, true);
  p.events.wheel({deltaY:-100});
  p.element.scrollTop = 600;
  p.events.scroll();
  p.following.current = true;
  p.controller.sync();
  assert.equal(p.element.scrollTop, 1000);
});
test('touch, keyboard, scrollbar and independent panes preserve user control', () => {
  const a = pane(), b = pane();
  a.events.touchstart({touches:[{clientY:100}]});
  a.events.touchmove({touches:[{clientY:150}]});
  assert.equal(a.following.current, false);
  assert.equal(b.following.current, true);
  b.events.keydown({key:'PageUp', target:{}});
  assert.equal(b.following.current, false);
  const c = pane();
  c.element.scrollTop = 700;
  c.events.scroll();
  assert.equal(c.following.current, false);
});
test('resizing and restoring hidden panes follows only when enabled; disposal removes listeners', () => {
  const p = pane();
  p.element.clientHeight = 0;
  p.observer.resize();
  assert.equal(p.element.scrollTop, 1000);
  p.element.clientHeight = 400;
  p.observer.resize();
  assert.equal(p.element.scrollTop, 1200);
  p.controller.dispose();
  assert.deepEqual(p.events, {});
  assert.equal(p.observer.disconnected, true);
});


test('start screen stays at the top while loading cards and growing attachments, then follows real messages', () => {
  const p = pane();
  p.element.firstElementChild = {matches: selector => selector === '.chat-start'};
  p.controller.sync();
  assert.equal(p.element.scrollTop, 0);
  p.element.scrollHeight = 2200;
  p.element.clientHeight = 260;
  p.observer.resize();
  assert.equal(p.element.scrollTop, 0);
  p.events.wheel({deltaY: -10});
  assert.equal(p.following.current, true);
  p.element.scrollTop = 100;
  p.events.scroll();
  p.observer.resize();
  assert.equal(p.element.scrollTop, 100);
  assert.equal(p.away.at(-1), false);
  p.element.firstElementChild = {};
  p.controller.sync();
  assert.equal(p.element.scrollTop, 1940);
});
