import { searchConversations } from './search.mjs';
import {localPath, localPort} from './isolation.mjs';
import {sharedMemoryCodexConfig} from './shared-memory.mjs';
import {notificationTargets, sendJobNotification, routineInstructions} from './job-notifications.mjs';
import { serverFingerprint, createRestartGate } from "./updates.mjs";
import { coreEnabled, coreRequest, routedContext } from "./core-client.mjs";
import { createMcpSnapshot } from './integration-snapshot.mjs';
import {computerToolStatus} from "./ui/tool-content.mjs";
import { agentFiles, agentFilePath } from "./agent-files.mjs";
import { gitReview } from "./git-review.mjs";
import { installSpeechRoutes } from "./speech.mjs";
import { installDictationRoutes } from "./dictation.mjs";
import { createSecretStore, installIntegrationRoutes } from "./integrations.mjs";
import { companyRoot, ensureCompanyBase } from "../backend/company-base.mjs";
import { workerInstructions, systemRoot } from "../backend/worker-context.mjs";
import { workerCatalog } from "../system/worker-catalog.mjs";
import { ServiceConnections, installServiceRoutes } from "./service-connections.mjs";
import { ChannelRuntime } from "./channel-runtime.mjs";
import { Library, installLibraryRoutes } from "./library.mjs";
import { SkillLibrary, installSkillRoutes } from "./skill-library.mjs";
import { Workers, installWorkerRoutes, findWorkerCommand } from "./workers.mjs";
import { sessionModelSelection } from "./worker-models.mjs";
import { markReplyRead } from "./chat-read-state.mjs";
import { readAgentProfile } from "./identity-profile.mjs";
import { assignChatTitle } from "./chat-title.mjs";
import { conversationInstructions } from "./chat-style.mjs";
import { validateAppearance } from "./ui/appearance.mjs";
import http from "node:http";
import {createReadStream} from "node:fs";
import {pipeline} from "node:stream/promises";
process.umask(0o077);
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Codex } from "./codex.mjs";
import { prepareCodexHome } from "./codex-home.mjs";
import { ThreadLoading, readableCodexError } from "./thread-loading.mjs";
import { installLocalWorkerRoutes } from "./local-workers.mjs";
import { Storage, atomic, inside, safeName, jsonFile } from "./storage.mjs";
import { normalizeTool, mergeTools } from "./tool-events.mjs";
import { runMode, PLAN_INSTRUCTIONS, planApprovalReply } from "./run-mode.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
await ensureCompanyBase(root);
const sourceVersion = () => serverFingerprint(root);
const startedSourceVersion = await sourceVersion();
const instanceId = randomUUID();
const voiceSessions = new Set();
const browserSessions = new Map();
function liveBrowserSessions() {
  const now = Date.now();
  for (const [id, expires] of browserSessions) if (expires < now) browserSessions.delete(id);
  return [...browserSessions.keys()].map(id=>`${id}:browser-voice`);
}
const workspace = localPath(process.env.UWE_WORKSPACE || "workspaces/default");
const dataRoot = localPath(process.env.UWE_DATA_ROOT || "data/control");
const port = localPort(process.env.UWE_PORT || process.env.AGENT_ADAPTER_PORT || 1990);
const token = process.env.AGENT_INTERNAL_TOKEN || randomBytes(32).toString("hex");
const store = new Storage(workspace, dataRoot);
await store.init();
const secrets = createSecretStore(store);
// The private Codex home only isolates runtime state. Account, config and
// extensions come from the host user's Codex login, exactly like a customer
// who ran `codex login` once on their Mac. `UWE_CODEX_SOURCE_HOME=` disables it.
const codexSourceHome = "UWE_CODEX_SOURCE_HOME" in process.env
  ? process.env.UWE_CODEX_SOURCE_HOME || null
  : process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const runtime = await prepareCodexHome({
  home: path.join(dataRoot, "codex"),
  sourceHome: codexSourceHome,
  chats: store.state.chats.filter(c => !c.workerId || c.workerId === "codex"),
});
const nativeCodex = new Codex({
  cwd: workspace,
  home: runtime.home,
  config: {...runtime.config,...sharedMemoryCodexConfig()},
  binary: await findWorkerCommand(workerCatalog.find(w => w.id === "codex")) || "codex",
  contextEnv: { COMPANY_BASE: companyRoot(root), SYSTEM_BASE: systemRoot() },
});
const workers = new Workers({ store, root, codex: nativeCodex });
await workers.init();
const clients = new Set(),
  loaded = new ThreadLoading(),
  active = new Map(),
  threadCache = new Map();
const eventNames = new Set();
const toolsByThread = new Map(),
  messageCounts = new Map(),
  completedMessages = new Set();
let modelCache = [],
  engineError = null;
