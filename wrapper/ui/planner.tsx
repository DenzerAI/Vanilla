import {IconButton} from './icon-button';
import {ChatMenu} from './chat-controls.jsx';
import {PlannerCalendar} from './planner-calendar';
import {calendarClock} from './calendar-day.mjs';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "./modal.jsx";
import { SettingRow } from "./settings-row.jsx";
import { Skeleton } from "./skeleton";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Sun,
  Bell,
  RefreshCw,
  User,
  Inbox,
  Link,
} from "./icons.jsx";
import {
  dateKey,
  parseDay,
  addDays,
  monday,
  isoWeek,
  shiftMonth,
  eventOnDay,
  sortEvents,
} from "./planner-dates.mjs";
import { demoContact, demoEvents, type PlannerEvent } from "./planner-demo";
import "./planner.css";
import { demoBriefings } from "./planner-briefings.mjs";
import { dueCases } from "./planner-data.mjs";
type Fact = {
  value: any;
  status: string;
  source_time: string;
  decided_at: string;
  signal_id: string;
};
type Entity = {
  id: string;
  kind: string;
  revision: number;
  fields: Record<string, Fact[]>;
  freshness: { ready: boolean };
};
type Api = (url: string, data?: unknown) => Promise<any>;
type Props = {
  PageHeading: React.ComponentType<any>;
  section: "today" | "calendar";
  onSection: (s: "today" | "calendar") => void;
  onShowSidebar?: () => void;
  api: Api;
  crmEnabled: boolean;
  projectId: string;
  notifications: { data: any; error: string; refresh: () => unknown };
  notificationsEnabled: boolean;
  requests: number;
  onRequests: () => void;
  onNotifications: (id?: string) => void;
  onConnections: () => void;
  onJobs: () => void;
  onBriefing: (item: any) => Promise<void>;
};
const formatDay = (
  key: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
) => parseDay(key).toLocaleDateString("de-DE", options);
const field = (e: Entity, key: string) => e.fields[key]?.[0]?.value;
const entityName = (e: Entity) =>
  field(e, "display_name") ||
  field(e, "name") ||
  field(e, "title") ||
  [field(e, "given_name"), field(e, "family_name")].filter(Boolean).join(" ") ||
  "Ohne Namen";
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function storePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Browser preferences are optional; never store customer data here. */
  }
}
export function AgendaRow({
  event,
  onOpen,
}: {
  event: PlannerEvent;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="planner-agenda-row" onClick={onOpen}>
      <span className="planner-time">
        {event.allDay ? "Ganztägig" : event.start}
        <small>{!event.allDay && event.end}</small>
      </span>
      <span className="planner-row-copy">
        <strong>{event.title}</strong>
        <span>
          {[
            event.location,
            event.contactId === demoContact.id ? demoContact.name : "",
          ]
            .filter(Boolean)
            .join(" · ") || event.source}
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={undefined} />
    </button>
  );
}
export function BriefingRow({item, today, busy = false, disabled = false, onOpen}: {item: any; today: string; busy?: boolean; disabled?: boolean; onOpen: () => void}) {
  const date = dateKey(new Date(item.created_at * 1000));
  const label = date === today ? "Heute" : date === addDays(today, -1) ? "Gestern" : formatDay(date, {day:"numeric", month:"short"});
  return <button type="button" className="planner-briefing-row" onClick={onOpen} disabled={disabled} aria-label={`${item.title}, ${label}${item.demo ? ", Beispiel" : ""}, im Chat öffnen`} aria-busy={busy}>
    <span className="planner-briefing-date"><strong>{label}</strong><span>{new Date(item.created_at * 1000).toLocaleTimeString("de-DE", {hour:"2-digit", minute:"2-digit"})}{item.demo ? " · Beispiel" : ""}</span></span>
    <span className="planner-row-copy"><strong>{busy ? "Gespräch wird geöffnet …" : item.title.replace(/ · Fertig$/, "")}</strong><span>{item.body.replace(/[#*_`]/g, "")}</span></span>
    <ChevronRight size={16} strokeWidth={undefined} />
  </button>;
}
export function CalendarHeaderActions({demo,onCreate,onSources,onToggleDemo,onDetails}: {demo:boolean;onCreate:()=>void;onSources:()=>void;onToggleDemo:()=>void;onDetails:()=>void}) {
  return <div className="planner-header-actions" role="group" aria-label="Kalenderaktionen">
    <IconButton label="Termin hinzufügen" onClick={onCreate}><Plus size={18} strokeWidth={undefined}/></IconButton>
    <ChatMenu label="Kalenderoptionen" className="icon-button" selected={undefined} footer={null} items={[
      {id:'sources',label:'Kalenderquellen',action:onSources},
      {id:'examples',label:demo ? 'Beispieldaten ausblenden' : 'Beispieldaten anzeigen',action:onToggleDemo},
      {id:'details',label:'Kalenderdetails & Routinen',action:onDetails},
    ]}><MoreHorizontal size={18} strokeWidth={undefined}/></ChatMenu>
  </div>;
}
export function PlannerPatternPreview() {
  return (
    <><CalendarHeaderActions demo={true} onCreate={()=>{}} onSources={()=>{}} onToggleDemo={()=>{}} onDetails={()=>{}} /><PlannerCalendar date={dateKey(new Date())} today={dateKey(new Date())} mode="month" workweek={true} timezone="Europe/Berlin" events={demoEvents(dateKey(new Date()))} onDate={() => {}} onOpen={() => {}} onCreate={() => {}} /><BriefingRow item={demoBriefings(dateKey(new Date()))[0]} today={dateKey(new Date())} onOpen={() => {}} /><AgendaRow event={demoEvents(dateKey(new Date()))[0]} onOpen={() => {}} /></>
  );
}
export function PlannerPage(props: Props) {
  const { PageHeading, section, onSection, onShowSidebar, api } = props;
  const [calendarTimezone,setCalendarTimezone]=useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState(() => {
    const m = preference("planner.view", "month");
    return ["day", "week", "month"].includes(m) ? m : "month";
  });
  const [workweek, setWorkweek] = useState(
    () => preference("planner.workweek", "true") === "true",
  );
  const [demo, setDemo] = useState(
    () => preference("planner.demo", "false") === "true",
  );
  const [events, setEvents] = useState<PlannerEvent[]>(() => demoEvents(today));
  const [calendarRevision,setCalendarRevision]=useState(0),[calendarSaving,setCalendarSaving]=useState(false);
  const [calendarEvents, setCalendarEvents] = useState<PlannerEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState('Kalender wird geladen …');
  useEffect(() => {
    let alive=true, busy=false;
    const start=addDays(date.slice(0,7)+'-01',-7),end=addDays(shiftMonth(date.slice(0,7)+'-01',1),7);
    async function refresh(sync=false) {
      if(busy)return;busy=true;
      try {
        let syncFailed=false;
        if(sync) {
          const sources=await api('/services');
          for(const c of sources.connections.filter((c:any)=>c.provider==='microsoft-graph' && (c.projectId||'default')===props.projectId)) {
            try {await api('/calendar/sync',{id:c.id,projectId:props.projectId,start,end});}catch {syncFailed=true;}
          }
        }
        const result=await api('/calendar/events?'+new URLSearchParams({projectId:props.projectId,start,end}));
        if(!alive)return;
        setCalendarEvents(result.events);
        setCalendarTimezone(result.timezone);
        const localToday=calendarClock(Date.now(),result.timezone);setToday(localToday);setDate(old=>old===today?localToday:old);
        const stale=syncFailed||result.feeds.some((f:any)=>f.error||!f.covered||!f.synced||Date.now()-Date.parse(f.synced)>600000);
        setCalendarStatus(!result.feeds.length?'Vanilla-Kalender · Lokal gespeichert':stale?'Kalenderstand prüfen: Abgleich fehlt, ist fehlgeschlagen oder deckt diesen Zeitraum nicht ab.':'Letzter Abgleich: '+new Date(Math.min(...result.feeds.map((f:any)=>Date.parse(f.synced)))).toLocaleString('de-DE'));
      }catch(e){if(alive)setCalendarStatus('Kalenderstand prüfen: '+(e as Error).message);}
      finally{busy=false;}
    }
    setCalendarEvents([]);void refresh(true);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);
    return()=>{alive=false;clearInterval(timer);};
  },[date,props.projectId,api,calendarRevision]);
  const [detail, setDetail] = useState<PlannerEvent | null>(null),
    [draft, setDraft] = useState<PlannerEvent | null>(null),
    [modal, setModal] = useState<
      "concept" | "contact" | "message" | null
    >(null);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [partial, setPartial] = useState(false),
    [selectedEntity, setSelectedEntity] = useState<Entity | null>(null),
    [entityError, setEntityError] = useState("");
  const [demoResolved, setDemoResolved] = useState(false),
    [formError, setFormError] = useState("");
  const generation = useRef(0),
    detailGeneration = useRef(0),
    swipe = useRef<{ x: number; y: number } | null>(null);
  const reload = useCallback(async () => {
    const id = ++generation.current;
    if (!props.crmEnabled) {
      setEntities([]);
      setLoaded(true);
      setError("");
      return;
    }
    setRefreshing(true);
    try {
      const [result, schema] = await Promise.all([
        api("/crm/query", { kind: "case", limit: 100, offset: 0 }),
        api("/crm/schema"),
      ]);
      if (id !== generation.current) return;
      setEntities(result.results);
      setWorkflows(schema.workflows);
      setPartial(result.has_more);
      setLoaded(true);
      setError("");
    } catch (e) {
      if (id === generation.current) {
        setError((e as Error).message);
        setLoaded(true);
      }
    } finally {
      if (id === generation.current) setRefreshing(false);
    }
  }, [api, props.crmEnabled]);
  useEffect(() => {
    reload();
    const update = () => {
      if (document.visibilityState === "visible") {
        setToday(calendarClock(Date.now(),calendarTimezone));
        reload();
      }
    };
    const changed = (e: Event) => {
      if ((e as CustomEvent).detail?.kind?.startsWith("crm.")) update();
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("core/event", changed);
    const timer = setInterval(update, 30000);
    return () => {
      generation.current++;
      detailGeneration.current++;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("core/event", changed);
    };
  }, [reload,calendarTimezone]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [reportsError, setReportsError] = useState("");
  const [openingBriefing, setOpeningBriefing] = useState("");
  const [briefingError, setBriefingError] = useState("");
  const openingRef = useRef(false);
  const loadReports = useCallback(async () => {
    if (!props.notificationsEnabled) { setReportsLoaded(true); return; }
    try {
      const result = await api("/planner/results");
      setReports(result.items);
      setReportsError("");
    } catch (error) { setReportsError((error as Error).message); }
    finally { setReportsLoaded(true); }
  }, [api, props.notificationsEnabled]);
  useEffect(() => { loadReports(); }, [loadReports, props.notifications.data]);
  const briefings = reports.length ? reports : demo ? demoBriefings(today) : [];
  const openBriefing = async (item: any) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpeningBriefing(item.id); setBriefingError("");
    try { await props.onBriefing({...item, demoDate:today}); }
    catch (error) { setBriefingError((error as Error).message); }
    finally { openingRef.current = false; setOpeningBriefing(""); }
  };
  const chooseMode = (value: string) => {
    setMode(value);
    storePreference("planner.view", value);
  };
  const toggleDemo = () => {
    setDemo(!demo);
    storePreference("planner.demo", String(!demo));
    setDetail(null);
    setDraft(null);
    setModal(null);
  };
  const visibleEvents = sortEvents(demo ? events : calendarEvents);
  const onDay = (key: string) =>
    visibleEvents.filter((event: PlannerEvent) => eventOnDay(event, key));
  const due: Entity[] = dueCases(entities, workflows, today);
  const openEntity = async (e: Entity) => {
    const id = ++detailGeneration.current;
    setSelectedEntity(e);
    setEntityError("");
    try {
      const fresh = await api("/crm/entities/" + encodeURIComponent(e.id));
      if (id === detailGeneration.current) setSelectedEntity(fresh);
    } catch (err) {
      if (id === detailGeneration.current)
        setEntityError((err as Error).message);
    }
  };
  const create = (key = date, hour = 9, minute = 0) => {
    setDetail(null);
    setFormError("");
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      date: key,
      start: `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`,
      end: hour === 23 ? "23:59" : `${String(hour+1).padStart(2,"0")}:${String(minute).padStart(2,"0")}`,
      allDay: false,
      location: "",
      source: demo?"Eigener Kalender · Beispiel":"Vanilla",
      readOnly:false, revision:0,
    });
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || calendarSaving) return;
    try {
      parseDay(draft.date);
    } catch {
      setFormError("Bitte ein gültiges Datum wählen.");
      return;
    }
    if (
      !draft.title.trim() ||
      (!draft.allDay &&
        (!draft.start || !draft.end || draft.end <= draft.start))
    ) {
      setFormError("Bitte Titel und eine Endzeit nach dem Beginn angeben.");
      return;
    }
    if(!demo){
      setCalendarSaving(true);setFormError('');
      try{await api('/calendar/local/save',{...draft,projectId:props.projectId});setCalendarRevision(n=>n+1);window.dispatchEvent(new Event('calendar-changed'));setDate(draft.date);setDraft(null);}catch(error){setFormError((error as Error).message);}finally{setCalendarSaving(false);}return;
    }
    setEvents((old) => [
      ...old.filter((item) => item.id !== draft.id),
      { ...draft, title: draft.title.trim() },
    ]);
    setDate(draft.date);
    setDraft(null);
  };
  const move = (direction: number) =>
    setDate((old) =>
      mode === "month"
        ? shiftMonth(old, direction)
        : addDays(old, direction * (mode === "week" ? 7 : 1)),
    );
  const unread =
    props.notifications.data?.items?.filter((item: any) => !item.read_at) || [];
  return (
    <div
      className={"page planner-page " + (section === "today" ? "planner-today" : "planner-full-calendar")}
      data-capability="planner.overview"
      onTouchStart={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button,input,select,textarea,a,.calendar-time-view,.calendar-month-grid")) return;
        swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = swipe.current;
        swipe.current = null;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x,
          dy = e.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2)
          onSection(dx < 0 ? "calendar" : "today");
      }}
    >
      <PageHeading
        title={<span className="planner-heading-copy"><span>{section === "today" ? "Heute" : mode === "day" ? formatDay(date) : mode === "week"
          ? `KW ${isoWeek(date).week} · ${formatDay(monday(date), {day:"numeric", month:"short"})}–${formatDay(addDays(monday(date), workweek ? 4 : 6), {day:"numeric",month:"short"})}`
          : formatDay(date, {month:"long", year:"numeric"})}</span>{section === "calendar" && demo && <span className="planner-example-label">Beispielansicht</span>}</span>}
        onShowSidebar={onShowSidebar}
      >
        {section === "calendar" ? <CalendarHeaderActions demo={demo} onCreate={() => create()} onSources={props.onConnections}
          onToggleDemo={toggleDemo} onDetails={() => setModal("concept")} /> : <IconButton label="Verknüpfungen" onClick={() => setModal("concept")}><Link size={18} strokeWidth={undefined}/></IconButton>}
      </PageHeading>
      {section === "today" && <div className="planner-topline">
        <div className="tabs" aria-label="Tagesübersicht">
          <button
            type="button"
            aria-pressed={section === "today"}
            className={section === "today" ? "selected" : ""}
            onClick={() => onSection("today")}
          >
            Heute
          </button>
          <button
            type="button"
            aria-pressed={false}
            onClick={() => onSection("calendar")}
          >
            Kalender
          </button>
        </div>
      </div>}
      {section === "today" ? (
        <>
          <div className="planner-dateline">
            <span>
              {formatDay(today)} · KW {isoWeek(today).week}
            </span>
            {demo ? (
              <span>
                <Sun size={16} strokeWidth={undefined} />
                20° · Beispielort
              </span>
            ) : (
              <button
                type="button"
                className="small-button"
                onClick={() => setModal("concept")}
              >
                Standort & Wetter einrichten
              </button>
            )}
          </div>
          <section
            className="planner-briefing"
            aria-labelledby="planner-briefing-title"
          >
            <div className="planner-section-heading">
              <h2 id="planner-briefing-title">Briefings & Ergebnisse</h2>
              <button type="button" className="small-button" onClick={props.onJobs}>Routinen</button>
            </div>
            {reportsError && <p role="alert" className="planner-error">Ergebnisse konnten nicht aktualisiert werden. <button type="button" onClick={loadReports}>Erneut laden</button></p>}
            {!reportsLoaded && !demo && <Skeleton rows={3} label="Briefings werden geladen …" />}
            <div className="planner-briefing-list">
              {briefings.slice(0, 5).map(item => <BriefingRow key={item.id} item={item} today={today} busy={openingBriefing === item.id} disabled={!!openingBriefing} onOpen={() => openBriefing(item)} />)}
            </div>
            {reportsLoaded && !briefings.length && <p className="planner-empty">Noch kein Briefing. Plane dein Morgenbriefing als Routine, dann findest du die letzten Ergebnisse hier.</p>}
            {briefingError && <p role="alert" className="planner-error">{briefingError}</p>}
          </section>
          <div className="planner-day-grid">
          <section className="planner-section">
            <div className="planner-section-heading">
              <h2>Dein Tag</h2>
              <button
                type="button"
                className="small-button"
                onClick={() => {
                  setDate(today);
                  onSection("calendar");
                }}
              >
                Kalender öffnen
              </button>
            </div>
            {onDay(today).map((event: PlannerEvent) => (
              <AgendaRow
                key={event.id}
                event={event}
                onOpen={() => setDetail(event)}
              />
            ))}
            {!demo && (
              <p className="planner-empty">
                Dein Vanilla-Kalender ist bereit. Eigene Termine kannst du direkt anlegen. Externe Kalender werden über Verbindungen angeschlossen.
              </p>
            )}
            {demo && !onDay(today).length && (
              <p className="planner-empty">
                Heute sind keine Beispieltermine geplant.
              </p>
            )}
            {!loaded ? (
              <Skeleton rows={2} label="Nächste Schritte werden geladen …" />
            ) : (
              <>
                {error && (
                  <p role="alert" className="planner-error">
                    Kundenschritte konnten nicht aktualisiert werden.{" "}
                    <button type="button" onClick={reload}>
                      Erneut laden
                    </button>
                  </p>
                )}
                {demo && due.length > 0 && (
                  <p className="planner-meta">
                    Aus deinem Arbeitsbereich · echte CRM-Schritte
                  </p>
                )}
                {due.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className="planner-action-row"
                    onClick={() => openEntity(e)}
                  >
                    <User size={18} strokeWidth={undefined} />
                    <span className="planner-row-copy">
                      <strong>{field(e, "process").next_step}</strong>
                      <span>
                        {entityName(e)} ·{" "}
                        {formatDay(field(e, "process").due_date, {
                          day: "numeric",
                          month: "short",
                        })}
                        {field(e, "process").due_date < today
                          ? " · Überfällig"
                          : ""}
                      </span>
                    </span>
                    <span className="planner-meta">
                      {!e.freshness.ready || error ? "Stand prüfen" : "CRM"}
                    </span>
                    <ChevronRight size={16} strokeWidth={undefined} />
                  </button>
                ))}
                {partial && (
                  <p className="planner-empty">
                    Nächste Schritte aus den ersten 100 Vorgängen. Weitere
                    Vorgänge sind hier noch nicht enthalten.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="planner-section">
            <div className="planner-section-heading">
              <h2>Braucht dich</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Aktualisieren"
                disabled={refreshing}
                onClick={() => {
                  reload();
                  props.notifications.refresh();
                }}
              >
                <RefreshCw size={16} strokeWidth={undefined} />
              </button>
            </div>
            {demo && !demoResolved && (
              <button
                type="button"
                className="planner-action-row"
                onClick={() => setModal("message")}
              >
                <Inbox size={18} strokeWidth={undefined} />
                <span className="planner-row-copy">
                  <strong>Terminänderung von Alex prüfen</strong>
                  <span>Inbox → Kontakt → Kalender · Beispiel</span>
                </span>
                <ChevronRight size={16} strokeWidth={undefined} />
              </button>
            )}
            {(props.requests > 0 || unread.length > 0) && demo && (
              <p className="planner-meta">
                Aus deinem Arbeitsbereich · echte Hinweise
              </p>
            )}
            {props.requests > 0 && (
              <button
                type="button"
                className="planner-action-row"
                onClick={props.onRequests}
              >
                <Bell size={18} strokeWidth={undefined} />
                <span className="planner-row-copy">
                  <strong>
                    {props.requests} offene{" "}
                    {props.requests === 1 ? "Rückfrage" : "Rückfragen"}
                  </strong>
                  <span>Dein Agent braucht eine Entscheidung.</span>
                </span>
                <ChevronRight size={16} strokeWidth={undefined} />
              </button>
            )}
            {props.notificationsEnabled &&
              !props.notifications.data &&
              !props.notifications.error && (
                <Skeleton
                  rows={2}
                  label="Benachrichtigungen werden geladen …"
                />
              )}
            {props.notifications.error && (
              <p role="alert" className="planner-error">
                Benachrichtigungen konnten nicht aktualisiert werden.{" "}
                <button
                  type="button"
                  onClick={() => props.notifications.refresh()}
                >
                  Erneut laden
                </button>
              </p>
            )}
            {unread.slice(0, 5).map((item: any) => (
              <button
                type="button"
                className="planner-action-row"
                key={item.id}
                onClick={() => props.onNotifications(item.id)}
              >
                <Bell size={18} strokeWidth={undefined} />
                <span className="planner-row-copy">
                  <strong>{item.title}</strong>
                  <span>
                    {new Date(item.created_at * 1000).toLocaleString("de-DE")}
                  </span>
                </span>
                <ChevronRight size={16} strokeWidth={undefined} />
              </button>
            ))}
            {!demo &&
              (props.notifications.data || !props.notificationsEnabled) &&
              !props.requests &&
              !unread.length &&
              !props.notifications.error && (
                <p className="planner-empty">
                  Keine offenen Rückfragen oder geladenen ungelesenen Hinweise.
                  Inbox-Triage folgt mit der Nachrichtenanbindung.
                </p>
              )}
            <button
              type="button"
              className="small-button"
              disabled={!props.notificationsEnabled}
              onClick={() => props.onNotifications()}
            >
              Alle Benachrichtigungen
            </button>
          </section>
          </div>
        </>
      ) : (
        <>
          <div className="planner-calendar-toolbar">
            <div className="planner-period">
              <button
                type="button"
                className="icon-button"
                aria-label="Vorheriger Zeitraum"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} strokeWidth={undefined} />
              </button>
              <button type="button" className="small-button" onClick={() => setDate(today)}>Heute</button>
              <button
                type="button"
                className="icon-button"
                aria-label="Nächster Zeitraum"
                onClick={() => move(1)}
              >
                <ChevronRight size={18} strokeWidth={undefined} />
              </button>
            </div>
            <label className="planner-date-jump">
              <input
                type="date"
                aria-label="Zu Datum springen"
                value={date}
                onChange={(e) => {
                  try {
                    parseDay(e.target.value);
                    setDate(e.target.value);
                  } catch {
                    /* Keep the last complete valid date while typing. */
                  }
                }}
              />
            </label>
            <div className="tabs" aria-label="Kalenderansicht">
              {[
                ["day", "Tag"],
                ["week", "Woche"],
                ["month", "Monat"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={mode === value}
                  className={mode === value ? "selected" : ""}
                  onClick={() => chooseMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="small-button planner-workweek-toggle" aria-label="Nur Montag bis Freitag anzeigen"
              aria-pressed={workweek} onClick={() => {setWorkweek(!workweek); storePreference("planner.workweek", String(!workweek));}}>Mo–Fr</button>
          </div>
          {!demo && /^(Kalenderstand prüfen|Kalender wird)/.test(calendarStatus) && <p className="planner-meta" role="status">{calendarStatus}</p>}
          <PlannerCalendar date={date} today={today} mode={mode} workweek={workweek} timezone={calendarTimezone}
            events={visibleEvents} onDate={setDate} onDayOpen={(day) => {setDate(day); chooseMode("day");}} onWeek={(day) => {setDate(day); chooseMode("week");}} onOpen={setDetail} onCreate={create} />
        </>
      )}
      {detail && (
        <Modal
          wide={false}
          title={detail.title}
          onClose={() => setDetail(null)}
        >
          <p className="planner-meta">{detail.source}</p>
          <div className="settings-group">
            <SettingRow
              title="Termin"
              description={`${formatDay(detail.date)} · ${detail.allDay ? "Ganztägig" : detail.start + "–" + detail.end}`}
            />
            {detail.location && (
              <SettingRow title="Ort" description={detail.location} />
            )}
            <SettingRow
              title="Kontakt"
              description={
                detail.contactId === demoContact.id
                  ? demoContact.name + " · " + demoContact.company
                  : "Kein Kontakt zugeordnet"
              }
            >
              {detail.contactId && (
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null);
                    setModal("contact");
                  }}
                >
                  Kontakt öffnen
                </button>
              )}
            </SettingRow>
            {detail.sourceId && (
              <SettingRow
                title="Anlass aus der Inbox"
                description="Terminabstimmung zum Projekt"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null);
                    setModal("message");
                  }}
                >
                  Nachricht öffnen
                </button>
              </SettingRow>
            )}
          </div>
          <p className="planner-demo-note">
{demo ? "Beispieltermin. Änderungen werden weder gespeichert noch an einen Kalender gesendet." : detail.readOnly===false?"Vanilla-Termin. Lokal in diesem Arbeitsbereich gespeichert.":"Synchronisierter Termin. Änderungen und Einladungen erfolgen im verbundenen Kalender."}
          </p>
          <button
            disabled={!demo && detail.readOnly!==false}
            type="button"
            onClick={() => {
              setDraft({ ...detail });
              setDetail(null);
              setFormError("");
            }}
          >
            {demo?"Beispiel bearbeiten":"Termin bearbeiten"}
          </button>
          {!demo&&detail.readOnly===false&&<button type="button" disabled={calendarSaving} onClick={async()=>{if(!window.confirm('Diesen Vanilla-Termin löschen?'))return;setCalendarSaving(true);try{await api('/calendar/local/delete',{id:detail.id,projectId:props.projectId,revision:detail.revision});setDetail(null);setCalendarRevision(n=>n+1);window.dispatchEvent(new Event('calendar-changed'));}catch(error){setFormError((error as Error).message);}finally{setCalendarSaving(false);}}}>Termin löschen</button>}
          {formError&&<p role="alert">{formError}</p>}
        </Modal>
      )}
      {draft && (
        <Modal
          wide={false}
          title={demo?"Beispieltermin bearbeiten":"Vanilla-Termin"}
          onClose={() => setDraft(null)}
        >
          <form className="planner-form" onSubmit={save}><fieldset disabled={calendarSaving}>
            <label>
              Titel
              <input
                required
                maxLength={160}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              Datum
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <SettingRow title="Ganztägig">
              <button
                type="button"
                role="switch"
                className="apple-switch"
                aria-label="Ganztägiger Termin"
                aria-checked={draft.allDay}
                onClick={() =>
                  setDraft({
                    ...draft,
                    allDay: !draft.allDay,
                    start: draft.start || "09:00",
                    end: draft.end || "10:00",
                  })
                }
              >
                <span />
              </button>
            </SettingRow>
            {!draft.allDay && (
              <div className="planner-form-pair">
                <label>
                  Beginn
                  <input
                    type="time"
                    required
                    value={draft.start}
                    onChange={(e) =>
                      setDraft({ ...draft, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  Ende
                  <input
                    type="time"
                    required
                    value={draft.end}
                    onChange={(e) =>
                      setDraft({ ...draft, end: e.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <label>
              Ort
              <input
                maxLength={160}
                value={draft.location}
                onChange={(e) =>
                  setDraft({ ...draft, location: e.target.value })
                }
              />
            </label>
            {demo&&<label>
              Kontakt
              <select
                value={draft.contactId || ""}
                onChange={(e) =>
                  setDraft({ ...draft, contactId: e.target.value || undefined })
                }
              >
                <option value="">Kein Kontakt</option>
                <option value={demoContact.id}>
                  {demoContact.name} · Beispiel
                </option>
              </select>
            </label>}
            <p className="planner-demo-note">
              {demo?"Nur ein Beispiel. Änderungen werden nicht gespeichert.":"Wird im Vanilla-Kalender dieses Arbeitsbereichs gespeichert. Keine Einladung wird verschickt."}
            </p>
            {!demo&&<p className="planner-meta">Uhrzeiten: {calendarTimezone}</p>}
            {formError && (
              <p role="alert" className="planner-error">
                {formError}
              </p>
            )}
            <div className="row">
              <button type="button" onClick={() => setDraft(null)}>
                Abbrechen
              </button>
              <button type="submit" className="primary" disabled={calendarSaving}>
                {calendarSaving?"Speichert …":demo?"Im Beispiel übernehmen":"Termin speichern"}
              </button>
            </div>
          </fieldset></form>
        </Modal>
      )}
      {modal === "contact" && (
        <Modal
          wide={false}
          title={demoContact.name}
          onClose={() => setModal(null)}
        >
          <p className="planner-meta">Kontaktakte · Fiktives Beispiel</p>
          <div className="settings-group">
            <SettingRow title="Firma" description={demoContact.company} />
            <SettingRow title="Rolle" description={demoContact.role} />
            <SettingRow title="E-Mail" description={demoContact.email} />
            <SettingRow
              title="Telefon & Adresse"
              description="Noch nicht vorhanden"
            />
            <SettingRow
              title="Aktueller Stand"
              description={
                demoResolved
                  ? "Terminänderung im Beispiel geprüft."
                  : "Neue Terminänderung eingegangen. Bisherige Uhrzeit muss geprüft werden."
              }
            />
            <SettingRow
              title="Herkunft"
              description="Kontakt aus CRM, Nachricht aus Outlook, Termin aus Kalender. Die gemeinsame interne Kontakt-ID verbindet sie."
            />
          </div>
          <div className="row">
            <button type="button" onClick={() => setModal("message")}>
              Zugehörige Nachricht
            </button>
            <button
              type="button"
              onClick={() => {
                setModal(null);
                onSection("calendar");
                setDate(today);
                chooseMode("day");
              }}
            >
              Termine ansehen
            </button>
          </div>
        </Modal>
      )}
      {modal === "message" && (
        <Modal
          wide={false}
          title="Terminänderung prüfen"
          onClose={() => setModal(null)}
        >
          <p className="planner-meta">
            Inbox · Outlook · Beispielnachricht von {demoContact.name}
          </p>
          <blockquote>
            Können wir unsere Projektabstimmung heute von 10 auf 11 Uhr
            verschieben? Die besprochenen Anforderungen bleiben gleich.
          </blockquote>
          <div className="settings-group">
            <SettingRow
              title="Bisheriger Termin"
              description="10:00–10:45 Uhr"
            />
            <SettingRow
              title="Vorschlag aus der Nachricht"
              description="11:00–11:45 Uhr. Erst die Bestätigung ändert den Beispieltermin."
            />
            <SettingRow
              title="Zugeordneter Kontakt"
              description={demoContact.name + " · " + demoContact.company}
            >
              <button type="button" onClick={() => setModal("contact")}>
                Kontakt öffnen
              </button>
            </SettingRow>
          </div>
          <p className="planner-demo-note">
            Rohsignal → Vorschlag → Bestätigung. Hier nur im Beispiel, ohne
            Versand oder Änderung echter Daten.
          </p>
          <div className="row">
            <button type="button" onClick={() => setModal(null)}>
              Später prüfen
            </button>
            <button
              type="button"
              disabled={
                demoResolved || !events.some((e) => e.id === "demo-meeting")
              }
              className="primary"
              onClick={() => {
                setEvents((old) =>
                  old.map((e) =>
                    e.id === "demo-meeting"
                      ? { ...e, date: today, start: "11:00", end: "11:45" }
                      : e,
                  ),
                );
                setDemoResolved(true);
                setModal(null);
              }}
            >
              {demoResolved
                ? "Im Beispiel bestätigt"
                : "Im Beispiel auf 11 Uhr ändern"}
            </button>
          </div>
        </Modal>
      )}
      {modal === "concept" && (
        <Modal
          wide={false}
          className="planner-concept-modal"
          title="Kalender & Verknüpfungen"
          onClose={() => setModal(null)}
        >
          <p className="planner-meta">{calendarStatus} · {calendarTimezone}</p>
          <div className="settings-group">
            <SettingRow
              icon={<Calendar size={20} strokeWidth={undefined} />}
              title="Kalender"
              description="Ein Termin verknüpft Zeitpunkt, Kontakt, Projekt und Anlass. Tag, Woche und Monat zeigen dieselben Termine. Microsoft und weitere Kalender werden über Verbindungen eingerichtet."
            />
            <SettingRow
              icon={<User size={20} strokeWidth={undefined} />}
              title="Kontakte & CRM"
              description="Eine interne Identität, mehrere Quellen. Echte fällige CRM-Schritte werden bereits gelesen; ungeprüfte Änderungen sind erkennbar. Kontakte werden aus dem jeweiligen Anlass geöffnet."
            />
            <SettingRow
              icon={<Inbox size={20} strokeWidth={undefined} />}
              title="Inbox & Entscheidungen"
              description="Neue Nachrichten liefern Vorschläge. Erst deine Bestätigung oder eine eindeutige Regel verändert einen Fakt. Die Terminänderung im Beispiel zeigt diesen Ablauf."
            />
            <SettingRow
              icon={<Sun size={20} strokeWidth={undefined} />}
              title="Standort & Wetter"
              description="Geplant: ein selbst gewählter Ort oder Standortfreigabe und eine Wetterquelle mit Aktualisierungszeit. Es wird noch kein Standort abgefragt."
            />
            <SettingRow
              icon={<Bell size={20} strokeWidth={undefined} />}
              title="Briefing & Hinweise"
              description="Die letzten fünf abgeschlossenen Routine-Ergebnisse erscheinen als Liste. Jeder Bericht öffnet sein eigenes Gespräch, in dem du direkt weiterfragen kannst."
            />
            <SettingRow
              icon={<Link size={20} strokeWidth={undefined} />}
              title="Aktueller Ausbaustand"
              description="Die Kalender-, Kontakt- und Inbox-Verknüpfung ist ein bedienbarer Entwurf. Externe Kalendersynchronisation, Wetterabruf und eine gesonderte Zuordnung nach Berichtstyp folgen. Beispieldaten werden niemals in das CRM geschrieben."
            />
          </div>
          <SettingRow title="Beispieldaten" description="Fiktive Termine und Briefings zur Vorschau.">
            <button type="button" role="switch" className="apple-switch" aria-label="Beispieldaten anzeigen" aria-checked={demo} onClick={toggleDemo}><span /></button>
          </SettingRow>
          <div className="row">
            <button
              type="button"
              onClick={() => {
                setModal(null);
                props.onConnections();
              }}
            >
              Verbindungen öffnen
            </button>
            <button
              type="button"
              onClick={() => {
                setModal(null);
                props.onJobs();
              }}
            >
              Routinen öffnen
            </button>
          </div>
        </Modal>
      )}
      {selectedEntity && (
        <Modal
          wide={false}
          title={entityName(selectedEntity)}
          onClose={() => {
            detailGeneration.current++;
            setSelectedEntity(null);
          }}
        >
          <p className="planner-meta">
            Echter CRM-Vorgang · Stand {selectedEntity.revision}
          </p>
          {entityError && (
            <p role="alert" className="planner-error">
              Die Akte konnte nicht neu geladen werden. Angezeigter Stand kann
              veraltet sein.{" "}
              <button type="button" onClick={() => openEntity(selectedEntity)}>
                Erneut laden
              </button>
            </p>
          )}
          {!selectedEntity.freshness.ready && (
            <p className="planner-error">
              Neue Informationen sind noch zu prüfen. Dieser Stand ist nicht für
              weitere Entscheidungen freigegeben.
            </p>
          )}
          <div className="settings-group">
            {["title", "process", "amount"]
              .filter((key) => field(selectedEntity, key) != null)
              .map((key) => (
                <SettingRow
                  key={key}
                  title={
                    (
                      {
                        title: "Vorgang",
                        process: "Nächster Schritt",
                        amount: "Wert",
                      } as Record<string, string>
                    )[key]
                  }
                  description={
                    key === "process"
                      ? `${field(selectedEntity, key).next_step || "Kein offener Schritt"}${field(selectedEntity, key).due_date ? " · " + formatDay(field(selectedEntity, key).due_date) : ""}`
                      : key === "amount"
                        ? new Intl.NumberFormat("de-DE", {
                            style: "currency",
                            currency: field(selectedEntity, key).currency,
                          }).format(
                            field(selectedEntity, key).minor_units / 100,
                          )
                        : String(field(selectedEntity, key))
                  }
                />
              ))}
          </div>
          <p className="planner-meta">
            Gelesen aus der gemeinsamen CRM-Datenbasis. Hier werden keine Fakten
            verändert.
          </p>
        </Modal>
      )}
    </div>
  );
}
