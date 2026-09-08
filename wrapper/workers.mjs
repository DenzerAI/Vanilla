import {sharedMemoryACPServers} from './shared-memory.mjs';
import {workerHandoff} from './privacy.mjs';
import {fileURLToPath} from 'node:url';
import { EventEmitter } from "node:events";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { workerCatalog, workerName } from "../system/worker-catalog.mjs";
import { companyRoot } from "../backend/company-base.mjs";
import { systemRoot } from "../backend/worker-context.mjs";
import { atomic, jsonFile, safeName } from "./storage.mjs";
import { ACPWorker } from "./acp-worker.mjs";

export async function findWorkerCommand(entry, env = process.env) {
  const configured = env[entry.env];
  const candidates = configured ? [configured] : [
    ...(entry.command ? [path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules/.bin", entry.command)] : []),
    ...(entry.command ? (env.PATH || "").split(path.delimiter).filter(Boolean).map(p => path.join(p, entry.command)) : []),
    ...(entry.command ? [path.join(os.homedir(), ".local/bin", entry.command), path.join("/opt/homebrew/bin", entry.command)] : []),
    ...(entry.adapter === "codex" ? ["/Applications/ChatGPT.app/Contents/Resources/codex"] : []),
  ];
  for (const command of candidates) {
    if (!path.isAbsolute(command)) continue;
    try { await access(command, constants.X_OK); return command; } catch {}
  }
  return null;
}

export class Workers extends EventEmitter {
  constructor({ store, root, codex, catalog = workerCatalog, resolveCommand = findWorkerCommand, makeACP = opts => new ACPWorker(opts), checkHandoff = async () => {} }) {
    super(); Object.assign(this, { store, root, catalog, resolveCommand, makeACP, checkHandoff });
    this.adapters = new Map(); this.requests = new Map(); this.errors = new Map(); this.connecting = new Map(); this.stopping = new Set();
    this.attach(catalog.find(w => w.adapter === "codex").id, codex);
    this.file = path.join(store.dataRoot, "workers.json");
    this.queue = Promise.resolve();
  }
  async init() {
    this.settings = await jsonFile(this.file, { defaultWorker: "auto", fallbackWorker: null, enabled: ["codex"] });
    if (this.settings.defaultWorker !== "auto" && !this.catalog.some(w => w.id === this.settings.defaultWorker)) throw new Error("Unbekannter Standard-Worker in workers.json.");
  }
  entry(id) { const entry = this.catalog.find(w => w.id === id); if (!entry) throw new Error("Unbekannter Worker."); return entry; }
  attach(id, adapter) {
    this.adapters.set(id, adapter);
    adapter.on("notification", msg => {
      if (msg.method === "serverRequest/resolved") {
        const key = String(msg.params?.requestId ?? msg.params?.id);
        this.requests.delete(key); adapter.requests?.delete(key);
      }
      if (msg.method === "turn/completed") {
        for (const [key, request] of this.requests) {
          if (request.workerId === id && request.params?.threadId === msg.params?.threadId && request.params?.turnId === msg.params?.turn?.id) {
            this.requests.delete(key); adapter.requests?.delete(key);
            this.emit("notification", { method: "serverRequest/resolved", params: { requestId: key } });
          }
        }
      }
      this.emit("notification", { ...msg, workerId: id });
    });
    adapter.on("request", msg => { this.requests.set(String(msg.id), { ...msg, workerId: id }); this.emit("request", { ...msg, workerId: id }); });
    adapter.on("disconnected", error => {
      const intentional = this.stopping.has(id);
      if (!intentional) this.errors.set(id, error.message);
      for (const [key, request] of this.requests) if (request.workerId === id) this.requests.delete(key);
      this.emit("disconnected", { ...error, workerId: id, intentional });
    });
    return adapter;
  }
  routingOrder() {
    const { defaultWorker, fallbackWorker, enabled } = this.settings;
    if (defaultWorker !== "auto") return [...new Set([defaultWorker, fallbackWorker].filter(Boolean))];
    // Catalog order is stable; an explicitly chosen backup is tried last.
    return [...this.catalog.map(w => w.id).filter(id => enabled.includes(id) && id !== fallbackWorker),
      ...(fallbackWorker && enabled.includes(fallbackWorker) ? [fallbackWorker] : [])];
  }
  get effectiveWorker() {
    const ids = this.routingOrder();
    return ids.find(id => this.adapters.get(id)?.connected) || ids[0] || this.catalog[0].id;
  }
  get connected() { return !!this.adapters.get(this.effectiveWorker)?.connected; }
  get info() { return this.adapters.get(this.effectiveWorker)?.info; }
  owner(threadId) { return this.store.chat(threadId).workerId || "codex"; } // Legacy migration, never a routing fallback.
  capability(id) {
    return this.adapters.get(id)?.capabilities || (this.entry(id).adapter === "codex"
      ? { chat: true, streaming: true, attachments: true, approvals: true, plan: true, steer: true, fork: true, archive: true, terminal: true, skills: true }
      : { chat: true, streaming: true, attachments: false, approvals: true, plan: false, steer: false, fork: false, archive: true, terminal: false, skills: false });
  }
  async adapter(id) {
    if (this.adapters.has(id)) return this.adapters.get(id);
    const entry = this.entry(id), command = await this.resolveCommand(entry);
    if (!command) throw new Error(`${entry.name}: Programm nicht gefunden. Zuerst installieren oder den Programmpfad hinterlegen.`);
    if (entry.adapter !== "acp") throw new Error("Worker-Adapter fehlt.");
    return this.attach(id, this.makeACP({ id, name: entry.name, command, args: entry.args, cwd: this.store.root,
      contextEnv: { COMPANY_BASE: companyRoot(this.root), SYSTEM_BASE: systemRoot(), UWE_WORKSPACE: this.store.root },
      readThread: threadId => jsonFile(path.join(this.store.root, "chats", safeName(threadId), "transcript.json"), null),
      persist: thread => this.store.exportThread(thread),
      mcpServers: cwd => {
        const project=this.store.state.projects.find(p=>p.path && path.resolve(this.store.root,p.path)===path.resolve(cwd||this.store.root));
        return sharedMemoryACPServers(id,project?.id||'default');
      },
    }));
  }
  async start(id = this.settings.defaultWorker, { allowUnconfigured = false } = {}) {
    if (id === "auto") return this.adapters.get((await this.select()).id);
    if (!allowUnconfigured && !this.settings.enabled.includes(id)) throw new Error(`${workerName(id)} ist noch nicht verbunden. Unter Einstellungen → Worker verbinden.`);
    if (this.connecting.has(id)) return this.connecting.get(id);
    const pending = (async () => {
      const adapter = await this.adapter(id);
      await adapter.start(); this.errors.delete(id); return adapter;
    })().catch(e => { this.errors.set(id, e.message); throw e; }).finally(() => this.connecting.delete(id));
    this.connecting.set(id, pending); return pending;
  }
  async select(requested = "auto", { mode = "default" } = {}) {
    const ids = requested === "auto" ? this.routingOrder() : [requested];
    const failures = [];
    for (const id of [...new Set(ids)]) {
      try {
        this.entry(id);
        if (mode === "plan" && !this.capability(id).plan) throw new Error(`${workerName(id)} hat hier keinen geschützten Planmodus.`);
        await this.start(id);
        return { id, requested, fallbackFrom: id === ids[0] ? null : ids[0], failures };
      } catch(e) { failures.push(e.message); }
    }
    throw new Error(failures.join(" ") || "Kein Worker eingerichtet. Unter Einstellungen → Worker verbinden.");
  }
  async call(method, params = {}, timeout) {
    if (['turn/start', 'turn/steer'].includes(method)) await this.checkHandoff('worker', workerHandoff(params));
    if (method === 'thread/realtime/start') await this.checkHandoff('voice', {opaque: true, attachments: 1});
    const requested = params.workerId || (params.threadId ? this.owner(params.threadId) : "auto");
    const id = requested === "auto" ? (await this.select()).id : requested;
    // Reading/exporting ACP history does not need a live connection.
    const adapter = method === "thread/read" && this.entry(id).adapter === "acp" ? await this.adapter(id) : await this.start(id);
    const { workerId, ...nativeParams } = params;
    return adapter.call(method, nativeParams, timeout);
  }
  respond(id, result) {
    const request = this.requests.get(String(id));
    if (!request) throw new Error("Rückfrage nicht mehr verfügbar.");
    this.adapters.get(request.workerId).respond(id, result); this.requests.delete(String(id));
  }
  async modelLists() {
    const entries = await Promise.all(this.catalog.map(async entry => {
      const adapter = this.adapters.get(entry.id);
      if (!adapter?.connected) return [entry.id, []];
      const result = await adapter.call("model/list", {}).catch(() => ({ data: [] }));
      return [entry.id, result.data || []];
    }));
    return Object.fromEntries(entries);
  }
  async status() {
    const workers = await Promise.all(this.catalog.map(async entry => {
      const adapter = this.adapters.get(entry.id), command = await this.resolveCommand(entry);
      const configured = this.settings.enabled.includes(entry.id), connected = !!adapter?.connected;
      return { ...entry, installed: !!command, configured, connected, status: connected ? "Verbunden" : this.errors.has(entry.id) ? "Nicht erreichbar" : !command ? (entry.command ? "Nicht installiert" : "Anschluss vorbereiten") : configured ? "Noch nicht geprüft" : "Bereit zum Verbinden", error: this.errors.get(entry.id) || null, version: adapter?.info?.userAgent || null, nativeCapabilities: adapter?.info?.agentCapabilities || null, capabilitySource: entry.adapter === "acp" ? (connected ? "ACP initialize + Wrapper-Unterstützung" : "Noch nicht ausgehandelt") : "Wrapper-Unterstützung; keine native Fähigkeitsliste", capabilities: this.capability(entry.id) };
    }));
    return { workers, settings: this.settings, routingOrder: this.routingOrder(), effectiveWorker: this.effectiveWorker, paths: { company: companyRoot(this.root), system: systemRoot(), workspace: this.store.root } };
  }
  save() { const snapshot = structuredClone(this.settings); this.queue = this.queue.catch(() => {}).then(() => atomic(this.file, snapshot)); return this.queue; }
  async connect(id) {
    this.entry(id);
    await this.start(id, { allowUnconfigured: true });
    if (!this.settings.enabled.includes(id)) this.settings.enabled.push(id);
    await this.save();
    return this.status();
  }
  async preferences({ defaultWorker, fallbackWorker }) {
    if (defaultWorker !== "auto") this.entry(defaultWorker);
    if (fallbackWorker) this.entry(fallbackWorker);
    if (defaultWorker === fallbackWorker) throw new Error("Die Vertretung muss ein anderer Worker sein.");
    for (const id of [defaultWorker, fallbackWorker].filter(id => id && id !== "auto")) if (!this.settings.enabled.includes(id)) throw new Error("Diesen Worker zuerst verbinden.");
    this.settings = { ...this.settings, defaultWorker, fallbackWorker: fallbackWorker || null };
    await this.save(); return this.status();
  }
  async disconnect(id) {
    this.entry(id);
    if (this.connecting.has(id)) throw new Error("Die Verbindung wird gerade aufgebaut. Bitte kurz warten.");
    if ([this.settings.defaultWorker, this.settings.fallbackWorker].includes(id)) throw new Error("Zuerst einen anderen Standard oder eine andere Vertretung auswählen.");
    if (this.settings.enabled.length === 1 && this.settings.enabled.includes(id)) throw new Error("Mindestens einen Worker verbunden lassen.");
    this.stop(id);
    this.settings.enabled = this.settings.enabled.filter(k => k !== id);
    await this.save(); return this.status();
  }
  stop(id) {
    for (const key of id ? [id] : this.adapters.keys()) {
      this.stopping.add(key); this.adapters.get(key)?.stop(); this.stopping.delete(key);
    }
  }
}

export function installWorkerRoutes({ route, workers, active, store }) {
  route("GET", "/api/workers", () => workers.status());
  route("POST", "/api/workers/preferences", b => workers.preferences(b));
  route("POST", "/api/workers/connect", async b => {
    if ([...active.keys()].some(id => workers.owner(id) === b.id)) throw new Error("Dieser Worker arbeitet noch. Bitte zuerst abschließen oder stoppen.");
    if (workers.adapters.get(b.id)?.connected) { workers.stop(b.id); await new Promise(resolve => setTimeout(resolve, 200)); }
    const status = await workers.connect(b.id); return status;
  });
  route("POST", "/api/workers/disconnect", b => {
    if ([...active.keys()].some(id => workers.owner(id) === b.id)) throw new Error("Dieser Worker arbeitet noch.");
    return workers.disconnect(b.id);
  });
}
