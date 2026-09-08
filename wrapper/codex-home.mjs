import path from "node:path";
import os from "node:os";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  stat,
  lstat,
  symlink,
  realpath,
  link,
  unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Never share the host's global AGENTS.md: it carries the host user's own
// agent instructions and identity, this product brings its own.
const shared = [
  "auth.json",
  "config.toml",
  "skills",
  "plugins",
  "rules",
  "hooks.json",
  ".credentials.json",
  ".tmp/bundled-marketplaces",
];
const buckets = ["sessions", "archived_sessions"];
async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function rollouts(home) {
  const files = new Map();
  async function walk(relative) {
    let entries;
    try {
      entries = await readdir(path.join(home, relative), {
        withFileTypes: true,
      });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const file = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        const id = entry.name.match(/-([0-9a-f-]{36})\.jsonl$/i)?.[1];
        if (id) files.set(id, file);
      }
    }
  }
  for (const bucket of buckets) await walk(bucket);
  return files;
}

// Only runtime state is private. Keep the installed account, configuration and
// extensions available without sharing SQLite, rollouts or writer locks.
export async function prepareCodexHome({
  home,
  sourceHome = null,
  chats = [],
}) {
  await mkdir(home, { recursive: true, mode: 0o700 });
  home = await realpath(home);
  if (!sourceHome) return {home, config: {}, imported: []};
  try { sourceHome = await realpath(sourceHome); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { home, config: {}, imported: [] };
  }
  if (home === sourceHome)
    throw new Error("Der Wrapper benötigt eine eigene Codex-Sitzungsablage.");
  for (const name of shared) {
    const source = path.join(sourceHome, name),
      target = path.join(home, name);
    if ((await exists(source)) && !(await exists(target))) {
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await symlink(source, target);
    }
  }
  // Bundled marketplace policy resolves against the canonical runtime home.
  // Rebase its source without modifying the user's shared configuration.
  const config = {};
  for (const name of ["openai-bundled", "openai-bundled-alpha"]) {
    const source = path.join(home, ".tmp/bundled-marketplaces", name);
    if (await exists(source)) config[`marketplaces.${name}.source`] = source;
  }
  const imported = [],
    existing = await rollouts(home);
  const missing = chats.filter((chat) => !existing.has(chat.id));
  if (!missing.length) return { home, imported, config };
  const sources = await rollouts(sourceHome);
  for (const chat of missing) {
    const relative = sources.get(chat.id);
    if (!relative) continue; // Export-only chats remain readable via transcript.json.
    const source = path.join(sourceHome, relative);
    const before = await stat(source),
      data = await readFile(source),
      after = await stat(source);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
      throw new Error(
        `„${chat.title || "Chat"}“ wird gerade geschrieben. Die Sitzungsübernahme kann nach Abschluss erneut gestartet werden.`,
      );
    const lines = data.toString("utf8").trimEnd().split("\n");
    // Refuse a partial snapshot; never damage or move the source session.
    for (const line of lines) JSON.parse(line);
    const metadata = JSON.parse(lines[0]);
    if (metadata.type !== "session_meta" || metadata.payload?.id !== chat.id)
      throw new Error("Die Sitzungsdatei passt nicht zum ausgewählten Chat.");
    const destination = chat.archived
      ? path.join(home, "archived_sessions", path.basename(relative))
      : path.join(
          home,
          relative.startsWith("archived_sessions/")
            ? path.join("sessions", path.basename(relative))
            : relative,
        );
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const temp = destination + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temp, data, { mode: 0o600, flag: "wx" });
      // Publish atomically without overwriting a session another start imported.
      try {
        await link(temp, destination);
        imported.push(chat.id);
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
  return { home, imported, config };
}
