import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { withSkillIcon } from "../skill-icons.mjs";

test("skill icons load original assets but reject package escapes and oversized files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "uwe-skill-icons-"));
  try {
    const dir = path.join(root, "skill");
    await mkdir(dir);
    const file = path.join(dir, "icon.svg");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    await writeFile(file, svg);
    const skill = {
      name: "test",
      path: path.join(dir, "SKILL.md"),
      interface: { iconLarge: file },
    };
    const loaded = await withSkillIcon(skill);
    assert.equal(
      loaded.iconData,
      `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    );
    const outside = path.join(root, "outside.svg");
    await writeFile(outside, svg);
    await symlink(outside, path.join(dir, "linked.svg"));
    for (const iconLarge of [
      outside,
      path.join(dir, "linked.svg"),
      path.join(dir, "missing.svg"),
    ]) {
      assert.equal(
        (await withSkillIcon({ ...skill, interface: { iconLarge } })).iconData,
        undefined,
      );
    }
    await writeFile(file, Buffer.alloc(257 * 1024));
    assert.equal((await withSkillIcon(skill)).iconData, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
