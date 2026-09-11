import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatScroll} from '../ui/chat-scroll.mjs';

function pane(height = 600) {
  const events = {};
  const motion = {reduced:false};
  const frames = new Map(); let clock = 1, frameId = 0;
  const step = () => { clock += 16; const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(clock); };
  const flush = () => { for (let n=0; frames.size && n<300; n++) step(); assert.equal(frames.size, 0); };
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
  const controller = createChatScroll(element, following, value => away.push(value), Observer, {requestFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelFrame:id=>frames.delete(id),now:()=>clock,reducedMotion:()=>motion.reduced});
  controller.sync();
  return {element, following, controller, events, observer, away, step, flush, frames, motion};
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
      p.flush();
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
  p.events.wheel({deltaY:100});
  p.element.scrollTop = 1000;
  p.events.scroll();
  assert.equal(p.following.current, true);
  p.events.wheel({deltaY:-100});
  p.element.scrollTop = 600;
  p.events.scroll();
  p.following.current = true;
  p.controller.sync();
  p.flush();
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
  p.flush();
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


test('stream animation is coalesced and cancelled before upward input gets its scroll event', () => {
  const p = pane();
  p.element.scrollHeight += 800;
  for(let i=0;i<20;i++) p.controller.sync();
  assert.equal(p.frames.size,1);
  assert.equal(p.element.scrollTop,1000);
  p.step();
  assert.ok(p.element.scrollTop>1000 && p.element.scrollTop<1800);
  p.events.wheel({deltaY:-4});
  const reading = p.element.scrollTop - 4;
  p.element.scrollTop = reading;
  p.controller.sync(); p.observer.resize(); p.flush();
  assert.equal(p.element.scrollTop,reading);
  assert.equal(p.following.current,false);
});
test('anchoring near the bottom never resumes following without downward intent', () => {
  const p = pane();
  p.events.wheel({deltaY:-10}); p.element.scrollTop=990; p.events.scroll();
  p.element.scrollTop=1000; p.events.scroll(); // layout/anchor moves the viewport
  assert.equal(p.following.current,false);
  p.element.scrollHeight+=500; p.observer.resize(); p.flush();
  assert.equal(p.element.scrollTop,1000);
});
test('render before a queued scrollbar event cannot overwrite the reading position', () => {
  const p=pane();
  p.element.scrollHeight+=200; p.controller.sync();
  p.element.scrollTop=700;
  p.controller.sync(); p.step();
  assert.equal(p.element.scrollTop,700);
  assert.equal(p.following.current,false);
});
test('latest-button animation stays cancellable and reaches the final streaming target', () => {
  const p=pane();
  p.events.wheel({deltaY:-200}); p.element.scrollTop=500; p.events.scroll();
  p.controller.resume(); p.step();
  assert.ok(p.element.scrollTop>500 && p.element.scrollTop<1000);
  p.events.keydown({key:'Home',target:{}});
  const position=p.element.scrollTop; p.flush();
  assert.equal(p.element.scrollTop,position);
  p.controller.resume(); p.step(); p.element.scrollHeight+=300; p.controller.sync(); p.flush();
  assert.equal(p.element.scrollTop,1300);
});
test('disposing a moving pane cancels pending animation', () => {
  const p=pane(); p.element.scrollHeight+=200; p.controller.sync();
  assert.equal(p.frames.size,1);p.controller.dispose();assert.equal(p.frames.size,0);
});

test('reduced motion applies immediately only while following', () => {
  const p=pane();p.element.scrollHeight+=200;p.controller.sync();
  p.motion.reduced=true;p.step();assert.equal(p.element.scrollTop,1200);
  p.events.wheel({deltaY:-100});p.element.scrollTop=1100;p.events.scroll();
  p.element.scrollHeight+=300;p.controller.sync();assert.equal(p.element.scrollTop,1100);
});
test('a render during downward input still permits deliberate return to the bottom', () => {
  const p=pane();p.events.wheel({deltaY:-200});p.element.scrollTop=700;p.events.scroll();
  p.events.wheel({deltaY:300});p.element.scrollTop=1000;p.controller.sync();p.events.scroll();
  assert.equal(p.following.current,true);
});
