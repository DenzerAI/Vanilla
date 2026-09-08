import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WorkerRPC } from "./worker-rpc.mjs";
import { sessionModelSelection } from "./worker-models.mjs";

export class ACPWorker extends EventEmitter {
  constructor({ id, name, command, args, cwd, contextEnv, readThread, persist, rpc, mcpServers = () => [] }) {
    super(); Object.assign(this, { id, name, readThread, persist, mcpServers });
    this.rpc = rpc || new WorkerRPC({ command, args, cwd, env: contextEnv });
    this.threads = new Map(); this.sessions = new Map(); this.running = new Map(); this.requests = new Map();
    this.connected = false; this.setupCount = 0; this.earlyUpdates = [];
    const save = this.persist;
    let saving = Promise.resolve();
    this.persist = thread => {
      const snapshot = structuredClone(thread);
      saving = saving.catch(() => {}).then(() => save(snapshot));
      return saving;
    };
    this.rpc.on("message", msg => this.receive(msg));
    this.rpc.on("disconnected", error => {
      this.connected = false; this.starting = null; this.authenticated = undefined; this.sessions.clear(); this.earlyUpdates = [];
      for (const [id] of this.running) this.finish(id, "failed", { message: "Verbindung unterbrochen. Ergebnis prüfen, bevor du erneut startest." }).catch(() => {});
      this.requests.clear(); this.emit("disconnected", error);
    });
  }
  async start() {
    if (this.connected) return this.info;
    if (this.starting) return this.starting;
    this.starting = (async () => {
      this.rpc.start();
      const r = await this.rpc.call("initialize", { protocolVersion: 1, clientInfo: { name: "agent-control", version: "1.0.0" }, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
      if (r?.protocolVersion !== 1 || !r.agentCapabilities) throw new Error("Dieser Anschluss spricht kein unterstütztes ACP. Installation prüfen.");
      this.info = { ...r, userAgent: r.agentInfo?.version || null };
      this.connected = true;
      return this.info;
    })().catch(e => { this.rpc.stop(); this.starting = null; throw e; });
    return this.starting;
  }
  get capabilities() {
    return { chat: true, streaming: true, attachments: !!(this.info?.agentCapabilities?.promptCapabilities?.image || this.info?.agentCapabilities?.promptCapabilities?.audio), approvals: true, plan: false, steer: false, fork: false, archive: true, terminal: false, skills: false };
  }
  models(thread) {
    return sessionModelSelection(thread?.workerSession).models;
  }
  async checkAuthentication() {
    if (this.authenticated === undefined && this.info?.agentCapabilities?._meta?.authStatus) {
      await new Promise(resolve => {
        const done = () => { clearTimeout(timer); this.off("authentication", done); resolve(); };
        const timer = setTimeout(done, 5500);
        this.once("authentication", done);
      });
    }
    if (this.authenticated === false) throw new Error(`${this.name} ist nicht angemeldet. Bitte in der CLI anmelden und danach erneut versuchen.`);
  }
  async setup(method, params) {
    this.setupCount++;
    try { return await this.rpc.call(method, params); }
    finally { this.setupCount--; }
  }
  applyEarly(thread) {
    const pending = this.earlyUpdates.filter(m => m.params.sessionId === thread.workerSession.sessionId);
    this.earlyUpdates = this.earlyUpdates.filter(m => m.params.sessionId !== thread.workerSession.sessionId);
    for (const msg of pending) this.receive(msg);
  }
  publishSession(thread) {
    this.event("worker/session/updated", thread.id, { workerSession: structuredClone(thread.workerSession) });
  }
  async thread(id) {
    if (!this.threads.has(id)) {
      const t = await this.readThread(id);
      if (!t?.workerSession?.sessionId || t.workerId !== this.id) throw new Error("Worker-Verlauf fehlt. Bitte einen neuen Chat beginnen.");
      this.threads.set(id, t);
    }
    return this.threads.get(id);
  }
  async call(method, p = {}) {
    if (method === "thread/read") return { thread: structuredClone(await this.thread(p.threadId)) };
    if (["thread/archive", "thread/unarchive"].includes(method)) return {};
    await this.start();
    if (method === "model/list") return { data: [] }; // Models are negotiated per ACP session.
    if (method === "account/read") return {};
    if (method === "mcpServerStatus/list") return { data: [] };
    if (method === "thread/start") {
      if (p.sandbox === "read-only") throw new Error(`${this.name} bietet hier keinen geschützten Planmodus.`);
      const session = await this.setup("session/new", { cwd: p.cwd, mcpServers: await this.mcpServers(p.cwd) });
      if (!session?.sessionId) throw new Error("Worker hat keinen Chat angelegt. Anmeldung prüfen.");
      // A CLI can advertise models while logged out. Use its reported auth state,
      // without reading credentials or persisting account identity in the wrapper.
      this.setupCount++;
      try { await this.checkAuthentication(); }
      catch (error) {
        this.earlyUpdates = this.earlyUpdates.filter(m => m.params.sessionId !== session.sessionId);
        throw error;
      } finally { this.setupCount--; }
      const thread = { id: `${this.id}-${randomUUID()}`, workerId: this.id, cwd: p.cwd, turns: [], workerSession: session };
      this.threads.set(thread.id, thread); this.sessions.set(session.sessionId, thread.id); this.applyEarly(thread);
      await this.persist(thread);
      return { thread: structuredClone(thread), model: sessionModelSelection(thread.workerSession).model || null };
    }
    const thread = p.threadId && await this.thread(p.threadId);
    if (method === "thread/resume") {
      const sid = thread.workerSession.sessionId;
      if (!this.sessions.has(sid) || thread.cwd !== p.cwd) {
        if (!this.info.agentCapabilities.loadSession) throw new Error(`${this.name} kann diesen Chat nach Neustart nicht fortsetzen. Verlauf bleibt erhalten; bitte neuen Chat beginnen.`);
        // Ignore replay updates until load finishes: our persisted transcript is the display source.
        this.sessions.delete(sid);
        const result = await this.setup("session/load", { sessionId: sid, cwd: p.cwd, mcpServers: await this.mcpServers(p.cwd) });
        if (!result || (result.sessionId && result.sessionId !== sid)) throw new Error("Worker konnte den vorhandenen Chat nicht wiederherstellen. Bitte einen neuen Chat beginnen.");
        thread.workerSession = { ...result, sessionId: sid };
        thread.cwd = p.cwd; this.sessions.set(sid, thread.id); this.applyEarly(thread);
        await this.persist(thread); this.publishSession(thread);
      }
      return { thread: structuredClone(thread) };
    }
    if (["session/set_config_option", "session/set_mode", "session/set_model"].includes(method)) {
      if (this.running.has(thread.id)) throw new Error("Bitte die laufende Antwort abwarten oder stoppen.");
      if (!this.sessions.has(thread.workerSession.sessionId)) throw new Error("Sitzung zuerst fortsetzen.");
      const sessionId = thread.workerSession.sessionId;
      if (method === "session/set_model") {
        if (thread.workerSession.configOptions !== undefined || !this.models(thread).some(m => m.model === p.modelId)) throw new Error("Modell wird nicht angeboten.");
        await this.rpc.call(method, { sessionId, modelId: p.modelId });
        thread.workerSession.models.currentModelId = p.modelId;
      } else if (method === "session/set_mode") {
        if (thread.workerSession.configOptions !== undefined || !thread.workerSession.modes?.availableModes?.some(m => m.id === p.modeId)) throw new Error("Sitzungsmodus wird nicht angeboten.");
        await this.rpc.call(method, { sessionId, modeId: p.modeId });
        thread.workerSession.modes.currentModeId = p.modeId;
      } else {
        const option = thread.workerSession.configOptions?.find(o => o.id === p.configId);
        const values = option?.options?.flatMap(o => o.options || [o]);
        if (option?.type !== "select" || !values?.some(o => typeof o.value === "string" && o.value === p.value)) throw new Error("Diese Sitzungseinstellung oder dieser Wert wird nicht angeboten.");
        const result = await this.rpc.call(method, { sessionId, configId: p.configId, value: p.value });
        if (!Array.isArray(result?.configOptions)) throw new Error("Worker hat die Sitzungseinstellungen nicht bestätigt. Sitzung neu laden.");
        thread.workerSession.configOptions = result.configOptions;
      }
      await this.persist(thread); this.publishSession(thread);
      return { thread: structuredClone(thread) };
    }
    if (method === "turn/start") {
      if (this.running.has(thread.id)) throw new Error("Bitte die laufende Antwort abwarten oder stoppen.");
      if (p.collaborationMode?.mode === "plan" || p.sandboxPolicy?.type === "readOnly") throw new Error(`${this.name} bietet hier keinen geschützten Planmodus.`);
      const prompt = [{ type: "text", text: p.collaborationMode?.settings?.developer_instructions || "" }];
      for (const input of p.input) {
        if (input.type === "text") prompt.push({ type: "text", text: input.text });
        else {
          const image = input.type === "localImage", capability = image ? "image" : "audio";
          if (!this.info.agentCapabilities.promptCapabilities?.[capability]) throw new Error(`${this.name} unterstützt diesen Anhang nicht. Bitte als Text beschreiben.`);
          const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4" };
          prompt.push({ type: capability, data: (await readFile(input.path)).toString("base64"), mimeType: mime[path.extname(input.path).toLowerCase()] });
        }
      }
      // Native commands may require exactly one text block (e.g. Claude /usage).
      // Do not turn shared context into command arguments or dispatch a second prompt.
      if (p.input[0]?.type === "text" && p.input[0].text.startsWith("/")) prompt.shift();
      if (p.model && thread.workerSession.configOptions === undefined && p.model !== thread.workerSession.models?.currentModelId) {
        if (!this.models(thread).some(m => m.model === p.model)) throw new Error("Modell gehört nicht zu diesem Worker. Bitte dessen Modell auswählen.");
        await this.rpc.call("session/set_model", { sessionId: thread.workerSession.sessionId, modelId: p.model });
        thread.workerSession.models.currentModelId = p.model;
      }
      const turn = { id: randomUUID(), status: "inProgress", items: [{ id: randomUUID(), type: "userMessage", content: structuredClone(p.input) }] };
      thread.turns.push(turn); this.running.set(thread.id, turn);
      try { await this.persist(thread); } catch(e) { this.running.delete(thread.id); thread.turns.pop(); throw e; }
      // Defer notifications so the caller has stored the returned active turn first.
      setImmediate(() => {
        this.event("turn/started", thread.id, { turn: structuredClone(turn) });
        this.event("item/completed", thread.id, { turnId: turn.id, item: turn.items[0] });
        this.rpc.call("session/prompt", { sessionId: thread.workerSession.sessionId, prompt }, 60 * 60 * 1000)
          .then(r => {
            const status = r?.stopReason === "cancelled" ? "interrupted" : r?.stopReason === "end_turn" ? "completed" : "failed";
            return this.finish(thread.id, status, status === "failed" ? { message: "Worker hat kein abgeschlossenes Ergebnis geliefert. Verlauf prüfen." } : null);
          })
          .catch(e => this.finish(thread.id, "failed", { message: e.message })).catch(() => {});
      });
      return { turn: structuredClone(turn) };
    }
    if (method === "turn/interrupt") {
      this.rpc.write({ method: "session/cancel", params: { sessionId: thread.workerSession.sessionId } });
      // The native worker must confirm cancellation; no replacement starts in the meantime.
      return {};
    }
    throw new Error(`${this.name} unterstützt diese Funktion hier noch nicht (${method}).`);
  }
  event(method, threadId, params) { this.emit("notification", { method, params: { threadId, ...params } }); }
  receive(msg) {
    if (msg.method === "_auth/status_update") {
      const kind = msg.params?.authStatus?.kind;
      if (["none", "account", "api_key", "external", "gateway"].includes(kind)) {
        this.authenticated = kind !== "none";
        this.emit("authentication", this.authenticated);
      }
      return;
    }
    const id = this.sessions.get(msg.params?.sessionId), turn = this.running.get(id);
    if (msg.id !== undefined) {
      if (msg.method === "session/request_permission" && turn) {
        const key = `${this.id}:${msg.id}`;
        const request = { id: key, method: "item/commandExecution/requestApproval", params: { threadId: id, turnId: turn.id, reason: msg.params.toolCall?.title || "Worker bittet um Freigabe.", workerId: this.id }, native: msg };
        this.requests.set(key, request); this.emit("request", { id: key, method: request.method, params: request.params });
      } else this.rpc.write({ id: msg.id, error: { code: -32601, message: "Diese Client-Funktion ist nicht verfügbar." } });
      return;
    }
    if (msg.method !== "session/update") return;
    const u = msg.params.update;
    if (!u) return;
    const transcriptUpdate = ["agent_message_chunk", "agent_thought_chunk", "user_message_chunk", "tool_call", "tool_call_update", "plan"].includes(u.sessionUpdate);
    if (!id) {
      // session/new may reply and notify in the same stdio chunk, before its promise resumes.
      // During load, preserve metadata but deliberately ignore transcript replay.
      if (this.setupCount && !transcriptUpdate) {
        if (this.earlyUpdates.length < 256) this.earlyUpdates.push(structuredClone(msg));
        else this.emit("notification", { method: "wrapper/error", params: { message: "Zu viele frühe Worker-Updates; Sitzungseinstellungen möglicherweise unvollständig." } });
      }
      return;
    }
    const thread = this.threads.get(id);
    if (!transcriptUpdate && thread) {
      const session = thread.workerSession;
      if (u.sessionUpdate === "available_commands_update" && Array.isArray(u.availableCommands)) session.availableCommands = u.availableCommands;
      else if (u.sessionUpdate === "config_option_update" && Array.isArray(u.configOptions)) session.configOptions = u.configOptions;
      else if (u.sessionUpdate === "current_mode_update") session.modes = { ...session.modes, currentModeId: u.currentModeId };
      else {
        // Preserve the event type, never expose arbitrary private payloads as diagnostics.
        session.unsupportedUpdates = [...new Set([...(session.unsupportedUpdates || []), String(u.sessionUpdate).slice(0, 120)])].slice(-32);
      }
      this.publishSession(thread);
      this.persist(thread).catch(() => this.event("wrapper/error", id, { message: "Worker-Sitzungseinstellungen konnten nicht gespeichert werden." }));
      return;
    }
    if (!turn) return;
    const missing = u.sessionUpdate === "user_message_chunk" ? "user_message_chunk"
      : ["agent_message_chunk", "agent_thought_chunk"].includes(u.sessionUpdate) && u.content?.type !== "text" ? `${u.sessionUpdate}:${u.content?.type}`
      : ["tool_call", "tool_call_update"].includes(u.sessionUpdate) && u.content?.some(c => c.type !== "content") ? "tool_content:diff/terminal/other" : null;
    if (missing && thread) {
      thread.workerSession.unsupportedUpdates = [...new Set([...(thread.workerSession.unsupportedUpdates || []), missing])].slice(-32);
      this.publishSession(thread);
    }
    if (["agent_message_chunk", "agent_thought_chunk"].includes(u.sessionUpdate) && u.content?.type === "text") {
      const type = u.sessionUpdate === "agent_message_chunk" ? "agentMessage" : "reasoning";
      let item = turn.items.at(-1);
      if (item?.type !== type) { item = { id: randomUUID(), type, text: "" }; turn.items.push(item); this.event("item/started", id, { turnId: turn.id, item: { ...item } }); }
      item.text += u.content.text;
      if (type === "agentMessage") this.event("item/agentMessage/delta", id, { turnId: turn.id, itemId: item.id, delta: u.content.text });
    }
    if (["tool_call", "tool_call_update"].includes(u.sessionUpdate)) {
      let item = turn.items.find(i => i.id === `tool-${u.toolCallId}`);
      const fresh = !item;
      if (!item) { item = { id: `tool-${u.toolCallId}`, type: "mcpToolCall", server: this.name, tool: u.title || "Werkzeug", status: "inProgress" }; turn.items.push(item); }
      if (u.title) item.tool = u.title;
      if (u.status) item.status = u.status === "completed" ? "completed" : u.status === "failed" ? "failed" : "inProgress";
      item.workerId = this.id;
      if (u.rawInput !== undefined) item.arguments = u.rawInput;
      if (u.content) item.result = { content: u.content.filter(c => c.type === "content").map(c => c.content) };
      this.event(item.status === "inProgress" && fresh ? "item/started" : "item/completed", id, { turnId: turn.id, item: structuredClone(item) });
    }
    if (u.sessionUpdate === "plan") this.event("turn/plan/updated", id, { turnId: turn.id, plan: (u.entries || []).map(e => ({ step: e.content, status: e.status })) });
  }
  respond(id, result) {
    const request = this.requests.get(String(id));
    if (!request) throw new Error("Freigabe ist nicht mehr offen.");
    const approved = result?.decision === "accept" || result?.decision === "approved";
    const option = request.native.params.options?.find(o => o.kind === (approved ? "allow_once" : "reject_once"));
    if (approved && !option) throw new Error("Worker bietet keine einmalige Freigabe an.");
    this.rpc.write({ id: request.native.id, result: { outcome: option ? { outcome: "selected", optionId: option.optionId } : { outcome: "cancelled" } } });
    this.requests.delete(String(id));
  }
  async finish(id, status, error = null) {
    const turn = this.running.get(id);
    if (!turn) return;
    this.running.delete(id); turn.status = status; turn.error = error;
    for (const [key, request] of this.requests) if (request.params.threadId === id) {
      this.requests.delete(key); this.event("serverRequest/resolved", id, { requestId: key });
    }
    try { await this.persist(this.threads.get(id)); } catch { turn.status = "failed"; turn.error = { message: "Ergebnis konnte nicht gespeichert werden." }; }
    for (const item of turn.items) this.event("item/completed", id, { turnId: turn.id, item: structuredClone(item) });
    this.event("turn/completed", id, { turn: structuredClone(turn) });
  }
  stop() { this.rpc.stop(); }
}
