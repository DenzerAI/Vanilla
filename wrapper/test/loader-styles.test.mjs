import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';

test('built loader utilities paint shapes, lay out particles and hide accessibility labels', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'));
  const files = new Set(), visited = new Set();
  function visit(key) {
    if (visited.has(key)) return; visited.add(key);
    const chunk = manifest[key];
    for (const css of chunk.css || []) files.add(css);
    for (const dep of chunk.imports || []) visit(dep);
  }
  visit('index.html');
  const entry = {css:[...files]};
  const css = postcss.parse((await Promise.all(entry.css.map(file => readFile(new URL('../dist/' + file, import.meta.url), 'utf8')))).join('\n'));
  const rules = new Map();
  css.walkRules(rule => {
    for (const selector of rule.selectors) {
      const declarations = rules.get(selector) || {};
      rule.walkDecls(({prop,value}) => { declarations[prop] = value; });
      rules.set(selector, declarations);
    }
  });
  // ASCII remains visible without these classes, but graphical loaders disappear.
  for (const [selector, prop, value] of [
    ['.bg-current','background-color','currentColor'],
    ['.grid','display','grid'], ['.flex','display','flex'],
    ['.inline-flex','display','inline-flex'],
    ['.relative','position','relative'], ['.absolute','position','absolute'],
    ['.items-center','align-items','center'],
    ['.justify-center','justify-content','center'], ['.sr-only','position','absolute'],
  ]) assert.equal(rules.get(selector)?.[prop], value, selector);
  assert.ok(rules.get('.rounded-full')?.['border-radius']);
});
