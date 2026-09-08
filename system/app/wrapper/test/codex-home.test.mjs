import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readlink,
  readdir,
  rename,
  rm,
  lstat,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { prepareCodexHome } from "../codex-home.mjs";
import { ThreadLoading } from "../thread-loading.mjs";
const id = "01a07778-2e31-7300-80fe-68745ecc93f0";
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uwe-home-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sourceHome = path.join(dir, "source"),
    home = path.join(dir, "wrapper");
  await mkdir(path.join(sourceHome, "sessions/2026/09/06"), {
    recursive: true,
  });
  const relative = `sessions/2026/09/06/rollout-2026-09-06T18-06-00-${id}.jsonl`;
  const text = JSON.stringify({ type: "session_meta", payload: { id } }) + "\n";
  await writeFile(path.join(sourceHome, relative), text);
  return { sourceHome, home, relative, text, chats: [{ id, archived: false }] };
}
test("imports only wrapper histories, keeping runtime stores and locks independent", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.sourceHome, "auth.json"), "test credentials");
  await mkdir(path.join(f.sourceHome, "skills"));
  await mkdir(path.join(f.sourceHome, "thread-writer-locks"));
  await writeFile(path.join(f.sourceHome, "state.sqlite"), "native state");
  await writeFile(
    path.join(
      f.sourceHome,
      "sessions/other-00000000-0000-0000-0000-000000000000.jsonl",
    ),
    "unrelated",
  );
  const result = await prepareCodexHome(f);
  assert.deepEqual(result.imported, [id]);
  assert.equal(await readFile(path.join(f.home, f.relative), "utf8"), f.text);
  assert.equal(
    await readFile(path.join(f.sourceHome, f.relative), "utf8"),
    f.text,
  );
  assert.equal(
    (await lstat(path.join(f.home, f.relative))).isSymbolicLink(),
    false,
  );
  assert.equal(
    await readlink(path.join(f.home, "auth.json")),
    path.join(await realpath(f.sourceHome), "auth.json"),
  );
  const entries = await readdir(f.home);
  assert.equal(entries.includes("state.sqlite"), false);
  assert.equal(entries.includes("thread-writer-locks"), false);
  assert.equal((await readdir(path.join(f.home, "sessions"))).length, 1);
});
test("restart preserves newer wrapper history even after archive/unarchive", async (t) => {
  const f = await fixture(t);
  await prepareCodexHome(f);
  const updated = f.text + '{"type":"event_msg","payload":{"message":"new"}}\n';
  await writeFile(path.join(f.home, f.relative), updated);
  assert.deepEqual((await prepareCodexHome(f)).imported, []);
  assert.equal(await readFile(path.join(f.home, f.relative), "utf8"), updated);
  await mkdir(path.join(f.home, "archived_sessions"));
  const archived = path.join(
    f.home,
    "archived_sessions",
    path.basename(f.relative),
  );
  await rename(path.join(f.home, f.relative), archived);
  assert.deepEqual((await prepareCodexHome(f)).imported, []);
  assert.equal(await readFile(archived, "utf8"), updated);
});
test("archive state survives import and invalid partial logs are not published", async (t) => {
  const f = await fixture(t);
  f.chats[0].archived = true;
  await prepareCodexHome(f);
  assert.equal(
    await readFile(
      path.join(f.home, "archived_sessions", path.basename(f.relative)),
      "utf8",
    ),
    f.text,
  );
  const other = await fixture(t);
  await writeFile(
    path.join(other.sourceHome, other.relative),
    other.text + '{"type":',
  );
  await assert.rejects(prepareCodexHome(other), SyntaxError);
  await assert.rejects(lstat(path.join(other.home, other.relative)), {
    code: "ENOENT",
  });
});
test("simultaneous loads share one writer, errors can retry and disconnect invalidates a pending load", async () => {
  const loader = new ThreadLoading();
  let release,
    calls = 0;
  const load = () => {
    calls++;
    return new Promise((resolve) => (release = resolve));
  };
  const first = loader.ensure(id, load),
    second = loader.ensure(id, load);
  await Promise.resolve();
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  await loader.ensure(id, load);
  assert.equal(calls, 1);
  loader.clear();
  await assert.rejects(
    loader.ensure(id, () => {
      throw new Error("writer busy");
    }),
    /writer busy/,
  );
  const pending = loader.ensure(id, load);
  await Promise.resolve();
  loader.clear();
  release();
  await pending;
  assert.equal(loader.loaded.has(id), false);
  await loader.ensure(id, async () => {
    calls++;
  });
  assert.equal(loader.loaded.has(id), true);
  assert.equal(calls, 3);
});
