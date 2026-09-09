import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { themes, renderDesignCSS } from "../ui/design-system.mjs";
function luminance(hex) {
  const c = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a, b) {
  const l = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (l[0] + 0.05) / (l[1] + 0.05);
}
test("CI text and status colors meet 4.5:1 in both themes", () => {
  for (const [theme, p] of Object.entries(themes)) {
    for (const text of ["text", "muted", "faint", "accent", "blue"])
      for (const surface of [
        "bg",
        "sidebar",
        "surface",
        "raised",
        "input",
        "composer",
      ]) {
        assert.ok(
          contrast(p[text], p[surface]) >= 4.5,
          `${theme} ${text} on ${surface}: ${contrast(p[text], p[surface]).toFixed(2)}`,
        );
      }
    for (const status of ["success", "warning", "danger"])
      assert.ok(
        contrast(p[status], p[`${status}-bg`]) >= 4.5,
        `${theme} ${status}`,
      );
    assert.ok(contrast(p.primary, p["on-primary"]) >= 4.5, `${theme} primary`);
  }
});
test("generated stylesheet stays synchronized and all UI variables resolve", async () => {
  const generated = renderDesignCSS();
  assert.equal(
    await readFile(new URL("../ui/design-tokens.css", import.meta.url), "utf8"),
    generated,
  );
  const css = await readFile(
    new URL("../ui/styles.css", import.meta.url),
    "utf8",
  );
  const definitions = new Set(
    [...`${generated}\n${css}`.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
  );
  for (const [, name] of css.matchAll(/var\((--[\w-]+)/g))
    assert.ok(definitions.has(name), `${name} must have a definition`);
  assert.equal(
    (css.match(/#[0-9a-f]{3,8}\b/gi) || []).length,
    0,
    "UI colors must use the central palette",
  );
});
test("bundled font files are WOFF2 and original licenses ship", async () => {
  for (const name of [
    "InterVariable",
    "InterVariable-Italic",
    "IBMPlexMono-Regular",
  ]) {
    const file = await readFile(
      new URL(`../ui/assets/fonts/${name}.woff2`, import.meta.url),
    );
    assert.equal(file.subarray(0, 4).toString(), "wOF2");
  }
  for (const name of ["Inter", "IBMPlexMono"])
    assert.match(
      await readFile(
        new URL(`../ui/assets/fonts/${name}-LICENSE.txt`, import.meta.url),
        "utf8",
      ),
      /SIL OPEN FONT LICENSE/,
    );
});

test("project colors remain distinguishable on project surfaces in both themes", () => {
  for (const [theme, palette] of Object.entries(themes)) {
    for (const color of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']) {
      for (const surface of ['bg', 'sidebar', 'surface', 'raised'])
        assert.ok(contrast(palette[`project-${color}`], palette[surface]) >= 3, `${theme} ${color} on ${surface}`);
    }
  }
});

// Bot silhouettes must remain legible on every selectable background.
test("agent avatar foregrounds contrast with all backgrounds in both themes", () => {
  for (const [theme, palette] of Object.entries(themes))
    for (const color of ['sand', 'clay', 'sage', 'sky', 'lavender'])
      assert.ok(contrast(palette.text, palette[`avatar-${color}`]) >= 4.5, `${theme} avatar ${color}`);
});

test('all selectable color worlds and accents keep readable text and distinct surfaces', async () => {
  const {resolveDesign, designTones, designAccents} = await import('../ui/design-system.mjs');
  for (const mode of ['light','dark']) for (const tone of designTones) for (const accent of designAccents) {
    const palette=resolveDesign(mode,tone.id,accent.id);
    for (const text of ['text','muted','faint','accent','blue']) for(const surface of ['bg','sidebar','surface','raised','input','composer','workspace-panel-bg','glass'])
      assert.ok(contrast(palette[text],palette[surface])>=4.5,`${mode}/${tone.id}/${accent.id}: ${text} on ${surface}`);
    assert.notEqual(palette.bg,palette.surface);
    assert.equal(palette['switch-on'],themes[mode]['switch-on']);
  }
  assert.deepEqual(resolveDesign('invalid','invalid','invalid'),resolveDesign());
});


test('light surfaces retain visible depth in every color world', async () => {
  const {resolveDesign, designTones} = await import('../ui/design-system.mjs');
  for (const tone of designTones) {
    const p = resolveDesign('light', tone.id);
    assert.equal(p['workspace-backdrop'], p.bg, 'actual app shell matches the paper background');
    for (const surface of ['sidebar', 'workspace-panel-bg']) {
      assert.ok(luminance(p.bg) - luminance(p[surface]) >= 0.08, `${tone.id}: ${surface} separates from chat`);
      assert.ok(luminance(p.glass) - luminance(p[surface]) >= 0.1, `${tone.id}: menu separates from ${surface}`);
    }
    assert.ok(Number(p['particle-opacity']) > Number(themes.dark['particle-opacity']));
  }
});