const emit = (event) => {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(line);
};
const own = (id) => store.state.chats.some((c) => c.id === id);
const touch = (id) => {
  if (own(id)) {
    store.chat(id).updatedAt = Date.now();
    return store.save();
  }
};
const recordBoundary = async (type, meta) => {
  const { appendFile } = await import("node:fs/promises");
  await mkdir(dataRoot, { recursive: true });
  await appendFile(
    path.join(dataRoot, "transfers.ndjson"),
    JSON.stringify({
      at: new Date().toISOString(),
      mode: "prototype",
      type,
      ...meta,
    }) + "\n",
    { mode: 0o600 },
  );
};
const services = new ServiceConnections({store,secrets,workers,recordBoundary});
const library = await new Library({store,root}).init();
const skillLibrary = new SkillLibrary({store,companyRoot:companyRoot(root),workers,home:localPath('data/worker-home'),hermesHome:localPath('data/worker-home/hermes')});
const channels = await new ChannelRuntime({store,services,
  run: async ({connection,session,text,attachments,onThread}) => {
    let id=session.threadId;
    if(!id) {
      const result=await newChat({title:connection.name,worker:connection.worker,projectId:connection.projectId,
        cwd:await store.projectRoot(connection.projectId),permission:'workspace',channelOnly:true,connectionId:connection.id});
      id=result.thread.id;await onThread(id);
    }
    return sendTurn(id,{text,attachments});
  },
  waiting:id=>[...workers.requests.values()].some(r=>r.params?.threadId===id),
  interrupt:async id=>{if(id&&active.has(id))await workers.call('turn/interrupt',{threadId:id,turnId:active.get(id)});},
}).init();
services.runtime=channels;
workers.on("notification", (msg) => {
  if (["thread/realtime/closed", "thread/realtime/error"].includes(msg.method)) voiceSessions.delete(msg.params?.threadId);
  eventNames.add(msg.method);
  const p = msg.params || {},
    id = p.threadId || p.thread?.id;
  if (id && !own(id)) return;
  if (msg.method.startsWith("codex/event/")) return;
  if (msg.method === "rawResponseItem/completed") {
    const raw = p.item,
      records = toolsByThread.get(id) || [];
    const existing = records.find((r) => r.item.id === "tool-" + (raw?.call_id || raw?.tool_use_id || raw?.id));
    const item = normalizeTool(raw, existing?.item);
    if (item) {
      if (existing) existing.item = item;
      else
        records.push({
          turnId: p.turnId,
          after: messageCounts.get(p.turnId) || 1,
          item,
        });
      toolsByThread.set(id, records);
      emit({
        method: existing ? "item/completed" : "item/started",
        params: { threadId: id, turnId: p.turnId, item },
      });
    }
    return;
  }
  if (msg.method.startsWith("rawResponse")) return;
  if (
    msg.method === "item/completed" &&
    ["userMessage", "agentMessage", "plan"].includes(p.item?.type) &&
    !completedMessages.has(p.item.id)
  ) {
    completedMessages.add(p.item.id);
    messageCounts.set(p.turnId, (messageCounts.get(p.turnId) || 0) + 1);
  }
  if (msg.method === "turn/started") {
    active.set(id, p.turn.id);
    if (own(id)) store.chat(id).lastTurnStatus = "inProgress";
    touch(id);
  }
  if (msg.method === "turn/completed") {
    active.delete(id);
    if (own(id)) { store.chat(id).lastTurnStatus = p.turn.status; if (p.turn.status === "completed") store.chat(id).lastCompletedTurnId = p.turn.id; }
    emit({ method: "wrapper/chats" });
    for (const [key, request] of workers.requests) {
      if (
        request.params?.threadId === id &&
        request.params?.turnId === p.turn.id
      ) {
        workers.requests.delete(key);
        emit({ method: "wrapper/requestResolved", params: { id: request.id } });
      }
    }
    touch(id);
    finishThread(id, p.turn).catch((e) =>
      emit({
        method: "wrapper/error",
        params: { message: e.message, threadId: id },
      }),
    );
  }
  if (msg.method === "serverRequest/resolved") {
    const requestId = p.requestId ?? p.id;
    workers.requests.delete(String(requestId));
    emit({ method: "wrapper/requestResolved", params: { id: requestId } });
  }
  if (msg.method === "thread/tokenUsage/updated" && own(id)) {
    store.chat(id).tokenUsage = p.tokenUsage;
    store.save();
  }
  emit(msg);
});
workers.on("request", (msg) => {
  const id = msg.params?.threadId;
  if (id && !own(id)) return;
  const denial =
    id && store.chat(id).mode === "plan" && planApprovalReply(msg.method);
  if (denial) {
    workers.respond(msg.id, denial);
    return;
  }
  const connectionId=id&&store.chat(id).connectionId;
  if(connectionId)msg.connectionId=connectionId;
  emit({ method: "wrapper/request", params: msg });
  if(id && store.chat(id).coreRunId) coreRequest('jobs/attention',{id:store.chat(id).coreRunId}).catch(()=>{});
});
workers.on("disconnected", (error) => {
  for (const c of store.state.chats) if (workers.owner(c.id) === error.workerId) {
    loaded.delete(c.id);
    if (active.has(c.id)) {
      const turnId=active.get(c.id);
      active.delete(c.id); c.lastTurnStatus = "failed";
      void channels.complete(c.id,{id:turnId,status:"failed"},"Worker-Verbindung wurde unterbrochen.").catch(()=>{});
    }
  }
  store.save().catch(() => {});
  if (error.workerId === workers.effectiveWorker) engineError = error.message;
  if (!error.intentional) emit({ method: "wrapper/disconnected", params: error });
  emit({ method: "wrapper/chats" });
});
async function engine(workerId) {
  await workers.start(workerId);
  engineError = null;
}
await engine().catch((e) => (engineError = e.message));
const perms = (mode) =>
  mode === "full"
    ? { approvalPolicy: "never", sandbox: "danger-full-access" }
    : mode === "read"
      ? { approvalPolicy: "on-request", sandbox: "read-only" }
      : { approvalPolicy: "on-request", sandbox: "workspace-write" };
