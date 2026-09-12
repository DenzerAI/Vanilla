import {ChatShelf, ShelfFilePreview} from './chat-shelf.tsx';
import {collectShelfEntries} from './chat-shelf.mjs';
import {UsageSettings} from './usage';
import {WorkspaceInfo,WorkspaceDefinitionEditor} from './workspace-settings';
import {PageHeading} from './page-heading';
import {submitMessage} from "./message-submit.mjs";
import {ProductUpdates} from "./product-updates";
import {GitHubConnectionForm} from "./github-connection";
import {MessengerConnectionForm} from "./messenger-connection";
import {MailConnectionForm} from "./mail-connection";

import {createLatestRead} from './latest-read.mjs';
import {DeferredItem} from './deferred-item.jsx';
import {DeliveryChecks} from './delivery-checks';
import {useLiveAction} from './live-action';
import {lazySurface} from './lazy-surface';
import {createSharedApi} from './shared-reads.mjs';
import {copyThreadForEvent,reconcileThreadSnapshot} from './thread-update.mjs';
import {createEventBatcher} from './event-batcher.mjs';
import { createMessageOutbox, deliveryView } from './message-outbox.mjs';
import {PaneShortcutSettings,usePaneShortcuts} from './pane-shortcut-settings.jsx';
import {bindPaneShortcuts} from './pane-shortcuts.mjs';
import { sharedParticlesEnabled } from "./chat-layout.mjs";
import {statisticsTimeZone} from './statistics-client';
import {ComposerQuestion, useComposerQuestion} from './composer-question';
import {questionRequest} from '../worker-questions.mjs';
import {ChatPrivacyDialog, LockedChat} from './chat-privacy';
import {chatPrivacyClient, privacyEvent, privacyChanged, locallyLocked, changeChatPrivacy, watchChatPrivacy} from './chat-privacy-client.mjs';
import { filterJobs, jobFilters, jobStateLabel } from './jobs-view.mjs';
import './jobs.css';
import { StartTextMotionSetting } from './chat-start-preferences';
import { IconMotionSetting } from './icon-motion-setting';
import { IconButton } from './icon-button';
import { CopyButton } from './copy-button';
import { NotificationBell } from './notification-bell';
import {useJobNotifications, JobNotifications, NotificationPreference} from "./job-notifications.jsx";
import { ChapterScrubber } from "./components/ui/chapter-scrubber";
import { PanelLight } from "./panel-light";
import {Skeleton} from './skeleton.tsx';
import { MessageSpeech } from "./message-speech";
import {chatAudio} from "./chat-audio.mjs";
import {ChatAudioControls, ChatAudioButton, useChatAudio} from "./chat-audio-controls";
import { ScrollEdgeFade } from "./scroll-edge-fade.tsx";
import { designVariables, identity as designIdentity } from "./design-system.mjs";
import { SettingsNavigationRow } from "./settings-patterns.jsx";
import { AppLoader, LoaderProvider } from './app-loader';
import { SystemNotice } from "./system-notice.jsx";
import { jobTemplates, jobCategories, jobFromTemplate } from "../job-templates.mjs";
const DeviceConnection = lazySurface(() => import('./device-connection.tsx'), 'DeviceConnection', 'list');
const NetworkConnection = lazySurface(() => import('./device-connection.tsx'), 'NetworkConnection', 'list');
import { uploadAttachmentBatch } from "./attachment-upload.mjs";
import "./workspace-layout.css";
import { createChatScroll } from "./chat-scroll.mjs";
import { createMessageHover } from "./message-hover.mjs";
import { connectionCatalog, connectionCategories, connectionCategory } from "./connection-catalog.mjs";
import './library-connections.css';
import { hasUnreadReply } from "../chat-read-state.mjs";
import { canReadPaneReply } from "./pane-attention.mjs";
import { ComposerFocus } from "./composer-focus";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { MotionConfig } from "motion/react";
import { createRoot } from "react-dom/client";
import { Markdown, ToolImages } from "./chat-rich-content.jsx";
import { isComputerTool, toolOutputText } from "./tool-content.mjs";
import {
  PanelLeft,
  PanelRight,
  Maximize,
  Minimize,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Plus,
  Search,
  Bell,
  Settings,
  SquarePen,
  Clock,
  Plug,
  Folder,
  FolderOpen,
  FileText,
  Terminal,
  Globe,
  GitBranch,
  MoreHorizontal,
  Command,
  Shield,
  ShieldCheck,
  KeyRound,
  Sun,
  Moon,
  Mic,
  AudioLines,
  Square,
  Copy,
  Check,
  X,
  LoaderCircle,
  Pin,
  Archive,
  RotateCcw,
  Download,
  Play,
  Pause,
  Blocks,
  Link,
  ExternalLink,
  BrainCircuit,
  Paperclip,
  Send,
  SlidersHorizontal,
  Ellipsis,
  Activity,
  User,
  Trash2,
  RefreshCw,
  Keyboard,
  Image,
  Volume2,
  Inbox,
  Calendar,
  MessageCircle,
  Braces,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LogIn,
  HardDrive,
  Briefcase,
  Lock,
} from "./icons.jsx";
import "./styles.css";
import "./chat.css";
import "./multi-chat.css";
import { createEventSubscription } from "./chat-events.mjs";
import { ChatMenu, ChatTitle, LayoutPicker, PaneDivider, MessageActions, ComposerHeading } from "./chat-controls.jsx";
import { readPaneLayout, readPaneSession, writePaneState } from "./pane-persistence.mjs";
import { MIN_CHAT_WIDTH, visiblePanes, selectPaneCount, conversationText } from "./chat-layout.mjs";
import { AgentWelcome } from "./avatar-picker.jsx";
import { Modal } from "./modal.jsx";
import "./sidebar-refinement.css";
import { appearanceOptions, projectColor, relativeTime, projectChatList, chatDateGroup } from "./appearance.mjs";
import { fonts, typography } from "./design-system.mjs";
import { timestamp, dayLabel, durationLabel, activityLabel, groupItems, actionRowIndex } from "./chat-presentation.mjs";
import { workerName } from "../../system/worker-catalog.mjs";
import { AgentMenu } from "./agent-menu";
import { Avatar } from "./avatar.jsx";
import { AvatarMotionSetting } from "./avatar-motion-setting.jsx";
import { WelcomeParticles } from "./welcome-particles";
import { nextChatGreeting } from "./chat-greetings.mjs";
import { DictationComposer, RecordingProvider, RecordingIndicator } from "./recording-session.jsx";
import { appendDictation } from "./recording-session.mjs";
import { SettingRow } from "./settings-row.jsx";
import { ModelPicker } from "./model-picker.jsx";
import { preferredModel, sessionModelSelection, supportedEffort } from "../worker-models.mjs";
import { groupSkills } from "./skill-categories.mjs";
import { FilterPicker } from "./filter-picker.jsx";
import {
  BrandIcon,
  SkillIcon,
  skillName,
  skillDescription,
} from "./brand-icon.jsx";
const outboxListeners = new Set();
const messageOutbox = createMessageOutbox({
  storage:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key),keys:()=>Object.keys(localStorage)},
  api:(url,data)=>api(url,data,true,AbortSignal.timeout(15000)),
  changed:entries=>{for(const listener of outboxListeners)listener(entries);},
});
const FirmaPage = lazySurface(() => import('./firma'), 'FirmaPage', 'list');
const FirmaReview = lazySurface(() => import('./firma'), 'FirmaReview', 'list');
const StatisticsDashboard = lazySurface(() => import('./statistics'), 'StatisticsDashboard', 'list');
const WeatherPreview = lazySurface(() => import('./weather-preview'), 'WeatherPreview', 'list');
const WeatherMotionSetting = lazySurface(() => import('./weather-motion'), 'WeatherMotionSetting', 'list');
const ServiceSettings = lazySurface(() => import('./work-evidence.tsx'), 'ServiceSettings', 'list');
const ComposerCommandController = lazySurface(() => import('./composer-commands'), 'ComposerCommandController', null);
const PlannerPage = lazySurface(() => import('./planner'), 'PlannerPage', 'list');
const InboxPage = lazySurface(() => import('./inbox'), 'InboxPage', 'list');
const ChatStart = lazySurface(() => import('./chat-start'), 'ChatStart', 'attention');
const NoteEditor = lazySurface(() => import('./knowledge.tsx'), 'NoteEditor', 'document');
const SystemSearch = lazySurface(() => import('./system-search.tsx'), 'SystemSearch', 'list');
const AppearanceDesign = lazySurface(() => import('./appearance-design.jsx'), 'AppearanceDesign', 'list');
const LoaderSettings = lazySurface(() => import('./loader-settings'), 'LoaderSettings', 'list');
const JobTemplateList = lazySurface(() => import('./job-template-list.jsx'), 'JobTemplateList', 'list');
const ConnectionsContent = lazySurface(() => import('./connections-page.jsx'), 'ConnectionsContent', 'list');
const SystemSettings = lazySurface(() => import('./system-settings'), 'SystemSettings', 'list');
const TailscaleConnection = lazySurface(() => import('./system-settings'), 'TailscaleConnection', 'list');
const CoreRunDetails = lazySurface(() => import('./system-settings'), 'CoreRunDetails', 'list');
const AgentFiles = lazySurface(() => import('./agent-files.jsx'), 'AgentFiles', {compact:true, label:'Ordner wird geladen …'});
const ReviewPanel = lazySurface(() => import('./workspace-review.jsx'), 'ReviewPanel', 'document');
const CrmConnectionForm = lazySurface(() => import('./crm-connection.jsx'), 'CrmConnectionForm', 'list');
const ServiceConnectionForm = lazySurface(() => import('./service-connection.jsx'), 'ServiceConnectionForm', 'list');
const LibraryPage = lazySurface(() => import('./library.jsx'), 'LibraryPage', 'list');
const LibraryPreview = lazySurface(() => import('./library.jsx'), 'LibraryPreview', 'list');
const ImageForm = lazySurface(() => import('./library.jsx'), 'ImageForm', 'list');
const SkillDetails = lazySurface(() => import('./skill-details.jsx'), 'SkillDetails', 'list');
const SkillHub = lazySurface(() => import('./skill-details.jsx'), 'SkillHub', 'list');
const CreateSkillForm = lazySurface(() => import('./skill-details.jsx'), 'CreateSkillForm', 'list');
const UsersSettings = lazySurface(() => import('./users-settings'), 'UsersSettings', 'list');
const AgentPreferences = lazySurface(() => import('./agent-preferences.jsx'), 'AgentPreferences', 'list');
const DesignReference = lazySurface(() => import('./design-reference.jsx'), 'DesignReference', 'list');
const LocalWorkers = lazySurface(() => import('./local-workers.jsx'), 'LocalWorkers', 'list');
const WorkerSettings = lazySurface(() => import('./worker-settings.jsx'), 'WorkerSettings', 'list');
const VoiceSettings = lazySurface(() => import('./voice-settings.jsx'), 'VoiceSettings', 'list');
const AudioConnectionForm = lazySurface(() => import('./voice-settings.jsx'), 'AudioConnectionForm', 'list');
const api = createSharedApi(requestApi);
let csrf = "";
let serverOwnsIdentity = false;
async function requestApi(url, data, retry = true, signal) {
  if (data === undefined && !signal) signal = AbortSignal.timeout(65000);
  const r = await fetch(
    "/api" + url,
    data === undefined
      ? {signal,headers:{"x-chat-client":chatPrivacyClient}}
      : {
          signal,
          method: "POST",
          headers: { "content-type": "application/json", "x-uwe-token": csrf, "x-chat-client":chatPrivacyClient },
          body: JSON.stringify(data),
        },
  );
  const j = await r.json();
  // A response started before locking cannot put a title or approval back on screen.
  if (j?.chats) j.chats = j.chats.map(c=>locallyLocked(c.id) ? {id:c.id,projectId:c.projectId,archived:c.archived,pinned:c.pinned,updatedAt:c.updatedAt,title:'Privater Chat',private:true,locked:true} : c);
  if (j?.requests) j.requests = j.requests.filter(r=>!locallyLocked(r.params?.threadId));
  const requestedChat = data?.id || new URL('/api'+url, location.origin).searchParams.get('id');
  if (r.status === 423 && requestedChat) privacyChanged(requestedChat);
  if ((url.startsWith('/thread?') || url.startsWith('/thread/item?')) && locallyLocked(requestedChat)) throw Object.assign(new Error('Chat gesperrt.'), {status:423});
  if (r.status === 403 && data !== undefined && retry) {
    const session = await fetch("/api/bootstrap", {headers:{"x-chat-client":chatPrivacyClient}});
    const b = await session.json();
    if (session.status === 401) throw Object.assign(new Error(b.error || "Bitte anmelden."), {status:401});
    if (b.token && b.token !== csrf) {
      csrf = b.token;
      return api(url, data, false, signal);
    }
  }
  if (!r.ok) throw Object.assign(new Error(j.error || "Anfrage fehlgeschlagen."), {status:r.status});
  if (url.split("?")[0] === "/bootstrap") {
    csrf = j.token;
    serverOwnsIdentity = j.identitySource === "soul/IDENTITY.md";
    // Keep an already running server compatible without interrupting active turns.
    if (!serverOwnsIdentity) {
      const { text } = await api("/file/text?path=soul%2FIDENTITY.md");
      j.settings.name = text.match(/^Anzeigename:[ \t]*(.*)$/m)?.[1]?.trim().slice(0, 100) || "Agent";
    }
  }
  return j;
}
const icon = (Icon, size = 18) => <Icon size={size} strokeWidth={1.55} />;
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Empty({ Icon = Folder, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon(Icon, 28)}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function RequestCard({ request, onReply }) {
  const [answers, setAnswers] = useState({}),
    [sending, setSending] = useState(false);
  const p = request.params || {},
    m = request.method;
  async function respond(result) {
    setSending(true);
    try {
      await onReply(request.id, result);
    } finally {
      setSending(false);
    }
  }
  if (m.includes("requestUserInput"))
    return (
      <div className="request-card">
        <div className="eyebrow">{icon(MessageCircle)} Rückfrage vom Worker</div>
        {(p.questions || []).map((q) => (
          <Field key={q.id} label={q.question}>
            <div className="answer-options">
              {q.options?.map((o) => (
                <button
                  key={o.label}
                  className={answers[q.id] === o.label ? "selected" : ""}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.label }))}
                >
                  {o.label}
                  <small>{o.description}</small>
                </button>
              ))}
            </div>
            <input
              type={q.isSecret ? "password" : "text"}
              placeholder="Deine Antwort"
              value={answers[q.id] || ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
              }
            />
          </Field>
        ))}
        <button
          className="primary"
          disabled={sending || p.questions.some((q) => !answers[q.id])}
          onClick={() =>
            respond({
              answers: Object.fromEntries(
                p.questions.map((q) => [q.id, { answers: [answers[q.id]] }]),
              ),
            })
          }
        >
          Antwort senden
        </button>
      </div>
    );
  const isPermission = m.includes("permissions/requestApproval"),
    isElicit = m.includes("elicitation"),
    known = /requestApproval|applyPatchApproval|execCommandApproval/.test(m);
  return (
    <div className="request-card">
      <div className="eyebrow">
        {icon(Shield)} Deine Freigabe ist erforderlich
      </div>
      <p>{p.reason || p.message || "Der Worker möchte eine Aktion ausführen."}</p>
      {p.command && (
        <pre>{Array.isArray(p.command) ? p.command.join(" ") : p.command}</pre>
      )}
      {p.permissions && <pre>{JSON.stringify(p.permissions, null, 2)}</pre>}
      {p.changes && <pre>{JSON.stringify(p.changes, null, 2)}</pre>}
      {isElicit &&
        p.requestedSchema &&
        Object.entries(p.requestedSchema.properties || {}).map(([key, s]) => (
          <Field key={key} label={s.title || key}>
            <input
              value={answers[key] || ""}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, [key]: e.target.value }))
              }
            />
          </Field>
        ))}
      {isElicit && p.url && (
        <a href={p.url} target="_blank" rel="noreferrer">
          Verbindung öffnen ↗
        </a>
      )}
      {!known && !isPermission && !isElicit && (
        <p className="muted">
          Diese zusätzliche Worker-Funktion benötigt einen speziellen Anschluss:{" "}
          {m}. Du kannst den Lauf stoppen.
        </p>
      )}
      <div className="row end">
        <button
          disabled={sending}
          onClick={() =>
            respond(
              isPermission
                ? { permissions: {} }
                : isElicit
                  ? { action: "decline" }
                  : { decision: "decline" },
            )
          }
        >
          Ablehnen
        </button>
        {(known || isPermission || isElicit) && (
          <button
            className="primary"
            disabled={sending}
            onClick={() =>
              respond(
                isPermission
                  ? { permissions: p.permissions, scope: "turn" }
                  : isElicit
                    ? { action: "accept", content: answers }
                    : { decision: "accept" },
              )
            }
          >
            Erlauben
          </button>
        )}
      </div>
    </div>
  );
}
import { TurnStatus, ActivityGroup, ActivityIcon } from "./chat-activity.jsx";
import { ChatArtifacts, DiffView, DiffStats, ToolText } from "./chat-artifacts.jsx";
import {activityDetailLabel} from './activity-detail.mjs';
import { FileContent } from "./file-content.jsx";
import { localFilePath } from "./artifact-content.mjs";

