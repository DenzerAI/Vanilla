import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dateKey,
  parseDay,
  isoWeek,
  monday,
  monthWeeks,
  shiftMonth,
  sortEvents,
} from "../ui/planner-dates.mjs";
test("ISO weeks cross years without assigning January to the wrong year", () => {
  assert.deepEqual(isoWeek("2021-01-01"), { year: 2020, week: 53 });
  assert.deepEqual(isoWeek("2024-12-30"), { year: 2025, week: 1 });
  assert.equal(monday("2021-01-03"), "2020-12-28");
});
test("month lists contain each day exactly once, respecting leap years and weekdays", () => {
  const all = monthWeeks("2024-02-18").flatMap((w) => w.days);
  assert.equal(all.length, 29);
  assert.equal(new Set(all).size, 29);
  assert.equal(all[0], "2024-02-01");
  assert.equal(all.at(-1), "2024-02-29");
  const weekdays = monthWeeks("2026-08-15", true).flatMap((w) => w.days);
  assert.equal(weekdays.length, 21);
  assert.ok(weekdays.every((d) => ![0, 6].includes(parseDay(d).getDay())));
  assert.equal(weekdays[0], "2026-08-03");
});
test("local day stepping survives both DST boundaries and month clamping", () => {
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(shiftMonth("2024-01-31", 1), "2024-02-29");
  assert.equal(shiftMonth("2025-01-31", 1), "2025-02-28");
  assert.equal(shiftMonth("2026-01-31", -1), "2025-12-31");
  assert.equal(dateKey(parseDay("2026-09-08")), "2026-09-08");
  assert.throws(() => parseDay("2026-02-30"));
  assert.throws(() => parseDay(""));
});
test("all-day entries precede timed entries without mutating the feed", () => {
  const events = [
    {
      id: "late",
      date: "2026-09-08",
      start: "14:00",
      allDay: false,
      title: "B",
    },
    { id: "day-b", date: "2026-09-08", start: "", allDay: true, title: "B" },
    {
      id: "early",
      date: "2026-09-08",
      start: "09:00",
      allDay: false,
      title: "A",
    },
    { id: "day-a", date: "2026-09-08", start: "", allDay: true, title: "A" },
  ];
  assert.deepEqual(
    sortEvents(events).map((e) => e.id),
    ["day-a", "day-b", "early", "late"],
  );
  assert.equal(events[0].id, "late");
});
