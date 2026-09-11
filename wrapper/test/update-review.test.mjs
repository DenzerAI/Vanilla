import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  installUpdateReviewRoutes,
  highestEffort,
  reviewConfig,
} from "../update-review.mjs";

const report = {
  summary: "Eigene Erweiterung erhalten",
  issues: [],
  preserved: ["Eigenes Modul"],
  needsChanges: false,
};
async function fixture(t, { tool = false, wait = false } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vanilla-review-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const routes = new Map(),
    calls = [];
  const adapter = new EventEmitter();
  adapter.connected = true;
  adapter.call = async (method, params) => {
    calls.push({ method, params });
    if (method === "config/read")
      return {
        config: {
          mcp_servers: { private_connection: {} },
          plugins: { private_plugin: {} },
        },
      };
    if (method === "skills/list")
      return {
        data: [
          {
            skills: [{ path: path.join(directory, "private-skill/SKILL.md") }],
          },
        ],
      };
    if (method === "thread/start") return { thread: { id: "fixture-thread" } };
    if (method === "turn/start") {
      if (!wait)
        setImmediate(() =>
          adapter.emit(
            "notification",
            tool
              ? {
                  method: "item/started",
                  params: {
                    threadId: "fixture-thread",
                    item: { type: "commandExecution" },
                  },
                }
              : {
                  method: "turn/completed",
                  params: {
                    threadId: "fixture-thread",
                    turn: { id: "fixture-turn", status: "completed" },
                  },
                },
          ),
        );
      return { turn: { id: "fixture-turn" } };
    }
    if (method === "thread/read")
      return {
        thread: {
          turns: [
            {
              id: "fixture-turn",
              items: [
                {
                  type: "agentMessage",
                  phase: "final_answer",
                  text: JSON.stringify(report),
                },
              ],
            },
          ],
        },
      };
    return {};
  };
  const workers = {
    catalog: [
      { id: "native", adapter: "codex" },
      { id: "other", adapter: "acp" },
    ],
    settings: { enabled: ["native", "other"] },
    adapters: new Map([["native", adapter]]),
    modelLists: async () => ({
      native: [
        {
          model: "fixture-model",
          displayName: "Fixture",
          supportedReasoningEfforts: [
            { reasoningEffort: "low" },
            { reasoningEffort: "max" },
          ],
        },
      ],
    }),
    start: async (id) => {
      assert.equal(id, "native");
      return adapter;
    },
  };
  installUpdateReviewRoutes({
    route: (m, u, f) => routes.set(m + " " + u, f),
    workers,
    dataRoot: directory,
  });
  return {
    calls,
    adapter,
    run: routes.get("POST /api/system/update-review/run"),
    cancel: routes.get("POST /api/system/update-review/cancel"),
    models: routes.get("GET /api/system/update-review/models"),
  };
}
const request = {
  id: "a".repeat(32),
  text: "Neutral diff",
  worker: "native",
  model: "fixture-model",
  budgetSeconds: 60,
};

test("review selects real highest effort and disables inherited tools and skills", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.models()).models[0].effort, "max");
  const r = await f.run(request);
  assert.deepEqual(r.report, report);
  const start = f.calls.find((c) => c.method === "thread/start").params;
  assert.equal(start.ephemeral, true);
  assert.equal(start.approvalPolicy, "never");
  assert.equal(start.config["mcp_servers.private_connection.enabled"], false);
  assert.equal(start.config["plugins.private_plugin.enabled"], false);
  assert.equal(start.config["skills.config"][0].enabled, false);
  assert.equal(start.config["features.shell_tool"], false);
  assert.equal(start.config.project_doc_max_bytes, 0);
  const turn = f.calls.find((c) => c.method === "turn/start").params;
  assert.equal(turn.effort, "max");
  assert.deepEqual(turn.sandboxPolicy, {
    type: "readOnly",
    networkAccess: false,
  });
  assert.equal(f.adapter.listenerCount("notification"), 0);
});
test("review refuses unsupported model and never substitutes a worker", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    f.run({ ...request, worker: "other" }),
    /gewählte Modell/,
  );
  assert.equal(f.calls.length, 0);
  assert.throws(() =>
    highestEffort({
      supportedReasoningEfforts: [{ reasoningEffort: "invented" }],
    }),
  );
  assert.equal(reviewConfig({})["apps._default.enabled"], false);
});
test("unexpected tools stop the review and interrupt the turn", async (t) => {
  const f = await fixture(t, { tool: true });
  await assert.rejects(f.run(request), /Werkzeugaktion/);
  assert.ok(f.calls.some((c) => c.method === "turn/interrupt"));
  assert.equal(f.adapter.listenerCount("notification"), 0);
});
test("concurrent requests cannot start another review and cancellation interrupts", async (t) => {
  const f = await fixture(t, { wait: true });
  const running = f.run(request);
  const observed = assert.rejects(running, /abgebrochen/);
  await assert.rejects(f.run({ ...request, id: "b".repeat(32) }), /bereits/);
  while (!f.calls.some((c) => c.method === "turn/start"))
    await new Promise((r) => setImmediate(r));
  await f.cancel({ id: request.id });
  await observed;
  assert.ok(f.calls.some((c) => c.method === "turn/interrupt"));
  assert.equal(f.adapter.listenerCount("notification"), 0);
});
