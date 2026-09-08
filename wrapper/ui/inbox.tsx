import React, { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, FileText, Inbox, Search } from "./icons.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { FilterPicker } from "./filter-picker.jsx";
import { Modal } from "./modal.jsx";
import "./inbox.css";

type Conversation = {
  id: string; sender: string; initials: string; provider: string; account: string;
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
};

export function InboxPage({ PageHeading, sidebarHost, sidebarVisible, onShowSidebar, onHideSidebar, onBack }: Props) {
  const [conversations, setConversations] = useState(examples);
  const [selectedId, setSelectedId] = useState(examples[0].id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [provider, setProvider] = useState("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [conceptOpen, setConceptOpen] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const draftField = useRef<HTMLTextAreaElement>(null);
  const selected = conversations.find(item => item.id === selectedId)!;
  const draft = drafts[selectedId] || "";
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
    setConversations(items => items.map(row => row.id === item.id ? { ...row, unread: false } : row));
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
    <section className="inbox-page" data-capability="inbox.preview" aria-label="Nachrichtenverlauf">
      <header className="inbox-detail-head">
        {!sidebarVisible && <button className="icon-button" type="button" aria-label="Zur Gesprächsliste" onClick={backToList}><ArrowLeft strokeWidth={1.55} size={18}/></button>}
        <BrandIcon name={selected.provider}/>
        <h2 ref={detailHeading} tabIndex={-1} title={`${selected.provider} · ${selected.account}`}>{selected.sender}</h2>
        <button className="icon-button" type="button" aria-label={selected.done ? "Wieder öffnen" : "Als erledigt markieren"} title={selected.done ? "Wieder öffnen" : "Als erledigt markieren"} aria-pressed={selected.done} onClick={() => setConversations(items => items.map(item => item.id === selectedId ? { ...item, done: !item.done } : item))}><Check strokeWidth={1.55} size={18}/></button>
      </header>
      <div className="inbox-messages" key={selectedId}>
        <div className="inbox-message-column">
          <p className="inbox-thread-subject">{selected.subject}</p>
          {selected.messages.map((message, index) => <article key={index} className={"inbox-message " + (message.outgoing ? "inbox-message-outgoing" : "")}>
            <div className="inbox-message-meta"><strong>{message.sender}</strong><span>{message.time}</span></div>
            <p>{message.text}</p>
          </article>)}
        </div>
      </div>
      <div className="inbox-compose"><div className="inbox-compose-inner">
        <textarea ref={draftField} aria-label="Antwortentwurf" rows={1} wrap="soft" placeholder="Antwort schreiben …" value={draft} onChange={event => setDrafts(previous => ({ ...previous, [selectedId]: event.target.value }))}/>
      </div></div>
    </section>
    {conceptOpen && <Modal title="Eine Inbox für alle Nachrichten" onClose={() => setConceptOpen(false)} wide={false} className="inbox-concept">
      <p>Outlook, Gmail und WhatsApp laufen hier später in einer gemeinsamen Gesprächsliste zusammen. Die Konten richtest du unter Verbindungen ein.</p>
      <div className="settings-group">
        <div className="inbox-concept-step"><strong>1. Gemeinsam gestalten</strong><p>Jetzt: Gesprächsliste in der linken Seitenleiste, Verlauf, Suche und lokale Beispielentwürfe. Alle Nachrichten sind erfunden, Konten sind noch nicht verbunden. Entwürfe bleiben nur bis zum Verlassen der Inbox erhalten und werden nicht versendet.</p></div>
        <div className="inbox-concept-step"><strong>2. Nachrichten empfangen</strong><p>Als Nächstes: echte Konten anbinden, Nachrichten zusammenführen und ihren Bearbeitungsstatus speichern.</p></div>
        <div className="inbox-concept-step"><strong>3. Mit dem Agenten bearbeiten</strong><p>Danach: ausgewählte Verläufe mitlesen lassen, Triage und Antwortentwürfe. Versand kommt als eigene freigegebene Aktion hinzu.</p></div>
      </div>
      <p>Aus Nachrichten können später Aufträge werden. Die Inbox bleibt der Ort für die Gespräche.</p>
    </Modal>}
  </>;
}
