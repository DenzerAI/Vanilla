import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalWorkers } from "../local-workers.mjs";
import { GiB, recommend, compatibility } from "../local-device.mjs";
import { localAddress, localURL, localRequest } from "../local-request.mjs";

const hardware = (overrides = {}) => {
  const device = {
    platform: "darwin",
    release: "25.0",
    arch: "arm64",
    chip: "Apple M4",
    memoryBytes: 16 * GiB,
    unified: true,
    gpu: { name: "Apple M4" },
    diskFreeBytes: 100 * GiB,
    ...overrides,
  };
  return { ...device, ...recommend(device) };
};
async function fixture(t, request) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "local-workers-"));
  const worker = new LocalWorkers({
    dataRoot: dir,
    request,
    device: async () => hardware(),
    installed: async () => ({ installed: false }),
  });
  await worker.init();
  t.after(async () => {
    worker.close();
    await worker.queue;
    await rm(dir, { recursive: true, force: true });
  });
  return worker;
}
async function finish(worker, id) {
  for (let i = 0; i < 100; i++) {
    const result = worker.operations.get(id);
    if (result.status !== "running") return result;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Operation never finished");
}
async function serve(t, callback) {
  const server = http.createServer(callback);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

test("hardware recommendations reserve RAM, respect GPU memory and disk, and handle unsupported Macs", () => {
  assert.equal(hardware({ memoryBytes: 8 * GiB }).recommended, "qwen3.5:0.8b");
  assert.equal(hardware().recommended, "qwen3.5:4b");
  assert.equal(hardware({ memoryBytes: 32 * GiB }).recommended, "qwen3.5:9b");
  assert.equal(hardware({ memoryBytes: 4 * GiB }).recommended, null);
  assert.equal(hardware({ diskFreeBytes: 1 * GiB }).recommended, null);
  assert.equal(hardware({ diskFreeBytes: null }).recommended, "qwen3.5:4b");
  assert.equal(
    hardware({ unified: false, gpu: { memoryBytes: 4 * GiB } }).recommended,
    "qwen3.5:0.8b",
  );
  assert.match(
    compatibility("lmstudio", hardware({ arch: "x64" })),
    /Apple Silicon/,
  );
  assert.match(
    compatibility("ollama", hardware({ release: "22.0" })),
    /macOS 14/,
  );
  assert.match(
    compatibility(
      "lmstudio",
      hardware({ platform: "linux", arch: "x64", avx2: false }),
    ),
    /AVX2/,
  );
});

test("local endpoints exclude public IPs, metadata, credentials, arbitrary paths and mixed DNS answers", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.2.3",
    "192.168.1.20",
    "::1",
    "fd00::1",
  ])
    assert.equal(localAddress(ip), true);
  for (const ip of [
    "169.254.169.254",
    "8.8.8.8",
    "0.0.0.0",
    "::ffff:127.0.0.1",
    "fe80::1",
  ])
    assert.equal(localAddress(ip), false);
  for (const url of [
    "file:///etc/passwd",
    "http://user:pass@localhost:11434",
    "http://localhost:11434/admin",
    "https://8.8.8.8",
    "http://localhost:11434/?key=x",
  ])
    assert.throws(() => localURL(url));
  assert.equal(localURL("http://localhost:1234/v1/"), "http://localhost:1234");
  await assert.rejects(
    localRequest("http://private.example:1234", "/v1/models", {
      resolve: async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "8.8.8.8", family: 4 },
      ],
    }),
    /lokalen Netzwerk/,
  );
  await assert.rejects(
    localRequest("http://localhost:1234", "/admin"),
    /Unbekannte/,
  );
});