async function ensure(id) {
  const c = store.chat(id);
  // Resolve the portable project reference after the agent folder has moved.
  c.cwd = c.jobId
    ? await inside(workspace, path.join("jobs", safeName(c.jobId)))
    : await store.projectRoot(c.projectId || "default");
  await engine(workers.owner(id));
  await loaded.ensure(id, async () => {
    toolsByThread.set(
      id,
      await jsonFile(path.join(workspace, "chats", id, "tools.json"), []),
    );
    await workers.call("thread/resume", {
      threadId: id,
      cwd: c.cwd,
      ...perms(c.permission || "workspace"),
      ...(c.mode === "plan" ? { approvalPolicy: "never" } : {}),
      approvalsReviewer: "user",
    });
  });
  return c;
}
async function newChat({
  model,
  title,
  cwd = workspace,
  permission = store.state.settings.permission,
  mode = "default",
  projectId = "default",
  worker = "auto",
  channelOnly = false,
  connectionId = null,
} = {}) {
  const selection = await workers.select(worker, { mode });
  const workerId = selection.id;
  const r = await workers.call("thread/start", {
    workerId,
    cwd,
    model: workers.entry(workerId).adapter === "codex" && !selection.fallbackFrom ? model || null : null,
    ...perms(permission),
    ...(mode === "plan" ? { approvalPolicy: "never" } : {}),
    approvalsReviewer: "user",
    historyMode: "legacy",
    // Fresh shared context is supplied with each turn, including the first.
    experimentalRawEvents: true,
  });
  const c = {
    id: r.thread.id,
    workerId,
    fallbackFrom: selection.fallbackFrom,
    ...(channelOnly ? {channelOnly:true,connectionId} : {}),
    capabilities: workers.capability(workerId),
    models: workers.adapters.get(workerId)?.models?.(r.thread) || [],
    title: title || "Neuer Chat",
    ...(title ? { titleStatus: "manual" } : {}),
    cwd,
    permission,
    mode,
    projectId,
    model: r.model || r.thread.model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
    pinned: false,
  };
  store.state.chats.unshift(c);
  loaded.add(c.id);
  threadCache.set(c.id, r.thread);
  await store.exportThread(r.thread);
  await store.save();
  emit({ method: "wrapper/chats" });
  return { ...r, meta: c };
}
async function finishThread(id, turn) {
  if (!own(id)) return;
  let r;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      r = await workers.call("thread/read", { threadId: id, includeTurns: true });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  r.thread = mergeTools(r.thread, toolsByThread.get(id));
  threadCache.set(id, r.thread);
  await atomic(
    path.join(workspace, "chats", id, "tools.json"),
    toolsByThread.get(id) || [],
  );
  await store.exportThread(r.thread);
  const c = store.chat(id);
  const artifacts=await library.registerThread(r.thread,c);
  const completedTurn=r.thread.turns?.find(t=>t.id===turn.id);
  await channels.complete(id,turn,(completedTurn?.items||[]).filter(i=>i.type==='agentMessage'&&i.phase!=='commentary').map(i=>i.text||'').join('\n\n'),artifacts.filter(a=>a.turnId===turn.id&&a.scope==='workspace'));
  emit({method:'wrapper/library'});
  emit({ method: "wrapper/thread", params: { thread: r.thread } });
  if (c.jobId) {
    const job = (await store.jobs()).find((j) => j.id === c.jobId);
    if (job) {
      const result = {
        status: turn.status,
        text: (completedTurn?.items || []).filter(i=>i.type==='agentMessage' && i.phase!=='commentary').map(i=>i.text||'').join('\n\n'),
        threadId: id,
        workerId: c.workerId || "codex",
        fallbackFrom: c.fallbackFrom || null,
        completedAt: new Date().toISOString(),
        error: turn.error || null,
      };
      await atomic(
        path.join(workspace, "jobs", job.id, "runs", c.runId, "result.json"),
        result,
      );
      await atomic(
        path.join(workspace, "jobs", job.id, "output", "latest.md"),
        (r.thread.turns.find((t) => t.id === turn.id)?.items || [])
          .filter((i) => i.type === "agentMessage")
          .map((i) => i.text)
          .join("\n\n"),
      );
      await store.saveJobRun(job.id, {lastRun: { ...result, runId: c.runId }});
      if (c.coreRunId) await coreRequest("jobs/finish", {id:c.coreRunId,status:turn.status,result,error:turn.error?.message || null});
      emit({ method: "wrapper/jobs" });
    }
  }
}
const turnLocks = new Set();
async function sendTurn(id, b) {
  if (turnLocks.has(id)) throw new Error("Eine Nachricht wird gerade übergeben. Bitte kurz warten.");
  if (restartGate.restarting) throw new Error("Der Server wird neu gestartet. Bitte kurz warten.");
  turnLocks.add(id);
  try { return await sendTurnUnlocked(id, b); } finally { turnLocks.delete(id); }
}
async function sendTurnUnlocked(id, b) {
  const c = await ensure(id);
  const input = [];
  if (b.text?.trim()) input.push({ type: "text", text: b.text });
  for (const attachment of b.attachments || []) {
    const file = await inside(workspace, attachment.path);
    const ext = path.extname(file).toLowerCase();
    input.push(
      [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)
        ? { type: "localImage", path: file }
        : [".mp3", ".wav", ".m4a"].includes(ext)
          ? { type: "localAudio", path: file }
          : {
              type: "text",
              text: `Angehängte Datei: ${file}\nLies diese Datei für den Auftrag.`,
            },
    );
  }
  if (!input.length) throw new Error("Nachricht ist leer.");
  // Context belongs to the model instructions, never to the user's visible message.
  await recordBoundary("turn", {
    threadId: id,
    textCharacters: b.text?.length || 0,
    attachments: (b.attachments || []).length,
  });
  if (active.has(id)) {
    if (b.mode && b.mode !== (c.mode || "default"))
      throw new Error(
        "Bitte zuerst die laufende Aufgabe stoppen, bevor du den Modus wechselst.",
      );
    if (!workers.capability(workers.owner(id)).steer) throw new Error("Bitte zuerst die laufende Antwort abwarten oder stoppen.");
    return workers.call("turn/steer", {
      threadId: id,
      expectedTurnId: active.get(id),
      input,
    });
  }
  const companyContext = await workerInstructions({ root, workspace, cwd: c.cwd })
    + await routedContext({query:b.text || "",projectId:c.projectId || "default",chatId:id})
    + routineInstructions(c.projectId || 'default');
  const policy = runMode(b.mode || c.mode || "default");
  if (policy.mode === "plan" && !workers.capability(workers.owner(id)).plan) throw new Error("Dieser Worker bietet hier keinen geschützten Planmodus.");
  const legacyJob = c.jobId && b.mode === undefined;
  const permission = legacyJob || c.channelOnly ? c.permission : policy.permission;
  c.permission = permission;
  c.mode = policy.mode;
  c.model = (workers.entry(workers.owner(id)).adapter === "codex" || c.models?.some(m => m.model === b.model)) ? b.model || c.model : c.model;
  c.effort = b.effort || c.effort || "medium";
  if (workers.entry(workers.owner(id)).adapter === "acp") {
    const native = (await workers.call("thread/read", {threadId:id})).thread.workerSession;
    if (native?.configOptions !== undefined) {
      const selection = sessionModelSelection(native);
      Object.assign(c, {model:selection.model, effort:selection.effort, models:selection.models});
    }
  }
  await store.save();
  const pp = perms(permission);
  const sandboxPolicy =
    permission === "full"
      ? { type: "dangerFullAccess" }
      : permission === "read"
        ? { type: "readOnly" }
        : {
            type: "workspaceWrite",
            writableRoots: [workspace],
            networkAccess: false,
          };
  const p = {
    threadId: id,
    input,
    model: c.model,
    effort: b.effort || null,
    approvalPolicy: legacyJob || c.channelOnly ? pp.approvalPolicy : policy.approvalPolicy,
    approvalsReviewer: "user",
    sandboxPolicy: legacyJob || c.channelOnly ? sandboxPolicy : policy.sandboxPolicy,
    summary: "auto",
  };
  if (policy.mode === "plan")
    p.collaborationMode = {
      mode: "plan",
      settings: {
        model: c.model || modelCache.find((m) => m.isDefault)?.model,
        reasoning_effort: b.effort || "medium",
        developer_instructions: conversationInstructions(PLAN_INSTRUCTIONS) + "\n\n" + companyContext,
      },
    };
  else
    p.collaborationMode = {
      mode: "default",
      settings: {
        model: c.model || modelCache.find((m) => m.isDefault)?.model,
        reasoning_effort: b.effort || null,
        developer_instructions: conversationInstructions() + "\n\n" + companyContext,
      },
    };
  const r = await workers.call("turn/start", p);
  active.set(id, r.turn.id);
  // Title work runs independently and never delays or pollutes the conversation.
  void assignChatTitle({ chat: c, text: b.text, adapter: workers.adapters.get(workers.owner(id)),
    save: () => store.save(), emit }).catch(() => {});
  emit({ method: "wrapper/chats" });
  return r;
}
function send(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let size = 0,
    chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw new Error("Maximal 24 MB pro Upload.");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".svg": "image/svg+xml",
  ".md": "text/plain; charset=utf-8",
};
const routes = new Map();
const route = (method, url, fn) => routes.set(method + " " + url, fn);
const restartGate = createRestartGate({
  sessions: () => [...new Set([...active].map(([id,turn])=>`${id}:${turn}`).concat([...turnLocks].map(id=>`${id}:starting`), [...voiceSessions].map(id=>`${id}:voice`), liveBrowserSessions()))],
  restart: async () => {
    if (coreEnabled) {
      await coreRequest("restart", {});
      return;
    }
    if (typeof process.execve !== "function") throw new Error("Bitte den Server im Terminal neu starten. Diese Node-Version unterstützt keinen Neustart in der App.");
    setTimeout(async () => {
      try {
        clearInterval(scheduler);
        await channels.close();
        localWorkers.close();
        for (const id of active.keys()) if (own(id)) store.chat(id).lastTurnStatus = "interrupted";
        await store.save();
        workers.stop();
        for (const client of clients) client.end();
        server.close(); server.closeAllConnections();
        process.execve(process.execPath, [process.execPath, ...process.execArgv, ...process.argv.slice(1)], process.env);
      } catch (error) { console.error("Server-Neustart fehlgeschlagen", error); process.exit(1); }
    }, 300);
  },
});
route("GET", "/api/updates", async () => {
  const {uiVersion} = await jsonFile(path.join(here,"dist/version.json"), {uiVersion: null});
  return {uiVersion, instanceId, restartRequired:await sourceVersion() !== startedSourceVersion, activeCount:active.size + turnLocks.size + voiceSessions.size + liveBrowserSessions().length};
});
route("POST", "/api/updates/presence", body => {
  if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/.test(body.id)) throw new Error("Ungültige Sitzung.");
  liveBrowserSessions();
  if (body.active === true) browserSessions.set(body.id, Date.now()+20000);
  else browserSessions.delete(body.id);
  return {ok:true};
});
route("POST", "/api/updates/restart", body => restartGate.request(body));

