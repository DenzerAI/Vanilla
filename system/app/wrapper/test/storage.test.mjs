import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  realpath,
  readFile,
  writeFile,
  symlink,
  rm,
  mkdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Storage, inside } from "../storage.mjs";
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uwe-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = path.join(dir, "workspace");
  const store = new Storage(root, path.join(dir, "state"));
  await store.init();
  return { dir, root, store };
}
test("neutral workspace persists human-readable YAML jobs and instructions", async (t) => {
  const { root, store } = await fixture(t);
  const j = await store.saveJob({
    id: "morning",
    name: "Morning",
    instructions: "# Daily\n\nRead input/ and write output/.",
    schedule: { type: "weekdays", time: "08:30" },
    status: "paused",
  });
  assert.equal(j.worker, "auto");
  const yaml = await readFile(path.join(root, "jobs/morning/job.yaml"), "utf8");
  assert.match(yaml, /version: 1/);
  assert.match(yaml, /type: weekdays/);
  const again = (await store.jobs())[0];
  assert.equal(again.instructions, "# Daily\n\nRead input/ and write output/.");
  assert.deepEqual(again.schedule, { type: "weekdays", time: "08:30" });
  assert.equal(again.status, "paused");
});
test("file access rejects traversal, dotfiles and symlink escape", async (t) => {
  const { root, dir } = await fixture(t);
  await writeFile(path.join(dir, "private"), "secret");
  await symlink(path.join(dir, "private"), path.join(root, "output/link"));
  await assert.rejects(inside(root, "../private"), /außerhalb/);
  await assert.rejects(inside(root, ".env"), /Geschützter/);
  await assert.rejects(inside(root, "output/link"), /außerhalb/);
  assert.equal(
    await inside(root, "input/beispiel.md"),
    await realpath(path.join(root, "input/beispiel.md")),
  );
});
test("job writes reject existing symlink outside workspace", async (t) => {
  const { root, dir, store } = await fixture(t);
  await mkdir(path.join(dir, "external"));
  await symlink(path.join(dir, "external"), path.join(root, "jobs/escape"));
  await assert.rejects(
    store.saveJob({ id: "escape", name: "Escape", instructions: "Test" }),
    /außerhalb/,
  );
});
test("invalid schedules and job names fail instead of silently scheduling", async (t) => {
  const { store } = await fixture(t);
  for (const job of [
    { id: "../escape", name: "X", instructions: "x" },
    {
      name: "X",
      instructions: "x",
      schedule: { type: "daily", time: "25:70" },
    },
    { name: "X", instructions: "x", worker: "unknown" },
  ])
    await assert.rejects(store.saveJob(job));
});
test("external YAML edits are read and malformed jobs are reported", async (t) => {
  const { store, root } = await fixture(t);
  await store.saveJob({ id: "editable", name: "Old", instructions: "Test" });
  await writeFile(
    path.join(root, "jobs/editable/job.yaml"),
    "version: 1\nname: Changed\nworker: codex\nstatus: paused\nschedule:\n  type: manual\n",
  );
  assert.equal((await store.jobs())[0].name, "Changed");
  await writeFile(path.join(root, "jobs/editable/job.yaml"), "invalid: [");
  assert.equal((await store.jobs())[0].status, "invalid");
});
test("overlapping metadata saves retain latest snapshot", async (t) => {
  const { store } = await fixture(t);
  const calls = [];
  for (let i = 0; i < 20; i++) {
    store.state.settings.name = "Uwe " + i;
    calls.push(store.save());
  }
  await Promise.all(calls);
  const disk = JSON.parse(
    await readFile(path.join(store.dataRoot, "state.json"), "utf8"),
  );
  assert.equal(disk.settings.name, "Uwe 19");
});
test("exports include full structured history and portable markdown", async (t) => {
  const { root, store } = await fixture(t);
  const thread = {
    id: "test-chat",
    turns: [
      {
        id: "turn",
        items: [
          {
            id: "u",
            type: "userMessage",
            content: [{ type: "text", text: "Hi" }],
          },
          { id: "a", type: "agentMessage", text: "Hallo" },
        ],
      },
    ],
  };
  await store.exportThread(thread);
  const md = await readFile(
    path.join(root, "chats/test-chat/transcript.md"),
    "utf8",
  );
  assert.match(md, /## Du\n\nHi/);
  assert.match(md, /## Agent\n\nHallo/);
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(root, "chats/test-chat/transcript.json"),
        "utf8",
      ),
    ),
    thread,
  );
});

test("projects persist names, folders and shared identity without renaming existing paths", async (t) => {
  const { root, store } = await fixture(t);
  await store.saveProject({ id: "default", name: "Zentrale" });
  const project = await store.saveProject({ name: "Angebote" });
  const originalPath = project.path;
  assert.match(
    await readFile(path.join(root, project.path, "AGENTS.md"), "utf8"),
    /\.\.\/\.\.\/soul\/IDENTITY\.md/,
  );
  assert.deepEqual(
    (await store.files(project.path))
      .filter((f) => f.directory)
      .map((f) => f.name),
    ["input", "output"],
  );
  await store.saveProject({ id: project.id, name: "Neue Angebote" });
  const again = new Storage(root, store.dataRoot);
  await again.init();
  assert.equal(again.project(project.id).name, "Neue Angebote");
  assert.equal(again.project(project.id).path, originalPath);
  assert.equal(again.state.settings.workspaceName, "Zentrale");
  assert.equal(
    await again.projectRoot(project.id),
    await realpath(path.join(root, originalPath)),
  );
  await assert.rejects(store.saveProject({ name: "  " }));
  await assert.rejects(store.saveProject({ id: "missing", name: "X" }));
});
test("projects reject a symlink out of the shared root before writing", async (t) => {
  const { root, dir, store } = await fixture(t);
  await mkdir(path.join(dir, "external"));
  await symlink(path.join(dir, "external"), path.join(root, "projects"));
  await assert.rejects(store.saveProject({ name: "Escape" }), /außerhalb/);
  assert.equal(store.state.projects.length, 1);
});
test("legacy chats migrate into the existing default workspace", async (t) => {
  const { root, store } = await fixture(t);
  delete store.state.projects;
  store.state.chats.push({ id: "legacy", title: "Existing" });
  store.state.settings.workspaceName = "Bestehend";
  await store.save();
  const again = new Storage(root, store.dataRoot);
  await again.init();
  assert.equal(again.state.chats[0].projectId, "default");
  assert.equal(again.project().name, "Bestehend");
  assert.equal(again.project().path, "");
});

 test("identity name uses soul as source and preserves role on rename", async (t) => {
  const { root, store } = await fixture(t);
  assert.equal(store.state.settings.name, "Agent");
  const file = path.join(root, "soul/IDENTITY.md");
  const original = await readFile(file, "utf8");
  await store.setIdentityName("  Ada  ");
  assert.equal(await readFile(file, "utf8"), original.replace("Anzeigename: Agent", "Anzeigename: Ada"));
  const again = new Storage(root, store.dataRoot);
  await again.init();
  assert.equal(again.state.settings.name, "Ada");
  await writeFile(file, original.replace("Anzeigename: Agent", "Anzeigename: Nova"));
  assert.equal(await again.readIdentity(), "Nova");
  await again.setIdentityName("  ");
  assert.equal(await again.readIdentity(), "Agent");
});
