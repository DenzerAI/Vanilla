import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { jobTemplates, jobFromTemplate, filterJobTemplates } from "../job-templates.mjs";
import { Storage } from "../storage.mjs";

test("Alle 16 Hermes-Einträge plus Interview bleiben durchsuchbar", () => {
  const expected = ["morning-brief", "important-mail", "weekly-review", "workday-start", "custom-reminder", "evening-winddown", "news-digest", "bill-renewal-watch", "price-watch", "competitor-watch", "habit-checkin", "hydration-move", "meal-plan", "learn-daily", "gratitude-journal", "on-this-day", "interview"];
  assert.deepEqual(jobTemplates.map(t => t.id).sort(), expected.sort());
  assert.deepEqual(filterJobTemplates("MORGEN", "Tagesplanung").map(t=>t.id), ["morning-brief", "evening-winddown"]);
  assert.equal(filterJobTemplates("xyz-kein-treffer").length, 0);
});

test("Vorlagen durchlaufen echten Ordnervertrag pausiert und ohne geerbte Laufdaten", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "job-templates-"));
  try {
    const store = new Storage(root, path.join(root,"data"));
    await mkdir(path.join(root,"jobs"));
    for (const template of jobTemplates) {
      const draft = jobFromTemplate(template.id);
      assert.equal(draft.id, undefined);
      const saved = await store.saveJob(draft);
      assert.equal(saved.status, "paused");
      assert.equal(saved.lastRun, null);
      assert.equal(saved.connectionId, null);
      if (template.note) assert.equal(saved.schedule.type, "manual");
    }
    assert.equal((await store.jobs()).length, 17);
    const draft = jobFromTemplate("morning-brief");
    draft.schedule.time = "12:00";
    assert.equal(jobFromTemplate("morning-brief").schedule.time, "08:00");
  } finally { await rm(root, {recursive:true,force:true}); }
});