await installSpeechRoutes({ route, dataRoot, recordBoundary, secrets });
const dictations = await installDictationRoutes({ route, dataRoot, recordBoundary, secrets });
const localWorkers = await installLocalWorkerRoutes({ route, dataRoot, recordBoundary });
installWorkerRoutes({ route, workers, active, store });
route("GET", "/api/status", async () => ({
  engine: { name: workers.entry(workers.effectiveWorker).name, connected: workers.connected, version: workers.info?.userAgent || null },
  uptimeSeconds: Math.floor(process.uptime()),
}));
route("GET", "/api/bootstrap", async () => {
  await store.readIdentity();
  const modelsByWorker = await workers.modelLists();
  modelCache = modelsByWorker[workers.effectiveWorker] || [];
  const account = workers.connected ? await workers.call("account/read", {}).catch(() => ({})) : {};
  const workerState = await workers.status();
  return {
    token,
    identitySource: "soul/IDENTITY.md",
    workspaceToolsVersion: 1,
    features: { serviceConnections:true, crmConnections:true, skillLibrary:true, library:true },
    workspace,
    projects: store.state.projects,
    settings: store.state.settings,
    chats: store.state.chats.filter(c=>!c.channelOnly),
    models: modelCache,
    modelsByWorker,
    workers: workerState.workers,
    workerSettings: workerState.settings,
    effectiveWorker: workerState.effectiveWorker,
    account: account.account,
    engine: {
      connected: workers.connected,
      error: engineError,
      version: workers.info?.userAgent,
    },
    active: Object.fromEntries(active),
    requests: [...workers.requests.values()].map(r=>({...r,connectionId:store.state.chats.find(c=>c.id===r.params?.threadId)?.connectionId})),
    capabilities: workers.capability(workers.effectiveWorker),
    planAvailable: workers.routingOrder().some(id => workers.capability(id).plan),
  };
});
route("POST", "/api/chats", async (b) => {
  const policy = runMode(b.mode);
  const projectId = b.projectId || "default";
  return newChat({
    model: b.model,
    worker: b.worker || "auto",
    title: b.title,
    mode: policy.mode,
    permission: policy.permission,
    projectId,
    cwd: await store.projectRoot(projectId),
  });
});
route("POST", "/api/projects/save", async (b) => {
  const project = await store.saveProject({ id: b.id, name: b.name, icon: b.icon, color: b.color });
  emit({ method: "wrapper/projects" });
  return {
    project,
    projects: store.state.projects,
    settings: store.state.settings,
  };
});
route("GET", "/api/search", async (b, u) => searchConversations({
  workspace, chats:store.state.chats, projects:store.state.projects, threadCache,
  query:u.searchParams.get("q") || "",
}));
route("GET", "/api/chats", async () => ({
  chats: store.state.chats.filter(c=>!c.channelOnly),
  active: Object.fromEntries(active),
}));
route("GET", "/api/diagnostics", async () => ({
  events: [...eventNames],
  pending: [...workers.requests.values()].map((r) => ({
    id: r.id,
    method: r.method,
  })),
}));
route("GET", "/api/thread", async (b, u) => {
  const id = u.searchParams.get("id");
  store.chat(id);
  try {
    // Viewing history must not acquire a writer or block another window.
    if (!toolsByThread.has(id))
      toolsByThread.set(
        id,
        await jsonFile(path.join(workspace, "chats", id, "tools.json"), []),
      );
    const r = await workers.call("thread/read", {
      threadId: id,
      includeTurns: true,
    });
    r.thread = mergeTools(r.thread, toolsByThread.get(id));
    threadCache.set(id, r.thread);
    const lastStatus = r.thread.turns.at(-1)?.status;
    const completedId = r.thread.turns.findLast(t => t.status === "completed")?.id;
    if (lastStatus && (store.chat(id).lastTurnStatus !== lastStatus || store.chat(id).lastCompletedTurnId !== completedId)) {
      store.chat(id).lastCompletedTurnId = completedId;
      store.chat(id).lastTurnStatus = lastStatus;
      await store.save();
      emit({ method: "wrapper/chats" });
    }
    return r;
  } catch (e) {
    const cached =
      threadCache.get(id) ||
      (await jsonFile(
        path.join(workspace, "chats", id, "transcript.json"),
        null,
      ));
    if (cached) return { thread: cached };
    throw e;
  }
});
route("POST", "/api/worker-session", async b => {
  const id = b.id;
  store.chat(id);
  if (workers.entry(workers.owner(id)).adapter !== "acp") throw new Error("Dieser Worker verwendet keine ACP-Sitzungseinstellungen.");
  if (active.has(id) || turnLocks.has(id) || restartGate.restarting) throw new Error("Bitte die laufende Arbeit abwarten.");
  turnLocks.add(id);
  try {
    await ensure(id);
    const result = await workers.call(b.configId !== undefined ? "session/set_config_option" : b.modelId !== undefined ? "session/set_model" : "session/set_mode", {
      threadId: id, configId: b.configId, value: b.value, modeId: b.modeId, modelId: b.modelId,
    });
    const selection = sessionModelSelection(result.thread.workerSession);
    Object.assign(store.chat(id), { models: selection.models, model: selection.model, effort: selection.effort });
    await store.save();
    return result;
  } finally { turnLocks.delete(id); }
});
route("POST", "/api/turn", (b) => sendTurn(b.id, b));
route("POST", "/api/stop", async (b) => {
  await ensure(b.id);
  for (let attempt = 0; attempt < 15; attempt++) {
    const turnId = active.get(b.id);
    if (!turnId) break;
    try {
      await workers.call("turn/interrupt", { threadId: b.id, turnId });
      break;
    } catch (e) {
      if (!/no active turn/i.test(e.message) || attempt === 14) throw e;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  return { ok: true };
});
route("POST", "/api/voice/start", async (b) => {
  if (restartGate.restarting) throw new Error("Der Server wird neu gestartet.");
  const c = await ensure(b.id);
  if (c.mode === "plan")
    throw new Error(
      "Sprachchat ist im Planmodus nicht verfügbar. Nutze dafür den Textchat.",
    );
  if (typeof b.sdp !== "string" || b.sdp.length > 100000)
    throw new Error("Sprachverbindung ungültig.");
  await recordBoundary("voice", { threadId: b.id });
  voiceSessions.add(b.id);
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      workers.off("notification", listen);
    };
    const timer = setTimeout(() => {
      cleanup();
      voiceSessions.delete(b.id);
      reject(new Error("Codex hat keine Sprachverbindung bereitgestellt."));
    }, 30000);
    const listen = (msg) => {
      if (msg.params?.threadId !== b.id) return;
      if (msg.method === "thread/realtime/sdp") {
        cleanup();
        resolve({ sdp: msg.params.sdp });
      }
      if (msg.method === "thread/realtime/error") {
        cleanup();
        reject(
          new Error(
            msg.params.message ||
              "Sprachchat ist für diesen Zugang nicht verfügbar.",
          ),
        );
      }
    };
    workers.on("notification", listen);
    workers
      .call("thread/realtime/start", {
        threadId: b.id,
        outputModality: "audio",
        transport: { type: "webrtc", sdp: b.sdp },
      })
      .catch((e) => {
        cleanup();
        voiceSessions.delete(b.id);
        reject(e);
      });
  });
});
route("POST", "/api/voice/stop", async (b) => {
  store.chat(b.id);
  await workers.call("thread/realtime/stop", { threadId: b.id });
  voiceSessions.delete(b.id);
  return { ok: true };
});
route("POST", "/api/chat/read", async (b) => {
  const chat = store.chat(b.id);
  if (markReplyRead(chat, b.turnId)) {
    await store.save();
    emit({ method: "wrapper/chats" });
  }
  return { readTurnId: chat.readTurnId || null };
});
route("POST", "/api/chat/update", async (b) => {
  const c = store.chat(b.id);
  if (b.title !== undefined) {
    c.title = String(b.title).trim().slice(0, 160) || "Neuer Chat";
    c.titleRevision = (c.titleRevision || 0) + 1;
    c.titleStatus = "manual";
  }
  if (b.pinned !== undefined) c.pinned = !!b.pinned;
  if (b.archived !== undefined) {
    if (active.has(b.id))
      throw new Error("Bitte zuerst die laufende Antwort stoppen.");
    await engine(workers.owner(b.id));
    await workers.call(b.archived ? "thread/archive" : "thread/unarchive", {
      threadId: b.id,
    });
    c.archived = !!b.archived;
    loaded.delete(b.id);
  }
  await store.save();
  emit({ method: "wrapper/chats" });
  return c;
});
route("POST", "/api/turn/delete", async (b) => {
  await ensure(b.id);
  if (active.has(b.id)) throw new Error("Bitte zuerst die laufende Antwort stoppen.");
  const current = await workers.call("thread/read", { threadId: b.id, includeTurns: true });
  if (active.has(b.id)) throw new Error("Bitte zuerst die laufende Antwort stoppen.");
  if (current.thread.turns.at(-1)?.id !== b.expectedLastTurnId)
    throw new Error("Das Gespräch wurde inzwischen aktualisiert. Bitte neu laden und erneut versuchen.");
  const index = current.thread.turns.findIndex(t => t.id === b.turnId);
  if (index < 0) throw new Error("Diese Nachricht ist nicht mehr vorhanden.");
  const result = await workers.call("thread/rollback", {
    threadId: b.id, numTurns: current.thread.turns.length - index,
  });
  const retained = new Set(result.thread.turns.map(t => t.id));
  const records = (toolsByThread.get(b.id) || await jsonFile(path.join(workspace, "chats", b.id, "tools.json"), []))
    .filter(r => retained.has(r.turnId));
  toolsByThread.set(b.id, records);
  result.thread = mergeTools(result.thread, records);
  threadCache.set(b.id, result.thread);
  await atomic(path.join(workspace, "chats", b.id, "tools.json"), records);
  await store.exportThread(result.thread);
  await touch(b.id);
  emit({ method: "wrapper/thread", params: { thread: result.thread } });
  emit({ method: "wrapper/chats" });
  return result;
});
route("POST", "/api/fork", async (b) => {
  const c = await ensure(b.id);
  if (active.has(b.id))
    throw new Error("Bitte vor dem Verzweigen die Antwort abschließen lassen.");
  const r = await workers.call("thread/fork", {
    threadId: b.id,
    cwd: c.cwd,
    ...perms(c.permission),
    ...(c.mode === "plan" ? { approvalPolicy: "never" } : {}),
    ...(b.beforeTurnId ? { beforeTurnId: b.beforeTurnId } : {}),
  });
  store.state.chats.unshift({
    ...c,
    id: r.thread.id,
    title: c.title + " · Kopie",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
    pinned: false,
    jobId: null,
    runId: null,
  });
  loaded.add(r.thread.id);
  const inheritedTools = (toolsByThread.get(b.id) || []).filter((record) =>
    r.thread.turns.some((t) => t.id === record.turnId),
  );
  toolsByThread.set(r.thread.id, structuredClone(inheritedTools));
  r.thread = mergeTools(r.thread, inheritedTools);
  threadCache.set(r.thread.id, r.thread);
  await atomic(
    path.join(workspace, "chats", r.thread.id, "tools.json"),
    inheritedTools,
  );
  await store.save();
  await store.exportThread(r.thread);
  return r;
});
route("POST", "/api/respond", async (b) => {
  const request = workers.requests.get(String(b.id));
  if (!request) throw new Error("Rückfrage nicht mehr verfügbar.");
  if (request.params?.threadId) store.chat(request.params.threadId);
  workers.respond(b.id, b.result);
  emit({ method: "wrapper/requestResolved", params: { id: b.id } });
  return { ok: true };
});
route("GET", "/api/agent/files", async (b,u)=>agentFiles(root,u.searchParams.get("path") || ""));
const readableFile = u => u.searchParams.get("scope") === "agent" ? agentFilePath(root,u.searchParams.get("path") || "") : u.searchParams.get("scope") === "artifacts" ? library.resolve(u.searchParams.get("path") || "",'artifacts') : inside(workspace,u.searchParams.get("path") || "");
route("GET", "/api/files", async (b, u) => ({
  files: await store.files(u.searchParams.get("path") || ""),
}));
route("GET", "/api/file/info", async (b, u) => {
  const file = await readableFile(u);
  const info = await stat(file);
  if (!info.isFile()) throw new Error("Keine Datei.");
  return {size:info.size};
});
route("GET", "/api/file/text", async (b, u) => {
  const file = await readableFile(u);
  if ((await stat(file)).size > 2e6)
    throw new Error("Für die Textvorschau zu groß.");
  return { text: await readFile(file, "utf8") };
});
route("POST", "/api/file/save", async (b) => {
  const file = await inside(workspace, b.path);
  if (typeof b.text !== "string" || b.text.length > 2e6)
    throw new Error("Datei zu groß.");
  await atomic(file, b.text);
  return { ok: true };
});
route("POST", "/api/upload", async (b) => {
  const project = store.project(b.projectId || "default");
  const filename = path
    .basename(String(b.name || "datei"))
    .replace(/[^\p{L}\p{N}._ -]/gu, "_");
  if (filename.startsWith("."))
    throw new Error("Versteckte Dateien können nicht angehängt werden.");
  const relative = path.join(
    project.path,
    "input",
    randomUUID().slice(0, 8) + "-" + filename,
  );
  const bytes = Buffer.from(b.base64 || "", "base64");
  if (bytes.length > 24e6) throw new Error("Datei größer als 24 MB.");
  const inputRoot = await inside(workspace, path.join(project.path, "input"));
  await writeFile(path.join(inputRoot, path.basename(relative)), bytes, { mode: 0o600, flag: "wx" });
  return { name: filename, path: relative, size: bytes.length };
});
const mcpSnapshot = createMcpSnapshot({load:async workerId=>{
  const data=[]; let cursor;
  do {
    const result=await workers.call("mcpServerStatus/list", {workerId, ...(cursor?{cursor}:{})});
    data.push(...(result.data || [])); cursor=result.nextCursor;
  } while(cursor && data.length<100);
  return data;
}});
route("GET", "/api/integrations", async () => ({
  connections: store.state.connections.filter(c=>c.kind!=='service').concat(services.list()),
  secrets: await secrets.list(),
  ...mcpSnapshot(workers.effectiveWorker),
}));
route("GET", "/api/computer-use", async (_b, url) => {
  const workerId = url.searchParams.get("worker") || workers.effectiveWorker;
  const entry = workers.entry(workerId);
  if (entry.adapter !== "codex") return {workerId, state:"unknown", tools:[]};
  const servers = []; let cursor;
  do {
    const r = await workers.call("mcpServerStatus/list", {workerId, ...(cursor ? {cursor} : {})});
    servers.push(...(r.data || [])); cursor = r.nextCursor;
  } while (cursor && servers.length < 100);
  return {workerId, ...computerToolStatus(servers)};
});
route("GET", "/api/usage", async () => {
  await engine();
  return workers.call("account/rateLimits/read", {});
});
route("GET", "/api/identity", async () => {
  const source = await readFile(await inside(workspace, "soul/IDENTITY.md"), "utf8");
  return readAgentProfile(source);
});
route("POST", "/api/identity", async (b) => {
  const profile = await store.saveIdentityProfile(b);
  emit({ method: "wrapper/identity", params: { name: profile.name, avatar: profile.avatar, avatarColor: profile.avatarColor, avatarConfigured: profile.avatarConfigured } });
  return profile;
});
route("POST", "/api/settings", async (b) => {
  const appearance = validateAppearance(b);
  if (b.theme !== undefined && !["light", "dark"].includes(b.theme))
    throw new Error("Unbekanntes Erscheinungsbild.");
  Object.assign(store.state.settings, appearance);
  if (b.name !== undefined) await store.setIdentityName(b.name);
  if (b.workspaceName !== undefined)
    await store.saveProject({ id: "default", name: b.workspaceName });
  for (const k of ["theme", "permission"])
    if (b[k] !== undefined)
      store.state.settings[k] = String(b[k]).slice(0, 100);
  await store.save();
  return store.state.settings;
});
route("POST", "/api/engine/reconnect", async () => {
  if (active.size) throw new Error("Es laufen noch Aufträge.");
  workers.stop(workers.effectiveWorker);
  await new Promise((r) => setTimeout(r, 300));
  await engine();
  return { ok: true };
});
route("GET", "/api/jobs", () => store.jobs());
route('GET','/api/jobs/notification-targets',()=>({targets:notificationTargets(services,channels).map(({id,label,ready})=>({id,label,ready}))}));
route('GET','/api/jobs/readiness',async()=>({ready:(await workers.status()).workers.some(w=>workers.routingOrder().includes(w.id)&&w.configured&&w.connected&&w.authenticated!==false)}));
route('POST','/api/jobs/notify',b=>sendJobNotification(services,channels,b));
route("POST", "/api/jobs/save", (b) => store.saveJob(b));
route("POST", "/api/jobs/run", (b) => runJob(b.id, null, b.coreRunId));
route("POST", "/api/terminal", async (b) => {
  await engine();
  if (!b.command?.trim()) throw new Error("Befehl fehlt.");
  return workers.call(
    "command/exec",
    {
      command: ["/bin/zsh", "-lc", b.command],
      cwd: await store.projectRoot(b.projectId || "default"),
      sandboxPolicy: {
        type: "workspaceWrite",
        writableRoots: [workspace],
        networkAccess: false,
      },
      timeoutMs: 30000,
      outputBytesCap: 150000,
    },
    45000,
  );
});
route("GET", "/api/review", async (b, u) => gitReview(
  await store.projectRoot(u.searchParams.get("projectId") || "default"),
));

