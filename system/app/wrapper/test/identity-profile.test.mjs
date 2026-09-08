import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Storage } from "../storage.mjs";
import { readAgentProfile, updateAgentProfile } from "../identity-profile.mjs";
import {
  DEFAULT_AGENT_PREFERENCES,
  writePreferences,
  identityInstructions,
} from "../identity-preferences.mjs";
import { conversationInstructions } from "../chat-style.mjs";
const original =
  "# Identität\nAnzeigename: Ada\nAvatar: Standard-Symbol (neutral)\n\n## Rolle\nVertraute Arbeitsregeln erhalten.\n";

test("legacy identities display a default without overwriting existing preferences", () => {
  const p = readAgentProfile(original);
  assert.equal(p.name, "Ada");
  assert.equal(p.avatar, "nori");
  assert.equal(p.avatarColor, "neutral");
  assert.equal(p.avatarConfigured, false);
  assert.equal(p.source, original);
  assert.equal(p.preferences, DEFAULT_AGENT_PREFERENCES);
  assert.equal(
    readAgentProfile(writePreferences(original, "Bitte ausführlich erklären."))
      .preferences,
    "Bitte ausführlich erklären.",
  );
  assert.ok(identityInstructions(original).includes(DEFAULT_AGENT_PREFERENCES));
  const custom = writePreferences(original, "Bitte ausführlich erklären.");
  assert.equal(identityInstructions(custom), custom);
  assert.ok(identityInstructions(writePreferences(original, "")).includes(DEFAULT_AGENT_PREFERENCES));
  assert.equal(conversationInstructions(), "");
  assert.equal(conversationInstructions("Planregel"), "Planregel");
});

test("profile updates preserve role, replace avatar and reject invalid or stale edits", () => {
  const p = readAgentProfile(original);
  const next = updateAgentProfile(original, {
    ...p,
    name: "A$da",
    avatar: "lumi",
  });
  assert.equal(readAgentProfile(next).name, "A$da");
  assert.equal(readAgentProfile(next).avatar, "lumi");
  assert.equal(readAgentProfile(next).avatarConfigured, true);
  assert.ok(next.includes("## Rolle\nVertraute Arbeitsregeln erhalten."));
  assert.throws(() => updateAgentProfile(next, p), /inzwischen/);
  assert.throws(
    () => updateAgentProfile(original, { ...p, avatarColor: "url(invalid)" }),
    /Hintergrundfarben/,
  );
  for (const avatar of ["bad", "https://example.com/x.svg", "<svg/>"])
    assert.throws(
      () => updateAgentProfile(original, { ...p, avatar }),
      /Profilbilder/,
    );
  assert.throws(
    () => updateAgentProfile(original, { ...p, name: "Ada\nAvatar: pixel" }),
    /einer Zeile/,
  );
});

test("profile saves persist across restarts; concurrent stale saves cannot overwrite changes", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-profile-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = path.join(dir, "workspace"),
    data = path.join(dir, "data");
  const store = new Storage(root, data);
  await store.init();
  const file = path.join(root, "soul/IDENTITY.md");
  await writeFile(file, original);
  const p = readAgentProfile(original);
  const results = await Promise.allSettled([
    store.saveIdentityProfile({
      ...p,
      name: "Ada",
      avatar: "kibo",
      avatarColor: "sage",
      preferences: "Sprich ruhig.",
    }),
    store.saveIdentityProfile({ ...p, name: "Veraltet", avatar: "orbit" }),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  const again = new Storage(root, data);
  await again.init();
  assert.equal(again.state.settings.avatar, "kibo");
  assert.equal(again.state.settings.avatarColor, "sage");
  assert.equal(again.state.settings.name, "Ada");
  assert.equal(again.state.settings.avatarConfigured, true);
  assert.equal(
    readAgentProfile(await readFile(file, "utf8")).preferences,
    "Sprich ruhig.",
  );
  const before = await readFile(file, "utf8");
  await assert.rejects(
    store.saveIdentityProfile({
      ...readAgentProfile(before),
      avatar: "invalid",
    }),
  );
  assert.equal(await readFile(file, "utf8"), before);
});
