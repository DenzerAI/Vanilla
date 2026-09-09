import {inboxDraftStore, inboxConversation} from './inbox-data.mjs';
import React, { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, FileText, Inbox, Search } from "./icons.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { FilterPicker } from "./filter-picker.jsx";
import { Modal } from "./modal.jsx";
import "./inbox.css";

type Conversation = {
  id: string; revision?: number; sender: string; initials: string; provider: string; account: string;
  subject: string; time: string; unread: boolean; done: boolean;
  messages: { sender: string; time: string; text: string; outgoing?: boolean }[];
};

// Deliberately fictional, local-only design fixtures. No connector or agent calls.
const examples: Conversation[] = [
  { id: "meeting", sender: "Lena · Studio Nord", initials: "LN", provider: "Outlook", account: "buero@example.com", subject: "Unser Termin am Donnerstag", time: "10:24", unread: true, done: false,
    messages: [
      { sender: "Du", time: "Gestern, 16:10", outgoing: true, text: "Hallo Lena,\n\nlass uns die nächsten Schritte diese Woche kurz gemeinsam durchgehen. Passt dir Donnerstag?" },
      { sender: "Lena · Studio Nord", time: "Heute, 10:24", text: "Hallo,\n\nDonnerstag passt gut. Wie wäre es um 10 Uhr? Ich bringe die ersten Ideen mit, dann können wir alles in Ruhe besprechen.\n\nViele Grüße\nLena" },
    ] },
  { id: "delivery", sender: "Ben", initials: "B", provider: "WhatsApp", account: "Beispielnummer", subject: "Kurze Rückfrage", time: "09:48", unread: true, done: false,
    messages: [
      { sender: "Ben", time: "Heute, 09:45", text: "Guten Morgen! Ich bin nachher in der Nähe. 🙂" },
      { sender: "Ben", time: "Heute, 09:48", text: "Soll ich die Muster direkt vorbeibringen? Gegen 14 Uhr würde gut passen." },
    ] },
  { id: "notes", sender: "Mira · Atelier West", initials: "MW", provider: "Gmail", account: "team@example.com", subject: "Notizen zu unserem Gespräch", time: "Gestern", unread: false, done: false,
    messages: [
      { sender: "Mira · Atelier West", time: "Gestern, 15:32", text: "Hallo,\n\nhier noch einmal die drei Punkte aus unserem Gespräch:\n\n1. Die Startseite soll ruhig und übersichtlich bleiben.\n2. Wir beginnen mit den wichtigsten Inhalten.\n3. Die Details stimmen wir im nächsten Termin ab.\n\nMelde dich gerne, wenn noch etwas fehlt.\n\nLiebe Grüße\nMira" },
    ] },
];

export function InboxConversationRow({ conversation, selected = false, onOpen }: {
  conversation: Conversation; selected?: boolean; onOpen: () => void;
}) {
  return <button type="button" className="inbox-row" aria-current={selected ? "true" : undefined}
    aria-label={`${conversation.sender}, ${conversation.provider}, ${conversation.time}${conversation.unread ? ", ungelesen" : ""}${conversation.done ? ", erledigt" : ""}`} onClick={onOpen}>
    <BrandIcon name={conversation.provider}/>
    <strong className="inbox-row-name">{conversation.sender}</strong>
    <span className="inbox-row-status"><span className="inbox-time">{conversation.time}</span>
      {conversation.unread && <span className="inbox-unread" aria-hidden="true"/>}
      {conversation.done && <Check strokeWidth={1.55} size={14}/>}</span>
  </button>;
}

export function InboxPatternPreview() {
  const [selected, setSelected] = useState(false);
  return <div className="inbox-pattern-preview"><InboxConversationRow conversation={examples[0]} selected={selected} onOpen={() => setSelected(value => !value)}/></div>;
}

type Props = {
  PageHeading: ComponentType<{ title: string; onShowSidebar?: () => void; children?: ReactNode }>;
  sidebarHost: HTMLElement | null;
  sidebarVisible: boolean;
  onShowSidebar: () => void;
  onHideSidebar: () => void;
  onBack: () => void;
  api: any;
  projectId: string;
};

