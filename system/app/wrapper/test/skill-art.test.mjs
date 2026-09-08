import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { skillArt } from "../ui/skill-art.mjs";

test("skills use local raster task metaphors independent of provider thumbnails", async () => {
  for (const [name, motif] of [
    ["imagegen", "framed-picture"],
    ["apple-hig-designer", "artist-palette"],
    ["motion-design", "clapper-board"],
    ["spreadsheets:Spreadsheets", "bar-chart"],
    ["pdf:pdf", "page-facing-up"],
    ["unknown", "toolbox"],
  ]) {
    const url = skillArt({
      name,
      interface: { iconLarge: "/unrelated/logo.svg" },
    });
    assert.equal(url, `/skill-icons/${motif}.png`);
    const bytes = await readFile(
      new URL(`../ui/assets/skills/${motif}.png`, import.meta.url),
    );
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  }
});
