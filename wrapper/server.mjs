import {slashCommand, canonicalCommand, commandCatalog, codexTurnCommand, codexControl, goalAction} from './worker-commands.mjs';
import {AIMaintenance, managedCommand, installAIMaintenanceRoutes} from "./ai-maintenance.mjs";
import {installUpdateReviewRoutes} from "./update-review.mjs";
import {calendarChatOpener} from './calendar-chat.mjs';
import {installWeatherRoutes} from './weather.mjs';
import {installationEnvironment} from './worker-environment.mjs';
import {browserThread, threadItem, threadEventFrame} from './thread-view.mjs';
import {createEventBacklog} from './event-backlog.mjs';
import {settingsIntegrations} from './connection-summary.mjs';
import {browserChat} from './chat-summary.mjs';
import { MessageDelivery as BrowserMessageDelivery } from './message-outbox-server.mjs';
import {allowanceReader,recordUsage,tokenFields} from './usage.mjs';
import {readClaudeUsage} from './claude-usage.mjs';
import {workspaceInstructions} from './workspace-directory.mjs';
import {workspaceOnboardingOpener,workspaceOnboardingInstructions} from './workspace-onboarding.mjs';
import {Firma} from './firma.mjs';
import {collectStatistics,statisticsChatOpener} from './statistics.mjs';
import {questionReceipt} from './worker-questions.mjs';
import {weatherChatOpener} from './weather-report.mjs';
import {chatArchiveUpdater} from './chat-archive.mjs';
import {briefingChatOpener} from './briefing-chat.mjs';
import {demoBriefings} from './ui/planner-briefings.mjs';
import {htmlPreviewPolicy, readHtmlPreview} from './html-preview.mjs';
import {saveHandoff, joinHandoff, handoffInstructions} from "./chat-handoff.mjs";
import { searchConversations } from './search.mjs';
import { MessageDelivery } from "./message-delivery.mjs";
import {localPath, localPort} from './isolation.mjs';
import {sharedMemoryCodexConfig} from './shared-memory.mjs';
import {notificationTargets, sendJobNotification, routineInstructions} from './job-notifications.mjs';
import { serverFingerprint, createRestartGate, installationStatus } from "./updates.mjs";
import { coreEnabled, coreRequest, routedContext } from "./core-client.mjs";
import { requestUser, runAs, currentUser, visibleChats, canSeeChat, newChatOwner } from "./users.mjs";
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
import { applySessionSelection, sessionModelSelection, supportedEffort, visibleModels } from "./worker-models.mjs";
import { markReplyRead } from "./chat-read-state.mjs";
import { readAgentProfile } from "./identity-profile.mjs";
import { assignChatTitle } from "./chat-title.mjs";
import { registerFork } from "./chat-fork.mjs";
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
const serverStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
const runningProductVersion = (await installationStatus(root)).version;
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
let messageDelivery;
await store.init();
const secrets = createSecretStore(store);
// Profiles belong to this installation. Host accounts and extensions are never adopted.
const runtime = await prepareCodexHome({
  home: path.join(dataRoot, "codex"),
  chats: store.state.chats.filter(c => !c.workerId || c.workerId === "codex"),
});
const resolveAICommand = async entry => process.env[entry.env] ? await findWorkerCommand(entry) : await managedCommand(dataRoot,entry) || await findWorkerCommand(entry);
const nativeCodex = new Codex({
  cwd: workspace,
  home: runtime.home,
  config: {...runtime.config,...sharedMemoryCodexConfig()},
  binary: await resolveAICommand(workerCatalog.find(w => w.id === "codex")) || "codex",
  contextEnv: { ...await installationEnvironment(dataRoot, 'codex'), AGENT_INTERNAL_TOKEN: process.env.AGENT_INTERNAL_TOKEN || "", COMPANY_BASE: companyRoot(root), SYSTEM_BASE: systemRoot() },
});
const workers = new Workers({ store, root, codex: nativeCodex, resolveCommand: resolveAICommand });
await workers.init();
let backupHold = false;
const clients = new Set(),
  loaded = new ThreadLoading(),
  active = new Map(),
  finishing = new Map(),
  threadCache = new Map();
const eventNames = new Set();
const toolsByThread = new Map(),
  messageCounts = new Map(),
  completedMessages = new Set();
let modelCache = [],
  engineError = null;
