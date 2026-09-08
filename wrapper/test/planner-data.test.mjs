import { test } from "node:test";
import assert from "node:assert/strict";
import { dueCases } from "../ui/planner-data.mjs";
test("due view respects user-defined terminal stages, dates and missing definitions", () => {
  const workflows = [
    {
      id: "custom",
      stages: [
        { id: "working", terminal: false },
        { id: "finished", terminal: true },
      ],
    },
  ];
  const entity = (id, date, stage = "working", next = "Follow up") => ({
    id,
    fields: {
      process: [
        {
          value: { workflow: "custom", stage, due_date: date, next_step: next },
        },
      ],
    },
  });
  const list = [
    entity("today", "2026-09-08"),
    entity("closed", "2026-09-01", "finished"),
    entity("future", "2026-09-09"),
    entity("late", "2026-09-01"),
    entity("unknown", "2026-09-01", "unknown"),
    entity("empty", "2026-09-01", "working", ""),
  ];
  assert.deepEqual(
    dueCases(list, workflows, "2026-09-08").map((e) => e.id),
    ["late", "today"],
  );
  assert.deepEqual(dueCases(list, [], "2026-09-08"), []);
});