function MessageTime({ value }) {
  const ms = timestamp(value);
  return ms == null ? null : <time dateTime={new Date(ms).toISOString()} title={new Date(ms).toLocaleString("de-DE")}>
    {new Date(ms).toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"})}
  </time>;
}
const ChatTurn = React.memo(function ChatTurn({ onForkTurn, onEditTurn, onRetryTurn, onDeleteTurn, turn, statisticsSnapshot, statisticsApi, running, waiting, visible, actionsDisabled, paneNumber = 0, workerId, chatId, chatTitle, ...actions }) {
  // Keep explicit reading choices when the status moves beneath the final answer.
  const [activityOpen, setActivityOpen] = useState(false);
  actions.onFork=()=>onForkTurn(turn); actions.onEdit=()=>onEditTurn(turn);
  actions.onRetry=()=>onRetryTurn(turn); actions.onDelete=()=>onDeleteTurn(turn);
  const [toolOpen, setToolOpen] = useState({});
  const seenSteps = useRef(new Set());
  const onToolToggle = (id, open) => setToolOpen(old => old[id] === open ? old : {...old, [id]:open});
  const finalMessage = (turn.items || []).filter(i => i.type === "agentMessage" && i.phase !== "commentary").at(-1);
  const groups = groupItems(turn.items);
  const activity = groups.filter(group => group.type === "activity").flatMap(group => group.items);
  const collapseCommentary = !running && !!finalMessage;
  const isCommentary = item => item.type === "agentMessage" && item.phase === "commentary";
  const history = (turn.items || []).filter(item => !['userMessage', 'plan'].includes(item.type) && (item.type !== 'agentMessage' || isCommentary(item)));
  const messages = groups.filter(group => group.type === "message" && !(collapseCommentary && isCommentary(group.item)));
  const firstReply = messages.findIndex(group => group.item.type !== "userMessage");
  const lastReply = messages.findLastIndex(group => group.item.type !== "userMessage");
  const actionRow = actionRowIndex(messages, running);
  const artifacts = <ChatArtifacts items={turn.items} workspace={actions.workspace} directory={actions.directory} onFile={actions.onFile} api={api} />;
  const progress = <div className="turn-response-progress" data-mobile-complete={!running && turn.status === "completed" && !activity.some(item=>["failed", "inProgress"].includes(item.status))}>
    {(activity.length || collapseCommentary && history.length) ? <ActivityGroup items={activity} running={running} turn={turn} waiting={waiting} visible={visible} open={activityOpen} onOpenChange={setActivityOpen} seenSteps={seenSteps.current}>
      {(collapseCommentary ? history : activity).map(item => { const View=item.detailsDeferred?DeferredItem:Item; return <View key={item.id} {...(item.detailsDeferred?{api,chatId,turnId:turn.id,Item}:{})} item={item} workerId={workerId} {...actions} running={running} toolOpen={toolOpen} onToolToggle={onToolToggle} />; })}
    </ActivityGroup> : <TurnStatus turn={turn} running={running} waiting={waiting} visible={visible} />}
  </div>;

  return <section className="chat-turn" id={`pane-${paneNumber}-turn-${turn.id}`} tabIndex={-1} aria-label="Nachricht und Antwort">
    {messages.map((group, index) => <React.Fragment key={group.id}>
      {statisticsSnapshot && turn.id === 'briefing-'+statisticsSnapshot.id && group.item.type==='agentMessage'?<StatisticsDashboard data={statisticsSnapshot} api={statisticsApi} visible={visible} reduceMotion={actions.agentProfile?.reduceMotion==='on'}/>:<Item chatId={chatId} chatTitle={chatTitle} item={group.item} beforeActions={index === lastReply ? <>{progress}{artifacts}</> : null} showActions={index === actionRow} workerId={workerId} {...actions} running={actionsDisabled} sentAt={turn.startedAt} completedAt={!running && group.item.id === finalMessage?.id ? turn.completedAt : null} />}
    </React.Fragment>)}
    {firstReply === -1 && !turn.deliveryOnly && <>{progress}{artifacts}</>}
    {turn.error && <div className="inline-error">{icon(AlertCircle)}{turn.error.message}</div>}
  </section>;
});
function DeliveryMark({receipt}) {
  if (!receipt) return null;
  const status=receipt.status;
  const labels={sending:"Wird übertragen",offline:"Wartet auf Verbindung",accepted:"Sicher angekommen",started:"Verarbeitung begonnen",failed:"Nicht gesendet. Erneut versuchen",unknown:"Übergabestatus unklar. Status prüfen"};
  const failed=["failed","unknown"].includes(status);
  const glyph=status==="started"?<DeliveryChecks double/>:status==="accepted"?<DeliveryChecks/>:failed?icon(AlertCircle,12):icon(Clock,12);
  return <span className="message-delivery">{failed?<button type="button" title={receipt.error || labels[status]} aria-label={labels[status]} onClick={()=>messageOutbox.retry(receipt.clientMessageId)}>{glyph}<span>{status === "unknown" ? "Zustellung unklar" : "Nicht gesendet"}</span></button>:<span role="status" aria-label={labels[status]} title={labels[status]}>{glyph}</span>}</span>;
}
function Item({ chatId, chatTitle, item, detailLoading, detailError, onDetailRetry, beforeActions, showActions = false, agentProfile, workerId, onFork, onEdit, onRetry, onDelete, onRecover, onFile, running, sentAt, completedAt, workspace, directory, toolOpen, onToolToggle }) {
  const i = item;
  const UserActions = i.delivery && !i.delivery.turnId ? "div" : MessageActions;
  const disclosure = {open:!!toolOpen?.[i.id], onToggle:event=>{if(event.target === event.currentTarget) onToolToggle?.(i.id,event.currentTarget.open);}};
  if (i.type === "userMessage")
    return (
      <div className="user-message-row">
      <div className="message-attachments">{(i.content || []).filter(c => c.type !== "text").map((c,n) => c.path && /image/i.test(c.type) ? <button key={n} className="message-thumbnail" aria-label={"Bild öffnen: " + c.path.split("/").pop()} onClick={() => onFile(localFilePath(c.path, workspace, directory) || c.path)}><img src={"/api/file/raw?path=" + encodeURIComponent(c.path.startsWith(workspace + "/") ? c.path.slice(workspace.length + 1) : c.path)} alt={c.path.split("/").pop()} loading="lazy" /></button> : <span className="attachment" key={n}>{icon(Paperclip,15)}{c.path?.split("/").pop() || "Anhang"}</span>)}</div>
      {(i.content || []).some(c => c.type === "text") && <div className="user-message">
        {(i.content || []).filter(c => c.type === "text").map((c, n) =>
          c.type === "text" ? (
            <p key={n}>{c.text}</p>
          ) : (
            <span className="attachment" key={n}>
              {icon(
                c.type.toLowerCase().includes("image") ? Image : Paperclip,
                15,
              )}
              {c.path?.split("/").pop() || "Anhang"}
            </span>
          ),
        )}
        </div>}
        <UserActions className={UserActions === "div" ? "message-actions user-actions" : "user-actions"}>
          {!i.delivery?.turnId && i.delivery ? <>
          {['failed','unknown'].includes(i.delivery.status) && <>
            <IconButton label="Erneut senden" disabled={running} onClick={()=>onRecover(i.delivery,'retry')}>{icon(RotateCcw,14)}</IconButton>
            <IconButton label="Nachricht bearbeiten" disabled={running} onClick={()=>onRecover(i.delivery,'edit')}>{icon(SquarePen,14)}</IconButton>
            <IconButton label="Nachricht löschen" onClick={()=>onRecover(i.delivery,'discard')}>{icon(Trash2,14)}</IconButton>
          </>}
          <CopyButton label="Nachricht kopieren" size={14} text={i.delivery.text || ''}/>
          </> : <>
          <IconButton label="Nachricht erneut ausführen" disabled={running} onClick={onRetry}>{icon(RotateCcw, 14)}</IconButton>

          <IconButton
            label="Nachricht bearbeiten und verzweigen"
            disabled={running}
            onClick={onEdit}
          >
            {icon(SquarePen, 14)}
          </IconButton>
          <CopyButton label="Nachricht kopieren" size={14} text={(i.content || []).filter(c => c.type === "text").map(c => c.text).join("\n")} />
          <IconButton label="Nachricht löschen" disabled={running} onClick={onDelete}>{icon(Trash2,14)}</IconButton>
          </>}
          <span className="message-meta"><MessageTime value={sentAt} /><DeliveryMark receipt={i.delivery}/></span>
        </UserActions>
      </div>
    );
  if (i.type === "agentMessage" || i.type === "plan")
    return (
      <div
        className={
          "agent-message " +
          (i.phase === "commentary" ? "commentary-message" : "")
        }
        title={timestamp(completedAt ?? sentAt) == null ? undefined : new Date(timestamp(completedAt ?? sentAt)).toLocaleString("de-DE")}
      >
        {i.type === "plan" && <span className="eyebrow">Plan</span>}
        <Markdown text={i.text} onFile={onFile} workspace={workspace} directory={directory} />
        {beforeActions}
        {/* Only the finished answer of a turn carries the action row. A streaming
            or intermediate message is not a closed message and gets none. */}
        {showActions && <MessageActions className="agent-actions">
          {i.type === "agentMessage" && i.phase !== "commentary" && <MessageSpeech title={chatTitle} chatId={chatId} messageId={i.id} text={i.text} disabled={running} api={api} Button={IconButton} />}
          <CopyButton label="Antwort kopieren" size={15} text={i.text} />
          <IconButton label="Ab dieser Antwort verzweigen" disabled={running} onClick={onFork}>
            {icon(GitBranch, 15)}
          </IconButton>
          <IconButton
            label="Nachricht erneut ausführen"
            disabled={running}
            onClick={onRetry}
          >
            {icon(RotateCcw, 15)}
          </IconButton>
        </MessageActions>}
      </div>
    );
  if (i.type === "reasoning")
    return i.summary?.length || i.content?.length ? (
      <details className="tool-item" {...disclosure}>
        <summary>
          {icon(BrainCircuit, 16)}Gedanken{icon(ChevronDown, 14)}
        </summary>
        {disclosure.open && <Markdown text={(i.summary || i.content || []).join("\n\n")} />}
      </details>
    ) : null;
  if (i.type === "imageView" || i.type === "imageGeneration") {
    const p = i.path || i.savedPath;
    return (
      <div className="tool-item">
        {icon(Image, 16)}{" "}
        {activityLabel(i, running && i.status === "inProgress")}{" "}
        {p && <button onClick={() => onFile(localFilePath(p, workspace, directory) || p)}>{p.split("/").pop()}</button>}
      </div>
    );
  }
  const labels = {
    commandExecution: "Terminal",
    fileChange: "Dateien geändert",
    mcpToolCall: `${i.server} · ${i.tool}`,
    dynamicToolCall: i.tool,
    webSearch: "Websuche",
    collabAgentToolCall: "Zusammenarbeit",
    functionCallOutput: i.name,
    contextCompaction: "Kontext zusammengefasst",
    sleep: "Wartet",
    subAgentActivity: "Agentenaktivität",
  };
  const changes = Array.isArray(i.changes) ? i.changes : [];
  const rawOutput = () => <>
    <ToolImages item={i}/>
    {i.query && <ToolText value={i.query}/>}
    {i.command && <ToolText value={i.command}/>}
    {i.aggregatedOutput && !i.toolContent?.length && <ToolText value={i.aggregatedOutput}/>}
    {i.error && <ToolText value={i.error}/>}
    <ToolText value={toolOutputText(i)}/>
  </>;
  return (
    <details className="tool-item" {...disclosure}>
      <summary>
        <ActivityIcon item={i}/>
        <span className={i.status === "failed" ? "activity-failed" : undefined}>{i.detailsDeferred ? (running && i.status === "inProgress" ? i.displayLiveLabel : i.displayLabel) : isComputerTool(i) && i.status !== "failed" ? i.arguments?.title || activityDetailLabel(i, running && i.status === "inProgress") : activityDetailLabel(i, running && i.status === "inProgress")}</span>
        <DiffStats changes={changes} status={i.status} stats={i.displayDiffStats}/>


        {icon(ChevronDown, 14)}
      </summary>
      {disclosure.open && (detailLoading ? <Skeleton variant="document"/> : detailError ? <div role="alert"><p>{detailError}</p><button onClick={onDetailRetry}>Erneut versuchen</button></div> : <>
      <div className="tool-detail-label">{labels[i.type] || "Werkzeug"}{i.status === "failed" ? " · Fehlgeschlagen" : ""}</div>
      <div className="tool-provenance">{workerName(i.workerId || workerId || "codex")}{isComputerTool(i) ? " · Computer Use" : ""}</div>
      {!changes.length && rawOutput()}
      {changes.map((c, n) => (
        <div key={n}>
          <button className="file-link" title={c.path} onClick={() => onFile(localFilePath(c.path, workspace, directory) || c.path)}>
            {icon(FileText, 15)}
            {c.path?.split(/[\\/]/).at(-1)}
          </button>
          <DiffStats changes={[c]} status={i.status}/>
          <DiffView diff={c.diff} />
        </div>
      ))}
      {!!changes.length && <details className="tool-raw-output" open={!!toolOpen?.[`${i.id}:output`]} onToggle={event=>{if(event.target===event.currentTarget)onToolToggle?.(`${i.id}:output`,event.currentTarget.open);}}><summary>Werkzeugausgabe</summary>{toolOpen?.[`${i.id}:output`] && rawOutput()}</details>}
      </>)}
    </details>
  );
}
const projectGlyphs = { folder: Folder, code: Braces, briefcase: Briefcase, globe: Globe, idea: BrainCircuit, calendar: Calendar, message: MessageCircle, files: FileText };
function App({ embedded = false, sessionRef, onSessionChange, onActivate, paneNumber = 0, panePosition = 0, showPaneHeader = false, isMaximized = false, onMaximize, onClosePane, onOpenFile, onOpenCalendar, onOpenSettings, paneVisible = true, paneActive = false, initialProject = "default" }) {
  const [libraryRevision,setLibraryRevision]=useState(0);
  const [libraryJob,setLibraryJob]=useState(null);
  const historyReads=useRef(null);
  historyReads.current ||= createLatestRead((url,signal)=>api(url,undefined,true,signal));
  useEffect(()=>()=>historyReads.current.cancel(),[]);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return Math.max(220, Math.min(400, Number(localStorage.getItem("sidebar-width")) || 268)); } catch { return 268; }
  });
  const workspacePanelRef = useRef(null);
  const [agentFolderTarget, setAgentFolderTarget] = useState(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(null);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const shelfReturnFocus=useRef(null);
  function setPanel(next) {
    if (next && !panel) { setWorkspaceWidth(null); setWorkspaceExpanded(false); }
    setWorkspacePanel(next);
  }
  useEffect(() => { if (!embedded) { try { localStorage.setItem("sidebar-width", sidebarWidth); } catch {} } }, [sidebarWidth, embedded]);
  const [savedLayout] = useState(() => readPaneLayout());
  const [paneRestored, setPaneRestored] = useState(false);
  const [paneOrder, setPaneOrder] = useState(savedLayout.order);
  const paneLabel = (embedded ? panePosition : Math.max(0,paneOrder.indexOf(0))) + 1;
  const [mountedPanes, setMountedPanes] = useState(() => [...new Set([0, ...savedLayout.order])]);
  const [activePane, setActivePane] = useState(savedLayout.active);
  const [paneWidth, setPaneWidth] = useState(0);
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia("(max-width: 650px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 650px)");
    const update = () => setMobileViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [paneWeights, setPaneWeights] = useState(savedLayout.weights);
  const [maximizedPane, setMaximizedPane] = useState(false);
  const [, redrawSessions] = useState(0);
  const sessions = useRef(Array.from({length:4}, () => ({current:null})));
  const selectedWorkspaceRef = useRef(initialProject);
  const panesRef = useRef(null), activePaneRef = useRef(savedLayout.active), draftCache = useRef(new Map());
  const [draftTitle, setDraftTitle] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragDepth = useRef(0), uploadCounts = useRef(new Map());
  const [pendingUploads, setPendingUploads] = useState([]);
  const draftKey = () => chatRef.current || `new:${projectRef.current}`;
  const sessionChanged = useCallback(() => redrawSessions(n => n + 1), []);
  useEffect(() => {
    if (!embedded) writePaneState("layout", {order:paneOrder, active:activePane, weights:paneWeights});
  }, [embedded, paneOrder, activePane, paneWeights]);
  const visible = visiblePanes(paneOrder, activePane, paneWidth, maximizedPane || mobileViewport);
  const activatePane = (id) => { activePaneRef.current = id; setActivePane(id); };
  function changePaneCount(count) {
    const order = selectPaneCount(paneOrder, activePane, count);
    setPaneOrder(order); setMountedPanes(old => [...new Set([...old, ...order])]);
    setMaximizedPane(false); setPaneWeights({});
  }
  function closePane(id) {
    if (paneOrder.length === 1) return;
    const next = paneOrder.filter(p => p !== id);
    setPaneOrder(next); setPaneWeights({});
    if (activePane === id) activatePane(next[0]);
  }
  function resizePanes(left, right, delta) {
    const a = panesRef.current?.querySelector(`[data-pane="${left}"]`), b = panesRef.current?.querySelector(`[data-pane="${right}"]`);
    if (!a || !b) return;
    const aw = a.getBoundingClientRect().width, bw = b.getBoundingClientRect().width;
    const d = Math.max(MIN_CHAT_WIDTH-aw, Math.min(delta, bw-MIN_CHAT_WIDTH));
    setPaneWeights(old => {
      const next = {...old};
      visible.forEach(id => { next[id] = panesRef.current.querySelector(`[data-pane="${id}"]`).getBoundingClientRect().width; });
      return {...next, [left]:aw+d, [right]:bw-d};
    });
  }
  const [greeting, setGreeting] = useState(nextChatGreeting);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [selectedTurn, setSelectedTurn] = useState(null);
  const [replyTarget,setReplyTarget]=useState(null);
  const [expandedLists, setExpandedLists] = useState({});
  const [listClock, setListClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setListClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const [connectionCategoryFilter, setConnectionCategoryFilter] = useState('all');
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [connectionsError, setConnectionsError] = useState('');
  const connectionsRefresh = useRef({pending:null,at:0});
  const systemNoticeRef = useRef(null);
  const [boot, setBoot] = useState(null),
    [audioConnections, setAudioConnections] = useState({Groq:false, ElevenLabs:false}),
    [view, setView] = useState(() => !embedded && ["inbox", "today", "calendar", "pipeline", "jobs", "firma", "work-evidence", "service"].includes(new URLSearchParams(window.location.search).get("view")) ? (["work-evidence", "service"].includes(new URLSearchParams(window.location.search).get("view")) ? "settings" : ["today", "pipeline"].includes(new URLSearchParams(window.location.search).get("view")) ? "chat" : new URLSearchParams(window.location.search).get("view")) : "chat"),
    [chatId, setChatId] = useState(null),
    [thread, setThread] = useState(null),
    [threadError, setThreadError] = useState(""),
    [bootError, setBootError] = useState(""),
    [privacyLocked, setPrivacyLocked] = useState(false),
    [chats, setChats] = useState([]),
    [active, setActive] = useState({}),
    [requests, setRequests] = useState([]),
    [text, setText] = useState(""),
    [attachments, setAttachments] = useState([]),
    [model, setModel] = useState(""),
    [draftWorker, setDraftWorker] = useState("auto"),
    [nextSelections, setNextSelections] = useState({}),
    [draftSpeed, setDraftSpeed] = useState(null),
    [effort, setEffort] = useState("medium"),
    [mode, setMode] = useState("default"),
    [projectId, setProjectId] = useState(initialProject),
    [expandedProject, setExpandedProject] = useState("default"),
    [workspaceMenu, setWorkspaceMenu] = useState(null),
    [panel, setWorkspacePanel] = useState(null),
    [sidebar, setSidebar] = useState(() => window.innerWidth > 650),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(null),
    [welcome, setWelcome] = useState(false),
    [search, setSearch] = useState(""),
    [settingsTab, setSettingsTab] = useState(() => ["work-evidence", "service"].includes(new URLSearchParams(window.location.search).get("view")) ? "service" : "general"),
    [selectedFile, setSelectedFile] = useState(null),
    [selectedShelfImage, setSelectedShelfImage] = useState(null),
    [jobs, setJobs] = useState([]),
    [jobsLoading, setJobsLoading] = useState(true),
    [jobsError, setJobsError] = useState(""),
    [integrations, setIntegrations] = useState({
      connections: [],
      secrets: [],
      mcp: [],
    }),
    [skills, setSkills] = useState([]),
    [skillsLoading, setSkillsLoading] = useState(true),
    [skillsError, setSkillsError] = useState(""),
    [skillFilter, setSkillFilter] = useState("all"),
    [skillSource, setSkillSource] = useState('all'),
    [terminalInput, setTerminalInput] = useState(""),
    [terminalOutput, setTerminalOutput] = useState(""),
    [terminalBusy, setTerminalBusy] = useState(false),
    [jobFilter, setJobFilter] = useState("all"),
    [serverRestartBusy, setServerRestartBusy] = useState(false),
    [chatMenu, setChatMenu] = useState(null),
    [connectionState, setConnectionState] = useState("connecting");
  const [updatesTab, setUpdatesTab] = useState("version");
  const connectionsActive = view === "settings" && settingsTab === "connections";
  const skillsActive = view === "settings" && settingsTab === "skills";
  function closeMobileNavigation() {
    if (window.matchMedia("(max-width: 650px)").matches) setSidebar(false);
  }
  function openSettings(section) {
    if (embedded && onOpenSettings) { onOpenSettings(section); return; }
    closeMobileNavigation();
    setSettingsTab(section);
    setView("settings");
  }
  const [inboxSidebarHost, setInboxSidebarHost] = useState(null);
  const inboxActiveRef = useRef(view === "inbox");
  inboxActiveRef.current = view === "inbox";
  useEffect(() => {
    if (embedded || view !== "inbox") return;
    const previousSidebar = sidebar;
    setSidebar(true);
    return () => setSidebar(previousSidebar);
  }, [view, embedded]);
  const projectRef = useRef(initialProject),
    chatRef = useRef(null),
    scrollRef = useRef(null),
    hoverController = useRef(null),
    scrollController = useRef(null),
    inputRef = useRef(null),
    uploadRef = useRef(null),
    followScroll = useRef(true);
  const questionState = useComposerQuestion(requests, chatId, async (id, result) => {
    await api("/respond", {id, result});
    setRequests(rs => rs.filter(r => String(r.id) !== String(id)));
  });
  const ComposerInput = questionState.question?.isSecret ? "input" : "textarea";
  const composerText = questionState.request ? questionState.text : text;
  const setComposerText = value => questionState.request ? questionState.setText(typeof value === "function" ? value(questionState.text) : value) : setText(value);
  const [engagedChatId, setEngagedChatId] = useState(undefined);
  const paneShortcuts=usePaneShortcuts();
  const paneShortcutState=useRef(null), dictationControl=useRef(null);
  const selectedPane = embedded ? paneActive : activePane === 0;
  const composerActive = selectedPane && engagedChatId === chatId;
  const activateComposer = () => {
    setEngagedChatId(chatId);
    if (embedded) onActivate?.(); else activatePane(0);
  };
  paneShortcutState.current={bindings:paneShortcuts,view,modal,order:paneOrder,activate:activatePane};
  useEffect(()=>{
    if(embedded)return;
    return bindPaneShortcuts(window,{
      state:()=>paneShortcutState.current,
      visibilityTarget:document,
      available:()=>!document.hidden && document.hasFocus() && !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'),
      active:()=>activePaneRef.current,
      session:id=>sessions.current[id].current,
      notify,
      schedule:fn=>requestAnimationFrame(fn),
      cancel:frame=>cancelAnimationFrame(frame),
    });
  },[embedded]);
  // A draft becoming a saved chat keeps intentional input focus. Restoration does not.
  useEffect(() => {
    setEngagedChatId(inputRef.current && document.activeElement === inputRef.current ? chatId : undefined);
  }, [chatId]);
  useEffect(() => { if (!selectedPane) setEngagedChatId(undefined); }, [selectedPane]);
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    const resize = () => {
      if (!field.getClientRects().length || !field.clientWidth) return;
      const style = getComputedStyle(field);
      const limit = parseFloat(style.maxHeight);
      // Measure without scrollbars: their height must never feed back into sizing.
      field.style.overflowY = "hidden";
      field.style.height = "0px";
      const contentHeight = field.scrollHeight;
      field.style.height = `${Math.min(contentHeight, limit)}px`;
      field.style.overflowY = contentHeight > limit ? "auto" : "hidden";
      const entry = field.closest(".composer-entry");
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const singleLineHeight = Math.max(parseFloat(style.minHeight), parseFloat(style.lineHeight) + verticalPadding);
      if (entry) entry.dataset.multiline = String(!!field.value && contentHeight > singleLineHeight + 1);
    };
    resize();
    const frame = requestAnimationFrame(resize);
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width !== resize.width) { resize.width = width; resize(); }
    });
    observer.observe(field);
    document.fonts.addEventListener("loadingdone", resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", resize);
    };
  }, [composerText, view, chatId, !!boot, boot?.settings?.textSize, boot?.settings?.uiFont, paneVisible]);
  useLayoutEffect(() => {
    const area = inputRef.current?.closest(".composer-area");
    const pane = area?.closest(".chat-main");
    if (!area || !pane) return;
    const measure = () => {
      if (area.getClientRects().length) {
        pane.style.setProperty("--composer-height", `${area.getBoundingClientRect().height}px`);
        scrollController.current?.sync();
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [!!boot, view, chatId]);
  useEffect(() => {
    if (embedded) return;
    const observer = new ResizeObserver(entries => { setPaneWidth(entries[0].contentRect.width); setPaneWeights({}); });
    if (panesRef.current) observer.observe(panesRef.current);
    return () => observer.disconnect();
  }, [embedded, !!boot, view]);
  const current = chats.find((c) => c.id === chatId),
    running = !!active[chatId],
    project = boot?.projects?.find((p) => p.id === projectId);
  const selectionKey = chatId || `new:${projectId}`;
  const composerSelection = nextSelections[selectionKey] || current?.composerSelection;
  const actualWorker = current?.workerId || (draftWorker === "auto" ? boot?.effectiveWorker || "codex" : draftWorker);
  const pickerWorker = composerSelection?.workerId || actualWorker;
  const sameWorker = pickerWorker === actualWorker;
  const nativeSelection = sameWorker && thread?.workerSession ? sessionModelSelection(thread.workerSession) : null;
  const knownModels = workerId => boot?.modelsByWorker?.[workerId]?.length ? boot.modelsByWorker[workerId]
    : chats.find(c => c.workerId === workerId && c.models?.length)?.models || [];
  const pickerModels = nativeSelection?.models || (sameWorker && current?.models?.length ? current.models : knownModels(pickerWorker));
  const nextSelection = composerSelection && composerSelection.selectionId !== current?.appliedComposerSelectionId ? composerSelection : undefined;
  const pickerModel = composerSelection?.model || (sameWorker ? nativeSelection?.model || model : "");
  const pickerEffort = composerSelection?.effort || (sameWorker ? nativeSelection?.effort || supportedEffort(pickerModels.find(m => m.model === model), effort) : "");
  const selectionWrites = useRef(new Map());
  const toastTimer = useRef(null);
  const notify = useCallback((msg) => {
    if (embedded) {
      window.dispatchEvent(new CustomEvent("wrapper/notice", {detail:msg}));
      return;
    }
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 5500);
  }, [embedded]);
  useEffect(() => {
    if (embedded) return;
    const receive = event => notify(event.detail);
    window.addEventListener("wrapper/notice", receive);
    return () => {window.removeEventListener("wrapper/notice", receive); clearTimeout(toastTimer.current);};
  }, [embedded, notify]);
  // Run event handlers synchronously so preventDefault and currentTarget remain valid.
  const guard =
    (fn) =>
    (...args) => {
      try {
        return Promise.resolve(fn(...args)).catch((e) => notify(e.message));
      } catch (e) {
        notify(e.message);
      }
    };
  const chatLocked = privacyLocked || !!current?.locked;
  useEffect(() => {
    const changed = event => {
      const {id, locked} = event.detail;
      if (locked) {
        setModal(null); setPanel(null); setSelectedFile(null); setTerminalOutput('');
        setRequests(old=>old.filter(r=>r.params?.threadId !== id));
        setChats(old=>old.map(c=>c.id === id ? {id:c.id,projectId:c.projectId,archived:c.archived,pinned:c.pinned,updatedAt:c.updatedAt,title:'Privater Chat',private:true,locked:true} : c));
        setBoot(old=>old ? {...old,chats:[],requests:[]} : old);
      }
      if (chatRef.current === id) {
        setPrivacyLocked(locked);
        if (locked) {historyReads.current.cancel();setThread(null);setLoading(false);}
      }
      refreshChats().catch(()=>{});
    };
    window.addEventListener(privacyEvent, changed);
    return ()=>window.removeEventListener(privacyEvent, changed);
  }, []);
  useEffect(() => {
    if (!chatId || !current?.private || chatLocked) return;
    return watchChatPrivacy(api, chatId, ()=>{
      changeChatPrivacy(api,'lock',chatId).catch(()=>notify('Chat hier gesperrt. Sperren auf anderen Geräten bitte nach Wiederverbindung erneut ausführen.'));
    });
  }, [chatId, current?.private, chatLocked]);
  async function privacyUnlocked() {
    setPrivacyLocked(false);
    await refreshChats();
    const id=chatRef.current;
    const result=await historyReads.current.read('/thread?view=chat&id='+encodeURIComponent(id));
    if(chatRef.current===id) setThread(result.thread);
  }
  async function refreshChats() {
    const r = await api("/chats?view=sidebar");
    setChats([...r.chats,...messageOutbox.snapshot().filter(e=>!e.chatId && e.status !== 'cancelled').map(e=>({id:e.localId,projectId:e.projectId,title:e.text.slice(0,40)||"Neue Nachricht",updatedAt:e.createdAt}))]);
    for (const c of r.chats) if(c.locked && !locallyLocked(c.id)) privacyChanged(c.id);
    setActive(r.active);
  }
  useEffect(() => {
    const settings = boot?.settings;
    if (!settings) return;
    const root = document.documentElement;
    const scale = settings.textSize === "large" ? 1.125 : settings.textSize === "small" ? 0.9375 : 1;
    for (const role of typography) root.style.setProperty(`--text-${role.id}`, `${role.size * scale / 16}rem`);
    root.style.setProperty("--font-ui", settings.uiFont === "system" ? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : fonts.find(font => font.token === "font-ui").value);
    root.dataset.reduceMotion = settings.reduceMotion || "system";
    root.dataset.iconAnimation = settings.iconAnimation || "hover";
    root.dataset.avatarStyle = settings.avatarMotion || "face";
    for (const [key, value] of Object.entries(designVariables(settings.theme, settings.designTone, settings.highlightColor))) root.style.setProperty(key, value);
  }, [boot?.settings]);
  async function loadJobs() {
    setJobsLoading(true); setJobsError("");
    try { setJobs(await api("/jobs")); }
    catch (error) { setJobsError(error.message); }
    finally { setJobsLoading(false); }
    try { setIntegrations(await api("/integrations?view=settings")); } catch (error) { notify(error.message); }
  }
  async function refresh() {
    setBootError("");
    let b;
    try { b = await api("/bootstrap?view=sidebar"); }
    catch(error) {setBootError("Die Verbindung braucht zu lange oder ist unterbrochen. Bitte erneut versuchen.");throw error;}
    csrf = b.token;
    setBoot(b);
    if (!embedded && b.settings.avatarConfigured === false && !sessionStorage.getItem(`agent-welcome:${b.workspace}`)) {
      setWelcome(true);
      sessionStorage.setItem(`agent-welcome:${b.workspace}`, "seen");
    }
    setChats(b.chats);
    for (const c of b.chats) if(c.locked && !locallyLocked(c.id)) privacyChanged(c.id);
    setActive(b.active);
    setRequests(b.requests);
    setConnectionState(b.engine.connected ? "online" : "offline");
    setModel(m => m || preferredModel(b.models, b.effectiveWorker || "codex")?.model || "");
    document.documentElement.dataset.theme = b.settings.theme;
    return b;
  }
  useEffect(() => {
    guard(refresh)();
    const es = createEventSubscription();
    let opened = false;
    // Full reload after a reconnect without replay; the server confirms every connection with wrapper/connected.
    const reload = () => {
      api("/bootstrap?view=sidebar")
        .then((b) => {
          csrf = b.token;
          setBoot(old=>old?{...old,features:b.features}:b);
          setRequests(b.requests);
          setConnectionState(b.engine.connected ? "online" : "offline");
        })
        .catch(() => setConnectionState("offline"));
      const reopening = chatRef.current;
      if (reopening)
        api("/thread?view=chat&id=" + reopening)
          .then((r) => {
            if (chatRef.current === reopening && !locallyLocked(reopening)) setThread(old=>reconcileThreadSnapshot(old,r.thread));
          })
          .catch(() => {});
      refreshChats().catch(() => {});
    };
    es.onerror = () => setConnectionState("reconnecting");
    const handleEvent = (e) => {
      const p = e.params || {};
      if (e.method === 'wrapper/connected') {
        if (!opened) { opened = true; return; }
        if (p.replayed) { api('/status').then(s => setConnectionState(s.engine.connected ? 'online' : 'offline')).catch(() => {}); void messageOutbox.pump(); return; }
        reload();
        return;
      }
      if (e.method === 'chat/privacy') { api('/chat/privacy/status?id='+encodeURIComponent(p.id)).then(r=>privacyChanged(p.id,r.locked)).catch(()=>privacyChanged(p.id)); return; }
      if (e.method === 'wrapper/delivery') { void messageOutbox.pump(); return; }
      if (e.method === 'wrapper/resync') { reload(); api('/jobs').then(setJobs).catch(()=>{}); return; }
      if (e.method === 'core/event') {
        if (!embedded) window.dispatchEvent(new CustomEvent('core/event', {detail:p}));
        if(p.kind==='system.health' && p.payload?.status==='error' && p.payload?.notify) notify('Systemprüfung: '+(p.payload.details?.message||p.entity_id||'Bitte Einstellungen prüfen.'));
        return;
      }
      if (e.method === "wrapper/identity") {
        setBoot(old => old ? {...old, settings: {...old.settings, ...p}} : old);
        return;
      }

      if(e.method === "wrapper/library"){setLibraryRevision(v=>v+1);return;}
      if (e.method === "wrapper/chats") {
        guard(refreshChats)();
        return;
      }
      if (e.method === "wrapper/projects") {
        api("/bootstrap?view=sidebar")
          .then((b) =>
            setBoot((old) => ({
              ...old,
              projects: b.projects,
              workspaceWarnings: b.workspaceWarnings,
              settings: b.settings,
            })),
          )
          .catch(() => {});
        return;
      }
      if (e.method === "worker/session/updated") {
        if (p.threadId === chatRef.current) setThread(old => old ? { ...old, workerSession: p.workerSession } : old);
        return;
      }
      if (e.method === "wrapper/thread") {
        // A partial snapshot carries one finished turn; it only ever updates an already loaded chat.
        if (p.thread?.id === chatRef.current && !locallyLocked(p.thread.id)) setThread(old=>old || !p.thread.partial ? reconcileThreadSnapshot(old,p.thread) : old);
        return;
      }
      if (e.method === "wrapper/jobs") {
        api("/jobs")
          .then(setJobs)
          .catch(() => {});
        return;
      }
      if (e.method === "wrapper/disconnected") {
        setRequests(rs => rs.filter(r => r.workerId !== p.workerId));
        api("/status").then(s => setConnectionState(s.engine.connected ? "online" : "offline")).catch(() => setConnectionState("offline"));
        notify(p.message);
        return;
      }
      if (e.method === "wrapper/error") {
        notify(p.message);
        return;
      }
      if (e.method === "wrapper/request") {
        setRequests(rs => rs.some(r => String(r.id) === String(p.id))
          ? rs.map(r => String(r.id) === String(p.id) ? p : r) : [...rs,p]);
        return;
      }
      if (e.method === "wrapper/requestResolved") {
        setRequests((r) => r.filter((x) => String(x.id) !== String(p.id)));
        return;
      }
      if (e.method === "turn/started")
        setActive((a) => ({ ...a, [p.threadId]: p.turn.id }));
      if (e.method === "turn/completed") {
        setChats(old => old.map(c => c.id === p.threadId ? {...c, lastTurnStatus: p.turn.status, ...(p.turn.status === "completed" ? {lastCompletedTurnId:p.turn.id} : {}), updatedAt: Date.now()} : c));
        setActive((a) => {
          const n = { ...a };
          delete n[p.threadId];
          return n;
        });
        if (p.turn.error) notify(p.turn.error.message);
      }
      if (p.threadId !== chatRef.current) return;
      if (e.method === "turn/diff/updated") {
        return;
      }
      setThread((prev) => {
        if (locallyLocked(chatRef.current)) return null;
        if (!prev) return prev;
        const t = copyThreadForEvent(prev, p);
        t.turns ??= [];
        let turn = t.turns.find(
          (x) => x.id === p.turnId || x.id === p.turn?.id,
        );
        if (e.method === "turn/started") {
          if (!turn) {
            const pending = t.turns.find((x) => x.clientPending);
            if (pending) {
              const userItems = pending.items;
              Object.assign(pending, p.turn);
              pending.items = p.turn.items?.some(
                (i) => i.type === "userMessage",
              )
                ? p.turn.items
                : [...userItems, ...(p.turn.items || [])];
              delete pending.clientPending;
            } else t.turns.push(p.turn);
          }
          return t;
        }
        if (e.method === "turn/completed") {
          if (turn) {
            const oldItems = turn.items;
            Object.assign(turn, p.turn);
            if (!turn.items?.length) turn.items = oldItems;
          } else t.turns.push(p.turn);
          return t;
        }
        if (!turn && p.turnId) {
          turn = { id: p.turnId, items: [], status: "inProgress" };
          t.turns.push(turn);
        }
        if (!turn) return prev;
        if (e.method === "item/started" || e.method === "item/completed") {
          if (p.item.type === "userMessage")
            turn.items = turn.items.filter((i) => !i.clientPending);
          const idx = turn.items.findIndex((i) => i.id === p.item.id);
          if (idx >= 0) turn.items[idx] = p.item;
          else turn.items.push(p.item);
          return t;
        }
        if (
          e.method === "item/agentMessage/delta" ||
          e.method === "item/plan/delta"
        ) {
          let item = turn.items.find((i) => i.id === p.itemId);
          if (!item) {
            item = {
              id: p.itemId,
              type: e.method.includes("/plan/") ? "plan" : "agentMessage",
              text: "",
            };
            turn.items.push(item);
          }
          item.text += p.delta;
          return t;
        }
        if (e.method === "item/commandExecution/outputDelta") {
          const item = turn.items.find((i) => i.id === p.itemId);
          if (item)
            item.aggregatedOutput = (item.aggregatedOutput || "") + p.delta;
          return t;
        }
        if (e.method === "item/reasoning/summaryTextDelta") {
          const item = turn.items.find((i) => i.id === p.itemId);
          if (item) {
            item.summary ??= [];
            item.summary[p.summaryIndex] =
              (item.summary[p.summaryIndex] || "") + p.delta;
          }
          return t;
        }
        return prev;
      });
    };
    // Text deltas are merged per animation frame; other events flush them first and keep their order.
    const batcher = createEventBatcher(handleEvent);
    es.onmessage = ({ data }) => batcher.push(JSON.parse(data));
    return () => es.close();
  }, []);
  useEffect(() => {
    chatRef.current = chatId;
    setAwayFromBottom(false);
    setSelectedTurn(null);
  }, [chatId]);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (scrollController.current?.element !== element) {
      scrollController.current?.dispose();
      scrollController.current = element
        ? createChatScroll(element, followScroll, setAwayFromBottom)
        : null;
      hoverController.current?.dispose();
      hoverController.current = element ? createMessageHover(element) : null;
    }
    scrollController.current?.sync();
  });
  useEffect(() => () => { scrollController.current?.dispose(); hoverController.current?.dispose(); }, []);
  useEffect(()=>{
    if(!replyTarget||loading||thread?.id!==replyTarget.chatId)return;
    const frame=requestAnimationFrame(()=>{
      const turn=document.getElementById(`pane-${paneNumber}-turn-${replyTarget.turnId}`);
      if(turn){
        followScroll.current=false;
        const reply=turn.querySelector('.turn-response-header')||turn;
        reply.scrollIntoView({block:'start',behavior:'instant'});
        turn.focus({preventScroll:true});
        setSelectedTurn(replyTarget.turnId);
        setEngagedChatId(replyTarget.chatId);
        const el=scrollRef.current;
        setAwayFromBottom(!!el&&el.scrollHeight-el.scrollTop-el.clientHeight>24);
      }
      setReplyTarget(null);
    });
    return()=>cancelAnimationFrame(frame);
  },[replyTarget,thread,loading,paneNumber]);

  useEffect(() => {
    if (embedded) return;
    function key(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        sessions.current[activePaneRef.current].current?.newDraft();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch("");
        setModal("search");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setModal(null);
        setView("settings");
      }
      if (e.key === "Escape") {
        setChatMenu(null);
        setWorkspaceMenu(null);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 650px)");
    const adaptSidebar = () => {
      if (inboxActiveRef.current) setSidebar(true);
      else if (narrow.matches) setSidebar(false);
    };
    adaptSidebar();
    narrow.addEventListener("change", adaptSidebar);
    return () => narrow.removeEventListener("change", adaptSidebar);
  }, []);
  useEffect(() => {
    setSearch("");
    setSkillFilter("all");
    if (view === "jobs") void loadJobs();
    if (
      (view === "settings" && settingsTab === "engines") ||
      (view === "settings" && settingsTab === "secrets")
    )
      guard(async () => setIntegrations(await api("/integrations?view=settings")))();
    if (skillsActive) void loadSkills();
  }, [view, settingsTab]);

  useEffect(() => {
    if (embedded) return;
    const ctx = document.modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool) =>
      Promise.resolve(
        ctx.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    register({
      name: "agent_list_jobs",
      title: "Agent-Jobs lesen",
      description: "Listet lokale Jobordner und ihren Status.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => ({
        jobs: (await api("/jobs")).map((j) => ({
          id: j.id,
          name: j.name,
          status: j.status,
          worker: j.worker,
        })),
      }),
    });
    register({
      name: "agent_stage_message",
      title: "Nachricht an den Agenten vorbereiten",
      description:
        "Öffnet einen neuen Chat und trägt einen Entwurf ein. Sendet keine Nachricht.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", maxLength: 30000 } },
        required: ["text"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        if (typeof input.text !== "string" || input.text.length > 30000)
          throw Error("Nachricht ungültig.");
        newDraft();
        setText(input.text);
        return { staged: true, sent: false };
      },
    });
    return () => lifecycle.abort();
  }, []);
  const [outboxEntries,setOutboxEntries]=useState(()=>messageOutbox.snapshot());
  const deliveryRefresh=useRef("");
  const deliveryChatList=useRef("");
  useEffect(()=>{
    outboxListeners.add(setOutboxEntries);
    if(boot?.features?.messageDelivery){
      try{messageOutbox.start(boot.workspace);setOutboxEntries([...messageOutbox.snapshot()]);}
      catch(error){notify(error.message);}
    }
    return()=>outboxListeners.delete(setOutboxEntries);
  },[boot?.workspace,boot?.features?.messageDelivery]);
  useEffect(()=>{
    const mapping=outboxEntries.map(e=>e.clientMessageId+":"+e.chatId+":"+e.status).join("|");
    if(deliveryChatList.current!==mapping){
      deliveryChatList.current=mapping;
      void refreshChats().catch(()=>{});
    }
    // Only a provisional outbox chat is swapped for its real id; an existing chat keeps its history.
    const receipt=outboxEntries.find(e=>e.localId===chatRef.current && e.chatId && e.localId!==e.chatId);
    if(receipt){
      chatRef.current=receipt.chatId;setChatId(receipt.chatId);
      setThread({id:receipt.chatId,turns:[]});
      void refreshChats().catch(()=>{});
    }
    const id=chatRef.current;
    const signature=outboxEntries.filter(e=>e.chatId===id && ["started","unknown","failed"].includes(e.status)).map(e=>e.clientMessageId+":"+e.status).join("|");
    if(id && !id.startsWith("outbox-") && signature && deliveryRefresh.current!==id+signature){
      deliveryRefresh.current=id+signature;
      void refreshChats().catch(()=>{});
      void api("/thread?view=chat&id="+encodeURIComponent(id)).then(r=>{if(chatRef.current===id && !locallyLocked(id))setThread(old=>reconcileThreadSnapshot(old,r.thread));}).catch(()=>{});
    }
  },[outboxEntries]);
  useEffect(()=>{
    if(!chatId || chatId.startsWith("outbox-") || !boot?.features?.messageDelivery || chatLocked)return;
    let cancelled=false;
    void api("/deliveries?id="+encodeURIComponent(chatId)).then(r=>{if(!cancelled)messageOutbox.merge(r.entries || []);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[chatId,boot?.features?.messageDelivery,chatLocked]);
  const visibleTurns=deliveryView(thread,chatLocked || !chatId?[]:outboxEntries.filter(e=>e.chatId===chatId || e.localId===chatId));
  function chooseProject(id) {
    projectRef.current = id;
    setProjectId(id);
    setAgentFolderTarget(null);
    setExpandedProject(id);
    const chosen = boot?.projects?.find((p) => p.id === id);
    setSelectedFile(null);
    setTerminalOutput("");
  }
  function saveDraft() {
    draftCache.current.set(chatRef.current || `new:${projectRef.current}`, {text, attachments, title:draftTitle, scroll:scrollRef.current?.scrollTop || 0, following:followScroll.current});
  }
  function newDraft(targetProjectId) {
    closeMobileNavigation();
    if (!embedded && activePaneRef.current !== 0 && sessions.current[activePaneRef.current].current) {
      setView("chat");
      return sessions.current[activePaneRef.current].current.newDraft(targetProjectId);
    }
    if (busy && !boot?.features?.messageDelivery) { notify("Bitte warten, bis die Nachricht übertragen wurde."); return; }
    historyReads.current.cancel();
    saveDraft();
    setGreeting(nextChatGreeting());
    const id =
      typeof targetProjectId === "string"
        ? targetProjectId
        : projectRef.current;
    // Keyboard handlers use refs so a new draft never inherits an old thread.
    projectRef.current = id;
    setProjectId(id);
    setAgentFolderTarget(null);
    setExpandedProject(id);
    chatRef.current = null;
    followScroll.current = true;
    setMode("default");
    setLoading(false);
    setThreadError("");
    setModal(null);
    setWorkspaceMenu(null);
    setView("chat");
    setPrivacyLocked(false);
    setChatId(null);
    setThread(null);
    const nextWorker = draftWorker === "auto" ? boot.effectiveWorker || "codex" : draftWorker;
    const nextModel = preferredModel(boot.modelsByWorker?.[nextWorker] || [], nextWorker);
    setModel(nextModel?.model || "");
    setEffort(supportedEffort(nextModel));
    const saved = draftCache.current.get(`new:${id}`);
    setText(saved?.text || "");
    setAttachments(saved?.attachments || []);
    setDraftTitle(saved?.title || "");
    setChatMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  const [weatherPreviewOpen,setWeatherPreviewOpen]=useState(false);
  const statisticsRequestRef=useRef(null);
  async function openStatisticsReport() {
    if(statisticsRequestRef.current?.projectId!==projectRef.current)statisticsRequestRef.current={projectId:projectRef.current,requestId:crypto.randomUUID()};
    const result=await api('/statistics/chat',{...statisticsRequestRef.current,timeZone:statisticsTimeZone(),worker:current?.workerId||draftWorker,model:pickerModel||model,serviceTier:current?.serviceTier||draftSpeed,mode});
    await refreshChats();await openChat(result.thread.id,result.meta);statisticsRequestRef.current=null;
  }
  const weatherRequestRef=useRef(null);
  async function openWeatherReport(item) {
    if(!item.weatherConfigured || item.weather?.status==='unresolved'){openSettings('account');return;}
    const key=projectRef.current+'|'+item.title;
    if(weatherRequestRef.current?.key!==key)weatherRequestRef.current={key,requestId:crypto.randomUUID()};
    const result=await api('/weather/chat',{requestId:weatherRequestRef.current.requestId,projectId:projectRef.current,worker:current?.workerId||draftWorker,model:pickerModel||model,serviceTier:current?.serviceTier||draftSpeed,mode});
    await refreshChats();
    await openChat(result.thread.id,result.meta);
    weatherRequestRef.current=null;
    if(result.summaryError)notify(result.summaryError);
  }
  const calendarRequestRef=useRef(null);
  async function openCalendarReport() {
    if(calendarRequestRef.current?.projectId!==projectRef.current)calendarRequestRef.current={projectId:projectRef.current,requestId:crypto.randomUUID()};
    const result=await api('/calendar/chat',{...calendarRequestRef.current,worker:current?.workerId||draftWorker,model:pickerModel||model,serviceTier:current?.serviceTier||draftSpeed,mode});
    await refreshChats();await openChat(result.thread.id,result.meta);calendarRequestRef.current=null;
    if(result.summaryError)notify(result.summaryError);
  }
  async function openChat(id, restoredMetadata, targetTurnId) {
    closeMobileNavigation();
    if (!embedded) {
      const existing = paneOrder.find(slot => sessions.current[slot].current?.id === id);
      if (existing != null && existing !== activePaneRef.current) { activatePane(existing); setView("chat"); if(targetTurnId)return sessions.current[existing].current.openChat(id, restoredMetadata, targetTurnId); return; }
      if (activePaneRef.current !== 0 && sessions.current[activePaneRef.current].current) {
        setView("chat");
        return sessions.current[activePaneRef.current].current.openChat(id, restoredMetadata, targetTurnId);
      }
    }
    return openChatHere(id, restoredMetadata, targetTurnId);
  }
  async function openChatHere(id, restoredMetadata, targetTurnId) {
    if (busy && !boot?.features?.messageDelivery) { notify("Bitte warten, bis die Nachricht übertragen wurde."); return; }
    if(targetTurnId){followScroll.current=false;setReplyTarget({chatId:id,turnId:targetTurnId});}
    if (chatRef.current === id) { setView("chat"); setModal(null); return; }
    historyReads.current.cancel();
    saveDraft();
    const metadata = restoredMetadata || chats.find((c) => c.id === id);
    chooseProject(metadata?.projectId || projectRef.current);
    setMode(metadata?.mode || "default");
    if (metadata?.model) setModel(metadata.model);
    setEffort(metadata?.effort || "medium");
    const saved = draftCache.current.get(id);
    setText(saved?.text || "");
    setAttachments(saved?.attachments || []);
    setDraftTitle("");
    setModal(null);
    setWorkspaceMenu(null);
    setView("chat");
    setChatId(id);
    setPrivacyLocked(!!metadata?.locked);
    chatRef.current = id;
    setThread(null);
    setLoading(true);
    setThreadError("");
    setChatMenu(null);
    followScroll.current = !targetTurnId;
    let pending;
    try {
      if (metadata?.locked) return;
      if(id.startsWith("outbox-")){setThread({id,turns:[]});return;}
      pending = historyReads.current.read("/thread?view=chat&id=" + encodeURIComponent(id));
      const r = await pending;
      if (chatRef.current !== id || !pending.isCurrent()) return;
      setThread(r.thread);
      if (r.thread.model) setModel(r.thread.model);
      if (!targetTurnId && saved && !saved.following) { followScroll.current = false; requestAnimationFrame(() => { if (chatRef.current === id && scrollRef.current) scrollRef.current.scrollTop = saved.scroll; }); }
    } catch (error) {
      if (chatRef.current === id && (!pending || pending.isCurrent())) setThreadError(["TimeoutError","AbortError"].includes(error.name) ? "Die Verbindung zum Verlauf wurde unterbrochen. Bitte erneut versuchen." : error.message);
    } finally {
      if (chatRef.current === id && (!pending || pending.isCurrent())) setLoading(false);
    }
  }
  async function retryChatHistory() {
    const id=chatRef.current;
    if(!id)return;
    setLoading(true);setThreadError("");
    let pending;
    try {
      pending=historyReads.current.read('/thread?view=chat&id='+encodeURIComponent(id));
      const result=await pending;
      if(chatRef.current===id && (!pending || pending.isCurrent()))setThread(result.thread);
    } catch(error) {
      if(chatRef.current===id && (!pending || pending.isCurrent()))setThreadError("Der Verlauf konnte nicht geladen werden. Bitte erneut versuchen.");
    } finally {
      if(chatRef.current===id && (!pending || pending.isCurrent()))setLoading(false);
    }
  }
  async function refreshAudioConnections() {
    const [d, s] = await Promise.all([api("/dictation/status"), api("/speech/status")]);
    setAudioConnections({Groq: d.groq, ElevenLabs: s.elevenlabs});
  }
  function refreshConnections(force=false) {
    const cache=connectionsRefresh.current;
    if (cache.pending) return cache.pending;
    if (!force && Date.now()-cache.at<30000) return Promise.resolve();
    cache.pending=Promise.all([api('/integrations?view=settings').then(value=>{setIntegrations(value);}),refreshAudioConnections()])
      .then(()=>{cache.at=Date.now();setConnectionsLoaded(true);setConnectionsError('');})
      .catch(()=>{setConnectionsError('Verbindungen konnten nicht vollständig aktualisiert werden.');})
      .finally(()=>{cache.pending=null;});
    return cache.pending;
  }
  useEffect(()=>{if(!embedded&&boot&&(connectionsActive||view === "jobs"||["job","image-create","connection","crm-connection","service-connection","audio-connection"].includes(modal?.type)))void refreshConnections();},[!!boot,connectionsActive,view,modal?.type]);
  useEffect(()=>{
    if(!connectionsActive||!integrations.mcpLoading)return;
    const timer=setTimeout(()=>void refreshConnections(true),2000);
    return ()=>clearTimeout(timer);
  },[connectionsActive,integrations]);
  async function refreshPickerWorkers() {
    try {
      const state = await api("/workers");
      setBoot(old => ({...old, workers: state.workers}));
    } catch (error) { notify(error.message); }
  }
  function selectForNextMessage(workerId, nextModel, nextEffort) {
    const id = chatRef.current, key = id || `new:${projectRef.current}`;
    const selection = {selectionId:crypto.randomUUID(), workerId, model:nextModel || null, effort:nextEffort || ""};
    // Feedback is local and immediate. Only lightweight preferences are saved here.
    setNextSelections(old => ({...old, [key]:selection}));
    if (!id || id.startsWith("outbox-")) return;
    const pending = (selectionWrites.current.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
      const result = await api("/chat/provider", {id, defer:true, ...selection});
      setChats(old => old.map(c => c.id === id ? {...c, composerSelection:result.selection} : c));
      setNextSelections(old => {
        if (old[key]?.selectionId !== selection.selectionId) return old;
        const next = {...old}; delete next[key]; return next;
      });
    }).catch(error => notify("Auswahl noch nicht gespeichert: " + error.message));
    selectionWrites.current.set(id, pending);
  }
  function chooseProvider(workerId) {
    const native = workerId === actualWorker && thread?.workerSession ? sessionModelSelection(thread.workerSession) : null;
    const models = native?.models || (workerId === actualWorker && current?.models?.length ? current.models : knownModels(workerId));
    const selected = preferredModel(models, workerId, workerId === actualWorker ? native?.model || model : "");
    selectForNextMessage(workerId, selected?.model, supportedEffort(selected));
    if (boot.workers?.find(w => w.id === workerId)?.capabilities?.plan === false) setMode("default");
  }
  async function changeSpeed(serviceTier) {
    if (!chatId) { setDraftSpeed(serviceTier); return; }
    const id = chatId;
    const result = await api("/chat/speed", {id, model:pickerModel, serviceTier});
    setChats(old => old.map(c => c.id === id ? {...c, serviceTier:result.serviceTier} : c));
  }
  function changePickerSelection(nextModel, nextEffort) {
    selectForNextMessage(pickerWorker, nextModel, nextEffort);
  }
  async function submit(e, voiceText, includeDraft = false) {
    e?.preventDefault();
    if (questionState.request) {
      const answer = includeDraft ? [questionState.text, voiceText].filter(Boolean).join("\n") : voiceText ?? questionState.text;
      await questionState.submit(answer);
      return;
    }
    const msg = includeDraft ? [text, voiceText].filter(Boolean).join("\n") : voiceText ?? text;
    const rejectVoice = message => {
      if (voiceText) {
        if (includeDraft) setText(msg);
        throw new Error(message);
      }
      notify(message);
    };
    if ((!msg.trim() && !attachments.length) || busy) { if (voiceText) rejectVoice("Chat ist beschäftigt."); return; }
    if (uploadCounts.current.get(draftKey())) { rejectVoice("Dateien werden noch angeheftet."); return; }
    if (boot?.features?.slashCommands && msg.startsWith('/')) {
      if(slashPending.current)return;
      const origin=draftKey();slashPending.current=true;
      try {
        const {submitComposerCommand}=await import('./composer-command-submit.mjs');
        if(draftKey()!==origin)return;
        if(await submitComposerCommand(msg,{workerId:pickerWorker,running,chatId,sameWorker,attachments,api,
          setMode,setBusy,notify,report:rejectVoice,currentId:()=>chatRef.current,
          clearDraft:()=>{if(!voiceText || includeDraft)setText('');}}))return;
        if(draftKey()!==origin)return;
      } finally {slashPending.current=false;}
    }
    if(boot?.features?.messageDelivery){
      const targetId=chatRef.current;
      if(targetId && outboxEntries.some(e=>(e.chatId===targetId || e.localId===targetId) && ["sending","offline","accepted"].includes(e.status))){
        rejectVoice("Diese Nachricht wird noch übergeben. Du kannst währenddessen den Chat wechseln.");return;
      }
      const clientMessageId=crypto.randomUUID();
      const localId=targetId || "outbox-"+clientMessageId;
      const files=voiceText && !includeDraft?[]:attachments;
      const payload={clientMessageId,localId,id:targetId && !targetId.startsWith("outbox-")?targetId:null,
        text:msg,attachments:files,model:pickerModel || model,effort:pickerEffort || undefined,nextSelection,mode,projectId:projectRef.current,
        ...(!targetId?{chat:{model:pickerModel || undefined,worker:composerSelection?.workerId || draftWorker,serviceTier:draftSpeed,mode,projectId:projectRef.current,title:draftTitle || undefined}}:{})};
      try{messageOutbox.enqueue(payload);}catch(error){rejectVoice(error.message);return;}
      if(!voiceText || includeDraft){setText("");setAttachments([]);}
      draftCache.current.delete(targetId || "new:"+projectRef.current);

      followScroll.current=true;
      if(!targetId){
        if (composerSelection) setNextSelections(old => ({...old, [localId]:composerSelection}));
        chatRef.current=localId;setChatId(localId);setThread({id:localId,turns:[]});
        setChats(old=>[{id:localId,projectId:projectRef.current,title:draftTitle || msg.slice(0,40)||"Neue Nachricht",updatedAt:Date.now()},...old]);
      }
      return {id:localId};
    }
    setBusy(true);
    const originalText = text,
      originalAttachments = attachments;
    try {
      let id = chatId, selectedModel = pickerModel;
      const files = voiceText && !includeDraft ? [] : attachments;
      followScroll.current = true;
      if (!id) {
        const r = await api("/chats", {
          model: pickerModel || undefined,
          worker: composerSelection?.workerId || draftWorker,
          serviceTier: draftSpeed,
          mode,
          projectId: projectRef.current,
          title: draftTitle || undefined,
        });
        draftCache.current.delete(`new:${projectRef.current}`);
        id = r.thread.id;
        chatRef.current = id;
        setChatId(id);
        setThread(r.thread);
        selectedModel = r.model || undefined;
        setModel(r.model || "");
        await refreshChats();
      }
      if (!voiceText || includeDraft) { setText(""); setAttachments([]); }
      const optimisticItem = {
        id: "pending-" + crypto.randomUUID(),
        type: "userMessage",
        clientPending: true,
        content: [
          ...(msg ? [{ type: "text", text: msg }] : []),
          ...files.map((f) => ({ type: "text", text: "Anhang: " + f.name })),
        ],
      };
      setThread((previous) => {
        if (chatRef.current !== id || !previous) return previous;
        const next = structuredClone(previous);
        next.turns ||= [];
        const ongoing = next.turns.find((t) => t.id === active[id]);
        if (ongoing) ongoing.items.push(optimisticItem);
        else
          next.turns.push({
            id: optimisticItem.id,
            clientPending: true,
            status: "inProgress",
            items: [optimisticItem],
          });
        return next;
      });
      const delivery=await submitMessage(api, id, {
        text: msg,
        attachments: files,
        model: selectedModel,
        effort: pickerEffort || undefined,
        nextSelection,
        mode,
      });
      if(delivery.message?.status==='waiting')notify("Nachricht gespeichert; folgt nach der laufenden Antwort.");
      if (nextSelection) {
        setModel(selectedModel); setEffort(pickerEffort);
        if (thread?.workerSession) {
          void api("/thread?view=chat&id=" + encodeURIComponent(id)).then(updated => {
            if (chatRef.current === id) setThread(old => old ? {...old, workerSession:updated.thread.workerSession} : old);
          }).catch(() => {});
        }
      }
      return { id };
    } catch (e) {
      setThread((previous) =>
        previous
          ? {
              ...previous,
              turns: previous.turns
                ?.filter((t) => !t.clientPending)
                .map((t) => ({
                  ...t,
                  items: t.items.filter((i) => !i.clientPending),
                })),
            }
          : previous,
      );
      if (includeDraft) { setText(msg); setAttachments(originalAttachments); }
      else if (voiceText) setText(previous => previous ? previous + "\n" + voiceText : voiceText);
      else { setText(originalText); setAttachments(originalAttachments); }
      notify(e.message);
      if (voiceText) throw e;
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }
  async function upload(list) {
    const files = Array.from(list || []), target = draftKey(), targetProject = projectRef.current;
    if (!files.length) return;
    if (busy) { notify("Bitte warten, bis die Nachricht übertragen wurde."); return; }
    const entries = files.map(file => ({id:crypto.randomUUID(), key:target, name:file.name, file}));
    uploadCounts.current.set(target, (uploadCounts.current.get(target) || 0) + entries.length);
    setPendingUploads(old => [...old, ...entries]);
    if (uploadRef.current) uploadRef.current.value = "";
    inputRef.current?.focus();
    await uploadAttachmentBatch(entries, {
      projectId:targetProject,
      read:file=>new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(reader.result.split(",")[1]);
        reader.onerror=()=>reject(new Error("Datei konnte nicht gelesen werden."));
        reader.readAsDataURL(file);
      }),
      send:body=>api("/upload",body),
      success:(_entry,attachment)=>{
        if (draftKey() === target) setAttachments(old => [...old, attachment]);
        else {
          const saved = draftCache.current.get(target) || {};
          draftCache.current.set(target, {...saved, attachments:[...(saved.attachments || []), attachment]});
        }
      },
      failure:(entry,error)=>notify(`${entry.name}: ${error.message}`),
      finish:entry=>{
        uploadCounts.current.set(target, Math.max(0, (uploadCounts.current.get(target) || 1) - 1));
        setPendingUploads(old => old.filter(item => item.id !== entry.id));
      }
    });
  }

  async function openFile(p, returnFocus) {
    if (embedded && onOpenFile) return onOpenFile(p);
    const relative = localFilePath(p, boot.workspace);
    if (!relative) throw new Error("Die Datei liegt nicht im freigegebenen Arbeitsbereich.");
    shelfReturnFocus.current=returnFocus || document.activeElement;
    setPanel("chat");
    setSelectedShelfImage(null);
    setSelectedFile(relative);
  }

  const chatUpdateLocks = useRef(new Set());
  const [updatingChats, setUpdatingChats] = useState({});
  const archivedChats = chats.filter(c => c.archived);
  const matchingArchivedChats = archivedChats.filter(c =>
    (c.title || "Neuer Chat").toLocaleLowerCase("de").includes(search.trim().toLocaleLowerCase("de")),
  ).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  async function updateChat(c, change) {
    if (c.id.startsWith("outbox-")) {
      // Only in this browser, never on the server: drop it locally instead of asking the server.
      messageOutbox.discard(c.id);
      setChats(old => old.filter(chat => chat.id !== c.id));
      setChatMenu(null);
      if (chatId === c.id) newDraft();
      return;
    }
    if (chatUpdateLocks.current.has(c.id)) return;
    chatUpdateLocks.current.add(c.id);
    setUpdatingChats(old => ({...old, [c.id]:true}));
    try {
      const updated = await api("/chat/update", { id: c.id, ...change });
      setChats(old => old.map(chat => chat.id === c.id ? {...chat, ...updated} : chat));
      setChatMenu(null);
      if (change.archived && chatAudio.snapshot().chatId===c.id) chatAudio.stop();
      if (change.archived && chatId === c.id) newDraft();
      await refreshChats();
    } finally {
      chatUpdateLocks.current.delete(c.id);
      setUpdatingChats(old => { const next = {...old}; delete next[c.id]; return next; });
    }
  }
  async function fork(turn) {
    const index = turn ? thread.turns.findIndex(t => t.id === turn.id) : -1;
    const nextTurn = index >= 0 ? thread.turns[index + 1] : null;
    const r = await api("/fork", { id: chatId, ...(nextTurn ? {beforeTurnId: nextTurn.id} : {}) });
    await refreshChats();
    await openChatHere(r.thread.id);
    notify("Gespräch wurde verzweigt.");
  }
  const retryPending = useRef(false);
  async function revise(turn, retry = false) {
    if (retryPending.current || busy || running) return;
    const message = turn.items.find((i) => i.type === "userMessage");
    if (!message)
      throw new Error("Die ursprüngliche Nachricht ist nicht verfügbar.");
    const messageText = message.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    const messageFiles = message.content
      .filter((c) => c.type === "localImage" || c.type === "localAudio")
      .map((c) => ({ path: c.path, name: c.path.split("/").pop() }));
    if (retry) {
      retryPending.current = true;
      setBusy(true);
      try {
        followScroll.current = true;
        await api("/turn", {
          id: chatId,
          text: messageText,
          attachments: messageFiles,
          model,
          effort,
          mode,
        });
      } finally {
        retryPending.current = false;
        setBusy(false);
      }
      return;
    }
    const r = await api("/fork", { id: chatId, beforeTurnId: turn.id });
    await refreshChats();
    await openChatHere(r.thread.id);
    setText(messageText);
    setAttachments(messageFiles);
    inputRef.current?.focus();
    notify("Nachricht zum Bearbeiten geöffnet. Das ursprüngliche Gespräch bleibt erhalten.");
  }

  async function saveSettings(change) {
    if (change.name !== undefined && !serverOwnsIdentity) {
      const name = String(change.name).replace(/[\r\n]+/g, " ").trim().slice(0, 100) || "Agent";
      const { text } = await api("/file/text?path=soul%2FIDENTITY.md");
      await api("/file/save", {
        path: "soul/IDENTITY.md",
        text: /^Anzeigename:.*$/m.test(text)
          ? text.replace(/^Anzeigename:.*$/m, () => `Anzeigename: ${name}`)
          : `${text.trimEnd()}\n\nAnzeigename: ${name}\n`,
      });
      change = { ...change, name };
    }
    const settings = await api("/settings", change);
    if (Object.entries(change).some(([key,value]) => key.startsWith("loader") && settings[key] !== value)) throw new Error("Bitte die App nach Abschluss laufender Chats neu starten, um die Ladeanzeige zu speichern.");
    if (Object.entries(change).some(([key,value]) => ["designTone", "highlightColor"].includes(key) && settings[key] !== value)) throw new Error("Bitte die App nach Abschluss laufender Chats neu starten, um Farbwelten zu speichern.");
    setBoot((b) => ({ ...b, settings }));
    window.dispatchEvent(new CustomEvent("wrapper/appearance", {detail:settings}));
    if (change.theme) document.documentElement.dataset.theme = change.theme;

  }
  const [workspaceOpening,setWorkspaceOpening]=useState(false);
  const workspaceRequest=useRef(null);
  const workspaceOpenLock=useRef(false);
  const [jobWorkspace,setJobWorkspace]=useState('all');
  async function configureWorkspace(targetId) {
    if(workspaceOpenLock.current)return;
    workspaceOpenLock.current=true;setWorkspaceOpening(true);
    try {
      if(!targetId)workspaceRequest.current ||= crypto.randomUUID();
      const result=await api('/workspaces/chat',{...(targetId?{projectId:targetId}:{requestId:workspaceRequest.current}),worker:draftWorker,model});
      workspaceRequest.current=null;
      const fresh=await api('/bootstrap');
      setBoot(old=>({...old,projects:fresh.projects,workspaceWarnings:fresh.workspaceWarnings}));
      await refreshChats();setModal(null);chooseProject(result.project.id);await openChat(result.thread.id);
      if(result.startError)notify(result.startError);
    } finally {workspaceOpenLock.current=false;setWorkspaceOpening(false);}
  }
  async function loadSkills() {
    setSkillsLoading(true);
    setSkillsError("");
    try {
      const result = await api("/skills");
      setSkills((result.data || []).flatMap((group) => group.skills || []));
      if (result.warning) notify(result.warning);
    } catch (error) {
      setSkillsError(error.message);
      if (skills.length) notify(error.message);
    } finally {
      setSkillsLoading(false);
    }
  }
  useEffect(() => {
    function closeMenus(e) {
      if (!e.target.closest(".workspace-heading")) setWorkspaceMenu(null);
      if (!e.target.closest(".chat-row")) setChatMenu(null);
    }
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);
  useEffect(() => {
    setSelectedFile(null);
    setTerminalOutput("");
  }, [projectId]);
  const forkTurn=useLiveAction(guard(fork));
  const editTurn=useLiveAction(guard(revise));
  const retryTurn=useLiveAction(guard(turn=>revise(turn,true)));
  const recoverDelivery=useLiveAction((receipt,action)=>setModal({type:"delivery-recovery",receipt:{...receipt},action}));
  const deleteTurn=useLiveAction(turn=>setModal({type:"delete-message",turn}));
  const openTurnFile=useLiveAction(guard(openFile));
  const linkOpened = useRef(false);
  useEffect(() => {
    if (!boot || linkOpened.current) return;
    if (!(embedded ? paneVisible : visible.includes(0)) && (embedded || !new URL(window.location.href).searchParams.get("chat"))) return;
    linkOpened.current = true;
    const saved = readPaneSession(paneNumber);
    const linkedId = !embedded && new URL(window.location.href).searchParams.get("chat");
    const metadata = boot.chats.find(chat => chat.id === saved.chatId);
    // Right after a restart the sidebar list can still be incomplete. The saved chat is opened
    // anyway; the history request decides whether it still exists, so a pane never falls back
    // to an empty draft and overwrites its saved session by accident.
    const id = linkedId || saved.chatId;
    if (linkedId) { setPaneOrder(order => order.includes(0) ? order : [0, ...order.slice(1)]); activatePane(0); }
    if (id) {
      guard(() => openChatHere(id, linkedId ? undefined : metadata))();
      if (!linkedId) setView(view);
    }
    else if (boot.projects.some(project => project.id === saved.projectId)) chooseProject(saved.projectId);
    setPaneRestored(true);
  }, [!!boot, paneVisible, visible.includes(0)]);
  useEffect(() => {
    if (paneRestored) writePaneState(`session:${paneNumber}`, {chatId, projectId});
  }, [paneRestored, paneNumber, chatId, projectId]);
  const chatTitle = chatLocked ? "Privater Chat" : current?.title || draftTitle || "Neuer Chat";
  const exportChat = () => {
    const blob = new Blob([conversationText(thread, chatTitle)], {type:"text/markdown;charset=utf-8"});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href=url; a.download=`${chatTitle.replace(/[^\p{L}\p{N} ._-]/gu, "_")}.md`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const copyConversation = guard(async () => { await navigator.clipboard.writeText(conversationText(thread, chatTitle)); notify("Gespräch kopiert."); });
  const audioState=useChatAudio();
  useEffect(()=>{if(!embedded && chats.some(c=>c.id===audioState.chatId && (c.archived||c.locked))) chatAudio.stop();},[embedded,chats,audioState.chatId]);
  const shelfEntries = useMemo(()=>chatLocked ? [] : collectShelfEntries(thread?.turns || [],boot?.workspace,current?.cwd || boot?.workspace),[chatLocked,thread?.turns,boot?.workspace,current?.cwd]);
  const localSession = {
    shelfEntries, shelfLoading:loading, shelfError:threadError, reloadShelf:()=>openChatHere(chatId),
    welcome: !chatId && !loading && !thread?.turns?.length,
    private:current?.private, locked:chatLocked, lock:guard(()=>changeChatPrivacy(api,"lock",chatId)),
    id:chatId, title:chatTitle, hasTitle:!!(current?.title || draftTitle), projectName:project?.name || "Allgemein",
    projectIcon:<span className="project-glyph" style={{color:projectColor(modal?.type === "project" && modal.project?.id === project?.id ? modal.color ?? project?.color : project?.color)}}>{icon(projectGlyphs[project?.icon] || Folder, 18)}</span>, running, busy, status:current?.lastTurnStatus, unread:hasUnreadReply(current),
    newDraft, openChat:openChatHere, projectId,
    focusComposer:()=>{activateComposer();if(!chatLocked)inputRef.current?.focus({preventScroll:true});},
    toggleDictation:()=>{if(!chatLocked)dictationControl.current?.toggle();},
    cancelDictation:()=>dictationControl.current?.cancel() || false,
    items:chatLocked ? [{id:'open',label:'PIN eingeben',icon:icon(Lock),action:()=>document.querySelector(`#chat-pane-${paneNumber} input`)?.focus()}, {id:'new',label:'Neuer Chat',icon:icon(Plus),disabled:busy,action:()=>newDraft(projectId)}] : [
      ...(boot?.features?.chatPrivacy ? [{id:'privacy',label:current?.private ? 'Jetzt sperren' : 'Chat sperren …',icon:icon(Lock),disabled:!current || busy,action:current?.private ? guard(()=>changeChatPrivacy(api,'lock',chatId)) : ()=>setModal({type:'chat-privacy',action:'setup'})},
        ...(current?.private ? [{id:'privacy-remove',label:'Schutz entfernen …',icon:icon(Lock),action:()=>setModal({type:'chat-privacy',action:'remove'})}] : [])] : []),
      {id:"audio",label:audioState.chatId===chatId && audioState.mode==='follow' ? "Chat vorlesen ausschalten" : "Chat vorlesen",icon:icon(Volume2),disabled:!current,action:guard(()=>audioState.chatId===chatId && audioState.mode==='follow' ? chatAudio.stop() : chatAudio.start(api,{chatId,title:chatTitle,mode:'follow'}))},
      {id:"rename",label:"Umbenennen",icon:icon(SquarePen),action:()=>setModal({type:"rename",chat:current || null})},
      {id:"pin",label:current?.pinned ? "Nicht mehr anpinnen" : "Anpinnen",icon:icon(Pin),disabled:!current || !!updatingChats[current?.id],action:guard(()=>updateChat(current,{pinned:!current.pinned}))},
      {id:"share",label:"Teilen und exportieren …",icon:icon(ArrowUpRight),disabled:!current,action:()=>setModal("shareChat")},
      {id:"fork",label:"Chat verzweigen",icon:icon(GitBranch),disabled:!current || current.private || running || busy || (current.capabilities?.fork ?? boot?.workers?.find(worker=>worker.id===pickerWorker)?.capabilities?.fork) !== true,action:guard(fork)},
      ...(boot?.features?.operations?[{id:'compact',label:'Fortsetzungsnotiz erstellen',icon:icon(BrainCircuit),disabled:!current||current.private||!thread?.turns?.some(turn=>turn.status==="completed" && turn.items?.some(item=>["userMessage","agentMessage"].includes(item.type)))||running||busy,action:guard(async()=>{const note=await api('/memory/compact',{chatId});await openFile(note.path);setPanel('files');notify('Kompakte Fortsetzungsnotiz gespeichert. Das Originalgespräch bleibt erhalten.');})}]:[]),
      {id:"new",label:"Neuer Chat",icon:icon(Plus),disabled:busy,action:()=>newDraft(projectId)},
      {id:"archive",label:"Archivieren",icon:icon(Archive),disabled:!current || running || busy || !!updatingChats[current?.id],action:guard(()=>updateChat(current,{archived:true}))},
    ],
  };
  (sessionRef || sessions.current[0]).current = localSession;
  useEffect(() => { onSessionChange?.(); }, [loading, chatId, chatTitle, chatLocked, current?.private, project, running, busy, current?.pinned, current?.lastTurnStatus, current?.readTurnId, !!thread?.turns?.length, audioState, shelfEntries, threadError]);
  const returnToRecording=useLiveAction(({detail})=>{
    const {paneNumber:id,chatId:target,projectId:targetProject}=detail;
    setPaneOrder(order=>order.includes(id)?order:[...order,id]);
    setMountedPanes(old=>old.includes(id)?old:[...old,id]);
    activatePane(id);setView("chat");closeMobileNavigation();
    const owner=sessions.current[id].current;
    if(target)void owner?.openChat(target);
    else if(owner?.id || owner?.projectId!==targetProject)owner?.newDraft(targetProject);
  });
  useEffect(()=>{
    if(embedded)return;
    window.addEventListener("wrapper/recording-return",returnToRecording);
    return()=>window.removeEventListener("wrapper/recording-return",returnToRecording);
  },[embedded,returnToRecording]);
  const activeSession = !embedded && activePane !== 0 ? sessions.current[activePane].current : localSession;
  const headerSession = activeSession && {...activeSession, items:activeSession.items.map(item => ({...item, action:()=> (embedded ? sessionRef : sessions.current[activePane]).current?.items.find(current=>current.id===item.id)?.action()}))};
  const workspaceProject = boot?.projects?.find(p=>p.id === (headerSession?.projectId || projectId));
  selectedWorkspaceRef.current = workspaceProject?.id || projectId;
  useEffect(() => {
    if (embedded) return;
    setSelectedFile(null); setSelectedShelfImage(null); setTerminalOutput("");
  }, [embedded, activePane, workspaceProject?.id, activeSession?.id, activeSession?.locked]);
  const shelfSeen = useRef(null);
  useEffect(()=>{
    if(embedded || !activeSession || activeSession.shelfLoading) return;
    const entries=activeSession.shelfEntries || [];
    const key=activeSession.id || `new:${workspaceProject?.id}`;
    const previous=shelfSeen.current;
    shelfSeen.current={key,ids:new Set(entries.map(entry=>entry.id))};
    if(!previous || previous.key!==key || activeSession.locked) return;
    const latest=entries.filter(entry=>!previous.ids.has(entry.id) && /\.html?$/i.test(entry.path || '')).at(-1);
    if(latest && panel==='chat' && view==='chat' && !selectedFile && !selectedShelfImage) setSelectedFile(latest.path);
  },[embedded,activeSession?.id,activeSession?.shelfEntries,activeSession?.shelfLoading,activeSession?.locked]);
  const openShelfEntry=guard(async (entry,trigger)=>{
    shelfReturnFocus.current=trigger || document.activeElement;
    if(entry.kind==='link'){window.open(entry.url,'_blank','noopener,noreferrer');return;}
    if(entry.kind==='job'){
      const list=await api('/jobs');setJobs(list);
      const job=list.find(job=>job.id===entry.jobId);
      if(!job){notify('Der Auftrag ist nicht mehr verfügbar.');return;}
      setView('jobs');setModal({type:'job',job});return;
    }
    if(entry.kind==='image'){setSelectedFile(null);setSelectedShelfImage(entry);return;}
    await openFile(entry.path,trigger);
  });
  const closeShelfPreview=(restore=true)=>{setSelectedFile(null);setSelectedShelfImage(null);if(restore)requestAnimationFrame(()=>{if(shelfReturnFocus.current?.isConnected)shelfReturnFocus.current.focus({preventScroll:true});});};
  const skillGroups = groupSkills(skills.filter(s=>skillSource==='all'||s.source===skillSource), {
    query: search,
    category: skillFilter,
  });
  const availableSkillGroups = groupSkills(skills);
  const visibleSkillCount = skillGroups.reduce(
    (count, group) => count + group.skills.length,
    0,
  );
  useEffect(() => {
    if (view !== 'jobs' || modal?.type !== 'job') return;
    const frame = requestAnimationFrame(()=>document.querySelector('.job-detail-heading button')?.focus());
    const close = e => { if (e.key === 'Escape' && !e.defaultPrevented) setModal(null); };
    document.addEventListener('keydown', close);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', close); };
  }, [view, modal?.type, modal?.job?.id, modal?.template?.id]);
  const visibleJobs = filterJobs(jobs, jobFilter, search, jobWorkspace);
  const jobEditor = modal?.type === 'job' && !modal.job?.managed ? <JobForm
    key={modal.job?.id || modal.template?.id || 'new'}
    routines={!!boot.features?.routines} configurationReady={!!boot.features?.jobConfiguration} initialTemplate={modal.template}
    workers={boot.workers || []} projects={boot.projects || []}
    modelsByWorker={boot.modelsByWorker || {}} defaultProjectId={projectId}
    job={modal.job} jobs={jobs} connections={integrations.connections}
    onSave={guard(async job => {
      await api('/jobs/save', job);
      setJobs(await api('/jobs'));
      setModal(null);
    })}
  /> : null;
  const nav = [
      ["inbox", Inbox, "Inbox"],
      ["calendar", Calendar, "Kalender"],
      ["jobs", Clock, "Aufträge"],
      ...(boot?.features?.library?[["library", FileText, "Ergebnisse"]]:[]),
      ...(boot?.features?.firma?[["firma", Briefcase, "Firma"]]:[]),
    ];
  // Einstellungen nach iOS-Vorbild: das Konto zuerst, dann wenige benannte Gruppen.
  const ops = boot?.features?.operations;
  const settingGroups = [
    { label: "", items: [["account", User, "Konto"]] },
    { label: "Dein Agent", items: [["identity", User, "Dein Agent"], ["voice", Mic, "Stimme"], ["engines", BrainCircuit, "KI & Modelle"], ["skills", Sparkles, "Skills"], ...(ops ? [["memory", BrainCircuit, "Memory"]] : [])] },
    { label: "Verbindungen", items: [["connections", Plug, "Verbindungen"], ["secrets", KeyRound, "Secrets"], ...(ops ? [["access", Lock, "Zugang"]] : [])] },
    { label: "System", items: [["general", SlidersHorizontal, "Allgemein"], ["appearance", Sun, "Aussehen"], ["privacy", ShieldCheck, "Datenschutz"], ...(ops ? [["storage", HardDrive, "Speicher & Sicherung"], ...(boot?.features?.productUpdates ? [["updates", RotateCcw, "Updates"]] : []), ["system", Activity, "System"]] : []), ["service", ShieldCheck, "Service"], ["usage", Activity, "Nutzung"]] },
    { label: "Weiteres", items: [["shortcuts", Keyboard, "Tastaturkürzel"], ["archive", Archive, "Archivierte Chats"]] },
  ];
  const settingNav = settingGroups.flatMap((group) => group.items);
  const [foreground, setForeground] = useState(() => document.visibilityState === "visible" && document.hasFocus());
  useEffect(() => {
    const update = () => setForeground(document.visibilityState === "visible" && document.hasFocus());
    window.addEventListener("focus", update); window.addEventListener("blur", update); document.addEventListener("visibilitychange", update);
    return () => { window.removeEventListener("focus", update); window.removeEventListener("blur", update); document.removeEventListener("visibilitychange", update); };
  }, []);
  useEffect(() => {
    const receive = event => setBoot(old => old ? {...old, settings:{...old.settings,...event.detail}} : old);
    window.addEventListener("wrapper/appearance", receive);
    return () => window.removeEventListener("wrapper/appearance", receive);
  }, []);
  const readablePane = embedded ? paneVisible : visible.includes(0);
  const commandControl = useRef(null), slashPending = useRef(false);
  useEffect(() => {
    const last = thread?.turns?.at(-1);
    if (!canReadPaneReply({foreground, visible:view === "chat" && readablePane, selected:selectedPane,
      chatId, loadedChatId:thread?.id, loading, running, completed:last?.status === "completed", unread:hasUnreadReply(current)})) return;
    // Let React replace the skeleton and the browser paint the completed text first.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!scrollRef.current || document.visibilityState !== "visible" || !document.hasFocus()) return;
        api("/chat/read", {id:chatId,turnId:last.id}).then(result=>setChats(old=>old.map(c=>c.id===chatId ? {...c,readTurnId:result.readTurnId} : c))).catch(()=>{});
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [foreground, view, readablePane, selectedPane, loading, running, thread, chatId, current?.lastCompletedTurnId, current?.readTurnId]);

  const notificationState = useJobNotifications(api, !!boot?.features?.routines && !embedded, notify);
  const [requestSignal, setRequestSignal] = useState(0);
  const previousRequests = useRef(null);
  useEffect(() => {
    if (!boot) return;
    const ids = new Set(requests.map(request => request.id));
    if (previousRequests.current && [...ids].some(id => !previousRequests.current.has(id))) setRequestSignal(value => value + 1);
    previousRequests.current = ids;
  }, [requests, !!boot]);
  const bellSignal = notificationState.signal + requestSignal;

  useEffect(()=>{
    if(embedded)return;
    const open=()=>setModal('notifications');
    const notificationId=new URLSearchParams(window.location.search).get('notification');
    if(notificationId)setModal({type:'notifications',id:notificationId});
    window.addEventListener('open-job-notifications',open);
    return()=>window.removeEventListener('open-job-notifications',open);
  },[]);
  const MainSurface = embedded ? "div" : "main";
  if (!boot)
    return (
      <div className={embedded ? "app embedded-chat" : undefined}>
        {bootError || toast ? <div className="boot-screen"><p role="alert">{bootError || toast}</p><button onClick={guard(refresh)}>Erneut versuchen</button></div> : <Skeleton variant={embedded ? "chat-panel" : "shell"} label={embedded ? "Gespräch wird geladen …" : "Schaltzentrale wird geöffnet …"}/>}
        {!embedded && <ChatAudioControls Button={IconButton}/>}
      {!embedded && <SystemNotice ref={systemNoticeRef} onBusyChange={setServerRestartBusy} api={api} user={boot?.user} message={toast} onDismiss={()=>setToast("")} />}
      </div>
    );
  return (
    <LoaderProvider settings={boot.settings}><div
      style={{"--sidebar-width": `${sidebarWidth}px`, "--workspace-width": `${workspaceWidth || 360}px`}}
      className={
        (embedded ? "app embedded-chat " : "app ") +
        (view === "inbox" ? "inbox-mode " : "") +
        (!sidebar ? "collapsed " : "") +
        (panel && view === "chat" ? "has-panel" : "")
      }
    >
      {!embedded && <aside className="sidebar">
        <PanelLight mode={boot.settings.panelLight || "animated"} active={sidebar} />
        <div className="sidebar-resizer"><PaneDivider label="Seitenleistenbreite ändern" value={sidebarWidth} min={220} max={400} onReset={()=>setSidebarWidth(268)} onResize={delta=>setSidebarWidth(width=>Math.max(220,Math.min(400,width+delta)))}/></div>
        <div className="sidebar-topbar">
          <AgentMenu theme={boot.settings.theme} onThemeChange={theme=>saveSettings({theme})} name={boot.settings.name} avatar={boot.settings.avatar} avatarColor={boot.settings.avatarColor} connectionState={connectionState} restartBusy={serverRestartBusy} onNavigate={tab=>{closeMobileNavigation();if(tab==="updates")setUpdatesTab("version");setSettingsTab(tab);setView("settings");}} onRestart={()=>systemNoticeRef.current?.restart()} />
          <IconButton label="System durchsuchen (⌘/Strg K)" aria-keyshortcuts="Meta+K Control+K" aria-haspopup="dialog" aria-expanded={modal === "search"} onClick={()=>{setSearch("");setModal("search");}}>{icon(Search,18)}</IconButton>
          {boot.features?.routines ? <IconButton label={`Benachrichtigungen${notificationState.data?.unread ? ` · ${notificationState.data.unread} ungelesen` : ''}${requests.length ? ` · ${requests.length} Rückfragen` : ''}`} aria-haspopup="dialog" aria-expanded={modal === "notifications" || modal?.type === "notifications"} onClick={()=>setModal("notifications")}><NotificationBell signal={bellSignal} />{(notificationState.data?.unread>0||requests.length>0)&&<i className="notification-dot"/>}</IconButton> : requests.length > 0 && <IconButton label="Offene Rückfragen" aria-haspopup="dialog" aria-expanded={modal === "activity"} onClick={()=>setModal("activity")}><NotificationBell signal={bellSignal} /><i className="notification-dot"/></IconButton>}
          <IconButton
            label="Seitenleiste ausblenden"
            onClick={() => setSidebar(false)}
          >
            {icon(PanelLeft, 16)}
          </IconButton>
        </div>
        {view === "inbox" ? (
          <div className="inbox-sidebar-slot" ref={setInboxSidebarHost}/>
        ) : view === "settings" ? (
          <>
            <button className="back-to-app" onClick={() => { closeMobileNavigation(); setView("chat"); }}>
              {icon(ArrowLeft)}Zurück zur App
            </button>
            <div className="sidebar-section-label">Einstellungen</div>
            <nav>
              {settingGroups.map((group) => <React.Fragment key={group.label || "account"}>
              {group.label && <div className="sidebar-section-label settings-group-label">{group.label}</div>}
              {group.items.map(([id, I, label]) => (
                <button
                  key={id}
                  className={
                    "nav-item " + (settingsTab === id ? "selected" : "")
                  }
                  onClick={() => openSettings(id)}
                >
                  {icon(I)}
                  {label}
                </button>
              ))}
              </React.Fragment>)}
            </nav>
          </>
        ) : (
          <>
            <nav>
              {nav.map(([id, I, label]) => (
                <button
                  key={id}
                  className={
                    "nav-item " +
                    ((view === id || (id === "today" && view === "calendar")) && id !== "chat" ? "selected" : "")
                  }
                  onClick={() => { closeMobileNavigation(); if(id === "library")setLibraryJob(null); id === "chat" ? newDraft() : setView(id); }}
                >
                  {icon(I)}
                  {label}
                  {id === "chat" && <span className="shortcut">⌘ N</span>}
                </button>
              ))}
            </nav>
            <div className="workspace-projects">
              <div className="sidebar-section-label projects-heading"><button className="workspace-info-button" type="button" aria-label="Was ist ein Workspace?" onClick={()=>setModal({type:"workspace-info"})}>Workspace</button><IconButton label="Neuer Workspace" disabled={workspaceOpening} onClick={()=>setModal({type:"project"})}>{icon(Plus,16)}</IconButton></div>
              {(boot.workspaceWarnings||[]).map((warning,index)=><p className="page-note" role="status" key={index}>{warning}</p>)}
              {(boot.projects || []).map((space) => (
                <section className={"workspace-group" + (expandedProject === space.id ? " expanded" : "")} key={space.id}>
                  <div className="workspace-heading">
                    <button
                      className="workspace-select"
                      title={space.workspaceError || space.workspaceDescription || space.name}
                      aria-expanded={expandedProject === space.id}
                      onClick={() => {
                        if (projectId !== space.id) {
                          chooseProject(space.id);
                          newDraft(space.id);
                        } else
                          setExpandedProject((id) =>
                            id === space.id ? null : space.id,
                          );
                      }}
                    >
                      <span className="project-glyph" style={{color:projectColor(modal?.type === "project" && modal.project?.id === space.id ? modal.color ?? space.color : space.color)}}>{icon(projectGlyphs[space.icon] || Folder, 17)}</span>
                      <span>{space.name}</span>
                      <RecordingIndicator chatId={`draft:${space.id}`}/>
                      {icon(expandedProject === space.id ? ChevronDown : ChevronRight, 12)}
                    </button>
                    <ChatMenu label={"Workspace verwalten: " + space.name} className="icon-button" items={[
                      {id:"edit", label:"Workspace bearbeiten …", icon:icon(SquarePen,16), action:()=>setModal({type:"project",project:space})},
                      ...(boot.features?.workspaceSpecialization?[{id:"setup",label:"Arbeitsweise im Chat anpassen …",icon:icon(MessageCircle,16),action:guard(()=>configureWorkspace(space.id))}]:[]),
                      {id:"files", label:"Dateien öffnen", icon:icon(FolderOpen,16), action:()=>{if(projectId !== space.id) newDraft(space.id); chooseProject(space.id); setView("chat"); setPanel("files");}}
                    ]}>{icon(MoreHorizontal,17)}</ChatMenu>
                    <IconButton label={`Neuer Chat in ${space.name}`} onClick={()=>newDraft(space.id)}>{icon(Plus,16)}</IconButton>
                  </div>
                  {space.workspaceError&&<p className="page-note workspace-status" role="alert">{space.workspaceError}</p>}
                  {expandedProject === space.id && (
                    <ScrollEdgeFade className="workspace-chats chats-scroll" tabIndex={0} role="region" aria-label={`Chats in ${space.name}`}>
                      {projectChatList(chats, space.id, expandedLists[space.id] !== false).visible.map((c, index, visible) => (
                        <React.Fragment key={c.id}>
                          {(index === 0 || chatDateGroup(c, listClock) !== chatDateGroup(visible[index - 1], listClock)) && (
                            <div className="chat-date-separator"><span>{chatDateGroup(c, listClock)}</span></div>
                          )}
                        <div
                          className={
                            "chat-row " + (chatMenu === c.id ? "menu-open " : "") +
                            (view === "chat" && headerSession?.id === c.id
                              ? "selected"
                              : "")
                          }
                          key={c.id}
                        >
                          <button title={`${c.title} · ${relativeTime(c.updatedAt, listClock)}`} onClick={guard(() => openChat(c.id))}>
                            <span className="chat-row-title">{c.title}</span>
                            <RecordingIndicator chatId={c.id}/>
                            {c.pinned && <span className="chat-pin" title="Angepinnt">{icon(Pin, 16)}</span>}
                            <span className="chat-age">{relativeTime(c.updatedAt, listClock)}</span>
                            {c.private && <span className="chat-row-lock" role="img" aria-label={c.locked ? "Gesperrt" : "Privat, entsperrt"}>{icon(Lock,15)}</span>}
                            <span className="chat-state" role="img" aria-label={active[c.id] ? "In Arbeit" : hasUnreadReply(c) ? "Ungelesene Antwort" : c.lastTurnStatus === "failed" ? "Fehlgeschlagen" : c.lastTurnStatus === "interrupted" ? "Gestoppt" : undefined}>
                              {active[c.id] ? <AppLoader /> : c.lastTurnStatus === "completed" ? <span className="chat-complete" data-unread={hasUnreadReply(c)} aria-hidden="true">{icon(Check, 15)}</span> : c.lastTurnStatus === "failed" ? icon(AlertCircle, 15) : c.lastTurnStatus === "interrupted" ? icon(Pause, 14) : null}
                            </span>
                          </button>
                          {audioState.chatId===c.id && <span className="chat-audio-indicator"><ChatAudioButton Button={IconButton} chatId={c.id}/></span>}
                          <IconButton
                            label={"Chat-Aktionen: " + c.title}
                            disabled={c.locked}
                            onClick={() =>
                              setChatMenu(chatMenu === c.id ? null : c.id)
                            }
                          >
                            {icon(MoreHorizontal, 16)}
                          </IconButton>
                          {chatMenu === c.id && (
                            <div className="context-menu">
                              <button onClick={guard(async()=>{setChatMenu(null);if(audioState.chatId===c.id && audioState.mode==='follow') chatAudio.stop();else await chatAudio.start(api,{chatId:c.id,title:c.title,mode:'follow'});})}>
                                {icon(Volume2,15)}{audioState.chatId===c.id && audioState.mode==='follow' ? 'Chat vorlesen ausschalten' : 'Chat vorlesen'}
                              </button>
                              <button
                                onClick={() => {
                                  setModal({ type: "rename", chat: c });
                                  setChatMenu(null);
                                }}
                              >
                                {icon(SquarePen, 15)}Umbenennen
                              </button>
                              <button
                                onClick={guard(() =>
                                  updateChat(c, { pinned: !c.pinned }),
                                )}
                              >
                                {icon(Pin, 15)}
                                {c.pinned ? "Lösen" : "Anheften"}
                              </button>
                              <button
                                disabled={!!active[c.id] || !!updatingChats[c.id]}
                                onClick={guard(() =>
                                  updateChat(c, { archived: true }),
                                )}
                              >
                                {icon(Archive, 15)}Archivieren
                              </button>
                            </div>
                          )}
                        </div>
                        </React.Fragment>
                      ))}
                      {projectChatList(chats, space.id, true).more && <button className="chat-list-expand" aria-expanded={expandedLists[space.id] !== false} onClick={() => setExpandedLists(old => ({...old, [space.id]: old[space.id] === false}))}>{expandedLists[space.id] !== false ? "Weniger anzeigen" : "Mehr anzeigen"}</button>}
                      {!projectChatList(chats, space.id, true).visible.length && (
                        <p className="sidebar-empty">Noch keine Gespräche</p>
                      )}
                    </ScrollEdgeFade>
                  )}
                </section>
              ))}
            </div>
          </>
        )}

      </aside>}
      <MainSurface className="main">
        {(
          <div className="chat-layout" hidden={view !== "chat"}>
            <div className="chat-workspace">
            {!embedded && view === "chat" && <header className="topbar chat-topbar floating-chat-topbar">
              <div className="row">
                {chats.find(c=>c.id===headerSession?.id)?.firmaItemId&&<button type="button" className="firma-back" onClick={()=>setView("firma")}>Firma</button>}
                {!sidebar && <IconButton label="Seitenleiste anzeigen" onClick={() => setSidebar(true)}>{icon(PanelLeft)}</IconButton>}
              </div>
              <div className="row">
                {(mobileViewport || paneOrder.length === 1) && headerSession?.hasTitle && <ChatTitle session={headerSession} compact/>}
                {!mobileViewport && <LayoutPicker count={paneOrder.length} onChange={changePaneCount}/>}
                <IconButton label={panel ? "Ablage schließen" : "Ablage öffnen"} active={!!panel} aria-expanded={!!panel} aria-controls="workspace-panel" onClick={() => { if (!panel) {setSelectedFile(null);setSelectedShelfImage(null);} setPanel(panel ? null : "chat"); }}>{icon(PanelRight)}</IconButton>
              </div>
            </header>}

            {!embedded && !mobileViewport && paneOrder.length > 1 && (visible.length < paneOrder.length || maximizedPane) && <div className="pane-tabs" role="tablist" aria-label="Offene Chats">
              {paneOrder.map((id,index) => { const session=sessions.current[id].current; return <button key={id} role="tab" tabIndex={activePane===id ? 0 : -1} onKeyDown={e=>{const offset=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(offset){e.preventDefault();const next=paneOrder[(paneOrder.indexOf(id)+offset+paneOrder.length)%paneOrder.length];activatePane(next);requestAnimationFrame(()=>panesRef.current?.parentElement.querySelector(`[aria-controls="chat-pane-${next}"]`)?.focus())}}} aria-selected={activePane===id} aria-controls={`chat-pane-${id}`} onClick={()=>activatePane(id)}>{session?.running ? <AppLoader /> : session?.unread ? icon(Check,14) : icon(MessageCircle,14)}<span>{session?.title || `Chat ${index+1}`}</span><RecordingIndicator paneNumber={id} chatId={session?.id || `draft:${session?.projectId}`}/></button> })}
              {maximizedPane && <IconButton label="Aufteilung wiederherstellen" onClick={()=>setMaximizedPane(false)}>{icon(PanelLeft,16)}</IconButton>}
            </div>}
            <div className={"chat-panes " + (!embedded && visible.length > 1 ? "multiple" : "")} ref={embedded ? undefined : panesRef}>
            {!embedded && sharedParticlesEnabled(boot.settings.welcomeParticles || "on", visible.map(id => sessions.current[id].current)) && <WelcomeParticles reduceMotion={boot.settings.reduceMotion === "on"} theme={boot.settings.theme} />}
            <section
              id={`chat-pane-${paneNumber}`}
              role="region" aria-label={`Chat ${paneLabel}: ${chatTitle}`}
              data-pane={embedded ? undefined : 0}
              data-trailing-pane={!embedded && visible.at(-1) === 0 ? "true" : undefined}
              hidden={!embedded && !visible.includes(0)}
              style={embedded ? undefined : {order:paneOrder.indexOf(0)*2, flexGrow:paneWeights[0] || 1}}
              className={"chat-main pane-slot " + ((!embedded && activePane === 0) ? "active-pane" : "") }
              onPointerDownCapture={activateComposer}
              onFocusCapture={activateComposer}
              onDragEnter={e=>{if(chatLocked) return; if(!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.stopPropagation(); dragDepth.current++; setDraggingFiles(true);}}
              onDragOver={e=>{if(!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect="copy";}}
              onDragLeave={e=>{e.stopPropagation(); if(--dragDepth.current <= 0) {dragDepth.current=0;setDraggingFiles(false);}}}
              onDrop={e=>{if(chatLocked) {e.preventDefault();return;} if(!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.stopPropagation(); dragDepth.current=0; setDraggingFiles(false); void upload(e.dataTransfer.files);}}
            >
              {draggingFiles && <div className="chat-file-drop" role="status">{icon(Paperclip,24)}<span>Dateien hier anhängen</span></div>}
              {!mobileViewport && (embedded ? showPaneHeader : paneOrder.length > 1) && <div className="pane-header"><div className="row">
                <RecordingIndicator paneNumber={paneNumber} chatId={chatId || `draft:${projectId}`}/>
                <ChatTitle session={localSession} compact extraItems={[
                  {id:"maximize-panel", label:(embedded ? isMaximized : maximizedPane) ? "Aufteilung wiederherstellen" : `Chat ${paneLabel} maximieren`, icon:icon(Maximize,16), action:()=>embedded ? onMaximize?.() : (activatePane(0),setMaximizedPane(v=>!v))},
                  {id:"close-panel", label:`Chat ${paneLabel} schließen`, icon:icon(X,16), action:()=>embedded ? onClosePane?.() : closePane(0)},
                ]}/>
              </div></div>}
              {chatLocked ? <LockedChat key={chatId} id={chatId} api={api} onDone={()=>void privacyUnlocked().catch(error=>notify(error.message))}/> : <>
              {current?.calendarReportReady&&<div className="row"><button type="button" onClick={()=>{saveDraft();setView("calendar");}}>Kalender öffnen</button></div>}
              <ChapterScrubber className="message-index" reduceMotion={boot.settings.reduceMotion === "on"}
                chapters={(thread?.turns || []).filter(t=>t.items?.some(i=>i.type === "userMessage")).map((t,n)=>({
                  id:t.id, title:`Eingabe ${n+1}`, meta:<MessageTime value={t.startedAt}/>,
                  description:t.items.find(i=>i.type === "userMessage").content?.filter(c=>c.type === "text").map(c=>c.text).join(" ") || "Anhang",
                }))}
                currentIndex={(thread?.turns || []).filter(t=>t.items?.some(i=>i.type === "userMessage")).findIndex(t=>t.id === selectedTurn)}
                onSelect={chapter=>{followScroll.current=false;setAwayFromBottom(true);setSelectedTurn(chapter.id);const target=document.getElementById(`pane-${paneNumber}-turn-${chapter.id}`);target?.scrollIntoView({block:"start"});target?.focus({preventScroll:true})}} />
              <div
                className="conversation"
                ref={scrollRef}
                tabIndex={0}
                aria-label="Gesprächsverlauf"
              >
                {loading ? (
                  <div className="message-column"><Skeleton variant="chat" label="Gespräch wird geladen …"/></div>
                ) : threadError ? (
                  <div className="message-column" role="alert"><p>{threadError}</p><button onClick={retryChatHistory}>Verlauf erneut laden</button></div>
                ) : !visibleTurns.length ? (
                  <ChatStart visible={foreground && view === "chat" && readablePane} api={api} routines={!!boot.features?.routines} revision={libraryRevision} composing={!!text.trim() || attachments.length>0} greeting={greeting} profile={boot.settings} requests={requests} notifications={notificationState.data?.items || []} chats={chats.filter(c=>!c.private)} projectId={projectId} error={notificationState.error}
                    onOpen={async entry=>{
                      const item=entry.kind==='inbox'?(entry.lead||entry):entry;
                      if(item.kind==='allowances'){openSettings('usage');return;}
                      if(item.kind==='calendar'){await openCalendarReport();return;}
                      if(item.kind==='statistics'){await openStatisticsReport();return;}
                      if(item.kind==='weather'){await openWeatherReport(item);return;}
                      if(item.prompt){setText(item.prompt);inputRef.current?.focus();return;}
                      if(item.entry){setModal({type:'library-file',entry:item.entry,entries:[item.entry]});return;}
                      if(item.job){setModal({type:'job',job:item.job});return;}
                      if(item.threadId){await openChat(item.threadId,undefined,item.turnId);return;}
                      if(item.kind==='request'){setModal("activity");return;}
                      if(item.kind==='report'){
                        const result=await api("/planner/chat",{id:item.noticeId});await refreshChats();await openChat(result.thread.id);
                        await api("/notifications/read",{id:item.noticeId});await notificationState.refresh();return;
                      }
                      if(item.noticeId){setModal({type:"notifications",id:item.noticeId});}
                    }}/>

                ) : (
                  <div className="message-column">
                    {visibleTurns.map((t, index) => {
                      const date = dayLabel(t.startedAt);
                      const previous = dayLabel(visibleTurns[index - 1]?.startedAt);
                      return <React.Fragment key={t.id}>
                        {date && date !== previous && <div className="chat-day-divider"><span>{date}</span></div>}
                        <ChatTurn chatTitle={chatTitle} chatId={chatId} statisticsApi={api} statisticsSnapshot={current?.statisticsSnapshot} agentProfile={boot.settings} paneNumber={paneNumber} workerId={current?.workerId || "codex"} workspace={boot.workspace} directory={current?.cwd || boot.workspace} turn={t} running={running && t.id === active[chatId]} onForkTurn={forkTurn} onEditTurn={editTurn} onRetryTurn={retryTurn}
                          onDeleteTurn={deleteTurn} onRecover={recoverDelivery}
                          actionsDisabled={running || busy} waiting={requests.some(r => r.params?.threadId === chatId)} visible={foreground && view === "chat" && readablePane} onFile={openTurnFile} />
                      </React.Fragment>;
                    })}
                    {requests
                      .filter((r) => r.params?.threadId === chatId && !questionRequest(r))
                      .map((r) => (
                        <RequestCard
                          key={r.id}
                          request={r}
                          onReply={async (id, result) => {
                            await api("/respond", { id, result });
                            setRequests((rs) => rs.filter((r) => r.id !== id));
                          }}
                        />
                      ))}
                  </div>
                )}
              </div>
              <div className="composer-area">
                {chats.find(c=>c.id===chatId)?.firmaItemId&&<FirmaReview api={api} chatId={chatId} revision={(thread?.turns?.at(-1)?.id||"")+":"+(thread?.turns?.at(-1)?.status||"")} running={running||busy}/> }
                {awayFromBottom && <button className="jump-latest" aria-label="Zur neuesten Nachricht" onClick={()=>{setSelectedTurn(null);scrollController.current?.resume()}}>{icon(ArrowUp,18)}</button>}
                <form className={"composer pill-composer " + (mode === "plan" ? "planning" : "")} onSubmit={guard(submit)}>
                  {boot?.features?.slashCommands && composerText.startsWith('/') && !questionState.request && !chatLocked && foreground && view === 'chat' && readablePane && <ComposerCommandController
                    text={composerText} workerId={pickerWorker} chatId={chatId} projectId={projectId}
                    nativeCommands={sameWorker ? thread?.workerSession?.availableCommands : undefined}
                    enabled={true} api={api} controlRef={commandControl} inputRef={inputRef}
                    onSelect={value=>{setText(value);inputRef.current?.focus();}} />}
                  <ComposerQuestion state={questionState} onActivate={activateComposer} />
                  {(attachments.length > 0 || pendingUploads.some(item=>item.key === (chatId || `new:${projectId}`))) && (
                    <div className="attachments" aria-label="Angehängte Dateien">
                      {pendingUploads.filter(item=>item.key === (chatId || `new:${projectId}`)).map(item=><span className="attachment" key={item.id} role="status">{<AppLoader size={14} />}<span className="attachment-name">{item.name}</span><span>Wird angeheftet …</span></span>)}
                      {attachments.map((a, n) => (
                        <span className="attachment" key={a.path}>
                          <button type="button" className="attachment-open" title={a.name} aria-label={`Anhang öffnen: ${a.name}`} onClick={guard(() => openFile(a.path))}>
                            {a.image ? <img className="attachment-preview" src={"/api/file/raw?path="+encodeURIComponent(a.path)} alt="" /> : icon(Paperclip, 18)}
                            <span className="attachment-name">{a.name}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Anhang entfernen: ${a.name}`}
                            onClick={() =>
                              setAttachments((as) =>
                                as.filter((_, i) => i !== n),
                              )
                            }
                          >
                            {icon(X, 13)}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <ComposerHeading>
                      <ModelPicker
                        workerSession={sameWorker ? thread?.workerSession : undefined}
                        onSessionChange={async change => {
                          const id = chatId;
                          const r = await api("/worker-session", {id, ...change});
                          if (chatRef.current === id) setThread(old => old ? {...old, workerSession:r.thread.workerSession} : old);
                        }}
                        mode={mode} onModeChange={setMode} modeDisabled={running || busy}
                        planAvailable={boot.workers?.find(w => w.id === pickerWorker)?.capabilities?.plan !== false}
                        models={pickerModels} model={pickerModel} effort={pickerEffort} reduceMotion={boot.settings.reduceMotion === "on"}
                        workerId={pickerWorker} workers={boot.workers || []}
                        hasConversation={!!chatId} disabled={busy} providerDisabled={!!current?.jobId || !!current?.channelOnly}
                        running={running} serviceTier={sameWorker ? chatId ? current?.serviceTier : draftSpeed : null} onSpeedChange={sameWorker ? changeSpeed : undefined}
                        onProviderChange={chooseProvider} onRefresh={refreshPickerWorkers}
                        context={nextSelection ? "Nächste Nachricht" : running ? "Auswahl für die nächste Nachricht" : current?.fallbackFrom ? `${workerName(current.workerId)} übernimmt als Vertretung für ${workerName(current.fallbackFrom)}.` : undefined}
                        onChange={changePickerSelection}
                      />
                  </ComposerHeading>
                  <ComposerFocus active={composerActive} multiple={embedded ? showPaneHeader : paneOrder.length > 1} visible={foreground && view === "chat" && readablePane} onActivate={activateComposer}>
                      <IconButton
                        label="Dateien anhängen"
                        disabled={!!questionState.request}
                        onClick={(e) => {
                          e?.preventDefault();
                          uploadRef.current.click();
                        }}
                      >
                        {icon(Plus, 21)}
                      </IconButton>
                  <ComposerInput
                    type={questionState.question?.isSecret ? "password" : undefined}
                    ref={inputRef}
                    placeholder={questionState.request ? "Sonstiges" : "Nachricht"}
                    readOnly={!!questionState.request && (!questionState.question?.custom || questionState.pending)}
                    aria-label={`${questionState.request ? "Sonstiges zur Rückfrage" : "Nachricht"} für Chat ${paneLabel}${composerActive ? ", ausgewählt" : ""}`}
                    value={composerText}
                    rows={1}
                    onChange={(e) => setComposerText(e.target.value)}
                    onPaste={e=>{if(questionState.request) return; const files=Array.from(e.clipboardData.files || []); if(files.length) {e.preventDefault(); void upload(files);}}}
                    onKeyDown={(e) => {
                      if(commandControl.current?.onKeyDown(e))return;
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        guard(submit)();
                      }
                    }}
                  />
                      <DictationComposer paneNumber={paneNumber} sourceKey={`${paneNumber}:${chatId || "new:"+projectId}:${questionState.request?.id || ""}:${questionState.question?.id || ""}`}
                        title={chatTitle} visible={view === "chat" && readablePane && selectedPane && !chatLocked}
                        onReturn={()=>window.dispatchEvent(new CustomEvent("wrapper/recording-return",{detail:{paneNumber,chatId,projectId}}))}
                        canSend={()=>draftKey()===(chatId || `new:${projectId}`) && !chatLocked}
                        controlRef={dictationControl} shortcutEnabled={foreground && view === "chat" && readablePane && selectedPane && !chatLocked} api={api} notify={notify} chatId={chatId || "draft:" + projectId} enabled={embedded ? paneVisible : visible.includes(0)} running={running || busy || questionState.pending || !!uploadCounts.current.get(chatId || `new:${projectId}`)} onText={transcript => {
                        if(questionState.request && questionState.appendText(transcript))return;
                        appendDictation(draftCache.current,chatId || `new:${projectId}`,draftKey(),setText,transcript);
                      }} onVoiceText={transcript => submit(undefined, transcript)} onSendText={transcript => submit(undefined, transcript, true)} reply={(() => { const t = thread?.turns?.filter(t => !t.clientPending && t.status !== "inProgress").at(-1); return t ? { id:t.id, chatId, status:t.status, text:t.items?.filter(i => i.type === "agentMessage" && i.phase !== "commentary").map(i => i.text || "").join("\n") || "" } : null; })()} openSettings={() => { setSettingsTab("voice"); setView("settings"); }} />
                    <div className="composer-send-actions">
                      {questionState.request ? (
                        <>
                          {running && <IconButton label="Antwort stoppen" onClick={guard(() => api("/stop", {id:chatId}))}>{icon(Square,17)}</IconButton>}
                          <button className="send-button" type="submit" disabled={!questionState.canSend} aria-label={questionState.index < questionState.model.questions.length-1 ? "Antwort übernehmen und weiter" : "Rückfrage beantworten"}>
                            {questionState.pending ? <AppLoader size={21}/> : icon(ArrowUp,21)}
                          </button>
                        </>
                      ) : running ? (
                        <>
                          <IconButton
                            label="Antwort stoppen"
                            onClick={guard(() => api("/stop", { id: chatId }))}
                          >
                            {icon(Square, 17)}
                          </IconButton>
                          <button
                            className="send-button"
                            type="submit"
                            disabled={!!uploadCounts.current.get(chatId || `new:${projectId}`) || (!text.trim() && !attachments.length)}
                            aria-label="Laufende Aufgabe ergänzen"
                          >
                            {icon(ArrowUp, 19)}
                          </button>
                        </>
                      ) : (
                        <button
                          className="send-button"
                          type="submit"
                          disabled={
                            busy || !!uploadCounts.current.get(chatId || `new:${projectId}`) || (!text.trim() && !attachments.length)
                          }
                          aria-label="Nachricht senden"
                        >
                          {busy ? <AppLoader size={21} /> : icon(ArrowUp, 21)}
                        </button>
                      )}
                    </div>
                  </ComposerFocus>

                </form>
                <input
                  hidden
                  ref={uploadRef}
                  type="file"
                  multiple
                  onChange={guard((e) => upload(e.target.files))}
                />
              </div>
              </>}
            </section>
            {!embedded && mountedPanes.filter(id=>id!==0).map(id=><div key={id} data-pane={id} data-trailing-pane={visible.at(-1) === id ? "true" : undefined} hidden={!visible.includes(id)} className={"pane-slot secondary-pane " + (activePane===id ? "active-pane" : "")} style={{order:paneOrder.indexOf(id)*2, flexGrow:paneWeights[id] || 1}}>
              <App embedded onOpenSettings={openSettings} onOpenCalendar={()=>setView('calendar')} paneVisible={view === "chat" && visible.includes(id)} paneActive={activePane===id} paneNumber={id} panePosition={paneOrder.indexOf(id)} sessionRef={sessions.current[id]} onSessionChange={sessionChanged} initialProject={projectId} isMaximized={maximizedPane} showPaneHeader={paneOrder.length>1} onActivate={()=>activatePane(id)} onMaximize={()=>{activatePane(id);setMaximizedPane(v=>!v)}} onClosePane={()=>closePane(id)} onOpenFile={path=>{activatePane(id);requestAnimationFrame(()=>guard(openFile)(path))}}/>
            </div>)}
            {!embedded && visible.slice(0,-1).map((id,index)=><div className="pane-divider-slot" key={`divider-${id}`} style={{order:paneOrder.indexOf(id)*2+1}}><PaneDivider value={Math.round(100*(paneWeights[id] || 1)/((paneWeights[id] || 1)+(paneWeights[visible[index+1]] || 1)))} onResize={delta=>resizePanes(id,visible[index+1],delta)}/></div>)}
            </div>
            </div>
            {panel && (
              <aside id="workspace-panel" aria-label="Ablage" ref={workspacePanelRef} className={"workspace-panel" + (workspaceExpanded ? " workspace-expanded" : "")} onKeyDown={event=>{if(event.key==='Escape' && !event.defaultPrevented){event.preventDefault();if(workspaceExpanded)setWorkspaceExpanded(false);else if(selectedFile || selectedShelfImage)closeShelfPreview();else setPanel(null);}}}>
                <PanelLight mode={boot.settings.panelLight || "animated"} active={view === "chat"} />
                <div className="workspace-resizer"><PaneDivider label="Ablage-Breite ändern" value={workspaceWidth || 360} min={280} max={1000} onReset={()=>{setWorkspaceWidth(null);setWorkspaceExpanded(false)}} onResize={delta=>{setWorkspaceExpanded(false);setWorkspaceWidth(width=>Math.max(280,Math.min(1000,(workspacePanelRef.current?.getBoundingClientRect().width || width || 360)-delta)))}}/></div>
                <div className="panel-head">
                  <span className="shelf-heading">Ablage</span>
                  <IconButton label={workspaceExpanded ? "Ablage verkleinern" : "Ablage vergrößern"} aria-pressed={workspaceExpanded} onClick={()=>setWorkspaceExpanded(value=>!value)}>{icon(workspaceExpanded ? Minimize : Maximize, 16)}</IconButton>
                  <IconButton className="shelf-close" label="Ablage schließen" onClick={() => setPanel(null)}>{icon(X,16)}</IconButton>
                </div>
                <div className="shelf-selector"><select className="workspace-view-select" aria-label="Ablage-Ansicht" value={panel} onChange={event=>{closeShelfPreview(false);setPanel(event.target.value);}}><option value="chat">Im Chat</option><option value="files">Dateien</option></select></div>
                <div className="shelf-section" hidden={panel!=='chat' || !!selectedFile || !!selectedShelfImage}>
                  <ChatShelf key={`${activeSession?.id || 'new'}:${activePane}`} entries={activeSession?.shelfEntries || []} title={activeSession?.title || 'Neuer Chat'} loading={activeSession?.shelfLoading} error={activeSession?.shelfError} locked={activeSession?.locked} onRetry={()=>activeSession?.reloadShelf()} onOpen={openShelfEntry}/>
                </div>
                <div className="shelf-section" hidden={panel!=='files' || !!selectedFile || !!selectedShelfImage}>
                  <div className="file-panel">{boot.workspaceToolsVersion ? <AgentFiles key={`${workspaceProject?.id}:${agentFolderTarget || ""}`} projectId={agentFolderTarget ? undefined : workspaceProject?.id} projectName={agentFolderTarget ? undefined : workspaceProject?.name} api={api} initialFolder={agentFolderTarget || `${boot.workspace}/${workspaceProject?.path || ""}`.replace(/\/$/, "")} enlarged={workspaceExpanded} onPreview={()=>setWorkspaceExpanded(value=>!value)}/> : <p role="status">Die Dateiansicht wird nach dem nächsten Serverstart verfügbar.</p>}</div>
                </div>
                {!activeSession?.locked && (selectedFile || selectedShelfImage) && <ShelfFilePreview key={selectedFile || selectedShelfImage.id} entry={selectedShelfImage || activeSession?.shelfEntries?.find(entry=>entry.path===selectedFile) || {id:selectedFile,kind:'file',path:selectedFile,name:selectedFile.split('/').pop(),origin:'Datei'}} api={api} onBack={()=>closeShelfPreview()}/>}
              </aside>
            )}
          </div>
        )}
        {view === "chat" ? null : view === "firma" ? (
          <FirmaPage PageHeading={PageHeading} api={api} onShowSidebar={!sidebar?()=>setSidebar(true):undefined} onChat={async (id,warning)=>{await refreshChats();await openChat(id);if(warning)notify(warning);}}/>
        ) : view === "inbox" ? (
          <InboxPage key={projectId} api={api} projectId={projectId} PageHeading={PageHeading} sidebarHost={inboxSidebarHost} sidebarVisible={sidebar} onShowSidebar={() => setSidebar(true)} onHideSidebar={() => setSidebar(false)} onBack={() => setView("chat")}/>
        ) : view === "today" || view === "calendar" ? (
          <PlannerPage key={projectId} projectId={projectId} PageHeading={PageHeading} section={view} onSection={setView} onShowSidebar={!sidebar ? () => setSidebar(true) : undefined} api={api} crmEnabled={!!boot.features?.crmCore} notifications={notificationState} notificationsEnabled={!!boot.features?.routines} requests={requests.length} onRequests={()=>setModal("activity")} onNotifications={id=>setModal(id?{type:"notifications",id}:"notifications")} onConnections={()=>{setSettingsTab("connections");setView("settings");}} onJobs={()=>setView("jobs")} onBriefing={async item=>{const result=await api("/planner/chat", {id:item.id, ...(item.demo?{demoDate:item.demoDate}: {})});await refreshChats();await openChat(result.thread.id);}}/>
        ) : view === "jobs" ? (
          <div className={`jobs-layout${modal?.type === 'job' ? ' has-detail' : ''}`}>
          <div className="page jobs-page">
            <PageHeading title="Aufträge" onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}>
              {boot.features?.routines&&<IconButton label="Benachrichtigungen öffnen" aria-haspopup="dialog" aria-expanded={modal === "notifications" || modal?.type === "notifications"} onClick={()=>setModal("notifications")}><NotificationBell signal={bellSignal} />{notificationState.data?.unread>0&&<i className="notification-dot"/>}</IconButton>}
              <button className="primary small-button" onClick={() => setModal({ type: "job" })}>{icon(Plus, 16)}Erstellen</button>
            </PageHeading>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={jobFilter === "templates" ? "Vorlagen suchen" : "Aufträge suchen"}
            />
            <div className="tabs">
              {jobFilters.map(([id, label]) => (
                <button
                  key={id}
                  className={jobFilter === id ? "selected" : ""}
                  aria-pressed={jobFilter === id}
                  onClick={() => setJobFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!["system","templates"].includes(jobFilter)&&<FilterPicker label="Workspace" value={jobWorkspace} onChange={setJobWorkspace} options={[{value:"all",label:"Alle Workspaces"},...boot.projects.map(p=>({value:p.id,label:p.name}))]}/>}
            {jobFilter === "templates" && <JobTemplateList query={search} onChoose={template => setModal({type: "job", template})} />}
            {jobFilter !== "templates" && jobsLoading && !jobs.length && !jobsError && <Skeleton layout="jobs" label="Aufträge werden geladen …"/>}
            {jobFilter !== "templates" && jobsError && <p role="alert">{jobsError} <button onClick={loadJobs}>Erneut laden</button></p>}
            {visibleJobs.map((j) => (
              <div className={`job-row${modal?.job?.id === j.id ? ' selected' : ''}`} key={j.id}>
                <div className="job-status">
                  {icon(
                    j.status === "invalid" || j.lastRun?.status === "failed"
                      ? AlertCircle
                      : j.lastRun?.status === "running"
                        ? LoaderCircle
                        : Clock,
                    19,
                  )}
                </div>
                <button
                  className="job-info"
                  onClick={() => setModal({ type: 'job', job: j })}
                >
                  <strong>{j.name}</strong>
                  <span>
                    {j.status === "invalid"
                      ? "Auftrag nicht lesbar"
                      : j.schedule?.type === "interval" ? `Alle ${j.schedule.minutes} Minuten`
                      : j.schedule?.type === "event" ? `Bei ${j.schedule.event}`
                      : j.schedule?.type === "once" ? `Einmal am ${new Date(j.schedule.at).toLocaleString("de-DE")}`
                      : j.schedule?.type === "weekly" ? `${j.schedule.days.map(d=>["Mo","Di","Mi","Do","Fr","Sa","So"][d]).join(", ")} um ${j.schedule.time}`
                      : j.schedule?.type === "manual"
                        ? "Manuell"
                        : (j.schedule?.type === "weekdays"
                            ? "Werktags"
                            : "Täglich") +
                          " um " +
                          j.schedule?.time}{" "}
                    · {j.managed ? 'System' : (boot.projects.find(p=>p.id === (j.projectId || 'default'))?.name || 'Workspace')} · {jobStateLabel(j)}
                    {j.lastRun &&
                      " · " +
                        {
                          completed:
                            j.worker === "n8n"
                              ? "Webhook beantwortet"
                              : "Letzter Lauf erfolgreich",
                          failed: "Fehlgeschlagen",
                          running: "Läuft",
                          queued: "In Warteschlange",
                          dispatching: "Wird übergeben",
                          interrupted: "Gestoppt",
                          cancelled: "Abgebrochen",
                        }[j.lastRun.status]}
                  </span>
                </button>
                {j.lastRun && (
                  <IconButton
                    label={"Ausführung ansehen: " + j.name}
                    onClick={() => setModal({ type: "job-run", job: j })}
                  >
                    {icon(FileText, 17)}
                  </IconButton>
                )}
                <IconButton
                  label="Jetzt ausführen"
                  disabled={
                    ["queued", "dispatching", "running"].includes(j.lastRun?.status) || j.status === "invalid"
                  }
                  onClick={guard(async () => {
                    const r = await api("/jobs/run", { id: j.id });
                    if (r.threadId) {
                      await refreshChats();
                      await openChat(r.threadId);
                    } else if (r.queued) notify("Auftrag ist in der Warteschlange.");
                    else notify(
                        "Webhook hat geantwortet. Details stehen im Ausführungsprotokoll.",
                      );
                    setJobs(await api("/jobs"));
                  })}
                >
                  {icon(Play, 17)}
                </IconButton>
                {j.schedule?.type !== "manual" && j.status !== "invalid" && (!j.managed || ["system-memory","system-backup","system-frontend"].includes(j.id)) && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={j.status === "active"}
                    aria-label={"Zeitplan für " + j.name}
                    title={
                      j.status === "active"
                        ? "Zeitplan pausieren"
                        : "Zeitplan aktivieren"
                    }
                    className="apple-switch"
                    onClick={guard(async () => {
                      await api("/jobs/save", {
                        ...j,
                        status: j.status === "active" ? "paused" : "active",
                      });
                      setJobs(await api("/jobs"));
                    })}
                  >
                    <span />
                  </button>
                )}
              </div>
            ))}
            {/* A quiet, left-aligned empty line; the page keeps only title, create, search, filters and the list. */}
            {jobFilter !== "templates" && !jobsLoading && !jobsError && visibleJobs.length === 0 && (
              <p className="section-intro jobs-empty" role="status">
                {jobs.some(j=>Boolean(j.managed)===(jobFilter==='system'))
                  ? "Keine passenden Aufträge"
                  : jobFilter === 'system' ? "Keine Systemaufträge" : "Noch keine Aufträge"}
              </p>
            )}
          </div>
          {modal?.type === 'job' && <section className="job-detail" aria-label="Auftragsdetails">
            <div className="row between job-detail-heading"><h2>{modal.job?.name || 'Neuer Auftrag'}</h2><IconButton label="Details schließen" onClick={()=>setModal(null)}>{icon(X,18)}</IconButton></div>
            {modal.job?.managed ? <>
              <p className="section-intro">{modal.job.description || modal.job.instructions}</p>
              <p>{jobStateLabel(jobs.find(j=>j.id===modal.job.id) || modal.job)}</p>
              {modal.job.id === 'system-index' && <p className="form-help">Der Suchindex wird im Hintergrund alle 30 Sekunden aktualisiert. „Jetzt ausführen“ stößt eine zusätzliche Aktualisierung an.</p>}
              <button onClick={()=>{setSettingsTab(modal.job.id==='system-memory'?'memory':['system-backup','system-cleanup'].includes(modal.job.id)?'storage':'system');setModal(null);setView('settings');}}>Systemeinstellungen öffnen</button>
              {modal.job.lastRun?.coreRunId && <CoreRunDetails api={api} id={modal.job.lastRun.coreRunId}/>}
            </> : <>
              {modal.job?.id && <div className="row job-detail-links"><button onClick={()=>{setLibraryJob({id:modal.job.id,name:modal.job.name});setModal(null);setView('library');}}>Ergebnisse ansehen</button></div>}
              {modal.job?.lastRun && <div className="row job-detail-links">
                <button onClick={()=>setModal({type:'job-run',job:modal.job})}>Letzte Ausführung ansehen</button>
                {modal.job.lastRun.threadId && <button onClick={guard(async()=>{const id=modal.job.lastRun.threadId;setModal(null);await openChat(id);})}>Ergebnis im Chat öffnen</button>}
              </div>}
              {jobEditor}
            </>}
          </section>}
          </div>
        ) : view === "library" ? (
          <LibraryPage jobFilter={libraryJob} onClearJob={()=>setLibraryJob(null)} onJob={guard(async entry=>{const currentJobs=await api('/jobs');setJobs(currentJobs);const job=currentJobs.find(j=>j.id===entry.jobId);if(!job){notify('Der Auftrag ist nicht mehr verfügbar.');return;}setView('jobs');setModal({type:'job',job});})} revision={libraryRevision} api={api} notify={notify} projects={boot.projects} PageHeading={PageHeading} onShowSidebar={!sidebar?()=>setSidebar(true):undefined} onOpen={(entry,entries)=>setModal({type:'library-file',entry,entries})} onReuse={guard(async entry=>{const file=await api('/library/reuse',{id:entry.id,projectId});setAttachments(a=>[...a,file]);setView('chat');})} onSource={guard(async entry=>{if(chats.some(c=>c.id===entry.threadId))await openChat(entry.threadId);else notify('Das Quellgespräch ist nicht verfügbar.');})}/>
        ) : connectionsActive ? (
          <div className="page connections-page">
            <PageHeading title="Verbindungen" onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}/>
            <ConnectionsContent projectId={projectId} api={api} features={boot.features} integrations={integrations} audioConnections={audioConnections}
              loaded={connectionsLoaded} error={connectionsError} category={connectionCategoryFilter} onCategory={setConnectionCategoryFilter}
              search={search} onSearch={setSearch} setModal={setModal} onRetry={()=>refreshConnections(true)} FilterPicker={FilterPicker} SearchBox={SearchBox}/>
          </div>
        ) : skillsActive ? (
          <div className="page skills-page">
            <PageHeading title="Skills" onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}>
              {boot.features?.skillLibrary&&<IconButton label="Skill hinzufügen" onClick={()=>setModal({type:'skill-hub'})}>{icon(Plus)}</IconButton>}
              <IconButton label="Skills neu laden" onClick={loadSkills} disabled={skillsLoading}>{icon(RefreshCw)}</IconButton>
            </PageHeading>
            <div className="skill-filters">
              <SearchBox
                value={search}
                onChange={setSearch}
                placeholder="Fähigkeiten suchen"
              />
              <FilterPicker label="Skill-Herkunft" value={skillSource} onChange={setSkillSource} options={[{value:'all',label:'Alle Quellen'},...[...new Set(skills.map(s=>s.source).filter(Boolean))].sort().map(s=>({value:s,label:s}))]}/>
              <FilterPicker
                label="Skill-Kategorie"
                value={skillFilter}
                onChange={setSkillFilter}
                disabled={skillsLoading && !skills.length}
                options={[
                  { value: "all", label: "Alle Kategorien" },
                  ...availableSkillGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                  })),
                ]}
              />
            </div>
            <p className="skill-results-status" role="status">
              {visibleSkillCount} {visibleSkillCount === 1 ? "Skill" : "Skills"}{" "}
              in {skillGroups.length}{" "}
              {skillGroups.length === 1 ? "Kategorie" : "Kategorien"}
            </p>
            <div className="skill-groups" aria-busy={skillsLoading}>
              {skillGroups.map((group) => (
                <section
                  className="skill-category"
                  aria-labelledby={"skill-category-" + group.id}
                  key={group.id}
                >
                  <h2
                    className="skill-category-title"
                    id={"skill-category-" + group.id}
                  >
                    {group.name}
                    <span>{group.skills.length}</span>
                  </h2>
                  <div className="integration-grid">
                    {group.skills.map((s, n) => (
                      <button
                        key={s.path || n}
                        className="integration-item"
                        onClick={() => setModal({ type: "skill", skill: s })}
                      >
                        <SkillIcon skill={s} />
                        <div>
                          <strong>{skillName(s)}</strong>
                          <p>{skillDescription(s)}</p>
                          <p>{s.source || 'Quelle unbekannt'}</p>
                        </div>
                        {s.enabled !== false ? (
                          <span
                            className="skill-status"
                            role="img"
                            aria-label="Installiert"
                          >
                            {icon(Check, 17)}
                          </span>
                        ) : (
                          <span className="badge">Deaktiviert</span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {skills.length > 0 && !visibleSkillCount && (
              <Empty
                Icon={Search}
                title="Keine passenden Skills"
                action={
                  <button
                    onClick={() => {
                      setSearch("");
                      setSkillFilter("all");
                      setSkillSource('all');
                    }}
                  >
                    Filter zurücksetzen
                  </button>
                }
              >
                Ändere den Suchbegriff oder die Kategorie.
              </Empty>
            )}
            {!skills.length && skillsLoading && (
              <Skeleton layout="skills" label="Skills werden geladen …"/>
            )}
            {!skills.length && !skillsLoading && skillsError && (
              <Empty
                Icon={AlertCircle}
                title="Skills konnten nicht geladen werden"
                action={<button onClick={loadSkills}>Erneut versuchen</button>}
              >
                {skillsError}
              </Empty>
            )}
            {!skills.length && !skillsLoading && !skillsError && (
              <Empty Icon={Sparkles} title="Noch keine Skills gefunden">
                Skills werden aus der Firmenbasis und den vom Worker unterstützten
                Skill-Verzeichnissen geladen.
              </Empty>
            )}
          </div>
        ) : (
          <div className={"page settings-page" + (settingsTab === "identity" ? " agent-settings-page" : "")}>
            <PageHeading title={settingsTab === "design" ? "Unser Design" : settingNav.find((s) => s[0] === settingsTab)?.[2]} onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}/>
            {settingsTab === 'updates' && boot.features.productUpdates ? <ProductUpdates api={api} initialTab={updatesTab} onTabChange={setUpdatesTab} onGitHub={()=>setModal({type:'github-connection'})}/> : settingsTab === 'service' ? <ServiceSettings/> : ['system','memory','storage','access'].includes(settingsTab) && boot.features.operations ? <SystemSettings key={settingsTab} api={api} section={settingsTab} chats={chats} onJobs={()=>setView('jobs')} onLibrary={()=>setView('library')} onConnections={()=>openSettings('connections')}/> : settingsTab === "general" ? (
              <>
                <h3 className="section-heading">Schaltzentrale</h3>
                <div className="settings-group">
                  <SettingRow
                    title="Projektordner"
                    description={
                      boot.workspace + (project?.path ? "/" + project.path : "")
                    }
                    action={
                      <button
                        onClick={() => {
                          setView("chat");
                          setPanel("files");
                        }}
                      >
                        Öffnen
                      </button>
                    }
                  />
                </div>
                <h3 className="section-heading">Arbeitsmodus</h3>
                <div className="settings-group">
                  <SettingRow
                    title="Ausführen"
                    description="Neue Gespräche starten mit Vollzugriff auf Dateien und Befehle."
                  />
                  <SettingRow
                    title="Planen"
                    description="Im Composer umschalten: Verfügbar bei Workern mit schreibgeschütztem Planmodus."
                  />
                </div>
              </>
            ) : settingsTab === "voice" ? (
              <VoiceSettings api={api} notify={notify} openConnections={() => openSettings("connections")} onText={value => { setText(previous => previous ? previous + "\n" + value : value); setView("chat"); }} />
            ) : settingsTab === "appearance" ? (
              <>
                <AppearanceDesign settings={boot.settings} onChange={saveSettings}/>
                <div className="settings-group appearance-controls">
                  {Object.entries(appearanceOptions).filter(([key]) => ["uiFont", "textSize", "reduceMotion"].includes(key)).map(([key, spec]) => <SettingRow key={key} title={{uiFont: "Schriftart", textSize: "Schriftgröße", reduceMotion: "Bewegung"}[key]} description={{uiFont: "Eine gemeinsame Schrift für die gesamte Oberfläche.", textSize: "Passt Texte in Chats, Listen und Einstellungen an.", reduceMotion: "Reduziert Animationen. Ausgeschaltet gilt deine Systemeinstellung."}[key]}>
                    {key === "reduceMotion" ? <button type="button" role="switch" className="apple-switch" aria-label="Bewegung reduzieren" aria-checked={boot.settings.reduceMotion === "on"} onClick={guard(()=>saveSettings({reduceMotion: boot.settings.reduceMotion === "on" ? "system" : "on"}))}><span/></button> : <select aria-label={{uiFont: "Schriftart", textSize: "Schriftgröße", reduceMotion: "Bewegung"}[key]} value={boot.settings[key] || spec.default} onChange={guard(e => saveSettings({[key]: e.target.value}))}>{spec.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
                  </SettingRow>)}
                </div>
                <LoaderSettings settings={boot.settings} onChange={saveSettings} />
                <h3 className="section-heading">Visuell</h3>
                <div className="settings-group">
                  <IconMotionSetting value={boot.settings.iconAnimation || "hover"} onChange={value => guard(() => saveSettings({iconAnimation: value}))()} />
                  <AvatarMotionSetting value={boot.settings.avatarMotion || "face"} onChange={value => guard(() => saveSettings({avatarMotion: value}))()} avatar={boot.settings.avatar} color={boot.settings.avatarColor} />
                  <SettingRow title="Flächenlicht" description="Dezente Lichtverläufe in Seitenleiste und Workspace.">
                    <select aria-label="Flächenlicht" value={boot.settings.panelLight || "animated"} onChange={e => guard(() => saveSettings({panelLight: e.target.value}))()}>{appearanceOptions.panelLight.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </SettingRow>
                  <StartTextMotionSetting/>
                  <WeatherMotionSetting/>
                  <SettingRow title="Wettervorschau" description="Wetterzustände und Tageszeiten direkt ausprobieren."><button type="button" aria-expanded={weatherPreviewOpen} onClick={()=>setWeatherPreviewOpen(value=>!value)}>{weatherPreviewOpen?'Vorschau schließen':'Wettervorschau öffnen'}</button></SettingRow>
                  {weatherPreviewOpen&&<WeatherPreview/>}
                  <SettingRow title="Reiseeffekt" description="Sanft wandernde Lichtpunkte auf der Startansicht oder in allen Chats.">
                    <select aria-label="Reiseeffekt" value={boot.settings.welcomeParticles || "on"} onChange={e => guard(() => saveSettings({welcomeParticles: e.target.value}))()}>{appearanceOptions.welcomeParticles.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </SettingRow>
                </div>
                <div className="settings-group"><SettingsNavigationRow title="Unser Design" description="Bausteine, Farben und Gestaltungsgrundlage" value={"CI " + designIdentity.version} onClick={()=>setSettingsTab("design")}/></div>
              </>
            ) : settingsTab === "design" ? (
              <><button className="design-back" onClick={()=>setSettingsTab("appearance")}>{icon(ArrowLeft,16)}Aussehen</button><DesignReference theme={boot.settings.theme} tone={boot.settings.designTone} accent={boot.settings.highlightColor}/></>
            ) : settingsTab === "account" || settingsTab === "user" || settingsTab === "users" ? (
              <UsersSettings api={api} user={boot.user || {id:"owner",name:"Zugangscode",role:"owner"}} accounts={!!boot?.features?.users}/>
            ) : settingsTab === "identity" ? (
              <>
                <AgentPreferences api={api} onSaved={profile=>{setBoot(old=>({...old,settings:{...old.settings,name:profile.name,avatar:profile.avatar,avatarColor:profile.avatarColor,avatarConfigured:true}}));notify("Dein Agent wurde gespeichert.")}} />
                <h3 className="section-heading">Arbeitsgrundlage</h3>
                <div className="settings-group">
                  <SettingRow
                    title="Identität und Arbeitsweise"
                    description="Rolle und persönliche Vorgaben deines Agenten."
                    action={
                      <button
                        onClick={guard(async () => {
                          setView("chat");
                          await openFile("soul/IDENTITY.md");
                        })}
                      >
                        Bearbeiten
                      </button>
                    }
                  />
                  <SettingRow
                    title="Gemeinsame Arbeitsregeln"
                    description="Übergreifende Regeln für Aufgaben, Dateien und Zusammenarbeit."
                    action={
                      <button
                        onClick={guard(async () => {
                          setView("chat");
                          await openFile("AGENTS.md");
                        })}
                      >
                        Bearbeiten
                      </button>
                    }
                  />
                </div>
              </>
            ) : settingsTab === "secrets" ? (
              <>
                <div className="settings-group">
                  {integrations.secrets.map((s) => (
                    <SettingRow
                      key={s.id}
                      title={s.name}
                      description="•••••••• · In der lokalen .env gespeichert"
                      action={
                        <div className="row">
                          <button
                            onClick={() =>
                              s.system ? setSettingsTab(s.id==='system-backup'?'storage':'access') : s.provider
                                ? guard(async () => { await refreshAudioConnections(); setModal({ type: "audio-connection", name: s.provider }); })()
                                : integrations.connections.some(c=>c.kind==='crm'&&c.secretId===s.id)
                                  ? setModal({type:'crm-connection',connection:integrations.connections.find(c=>c.kind==='crm'&&c.secretId===s.id)})
                                : integrations.connections.some(c=>c.kind==='service'&&c.secretId===s.id)
                                  ? setModal({type:'service-connection',connection:integrations.connections.find(c=>c.kind==='service'&&c.secretId===s.id)})
                                  : setModal({ type: "secret", secret: s })
                            }
                          >
                            Ersetzen
                          </button>
                          <IconButton
                            label="Secret entfernen"
                            disabled={s.system}
                            onClick={guard(async () => {
                              await api("/secrets/delete", { id: s.id });
                              setIntegrations(await api("/integrations?view=settings"));
                            })}
                          >
                            {icon(Trash2, 16)}
                          </IconButton>
                        </div>
                      }
                    />
                  ))}
                </div>
                <button
                  className="primary"
                  onClick={() => setModal({ type: "secret" })}
                >
                  {icon(Plus, 16)}Secret hinzufügen
                </button>
                <p className="page-note">
                  In Verbindungen gespeicherte Schlüssel erscheinen automatisch hier.
                  Aufträge und Verbindungen speichern nur einen Verweis.
                  Schlüssel werden weder im Browser angezeigt noch als Klartext
                  im Agent-Ordner abgelegt.
                </p>
              </>
            ) : settingsTab === "privacy" ? (
              <>
                <h3 className="section-heading">Datenwege</h3>
                <div className="settings-group">
                  <SettingRow title="Lokale Suche und Memory" description="Volltext, Fuzzy-Suche, Embeddings und die automatische Memory-Pflege laufen auf diesem Mac. Neue Quellen stammen aus öffentlichen Gesprächsnachrichten; erkannte Zugangsdaten werden vor der Memory-Aufnahme entfernt." action={<button onClick={()=>setSettingsTab('memory')}>Memory verwalten</button>}/>
                  <SettingRow title="KI-Worker" description="Der gewählte Worker erhält deine Nachricht, Anhänge und ausgewählte Kontextstellen. Bei einem Cloud-Modell verlassen diese Inhalte das Gerät. Die Memory-Erkennung ist keine vollständige Anonymisierung; Werkzeuge können im gewählten Arbeitsmodus weitere Daten lesen oder übertragen." action={<button onClick={()=>setSettingsTab('engines')}>Worker wählen</button>}/>
                  <SettingRow title="Übergaben erfassen" description="Nachrichtengröße, Anzahl der Anhänge und beteiligter Anschluss werden ohne Nachrichteninhalt im Übergabeprotokoll festgehalten." action={<span className="badge">Aktiv</span>}/>
                  <SettingRow title="Zugang und Mobilgeräte" description="Die Anwendung bindet an localhost. Tailscale Serve ermöglicht privaten HTTPS-Zugang nach eingerichteter Anmeldung." action={<button onClick={()=>setSettingsTab('access')}>Zugang verwalten</button>}/>
                  <SettingRow title="Aufbewahrung" description="Chatverlauf, aktives Memory, lokale Notizversionen und verschlüsselte Sicherungen besitzen unterschiedliche Lebenszyklen." action={<button onClick={()=>setSettingsTab('storage')}>Speicher verwalten</button>}/>
                </div>
              </>
            ) : settingsTab === "engines" ? (
              <>
                <WorkerSettings api={api} onChange={refresh} onConnections={() => openSettings("connections")} />
                <h3>Lokale Modelle</h3>
                <LocalWorkers api={api} SettingRow={SettingRow} />
              </>
            ) : settingsTab === "usage" ? (
              <UsageSettings api={api}/>
            ) : settingsTab === "shortcuts" ? (
              <><PaneShortcutSettings/><div className="settings-group">
                {[
                  ["Neuer Chat", "⌘ N"],
                  ["Chats durchsuchen", "⌘ K"],
                  ["Einstellungen", "⌘ ,"],
                  ["Nachricht senden", "Enter"],
                  ["Neue Zeile", "⇧ Enter"],
                  ["Dialog schließen", "Esc"],
                ].map(([title, key]) => (
                  <SettingRow
                    key={title}
                    title={title}
                    action={<kbd>{key}</kbd>}
                  />
                ))}
              </div></>
            ) : settingsTab === "archive" ? (
              <>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Archivierte Chats durchsuchen"
                />
                {matchingArchivedChats.map((c) => (
                    <div className="archive-row" key={c.id}>
                      <div>
                        <strong>{c.title}</strong>
                        <p>
                          {new Date(c.updatedAt).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <button
                        disabled={!!updatingChats[c.id] || !!active[c.id]}
                        aria-label={"Chat wiederherstellen: " + c.title}
                        onClick={guard(() =>
                          updateChat(c, { archived: false }),
                        )}
                      >
                        {updatingChats[c.id] ? "Wiederherstellen …" : "Wiederherstellen"}
                      </button>
                    </div>
                  ))}
                {archivedChats.length > 0 && matchingArchivedChats.length === 0 && (
                  <Empty Icon={Search} title="Keine archivierten Chats gefunden">
                    Versuche einen anderen Suchbegriff.
                  </Empty>
                )}
                {archivedChats.length === 0 && (
                  <Empty Icon={Archive} title="Dein Archiv ist leer">
                    Archivierte Gespräche kannst du hier wiederherstellen.
                  </Empty>
                )}
              </>
            ) : null}
          </div>
        )}
      </MainSurface>
      {!embedded && <ChatAudioControls Button={IconButton}/>}
      {!embedded && <SystemNotice ref={systemNoticeRef} onBusyChange={setServerRestartBusy} api={api} user={boot?.user} message={toast} onDismiss={()=>setToast("")} />}
      {welcome && !embedded && <AgentWelcome api={api} initialName={boot.settings.name} onClose={() => setWelcome(false)} onSaved={profile => {
        setBoot(old => ({...old, settings: {...old.settings, name:profile.name, avatar:profile.avatar, avatarColor:profile.avatarColor, avatarConfigured:true}}));
        setWelcome(false);
      }} />}
      {modal?.type === 'chat-privacy' && <ChatPrivacyDialog id={chatId} action={modal.action} api={api} onClose={()=>setModal(null)} onDone={()=>{setModal(null);void refreshChats();}}/>}
      {modal?.type === "delivery-recovery" && <Modal title={modal.action === 'discard' ? 'Nachricht löschen?' : modal.action === 'edit' ? 'Nachricht bearbeiten' : 'Erneut senden?'} onClose={()=>{if(!busy)setModal(null);}}>
        <form onSubmit={guard(async event=>{
          event.preventDefault();
          if(busy)return;
          const text=modal.action === 'edit' ? new FormData(event.currentTarget).get('text') : modal.receipt.text;
          setBusy(true);
          try {
            const result=await messageOutbox.recover(modal.receipt.clientMessageId,modal.action === 'discard' ? 'discard' : 'retry',
              {text,confirmed:true,revision:modal.receipt.revision || 0});
            setModal(null);
            if(result.status === 'unknown' || result.status === 'failed')notify('Der Nachrichtenstatus hat sich geändert. Bitte erneut prüfen.');
          } finally {setBusy(false);}
        })}>
          {modal.action === 'discard' ? <p>Diese nicht bestätigte Nachricht wird aus dem Postausgang entfernt. Bereits gestartete Arbeit wird dadurch nicht rückgängig gemacht.</p> : <>
            {modal.receipt.status === 'unknown' && <p role="alert">Die Nachricht könnte bereits angekommen sein. Erneutes Senden kann den Auftrag doppelt ausführen.</p>}
            {modal.action === 'edit' ? <Field label="Nachricht"><textarea name="text" defaultValue={modal.receipt.text || ''} rows={5} autoFocus/></Field> : <p>{modal.receipt.text || 'Nachricht mit Anhang'}</p>}
            {!!modal.receipt.attachments?.length && <p className="form-help">Anhänge bleiben beim erneuten Senden erhalten.</p>}
          </>}
          <div className="row"><button type="button" disabled={busy} onClick={()=>setModal(null)}>Abbrechen</button>
            <button type="submit" disabled={busy} className={modal.action === 'discard' ? 'danger' : 'primary'}>{modal.action === 'discard' ? 'Nachricht löschen' : 'Erneut senden'}</button></div>
        </form>
      </Modal>}
      {modal?.type === "delete-message" && (
        <Modal title="Nachricht löschen?" onClose={() => setModal(null)}>
          <p>Diese Nachricht, die zugehörige Antwort und alle folgenden Nachrichten werden aus dem Gespräch gelöscht. Bereits ausgeführte Dateiänderungen bleiben bestehen.</p>
          <div className="row">
            <button onClick={() => setModal(null)}>Abbrechen</button>
            <button className="danger" disabled={busy} onClick={guard(async () => {
              setBusy(true);
              try {
                const result = await api("/turn/delete", {id: chatId, turnId: modal.turn.id, expectedLastTurnId: thread.turns.at(-1)?.id});
                setThread(result.thread);
                setModal(null);
                await refreshChats();
                notify("Nachricht und Folgeverlauf gelöscht.");
              } finally { setBusy(false); }
            })}>Nachricht und Folgeverlauf löschen</button>
          </div>
        </Modal>
      )}
      {modal?.type === "search-note" && <NoteEditor api={api} entry={modal.entry} onClose={()=>setModal(null)} onSaved={()=>setLibraryRevision(v=>v+1)} onOpen={path=>setModal({...modal,entry:{...modal.entry,path}})}/> }
      {modal === "search" && (
        <Modal title="Suche" className="system-search-dialog" onClose={() => setModal(null)}>
          <SystemSearch api={api} pages={[
            ...nav.map(([id, , title]) => ({kind:"page", id, title, detail:"Bereich"})),
            {kind:"page", id:"calendar", title:"Kalender", detail:"Heute · Tag, Woche, Monat"},
            ...settingNav.map(([id, , title]) => ({kind:"setting", id, title:`Einstellungen · ${title}`, detail:"Einstellungen"})),
          ]} onOpen={guard(async result => {
            setModal(null);
            if (result.kind === "chat") { await openChat(result.id); return; }
            if (result.kind === "project") { newDraft(result.id); chooseProject(result.id); setExpandedProject(result.id); setView("chat"); return; }
            if (result.kind === "file") { setView("library"); setModal({type:"library-file",entry:result.entry}); return; }
            if (result.kind === "knowledge") { setView("library"); setModal({type:"search-note",entry:result.entry}); return; }
            if (result.kind === "skill") { openSettings("skills"); setModal({type:"skill",skill:result.entry}); return; }
            if (result.kind === "job") {
              if (result.entry.managed) { setSettingsTab(result.id==='system-memory'?'memory':result.id==='system-backup'||result.id==='system-cleanup'?'storage':'system'); setView('settings'); }
              else { setView("jobs"); setModal({type:"job",job:result.entry}); }
              return;
            }
            if (result.kind === "setting") { openSettings(result.id); return; }
            setView(result.id);
          })}/>
        </Modal>
      )}
      {modal === "activity" && (
        <Modal title="Aktivität" onClose={() => setModal(null)}>
          {requests.length ? (
            requests.map((r) => (
              <button
                key={r.id}
                className="activity-row"
                onClick={guard(async () => {
                  if(r.connectionId){const list=await api("/services");const connection=list.connections.find(c=>c.id===r.connectionId);if(connection)setModal({type:"service-connection",connection});return;}
                  setModal(null);
                  await openChat(r.params.threadId);
                })}
              >
                {icon(Shield, 17)}Freigabe oder Antwort erforderlich
              </button>
            ))
          ) : (
            <Empty Icon={CheckCircle2} title="Alles im Blick">
              Aktuell sind keine Rückfragen offen.
            </Empty>
          )}
        </Modal>
      )}
      {modal === "shareChat" && <Modal title="Chat teilen" onClose={()=>setModal(null)}>
        <p>Kopiere den Gesprächsinhalt oder lade ihn als Markdown-Datei herunter. Der Chat-Link funktioniert nur mit Zugang zu dieser App.</p>
        <Field label="Lokaler Chat-Link"><input readOnly value={`${window.location.origin}/?chat=${encodeURIComponent(chatId)}`} onFocus={e=>e.target.select()}/></Field>
        <div className="action-list">
          <button onClick={guard(async()=>{await navigator.clipboard.writeText(`${window.location.origin}/?chat=${encodeURIComponent(chatId)}`);notify("Lokalen Chat-Link kopiert.")})}>{icon(Link)}Lokalen Link kopieren</button>
          <button disabled={!thread?.turns?.length} onClick={copyConversation}>{icon(Copy)}Gespräch kopieren</button>
          <button disabled={!thread?.turns?.length} onClick={exportChat}>{icon(Download)}Markdown herunterladen</button>
          {typeof navigator.share === "function" && <button disabled={!thread?.turns?.length} onClick={guard(async()=>{try {await navigator.share({title:chatTitle,text:conversationText(thread,chatTitle)});} catch(error){if(error.name!=="AbortError")throw error;}})}>{icon(ArrowUpRight)}Über System teilen …</button>}
        </div>
      </Modal>}
      {modal?.type === "workspace-info" && <Modal title="Was ist ein Workspace?" onClose={()=>setModal(null)}><WorkspaceInfo onCreate={()=>setModal({type:"project"})} busy={workspaceOpening}/></Modal>}
      {modal?.type === "project" && (
        <Modal
          title={modal.project ? "Workspace bearbeiten" : "Neuer Workspace"}
          className="project-dialog"
          onClose={() => setModal(null)}
        >
          <WorkspaceDefinitionEditor key={modal.project?.id||'new'} api={api} projectId={modal.project?.id} project={modal.project} legacy={!boot.features?.workspaceSpecialization} onCancel={()=>setModal(null)} onConfigure={boot.features?.workspaceSpecialization&&modal.project?()=>configureWorkspace(modal.project.id):undefined} onSaved={result=>{
            setBoot(old=>({...old,projects:result.projects,settings:result.settings}));setModal(null);
            if(!modal.project){chooseProject(result.project.id);newDraft(result.project.id);}
          }}/>

        </Modal>
      )}
      {modal?.type === "rename" && (
        <Modal title="Gespräch umbenennen" onClose={() => setModal(null)}>
          <form
            onSubmit={guard(async (e) => {
              e.preventDefault();
              const title = String(new FormData(e.currentTarget).get("title")).trim();
              if (!title) throw Error("Bitte einen Chat-Titel eingeben.");
              if (modal.chat) await updateChat(modal.chat, {title});
              else setDraftTitle(title);
              setModal(null);
            })}
          >
            <Field label="Name">
              <input
                name="title"
                defaultValue={modal.chat?.title || draftTitle}
                maxLength={160}
                autoFocus
                required
              />
            </Field>
            <div className="row end">
              <button className="primary">Speichern</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.type === "secret" && (
        <Modal
          title={modal.secret ? "Secret ersetzen" : "Secret hinzufügen"}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={guard(async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await api("/secrets/save", {
                id: modal.secret?.id,
                name: f.get("name"),
                value: f.get("value"),
              });
              setIntegrations(await api("/integrations?view=settings"));
              setModal(null);
              notify("In der lokalen .env gespeichert.");
            })}
          >
            <Field label="Bezeichnung">
              <input
                name="name"
                defaultValue={modal.secret?.name}
                placeholder="z. B. n8n API"
                required
              />
            </Field>
            <Field label="Schlüssel">
              <input
                name="value"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
            <div className="row end">
              <button className="primary">Sicher speichern</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.type === "audio-connection" && (
        <Modal title={audioConnections[modal.name] ? "Verbindung bearbeiten" : "Verbindung hinzufügen"} onClose={() => setModal(null)}>
          <AudioConnectionForm name={modal.name} connected={audioConnections[modal.name]} api={api} notify={notify} onSaved={async () => { await refreshAudioConnections(); setIntegrations(await api("/integrations?view=settings")); setModal(null);  }} />
        </Modal>
      )}
      {modal?.type === "connection" && (
        <Modal
          title={
            modal.connection?.id
              ? "Verbindung bearbeiten"
              : "Verbindung hinzufügen"
          }
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={guard(async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await api("/connections/save", {
                id: modal.connection?.id,
                provider: modal.connection?.provider,
                ...Object.fromEntries(f),
              });
              setIntegrations(await api("/integrations?view=settings"));
              setModal(null);

            })}
          >
            {connectionCatalog.find(s=>s.provider===modal.connection?.provider)?.setupUrl && <p className="form-help">
              {connectionCatalog.find(s=>s.provider===modal.connection?.provider).setupNote}{' '}
              <a href={connectionCatalog.find(s=>s.provider===modal.connection?.provider).setupUrl} target="_blank" rel="noreferrer">MCP einrichten</a>
            </p>}
            <Field label="Name">
              <input
                name="name"
                defaultValue={modal.connection?.name}
                required
              />
            </Field>
            <Field label="Kategorie">
              <select name="category" defaultValue={connectionCategory(modal.connection || {})}>
                {connectionCategories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Anschluss">
              <select
                name="kind"
                defaultValue={modal.connection?.kind || "webhook"}
              >
                <option value="webhook">Workflow-Webhook (z. B. n8n)</option>
                <option value="link">Dienst im Browser öffnen</option>
              </select>
            </Field>
            <Field label="Adresse">
              <input
                name="url"
                type="url"
                defaultValue={modal.connection?.url}
                placeholder="https://…"
                required
              />
            </Field>
            <Field label="Bearer-Token (optional)">
              <select
                name="secretId"
                defaultValue={modal.connection?.secretId || ""}
              >
                <option value="">Kein Secret</option>
                {integrations.secrets.filter(s => s.format !== 'crm-credentials').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Neuen Bearer-Token speichern (optional)">
              <input name="secretValue" type="password" autoComplete="new-password" />
            </Field>
            <p className="page-note">Ein neuer Token wird in der lokalen .env gespeichert und unter Secrets angelegt. Er ersetzt für diese Verbindung die Auswahl oben.</p>
            <div className="row between">
              {modal.connection?.id ? (
                <>
                  <IconButton
                    label="Verbindung entfernen"
                    onClick={guard(async () => {
                      await api("/connections/delete", {
                        id: modal.connection.id,
                      });
                      setIntegrations(await api("/integrations?view=settings"));
                      setModal(null);
                    })}
                  >
                    {icon(Trash2, 17)}
                  </IconButton>
                  <button
                    type="button"
                    onClick={guard(async () =>
                      notify(
                        (
                          await api("/connections/test", {
                            id: modal.connection.id,
                          })
                        ).message,
                      ),
                    )}
                  >
                    Erreichbarkeit testen
                  </button>
                </>
              ) : (
                <span />
              )}
              <button className="primary">Speichern</button>
            </div>
          </form>
        </Modal>
      )}
      {modal?.type==='crm-connection'&&<Modal title={modal.connection.id?'Verbindung bearbeiten':'Verbindung hinzufügen'} onClose={()=>setModal(null)}>
        <CrmConnectionForm key={modal.connection.id || modal.connection.provider} connection={modal.connection} api={api} notify={notify} Field={Field} onChanged={async()=>setIntegrations(await api('/integrations?view=settings'))} onSaved={async message=>{setIntegrations(await api('/integrations?view=settings'));setModal(null);notify(message);}}/>
      </Modal>}
      {modal?.type==='github-connection' && <Modal title="GitHub verbinden" onClose={()=>setModal(null)}><GitHubConnectionForm api={api} onSaved={async()=>{await refreshConnections(true);}}/></Modal>}
      {modal?.type==='messenger-connection' && <Modal title={modal.connection.id?'Verbindung bearbeiten':'Verbindung hinzufügen'} onClose={()=>setModal(null)}><MessengerConnectionForm connection={modal.connection} api={api} projectId={projectId} Field={Field} onSaved={async()=>{await refreshConnections(true);setModal(null);}}/></Modal>}
      {modal?.type==='mail-connection'  && <Modal title={modal.connection.id?'Verbindung bearbeiten':'Verbindung hinzufügen'} onClose={()=>setModal(null)}>
        <MailConnectionForm connection={modal.connection} api={api} projectId={projectId} onSaved={async()=>{await refreshConnections(true);setModal(null);}} onHelp={message=>{setText(previous=>(previous?previous+'\n\n':'')+message);setModal(null);setView('chat');inputRef.current?.focus();}}/>
      </Modal>}
      {modal?.type==='service-connection'&&<Modal title={modal.connection.id?'Verbindung bearbeiten':'Verbindung hinzufügen'} onClose={()=>setModal(null)}>
        <ServiceConnectionForm key={modal.connection.id||modal.connection.provider} connection={modal.connection} api={api} notify={notify} Field={Field} workers={boot.workers||[]} projects={boot.projects||[]} requests={requests} RequestCard={RequestCard} onReply={guard(async(id,result)=>{await api('/respond',{id,result});setRequests(rs=>rs.filter(r=>r.id!==id));})} onChanged={connections=>setIntegrations(old=>({...old,connections:[...old.connections.filter(c=>c.kind!=='service'),...connections]}))} onSaved={async message=>{setIntegrations(await api('/integrations?view=settings'));setModal(null);notify(message);}}/>
      </Modal>}
      {modal?.type==='library-file'&&<LibraryPreview entry={modal.entry} entries={modal.entries} onNavigate={entry=>setModal(current=>({...current,entry}))} onClose={()=>setModal(null)}>
        <div className="library-preview"><FileContent key={modal.entry.scope+modal.entry.path} path={modal.entry.path} scope={modal.entry.scope} api={api} readOnly reading/></div>

      </LibraryPreview>}
      {modal?.type==='image-create'&&<Modal title="Bild erstellen" onClose={()=>setModal(null)}><ImageForm api={api} Field={Field} projects={boot.projects} projectId={projectId} connections={integrations.connections} onCreated={entry=>{setLibraryRevision(v=>v+1);setModal({type:'library-file',entry});}}/></Modal>}
      {modal?.type==='skill-hub'&&<Modal title="Skill hinzufügen" onClose={()=>setModal(null)}><SkillHub api={api} Field={Field} onSelect={skill=>setModal({type:'skill',skill})} onCreated={()=>setModal({type:'skill-create'})}/></Modal>}
      {modal?.type==='skill-create'&&<Modal title="Eigenen Skill erstellen" onClose={()=>setModal(null)}><CreateSkillForm api={api} Field={Field} onCreated={async()=>{await loadSkills();setModal(null);}}/></Modal>}
      {modal?.type==='device-connection'&&<Modal title={modal.connection.id?'Verbindung bearbeiten':'Verbindung hinzufügen'} onClose={()=>setModal(null)}><DeviceConnection key={modal.connection.id||modal.connection.provider} connection={modal.connection} api={api} Field={Field} projects={boot.projects||[]} workers={boot.workers||[]} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==='tailscale'&&<Modal title="Tailscale" onClose={()=>setModal(null)}>{boot.features.deviceConnections?<NetworkConnection api={api}/>:<TailscaleConnection api={api}/>}</Modal>}
      {(modal === 'notifications'||modal?.type==='notifications') && <Modal title="Benachrichtigungen" onClose={()=>setModal(null)}><JobNotifications onUpdates={kind=>{setModal(null);setUpdatesTab(kind==='contribution'?'contributions':'version');openSettings(kind==='ai-update'?'engines':'updates');}} initialId={modal?.id} api={api} state={notificationState} Field={Field} requests={requests.length} onRequests={()=>setModal('activity')} onChat={async id=>{setModal(null);await openChat(id);}} onRun={item=>setModal({type:'job-run',job:{name:item.title,lastRun:{coreRunId:item.id.replace(/^attention-/,'')}}})}/></Modal>}
      {modal?.type === "job-run" && (
        <Modal title={modal.job.name} onClose={() => setModal(null)}>
          {modal.job.lastRun.coreRunId ? <CoreRunDetails api={api} id={modal.job.lastRun.coreRunId}/> : <>
          <div className="settings-group">
            <SettingRow
              title="Letzte Ausführung"
              description={modal.job.lastRun.runId}
              action={
                <span className="badge">
                  {{
                    completed:
                      modal.job.worker === "n8n"
                        ? "Webhook beantwortet"
                        : "Abgeschlossen",
                    running: "Läuft",
                    failed: "Fehlgeschlagen",
                    interrupted: "Gestoppt",
                  }[modal.job.lastRun.status] || modal.job.lastRun.status}
                </span>
              }
            />
            <SettingRow
              title="Worker"
              description={workerName(modal.job.worker)}
            />
            {modal.job.lastRun.error && (
              <SettingRow
                title="Fehler"
                description={modal.job.lastRun.error}
              />
            )}
          </div>
          {modal.job.worker === "n8n" && (
            <p className="form-help">
              Eine Webhook-Antwort ist keine Bestätigung, dass alle Schritte im
              Zielsystem abgeschlossen sind. Prüfe dafür die Rückmeldung im
              Protokoll.
            </p>
          )}
          <div className="row end">
            <button
              onClick={() => {
                setAgentFolderTarget(`${boot.workspace}/jobs/${modal.job.id}/runs`);
                setSelectedFile(null);
                setPanel("files");
                setView("chat");
                setModal(null);
              }}
            >
              Protokolle öffnen
            </button>
            {chats.find(
              (c) =>
                c.jobId === modal.job.id && c.runId === modal.job.lastRun.runId,
            ) && (
              <button
                className="primary"
                onClick={guard(async () => {
                  const chat = chats.find(
                    (c) =>
                      c.jobId === modal.job.id &&
                      c.runId === modal.job.lastRun.runId,
                  );
                  await openChat(chat.id);
                  setModal(null);
                })}
              >
                Gespräch öffnen
              </button>
            )}
          </div>
          </>}
        </Modal>
      )}
      {modal?.type === "job" && view !== 'jobs' && (
        <Modal title={modal.job ? "Auftrag bearbeiten" : "Neuer Auftrag"} wide onClose={() => setModal(null)}>{jobEditor}</Modal>
      )}
      {modal?.type === "skill" && (
        <Modal title={skillName(modal.skill)} onClose={() => setModal(null)}>
          <SkillDetails skill={modal.skill} api={api} Field={Field} onChanged={async()=>{await loadSkills();setModal(null);notify('Eigene Skillvariante angelegt.');}} onUse={s=>{setText(t=>(t?t+'\n\n':'')+`Nutze den Skill „${s.name}“ aus ${s.source||'der vorhandenen Installation'}. Lies dazu ${JSON.stringify(s.path)} und bei Bedarf dessen Referenzen. Prüfe die Voraussetzungen mit deinen vorhandenen Werkzeugen.\n\n`);setView('chat');setModal(null);inputRef.current?.focus();}}/>
        </Modal>
      )}
    </div></LoaderProvider>
  );
}
function SearchBox({ value, onChange, placeholder, autoFocus }) {
  return (
    <div className="search-box">
      {icon(Search, 19)}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Suche leeren">
          {icon(X, 15)}
        </button>
      )}
    </div>
  );
}
function JobForm({ job, jobs=[], initialTemplate, connections, workers, projects, modelsByWorker, defaultProjectId, onSave, routines, configurationReady }) {
  const [templateId, setTemplateId] = useState(initialTemplate?.id || "");
  const template = jobTemplates.find(t => t.id === templateId);
  const [draft, setDraft] = useState(() => job || (initialTemplate ? jobFromTemplate(initialTemplate.id) : {}));
  const [active, setActive] = useState(job?.status === "active");
  const [schedule, setSchedule] = useState(job?.schedule?.type || initialTemplate?.schedule.type || "manual"),
    [worker, setWorker] = useState(job?.worker || "auto");
  const [model, setModel] = useState(job?.model || '');
  const [effort, setEffort] = useState(job?.effort || '');
  const models = modelsByWorker[worker] || [];
  const selectedModel = models.find(m=>m.model===model);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          ...job,
          name: f.get("name"),
          instructions: f.get("instructions"),
          worker,
          connectionId: f.get("connectionId"),
          projectId: f.get('projectId'),
          model: worker === 'auto' || ['python','n8n'].includes(worker) ? '' : model,
          effort: model && worker !== 'auto' && !['python','n8n'].includes(worker) ? effort : '',
          ...(worker==='python'?{python:{handler:'script',script:f.get('script'),timeout:Number(f.get('timeout')),input:JSON.parse(String(f.get('pythonInput')||'{}'))},retry:{count:Number(f.get('retries')||0),idempotent:f.get('idempotent')==='on'}}:{}),
          ...(f.get('notificationTarget') ? {notification:{target:f.get('notificationTarget'),when:f.get('notificationWhen')||'always'}} : {}),
          schedule: {
            ...(job?.schedule?.timezone ? {timezone:job.schedule.timezone} : {}),
            ...(job?.schedule?.startAt ? {startAt:job.schedule.startAt} : {}),
            type: schedule,
            ...(['daily','weekdays','weekly'].includes(schedule) ? { time: f.get("time") } : {}),
            ...(schedule==='interval'?{minutes:Number(f.get('minutes'))}:{}),
            ...(schedule==='event'?{event:f.get('event')}:{}),
            ...(schedule==='weekly'?{days:f.getAll('days').map(Number)}:{}),
            ...(schedule==='once'?{at:new Date(String(f.get('at'))).toISOString()}:{})
          },
          status: schedule !== "manual" && active ? "active" : "paused",
        });
      }}
    >
      {!job && <>
        <Field label="Vorlage">
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">Eigener Auftrag</option>
            {jobCategories.map(category => <optgroup key={category} label={category}>
              {jobTemplates.filter(t => t.category === category).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>)}
          </select>
        </Field>
        {template && <div>
          <p className="form-help">{template.description} {template.sourceUrl && <a href={template.sourceUrl} target="_blank" rel="noreferrer">Hermes-Original</a>}</p>
          <p className="form-help">Benötigt: {template.needs}</p>
          {template.note && <p className="form-help">{template.note}</p>}
          <button type="button" onClick={() => {
            setDraft(jobFromTemplate(template.id)); setSchedule(template.schedule.type); setWorker("auto"); setActive(false);
          }}>Vorlage in Entwurf übernehmen</button>
          <p className="form-help">Ersetzt Name, Aufgabe und Zeitplan im Entwurf. Erst Speichern legt den Auftrag an.</p>
        </div>}
      </>}
      <Field label="Name">
        <input
          name="name"
          required
          value={draft.name || ""}
          onChange={e => setDraft(d => ({...d, name: e.target.value}))}
          placeholder="Zum Beispiel: Tagesüberblick"
        />
      </Field>
      <Field label="Aufgabe">
        <textarea
          name="instructions"
          rows={3}
          value={draft.instructions || ""}
          onChange={e => setDraft(d => ({...d, instructions: e.target.value}))}
          placeholder="Was soll erledigt werden? Welche Eingaben werden gebraucht? Wo soll das Ergebnis liegen?"
          required
        />
      </Field>
      <Field label="Workspace" hint="Jeder Lauf erstellt einen eigenen Chat in diesem Workspace.">
        <select name="projectId" defaultValue={job?.projectId || defaultProjectId || 'default'}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </Field>
      <div className="form-grid">
        <Field label="Ausführen mit">
          <select value={worker} onChange={(e) => {setWorker(e.target.value);setModel('');setEffort('');}}>
            <option value="auto">Automatisch · Standard und Vertretung</option>
            {workers.map(w => <option key={w.id} value={w.id} disabled={!w.configured}>{w.name}{!w.configured ? " · Noch nicht verbunden" : ""}</option>)}
            <option value="n8n">n8n · Fester Ablauf</option>
            <option value="python">Python · Lokales Skript</option>
          </select>
        </Field>
        <Field label="Zeitplan">
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          >
            <option value="manual">Nur manuell</option>
            <option value="daily">Täglich</option>
            <option value="weekdays">Werktags</option>
            {routines&&<><option value="weekly">Wöchentlich</option><option value="once">Einmal</option></>}
            <option value="interval">Intervall</option>
            <option value="event">Bei Ereignis</option>
          </select>
        </Field>
      </div>
      {!['auto','python','n8n'].includes(worker) && <div className="form-grid">
        <Field label="Modell"><select value={model} onChange={e=>{setModel(e.target.value);setEffort('');}}>
          <option value="">Standard des Anbieters</option>
          {model && !selectedModel && <option value={model} disabled>{model} · Nicht verfügbar</option>}
          {models.filter(m=>!m.hidden).map(m=><option key={m.model} value={m.model}>{m.displayName || m.model}</option>)}
        </select></Field>
        <Field label="Reasoning"><select value={effort} disabled={!selectedModel?.supportedReasoningEfforts?.length} onChange={e=>setEffort(e.target.value)}>
          <option value="">Standard des Modells</option>
          {(selectedModel?.supportedReasoningEfforts || []).map(o=><option key={o.reasoningEffort} value={o.reasoningEffort}>{o.displayName || o.reasoningEffort}</option>)}
        </select></Field>
      </div>}
      {worker==='python'&&<>
        <Field label="Python-Datei im Auftragsordner" hint="Zum Beispiel main.py unter jobs/<Auftrags-ID>. Die JSON-Eingabe kommt über stdin, das Ergebnis über stdout. Ein Muster liegt unter examples/python-job.py."><input name="script" defaultValue={job?.python?.script||'main.py'} required pattern="[a-zA-Z0-9_./-]+\.py"/></Field>
        <Field label="Eingabe als JSON-Objekt"><textarea name="pythonInput" rows={4} defaultValue={JSON.stringify(job?.python?.input||{},null,2)} onChange={e=>{try{const v=JSON.parse(e.target.value);e.target.setCustomValidity(v&&typeof v==='object'&&!Array.isArray(v)?'':'Ein JSON-Objekt eingeben.');}catch{e.target.setCustomValidity('Gültiges JSON eingeben.');}}}/></Field>
        <div className="form-grid"><Field label="Zeitlimit in Sekunden"><input type="number" name="timeout" min="1" max="3600" defaultValue={job?.python?.timeout||300}/></Field><Field label="Wiederholungen bei Fehler"><input type="number" name="retries" min="0" max="3" defaultValue={job?.retry?.count||0}/></Field></div>
        <label className="checkbox-label"><input type="checkbox" name="idempotent" defaultChecked={job?.retry?.idempotent}/>Der Ablauf darf ohne doppelte Wirkung wiederholt werden.</label>
        <p className="form-help">Wiederholungen erfolgen nur mit dieser Zusicherung. Skripte laufen als eigener Prozess mit Zeitlimit und ohne geerbte API-Schlüssel.</p>
      </>}
      {schedule==='interval'&&<Field label="Intervall in Minuten"><input name="minutes" type="number" min="1" max="525600" defaultValue={job?.schedule?.minutes||60} required/></Field>}
      {schedule==='event'&&<Field label="Ereignis"><select name="event" defaultValue={job?.schedule?.event||'memory.captured'}><option value="memory.captured">Neue Memory-Quelle</option><option value="memory.changed">Notiz geändert</option><option value="job.finished">Auftrag beendet</option></select></Field>}
      {worker === "n8n" && (
        <Field label="Workflow-Verbindung">
          <select name="connectionId" defaultValue={job?.connectionId} required>
            <option value="">Verbindung auswählen</option>
            {connections
              .filter((c) => c.kind === "webhook")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      {["daily","weekdays","weekly"].includes(schedule) && (
        <Field label={`Uhrzeit · ${job?.schedule?.timezone || "Zeitzone der Schaltzentrale"}`}>
          <input
            name="time"
            type="time"
            value={draft.schedule?.time || "09:00"}
            onChange={e => setDraft(d => ({...d, schedule: {...d.schedule, time: e.target.value}}))}
            required
          />
        </Field>
      )}
      {schedule==='weekly'&&<Field label="Wochentage"><div className="row job-weekdays">{['Mo','Di','Mi','Do','Fr','Sa','So'].map((label,day)=><label key={day} className="checkbox-label"><input type="checkbox" name="days" value={day} defaultChecked={(job?.schedule?.days||[0]).includes(day)}/>{label}</label>)}</div></Field>}
      {schedule==='once'&&<Field label="Termin · Zeitzone dieses Geräts"><input type="datetime-local" name="at" required defaultValue={job?.schedule?.at ? new Date(new Date(job.schedule.at).getTime()-new Date(job.schedule.at).getTimezoneOffset()*60000).toISOString().slice(0,16) : ''}/></Field>}
      {routines&&<NotificationPreference api={api} Field={Field} job={job} form/>}
      {!configurationReady && <p className="form-help" role="status">Die neuen Auftragseinstellungen werden nach dem Serverneustart verfügbar.</p>}
      <div className="row between">
        {schedule !== "manual" ? (
          <label className="checkbox-label">
            <button type="button" role="switch" className="apple-switch" aria-label="Zeitplan aktivieren" aria-checked={active} onClick={() => setActive(a => !a)}><span /></button>
            Zeitplan aktivieren
          </label>
        ) : (
          <span className="form-help">Nach dem Speichern manuell starten.</span>
        )}
        <button className="primary" disabled={!configurationReady}>Auftrag speichern</button>
      </div>
    </form>
  );
}
createRoot(document.getElementById("root")).render(<MotionConfig reducedMotion="user"><RecordingProvider api={api}><App /></RecordingProvider></MotionConfig>);
