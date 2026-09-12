import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

test("planner renders both integrated views and keeps examples out of the real-data view", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  await mkdir(path.join(root, ".verify"), { recursive: true });
  const dir = await mkdtemp(path.join(root, ".verify", "planner-render-"));
  const old = globalThis.localStorage;
  try {
    const result = await build({
      entryPoints: [path.join(root, "ui/planner.tsx")],
      bundle: true,
      write: false,
      platform: "node",
      format: "esm",
      packages: "external",
      loader: { ".css": "empty" },
    });
    const file = path.join(dir, "planner.mjs");
    await writeFile(file, result.outputFiles[0].contents);
    const { PlannerPage } = await import(pathToFileURL(file));
    const none = () => {};
    const props = {
      PageHeading: ({ title, children }) =>
        React.createElement(
          "header",
          null,
          React.createElement("h1", null, title),
          children,
        ),
      onSection: none,
      api: () => {
        throw Error("Render must not call an API");
      },
      crmEnabled: false,
      notificationsEnabled: true,
      notifications: { data: { items: [] }, error: "", refresh: none },
      requests: 0,
      onRequests: none,
      onNotifications: none,
      onConnections: none,
      onJobs: none,
      onBriefing: async () => {},
    };
    const render = (section) =>
      renderToStaticMarkup(
        React.createElement(PlannerPage, { ...props, section }),
      );
    globalThis.localStorage = {
      getItem: (key) => (key === "planner.demo" ? "true" : null),
    };
    const today = render("today");
    assert.match(today, /Briefings &amp; Ergebnisse/);
    assert.match(today, /Braucht dich/);
    assert.match(today, /Terminänderung von Alex prüfen/);
    assert.doesNotMatch(today, /Beispielansicht|Briefing &amp; Quellen öffnen/);
    assert.equal((today.match(/class="planner-briefing-row"/g) || []).length, 4);
    const month = render("calendar");
    assert.match(month, /calendar-month-grid/);
    assert.match(month, /data-columns="5"/);
    assert.match(month, /calendar-week-number/);
    assert.doesNotMatch(month, /Wochenenden werden|Uhrzeiten:/);
    assert.match(month, /Termine am ausgewählten Tag/);
    assert.match(month, /Nur Mo/);
    globalThis.localStorage = {
      getItem: (key) => (key === "planner.demo" ? "false" : null),
    };
    for (const view of ["today", "calendar"]) {
      const html = render(view);
      assert.doesNotMatch(html, /Alex|20°|Projekt abstimmen|Beispielort/);
    }
    globalThis.localStorage = {
      getItem: (key) =>
        ({
          "planner.demo": "true",
          "planner.view": "week",
          "planner.workweek": "true",
        })[key] ?? null,
    };
    const week = render("calendar");
    assert.equal((week.match(/class="calendar-time-column"/g) || []).length,5);
    assert.equal((week.match(/class="calendar-hour-slot"/g) || []).length,240);
    assert.match(week, /09:30 hinzufügen/);
    assert.match(week, /23:30 hinzufügen/);
    globalThis.localStorage = {
      getItem: (key) =>
        ({ "planner.demo": "true", "planner.view": "day" })[key] ?? null,
    };
    assert.equal(
      (render("calendar").match(/class="calendar-time-column"/g) || []).length,
      1,
    );
  } finally {
    if (old === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = old;
    await rm(dir, { recursive: true, force: true });
  }
});
