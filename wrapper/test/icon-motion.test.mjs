import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { iconCatalog } from '../ui/icon-catalog.mjs';
import { iconMotion } from '../ui/design-system.mjs';

// Isolate event/timing policy from SVG geometry. The real geometry is verified separately in DOM/raster checks.
const result = await build({ entryPoints: [new URL('../ui/icon-motion.tsx', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'record-svg-timeline', setup(builder) {
  builder.onLoad({ filter: /icon-animation\.mjs$/ }, () => ({ contents: `export function createIcon(item, options) {
    const record = { name: item.name, options, frames: [], resets: 0 }; globalThis.iconTimelineRecords.push(record);
    return { svg: { childNodes: [] }, frame: t => record.frames.push(t), reset: () => record.resets++ };
  }`, loader: 'js' }));
} }] });
const { installIconMotion, mountIcon, animateIcon } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));

function browser(t, name = 'Plus') {
  const document = new EventTarget(); document.documentElement = { dataset: {} }; document.hidden = false;
  const media = new EventTarget(); media.matches = false; const hover = { matches: true }; const queue = new Map(); let id = 0, changed;
  class Element {
    constructor(name) { this.dataset = { iconName: name }; this.isConnected = true; this.visible = true; this.glyphs = []; this.tagName = name ? 'svg' : 'BUTTON'; this.classList = { contains: value => value === 'ui-icon-spinner' && this.spinner }; }
    getClientRects() { return this.visible ? [{}] : []; }
    getBoundingClientRect() { return { top: this.offscreen ? 900 : 10, left: 10, bottom: this.offscreen ? 920 : 30, right: 30 }; }
    closest(selector) {
      if (selector === 'button, summary, [role="button"], [role="menuitem"], a[href]') return this.button || this;
      if (selector === '[data-icon-preview]') return this.preview ? this : null;
      if (selector.includes('button:disabled') || selector.includes('[aria-disabled')) return (this.button || this).disabled ? this : null;
      return this.excluded || this.button?.excluded ? this : null;
    }
    matches() { return this.disabled; }
    hasAttribute(name) { return name === 'aria-expanded' && this.expanded; }
    getAttribute() { return this.menu ? 'menu' : null; }
    contains(node) { return node === this || node.button === this; }
    querySelectorAll() { return this.glyphs; }
    replaceChildren() {}
  }
  class KeyboardEvent extends Event { constructor(key) { super('keydown'); this.key = key; } }
  const globals = { document, window: { innerHeight: 800, innerWidth: 1200, matchMedia: q => q.includes('hover') ? hover : media }, Element, Node: Element, KeyboardEvent,
    requestAnimationFrame: cb => { queue.set(++id, cb); return id; }, cancelAnimationFrame: n => queue.delete(n), iconTimelineRecords: [],
    MutationObserver: class { constructor(cb) { changed = cb; } observe() {} disconnect() {} } };
  const originals = Object.fromEntries(Object.keys(globals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k,v] of Object.entries(globals)) Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
  const dispose = installIconMotion(), button = new Element(), icon = new Element(name); icon.button = button; button.glyphs.push(icon);
  const unmount = mountIcon(icon,name), record = globals.iconTimelineRecords[0];
  t.after(() => { unmount(); dispose(); for (const [key,descriptor] of Object.entries(originals)) descriptor ? Object.defineProperty(globalThis,key,descriptor) : delete globalThis[key]; });
  const send = (event = new Event('click')) => { Object.defineProperty(event,'target',{value:icon}); document.dispatchEvent(event); };
  const over = (pointerType='mouse', relatedTarget=null) => Object.assign(new Event('pointerover'),{pointerType,relatedTarget});
  const flush = (elapsed=300) => { const callbacks=[...queue.values()]; queue.clear(); callbacks.forEach(cb=>cb(performance.now()+elapsed)); };
  return {document,media,hover,button,icon,record,send,over,flush,unmount,dispose,changed:()=>changed(),KeyboardEvent,queue};
}

