import {Codex} from "./codex.mjs";
import {installationEnvironment} from './worker-environment.mjs';
import {sharedMemoryACPServers} from './shared-memory.mjs';
import {fileURLToPath} from 'node:url';
import { EventEmitter } from "node:events";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { workerCatalog, workerName } from "../system/worker-catalog.mjs";
import { companyRoot } from "../backend/company-base.mjs";
import { systemRoot } from "../backend/worker-context.mjs";
import { atomic, jsonFile, safeName } from "./storage.mjs";
import {handoffSnapshot, joinHandoff} from "./chat-handoff.mjs";
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
  constructor({ store, root, codex, catalog = workerCatalog, resolveCommand = findWorkerCommand, makeACP = opts => new ACPWorker(opts) }) {
    super(); Object.assign(this, { store, root, catalog, resolveCommand, makeACP });
    this.adapters = new Map(); this.requests = new Map(); this.errors = new Map(); this.connecting = new Map(); this.stopping = new Set();
    this.attach(catalog.find(w => w.adapter === "codex").id, codex);
    this.file = path.join(store.dataRoot, "workers.json");
    this.queue = Promise.resolve();
    this.inFlight = 0; this.changing = null;
  }
  async init() {
    this.settings = await jsonFile(this.file, { defaultWorker: "auto", fallbackWorker: null, enabled: [] });
    if (this.settings.defaultWorker !== "auto" && !this.catalog.some(w => w.id === this.settings.defaultWorker)) throw new Error("Unbekannter Standard-Worker in workers.json.");
  }
  entry(id) { const entry = this.catalog.find(w => w.id === id); if (!entry) throw new Error("Unbekannter Worker."); return entry; }
  attach(id, adapter) {
    this.adapters.set(id, adapter);
    adapter.on("notification", msg => {
      if (this.adapters.get(id) !== adapter) return;
      msg = this.publicEvent(id, msg);
      if (!msg) return;
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
    adapter.on("request", msg => { if (this.adapters.get(id) !== adapter) return; msg = this.publicEvent(id, msg); if (!msg) return; this.requests.set(String(msg.id), { ...msg, workerId: id }); this.emit("request", { ...msg, workerId: id }); });
    adapter.on("disconnected", error => {
      if (this.adapters.get(id) !== adapter) return;
      const intentional = this.stopping.has(id);
      if (!intentional) this.errors.set(id, error.message);
      for (const [key, request] of this.requests) if (request.workerId === id) {
        this.requests.delete(key);
        this.emit("notification", {method:"serverRequest/resolved",params:{requestId:key,threadId:request.params?.threadId},workerId:id});
      }
      this.emit("disconnected", { ...error, workerId: id, intentional });
    });
    return adapter;
  }
  publicEvent(workerId, msg) {
    const nativeId = msg.params?.threadId || msg.params?.thread?.id;
    if (!nativeId) return msg;
    const chat = this.store.state.chats.find(c => (c.workerThreadId || c.id) === nativeId && (c.workerId || "codex") === workerId);
    // Retired sessions cannot write into the current visible conversation.
    if (!chat) return null;
    const params = {...msg.params};
    if (params.threadId) params.threadId = chat.id;
    if (params.thread) params.thread = {...params.thread, id:chat.id};
    return {...msg, params};
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
  async adapter(id, candidateCommand = null) {
    if (!candidateCommand && this.adapters.has(id)) return this.adapters.get(id);
    const entry = this.entry(id), command = candidateCommand || await this.resolveCommand(entry);
    if (!command) throw new Error(`${entry.name}: Programm nicht gefunden. Zuerst installieren oder den Programmpfad hinterlegen.`);
    if (entry.adapter !== "acp") throw new Error("Worker-Adapter fehlt.");
    const contextEnv = { ...await installationEnvironment(this.store.dataRoot, id), AGENT_INTERNAL_TOKEN: process.env.AGENT_INTERNAL_TOKEN || "", COMPANY_BASE: companyRoot(this.root), SYSTEM_BASE: systemRoot(), UWE_WORKSPACE: this.store.root };
    const bundledClaude = id === "claw-code" && command === fileURLToPath(new URL("./node_modules/.bin/claude-agent-acp", import.meta.url));
    const created = this.makeACP({ id, name: entry.name,
      command: bundledClaude ? process.execPath : command,
      args: bundledClaude ? [fileURLToPath(new URL("./claude-acp.mjs", import.meta.url)), ...entry.args] : entry.args, cwd: this.store.root,
      contextEnv,
      readThread: async threadId => await jsonFile(path.join(this.store.root, "chats", safeName(threadId), "native-session.json"), null)
        || await jsonFile(path.join(this.store.root, "chats", safeName(threadId), "transcript.json"), null),
      persist: thread => atomic(path.join(this.store.root, "chats", safeName(thread.id), "native-session.json"), thread),
      mcpServers: async cwd => {
        const project=this.store.state.projects.find(p=>p.path && path.resolve(this.store.root,p.path)===path.resolve(cwd||this.store.root));
        const job=(await this.store.jobs()).find(j=>path.resolve(this.store.root,'jobs',j.id)===path.resolve(cwd||this.store.root));
        return sharedMemoryACPServers(id,project?.id||job?.projectId||'default');
      },
    });
    return candidateCommand ? created : this.attach(id, created);
  }
  async start(id = this.settings.defaultWorker, { allowUnconfigured = false } = {}) {
    if (this.changing) await this.changing;
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
  async replaceProgram(id, command, commit, idle, activated = () => {}) {
    if (this.changing || this.inFlight || this.connecting.size || !idle()) return false;
    let release;
    this.changing = new Promise(resolve => {release=resolve;});
    const old=this.adapters.get(id), wasConnected=old?.connected, enabled=JSON.stringify(this.settings.enabled);
    let candidate;
    try {
      candidate=this.entry(id).adapter==='codex'
        ? new Codex({cwd:old.cwd,home:old.home,config:old.config,contextEnv:old.contextEnv,binary:command})
        : await this.adapter(id,command);
      await candidate.start();
      if(!idle() || old?.connected!==wasConnected || JSON.stringify(this.settings.enabled)!==enabled){candidate.stop();return false;}
      // Commit only after the protocol handshake succeeded. Old process remains available on failure.
      await commit();
      this.attach(id,candidate);
      old?.stop();
      this.errors.delete(id);
      activated();
      this.emit('notification',{method:'wrapper/workers',params:{}});
      return true;
    } catch(error) {candidate?.stop();throw error;}
    finally {this.changing=null;release();}
  }
  async call(method, params = {}, timeout) {
    if(this.changing)await this.changing;
    this.inFlight++;
    try {return await this.callUnlocked(method,params,timeout);} finally {this.inFlight--;}
  }
  async callUnlocked(method, params = {}, timeout) {
    const requested = params.workerId || (params.threadId ? this.owner(params.threadId) : "auto");
    const id = requested === "auto" ? (await this.select()).id : requested;
    // Reading/exporting ACP history does not need a live connection.
    const adapter = method === "thread/read" && this.entry(id).adapter === "acp" ? await this.adapter(id) : await this.start(id);
    const { workerId, ...nativeParams } = params;
    const chat = params.threadId && this.store.chat(params.threadId);
    const generation = chat && (chat.workerThreadId || chat.id);
    const snapshot = chat && await handoffSnapshot(this.store, chat);
    if (chat?.workerThreadId) nativeParams.threadId = chat.workerThreadId;
    if (snapshot && method === "thread/rollback") {
      const native = await adapter.call("thread/read", {threadId:nativeParams.threadId, includeTurns:true});
      if (params.numTurns > native.thread.turns.length) throw new Error("Nachrichten vor dem Anbieterwechsel bleiben im Übergabeverlauf erhalten.");
    }
    if (snapshot && method === "thread/fork" && snapshot.turns.some(t => t.id === params.beforeTurnId)) throw new Error("Bitte einen Verzweigungspunkt nach dem Anbieterwechsel wählen.");
    const result = await adapter.call(method, nativeParams, timeout);
    if (chat && ((chat.workerThreadId || chat.id) !== generation || (chat.workerId || "codex") !== id)) throw new Error("Der Anbieter wurde inzwischen gewechselt. Bitte erneut laden.");
    if (result.thread && chat && method !== "thread/fork") result.thread = joinHandoff(chat.id, snapshot, result.thread);
    if (result.thread && snapshot && method === "thread/fork") result.thread = joinHandoff(result.thread.id, snapshot, result.thread);
    return result;
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
      return { ...entry, installed: !!command, configured, connected, authenticated: adapter?.authenticated ?? null, status: connected ? adapter?.authenticated === false ? "Anmeldung fehlt" : "Verbunden" : this.errors.has(entry.id) ? "Nicht erreichbar" : !command ? (entry.command ? "Nicht installiert" : "Anschluss vorbereiten") : configured ? "Eingerichtet · Bei Bedarf verbunden" : "Installiert", error: this.errors.get(entry.id) || null, version: adapter?.info?.userAgent || null, nativeCapabilities: adapter?.info?.agentCapabilities || null, capabilitySource: entry.adapter === "acp" ? (connected ? "ACP initialize + Wrapper-Unterstützung" : "Noch nicht ausgehandelt") : "Wrapper-Unterstützung; keine native Fähigkeitsliste", capabilities: this.capability(entry.id) };
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
  // Explicit picker action: reuse native CLI/OAuth authentication and an existing
  // connection, including while other chats are running. Never restart a worker.
  route("POST", "/api/workers/activate", async b => {
    const state = await workers.connect(b.id);
    return { ...state, models: (await workers.modelLists())[b.id] || [] };
  });
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
