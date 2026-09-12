import test from "node:test";
import assert from "node:assert/strict";
import { companionSet, latestActivity, companionSets, companionSetLabel, CALL_MS, DONE_MS, NOD_MS, SLEEP_MS } from "../ui/companion-state.mjs";

const base = { connection: "online", waitingSince: null, busy: false, running: false, activity: null, completedAt: null, lastTurnStatus: "completed", hasTurns: true, idleMs: 0, now: 100_000 };

test("die Figur zeigt den Sitzungsstand in fester Rangfolge", () => {
  assert.equal(companionSet(base), "ruhe");
  assert.equal(companionSet({ ...base, connection: "offline", running: true }), "krank");
  assert.equal(companionSet({ ...base, waitingSince: base.now - 1000, running: true }), "ruft");
  assert.equal(companionSet({ ...base, waitingSince: base.now - CALL_MS, running: true }), "wartet");
  assert.equal(companionSet({ ...base, busy: true }), "denkt");
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

 test("Leerlauf wechselt kurz die Gesten, echte Arbeit und Rückfragen haben Vorrang", () => {
  for (const hasTurns of [false, true]) {
    assert.equal(companionSet({...base, hasTurns, idleMs: 10000}), "ruhe");
    assert.equal(companionSet({...base, hasTurns, idleMs: 42000}), "spielt");
    assert.equal(companionSet({...base, hasTurns, idleMs: 82000}), "isst");
    assert.equal(companionSet({...base, hasTurns, idleMs: 114000}), "tanzt");
    assert.equal(companionSet({...base, hasTurns, idleMs: NOD_MS}), "nickt");
    assert.equal(companionSet({...base, hasTurns, idleMs: SLEEP_MS}), "schlaeft");
    assert.equal(companionSet({...base, hasTurns, idleMs: 82000, running: true, busy: true, activity: "read"}), "liest");
    assert.equal(companionSet({...base, hasTurns, idleMs: SLEEP_MS, waitingSince: base.now}), "ruft");
  }
});

test("ruhige Gesten enden wieder im Stand und verdecken keine echte Arbeit", () => {
  for (const [seconds, gesture] of [[16,"atmet"],[32,"wippt"],[56,"hockt"],[68,"streckt"],[100,"schaut"],[132,"nicktzu"]]) {
    assert.equal(companionSet({...base, idleMs: seconds * 1000}), gesture);
    assert.equal(companionSet({...base, idleMs: (seconds + 4) * 1000}), "ruhe");
    assert.equal(companionSet({...base, idleMs: seconds * 1000, running:true, activity:"read"}), "liest");
    assert.equal(companionSet({...base, idleMs: seconds * 1000, waitingSince:base.now}), "ruft");
  }
});

test("alle Gesichter haben eine geschlossene Grundfläche und zwei getrennte Augen", async () => {
  const {readFile} = await import("node:fs/promises");
  for (const name of ["lumi","nori","miko","orbit","pixel","kibo"]) {
    const svg = await readFile(new URL(`../ui/assets/avatars/faces/${name}.svg`, import.meta.url), "utf8");
    const rectangles = text => [...text.matchAll(/<rect\b([^>]*)\/?>/g)].map(([,attributes]) => Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value]) => [key, ["x","y","width","height"].includes(key)?Number(value):value])));
    const face = svg.split('<g class="bodyg">')[1].split('<g class="eyes">')[0];
    const paint = rectangles(face).filter(rect => !rect.class);
    const eyes = rectangles(svg).filter(rect => rect.class === "eye");
    const closed = rectangles(svg).filter(rect => rect.class === "eyec");
    assert.equal(eyes.length, 2, name);
    assert.equal(closed.length, 2, name);
    assert.ok(closed[0].x + closed[0].width < closed[1].x, `${name}: closed eyes must remain separate`);
    for (const eye of eyes) {
      for(let x=eye.x; x<eye.x+eye.width; x++) for(let y=eye.y; y<eye.y+eye.height; y++)
        assert.ok(paint.some(rect => x>=rect.x && x<rect.x+rect.width && y>=rect.y && y<rect.y+rect.height), `${name}: uncovered eye hole at ${x},${y}`);
    }
  }
});