test('every actual icon and secondary variant has its own timed motion entry', () => {
  assert.equal(iconCatalog.length,81); assert.equal(new Set(iconCatalog.map(i=>i.name)).size,81);
  assert.equal(iconCatalog.filter(i=>i.source==='Framework7').length,73);
  for (const i of iconCatalog) { assert(iconMotion.durations[i.name] >= 1000); assert(iconMotion.durations[i.name] <= 2100); }
});
test('hover plus click completes the same gesture without cancelling either native action', t => {
  const b=browser(t); let actions=0; b.document.addEventListener('click',()=>actions++);
  b.send(b.over()); b.flush(250); b.send(); b.send(); b.flush(600);
  assert.equal(actions,2); assert.equal(b.record.resets,0); assert.equal(b.record.frames.length,2); assert(b.record.frames[1]>b.record.frames[0]);
  b.flush(3000); assert.equal(b.record.resets,1); assert.equal(b.queue.size,0);
});
test('hover ignores touch, pen, child transitions and click-only preference', t => {
  const b=browser(t); b.send(b.over('touch')); b.send(b.over('pen')); b.send(b.over('mouse',b.icon));
  b.document.documentElement.dataset.iconAnimation='press'; b.send(b.over()); b.flush(); assert.equal(b.record.frames.length,0);
  b.send(); b.flush(); assert.equal(b.record.frames.length,1);
});
test('off and reduced-motion changes restore the original and prevent new gestures', t => {
  const b=browser(t); b.send(); b.flush(); b.document.documentElement.dataset.iconAnimation='off'; b.changed();
  assert.equal(b.record.resets,1); b.send(); b.flush(); assert.equal(b.record.frames.length,1);
  b.document.documentElement.dataset.iconAnimation='hover'; b.send(); b.flush(); b.media.matches=true; b.media.dispatchEvent(new Event('change'));
  assert.equal(b.record.resets,2); b.send(); b.flush(); assert.equal(b.record.frames.length,2);
  b.media.matches=false; b.document.documentElement.dataset.reduceMotion='on'; b.send(); b.flush(); assert.equal(b.record.frames.length,2);
});
test('disabled, hidden, offscreen, unmounted and explicitly excluded icons remain still', t => {
  const b=browser(t); b.button.disabled=true; b.send(); b.button.disabled=false; b.icon.visible=false; b.send();
  b.icon.visible=true; b.icon.offscreen=true; b.send(); b.icon.offscreen=false; b.icon.excluded=true; b.send(); b.icon.excluded=false;
  b.flush(); assert.equal(b.record.frames.length,0); b.send(); b.flush(); b.icon.isConnected=false; b.flush(); assert.equal(b.record.resets,1);
  b.icon.isConnected=true; b.send(); b.unmount(); b.flush(); assert.equal(b.record.resets,2);
});
test('hiding the tab cancels finite motion and does not replay it on return', t => {
  const b=browser(t); b.send(); b.flush(); b.document.hidden=true; b.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(b.record.resets,1); b.document.hidden=false; b.flush(); assert.equal(b.record.frames.length,1);
});
test('stateful disclosures and progress spinners retain their own animation', t => {
  const b=browser(t,'ChevronDown'); b.button.expanded=true; b.send(); b.flush(); assert.equal(b.record.frames.length,0);
  b.button.expanded=false; b.send(); b.flush(); assert.equal(b.record.frames.length,1);
});
test('spinner has no delegated gesture while explicit catalog previews can run', t => {
  const b=browser(t,'LoaderCircle'); b.icon.spinner=true; b.send(); b.flush(); assert.equal(b.record.frames.length,0);
  animateIcon(b.icon,'preview'); b.flush(); assert.equal(b.record.frames.length,1);
});
test('menu arrow keys produce a gesture only for menu triggers and never on repeat', t => {
  const b=browser(t); b.send(new b.KeyboardEvent('ArrowDown')); b.flush(); assert.equal(b.record.frames.length,0);
  b.button.menu=true; const repeat=new b.KeyboardEvent('ArrowDown');repeat.repeat=true;b.send(repeat);b.flush();assert.equal(b.record.frames.length,0);
  b.send(new b.KeyboardEvent('ArrowDown'));b.flush();assert.equal(b.record.frames.length,1);
});
test('ordinary Copy geometry cannot show a pretend clipboard confirmation', t => {
  const b=browser(t,'Copy'); assert.equal(b.record.options.confirmation,false);
  b.send(b.over());b.flush(1400);assert.equal(b.record.frames.at(-1),1);assert.equal(b.record.resets,1);
});
