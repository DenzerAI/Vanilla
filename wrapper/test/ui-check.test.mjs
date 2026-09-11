import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseTarget, viewportFor } from '../../scripts/ui-check.mjs';

test('arguments split into options and ordered steps', () => {
  const { options, steps } = parseArgs(['--viewport', 'mobile', '--wait', 'text=System', '--click', 'label=Senden', '--type', 'hallo', '--press', 'Enter', '--text', '--shot', 'ende', '--out', 'x']);
  assert.equal(options.viewport, 'mobile');
  assert.equal(options.out, 'x');
  assert.deepEqual(steps.map(s => s.kind), ['wait', 'click', 'type', 'press', 'text', 'shot']);
  assert.equal(steps[2].value, 'hallo');
  assert.throws(() => parseArgs(['--unknown']), /Unbekanntes Argument/);
});

test('targets need an explicit locator kind', () => {
  assert.deepEqual(parseTarget('text=Aufträge'), { kind: 'text', value: 'Aufträge' });
  assert.deepEqual(parseTarget('css=.chat-turn'), { kind: 'css', value: '.chat-turn' });
  assert.throws(() => parseTarget('Aufträge'), /text=, css= oder label=/);
});

test('viewports cover desktop, phone and explicit sizes', () => {
  assert.equal(viewportFor('desktop').mobile, false);
  assert.equal(viewportFor('mobile').width, 390);
  assert.deepEqual(viewportFor('600x800'), { width: 600, height: 800, deviceScaleFactor: 2, mobile: true });
  assert.throws(() => viewportFor('riesig'), /Viewport unbekannt/);
});
