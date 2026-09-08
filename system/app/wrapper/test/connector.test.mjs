import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { invokeConnection } from "../integrations.mjs";
test("workflow forwards exact payload and records metadata, not content", async (t) => {
  let got;
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    got = JSON.parse(raw);
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const entry = {
    id: "test",
    kind: "webhook",
    url: "http://127.0.0.1:" + server.address().port,
  };
  const records = [];
  const payload = { instructions: "Dummy data only", runId: "run-1" };
  const result = await invokeConnection(
    { state: { connections: [entry] } },
    "test",
    payload,
    async (...r) => records.push(r),
    { internalUrls: [entry.url] },
  );
  assert.deepEqual(got, payload);
  assert.equal(result.status, 200);
  assert.equal(records[0][0], "connector");
  assert.equal(records[0][1].connectionId, "test");
  assert.equal(records[0][1].instructions, undefined);
});
test("link-only connectors cannot execute workflows", async () => {
  await assert.rejects(
    invokeConnection(
      {
        state: {
          connections: [{ id: "x", kind: "link", url: "http://localhost" }],
        },
      },
      "x",
      {},
      () => {},
    ),
    /keine Workflow/,
  );
});
test("redirects cannot forward workflow bodies and credentials to another endpoint", async (t) => {
  let targetHit = false;
  const server = http.createServer((req, res) => {
    if (req.url === "/start") {
      res.writeHead(307, { location: "/target" });
      res.end();
    } else {
      targetHit = true;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  await assert.rejects(
    invokeConnection(
      {
        state: {
          connections: [
            {
              id: "x",
              kind: "webhook",
              url: "http://127.0.0.1:" + server.address().port + "/start",
            },
          ],
        },
      },
      "x",
      {},
      async () => {},
      { internalUrls: ["http://127.0.0.1:" + server.address().port + "/start"] },
    ),
  );
  assert.equal(targetHit, false);
});
