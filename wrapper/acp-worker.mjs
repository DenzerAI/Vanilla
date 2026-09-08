import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WorkerRPC } from "./worker-rpc.mjs";

export class ACPWorker extends EventEmitter {
  constructor({ id, name, command, args, cwd, contextEnv, readThread, persist, rpc, mcpServers = () => [] }) {
    super(); Object.assign(this, { id, name, readThread, persist, mcpServers });
    this.rpc = rpc || new WorkerRPC({ command, args, cwd, env: contextEnv });
    this.threads = new Map(); this.sessions = new Map(); this.running = new Map(); this.requests = new Map();
    this.connected = false;
    this.rpc.on("message", msg => this.receive(msg));
    this.rpc.on("disconnected", error => {
      this.connected = false; this.starting = null; this.sessions.clear();
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
      this.info = { ...r, userAgent: r.agentInfo?.version || "ACP 1" };
      this.connected = true;
      return this.info;
    })().catch(e => { this.rpc.stop(); this.starting = null; throw e; });
    return this.starting;
  }
  get capabilities() {
    return { chat: true, streaming: true, attachments: true, approvals: true, plan: false, steer: false, fork: false, archive: true, terminal: false, skills: false };
  }
  models(thread) {
    return (thread?.workerSession?.models?.availableModels || []).map(m => ({ model: m.modelId, displayName: m.name || m.modelId, isDefault: m.modelId === thread.workerSession.models.currentModelId, supportedReasoningEfforts: [] }));
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
      const session = await this.rpc.call("session/new", { cwd: p.cwd, mcpServers: this.mcpServers(p.cwd) });
      if (!session?.sessionId) throw new Error("Worker hat keinen Chat angelegt. Anmeldung prüfen.");
      const thread = { id: `${this.id}-${randomUUID()}`, workerId: this.id, cwd: p.cwd, turns: [], workerSession: session };
      this.threads.set(thread.id, thread); this.sessions.set(session.sessionId, thread.id);
      await this.persist(thread);
      return { thread: structuredClone(thread), model: session.models?.currentModelId || null };
    }
    const thread = p.threadId && await this.thread(p.threadId);
    if (method === "thread/resume") {
      const sid = thread.workerSession.sessionId;
      if (!this.sessions.has(sid)) {
        if (!this.info.agentCapabilities.loadSession) throw new Error(`${this.name} kann diesen Chat nach Neustart nicht fortsetzen. Verlauf bleibt erhalten; bitte neuen Chat beginnen.`);
        // Ignore replay updates until load finishes: our persisted transcript is the display source.
        const result = await this.rpc.call("session/load", { sessionId: sid, cwd: p.cwd, mcpServers: this.mcpServers(p.cwd) });
        if (!result || (result.sessionId && result.sessionId !== sid)) throw new Error("Worker konnte den vorhandenen Chat nicht wiederherstellen. Bitte einen neuen Chat beginnen.");
        thread.workerSession = { ...thread.workerSession, ...result, sessionId: sid };
        thread.cwd = p.cwd; this.sessions.set(sid, thread.id);
      }
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
      if (p.model && p.model !== thread.workerSession.models?.currentModelId) {
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
            const status = r?.stopReason === "cancelled" ? "interrupted" : r?.stopReason === "end_turn" && turn.items.some(i => i.type === "agentMessage" && i.text?.trim()) ? "completed" : "failed";
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
    const id = this.sessions.get(msg.params?.sessionId), turn = this.running.get(id);
    if (msg.id !== undefined) {
      if (msg.method === "session/request_permission" && turn) {
        const key = `${this.id}:${msg.id}`;
        const request = { id: key, method: "item/commandExecution/requestApproval", params: { threadId: id, turnId: turn.id, reason: msg.params.toolCall?.title || "Worker bittet um Freigabe.", workerId: this.id }, native: msg };
        this.requests.set(key, request); this.emit("request", { id: key, method: request.method, params: request.params });
      } else this.rpc.write({ id: msg.id, error: { code: -32601, message: "Diese Client-Funktion ist nicht verfügbar." } });
      return;
    }
    if (msg.method !== "session/update" || !turn) return;
    const u = msg.params.update;
    if (!u) return;
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