test("HTTP adapter parses split NDJSON, bounds responses and refuses redirects", async (t) => {
  const url = await serve(t, (req, res) => {
    if (req.url === "/api/pull") {
      res.write('{"status":"pull');
      res.end('ing","completed":5,"total":10}\n{"status":"success"}\n');
    } else if (req.url === "/api/tags") {
      res.writeHead(302, { location: "http://169.254.169.254/" });
      res.end();
    } else res.end(JSON.stringify({ data: [{ id: "test" }] }));
  });
  const lines = [];
  await localRequest(url, "/api/pull", {
    body: { model: "test" },
    onLine: (item) => lines.push(item),
  });
  assert.equal(lines.length, 2);
  assert.equal(lines[1].status, "success");
  await assert.rejects(localRequest(url, "/api/tags"), /HTTP 302/);
  await assert.rejects(
    localRequest(url, "/v1/models", { maxBytes: 2 }),
    /zu groß/,
  );
  assert.equal((await localRequest(url, "/v1/models")).data[0].id, "test");
});

test("both provider protocols discover models; unavailable and non-model servers remain disconnected", async (t) => {
  const worker = await fixture(t, async (_url, endpoint) =>
    endpoint === "/api/tags"
      ? {
          models: [
            { name: "qwen3:1.7b" },
            { name: "gpt:cloud" },
            { name: "remote", remote_host: "cloud" },
          ],
        }
      : { data: [{ id: "local-model" }] },
  );
  const status = await worker.status();
  assert.equal(status.machines[0].models.length, 1);
  assert.equal(status.machines[1].models[0].id, "local-model");
  assert.equal(
    status.machines.every((m) => m.connected),
    true,
  );
  worker.request = async () => ({ arbitrary: true });
  assert.equal(
    (await worker.status()).machines.some((m) => m.connected),
    false,
  );
  worker.request = async () => {
    throw new Error("offline");
  };
  assert.equal((await worker.status()).machines[0].error, "offline");
});

test("machine addition verifies endpoint before persisting and prevents duplicate saves", async (t) => {
  const worker = await fixture(t, async () => ({ models: [] }));
  const input = {
    name: "Büro",
    url: "http://192.168.1.20:11434",
    provider: "ollama",
  };
  const result = await Promise.allSettled([
    worker.saveMachine(input),
    worker.saveMachine(input),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(worker.machines.length, 1);
  const reloaded = new LocalWorkers({ dataRoot: path.dirname(worker.file) });
  await reloaded.init();
  assert.equal(reloaded.machines[0].name, "Büro");
  worker.request = async () => {
    throw new Error("offline");
  };
  await assert.rejects(
    worker.saveMachine({ ...input, url: "http://192.168.1.21:11434" }),
    /offline/,
  );
  assert.equal(worker.machines.length, 1);
  await worker.removeMachine(worker.machines[0].id);
  await reloaded.init();
  assert.equal(reloaded.machines.length, 0);
  await assert.rejects(worker.removeMachine("local-ollama"), /bleibt/);
});

test("model downloads report success only after terminal success and reject unsuitable models", async (t) => {
  let calls = 0;
  const worker = await fixture(t, async (_url, endpoint, options) => {
    assert.equal(endpoint, "/api/pull");
    calls++;
    options.onLine({
      status: "pulling",
      digest: "abc",
      completed: 10,
      total: 10,
    });
    options.onLine({ status: "success" });
    return {};
  });
  let op = worker.pull("local-ollama", "qwen3:4b");
  assert.throws(() => worker.pull("local-ollama", "qwen3:1.7b"), /bereits/);
  assert.equal((await finish(worker, op.id)).status, "completed");
  assert.equal(worker.operations.get(op.id).percent, 100);
  op = worker.pull("local-ollama", "qwen3:8b");
  assert.equal((await finish(worker, op.id)).status, "failed");
  assert.equal(calls, 1);
  assert.throws(
    () => worker.pull("local-ollama", "arbitrary:cloud"),
    /vorgeschlagenes/,
  );
  worker.request = async (_url, _endpoint, options) => {
    options.onLine({ status: "pulling" });
  };
  op = worker.pull("local-ollama", "qwen3:1.7b");
  assert.equal((await finish(worker, op.id)).status, "failed");
});

test("local testchat sends a bounded text request, records only metadata, and refuses cloud execution", async (t) => {
  const bodies = [],
    metadata = [];
  const worker = await fixture(t, async (_url, endpoint, options) => {
    if (endpoint === "/api/tags") return { models: [{ name: "qwen3:1.7b" }] };
    if (endpoint === "/api/show") return { capabilities: ["completion"] };
    bodies.push(options.body);
    return { message: { content: "Hallo vom lokalen Modell." } };
  });
  worker.recordBoundary = async (...args) => metadata.push(args);
  const op = worker.test("local-ollama", "qwen3:1.7b", "Hallo Test");
  const result = await finish(worker, op.id);
  assert.equal(result.status, "completed");
  assert.match(result.answer, /lokalen Modell/);
  assert.equal(bodies[0].options.num_ctx, 4096);
  assert.equal(bodies[0].think, false);
  assert.equal("tools" in bodies[0], false);
  assert.equal(JSON.stringify(metadata).includes("Hallo Test"), false);
  worker.request = async (_url, endpoint) =>
    endpoint === "/api/tags"
      ? { models: [{ name: "custom-model" }] }
      : { remote_host: "cloud.example" };
  const rejected = worker.test("local-ollama", "custom-model", "Hallo");
  assert.equal((await finish(worker, rejected.id)).status, "failed");
  assert.equal(bodies.length, 1);
});

test("LM Studio testchat works through the compatible API and cancelling aborts active work", async (t) => {
  const worker = await fixture(t, async (_url, endpoint, options) => {
    if (endpoint === "/v1/models") return { data: [{ id: "model" }] };
    assert.equal(endpoint, "/v1/chat/completions");
    assert.equal(options.body.max_tokens, 256);
    return { choices: [{ message: { content: "Bereit." } }] };
  });
  let op = worker.test("local-lmstudio", "model", "Test");
  assert.equal((await finish(worker, op.id)).answer, "Bereit.");
  let started;
  const reached = new Promise((resolve) => {
    started = resolve;
  });
  let aborted = false;
  worker.request = (_url, endpoint, options) =>
    endpoint === "/v1/models"
      ? Promise.resolve({ data: [{ id: "model" }] })
      : new Promise((_, reject) => {
          started();
          options.signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("Aborted"));
          });
        });
  op = worker.test("local-lmstudio", "model", "Test");
  await reached;
  worker.cancel(op.id);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(aborted, true);
  assert.equal(worker.operations.get(op.id).status, "cancelled");
});