// Additional connectors and secrets are mounted here, separate from the agent adapter.
await installIntegrationRoutes({ route, store, recordBoundary, secrets });
installServiceRoutes({route,services,runtime:channels});
installLibraryRoutes({route,library,services});
installSkillRoutes({route,skills:skillLibrary});
const jobLocks = new Set();
async function runJob(id, slot = null, coreRunId = null) {
  safeName(id);
  if (jobLocks.has(id)) throw new Error("Dieser Job läuft bereits.");
  const job = (await store.jobs()).find((j) => j.id === id);
  if (!job || job.status === "invalid")
    throw new Error("Job nicht gefunden oder ungültig.");
  if (store.state.chats.some((c) => c.jobId === id && active.has(c.id)))
    throw new Error("Dieser Job läuft bereits.");
  jobLocks.add(id);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    await store.saveJobRun(job.id, {
      lastSlot: slot || job.lastSlot,
      lastRun: {
        status: "running",
        runId,
        startedAt: new Date().toISOString(),
      },
    });
    const runDir = path.join(workspace, "jobs", id, "runs", runId);
    await atomic(path.join(runDir, "request.json"), {
      jobId: id,
      worker: job.worker,
      startedAt: new Date().toISOString(),
    });
    if (job.worker === "n8n") {
      const { invokeConnection } = await import("./integrations.mjs");
      const result = await invokeConnection(
        store,
        job.connectionId,
        { jobId: id, runId, instructions: job.instructions },
        recordBoundary,
      );
      await atomic(path.join(runDir, "result.json"), result);
      await store.saveJobRun(job.id, {
        lastSlot: slot || job.lastSlot,
        lastRun: {
          status: "completed",
          runId,
          completedAt: new Date().toISOString(),
        },
      });
      emit({ method: "wrapper/jobs" });
      return { runId, result };
    }
    const r = await newChat({
      title: job.name,
      worker: job.worker,
      projectId: job.projectId || 'default',
      cwd: path.join(workspace, "jobs", id),
    });
    const c = store.chat(r.thread.id);
    c.jobId = id;
    c.runId = runId;
    c.coreRunId = coreRunId;
    await atomic(path.join(runDir, "request.json"), { jobId: id, worker: job.worker, actualWorker: c.workerId, fallbackFrom: c.fallbackFrom, startedAt: new Date().toISOString() });
    await store.save();
    await sendTurn(c.id, {
      text: `Führe genau diesen einzelnen Lauf des bereits eingerichteten Jobs aus. Lege dafür keine neue Routine an. Die folgende Anweisung wurde aus SKILL.md im aktuellen Ordner geladen; relative Ressourcenpfade beziehen sich auf diesen Ordner. Lies benötigte Dateien in input/ und speichere Ergebnisse in output/.\n\n${job.instructions}`,
    });
    emit({ method: "wrapper/jobs" });
    return { threadId: c.id, runId };
  } catch (e) {
    await store.saveJobRun(job.id, {
      lastSlot: slot || job.lastSlot,
      lastRun: { status: "failed", runId, error: e.message },
    });
    throw e;
  } finally {
    jobLocks.delete(id);
  }
}
const scheduler = setInterval(async () => {
  if (coreEnabled) return;
  try {
    const now = new Date(),
      time = now.toTimeString().slice(0, 5),
      date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    for (const j of await store.jobs()) {
      if (
        j.status !== "active" ||
        !["daily", "weekdays"].includes(j.schedule?.type)
      )
        continue;
      if (j.schedule.type === "weekdays" && [0, 6].includes(now.getDay()))
        continue;
      const slot = date + " " + j.schedule.time;
      if (time === j.schedule.time && j.lastSlot !== slot)
        runJob(j.id, slot).catch((e) =>
          emit({ method: "wrapper/error", params: { message: e.message } }),
        );
    }
  } catch {}
}, 15000);
scheduler.unref();
const server = http.createServer(async (req, res) => {
  if (coreEnabled && req.headers["x-agent-internal"] !== token) return send(res, 403, {error:"Interner Worker-Anschluss geschützt."});
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (!allowedHosts.has(req.headers.host)) {
    return send(res, 403, { error: "Nur lokale Verbindungen erlaubt." });
  }
  if (req.headers.origin) {
    try {
      const o = new URL(req.headers.origin);
      if (o.protocol !== "http:" || !allowedHosts.has(o.host))
        return send(res, 403, { error: "Fremder Ursprung." });
    } catch {
      return send(res, 403, { error: "Ungültiger Ursprung." });
    }
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  try {
    const u = new URL(req.url, `http://127.0.0.1:${port}`);
    if (u.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      const interval = setInterval(() => res.write(": heartbeat\n\n"), 20000);
      req.on("close", () => {
        clients.delete(res);
        clearInterval(interval);
      });
      return;
    }
    if (req.method === "GET" && u.pathname === "/api/dictation/audio") {
      const audio = await dictations.audio(u.searchParams.get("id"));
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Disposition", "attachment; filename=dictation.wav");
      res.end(audio);
      return;
    }
    if (u.pathname === "/api/file/raw") {
      const file = await readableFile(u);
      const ext = path.extname(file).toLowerCase();
      res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      if (
        u.searchParams.get("download") ||
        [".html", ".svg", ".js"].includes(ext)
      )
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`,
        );
      const info = await stat(file);
      if (!info.isFile()) throw new Error("Keine Datei.");
      if (!u.searchParams.get("download") && info.size > 24 * 1024 * 1024) throw new Error("Für die Vorschau zu groß. Bitte herunterladen.");
      res.setHeader("Content-Length", info.size);
      try { await pipeline(createReadStream(file), res); } catch { res.destroy(); }
      return;
    }
    const fn = routes.get(req.method + " " + u.pathname);
    if (fn) {
      if (req.method !== "GET" && req.headers["x-uwe-token"] !== token)
        return send(res, 403, {
          error: "Sitzung abgelaufen. Bitte Seite neu laden.",
        });
      const result = await fn(req.method === "GET" ? {} : await body(req), u);
      send(res, 200, result);
      return;
    }
    if (u.pathname.startsWith("/api/"))
      return send(res, 404, { error: "Schnittstelle nicht gefunden." });
    const file = /^\/fonts\/(?:InterVariable|InterVariable-Italic|IBMPlexMono-Regular)\.woff2$/.test(u.pathname) || /^\/skill-icons\/[a-z-]+\.png$/.test(u.pathname)
      ? u.pathname.slice(1)
      : ["/app.js", "/app.css", "/avatar.png", "/dictation-worklet.js", "/dictation-audio.mjs"].includes(u.pathname)
        ? u.pathname.slice(1)
        : "index.html";
    res.setHeader("Content-Type", mime[path.extname(file)] || "text/plain");
    res.end(await readFile(path.join(here, "dist", file)));
  } catch (e) {
    send(res, 400, { error: readableCodexError(e) });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Agent läuft auf http://127.0.0.1:${port}`),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, async () => {
    await channels.close();
    localWorkers.close();
    clearInterval(scheduler);
    for (const c of clients) c.end();
    workers.stop();
    server.close(() => process.exit());
  });