export function InboxPage({ PageHeading, sidebarHost, sidebarVisible, onShowSidebar, onHideSidebar, onBack, api, projectId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [provider, setProvider] = useState("all");
  const [, redraw] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const drafts = useRef(inboxDraftStore(api, projectId, () => redraw(n => n + 1))).current;
  useEffect(() => {
    let alive = true, busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const result:any={conversations:[]};let offset:any=0;
        do {
          const page=await api('/inbox/threads?'+new URLSearchParams({projectId,offset:String(offset)}));
          result.conversations.push(...page.conversations);offset=page.nextOffset;
          if(!alive)return;
          if(result.conversations.length>=10000 && offset!=null)throw Error('Mehr als 10.000 Gespräche: gezielt über den Agenten mit inbox_threads weiterlesen.');
        }while(offset!=null);
        if (!alive) return;
        setConversations(result.conversations.map((row: any) => inboxConversation(row)));
        setSelectedId(previous => previous || result.conversations[0]?.id || '');
        setError('');
      } catch (e: any) {if (alive) setError(e.message);}
      finally {busy = false; if (alive) setLoading(false);}
    }
    void refresh();
    const timer = setInterval(refresh, 10000);
    const leaving = (event: BeforeUnloadEvent) => {if (drafts.pending) {event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload', leaving);
    return () => {alive = false;clearInterval(timer);window.removeEventListener('beforeunload', leaving);};
  }, [api, projectId, drafts]);
  const selectedRevision=conversations.find(item=>item.id===selectedId)?.revision;
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setDetail(null);
    api('/inbox/thread?id=' + encodeURIComponent(selectedId) + '&projectId=' + encodeURIComponent(projectId))
      .then(async (result: any) => {
        if (!alive) return;
        drafts.load(selectedId, result.draft);setDetail(result);
        await api('/inbox/mark', {id:selectedId, projectId, revision:result.thread.revision});
        if (alive) setConversations(items => items.map(item => item.id === selectedId ? {...item, unread:false} : item));
      }).catch((e: Error) => {if (alive) setError(e.message);});
    return () => {alive = false;};
  }, [selectedId, selectedRevision, projectId, api, drafts]);
  const [conceptOpen, setConceptOpen] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const draftField = useRef<HTMLTextAreaElement>(null);
  const row = conversations.find(item => item.id === selectedId);
  const selected = row ? {...row, messages: detail?.messages || []} : null;
  const draftRecord = drafts.records.get(selectedId);
  const draft = draftRecord?.text || "";
  const results = conversations.filter(item => {
    const text = [item.sender, item.subject, item.provider, item.account, ...item.messages.map(message => message.text)].join(" ").toLocaleLowerCase("de");
    return (provider === "all" || item.provider === provider) &&
      (filter === "done" ? item.done : !item.done && (filter !== "unread" || item.unread)) && text.includes(query.toLocaleLowerCase("de").trim());
  });
  useLayoutEffect(() => {
    const field = draftField.current;
    if (!field) return;
    let lastWidth = 0;
    const resize = () => {
      if (!field.clientWidth || !field.getClientRects().length) return;
      const limit = parseFloat(getComputedStyle(field).maxHeight);
      field.style.overflowY = "hidden";
      field.style.height = "0px";
      const height = field.scrollHeight;
      field.style.height = `${Math.min(height, limit)}px`;
      field.style.overflowY = height > limit ? "auto" : "hidden";
    };
    resize();
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width !== lastWidth) { lastWidth = width; resize(); }
    });
    observer.observe(field);
    // Font size and appearance can change while this field stays mounted.
    const appearance = new MutationObserver(resize);
    appearance.observe(document.documentElement, { attributes: true });
    document.fonts.addEventListener("loadingdone", resize);
    return () => { observer.disconnect(); appearance.disconnect(); document.fonts.removeEventListener("loadingdone", resize); };
  }, [draft, selectedId, sidebarVisible]);
  function openConversation(item: Conversation) {
    setSelectedId(item.id);
    if (window.matchMedia("(max-width: 650px)").matches) onHideSidebar();
    requestAnimationFrame(() => detailHeading.current?.focus({ preventScroll: true }));
  }
  function backToList() {
    onShowSidebar();
    requestAnimationFrame(() => (list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]') || list.current?.querySelector<HTMLButtonElement>('button') || sidebarHost?.querySelector<HTMLInputElement>('input'))?.focus());
  }
  return <>
    {sidebarHost && createPortal(<div className="inbox-sidebar-content">
      <button type="button" className="back-to-app" onClick={onBack}><ArrowLeft strokeWidth={1.55} size={18}/>Zurück</button>
      <PageHeading title="Inbox"><button type="button" className="icon-button" title="Konzept" aria-label="Inbox-Konzept" onClick={() => setConceptOpen(true)}><FileText strokeWidth={1.55} size={18}/></button></PageHeading>
      <div className="inbox-list-tools">
        <div className="search-box"><Search strokeWidth={1.55} size={18}/><input aria-label="Nachrichten suchen" placeholder="Suchen" value={query} onChange={event => setQuery(event.target.value)}/></div>
        <div className="inbox-tabs" role="group" aria-label="Nachrichtenstatus">{[["all", "Offen"], ["unread", "Ungelesen"], ["done", "Erledigt"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <FilterPicker label="Kanal" value={provider} onChange={setProvider} disabled={false} options={[{ value: "all", label: "Alle Kanäle" }, ...["Outlook", "Gmail", "WhatsApp"].map(value => ({ value, label: value }))]}/>
      </div>
      <div className="inbox-list" ref={list} aria-label="Gespräche">
        {results.map(item => <InboxConversationRow key={item.id} conversation={item} selected={item.id === selectedId} onOpen={() => openConversation(item)}/>)}
        {!results.length && <div className="inbox-empty" role="status"><Inbox strokeWidth={1.55} size={24}/><p>{query ? "Keine Treffer" : filter === "done" ? "Noch nichts erledigt" : filter === "unread" ? "Alles gelesen" : "Keine passenden Gespräche"}</p></div>}
      </div>
    </div>, sidebarHost)}
    <section className="inbox-page" data-capability="inbox.messages" aria-label="Nachrichtenverlauf">
      {(error || draftRecord?.error) && <p role="alert">{error || draftRecord.error} {draftRecord?.error && 'Dein Text bleibt hier erhalten. Bitte vor dem Verlassen kopieren und den aktuellen Entwurf neu laden.'}</p>}
      {!selected ? <div className="inbox-empty" role="status"><Inbox size={24}/><p>{loading ? 'Nachrichten werden geladen …' : 'Noch keine Nachrichten. Postfach unter Verbindungen einrichten.'}</p></div> : <>
      <header className="inbox-detail-head">
        {!sidebarVisible && <button className="icon-button" type="button" aria-label="Zur Gesprächsliste" onClick={backToList}><ArrowLeft strokeWidth={1.55} size={18}/></button>}
        <BrandIcon name={selected.provider}/>
        <h2 ref={detailHeading} tabIndex={-1} title={`${selected.provider} · ${selected.account}`}>{selected.sender}</h2>
        <button className="icon-button" type="button" aria-label={selected.done ? "Wieder öffnen" : "Als erledigt markieren"} title={selected.done ? "Wieder öffnen" : "Als erledigt markieren"} aria-pressed={selected.done} onClick={async () => {try {await api('/inbox/mark',{id:selectedId,projectId,done:!selected.done});setConversations(items=>items.map(item=>item.id===selectedId?{...item,done:!selected.done}:item));}catch(e:any){setError(e.message);}}}><Check strokeWidth={1.55} size={18}/></button>
      </header>
      <div className="inbox-messages" key={selectedId}>
        <div className="inbox-message-column">
          <p className="inbox-thread-subject">{selected.subject}</p>
          {selected.messages.map((message: any, index: number) => <article key={index} className={"inbox-message " + (message.outgoing ? "inbox-message-outgoing" : "")}>
            <div className="inbox-message-meta"><strong>{message.sender}</strong><span>{message.time}</span></div>
            <p>{message.text}</p>
          </article>)}
        </div>
      </div>
      <div className="inbox-compose"><div className="inbox-compose-inner">
        <textarea ref={draftField} aria-label="Antwortentwurf" rows={1} wrap="soft" placeholder="Antwort schreiben …" value={draft} disabled={!detail || !!draftRecord?.error} onChange={event => {void drafts.edit(selectedId,event.target.value);}}/>
      </div></div>
      </>}
    </section>
    {conceptOpen && <Modal title="Eine Inbox für alle Nachrichten" onClose={() => setConceptOpen(false)} wide={false} className="inbox-concept">
      <p>Outlook und Gmail werden unter Verbindungen eingerichtet. Die Inbox zeigt ausschließlich Nachrichten aus deinen ausdrücklich verbundenen Konten.</p>
      <p>Lesen, Erledigen und Antwortentwürfe werden lokal gespeichert. Die Antwortzeile sendet keine Nachricht. Im Agentenchat kannst du einen Entwurf prüfen und den Versand mit Empfänger und Inhalt ausdrücklich beauftragen.</p>
      <p>WhatsApp bleibt bis zur gemeinsamen Anbindung in seinem vorhandenen Verbindungsdialog. Es gibt hier keine automatischen Antworten.</p>
    </Modal>}
  </>;
}