test("saved network endpoints complete both testchat protocols over real HTTP", async (t) => {
  const requests = [];
  const url = await serve(t, async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : null;
    requests.push({ url: req.url, body });
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        req.url === "/api/tags"
          ? { models: [{ name: "fixture-model" }] }
          : req.url === "/api/show"
            ? { capabilities: ["completion"] }
            : req.url === "/v1/models"
              ? { data: [{ id: "fixture-model" }] }
              : req.url === "/api/chat"
                ? { message: { content: "Ollama fixture reply" } }
                : {
                    choices: [
                      { message: { content: "LM Studio fixture reply" } },
                    ],
                  },
      ),
    );
  });
  const worker = await fixture(t);
  for (const provider of ["ollama", "lmstudio"]) {
    const machine = await worker.saveMachine({ name: provider, provider, url });
    const op = worker.test(machine.id, "fixture-model", "Testnachricht");
    const result = await finish(worker, op.id);
    assert.equal(result.status, "completed");
    assert.match(result.answer, /fixture reply/);
  }
  const chatRequests = requests.filter((r) => r.body?.messages);
  assert.equal(chatRequests.length, 2);
  assert.equal(
    chatRequests.every((r) => r.body.messages[1].content === "Testnachricht"),
    true,
  );
});

test("HTTP cancellation and timeouts terminate requests without uncaught socket errors", async (t) => {
  const url = await serve(t, (_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.write("{");
  });
  await assert.rejects(
    localRequest(url, "/api/chat", { timeoutMs: 20 }),
    /Zeitlimit/,
  );
  const controller = new AbortController();
  const result = localRequest(url, "/api/chat", { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, /abort/i);
});
