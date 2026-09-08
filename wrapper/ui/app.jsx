import {useJobNotifications, JobNotifications, NotificationPreference} from "./job-notifications.jsx";
import { ChapterScrubber } from "./components/ui/chapter-scrubber";
import { PipelinePage } from "./pipeline";
import { InboxPage } from "./inbox";
import { WelcomeSuggestions } from "./welcome-suggestions";
import { PanelLight } from "./panel-light";
import {Skeleton} from './skeleton.tsx';
import { MessageSpeech } from "./message-speech";
import { ScrollEdgeFade } from "./scroll-edge-fade.tsx";
import { NoteEditor } from "./knowledge.tsx";
import { SystemSearch } from "./system-search.tsx";
import { AppearanceDesign } from "./appearance-design.jsx";
import { designVariables, identity as designIdentity } from "./design-system.mjs";
import { SettingsNavigationRow } from "./settings-patterns.jsx";
import { AppLoader, LoaderProvider } from './app-loader';
import { LoaderSettings } from './loader-settings';
import { SystemNotice } from "./system-notice.jsx";
import { JobTemplateList } from "./job-template-list.jsx";
import { jobTemplates, jobCategories, jobFromTemplate } from "../job-templates.mjs";
import { ConnectionsContent } from './connections-page.jsx';
import {SystemSettings, TailscaleConnection, CoreRunDetails} from './system-settings';
import { uploadAttachmentBatch } from "./attachment-upload.mjs";
import { AgentFiles } from "./agent-files.jsx";
import { ReviewPanel } from "./workspace-review.jsx";
import "./workspace-layout.css";
import { createChatScroll } from "./chat-scroll.mjs";
import { connectionCatalog, connectionCategories, connectionCategory } from "./connection-catalog.mjs";
import { CrmConnectionForm } from './crm-connection.jsx';
import { ServiceConnectionForm } from './service-connection.jsx';
import { LibraryPage, LibraryPreview, ImageForm } from './library.jsx';
import { SkillDetails, SkillHub, CreateSkillForm } from './skill-details.jsx';
import './library-connections.css';
import { hasUnreadReply } from "../chat-read-state.mjs";
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
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
  Workflow,
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
import { ChatMenu, ChatTitle, LayoutPicker, PaneDivider } from "./chat-controls.jsx";
import { MIN_CHAT_WIDTH, visiblePanes, selectPaneCount, conversationText } from "./chat-layout.mjs";
import { AgentPreferences } from "./agent-preferences.jsx";
import { AgentWelcome } from "./avatar-picker.jsx";
import { Modal } from "./modal.jsx";
import "./sidebar-refinement.css";
import { appearanceOptions, projectIcons, projectColors, projectColor, relativeTime, projectChatList, chatDateGroup } from "./appearance.mjs";
import { fonts, typography } from "./design-system.mjs";
import { timestamp, relativeTimeLabel, dayLabel, durationLabel, activityLabel, groupItems } from "./chat-presentation.mjs";
import { DesignReference } from "./design-reference.jsx";
import { LocalWorkers } from "./local-workers.jsx";
import { WorkerSettings } from "./worker-settings.jsx";
import { workerName } from "../../system/worker-catalog.mjs";
import { AgentMenu } from "./agent-menu";
import { Avatar } from "./avatar.jsx";
import { WelcomeParticles } from "./welcome-particles";
import { nextChatGreeting } from "./chat-greetings.mjs";
import { Dictation } from "./dictation.jsx";
import { VoiceSettings, AudioConnectionForm } from "./voice-settings.jsx";
import { SettingRow } from "./settings-row.jsx";
import { ModelPicker } from "./model-picker.jsx";
import { effortConfig, modelConfig, preferredModel, sessionModelSelection, supportedEffort } from "../worker-models.mjs";
import { WorkerSessionControls } from "./worker-session-controls";
import { groupSkills } from "./skill-categories.mjs";
import { FilterPicker } from "./filter-picker.jsx";
import {
  BrandIcon,
  SkillIcon,
  skillName,
  skillDescription,
} from "./brand-icon.jsx";
let csrf = "";
let serverOwnsIdentity = false;
async function api(url, data, retry = true) {
  const r = await fetch(
    "/api" + url,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json", "x-uwe-token": csrf },
          body: JSON.stringify(data),
        },
  );
  const j = await r.json();
  if (r.status === 403 && data !== undefined && retry) {
    const session = await fetch("/api/bootstrap");
    const b = await session.json();
    if (session.status === 401) throw Object.assign(new Error(b.error || "Bitte anmelden."), {status:401});
    if (b.token && b.token !== csrf) {
      csrf = b.token;
      return api(url, data, false);
    }
  }
  if (!r.ok) throw Object.assign(new Error(j.error || "Anfrage fehlgeschlagen."), {status:r.status});
  if (url === "/bootstrap") {
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
function IconButton({ label, onClick, children, active, disabled, ...props }) {
  return (
    <button {...props}
      type="button"
      className={"icon-button " + (active ? "selected" : "")}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function PageHeading({ title, onShowSidebar, children }) {
  return <header className="page-heading">
    <div className="page-heading-title">
      {onShowSidebar && <IconButton label="Seitenleiste anzeigen" onClick={onShowSidebar}>{icon(PanelLeft)}</IconButton>}
      <h1>{title}</h1>
    </div>
    {children && <div className="page-heading-actions">{children}</div>}
  </header>;
}
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
import { ChatArtifacts, DiffView, ToolText } from "./chat-artifacts.jsx";
import { FileContent } from "./file-content.jsx";
import { localFilePath } from "./artifact-content.mjs";

function MessageTime({ value }) {
  const ms = timestamp(value);
  return ms == null ? null : <time dateTime={new Date(ms).toISOString()} title={new Date(ms).toLocaleString("de-DE")}>
    {new Date(ms).toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"})}
  </time>;
}
function RelativeMessageTime({value, visible = true}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!visible) return;
    const update = () => { if (!document.hidden) setNow(Date.now()); };
    update();
    const timer = setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [visible, value]);
  const ms = timestamp(value);
  return ms == null ? null : <time dateTime={new Date(ms).toISOString()} title={new Date(ms).toLocaleString('de-DE')}>{relativeTimeLabel(value, now)}</time>;
}
function ChatTurn({ turn, running, waiting, visible, actionsDisabled, paneNumber = 0, workerId, ...actions }) {
  const finalMessage = (turn.items || []).filter(i => i.type === "agentMessage" && i.phase !== "commentary").at(-1);
  const groups = groupItems(turn.items);
  const activity = groups.filter(group => group.type === "activity").flatMap(group => group.items);
  const collapseCommentary = !running && !!finalMessage;
  const isCommentary = item => item.type === "agentMessage" && item.phase === "commentary";
  const history = (turn.items || []).filter(item => !['userMessage', 'plan'].includes(item.type) && (item.type !== 'agentMessage' || isCommentary(item)));
  const messages = groups.filter(group => group.type === "message" && !(collapseCommentary && isCommentary(group.item)));
  const firstReply = messages.findIndex(group => group.item.type !== "userMessage");
  const lastReply = messages.findLastIndex(group => group.item.type !== "userMessage");
  const header = <div className="turn-response-header">
    <div className="turn-author">
      <span className="agent-signature" aria-hidden="true"><Avatar avatar={actions.agentProfile?.avatar} color={actions.agentProfile?.avatarColor} /></span>
      <span className="turn-author-meta">
        <span className="turn-author-name">{actions.agentProfile?.name || "Agent"}</span>
        <RelativeMessageTime value={turn.startedAt ?? turn.completedAt} visible={visible}/>
      </span>
    </div>
  </div>;
  const progress = <div className="turn-response-progress">
    {(activity.length || collapseCommentary && history.length) ? <ActivityGroup items={activity} running={running} turn={turn} waiting={waiting} visible={visible}>
      {(collapseCommentary ? history : activity).map(item => <Item key={item.id} item={item} workerId={workerId} {...actions} running={running} />)}
    </ActivityGroup> : <TurnStatus turn={turn} running={running} waiting={waiting} visible={visible} />}
  </div>;

  return <section className="chat-turn" id={`pane-${paneNumber}-turn-${turn.id}`} tabIndex={-1} aria-label="Nachricht und Antwort">
    {messages.map((group, index) => <React.Fragment key={group.id}>
      {index === firstReply && header}
      <Item item={group.item} beforeActions={index === lastReply ? progress : null} workerId={workerId} {...actions} running={actionsDisabled} sentAt={turn.startedAt} completedAt={!running && group.item.id === finalMessage?.id ? turn.completedAt : null} />
    </React.Fragment>)}
    {firstReply === -1 && <>{header}{progress}</>}
    <ChatArtifacts items={turn.items} workspace={actions.workspace} directory={actions.directory} onFile={actions.onFile} api={api} />
    {turn.error && <div className="inline-error">{icon(AlertCircle)}{turn.error.message}</div>}
  </section>;
}
function Item({ item, beforeActions, agentProfile, workerId, onFork, onEdit, onRetry, onDelete, onFile, running, sentAt, completedAt, workspace, directory }) {
  const [copied, setCopied] = useState(false);
  async function copy(t) {
    await navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  const i = item;
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
        <div className="message-actions user-actions">
          <IconButton label="Nachricht erneut ausführen" disabled={running} onClick={onRetry}>{icon(RotateCcw, 14)}</IconButton>

          <IconButton
            label="Nachricht bearbeiten und verzweigen"
            disabled={running}
            onClick={onEdit}
          >
            {icon(SquarePen, 14)}
          </IconButton>
          <IconButton
            label="Nachricht kopieren"
            onClick={() =>
              copy(
                (i.content || [])
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n"),
              )
            }
          >
            {icon(copied ? Check : Copy, 14)}
          </IconButton>
          <IconButton label="Nachricht löschen" disabled={running} onClick={onDelete}>{icon(Trash2,14)}</IconButton>
          <MessageTime value={sentAt} />
        </div>
      </div>
    );
  if (i.type === "agentMessage" || i.type === "plan")
    return (
      <div
        className={
          "agent-message " +
          (i.phase === "commentary" ? "commentary-message" : "")
        }
      >
        {i.type === "plan" && <span className="eyebrow">Plan</span>}
        <Markdown text={i.text} onFile={onFile} workspace={workspace} directory={directory} />
        {beforeActions}
        <div className="message-actions agent-actions">
          {i.type === "agentMessage" && i.phase !== "commentary" && <MessageSpeech text={i.text} disabled={running} api={api} Button={IconButton} />}
          <IconButton label="Antwort kopieren" onClick={() => copy(i.text)}>
            {icon(copied ? Check : Copy, 15)}
          </IconButton>
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
        </div>
      </div>
    );
  if (i.type === "reasoning")
    return i.summary?.length || i.content?.length ? (
      <details className="tool-item">
        <summary>
          {icon(BrainCircuit, 16)}Gedanken{icon(ChevronDown, 14)}
        </summary>
        <Markdown text={(i.summary || i.content || []).join("\n\n")} />
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
  return (
    <details className="tool-item">
      <summary>
        <ActivityIcon item={i}/>
        <span className={i.status === "failed" ? "activity-failed" : undefined}>{isComputerTool(i) && i.status !== "failed" ? i.arguments?.title || activityLabel(i, running && i.status === "inProgress") : activityLabel(i, running && i.status === "inProgress")}</span>


        {icon(ChevronDown, 14)}
      </summary>
      <div className="tool-detail-label">{labels[i.type] || "Werkzeug"}{i.status === "failed" ? " · Fehlgeschlagen" : ""}</div>
      <div className="tool-provenance">{workerName(i.workerId || workerId || "codex")}{isComputerTool(i) ? " · Computer Use" : ""}</div>
      <ToolImages item={i} />
      {i.query && <ToolText value={i.query} />}
      {i.command && <ToolText value={i.command} />}
      {i.aggregatedOutput && !i.toolContent?.length && <ToolText value={i.aggregatedOutput} />}
      {i.error && <ToolText value={i.error} />}
      {(Array.isArray(i.changes) ? i.changes : []).map((c, n) => (
        <div key={n}>
          <button className="file-link" onClick={() => onFile(localFilePath(c.path, workspace, directory) || c.path)}>
            {icon(FileText, 15)}
            {c.path}
          </button>
          <DiffView diff={c.diff} />
        </div>
      ))}
      <ToolText value={toolOutputText(i)} />
    </details>
  );
}
const projectGlyphs = { folder: Folder, code: Braces, briefcase: Briefcase, globe: Globe, idea: BrainCircuit, calendar: Calendar, message: MessageCircle, files: FileText };
function App({ embedded = false, sessionRef, onSessionChange, onActivate, paneNumber = 0, showPaneHeader = false, isMaximized = false, onMaximize, onClosePane, onOpenFile, paneVisible = true, initialProject = "default" }) {
  const [libraryRevision,setLibraryRevision]=useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { return Math.max(220, Math.min(400, Number(localStorage.getItem("sidebar-width")) || 268)); } catch { return 268; }
  });
  const workspacePanelRef = useRef(null);
  const [agentFolderTarget, setAgentFolderTarget] = useState(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(null);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  function setPanel(next) {
    if (next && !panel) { setWorkspaceWidth(null); setWorkspaceExpanded(false); }
    setWorkspacePanel(next);
  }
  useEffect(() => { if (!embedded) { try { localStorage.setItem("sidebar-width", sidebarWidth); } catch {} } }, [sidebarWidth, embedded]);
  const [paneOrder, setPaneOrder] = useState([0]);
  const [mountedPanes, setMountedPanes] = useState([0]);
  const [activePane, setActivePane] = useState(0);
  const [paneWidth, setPaneWidth] = useState(0);
  const [paneWeights, setPaneWeights] = useState({});
  const [maximizedPane, setMaximizedPane] = useState(false);
  const [, redrawSessions] = useState(0);
  const sessions = useRef(Array.from({length:4}, () => ({current:null})));
  const selectedWorkspaceRef = useRef(initialProject);
  const panesRef = useRef(null), activePaneRef = useRef(0), draftCache = useRef(new Map());
  const [draftTitle, setDraftTitle] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const dragDepth = useRef(0), uploadCounts = useRef(new Map());
  const [pendingUploads, setPendingUploads] = useState([]);
  const draftKey = () => chatRef.current || `new:${projectRef.current}`;
  const sessionChanged = useCallback(() => redrawSessions(n => n + 1), []);
  const visible = visiblePanes(paneOrder, activePane, paneWidth, maximizedPane);
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
    [view, setView] = useState(() => !embedded && ["inbox", "pipeline", "jobs"].includes(new URLSearchParams(window.location.search).get("view")) ? new URLSearchParams(window.location.search).get("view") : "chat"),
    [chatId, setChatId] = useState(null),
    [thread, setThread] = useState(null),
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
    [settingsTab, setSettingsTab] = useState("general"),
    [selectedFile, setSelectedFile] = useState(null),
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
    [usage, setUsage] = useState(null),
    [usageError, setUsageError] = useState(""),
    [jobFilter, setJobFilter] = useState("all"),
    [serverRestartBusy, setServerRestartBusy] = useState(false),
    [chatMenu, setChatMenu] = useState(null),
    [connectionState, setConnectionState] = useState("connecting");
  const connectionsActive = view === "settings" && settingsTab === "connections";
  const skillsActive = view === "settings" && settingsTab === "skills";
  function openSettings(section) {
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
    scrollController = useRef(null),
    inputRef = useRef(null),
    uploadRef = useRef(null),
    followScroll = useRef(true);
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
  }, [text, view, chatId, !!boot, boot?.settings?.textSize, boot?.settings?.uiFont, paneVisible]);
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
  const pickerWorker = current?.workerId || (draftWorker === "auto" ? boot?.effectiveWorker || "codex" : draftWorker);
  const nativeSelection = thread?.workerSession ? sessionModelSelection(thread.workerSession) : null;
  const pickerModels = nativeSelection?.models || boot?.modelsByWorker?.[pickerWorker] || current?.models || [];
  const nextSelection = nextSelections[chatId];
  const pickerModel = nextSelection?.model ?? (nativeSelection ? nativeSelection.model : model);
  const pickerEffort = nextSelection?.effort ?? (nativeSelection ? nativeSelection.effort : supportedEffort(pickerModels.find(m => m.model === model), effort));
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
  async function refreshChats() {
    const r = await api("/chats");
    setChats(r.chats);
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
    for (const [key, value] of Object.entries(designVariables(settings.theme, settings.designTone, settings.highlightColor))) root.style.setProperty(key, value);
  }, [boot?.settings]);
  async function loadUsage() {
    setUsageError("");
    try { setUsage(await api("/usage")); } catch(error) { setUsageError(error.message); }
  }
  async function loadJobs() {
    setJobsLoading(true); setJobsError("");
    try { setJobs(await api("/jobs")); }
    catch (error) { setJobsError(error.message); }
    finally { setJobsLoading(false); }
    try { setIntegrations(await api("/integrations")); } catch (error) { notify(error.message); }
  }
  async function refresh() {
    const b = await api("/bootstrap");
    csrf = b.token;
    setBoot(b);
    if (!embedded && b.settings.avatarConfigured === false && !sessionStorage.getItem(`agent-welcome:${b.workspace}`)) {
      setWelcome(true);
      sessionStorage.setItem(`agent-welcome:${b.workspace}`, "seen");
    }
    setChats(b.chats);
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
    es.onopen = () => {
      api("/bootstrap")
        .then((b) => {
          csrf = b.token;
          setBoot(old=>old?{...old,features:b.features}:b);
          setRequests(b.requests);
          setConnectionState(b.engine.connected ? "online" : "offline");
        })
        .catch(() => setConnectionState("offline"));
      const reopening = chatRef.current;
      if (reopening)
        api("/thread?id=" + reopening)
          .then((r) => {
            if (chatRef.current === reopening) setThread(r.thread);
          })
          .catch(() => {});
      refreshChats().catch(() => {});
    };
    es.onerror = () => setConnectionState("reconnecting");
    es.onmessage = ({ data }) => {
      const e = JSON.parse(data),
        p = e.params || {};
      if (e.method === 'wrapper/resync') { es.onopen?.(); api('/jobs').then(setJobs).catch(()=>{}); return; }
      if (e.method === 'core/event') {
        window.dispatchEvent(new CustomEvent('core/event', {detail:p}));
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
        api("/bootstrap")
          .then((b) =>
            setBoot((old) => ({
              ...old,
              projects: b.projects,
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
        if (p.thread?.id === chatRef.current) setThread(p.thread);
        return;
      }
      if (e.method === "wrapper/jobs") {
        api("/jobs")
          .then(setJobs)
          .catch(() => {});
        return;
      }
      if (e.method === "wrapper/disconnected") {
        api("/status").then(s => setConnectionState(s.engine.connected ? "online" : "offline")).catch(() => setConnectionState("offline"));
        notify(p.message);
        return;
      }
      if (e.method === "wrapper/error") {
        notify(p.message);
        return;
      }
      if (e.method === "wrapper/request") {
        setRequests((r) => r.filter((x) => x.id !== p.id).concat(p));
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
        if (!prev) return prev;
        const t = structuredClone(prev);
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
    }
    scrollController.current?.sync();
  });
  useEffect(() => () => scrollController.current?.dispose(), []);
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
      guard(async () => setIntegrations(await api("/integrations")))();
    if (skillsActive) void loadSkills();
    if (view === "settings" && settingsTab === "usage")
      void loadUsage();
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
  function chooseProject(id) {
    projectRef.current = id;
    setProjectId(id);
    setExpandedProject(id);
    const chosen = boot?.projects?.find((p) => p.id === id);
    setSelectedFile(null);
    setTerminalOutput("");
  }
  function saveDraft() {
    draftCache.current.set(chatRef.current || `new:${projectRef.current}`, {text, attachments, title:draftTitle, scroll:scrollRef.current?.scrollTop || 0, following:followScroll.current});
  }
  function newDraft(targetProjectId) {
    if (!embedded && activePaneRef.current !== 0 && sessions.current[activePaneRef.current].current) {
      setView("chat");
      return sessions.current[activePaneRef.current].current.newDraft(targetProjectId);
    }
    if (busy) { notify("Bitte warten, bis die Nachricht übertragen wurde."); return; }
    saveDraft();
    setGreeting(nextChatGreeting());
    const id =
      typeof targetProjectId === "string"
        ? targetProjectId
        : projectRef.current;
    // Keyboard handlers use refs so a new draft never inherits an old thread.
    projectRef.current = id;
    setProjectId(id);
    setExpandedProject(id);
    chatRef.current = null;
    followScroll.current = true;
    setMode("default");
    setLoading(false);
    setModal(null);
    setWorkspaceMenu(null);
    setView("chat");
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
  async function openChat(id) {
    if (!embedded) {
      const existing = paneOrder.find(slot => sessions.current[slot].current?.id === id);
      if (existing != null && existing !== activePaneRef.current) { activatePane(existing); setView("chat"); return; }
      if (activePaneRef.current !== 0 && sessions.current[activePaneRef.current].current) {
        setView("chat");
        return sessions.current[activePaneRef.current].current.openChat(id);
      }
    }
    return openChatHere(id);
  }
  async function openChatHere(id) {
    if (busy) { notify("Bitte warten, bis die Nachricht übertragen wurde."); return; }
    if (chatRef.current === id) { setView("chat"); setModal(null); return; }
    saveDraft();
    const metadata = chats.find((c) => c.id === id);
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
    chatRef.current = id;
    setThread(null);
    setLoading(true);
    setChatMenu(null);
    followScroll.current = true;
    try {
      const r = await api("/thread?id=" + id);
      if (chatRef.current !== id) return;
      setThread(r.thread);
      if (r.thread.model) setModel(r.thread.model);
      if (saved && !saved.following) { followScroll.current = false; requestAnimationFrame(() => { if (chatRef.current === id && scrollRef.current) scrollRef.current.scrollTop = saved.scroll; }); }
    } finally {
      if (chatRef.current === id) setLoading(false);
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
    cache.pending=Promise.all([api('/integrations').then(value=>{setIntegrations(value);}),refreshAudioConnections()])
      .then(()=>{cache.at=Date.now();setConnectionsLoaded(true);setConnectionsError('');})
      .catch(()=>{setConnectionsError('Verbindungen konnten nicht vollständig aktualisiert werden.');})
      .finally(()=>{cache.pending=null;});
    return cache.pending;
  }
  useEffect(()=>{if(!embedded&&boot&&(connectionsActive||!connectionsRefresh.current.at))void refreshConnections();},[!!boot,connectionsActive]);
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
  async function chooseProvider(workerId) {
    if (busy) throw new Error("Bitte die laufende Übertragung abwarten.");
    setBusy(true);
    const sourceChat = chatRef.current, sourceProject = projectRef.current;
    try {
      const state = await api("/workers/activate", {id: workerId});
      setBoot(old => ({...old, workers: state.workers, modelsByWorker: {...old.modelsByWorker, [workerId]: state.models}}));
      if (chatRef.current !== sourceChat || projectRef.current !== sourceProject) return;
      const worker = state.workers.find(w => w.id === workerId);
      const nextModel = preferredModel(state.models, workerId, workerId === pickerWorker ? model : "");
      if (worker.adapter === "codex" && !nextModel) throw new Error("Codex meldet noch keine Modelle der 5.6- oder 6er-Serie. Bitte die CLI-Anmeldung prüfen.");
      if (sourceChat) {
        const result = await api("/chat/provider", {id:sourceChat, workerId, expectedWorker:pickerWorker, expectedTurnId:active[sourceChat] || null, stop:running});
        setChats(old => old.map(c => c.id === sourceChat ? result.meta : c));
        setNextSelections(old => { const next = {...old}; delete next[sourceChat]; return next; });
        if (chatRef.current === sourceChat) {
          setThread(result.thread); setModel(result.meta.model); setEffort(result.meta.effort);
          setMode(result.meta.mode); setDraftWorker(workerId);
        }
        return;
      }
      // ACP negotiates its exact model/effort options when the empty session is opened.
      const result = worker.adapter === "acp" ? await api("/chats", {worker: workerId, mode: "default", projectId: sourceProject, title: !sourceChat ? draftTitle || undefined : undefined}) : null;
      if (chatRef.current !== sourceChat || projectRef.current !== sourceProject) return;
      saveDraft();
      setDraftSpeed(null);
      setDraftWorker(workerId); setMode(worker.capabilities.plan ? mode : "default");
      if (result) {
        chatRef.current = result.thread.id; setChatId(result.thread.id); setThread(result.thread);
        const selection = sessionModelSelection(result.thread.workerSession);
        setModel(selection.model); setEffort(selection.effort);
        setChats(old => [result.meta, ...old.filter(c => c.id !== result.meta.id)]);
      } else {
        chatRef.current = null; setChatId(null); setThread(null);
        setModel(nextModel.model); setEffort(supportedEffort(nextModel));
      }
      if (sourceChat) setDraftTitle("");
      followScroll.current = true;
    } finally { setBusy(false); }
  }
  async function changeSpeed(serviceTier) {
    if (!chatId) { setDraftSpeed(serviceTier); return; }
    const id = chatId;
    const result = await api("/chat/speed", {id, model:pickerModel, serviceTier});
    setChats(old => old.map(c => c.id === id ? {...c, serviceTier:result.serviceTier} : c));
  }
  async function changePickerSelection(nextModel, nextEffort) {
    if (busy) throw new Error("Bitte die Übertragung abwarten.");
    if (running || nextSelection) {
      setNextSelections(old => ({...old, [chatId]:{model:nextModel, effort:nextEffort}}));
      return;
    }
    if (!thread?.workerSession) { setModel(nextModel); setEffort(nextEffort); return; }
    const id = chatId, session = thread.workerSession;
    const option = nextModel !== pickerModel ? modelConfig(session) : effortConfig(session);
    const change = nextModel !== pickerModel
      ? option ? {configId: option.id, value: nextModel} : {modelId: nextModel}
      : option ? {configId: option.id, value: nextEffort} : null;
    if (!change) return;
    setBusy(true);
    try {
      const result = await api("/worker-session", {id, ...change});
      if (chatRef.current !== id) return;
      const selection = sessionModelSelection(result.thread.workerSession);
      setThread(old => old ? {...old, workerSession: result.thread.workerSession} : old);
      setModel(selection.model); setEffort(selection.effort);
      setChats(old => old.map(c => c.id === id ? {...c, model: selection.model, models: selection.models, effort: selection.effort} : c));
    } finally { setBusy(false); }
  }
  async function submit(e, voiceText) {
    e?.preventDefault();
    if ((!(voiceText ?? text).trim() && !attachments.length) || busy) { if (voiceText) throw new Error("Chat ist beschäftigt."); return; }
    if (running && nextSelection) {
      const message = "Die Modellwahl gilt für die nächste Antwort. Bitte die laufende Antwort abwarten oder stoppen.";
      if (voiceText) throw new Error(message);
      notify(message); return;
    }
    if (uploadCounts.current.get(draftKey())) { notify("Dateien werden noch angeheftet."); return; }
    setBusy(true);
    const originalText = text,
      originalAttachments = attachments;
    try {
      let id = chatId, selectedModel = pickerModel;
      const msg = voiceText ?? text,
        files = voiceText ? [] : attachments;
      followScroll.current = true;
      if (!id) {
        const r = await api("/chats", {
          model,
          worker: draftWorker,
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
      if (!voiceText) { setText(""); setAttachments([]); }
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
      await api("/turn", {
        id,
        text: msg,
        attachments: files,
        model: selectedModel,
        effort: pickerEffort || undefined,
        nextSelection,
        mode,
      });
      if (nextSelection) {
        setNextSelections(old => { const next = {...old}; delete next[id]; return next; });
        setModel(selectedModel); setEffort(pickerEffort);
        if (thread?.workerSession) {
          void api("/thread?id=" + encodeURIComponent(id)).then(updated => {
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
      if (voiceText) setText(previous => previous ? previous + "\n" + voiceText : voiceText);
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

  async function openFile(p) {
    if (embedded && onOpenFile) return onOpenFile(p);
    const relative = localFilePath(p, boot.workspace);
    if (!relative) throw new Error("Die Datei liegt nicht im freigegebenen Arbeitsbereich.");
    setPanel("files");
    setSelectedFile(relative);
  }

  async function updateChat(c, change) {
    await api("/chat/update", { id: c.id, ...change });
    await refreshChats();
    setChatMenu(null);
    if (change.archived && chatId === c.id) newDraft();
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
  async function saveProject(change) {
    const result = await api("/projects/save", change);
    setBoot((b) => ({
      ...b,
      projects: result.projects,
      settings: result.settings,
    }));
    setWorkspaceMenu(null);
    setModal(null);
    if (!change.id) {
      chooseProject(result.project.id);
      newDraft(result.project.id);
    }
    notify(change.id ? "Projekt gespeichert." : "Projekt angelegt.");
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
  const linkOpened = useRef(false);
  useEffect(() => {
    if (embedded || !boot || linkOpened.current) return;
    linkOpened.current = true;
    const id = new URL(window.location.href).searchParams.get("chat");
    if (id) guard(() => openChatHere(id))();
  }, [!!boot]);
  const chatTitle = current?.title || draftTitle || "Neuer Chat";
  const exportChat = () => {
    const blob = new Blob([conversationText(thread, chatTitle)], {type:"text/markdown;charset=utf-8"});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href=url; a.download=`${chatTitle.replace(/[^\p{L}\p{N} ._-]/gu, "_")}.md`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const copyConversation = guard(async () => { await navigator.clipboard.writeText(conversationText(thread, chatTitle)); notify("Gespräch kopiert."); });
  const localSession = {
    id:chatId, title:chatTitle, hasTitle:!!(current?.title || draftTitle), projectName:project?.name || "Allgemein",
    projectIcon:<span className="project-glyph" style={{color:projectColor(modal?.type === "project" && modal.project?.id === project?.id ? modal.color ?? project?.color : project?.color)}}>{icon(projectGlyphs[project?.icon] || Folder, 18)}</span>, running, busy, status:current?.lastTurnStatus, unread:hasUnreadReply(current),
    newDraft, openChat:openChatHere, projectId,
    items:[
      {id:"rename",label:"Umbenennen",icon:icon(SquarePen),action:()=>setModal({type:"rename",chat:current || null})},
      {id:"pin",label:current?.pinned ? "Loslösen" : "Anpinnen",icon:icon(Pin),disabled:!current,action:guard(()=>updateChat(current,{pinned:!current.pinned}))},
      {id:"share",label:"Teilen …",icon:icon(ArrowUpRight),disabled:!current,action:()=>setModal("shareChat")},
      {id:"fork",label:"Fork erstellen",icon:icon(GitBranch),disabled:!current || running || busy,action:guard(fork)},
      ...(boot?.features?.operations?[{id:'compact',label:'Fortsetzungsnotiz erstellen',icon:icon(BrainCircuit),disabled:!current||running||busy,action:guard(async()=>{const note=await api('/memory/compact',{chatId});await openFile(note.path);setPanel('files');notify('Kompakte Fortsetzungsnotiz gespeichert. Das Originalgespräch bleibt erhalten.');})}]:[]),
      {id:"copy",label:"Gespräch kopieren",icon:icon(Copy),disabled:!thread?.turns?.length,action:copyConversation},
      {id:"export",label:"Als Markdown exportieren",icon:icon(Download),disabled:!thread?.turns?.length,action:exportChat},
      {id:"switch",label:"Chat öffnen …",icon:icon(MessageCircle),action:()=>{setSearch("");setModal("search")}},
      {id:"new",label:"Neuer Chat",icon:icon(Plus),action:()=>newDraft(projectId)},
      {id:"archive",label:"Archivieren",icon:icon(Archive),disabled:!current || running || busy,action:guard(()=>updateChat(current,{archived:true}))},
    ],
  };
  (sessionRef || sessions.current[0]).current = localSession;
  useEffect(() => { onSessionChange?.(); }, [chatId, chatTitle, project, running, busy, current?.pinned, current?.lastTurnStatus, current?.readTurnId, !!thread?.turns?.length]);
  const activeSession = !embedded && activePane !== 0 ? sessions.current[activePane].current : localSession;
  const headerSession = activeSession && {...activeSession, items:activeSession.items.map(item => ({...item, action:()=> (embedded ? sessionRef : sessions.current[activePane]).current?.items.find(current=>current.id===item.id)?.action()}))};
  const workspaceProject = boot?.projects?.find(p=>p.id === (headerSession?.projectId || projectId));
  selectedWorkspaceRef.current = workspaceProject?.id || projectId;
  useEffect(() => {
    if (embedded) return;
    setSelectedFile(null); setTerminalOutput("");
  }, [embedded, activePane, workspaceProject?.id]);
  const skillGroups = groupSkills(skills.filter(s=>skillSource==='all'||s.source===skillSource), {
    query: search,
    category: skillFilter,
  });
  const availableSkillGroups = groupSkills(skills);
  const visibleSkillCount = skillGroups.reduce(
    (count, group) => count + group.skills.length,
    0,
  );
  const visibleJobs = jobs.filter(
    (j) =>
      (jobFilter === "all" ||
        (jobFilter === "manual" && j.schedule?.type === "manual") ||
        (jobFilter === "scheduled" &&
          j.schedule?.type !== "manual" &&
          j.status !== "invalid") ||
        (jobFilter === "attention" &&
          (j.status === "invalid" ||
            ["failed", "interrupted"].includes(j.lastRun?.status)))) &&
      j.name.toLowerCase().includes(search.toLowerCase()),
  );
  const nav = [
      ["inbox", Inbox, "Inbox"],
      ["pipeline", Workflow, "Pipeline"],
      ["jobs", Clock, "Aufträge"],
      ...(boot?.features?.library?[["library", FileText, "Bibliothek"]]:[]),
    ];
  const settingNav = [
    ["general", SlidersHorizontal, "Allgemein"],
    ...(boot?.features?.operations ? [["system", Activity, "System"], ["memory", BrainCircuit, "Memory"], ["storage", HardDrive, "Speicher & Sicherung"], ["access", Lock, "Zugang"]] : []),
    ["appearance", Sun, "Aussehen"],
    ["voice", Mic, "Stimme"],
    ["identity", User, "Dein Agent"],
    ["connections", Plug, "Verbindungen"],
    ["skills", Sparkles, "Skills"],
    ["secrets", KeyRound, "Secrets"],
    ["privacy", ShieldCheck, "Datenschutz"],
    ["engines", BrainCircuit, "Worker"],
    ["usage", Activity, "Nutzung"],
    ["shortcuts", Keyboard, "Tastaturkürzel"],
    ["archive", Archive, "Archivierte Chats"],
  ];
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
  useEffect(() => {
    const last = thread?.turns?.at(-1);
    if (!foreground || view !== "chat" || !readablePane || awayFromBottom || running || last?.status !== "completed" || !hasUnreadReply(current)) return;
    const timer = setTimeout(() => {
      const el = scrollRef.current;
      if (!el || el.scrollHeight - el.scrollTop - el.clientHeight > 150) return;
      api("/chat/read", {id:chatId,turnId:last.id}).then(result=>setChats(old=>old.map(c=>c.id===chatId ? {...c,readTurnId:result.readTurnId} : c))).catch(()=>{});
    }, 700);
    return () => clearTimeout(timer);
  }, [foreground, view, readablePane, awayFromBottom, running, thread, chatId, current?.lastCompletedTurnId, current?.readTurnId]);
  const notificationState = useJobNotifications(api, !!boot?.features?.routines && !embedded, notify);
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
      <div>
        {toast ? <div className="boot-screen"><p role="alert">{toast}</p><button onClick={guard(refresh)}>Erneut versuchen</button></div> : <Skeleton variant="shell" label="Schaltzentrale wird geöffnet …"/>}
        {!embedded && <SystemNotice ref={systemNoticeRef} onBusyChange={setServerRestartBusy} api={api} message={toast} onDismiss={()=>setToast("")} />}
      </div>
    );
  return (
    <LoaderProvider settings={boot.settings}><div
      style={{"--sidebar-width": `${sidebarWidth}px`, "--workspace-width": `${workspaceWidth || 280}px`}}
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
          <AgentMenu name={boot.settings.name} avatar={boot.settings.avatar} avatarColor={boot.settings.avatarColor} connectionState={connectionState} restartBusy={serverRestartBusy} onNavigate={tab=>{setSettingsTab(tab);setView("settings");}} onRestart={()=>systemNoticeRef.current?.restart()} />
          <IconButton label="System durchsuchen (⌘/Strg K)" aria-keyshortcuts="Meta+K Control+K" onClick={()=>{setSearch("");setModal("search");}}>{icon(Search,18)}</IconButton>
          {boot.features?.routines ? <IconButton label={`Benachrichtigungen${notificationState.data?.unread ? ` · ${notificationState.data.unread} ungelesen` : ''}${requests.length ? ` · ${requests.length} Rückfragen` : ''}`} onClick={()=>setModal("notifications")}>{icon(Bell,17)}{(notificationState.data?.unread>0||requests.length>0)&&<i className="notification-dot"/>}</IconButton> : requests.length > 0 && <IconButton label="Offene Rückfragen" onClick={()=>setModal("activity")}>{icon(Bell,17)}<i className="notification-dot"/></IconButton>}
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
            <button className="back-to-app" onClick={() => setView("chat")}>
              {icon(ArrowLeft)}Zurück zur App
            </button>
            <div className="sidebar-section-label">Einstellungen</div>
            <nav>
              {settingNav.map(([id, I, label]) => (
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
                    (view === id && id !== "chat" ? "selected" : "")
                  }
                  onClick={() => (id === "chat" ? newDraft() : setView(id))}
                >
                  {icon(I)}
                  {label}
                  {id === "chat" && <span className="shortcut">⌘ N</span>}
                </button>
              ))}
            </nav>
            <div className="workspace-projects">
              <div className="sidebar-section-label projects-heading"><span>Projekte</span><IconButton label="Neues Projekt" onClick={()=>setModal({type:"project"})}>{icon(Plus,16)}</IconButton></div>
              {(boot.projects || []).map((space) => (
                <section className={"workspace-group" + (expandedProject === space.id ? " expanded" : "")} key={space.id}>
                  <div className="workspace-heading">
                    <button
                      className="workspace-select"
                      title={space.name}
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
                      {icon(expandedProject === space.id ? ChevronDown : ChevronRight, 12)}
                    </button>
                    <ChatMenu label={"Projekt verwalten: " + space.name} className="icon-button" items={[
                      {id:"edit", label:"Projekt bearbeiten …", icon:icon(SquarePen,16), action:()=>setModal({type:"project",project:space})},
                      {id:"files", label:"Dateien öffnen", icon:icon(FolderOpen,16), action:()=>{if(projectId !== space.id) newDraft(space.id); chooseProject(space.id); setView("chat"); setPanel("files");}}
                    ]}>{icon(MoreHorizontal,17)}</ChatMenu>
                    <IconButton label={`Neuer Chat in ${space.name}`} onClick={()=>newDraft(space.id)}>{icon(Plus,16)}</IconButton>
                  </div>
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
                            {c.pinned && <span className="chat-pin" title="Angepinnt">{icon(Pin, 12)}</span>}
                            <span className="chat-age">{relativeTime(c.updatedAt, listClock)}</span>
                            <span className="chat-state" role="img" aria-label={active[c.id] ? "In Arbeit" : hasUnreadReply(c) ? "Ungelesene Antwort" : c.lastTurnStatus === "failed" ? "Fehlgeschlagen" : c.lastTurnStatus === "interrupted" ? "Gestoppt" : undefined}>
                              {active[c.id] ? <AppLoader /> : hasUnreadReply(c) ? <span className="chat-complete">{icon(Check, 15)}</span> : c.lastTurnStatus === "failed" ? icon(AlertCircle, 15) : c.lastTurnStatus === "interrupted" ? icon(Pause, 14) : null}
                            </span>
                          </button>
                          <IconButton
                            label={"Chat-Aktionen: " + c.title}
                            onClick={() =>
                              setChatMenu(chatMenu === c.id ? null : c.id)
                            }
                          >
                            {icon(MoreHorizontal, 16)}
                          </IconButton>
                          {chatMenu === c.id && (
                            <div className="context-menu">
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
                {!sidebar && <IconButton label="Seitenleiste anzeigen" onClick={() => setSidebar(true)}>{icon(PanelLeft)}</IconButton>}
              </div>
              <div className="row">
                {paneOrder.length === 1 && headerSession?.hasTitle && <ChatTitle session={headerSession} compact/>}
                <LayoutPicker count={paneOrder.length} onChange={changePaneCount}/>
                <IconButton label={panel ? "Workspace schließen" : "Workspace öffnen"} active={!!panel} aria-expanded={!!panel} aria-controls="workspace-panel" onClick={() => { if (!panel) setSelectedFile(null); setPanel(panel ? null : "files"); }}>{icon(PanelRight)}</IconButton>
              </div>
            </header>}

            {!embedded && paneOrder.length > 1 && (visible.length < paneOrder.length || maximizedPane) && <div className="pane-tabs" role="tablist" aria-label="Offene Chat-Panels">
              {paneOrder.map(id => { const session=sessions.current[id].current; return <button key={id} role="tab" tabIndex={activePane===id ? 0 : -1} onKeyDown={e=>{const offset=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;if(offset){e.preventDefault();const next=paneOrder[(paneOrder.indexOf(id)+offset+paneOrder.length)%paneOrder.length];activatePane(next);requestAnimationFrame(()=>panesRef.current?.parentElement.querySelector(`[aria-controls="chat-pane-${next}"]`)?.focus())}}} aria-selected={activePane===id} aria-controls={`chat-pane-${id}`} onClick={()=>activatePane(id)}>{session?.running ? <AppLoader /> : session?.unread ? icon(Check,14) : icon(MessageCircle,14)}<span>{session?.title || `Chat ${id+1}`}</span></button> })}
              {maximizedPane && <IconButton label="Aufteilung wiederherstellen" onClick={()=>setMaximizedPane(false)}>{icon(PanelLeft,16)}</IconButton>}
            </div>}
            <div className={"chat-panes " + (!embedded && visible.length > 1 ? "multiple" : "")} ref={embedded ? undefined : panesRef}>
            <section
              id={`chat-pane-${paneNumber}`}
              role="region" aria-label={`Chat ${paneNumber+1}: ${chatTitle}`}
              data-pane={embedded ? undefined : 0}
              data-trailing-pane={!embedded && visible.at(-1) === 0 ? "true" : undefined}
              hidden={!embedded && !visible.includes(0)}
              style={embedded ? undefined : {order:paneOrder.indexOf(0)*2, flexGrow:paneWeights[0] || 1}}
              onPointerDownCapture={()=>embedded ? onActivate?.() : activatePane(0)}
              onFocusCapture={()=>embedded ? onActivate?.() : activatePane(0)}
              className={"chat-main pane-slot " + ((!embedded && activePane === 0) ? "active-pane" : "") }
              onDragEnter={e=>{if(!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.stopPropagation(); dragDepth.current++; setDraggingFiles(true);}}
              onDragOver={e=>{if(!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect="copy";}}
              onDragLeave={e=>{e.stopPropagation(); if(--dragDepth.current <= 0) {dragDepth.current=0;setDraggingFiles(false);}}}
              onDrop={e=>{if(!Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.stopPropagation(); dragDepth.current=0; setDraggingFiles(false); void upload(e.dataTransfer.files);}}
            >
              {((boot.settings.welcomeParticles === "all") || (!chatId && !loading && !thread?.turns?.length && (boot.settings.welcomeParticles || "on") === "on")) && <WelcomeParticles reduceMotion={boot.settings.reduceMotion === "on"} theme={boot.settings.theme} />}
              {draggingFiles && <div className="chat-file-drop" role="status">{icon(Paperclip,24)}<span>Dateien hier anhängen</span></div>}
              {(embedded ? showPaneHeader : paneOrder.length > 1) && <div className="pane-header"><div className="row">
                <ChatTitle session={localSession} compact extraItems={[
                  {id:"maximize-panel", label:(embedded ? isMaximized : maximizedPane) ? "Aufteilung wiederherstellen" : `Chat ${paneNumber+1} maximieren`, icon:icon(Maximize,16), action:()=>embedded ? onMaximize?.() : (activatePane(0),setMaximizedPane(v=>!v))},
                  {id:"close-panel", label:`Panel ${paneNumber+1} schließen`, icon:icon(X,16), action:()=>embedded ? onClosePane?.() : closePane(0)},
                ]}/>
              </div></div>}
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
                  <Skeleton variant="chat" label="Gespräch wird geladen …"/>
                ) : !thread?.turns?.length ? (
                  <div className="welcome agent-chat-welcome">
                    <Avatar avatar={boot.settings.avatar} color={boot.settings.avatarColor} large />
                    <h1>{greeting}</h1>
                    <WelcomeSuggestions onSelect={prompt => {
                      setText(prompt);
                      inputRef.current.focus();
                    }} />
                  </div>
                ) : (
                  <div className="message-column">
                    {thread.turns?.map((t, index) => {
                      const date = dayLabel(t.startedAt);
                      const previous = dayLabel(thread.turns[index - 1]?.startedAt);
                      return <React.Fragment key={t.id}>
                        {date && date !== previous && <div className="chat-day-divider"><span>{date}</span></div>}
                        <ChatTurn agentProfile={boot.settings} paneNumber={paneNumber} workerId={current?.workerId || "codex"} workspace={boot.workspace} directory={current?.cwd || boot.workspace} turn={t} running={running && t.id === active[chatId]} onFork={guard(() => fork(t))}
                          onEdit={guard(() => revise(t))} onRetry={guard(() => revise(t, true))}
                          onDelete={() => setModal({type: "delete-message", turn: t})}
                          actionsDisabled={running || busy} waiting={requests.some(r => r.params?.threadId === chatId)} visible={foreground && view === "chat" && readablePane} onFile={guard(openFile)} />
                      </React.Fragment>;
                    })}
                    {requests
                      .filter((r) => r.params?.threadId === chatId)
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
                {awayFromBottom && <button className="jump-latest" aria-label="Zur neuesten Nachricht" onClick={()=>{followScroll.current=true;setAwayFromBottom(false);setSelectedTurn(null);scrollController.current?.sync()}}>{icon(ArrowUp,18)}</button>}
                <form className={"composer pill-composer " + (mode === "plan" ? "planning" : "")} onSubmit={guard(submit)}>
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
                  <div className="composer-entry">
                      <IconButton
                        label="Dateien anhängen"
                        onClick={(e) => {
                          e?.preventDefault();
                          uploadRef.current.click();
                        }}
                      >
                        {icon(Plus, 21)}
                      </IconButton>
                  <textarea
                    ref={inputRef}
                    placeholder="Nachricht"
                    aria-label="Nachricht"
                    value={text}
                    rows={1}
                    onChange={(e) => setText(e.target.value)}
                    onPaste={e=>{const files=Array.from(e.clipboardData.files || []); if(files.length) {e.preventDefault(); void upload(files);}}}
                    onKeyDown={(e) => {
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
                      <Dictation api={api} notify={notify} chatId={chatId || "draft:" + projectId} enabled={embedded ? paneVisible : visible.includes(0)} running={running || busy} onText={(transcript) => setText(previous => previous ? previous + "\n" + transcript : transcript)} onVoiceText={transcript => submit(undefined, transcript)} reply={(() => { const t = thread?.turns?.filter(t => !t.clientPending && t.status !== "inProgress").at(-1); return t ? { id:t.id, chatId, status:t.status, text:t.items?.filter(i => i.type === "agentMessage" && i.phase !== "commentary").map(i => i.text || "").join("\n") || "" } : null; })()} openSettings={() => { setSettingsTab("voice"); setView("settings"); }} />
                    <div className="composer-send-actions">
                      {running ? (
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
                  </div>
                  <div className="composer-options" role="group" aria-label="Nachrichtenoptionen">
                      <ChatMenu
                        label={`Arbeitsmodus: ${mode === "plan" ? "Planen" : "Ausführen"}`}
                        className={"mode-trigger " + (mode === "plan" ? "planning" : "")}
                        disabled={running || busy}
                        placement="above"
                        selected={mode}
                        items={[
                          { id: "default", label: "Ausführen", icon: icon(Play, 16), action: () => setMode("default") },
                          { id: "plan", label: "Planen", icon: icon(SquarePen, 16), disabled: current ? current.capabilities?.plan === false : draftWorker !== "auto" ? boot.workers?.find(w => w.id === draftWorker)?.capabilities?.plan === false : boot.planAvailable === false, action: () => setMode("plan") },
                        ]}
                      >
                        <span>{mode === "plan" ? "Planen" : "Ausführen"}</span>
                        {icon(ChevronDown, 14)}
                      </ChatMenu>
                      <ModelPicker
                        models={pickerModels} model={pickerModel} effort={pickerEffort} reduceMotion={boot.settings.reduceMotion === "on"}
                        workerId={pickerWorker} workers={boot.workers || []}
                        hasConversation={!!chatId} disabled={busy} providerDisabled={!!current?.jobId || !!current?.channelOnly}
                        running={running} serviceTier={chatId ? current?.serviceTier : draftSpeed} onSpeedChange={changeSpeed}
                        onProviderChange={chooseProvider} onRefresh={refreshPickerWorkers}
                        context={nextSelection ? "Nächste Nachricht" : running ? "Auswahl für die nächste Nachricht" : current?.fallbackFrom ? `${workerName(current.workerId)} übernimmt als Vertretung für ${workerName(current.fallbackFrom)}.` : undefined}
                        onChange={changePickerSelection}
                      />
                      {thread?.workerSession && <WorkerSessionControls
                        session={thread.workerSession}
                        disabled={running || busy}
                        onCommand={command => {
                          setText(previous => {
                            const args = previous.startsWith("/") ? previous.replace(/^\/\S+\s?/, "") : previous;
                            return command + (args ? (command.endsWith(" ") ? "" : " ") + args : "");
                          });
                          requestAnimationFrame(() => inputRef.current?.focus());
                        }}
                        onChange={async change => {
                          const id = chatId;
                          const r = await api("/worker-session", { id, ...change });
                          if (chatRef.current === id) setThread(old => old ? { ...old, workerSession: r.thread.workerSession } : old);
                        }}
                        onError={notify}
                      />}
                  </div>
                </form>
                <input
                  hidden
                  ref={uploadRef}
                  type="file"
                  multiple
                  onChange={guard((e) => upload(e.target.files))}
                />
              </div>
            </section>
            {!embedded && mountedPanes.filter(id=>id!==0).map(id=><div key={id} data-pane={id} data-trailing-pane={visible.at(-1) === id ? "true" : undefined} hidden={!visible.includes(id)} className={"pane-slot secondary-pane " + (activePane===id ? "active-pane" : "")} style={{order:paneOrder.indexOf(id)*2, flexGrow:paneWeights[id] || 1}}>
              <App embedded paneVisible={view === "chat" && visible.includes(id)} paneNumber={id} sessionRef={sessions.current[id]} onSessionChange={sessionChanged} initialProject={projectId} isMaximized={maximizedPane} showPaneHeader={paneOrder.length>1} onActivate={()=>activatePane(id)} onMaximize={()=>{activatePane(id);setMaximizedPane(v=>!v)}} onClosePane={()=>closePane(id)} onOpenFile={path=>{activatePane(id);requestAnimationFrame(()=>guard(openFile)(path))}}/>
            </div>)}
            {!embedded && visible.slice(0,-1).map((id,index)=><div className="pane-divider-slot" key={`divider-${id}`} style={{order:paneOrder.indexOf(id)*2+1}}><PaneDivider value={Math.round(100*(paneWeights[id] || 1)/((paneWeights[id] || 1)+(paneWeights[visible[index+1]] || 1)))} onResize={delta=>resizePanes(id,visible[index+1],delta)}/></div>)}
            </div>
            </div>
            {panel && (
              <aside id="workspace-panel" aria-label="Workspace" ref={workspacePanelRef} className={"workspace-panel" + (workspaceExpanded ? " workspace-expanded" : "")}>
                <PanelLight mode={boot.settings.panelLight || "animated"} active={view === "chat"} />
                <div className="workspace-resizer"><PaneDivider label="Workspace-Breite ändern" value={workspaceWidth || 280} min={280} max={1000} onReset={()=>{setWorkspaceWidth(null);setWorkspaceExpanded(false)}} onResize={delta=>{setWorkspaceExpanded(false);setWorkspaceWidth(width=>Math.max(280,Math.min(1000,(workspacePanelRef.current?.getBoundingClientRect().width || width || 280)-delta)))}}/></div>
                <div className="panel-head">
                  <select className="workspace-view-select" aria-label="Workspace-Ansicht" value={panel} onChange={event => setPanel(event.target.value)}>
                    <option value="files">Dateien</option>
                    <option value="review">Änderungen</option>
                    <option value="terminal" disabled={!boot.capabilities?.terminal}>Befehle</option>
                  </select>
                  <div className="row">
                  <IconButton label={workspaceExpanded ? "Kompakte Workspace-Breite" : "Workspace vergrößern"} aria-pressed={workspaceExpanded} onClick={()=>{
                    if (workspaceExpanded) setWorkspaceWidth(null);
                    setWorkspaceExpanded(value=>!value);
                  }}>{icon(workspaceExpanded ? Minimize : Maximize, 16)}</IconButton>
                  <IconButton label="Workspace schließen" onClick={() => setPanel(null)}>{icon(X,16)}</IconButton>
                  </div>
                </div>
                {<>
                    {panel === "files" ? (
                      <div className={"file-panel" + (selectedFile ? " workspace-artifact-preview" : "")}>
                        {selectedFile ? (
                          <>
                            <div className="file-toolbar">
                              <button className="icon-button" aria-label="Zurück zu Dateien" onClick={() => setSelectedFile(null)}>
                                {icon(ArrowLeft, 15)}
                              </button>
                              <span>{selectedFile.split("/").pop()}</span>
                              <a
                                className="icon-button"
                                aria-label="Datei herunterladen"
                                href={
                                  "/api/file/raw?path=" +
                                  encodeURIComponent(selectedFile) +
                                  "&download=1"
                                }
                              >
                                {icon(Download, 16)}
                              </a>
                            </div>
                            <FileContent key={selectedFile} path={selectedFile} api={api} onEnlarge={()=>setWorkspaceExpanded(true)} />
                          </>
                        ) : (
                          boot.workspaceToolsVersion ? <AgentFiles api={api} initialFolder={agentFolderTarget} onPreview={()=>setWorkspaceExpanded(true)}/> : <p role="status">Die neue Agent-Dateiansicht wird nach dem nächsten Serverstart verfügbar. Laufende Aufträge können zuerst fertig werden.</p>
                        )}
                      </div>
                    ) : panel === "terminal" ? (
                      <div className="terminal-panel">
                        {terminalOutput ? <pre aria-label="Befehlsausgabe">{terminalOutput}</pre> : <div className="workspace-command-empty">
                          {icon(Terminal, 20)}
                          <strong>Befehl ausführen</strong>
                          <p>Einzelne Befehle im Projektordner.</p>
                          <p className="workspace-command-note">Jeder Aufruf startet neu und läuft höchstens 30 Sekunden.</p>
                        </div>}
                        <form
                          onSubmit={guard(async (e) => {
                            e.preventDefault();
                            if (terminalBusy || !terminalInput.trim() || !boot.capabilities?.terminal) return;
                            setTerminalBusy(true);
                            const commandProject = selectedWorkspaceRef.current;
                            const command = terminalInput;
                            setTerminalInput("");
                            setTerminalOutput(
                              (o) => o + "\n$ " + command + "\n",
                            );
                            try {
                              const r = await api("/terminal", {
                                command,
                                projectId: commandProject,
                              });
                              if (selectedWorkspaceRef.current !== commandProject) return;
                              setTerminalOutput(
                                (o) =>
                                  o +
                                  (r.stdout || r.aggregatedOutput || "") +
                                  (r.stderr || "") +
                                  "\nExit: " +
                                  r.exitCode,
                              );
                            } catch (error) {
                              if (selectedWorkspaceRef.current === commandProject) setTerminalOutput(o=>o+"Fehler: "+error.message+"\n");
                            } finally {
                              setTerminalBusy(false);
                            }
                          })}
                        >
                          <span aria-hidden="true">$</span>
                          <input
                            aria-label="Terminalbefehl"
                            placeholder="Befehl eingeben"
                            value={terminalInput}
                            onChange={(e) => setTerminalInput(e.target.value)}
                          />
                          <button
                            disabled={terminalBusy || !terminalInput.trim() || !boot.capabilities?.terminal}
                            aria-label="Befehl ausführen"
                          >
                            {icon(terminalBusy ? LoaderCircle : ArrowUp, 16)}
                          </button>
                        </form>
                      </div>
                    ) : panel === "review" ? (
                      <ReviewPanel key={workspaceProject?.id} api={api} projectId={workspaceProject?.id || projectId} projectName={workspaceProject?.name}/>
                    ) : null}
                  </>
                }
              </aside>
            )}
          </div>
        )}
        {view === "chat" ? null : view === "inbox" ? (
          <InboxPage PageHeading={PageHeading} sidebarHost={inboxSidebarHost} sidebarVisible={sidebar} onShowSidebar={() => setSidebar(true)} onHideSidebar={() => setSidebar(false)} onBack={() => setView("chat")}/>
        ) : view === "pipeline" ? (
          <PipelinePage PageHeading={PageHeading} onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}/>
        ) : view === "jobs" ? (
          <div className="page">
            <PageHeading title="Aufträge" onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}>
              {boot.features?.routines&&<IconButton label="Benachrichtigungen öffnen" onClick={()=>setModal("notifications")}>{icon(Bell,17)}{notificationState.data?.unread>0&&<i className="notification-dot"/>}</IconButton>}
              <button className="primary small-button" onClick={() => setModal({ type: "job" })}>{icon(Plus, 16)}Erstellen</button>
            </PageHeading>
            <p className="section-intro">
              Im Chat beauftragen. Hier Routinen ändern, pausieren und Ergebnisse öffnen.
            </p>
            <SearchBox
              value={search}
              onChange={setSearch}
              placeholder={jobFilter === "templates" ? "Vorlagen suchen" : "Aufträge suchen"}
            />
            <div className="tabs">
              {[
                ["all", "Alle"],
                ["manual", "Manuell"],
                ["scheduled", "Routinen"],
                ["attention", "Braucht Aufmerksamkeit"],
                ["templates", "Vorlagen"],
              ].map(([id, label]) => (
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
            {jobFilter === "templates" && <JobTemplateList query={search} onChoose={template => setModal({type: "job", template})} />}
            {jobFilter !== "templates" && jobsLoading && !jobs.length && !jobsError && <Skeleton layout="jobs" label="Aufträge werden geladen …"/>}
            {jobFilter !== "templates" && jobsError && <p role="alert">{jobsError} <button onClick={loadJobs}>Erneut laden</button></p>}
            {visibleJobs.map((j) => (
              <div className="job-row" key={j.id}>
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
                  onClick={() => j.managed ? (setSettingsTab(j.id==='system-memory'?'memory':j.id==='system-backup'||j.id==='system-cleanup'?'storage':'system'),setView('settings')) : setModal({ type: 'job', job: j })}
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
                    · {workerName(j.worker)}
                    {j.schedule?.type !== "manual" &&
                      j.status === "paused" &&
                      " · Pausiert"}
                    {j.lastRun &&
                      " · " +
                        {
                          completed:
                            j.worker === "n8n"
                              ? "Webhook beantwortet"
                              : "Abgeschlossen",
                          failed: "Fehlgeschlagen",
                          running: "Läuft",
                          queued: "In Warteschlange",
                          dispatching: "Wird übergeben",
                          interrupted: "Gestoppt",
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
                {j.schedule?.type !== "manual" && j.status !== "invalid" && (!j.managed || ["system-memory","system-backup"].includes(j.id)) && (
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
            {jobFilter !== "templates" && jobs.length > 0 && visibleJobs.length === 0 && (
              <Empty Icon={Search} title="Keine passenden Aufträge">
                Wähle einen anderen Filter oder ändere deinen Suchbegriff.
              </Empty>
            )}
            {jobFilter !== "templates" && !jobsLoading && !jobsError && !jobs.length && (
              <Empty
                Icon={Clock}
                title="Dein erster Auftrag"
                action={
                  <button
                    className="primary"
                    onClick={() => setModal({ type: "job" })}
                  >
                    {icon(Plus, 16)}Auftrag erstellen
                  </button>
                }
              >
                Beschreibe die Aufgabe, wähle einen Worker und lege fest, ob du
                sie selbst startest oder regelmäßig ausführen lässt.
              </Empty>
            )}
            <div className="page-note">
              {icon(Clock, 15)}Zeitpläne laufen, solange diese Schaltzentrale
              auf dem Mac aktiv ist.
            </div>
          </div>
        ) : view === "library" ? (
          <LibraryPage revision={libraryRevision} api={api} notify={notify} projects={boot.projects} PageHeading={PageHeading} onShowSidebar={!sidebar?()=>setSidebar(true):undefined} onOpen={(entry,entries)=>setModal({type:'library-file',entry,entries})} onReuse={guard(async entry=>{const file=await api('/library/reuse',{id:entry.id,projectId});setAttachments(a=>[...a,file]);setView('chat');})} onSource={guard(async entry=>{if(chats.some(c=>c.id===entry.threadId))await openChat(entry.threadId);else notify('Das Quellgespräch ist nicht verfügbar.');})}/>
        ) : connectionsActive ? (
          <div className="page connections-page">
            <PageHeading title="Verbindungen" onShowSidebar={!sidebar ? () => setSidebar(true) : undefined}/>
            <ConnectionsContent api={api} features={boot.features} integrations={integrations} audioConnections={audioConnections}
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
            {['system','memory','storage','access'].includes(settingsTab) && boot.features.operations ? <SystemSettings key={settingsTab} api={api} section={settingsTab} chats={chats} onJobs={()=>setView('jobs')} onLibrary={()=>setView('library')} onConnections={()=>openSettings('connections')}/> : settingsTab === "general" ? (
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
                  <SettingRow title="Flächenlicht" description="Dezente Lichtverläufe in Seitenleiste und Workspace.">
                    <select aria-label="Flächenlicht" value={boot.settings.panelLight || "animated"} onChange={e => guard(() => saveSettings({panelLight: e.target.value}))()}>{appearanceOptions.panelLight.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </SettingRow>
                  <SettingRow title="Reiseeffekt" description="Sanft wandernde Lichtpunkte auf der Startansicht oder in allen Chats.">
                    <select aria-label="Reiseeffekt" value={boot.settings.welcomeParticles || "on"} onChange={e => guard(() => saveSettings({welcomeParticles: e.target.value}))()}>{appearanceOptions.welcomeParticles.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  </SettingRow>
                </div>
                <div className="settings-group"><SettingsNavigationRow title="Unser Design" description="Bausteine, Farben und Gestaltungsgrundlage" value={"CI " + designIdentity.version} onClick={()=>setSettingsTab("design")}/></div>
              </>
            ) : settingsTab === "design" ? (
              <><button className="design-back" onClick={()=>setSettingsTab("appearance")}>{icon(ArrowLeft,16)}Aussehen</button><DesignReference theme={boot.settings.theme} tone={boot.settings.designTone} accent={boot.settings.highlightColor}/></>
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
                      description="•••••••• · Im Schlüsselbund gespeichert"
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
                              setIntegrations(await api("/integrations"));
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
              <>
                <div className="settings-group">
                  <SettingRow
                    title="Konto"
                    description={boot.account?.email || "Kein Konto verfügbar"}
                    action={
                      <span className="badge">
                        {boot.account?.planType ||
                          boot.account?.type ||
                          "Nicht verbunden"}
                      </span>
                    }
                  />
                  {!usage&&!usageError&&<Skeleton variant="settings" rows={2} label="Nutzung wird geladen …"/>}
                  {usageError&&<p role="alert">{usageError} <button onClick={loadUsage}>Erneut laden</button></p>}
                  {Object.entries(
                    usage?.rateLimitsByLimitId || { codex: usage?.rateLimits },
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <React.Fragment key={k}>
                        {["primary", "secondary"].map(
                          (window) =>
                            v[window] && (
                              <SettingRow
                                key={window}
                                title={
                                  k +
                                  " · " +
                                  (v[window].windowDurationMins >= 10080
                                    ? "Woche"
                                    : "Zeitfenster")
                                }
                                description={
                                  "Zurücksetzung: " +
                                  new Date(
                                    v[window].resetsAt * 1000,
                                  ).toLocaleString("de-DE")
                                }
                                action={
                                  <div className="usage-meter">
                                    <span>
                                      {Math.max(0, 100 - v[window].usedPercent)}{" "}
                                      % übrig
                                    </span>
                                    <progress
                                      value={100 - v[window].usedPercent}
                                      max="100"
                                    />
                                  </div>
                                }
                              />
                            ),
                        )}
                      </React.Fragment>
                    ))}
                </div>
              </>
            ) : settingsTab === "shortcuts" ? (
              <div className="settings-group">
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
              </div>
            ) : settingsTab === "archive" ? (
              <>
                <SearchBox
                  value={search}
                  onChange={setSearch}
                  placeholder="Archivierte Chats durchsuchen"
                />
                {chats
                  .filter(
                    (c) =>
                      c.archived &&
                      c.title.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((c) => (
                    <div className="archive-row" key={c.id}>
                      <div>
                        <strong>{c.title}</strong>
                        <p>
                          {new Date(c.updatedAt).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <button
                        onClick={guard(() =>
                          updateChat(c, { archived: false }),
                        )}
                      >
                        Dearchivieren
                      </button>
                    </div>
                  ))}
                {!chats.some((c) => c.archived) && (
                  <Empty Icon={Archive} title="Dein Archiv ist leer">
                    Archivierte Gespräche kannst du hier wiederherstellen.
                  </Empty>
                )}
              </>
            ) : null}
          </div>
        )}
      </MainSurface>
      {!embedded && <SystemNotice ref={systemNoticeRef} onBusyChange={setServerRestartBusy} api={api} message={toast} onDismiss={()=>setToast("")} />}
      {welcome && !embedded && <AgentWelcome api={api} initialName={boot.settings.name} onClose={() => setWelcome(false)} onSaved={profile => {
        setBoot(old => ({...old, settings: {...old.settings, name:profile.name, avatar:profile.avatar, avatarColor:profile.avatarColor, avatarConfigured:true}}));
        setWelcome(false);
      }} />}
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
        <p>Teile den Gesprächsinhalt als Text oder Markdown-Datei. Der lokale Link öffnet diesen Chat in dieser App auf diesem Rechner.</p>
        <Field label="Lokaler Chat-Link"><input readOnly value={`${window.location.origin}/?chat=${encodeURIComponent(chatId)}`} onFocus={e=>e.target.select()}/></Field>
        <div className="action-list">
          <button onClick={guard(async()=>{await navigator.clipboard.writeText(`${window.location.origin}/?chat=${encodeURIComponent(chatId)}`);notify("Lokalen Chat-Link kopiert.")})}>{icon(Link)}Lokalen Link kopieren</button>
          <button onClick={copyConversation}>{icon(Copy)}Gespräch kopieren</button>
          <button onClick={exportChat}>{icon(Download)}Markdown herunterladen</button>
          {typeof navigator.share === "function" && <button onClick={guard(async()=>{try {await navigator.share({title:chatTitle,text:conversationText(thread,chatTitle)});} catch(error){if(error.name!=="AbortError")throw error;}})}>{icon(ArrowUpRight)}Über System teilen …</button>}
        </div>
      </Modal>}
      {modal?.type === "project" && (
        <Modal
          title={modal.project ? "Projekt bearbeiten" : "Neues Projekt"}
          className="project-dialog"
          onClose={() => setModal(null)}
        >
          <form className="project-editor"
            onSubmit={guard(async (e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get("name");
              await saveProject({ id: modal.project?.id, name, icon: new FormData(e.currentTarget).get("icon"), color: new FormData(e.currentTarget).get("color") });
            })}
          >
            <div className="project-editor-body">
            <div className="project-identity">
              <div className="project-preview" style={{color:projectColor(modal.color ?? modal.project?.color)}} aria-hidden="true">
                {icon(projectGlyphs[modal.icon ?? modal.project?.icon ?? "folder"], 32)}
              </div>
            <Field label="Projektname">
              <input
                name="name"
                defaultValue={modal.project?.name || ""}
                placeholder="Mein Projekt"
                autoFocus
                required
                maxLength={80}
              />
            </Field>
            </div>
            <fieldset className="project-symbols" style={{"--project-preview":projectColor(modal.color ?? modal.project?.color)}}><legend>Projektsymbol</legend>
              {projectIcons.map(([value, label]) => <label key={value} title={label}><input type="radio" name="icon" value={value} checked={value === (modal.icon ?? modal.project?.icon ?? "folder")} onChange={()=>setModal(previous=>({...previous,icon:value}))} /><span>{icon(projectGlyphs[value], 20)}<span>{label}</span></span></label>)}
            </fieldset>
            <fieldset className="project-symbols project-colors"><legend>Projektfarbe</legend>
              {projectColors.map(([value, label]) => <label key={value} title={label}><input type="radio" name="color" value={value} checked={value === (modal.color ?? modal.project?.color ?? "default")} onChange={()=>setModal(previous=>({...previous,color:value}))} /><span><span className="project-color-swatch" style={{backgroundColor:projectColor(value)}} aria-hidden="true">{icon(Check, 14)}</span><span>{label}</span></span></label>)}
            </fieldset>
            </div>
            <div className="row end project-editor-actions">
              <button type="button" onClick={() => setModal(null)}>
                Abbrechen
              </button>
              <button className="primary">
                {modal.project ? "Speichern" : "Anlegen"}
              </button>
            </div>
          </form>
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
              setIntegrations(await api("/integrations"));
              setModal(null);
              notify("Im macOS-Schlüsselbund gespeichert.");
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
          <AudioConnectionForm name={modal.name} connected={audioConnections[modal.name]} api={api} notify={notify} onSaved={async () => { await refreshAudioConnections(); setIntegrations(await api("/integrations")); setModal(null);  }} />
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
              setIntegrations(await api("/integrations"));
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
            <p className="page-note">Ein neuer Token wird im macOS-Schlüsselbund gespeichert und unter Secrets angelegt. Er ersetzt für diese Verbindung die Auswahl oben.</p>
            <div className="row between">
              {modal.connection?.id ? (
                <>
                  <IconButton
                    label="Verbindung entfernen"
                    onClick={guard(async () => {
                      await api("/connections/delete", {
                        id: modal.connection.id,
                      });
                      setIntegrations(await api("/integrations"));
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
        <CrmConnectionForm key={modal.connection.id || modal.connection.provider} connection={modal.connection} api={api} notify={notify} Field={Field} onChanged={async()=>setIntegrations(await api('/integrations'))} onSaved={async message=>{setIntegrations(await api('/integrations'));setModal(null);notify(message);}}/>
      </Modal>}
      {modal?.type==='service-connection'&&<Modal title={modal.connection.id?'Verbindung bearbeiten':'Verbindung hinzufügen'} onClose={()=>setModal(null)}>
        <ServiceConnectionForm key={modal.connection.id||modal.connection.provider} connection={modal.connection} api={api} notify={notify} Field={Field} workers={boot.workers||[]} projects={boot.projects||[]} requests={requests} RequestCard={RequestCard} onReply={guard(async(id,result)=>{await api('/respond',{id,result});setRequests(rs=>rs.filter(r=>r.id!==id));})} onChanged={connections=>setIntegrations(old=>({...old,connections:[...old.connections.filter(c=>c.kind!=='service'),...connections]}))} onSaved={async message=>{setIntegrations(await api('/integrations'));setModal(null);notify(message);}}/>
      </Modal>}
      {modal?.type==='library-file'&&<LibraryPreview entry={modal.entry} entries={modal.entries} onNavigate={entry=>setModal(current=>({...current,entry}))} onClose={()=>setModal(null)}>
        <div className="library-preview"><FileContent key={modal.entry.scope+modal.entry.path} path={modal.entry.path} scope={modal.entry.scope} api={api} readOnly reading/></div>

      </LibraryPreview>}
      {modal?.type==='image-create'&&<Modal title="Bild erstellen" onClose={()=>setModal(null)}><ImageForm api={api} Field={Field} projects={boot.projects} projectId={projectId} connections={integrations.connections} onCreated={entry=>{setLibraryRevision(v=>v+1);setModal({type:'library-file',entry});}}/></Modal>}
      {modal?.type==='skill-hub'&&<Modal title="Skill hinzufügen" onClose={()=>setModal(null)}><SkillHub api={api} Field={Field} onSelect={skill=>setModal({type:'skill',skill})} onCreated={()=>setModal({type:'skill-create'})}/></Modal>}
      {modal?.type==='skill-create'&&<Modal title="Eigenen Skill erstellen" onClose={()=>setModal(null)}><CreateSkillForm api={api} Field={Field} onCreated={async()=>{await loadSkills();setModal(null);}}/></Modal>}
      {modal?.type==='tailscale'&&<Modal title="Tailscale" onClose={()=>setModal(null)}><TailscaleConnection api={api}/></Modal>}
      {(modal === 'notifications'||modal?.type==='notifications') && <Modal title="Benachrichtigungen" onClose={()=>setModal(null)}><JobNotifications initialId={modal?.id} api={api} state={notificationState} Field={Field} requests={requests.length} onRequests={()=>setModal('activity')} onChat={async id=>{setModal(null);await openChat(id);}} onRun={item=>setModal({type:'job-run',job:{name:item.title,lastRun:{coreRunId:item.id.replace(/^attention-/,'')}}})}/></Modal>}
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
      {modal?.type === "job" && (
        <Modal
          title={modal.job ? "Auftrag bearbeiten" : "Neuer Auftrag"}
          wide
          onClose={() => setModal(null)}
        >
          <JobForm
            routines={!!boot.features?.routines}
            initialTemplate={modal.template}
            workers={boot.workers || []}
            job={modal.job}
            connections={integrations.connections}
            onSave={guard(async (job) => {
              await api("/jobs/save", job);
              setJobs(await api("/jobs"));
              setModal(null);

            })}
          />
        </Modal>
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
function JobForm({ job, initialTemplate, connections, workers, onSave, routines }) {
  const [templateId, setTemplateId] = useState(initialTemplate?.id || "");
  const template = jobTemplates.find(t => t.id === templateId);
  const [draft, setDraft] = useState(() => job || (initialTemplate ? jobFromTemplate(initialTemplate.id) : {}));
  const [active, setActive] = useState(job?.status === "active");
  const [schedule, setSchedule] = useState(job?.schedule?.type || initialTemplate?.schedule.type || "manual"),
    [worker, setWorker] = useState(job?.worker || "auto");
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
          rows={6}
          value={draft.instructions || ""}
          onChange={e => setDraft(d => ({...d, instructions: e.target.value}))}
          placeholder="Was soll erledigt werden? Welche Eingaben werden gebraucht? Wo soll das Ergebnis liegen?"
          required
        />
      </Field>
      <div className="form-grid">
        <Field label="Ausführen mit">
          <select value={worker} onChange={(e) => setWorker(e.target.value)}>
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
      <p className="form-help">
        {worker !== "n8n"
          ? "Nutzt die gemeinsame Firmenbasis und speichert Ergebnisse beim Auftrag. Eine feste Worker-Auswahl bleibt verbindlich."
          : "Startet einen vorhandenen Ablauf. Die Antwort des Webhooks wird protokolliert; sie bestätigt nicht automatisch das fachliche Ergebnis."}
      </p>
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
      <div className="row between">
        {schedule !== "manual" ? (
          <label className="checkbox-label">
            <button type="button" role="switch" className="apple-switch" aria-label="Zeitplan aktivieren" aria-checked={active} onClick={() => setActive(a => !a)}><span /></button>
            Zeitplan aktivieren
          </label>
        ) : (
          <span className="form-help">Nach dem Speichern manuell starten.</span>
        )}
        <button className="primary">Auftrag speichern</button>
      </div>
    </form>
  );
}
createRoot(document.getElementById("root")).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>);
