import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { atomic, jsonFile } from "./storage.mjs";
import { localRequest, localURL } from "./local-request.mjs";
import {
  inspectDevice,
  installation,
  compatibility,
  localModels,
} from "./local-device.mjs";

const exec = promisify(execFile);
const defaults = [
  {
    id: "local-ollama",
    name: "Ollama",
    provider: "ollama",
    url: "http://127.0.0.1:11434",
    local: true,
  },
  {
    id: "local-lmstudio",
    name: "LM Studio",
    provider: "lmstudio",
    url: "http://127.0.0.1:1234",
    local: true,
  },
];
const downloads = {
  ollama: "https://ollama.com/download",
  lmstudio: "https://lmstudio.ai/download",
};
export class LocalWorkers {
  constructor({
    dataRoot,
    request = localRequest,
    device = inspectDevice,
    installed = installation,
    recordBoundary = async () => {},
  }) {
    this.file = path.join(dataRoot, "local-workers.json");
    this.request = request;
    this.device = device;
    this.installed = installed;
    this.recordBoundary = recordBoundary;
    this.machines = [];
    this.operations = new Map();
    this.controllers = new Map();
    this.queue = Promise.resolve();
  }
  async init() {
    this.machines = await jsonFile(this.file, []);
  }
  all() {
    return [...defaults, ...this.machines];
  }
  get(id) {
    const machine = this.all().find((m) => m.id === id);
    if (!machine) throw new Error("Rechner nicht gefunden.");
    return machine;
  }
  async probe(machine) {
    try {
      const data = await this.request(
        machine.url,
        machine.provider === "ollama" ? "/api/tags" : "/v1/models",
      );
      const models = machine.provider === "ollama" ? data.models : data.data;
      if (!Array.isArray(models))
        throw new Error(
          "An dieser Adresse antwortet kein passender Modellserver.",
        );
      return {
        connected: true,
        error: null,
        models: models
          .filter((m) => !m.remote_host && !m.remote_model)
          .map((m) => ({ id: m.name || m.id, bytes: Number(m.size) || null }))
          .filter(
            (m) =>
              typeof m.id === "string" &&
              m.id.length <= 200 &&
              !/:.*cloud/i.test(m.id),
          )
          .slice(0, 200),
      };
    } catch (e) {
      return { connected: false, error: e.message, models: [] };
    }
  }
  async status() {
    const device = await this.device();
    const machines = await Promise.all(
      this.all().map(async (machine) => {
        const [status, found] = await Promise.all([
          this.probe(machine),
          machine.local ? this.installed(machine.provider) : null,
        ]);
        return {
          ...machine,
          ...status,
          installed: !!found?.installed,
          canStart: !!(found?.app || found?.binary),
          unavailable: machine.local
            ? compatibility(machine.provider, device)
            : null,
          downloadURL:
            downloads[machine.provider] +
            (machine.provider === "ollama"
              ? "/" +
                ({ darwin: "mac", linux: "linux", win32: "windows" }[
                  device.platform
                ] || "")
              : ""),
        };
      }),
    );
    return { device, machines, operations: [...this.operations.values()] };
  }
  persist() {
    const snapshot = structuredClone(this.machines);
    this.queue = this.queue
      .catch(() => {})
      .then(() => atomic(this.file, snapshot));
    return this.queue;
  }
  async saveMachine(input) {
    if (!["ollama", "lmstudio"].includes(input.provider))
      throw new Error("Ollama oder LM Studio auswählen.");
    const name = String(input.name || "")
      .trim()
      .slice(0, 80);
    if (!name) throw new Error("Name für den Rechner eingeben.");
    const url = localURL(input.url);
    if (this.all().some((m) => m.url === url && m.provider === input.provider))
      throw new Error("Dieser Anschluss ist bereits vorhanden.");
    if (this.machines.length >= 12)
      throw new Error("Maximal zwölf zusätzliche Anschlüsse möglich.");
    const machine = {
      id: "machine-" + randomUUID(),
      name,
      provider: input.provider,
      url,
      local: false,
    };
    const result = await this.probe(machine);
    if (!result.connected) throw new Error(result.error);
    // Recheck after the asynchronous probe to avoid duplicates from parallel saves.
    if (
      this.all().some((m) => m.url === url && m.provider === input.provider) ||
      this.machines.length >= 12
    )
      throw new Error("Anschlussliste wurde geändert. Bitte erneut prüfen.");
    this.machines.push(machine);
    await this.persist();
    return machine;
  }
  async removeMachine(id) {
    if (this.get(id).local) throw new Error("Dieser Rechner bleibt verfügbar.");
    if (
      [...this.operations.values()].some(
        (o) => o.machineId === id && o.status === "running",
      )
    )
      throw new Error("Zuerst den laufenden Vorgang stoppen.");
    this.machines = this.machines.filter((m) => m.id !== id);
    await this.persist();
    return { ok: true };
  }
  async start(id) {
    const machine = this.get(id);
    if (!machine.local)
      throw new Error("Die Anwendung auf dem anderen Rechner starten.");
    if ((await this.probe(machine)).connected) return { ok: true };
    const device = await this.device(),
      blocked = compatibility(machine.provider, device);
    if (blocked) throw new Error(blocked);
    const found = await this.installed(machine.provider);
    if (machine.provider === "lmstudio" && found.binary) {
      try {
        await exec(
          found.binary,
          ["server", "start", "--port", "1234", "--bind", "127.0.0.1"],
          { timeout: 20000, maxBuffer: 256000 },
        );
        return { ok: true };
      } catch {
        /* An installed desktop app can still be opened below. */
      }
    }
    if (found.app) {
      await exec("/usr/bin/open", [found.app], { timeout: 5000 });
      return {
        ok: true,
        message:
          machine.provider === "lmstudio"
            ? "In LM Studio den lokalen Server starten."
            : "Ollama wird geöffnet.",
      };
    }
    if (machine.provider === "ollama" && found.binary) {
      await new Promise((resolve, reject) => {
        const child = spawn(found.binary, ["serve"], {
          detached: true,
          stdio: "ignore",
          env: {
            ...process.env,
            OLLAMA_HOST: "127.0.0.1:11434",
            OLLAMA_NO_CLOUD: "1",
          },
        });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      return { ok: true };
    }
    throw new Error("Anwendung zuerst installieren und starten.");
  }
  operation(machine, kind, model, run) {
    if (
      [...this.operations.values()].some(
        (o) => o.machineId === machine.id && o.status === "running",
      )
    )
      throw new Error("Auf diesem Rechner läuft bereits ein Vorgang.");
    // Retain only recent results; requests and transcripts are never persisted here.
    for (const [id, op] of this.operations)
      if (op.status !== "running" && this.operations.size >= 20)
        this.operations.delete(id);
    const op = {
      id: randomUUID(),
      machineId: machine.id,
      kind,
      model,
      status: "running",
      message: kind === "pull" ? "Download startet …" : "Modell antwortet …",
      startedAt: Date.now(),
      percent: null,
    };
    const controller = new AbortController();
    this.operations.set(op.id, op);
    this.controllers.set(op.id, controller);
    Promise.resolve()
      .then(() => run(op, controller.signal))
      .then(() => {
        if (op.status === "running") {
          op.status = "completed";
          op.message =
            kind === "pull" ? "Modell installiert" : "Test erfolgreich";
        }
      })
      .catch((e) => {
        if (op.status === "running") {
          op.status = "failed";
          op.message = e.message;
        }
      })
      .finally(() => {
        op.finishedAt = Date.now();
        this.controllers.delete(op.id);
      });
    return { ...op };
  }
  pull(id, model) {
    const machine = this.get(id);
    if (id !== "local-ollama")
      throw new Error("Modelle auf diesem Rechner über Ollama installieren.");
    if (!localModels.some((m) => m.id === model))
      throw new Error("Ein vorgeschlagenes Modell auswählen.");
    return this.operation(machine, "pull", model, async (op, signal) => {
      const device = await this.device();
      const choice = device.options.find((m) => m.id === model);
      if (!choice?.fits)
        throw new Error(
          "Für dieses Modell reicht der empfohlene Speicherrahmen nicht.",
        );
      if (!choice.diskFits)
        throw new Error("Nicht genug freier Speicherplatz für dieses Modell.");
      let success = false;
      const layers = new Map();
      await this.request(machine.url, "/api/pull", {
        body: { model, stream: true },
        signal,
        timeoutMs: 30 * 60 * 1000,
        maxBytes: 16 * 1024 * 1024,
        onLine: (data) => {
          if (data.digest && data.total)
            layers.set(data.digest, {
              total: data.total,
              completed: data.completed || 0,
            });
          const total = [...layers.values()].reduce((n, v) => n + v.total, 0);
          const completed = [...layers.values()].reduce(
            (n, v) => n + v.completed,
            0,
          );
          op.percent = total
            ? Math.min(99, Math.round((completed / total) * 100))
            : null;
          op.message = String(data.status).startsWith("verifying")
            ? "Download wird geprüft …"
            : String(data.status).startsWith("writing")
              ? "Modell wird eingerichtet …"
              : "Modell wird geladen …";
          if (data.status === "success") {
            success = true;
            op.percent = 100;
          }
        },
      });
      if (!success)
        throw new Error(
          "Download wurde nicht abgeschlossen. Bitte erneut versuchen.",
        );
    });
  }
  test(id, model, text) {
    const machine = this.get(id);
    if (
      typeof model !== "string" ||
      !model ||
      model.length > 200 ||
      /[\r\n\0]/.test(model)
    )
      throw new Error("Modell auswählen.");
    if (typeof text !== "string" || !text.trim() || text.length > 2000)
      throw new Error(
        "Eine Testnachricht mit höchstens 2.000 Zeichen eingeben.",
      );
    return this.operation(machine, "test", model, async (op, signal) => {
      const status = await this.probe(machine);
      if (!status.connected) throw new Error(status.error);
      if (!status.models.some((m) => m.id === model))
        throw new Error("Modell nicht mehr verfügbar. Erneut prüfen.");
      if (id === "local-ollama") {
        const known = localModels.find((m) => m.id === model);
        if (known) {
          const device = await this.device();
          // Recheck the hardware envelope before loading a bundled suggestion.
          if (!device.options.find((m) => m.id === model)?.fits)
            throw new Error(
              "Ein kleineres Modell für diesen Rechner auswählen.",
            );
        }
      }
      if (machine.provider === "ollama") {
        const info = await this.request(machine.url, "/api/show", {
          body: { model },
          signal,
        });
        if (info.remote_model || info.remote_host || /:.*cloud/i.test(model))
          throw new Error(
            "Für diesen Test ein lokal installiertes Modell auswählen.",
          );
        if (
          Array.isArray(info.capabilities) &&
          !info.capabilities.includes("completion")
        )
          throw new Error("Dieses Modell unterstützt keinen Textchat.");
      }
      if (signal.aborted) throw new Error("Test gestoppt.");
      await this.recordBoundary("local-test", {
        machineId: id,
        provider: machine.provider,
        model,
        inputBytes: Buffer.byteLength(text),
      });
      const messages = [
        { role: "system", content: "Antworte kurz und auf Deutsch." },
        { role: "user", content: text.trim() },
      ];
      const result = await this.request(
        machine.url,
        machine.provider === "ollama" ? "/api/chat" : "/v1/chat/completions",
        {
          signal,
          timeoutMs: 180000,
          body:
            machine.provider === "ollama"
              ? {
                  model,
                  messages,
                  stream: false,
                  ...(model.startsWith("qwen3:") ? { think: false } : {}),
                  options: { num_ctx: 4096, num_predict: 256 },
                  keep_alive: "2m",
                }
              : { model, messages, stream: false, max_tokens: 256 },
        },
      );
      const answer =
        machine.provider === "ollama"
          ? result.message?.content
          : result.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim())
        throw new Error(
          "Keine Textantwort erhalten. Ein Chatmodell auswählen und erneut testen.",
        );
      op.answer = answer.slice(0, 12000);
    });
  }
  cancel(id) {
    const op = this.operations.get(id);
    if (!op) throw new Error("Vorgang nicht gefunden.");
    if (op.status === "running") {
      op.status = "cancelled";
      op.message = "Gestoppt";
      op.finishedAt = Date.now();
      this.controllers.get(id)?.abort();
    }
    return { ...op };
  }
  close() {
    for (const id of this.controllers.keys()) this.cancel(id);
  }
}

export async function installLocalWorkerRoutes({
  route,
  dataRoot,
  recordBoundary,
}) {
  const workers = new LocalWorkers({ dataRoot, recordBoundary });
  await workers.init();
  route("GET", "/api/local-workers", () => workers.status());
  route("GET", "/api/local-workers/operations", () => ({
    operations: [...workers.operations.values()],
  }));
  route("POST", "/api/local-workers/start", (b) => workers.start(b.id));
  route("POST", "/api/local-workers/pull", (b) => workers.pull(b.id, b.model));
  route("POST", "/api/local-workers/test", (b) =>
    workers.test(b.id, b.model, b.text),
  );
  route("POST", "/api/local-workers/cancel", (b) => workers.cancel(b.id));
  route("POST", "/api/local-workers/machines/save", (b) =>
    workers.saveMachine(b),
  );
  route("POST", "/api/local-workers/machines/remove", (b) =>
    workers.removeMachine(b.id),
  );
  return workers;
}