const eventBacklog = createEventBacklog();
// A closed browser connection must never take the whole adapter down (write after end).
const writeFrame = (client, line) => {
  if (client.writableEnded || client.destroyed) { clients.delete(client); return; }
  try { client.write(line); } catch { clients.delete(client); }
};
const emit = (event) => {
  const id = eventBacklog.next();
  const line = threadEventFrame(event, id);
  eventBacklog.remember(id, line);
  for (const client of [...clients]) writeFrame(client, line);
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
const deliveryFile = path.join(dataRoot, 'message-delivery.json');
const finishedTurns = new Set();
function observeDeliveryThread(id, thread) {
  for (const turn of thread.turns || []) if (['completed','failed','interrupted'].includes(turn.status)) {
    finishedTurns.add(id + ':' + turn.id);
    if (active.get(id) === turn.id) active.delete(id);
  }
  const live = thread.turns?.find(t => t.status === 'inProgress');
  if (live && !active.has(id) && !finishedTurns.has(id + ':' + live.id)) active.set(id, live.id);
}

const deliveries = await new MessageDelivery({
  read: () => jsonFile(deliveryFile, null), write: state => atomic(deliveryFile, state, {durable:true}),
  active: id => active.get(id), canSteer: id => workers.capability(workers.owner(id)).steer,
  send: (id, payload, delivery) => sendTurn(id, payload, delivery),
  emit: () => emit({ method: 'wrapper/deliveries' }),
  onError: error => emit({ method: 'wrapper/error', params: { message: error.message } }),
}).init();

workers.on("notification", (msg) => {
  void messageDelivery?.observe(msg).catch(()=>{});
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
    if(own(id)){const chat=store.chat(id);(chat.statisticsTurns ||= {})[p.turn.id] ||= {startedAt:Date.now(),model:p.turn.model || chat.model || null};}
    if (own(id)) store.chat(id).lastTurnStatus = "inProgress";
    touch(id);
  }
  if (msg.method === "turn/completed") {
    finishedTurns.add(id + ':' + p.turn.id);
    if (active.get(id) === p.turn.id) active.delete(id);
    void deliveries.finished(id, p.turn).catch(e => emit({method:'wrapper/error',params:{message:e.message}}));
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
    const completion = finishThread(id, p.turn).catch((e) => {
      emit({method:"wrapper/error", params:{message:e.message, threadId:id}});
      throw e;
    }).finally(() => { if (finishing.get(id) === completion) finishing.delete(id); });
    finishing.set(id, completion);
    void completion.catch(() => {});
  }
  if (msg.method === "serverRequest/resolved") {
    const requestId = p.requestId ?? p.id;
    workers.requests.delete(String(requestId));
    emit({ method: "wrapper/requestResolved", params: { id: requestId } });
  }
  if (msg.method === "thread/tokenUsage/updated" && own(id)) {
    recordUsage(store.chat(id),p,msg.workerId || "codex");
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
    void deliveries.disconnected(c.id).catch(e => emit({method:'wrapper/error',params:{message:e.message}}));
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
  serviceTier = null,
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
  if (serviceTier) {
    const models = (await workers.call("model/list", {workerId})).data || [];
    if (workers.entry(workerId).adapter !== "codex" || !models.find(m => m.model === model)?.serviceTiers?.some(t => t.id === serviceTier)) throw new Error("Der gewählte Fast-Modus wird nicht angeboten.");
  }
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
    usageBaseline:Object.fromEntries(tokenFields.map(key=>[key,0])),
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
    serviceTier,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
    pinned: false,
    ownerId: newChatOwner(),
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
  await firma.capture(c, completedTurn);
  await refreshWorkspaceDirectory();
  await channels.complete(id,turn,(completedTurn?.items||[]).filter(i=>i.type==='agentMessage'&&i.phase!=='commentary').map(i=>i.text||'').join('\n\n'),artifacts.filter(a=>a.turnId===turn.id&&a.scope==='workspace'));
  emit({method:'wrapper/library'});
  // Send only the finished turn. A full history can exceed the event-frame limit and would
  // force the browser to reload the whole chat, which is where long chats used to jump.
  emit({ method: "wrapper/thread", params: { thread: completedTurn ? { ...r.thread, turns: [completedTurn], partial: true } : r.thread } });
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
const deliveryReads = new Set();
const deliveryRecovery = setInterval(() => {
  for (const id of new Set(deliveries.state.messages.filter(m => m.status === 'waiting').map(m => m.chatId))) {
    if (!own(id)) continue;
    if (!deliveries.state.gates[id]) deliveries.kick(id);
    else if (!deliveryReads.has(id) && deliveries.state.gates[id].blocked && !deliveries.state.messages.some(m => m.chatId === id && m.status === 'unknown')) {
      deliveryReads.add(id);
      void workers.call('thread/read', {threadId:id, includeTurns:true})
        .then(r => { observeDeliveryThread(id, r.thread); return deliveries.reconcile(id, r.thread); })
        .catch(() => {}).finally(() => deliveryReads.delete(id));
    }
  }
}, 5000);
deliveryRecovery.unref();

async function sendTurn(id, b, delivery) {
  if (backupHold || process.env.VANILLA_RECOVERY_HOLD === "1") throw Object.assign(new Error("Wartung oder Wiederherstellungsprüfung läuft."), {deliveryPaused:true});
  if (turnLocks.has(id)) throw Object.assign(new Error("Eine Nachricht wird gerade übergeben. Bitte kurz warten."), {deliveryPaused:true});
  if (updateHold || restartGate.restarting) throw Object.assign(new Error("Der Server wird neu gestartet. Bitte kurz warten."), {deliveryPaused:true});
  turnLocks.add(id);
  try { return await sendTurnUnlocked(id, b, delivery); } finally { turnLocks.delete(id); deliveries.kick(id); }
}
async function sendTurnUnlocked(id, b, delivery) {
  let c;
  if (b.nextSelection?.workerId && b.nextSelection.workerId !== workers.owner(id)) {
    if (active.has(id)) throw Object.assign(new Error("Die Nachricht wartet auf die laufende Antwort."), {deliveryPaused:true});
    await switchProviderUnlocked(id, b.nextSelection.workerId);
    c = store.chat(id);
    // A provider-only choice uses the new native default, never the old model.
    b = {...b, model:b.nextSelection.model || c.model, effort:b.nextSelection.effort || c.effort, mode:c.mode};
  } else c = await ensure(id);
  if (b.nextSelection && !b.nextSelection.model) b = {...b, nextSelection:{...b.nextSelection, model:c.model}};
  const originalCommand = slashCommand(b.text);
  let commandTurn;
  if (originalCommand) {
    if (active.has(id)) throw Error("Bitte die laufende Antwort vor einem Slash-Befehl abwarten oder stoppen.");
    b = {...b, text:canonicalCommand(b.text)};
    if (workers.entry(workers.owner(id)).adapter === "codex") {
      const known = ['goal','plan','compact'].includes(slashCommand(b.text).name);
      const commands = known ? commandCatalog('codex') : (await workerCommands(id,workers.owner(id),c.projectId)).commands;
      commandTurn = codexTurnCommand(b.text,commands);
      if (commandTurn?.mode) b = {...b,mode:commandTurn.mode};
    }
  }
  const input = [];
  if (b.text?.trim()) input.push({ type: "text", text: b.text });
  if (commandTurn?.skill) input.push(commandTurn.skill);
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
  const checkDelivery = () => {
    if (delivery && (active.get(id) || null) !== delivery.targetTurnId)
      throw Object.assign(new Error('Aufgabe wurde während der Vorbereitung abgeschlossen.'), { deliveryRace: true });
    delivery?.beforeCall();
  };
  if (delivery && (active.get(id) || null) !== delivery.targetTurnId)
    throw Object.assign(new Error('Aufgabe wurde während der Vorbereitung abgeschlossen.'), { deliveryRace: true });
  if (active.has(id)) {
    if (b.nextSelection) throw new Error("Die vorgemerkte Modellwahl gilt für die nächste Antwort. Bitte die laufende Antwort abwarten oder stoppen.");
    if (b.mode && b.mode !== (c.mode || "default"))
      throw new Error(
        "Bitte zuerst die laufende Aufgabe stoppen, bevor du den Modus wechselst.",
      );
    if (!workers.capability(workers.owner(id)).steer) throw new Error("Bitte zuerst die laufende Antwort abwarten oder stoppen.");
    checkDelivery();
    return workers.call("turn/steer", {
      threadId: id,
      expectedTurnId: active.get(id),
      input,
    });
  }
  if (workers.entry(workers.owner(id)).adapter === "codex") modelCache = (await workers.call("model/list", {workerId:workers.owner(id)})).data || [];
  if (b.nextSelection) {
    if ((!b.nextSelection.model && !b.nextSelection.workerId) || (b.nextSelection.model && typeof b.nextSelection.model !== "string") || (b.nextSelection.effort && typeof b.nextSelection.effort !== "string")) throw new Error("Ungültige vorgemerkte Modellwahl.");
    if (workers.entry(workers.owner(id)).adapter === "codex") {
      const selected = visibleModels(modelCache).find(model => model.model === b.nextSelection.model);
      if (!selected || b.nextSelection.effort && supportedEffort(selected, b.nextSelection.effort) !== b.nextSelection.effort) throw new Error("Die vorgemerkte Modellwahl ist nicht mehr verfügbar. Bitte erneut auswählen.");
      b = {...b, model:selected.model, effort:supportedEffort(selected, b.nextSelection.effort)};
    }
  }
  await firma.confirmFromMessage(c,b.text,b.attachments);
  const workspaceContext = await store.workspaces.context(c.projectId || "default");
  const companyContext = await workerInstructions({ root, workspace, cwd: c.cwd })
    + workspaceInstructions(workspaceContext)
    + (c.workspaceOnboarding ? workspaceOnboardingInstructions(workspaceContext.active,workspace) : "")
    + await handoffInstructions(store, c)
    + await firma.context(c)
    + await routedContext({query:b.text || "",projectId:c.projectId || "default",chatId:id})
    + (c.jobId
      ? '\n\nDies ist ein einzelner Lauf eines bereits eingerichteten Jobs. Führe die Aufgabe aus; lege keine neue Routine an. Die Arbeitsanweisung wurde aus SKILL.md im Auftragsordner geladen. Relative Ressourcenpfade beziehen sich auf diesen Ordner. Eingaben liegen in input/, Ergebnisse gehören in output/. Die fertige Antwort wird über die gespeicherte Benachrichtigungsregel zugestellt; versende keine zusätzliche Benachrichtigung selbst.'
      : routineInstructions(c.projectId || 'default'));
  const policy = runMode(b.mode || c.mode || "default");
  if (policy.mode === "plan" && !workers.capability(workers.owner(id)).plan) throw new Error("Dieser Worker bietet hier keinen geschützten Planmodus.");
  const legacyJob = c.jobId && b.mode === undefined;
  const permission = legacyJob || c.channelOnly ? c.permission : policy.permission;
  c.permission = permission;
  c.mode = policy.mode;
  c.model = (workers.entry(workers.owner(id)).adapter === "codex" || c.models?.some(m => m.model === b.model)) ? b.model || c.model : c.model;
  c.effort = b.effort || c.effort || "medium";
  if (c.serviceTier && !modelCache.find(m => m.model === c.model)?.serviceTiers?.some(t => t.id === c.serviceTier)) c.serviceTier = null;
  if (workers.entry(workers.owner(id)).adapter === "acp") {
    let native = (await workers.call("thread/read", {threadId:id})).thread.workerSession;
    if (b.nextSelection?.model) native = await applySessionSelection(native, b.nextSelection, async change => {
      const result = await workers.call(change.configId ? "session/set_config_option" : "session/set_model", {threadId:id, ...change});
      return result.thread.workerSession;
    });
    if (native?.configOptions !== undefined) {
      const selection = sessionModelSelection(native);
      Object.assign(c, {model:selection.model, effort:selection.effort, models:selection.models});
      if (b.nextSelection) b = {...b, model:selection.model, effort:selection.effort};
    }
  }
  if (b.nextSelection?.selectionId) {
    c.appliedComposerSelectionId = b.nextSelection.selectionId;
    c.composerSelection ||= {...b.nextSelection};
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
    ...(workers.entry(workers.owner(id)).adapter === "codex" ? {serviceTierForTurn: c.serviceTier || "default"} : {}),
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
  if (delivery?.continuation) p.collaborationMode.settings.developer_instructions += '\nDiese Nachricht wurde als Ergänzung des vorherigen Auftrags gesendet, der inzwischen endete. Bearbeite sie im Zusammenhang mit diesem Auftrag und behalte unerledigte Arbeit bei.';
  // Keep the exact slash text in the native transcript and delivery receipt.
  // The native goal API owns continuation and usage accounting, never a prompt imitation.
  checkDelivery();
  if (commandTurn?.objective || commandTurn?.resume) {
    await workers.call('thread/goal/set',{threadId:id,...(commandTurn.objective ? {objective:commandTurn.objective} : {}),status:'active'});
    p.collaborationMode.settings.developer_instructions += '\nThe user has explicitly set the native thread goal. Work toward that goal using the native goal tools; do not treat the slash command as an unknown instruction.';
  }
  const r = await workers.call("turn/start", p);
  if (!finishedTurns.has(id + ':' + r.turn.id)) active.set(id, r.turn.id);
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
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/vnd.microsoft.icon",
  ".wasm": "application/wasm",
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
let updateHold = process.env.VANILLA_UPDATE_HOLD === "1";
const routes = new Map();
const route = (method, url, fn) => routes.set(method + " " + url, fn);
const weatherService=installWeatherRoutes(route);
let pausedChannels = [];
route("POST", "/api/system/update-hold", async b => {
  if (typeof b.hold !== 'boolean') throw Error('Ungültige Betriebspause.');
  if (b.hold) {
    updateHold = true;
    if (active.size || turnLocks.size || voiceSessions.size || updateReviews.active() || [...channels.live.keys()].some(id=>channels.hasActive(id))) {
      updateHold = false;
      throw Error('Neue Arbeit ist hinzugekommen. Nach Abschluss erneut installieren.');
    }
    pausedChannels = [...channels.live.keys()];
    for (const id of pausedChannels) await channels.stop(id);
    return {hold:true, channels:pausedChannels};
  }
  const requested = b.channels ?? pausedChannels;
  if (!Array.isArray(requested) || requested.length > 100 || requested.some(id => typeof id !== 'string' || !id || id.length > 200)) throw Error('Ungültiger Anschlussbestand.');
  const restore = [...new Set(requested)];
  updateHold = false;
  for (const id of restore) if (!channels.running(id)) await channels.start(id);
  pausedChannels = [];
  return {hold:false};
});
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
        await aiMaintenance.close();
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
  return {uiVersion, instanceId, updateHold, restartRequired:await sourceVersion() !== startedSourceVersion, activeCount:active.size + turnLocks.size + voiceSessions.size + liveBrowserSessions().length + updateReviews.active()};
});
route("POST", "/api/updates/presence", body => {
  if (typeof body.id !== "string" || !/^[a-f0-9-]{36}$/.test(body.id)) throw new Error("Ungültige Sitzung.");
  liveBrowserSessions();
  if (body.active === true) browserSessions.set(body.id, Date.now()+20000);
  else browserSessions.delete(body.id);
  return {ok:true};
});
route("POST", "/api/system/backup-hold", body => {
  if (!coreEnabled || typeof body.hold !== 'boolean') throw new Error('Ungültige Wartungspause.');
  if (body.hold && (active.size || turnLocks.size || voiceSessions.size || liveBrowserSessions().length || channels.live.size || channels.starting.size)) throw new Error('Laufende Arbeit und aktive Eingangskanäle vor der Sicherung oder Wiederherstellung anhalten.');
  backupHold = body.hold;
  return {ok:true,hold:backupHold};
});
route("POST", "/api/updates/restart", body => restartGate.request(body));

await installSpeechRoutes({ route, dataRoot, recordBoundary, secrets });
const dictations = await installDictationRoutes({ route, dataRoot, recordBoundary, secrets });
const localWorkers = await installLocalWorkerRoutes({ route, dataRoot, recordBoundary });
const aiMaintenance = new AIMaintenance({dataRoot,workers,probeLocal:()=>localWorkers.status(),
  activate:(id,command,commit)=>workers.replaceProgram(id,command,commit,()=>!updateHold && !restartGate.restarting && !active.size && !turnLocks.size && !voiceSessions.size && !liveBrowserSessions().length && !updateReviews.active() && ![...channels.live.keys()].some(key=>channels.hasActive(key)),()=>{loaded.clear();threadCache.clear();}),
});
await aiMaintenance.init();
installAIMaintenanceRoutes({route,maintenance:aiMaintenance});
const updateReviews = installUpdateReviewRoutes({route, workers, dataRoot});
installWorkerRoutes({ route, workers, active, store });
route("GET", "/api/status", async () => ({
  engine: { name: workers.entry(workers.effectiveWorker).name, connected: workers.connected, version: workers.info?.userAgent || null },
  uptimeSeconds: Math.floor(process.uptime()),
  startedAt: serverStartedAt,
  installation: {...await installationStatus(root), version: runningProductVersion},
}));
route("GET", "/api/bootstrap", async (_body, url) => {
  await store.readIdentity();
  await store.workspaces.refresh();
  const modelsByWorker = await workers.modelLists();
  modelCache = modelsByWorker.codex || [];
  const account = workers.connected ? await workers.call("account/read", {}).catch(() => ({})) : {};
  const workerState = await workers.status();
  return {
    token,
    identitySource: "soul/IDENTITY.md",
    workspaceToolsVersion: 1,
    features: { slashCommands:true, messageDelivery:true, workspaceSpecialization:true, jobCategories:true, firma:true, serviceConnections:true, crmConnections:true, skillLibrary:true, library:true },
    workspace,
    projects: store.state.projects,
    workspaceWarnings: store.workspaces.warnings,
    settings: store.state.settings,
    chats: visibleChats(store.state.chats.filter(c=>!c.channelOnly)).map(c=>browserChat(c,url.searchParams.get("view")==="sidebar")),
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
    active: Object.fromEntries([...active].filter(([id])=>canSeeChat(store.state.chats.find(c=>c.id===id)))),
    requests: [...workers.requests.values()].filter(r=>canSeeChat(store.state.chats.find(c=>c.id===r.params?.threadId))).map(r=>({...r,connectionId:store.state.chats.find(c=>c.id===r.params?.threadId)?.connectionId})),
    capabilities: workers.capability(workers.effectiveWorker),
    planAvailable: workers.routingOrder().some(id => workers.capability(id).plan),
  };
});
const updateChat = chatArchiveUpdater({store, workers, active, turnLocks, voiceSessions, loaded, restartGate, emit});
const openWorkspace=workspaceOnboardingOpener({store,newChat,sendTurn,emit,updateChat,canUseChat:async chat=>{
  if(chat.private)return false;
  if(!coreEnabled)return true;
  const {ids}=await coreRequest('chat-privacy/ids');
  if(!Array.isArray(ids))throw Error('Privatsperren konnten nicht geprüft werden.');
  return !ids.includes(chat.id);
}});
route('GET','/api/workspaces',async()=>({projects:await store.workspaces.refresh(),warnings:store.workspaces.warnings}));
route('GET','/api/workspaces/definition',async(_b,u)=>{
  await store.workspaces.refresh();
  const project=store.project(u.searchParams.get('id')||'default');
  return {project,...await store.workspaces.read(project)};
});
route('POST','/api/workspaces/save',async b=>{
  if(restartGate.restarting)throw Error('Der Server wird neu gestartet.');
  const project=await store.workspaces.update(b);
  emit({method:'wrapper/projects'});
  return {project,projects:store.state.projects,settings:store.state.settings};
});
route('POST','/api/workspaces/chat',b=>{
  if(restartGate.restarting)throw Error('Der Server wird neu gestartet.');
  return openWorkspace(b);
});
async function refreshWorkspaceDirectory(){
  const before=JSON.stringify([store.state.projects,store.workspaces.warnings]);
  try{
    await store.workspaces.refresh();
    if(before!==JSON.stringify([store.state.projects,store.workspaces.warnings]))emit({method:'wrapper/projects'});
  }catch(error){console.error('Workspace-Verzeichnis konnte nicht aktualisiert werden:',error.message);}
}
setInterval(refreshWorkspaceDirectory,5000).unref();

const firma = await new Firma({store,companyRoot:companyRoot(root),newChat,sendTurn,emit,updateChat,isBusy:id=>active.has(id)}).init();
route('GET', '/api/firma', () => firma.state());
route('GET', '/api/firma/review', (_b,u) => firma.review(store.chat(u.searchParams.get('id'))));
route('POST', '/api/firma/confirm', async b => {if(restartGate.restarting)throw Error('Der Server wird neu gestartet.');const chat=store.chat(b.id);if(!chat.firmaItemId||typeof b.code!=='string'||!/^[a-f0-9]{12}$/.test(b.code)||chat.firmaReview?.fingerprint!==b.fingerprint)throw Error('Ergebnis bitte erneut laden.');await firma.confirmFromMessage(chat,'Bestätigt '+b.code);return {ok:true};});
route('POST', '/api/firma/chat', b => {if(restartGate.restarting)throw Error('Der Server wird neu gestartet.');return firma.open(b.itemId);});
const openBriefingChat = briefingChatOpener({store, newChat, cache:threadCache, emit, updateChat});
const readStatistics=async(projectId='default',timeZone='Europe/Berlin')=>{
 await store.projectRoot(projectId);
 const excluded=coreEnabled?await coreRequest('chat-privacy/ids'):{ids:[]};
 if(!Array.isArray(excluded?.ids))throw Error('Privatsperren konnten nicht geprüft werden.');
 const privateIds=new Set(excluded.ids);
 return collectStatistics({store,threadCache,projectId,timeZone,isPrivate:async id=>privateIds.has(id)});
};
const openStatisticsChat=statisticsChatOpener({store,collect:readStatistics,openBriefing:openBriefingChat});
route('GET','/api/statistics',(_b,url)=>readStatistics(url.searchParams.get('projectId')||'default',url.searchParams.get('timeZone')||'Europe/Berlin'));
route('POST','/api/statistics/chat',b=>{
 const policy=runMode(b.mode);
 return openStatisticsChat({requestId:b.requestId,projectId:b.projectId,timeZone:b.timeZone,selection:{worker:b.worker||'auto',model:b.model,serviceTier:b.serviceTier||null,mode:policy.mode,permission:policy.permission}});
});
const openWeatherChat = weatherChatOpener({store,weather:weatherService,
  readProfile:()=>readFile(path.join(workspace,'soul','USER.md'),'utf8'),
  openBriefing:openBriefingChat,sendTurn,isRestarting:()=>restartGate.restarting});
route('POST','/api/weather/chat',b=>{
  const policy=runMode(b.mode);
  return openWeatherChat({requestId:b.requestId,projectId:b.projectId,selection:{worker:b.worker||'auto',model:b.model,serviceTier:b.serviceTier||null,mode:policy.mode,permission:policy.permission}});
});
const openCalendarChat=calendarChatOpener({store,readDay:projectId=>coreRequest('calendar/day?'+new URLSearchParams({projectId})),openBriefing:openBriefingChat,sendTurn,isRestarting:()=>restartGate.restarting});
route('POST','/api/calendar/chat',b=>{const policy=runMode(b.mode);return openCalendarChat({requestId:b.requestId,projectId:b.projectId,selection:{worker:b.worker||'auto',model:b.model,serviceTier:b.serviceTier||null,mode:policy.mode,permission:policy.permission}});});
route("POST", "/api/planner/chat", async b => {
  let item;
  if (b.demoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.demoDate) || Number.isNaN(Date.parse(b.demoDate))) throw new Error("Ungültiges Berichtsdatum.");
    item = demoBriefings(b.demoDate).find(entry => entry.id === b.id);
  } else {
    item = await coreRequest('planner/result', {id:b.id});
  }
  if (!item || item.id !== b.id) throw new Error("Bericht nicht verfügbar.");
  return openBriefingChat(item);
});
async function createUiChat(b) {
  const policy = runMode(b.mode);
  const projectId = b.projectId || "default";
  return newChat({
    model: b.model,
    serviceTier: b.serviceTier || null,
    worker: b.worker || "auto",
    title: b.title,
    mode: policy.mode,
    permission: policy.permission,
    projectId,
    cwd: await store.projectRoot(projectId),
  });
}
route("POST", "/api/chats", createUiChat);
route("POST", "/api/projects/save", async (b) => {
  const project = !b.id && b.requestId
    ? await store.workspaces.create({requestId:b.requestId,name:b.name,description:b.description,icon:b.icon,color:b.color,status:'ready'})
    : await store.saveProject({ id: b.id, name: b.name, icon: b.icon, color: b.color, revision:b.revision });
  emit({ method: "wrapper/projects" });
  return {
    project,
    projects: store.state.projects,
    settings: store.state.settings,
  };
});
route("GET", "/api/search", async (b, u) => searchConversations({
  workspace, chats:visibleChats(store.state.chats), projects:store.state.projects, threadCache,
  query:u.searchParams.get("q") || "",
}));
route("GET", "/api/chats", async (_body, url) => ({
  chats: visibleChats(store.state.chats.filter(c=>!c.channelOnly)).map(c=>browserChat(c,url.searchParams.get("view")==="sidebar")),
  active: Object.fromEntries([...active].filter(([id])=>canSeeChat(store.state.chats.find(c=>c.id===id)))),
}));
route("GET", "/api/diagnostics", async () => ({
  events: [...eventNames],
  pending: [...workers.requests.values()].map((r) => ({
    id: r.id,
    method: r.method,
  })),
}));
async function readThread(id) {
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
    observeDeliveryThread(id, r.thread);
    await deliveries.reconcile(id, r.thread);
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

}
route("GET", "/api/thread", async (b, u) => {
  const result = await readThread(u.searchParams.get("id"));
  return u.searchParams.get("view") === "chat" ? {...result,thread:browserThread(result.thread)} : result;
});
route("GET", "/api/thread/item", async (b, u) => {
  const id = u.searchParams.get("id");
  store.chat(id);
  const thread = threadCache.get(id) || (await readThread(id)).thread;
  return threadItem(mergeTools(thread,toolsByThread.get(id)),u.searchParams.get("turnId"),u.searchParams.get("itemId"));
});
route("POST", "/api/chat/speed", async b => {
  const c = store.chat(b.id);
  if (turnLocks.has(b.id) || restartGate.restarting) throw new Error("Bitte die laufende Übertragung abwarten.");
  if (workers.entry(workers.owner(b.id)).adapter !== "codex") throw new Error("Dieser Anschluss bietet keinen Fast-Schalter.");
  turnLocks.add(b.id);
  try {
    const models = (await workers.call("model/list", {workerId:workers.owner(b.id)})).data || [];
    const model = models.find(m => m.model === (b.model || c.model));
    if (b.serviceTier !== null && !model?.serviceTiers?.some(t => t.id === b.serviceTier)) throw new Error("Dieser Geschwindigkeitsmodus wird nicht angeboten.");
    c.serviceTier = b.serviceTier; await store.save();
    emit({method:"wrapper/chats"}); return {serviceTier:c.serviceTier};
  } finally { turnLocks.delete(b.id); }
});
async function switchProviderUnlocked(id, workerId) {
  const c = store.chat(id), b = {workerId};
  if (c.jobId || c.channelOnly) throw new Error("Der Anbieter dieses automatischen Laufs bleibt fest zugeordnet.");
  if (voiceSessions.has(id)) throw new Error("Bitte zuerst die Sprachsession beenden.");
  if (active.has(id)) throw new Error("Die laufende Antwort ist noch nicht abgeschlossen.");
  // Prepare/authenticate first. A failed target leaves the current session intact.
  await workers.connect(b.workerId);
  const target = workers.entry(b.workerId), capabilities = workers.capability(b.workerId);
  if (target.adapter === "codex") {
    const account = await workers.call("account/read", {workerId:b.workerId});
    if (account.requiresOpenaiAuth === true && !account.account) throw new Error("Codex ist nicht angemeldet. Bitte zuerst in der CLI anmelden.");
  }
  const mode = capabilities.plan ? c.mode || "default" : "default";
  const models = target.adapter === "codex" ? (await workers.call("model/list", {workerId:b.workerId})).data || [] : [];
  const model = visibleModels(models).find(m => m.isDefault) || visibleModels(models)[0];
  if (target.adapter === "codex" && !model) throw new Error("Codex meldet keine verfügbaren Modelle der 5.6- oder 6er-Serie.");
  const r = await workers.call("thread/start", {workerId:b.workerId, cwd:await store.projectRoot(c.projectId || "default"), model:model?.model || null,
    ...perms(runMode(mode).permission), approvalsReviewer:"user", historyMode:"legacy", experimentalRawEvents:true});
  await finishing.get(id);
  const previous = mergeTools((await readThread(id)).thread, toolsByThread.get(id));
  const snapshot = await saveHandoff(store, id, previous);
  const old = {...c}, selection = sessionModelSelection(r.thread.workerSession);
  Object.assign(c, {workerId:b.workerId, workerThreadId:r.thread.id, handoffSnapshot:snapshot,
    capabilities, fallbackFrom:null, mode, permission:runMode(mode).permission, model:model?.model || selection.model,
    effort:model ? supportedEffort(model) : selection.effort, models:model ? models : selection.models, serviceTier:null});
  try { await store.save(); } catch (error) { Object.assign(c, old); for (const key of Object.keys(c)) if (!(key in old)) delete c[key]; throw error; }
  loaded.add(id);
  const thread = joinHandoff(id, previous, r.thread);
  threadCache.set(id, thread);
  await store.exportThread(thread);
  emit({method:"wrapper/chats"}); emit({method:"wrapper/thread", params:{thread}});
  return {thread, meta:c};
}
route("POST", "/api/chat/provider", async b => {
  const id = b.id, c = store.chat(id);
  if (b.defer === true) {
    workers.entry(b.workerId);
    if ((c.jobId || c.channelOnly) && b.workerId !== workers.owner(id)) throw new Error("Der Anbieter dieses automatischen Laufs bleibt fest zugeordnet.");
    if (typeof b.selectionId !== "string" || !b.selectionId || (b.model != null && typeof b.model !== "string") || (b.effort != null && typeof b.effort !== "string")) throw new Error("Ungültige Auswahl.");
    const previous = c.composerSelection;
    c.composerSelection = {selectionId:b.selectionId, workerId:b.workerId, model:b.model || null, effort:b.effort || ""};
    try { await store.save(); } catch (error) { c.composerSelection = previous; throw error; }
    emit({method:"wrapper/chats"});
    return {selection:c.composerSelection};
  }
  if (turnLocks.has(id) || restartGate.restarting) throw new Error("Bitte die laufende Übertragung abwarten.");
  if (b.expectedWorker !== workers.owner(id)) throw new Error("Der Anbieter wurde inzwischen geändert. Bitte erneut auswählen.");
  if (b.workerId === workers.owner(id)) return {thread:(await readThread(id)).thread, meta:c};
  if (active.has(id)) throw new Error("Die laufende Antwort ist noch nicht abgeschlossen. Wähle den Anbieter für die nächste Nachricht.");
  turnLocks.add(id);
  try { return await switchProviderUnlocked(id, b.workerId); }
  finally { turnLocks.delete(id); }
});
async function workerCommands(id,workerId,projectId) {
  if (id) {
    const chat = store.chat(id);
    if (workerId !== workers.owner(id)) return {commands:commandCatalog(workerId),notice:'Weitere Befehle nach dem Anbieterwechsel.'};
    projectId = chat.projectId;
    await ensure(id);
    if (workers.entry(workerId).adapter === 'acp') {
      const {thread} = await workers.call('thread/read',{threadId:id});
      return {commands:commandCatalog(workerId,thread.workerSession?.availableCommands),notice:thread.workerSession?.availableCommands === undefined ? 'Der Worker hat noch keine Befehlsliste gemeldet.' : ''};
    }
  }
  if (workerId !== 'codex') return {commands:commandCatalog(workerId),notice:'Weitere native Befehle erscheinen nach der ersten Nachricht.'};
  const cwd = await store.projectRoot(projectId || 'default');
  const result = await workers.call('skills/list',{workerId,cwds:[cwd],forceReload:true});
  const entries = result.data || [];
  return {commands:commandCatalog(workerId,undefined,entries.flatMap(entry=>entry.skills || [])),notice:entries.some(entry=>entry.errors?.length) ? 'Einige Skills konnten nicht geladen werden.' : ''};
}
route("GET", "/api/worker-commands", async (_b,u) => {
  const id=u.searchParams.get('id'), workerId=u.searchParams.get('workerId') || (id ? workers.owner(id) : workers.effectiveWorker);
  workers.entry(workerId);
  return workerCommands(id,workerId,u.searchParams.get('projectId'));
});
route("POST", "/api/worker-command", async b => {
  const id=b.id;
  store.chat(id);
  if (workers.owner(id) !== 'codex' || b.workerId !== 'codex') throw Error('Der Anbieter wurde geändert. Bitte den Befehl erneut auswählen.');
  const command=slashCommand(canonicalCommand(b.text));
  const duringTurn=command?.name === 'goal' && ['get','pause','clear'].includes(goalAction(command.argument));
  if ((!duringTurn && (active.has(id) || finishing.has(id))) || turnLocks.has(id) || restartGate.restarting || updateHold || backupHold || process.env.VANILLA_RECOVERY_HOLD === '1') throw Error('Bitte die laufende Arbeit oder Wartung abwarten.');
  turnLocks.add(id);
  try {
    await ensure(id);
    return await codexControl((method,params)=>workers.call(method,params),id,b.text);
  } finally {turnLocks.delete(id);}
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
route("POST", "/api/turn", async b => {
  if(!b.messageId)return sendTurn(b.id,b);
  store.chat(b.id);
  if(restartGate.restarting)throw Error('Der Server wird neu gestartet.');
  await deliveries.enqueue(b.id,b);
  await deliveries.settle(b.id);
  const status=await deliveries.list(b.id);
  const message=status.messages.find(m=>m.id===b.messageId);
  return {message,blocked:status.blocked,turn:message?.turnId?{id:message.turnId}:undefined};
});
route("GET", "/api/messages", async (_b, u) => {
  const id = u.searchParams.get('id'); store.chat(id);
  return deliveries.list(id);
});
route("POST", "/api/messages", async b => {
  store.chat(b.id);
  if (restartGate.restarting) throw new Error('Der Server wird neu gestartet.');
  return { message: await deliveries.enqueue(b.id, b) };
});
route("POST", "/api/messages/resume", async b => {
  store.chat(b.id);
  if (restartGate.restarting) throw new Error('Der Server wird neu gestartet.');
  // Read-only verification: no cached transcript can prove a worker is idle.
  const r = await workers.call('thread/read', {threadId:b.id,includeTurns:true});
  if (!Array.isArray(r.thread?.turns) || r.thread.turns.some(t => t.status === 'inProgress')) throw new Error('Die vorherige Arbeit läuft noch. Bitte Abschluss abwarten.');
  observeDeliveryThread(b.id, r.thread);
  await deliveries.resume(b.id, b.pauseToken);
  return deliveries.list(b.id);
});
route("POST", "/api/messages/edit", async b => {
  store.chat(b.id);
  return { message: await deliveries.edit(b.id, b.messageId, b.revision, b.text, b.remove === true) };
});
messageDelivery = await new BrowserMessageDelivery({
  store, createChat:createUiChat, send:sendTurn, emit,
  paused:()=>restartGate.restarting, locked:(id, payload)=>turnLocks.has(id) || !!payload?.nextSelection && (active.has(id) || finishing.has(id)),
}).init();
route("POST", "/api/delivery", b => messageDelivery.accept(b));
route("POST", "/api/delivery/action", b => messageDelivery.action(b));
route("GET", "/api/delivery", (b,u) => messageDelivery.transaction(() => messageDelivery.get(u.searchParams.get("clientMessageId"))));
route("GET", "/api/deliveries", (b,u) => messageDelivery.transaction(() => ({entries:messageDelivery.list(u.searchParams.get("id"))})));
setInterval(()=>messageDelivery.kick(),500).unref();

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
route("POST", "/api/chat/update", b => updateChat(b.id, b));
route("POST", "/api/turn/delete", async (b) => {
  if (turnLocks.has(b.id)) throw new Error("Bitte die laufende Übertragung abwarten.");
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
  if (turnLocks.has(b.id)) throw new Error("Bitte die laufende Übertragung abwarten.");
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
  registerFork(store.state.chats, c, r.thread.id);
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
  emit({ method: "wrapper/chats" });
  return r;
});
route("POST", "/api/respond", async (b) => {
  const request = workers.requests.get(String(b.id));
  if (!request) throw new Error("Rückfrage nicht mehr verfügbar.");
  if (request.params?.threadId) store.chat(request.params.threadId);
  if (request.params?.threadId && !canSeeChat(store.state.chats.find(c => c.id === request.params.threadId))) throw new Error("Diese Rückfrage gehört zu einem fremden Chat.");
  const receipt = questionReceipt(request, b.result);
  workers.respond(b.id, b.result);
  if (receipt && request.params?.threadId && request.params?.turnId) {
    const {threadId,turnId} = request.params;
    const records = toolsByThread.get(threadId) || [];
    records.push({turnId,after:messageCounts.get(turnId) || 1,item:receipt});
    toolsByThread.set(threadId,records);
    emit({method:"item/completed",params:{threadId,turnId,item:receipt}});
    // Delivery already succeeded. A storage failure must not invite a second reply.
    await atomic(path.join(workspace,"chats",threadId,"tools.json"),records).catch(() => {
      emit({method:"wrapper/error",params:{threadId,message:"Antwort übermittelt, Rückfrageverlauf konnte nicht gespeichert werden."}});
    });
  }
  emit({ method: "wrapper/requestResolved", params: { id: b.id } });
  return { ok: true };
});
route("GET", "/api/agent/files", async (b,u)=>agentFiles(root,u.searchParams.get("path") || ""));
const readableFile = u => u.searchParams.get("scope") === "agent" ? agentFilePath(root,u.searchParams.get("path") || "") : u.searchParams.get("scope") === "artifacts" ? library.resolve(u.searchParams.get("path") || "",'artifacts') : inside(workspace,u.searchParams.get("path") || "");
route("GET", "/api/files", async (b, u) => {
  const relative = u.searchParams.get("path") || "";
  let files = await store.files(relative);
  // Mitglieder sehen im Dateibrowser nur die Ordner ihrer eigenen Chats.
  if (currentUser().role !== "owner" && relative.replace(/^\.?\/?/, "").replace(/\/$/, "") === "chats")
    files = files.filter(f => canSeeChat(store.state.chats.find(c => c.id === f.name)));
  return { files };
});
route("GET", "/api/file/info", async (b, u) => {
  const file = await readableFile(u);
  const info = await stat(file);
  if (!info.isFile()) throw new Error("Keine Datei.");
  return {size:info.size, htmlPreview: /\.html?$/i.test(file)};
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
route("GET", "/api/integrations", async (_body, url) => {
  const result = {
  connections: store.state.connections.filter(c=>c.kind!=='service').concat(services.list()),
  secrets: await secrets.list(),
  ...mcpSnapshot(workers.effectiveWorker),
  };
  return url.searchParams.get('view') === 'settings' ? settingsIntegrations(result) : result;
});
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
const readAllowances=allowanceReader({enabled:()=>workers.settings.enabled,readCodex:()=>workers.call('account/rateLimits/read',{workerId:'codex'}),readClaude:()=>readClaudeUsage({dataRoot:store.dataRoot,cwd:workspace})});
route('GET','/api/usage/allowances',()=>readAllowances());
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
route("POST", "/api/jobs/save", async b => {
  store.project(b.projectId || 'default');
  if (b.model) {
    if (!b.worker || ['auto','python','n8n'].includes(b.worker)) throw Error('Für eine feste Modellwahl zuerst einen Anbieter wählen.');
    const models = (await workers.modelLists())[b.worker] || [];
    const model = models.find(m=>m.model===b.model && !m.hidden);
    if (!model || b.effort && !model.supportedReasoningEfforts?.some(o=>o.reasoningEffort===b.effort)) throw Error('Modell oder Reasoning nicht verfügbar. Bitte erneut auswählen.');
  } else if (b.effort) throw Error('Für Reasoning zuerst ein Modell wählen.');
  return store.saveJob(b);
});
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
      model: job.model || undefined,
      cwd: path.join(workspace, "jobs", id),
    });
    const c = store.chat(r.thread.id);
    c.jobId = id;
    c.runId = runId;
    c.coreRunId = coreRunId;
    await atomic(path.join(runDir, "request.json"), { jobId: id, worker: job.worker, actualWorker: c.workerId, fallbackFrom: c.fallbackFrom, startedAt: new Date().toISOString() });
    await store.save();
    await sendTurn(c.id, {
      text: job.instructions,
      ...(job.model ? {nextSelection:{model:job.model, effort:job.effort || ''}} : {}),
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
  if ((backupHold || process.env.VANILLA_RECOVERY_HOLD === "1") && req.url !== "/api/system/backup-hold" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) return send(res, 503, {error:"Wiederherstellung prüfen und Betrieb ausdrücklich fortsetzen."});

  if (updateHold && !['GET','HEAD','OPTIONS'].includes(req.method) && new URL(req.url, 'http://localhost').pathname !== '/api/system/update-hold') {
    res.writeHead(503, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'Update wird geprüft. Bitte kurz warten.'})); return;
  }
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
      res.write("retry: 2000\n\n: connected\n\n");
      // Replay what a reconnecting browser missed; outside the window it reloads through wrapper/connected.
      const lastEventId = req.headers["last-event-id"];
      const missed = lastEventId ? eventBacklog.since(lastEventId) : null;
      if (missed) for (const line of missed) res.write(line);
      res.write(threadEventFrame({method: "wrapper/connected", params: {replayed: Boolean(missed), missed: missed ? missed.length : 0}}));
      clients.add(res);
      const interval = setInterval(() => writeFrame(res, ": heartbeat\n\n"), 20000);
      const release = () => { clients.delete(res); clearInterval(interval); };
      req.on("close", release);
      res.on("close", release);
      res.on("error", release);
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
    if (req.method === 'GET' && u.pathname === '/api/file/preview') {
      const content = await readHtmlPreview(await readableFile(u), u.searchParams.has('presentation') ? {channel:u.searchParams.get('presentation')} : {});
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', htmlPreviewPolicy);
      res.setHeader('Content-Length', content.length);
      res.end(content);
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
      const payload = req.method === "GET" ? {} : await body(req);
      const result = await runAs(requestUser(req.headers, coreEnabled), () => fn(payload, u));
      send(res, 200, result);
      return;
    }
    if (u.pathname.startsWith("/api/"))
      return send(res, 404, { error: "Schnittstelle nicht gefunden." });
    if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'Methode nicht erlaubt.'});
    let file;
    try {
      file=await inside(path.join(here,'dist'),decodeURIComponent(u.pathname.slice(1))||'index.html');
      if(!(await stat(file)).isFile())throw Error('Keine Datei.');
    } catch {return send(res,404,{error:'Datei nicht gefunden.'});}
    res.setHeader("Content-Type", mime[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.end(req.method==='HEAD'?undefined:await readFile(file));
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
        await aiMaintenance.close();
    clearInterval(scheduler);
    for (const c of clients) c.end();
    workers.stop();
    server.close(() => process.exit());
  });
