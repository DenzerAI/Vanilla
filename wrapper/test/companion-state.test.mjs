import test from "node:test";
import assert from "node:assert/strict";
import { companionSet, latestActivity, companionSets, companionSetLabel, CALL_MS, DONE_MS, NOD_MS, SLEEP_MS } from "../ui/companion-state.mjs";

const base = { connection: "online", waitingSince: null, busy: false, running: false, activity: null, completedAt: null, lastTurnStatus: "completed", hasTurns: true, idleMs: 0, now: 100_000 };

test("die Figur zeigt den Sitzungsstand in fester Rangfolge", () => {
  assert.equal(companionSet(base), "ruhe");
  assert.equal(companionSet({ ...base, connection: "offline", running: true }), "krank");
  assert.equal(companionSet({ ...base, waitingSince: base.now - 1000, running: true }), "ruft");
  assert.equal(companionSet({ ...base, waitingSince: base.now - CALL_MS, running: true }), "wartet");
  assert.equal(companionSet({ ...base, busy: true }), "isst");
  assert.equal(companionSet({ ...base, running: true }), "arbeitet");
  assert.equal(companionSet({ ...base, running: true, activity: "message" }), "arbeitet");
  assert.equal(companionSet({ ...base, running: true, activity: "reasoning" }), "denkt");
  assert.equal(companionSet({ ...base, running: true, activity: "read" }), "liest");
  assert.equal(companionSet({ ...base, running: true, activity: "web" }), "liest");
  assert.equal(companionSet({ ...base, running: true, activity: "context" }), "fegt");
  assert.equal(companionSet({ ...base, running: true, activity: "agent" }), "jongliert");
  assert.equal(companionSet({ ...base, running: true, activity: "command" }), "arbeitet");
  assert.equal(companionSet({ ...base, completedAt: base.now - DONE_MS + 1 }), "fertig");
  assert.equal(companionSet({ ...base, completedAt: base.now - DONE_MS }), "ruhe");
  assert.equal(companionSet({ ...base, lastTurnStatus: "failed" }), "fehler");
  assert.equal(companionSet({ ...base, hasTurns: false }), "laeuft");
  assert.equal(companionSet({ ...base, idleMs: NOD_MS }), "nickt");
  assert.equal(companionSet({ ...base, idleMs: SLEEP_MS }), "schlaeft");
});

test("die jüngste Tätigkeit des laufenden Turns bestimmt das Set", () => {
  const thread = { turns: [{ id: "t1", items: [{ type: "reasoning" }, { type: "commandExecution", toolName: "bash" }] }] };
  assert.equal(latestActivity(thread, "t1"), "command");
  assert.equal(latestActivity({ turns: [{ id: "t1", items: [{ type: "agentMessage", text: "…" }] }] }, "t1"), "message");
  assert.equal(latestActivity(thread, "missing"), null);
  assert.equal(latestActivity(null, "t1"), null);
});

test("jedes Set hat ein deutsches Label", () => {
  assert.ok(companionSets.length >= 17);
  for (const [id, label] of companionSets) assert.equal(companionSetLabel(id), label);
  assert.equal(companionSetLabel("unbekannt"), "Ruhe");
});
