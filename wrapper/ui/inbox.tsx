import {inboxDraftStore, inboxConversation} from './inbox-data.mjs';
import React, { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, FileText, Inbox, Search, MoreHorizontal, SlidersHorizontal, ChevronDown } from "./icons.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { Modal } from "./modal.jsx";
import "./inbox.css";
import {inboxCategories, inboxSections} from './inbox-triage.mjs';
import {InboxComposer} from './inbox-composer';
import {InboxVoiceMessage, InboxTranscript} from './inbox-voice-message';
import {DeliveryChecks} from './delivery-checks';
import {ChatMenu} from './chat-controls.jsx';


type Conversation = {
  id: string; revision?: number; accountId?: string; preview?: string; triage?: {category:string;label:string;reason:string;source:string}; sender: string; initials: string; provider: string; account: string;
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
    <span className="inbox-row-copy"><strong className="inbox-row-name">{conversation.sender}</strong>{conversation.subject&&<span className="inbox-row-preview">{conversation.subject}</span>}</span>
    <span className="inbox-row-status"><span className="inbox-time">{conversation.time}</span>
      {conversation.unread && <span className="inbox-unread" aria-hidden="true"/>}
      {conversation.done && <Check strokeWidth={1.55} size={14}/>}</span>
  </button>;
}

export function InboxPatternPreview() {
  const [selected, setSelected] = useState(false);
  return <div className="inbox-pattern-preview"><InboxConversationRow conversation={examples[0]} selected={selected} onOpen={() => setSelected(value => !value)}/><div className="inbox-compose"><InboxComposer threadId="example-inbox" text="" onText={()=>{}} onSend={()=>{}} onFile={()=>{}} disabled busy={false} messenger={false}/></div></div>;
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
  const [filter, setFilter] = useState("open");
  const [view,setView]=useState("focus");
  const [account,setAccount]=useState("all");
  const [category,setCategory]=useState("all");
  const [accounts,setAccounts]=useState<any[]>([]);
  const [filterOpen,setFilterOpen]=useState(false),[triageOpen,setTriageOpen]=useState(false),[triageBusy,setTriageBusy]=useState(false);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [provider, setProvider] = useState("all");
  const [, redraw] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [uploading,setUploading]=useState(false);
  const [sending,setSending]=useState(false),[reply,setReply]=useState<any>(null),[attachments,setAttachments]=useState<Record<string,any>>({});
  const sendAttempts=useRef(new Map<string,string>());
  const messageList=useRef<HTMLDivElement>(null);
  const follow=useRef(true);
  const [refreshDetail,setRefreshDetail]=useState(0);
  const route=(id:string,action:string)=>`${id.startsWith("msg:")?"/messenger":"/inbox"}/${action}`;
  const drafts = useRef(inboxDraftStore(api, projectId, () => redraw(n => n + 1))).current;
  useEffect(() => {
    let alive = true, busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const result:any={conversations:[]};let offset:any=0;
        const mailAccounts=await api('/mail/accounts?'+new URLSearchParams({projectId}));
        if(!alive)return;setAccounts(mailAccounts.accounts);
        do {
          const page=await api('/inbox/threads?'+new URLSearchParams({projectId,offset:String(offset)}));
          result.conversations.push(...page.conversations);offset=page.nextOffset;
          if(!alive)return;
          if(result.conversations.length>=10000 && offset!=null)throw Error('Mehr als 10.000 Gespräche: gezielt über den Agenten mit inbox_threads weiterlesen.');
        }while(offset!=null);
        if (!alive) return;
        let messengerError='';
        try {const messenger=await api('/messenger/threads?'+new URLSearchParams({projectId}));result.conversations.push(...messenger.conversations);}catch(e:any){messengerError=String(e.message).includes('404')?'Messenger wird nach dem nächsten Serverneustart verfügbar.':e.message;}
        result.conversations.sort((a:any,b:any)=>String(b.updated).localeCompare(String(a.updated)));
        setConversations(result.conversations.map((row: any) => inboxConversation(row)));
        setError(messengerError);
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
    setDetail((old:any)=>old?.thread?.id===selectedId?old:null);
    api(route(selectedId,'thread')+'?id=' + encodeURIComponent(selectedId) + '&projectId=' + encodeURIComponent(projectId))
      .then(async (result: any) => {
        if (!alive) return;
        drafts.load(selectedId, result.draft);setDetail((old:any)=>{
          if(old?.thread?.id!==result.thread.id||old.messages.length<=100)return result;
          const merged=new Map(old.messages.map((m:any)=>[m.id,m]));for(const m of result.messages)merged.set(m.id,m);
          return {...result,messages:[...merged.values()].sort((a:any,b:any)=>a.time.localeCompare(b.time)),nextBefore:old.nextBefore};
        });
        if(window.matchMedia('(max-width: 650px)').matches&&sidebarVisible)return;
        await api(route(selectedId,'mark'), {id:selectedId, projectId, revision:result.thread.revision});
        if (alive) setConversations(items => items.map(item => item.id === selectedId ? {...item, unread:false} : item));
      }).catch((e: Error) => {if (alive) setError(e.message);});
    return () => {alive = false;};
  }, [selectedId, selectedRevision, projectId, api, drafts, refreshDetail, sidebarVisible]);
  useEffect(()=>{const timer=setInterval(()=>setRefreshDetail(n=>n+1),10000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{follow.current=true;setReply(null);},[selectedId]);
  useLayoutEffect(()=>{if(follow.current&&messageList.current)messageList.current.scrollTop=messageList.current.scrollHeight;},[detail,selectedId,sidebarVisible]);
  async function send(){
    const id=selectedId,record=drafts.records.get(id);if(!record||sending||uploading)return;
    setSending(true);setError('');
    try{
      await record.serial;if(record.error)throw Error(record.error);
      const sent=record.text;
      const key=id+':'+record.version+':'+(attachments[id]?.id||'');
      if(!sendAttempts.current.has(key))sendAttempts.current.set(key,crypto.randomUUID());
      await api(route(id,'send'),{id,projectId,version:record.version,revision:record.revision,requestId:sendAttempts.current.get(key),replyTo:reply?.external||'',attachmentId:attachments[id]?.id||''});
      // Preserve typing that happened during the send. Only the sent text is cleared.
      const fresh=await api(route(id,'thread')+'?'+new URLSearchParams({id,projectId}));
      if(record.text===sent){drafts.records.delete(id);drafts.load(id,fresh.draft);}else{record.saved=fresh.draft.text;record.version=fresh.draft.version;record.revision=fresh.draft.revision;void drafts.edit(id,record.text);}
      setAttachments(old=>{const copy={...old};delete copy[id];return copy;});setReply(null);follow.current=true;setRefreshDetail(n=>n+1);redraw(n=>n+1);
    }catch(e:any){setError(e.message);}finally{setSending(false);}
  }
  async function attach(file:File,voice=false){
    const id=selectedId;if(file.size>20*1024*1024)throw Error('Datei darf höchstens 20 MB groß sein.');
    setUploading(true);try {
    const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Datei nicht lesbar.'));reader.readAsDataURL(file);});
    const result=await api('/messenger/upload',{id,projectId,name:file.name,mime:file.type||'application/octet-stream',base64,voice});
    setAttachments(old=>({...old,[id]:result}));
    return result;
    } finally {setUploading(false);}
  }
  async function earlier(){
    if(!detail?.nextBefore)return;
    const id=selectedId,list=messageList.current,oldHeight=list?.scrollHeight||0;
    try{const previous=await api(route(id,'thread')+'?'+new URLSearchParams({id,projectId,before:detail.nextBefore}));follow.current=false;setDetail((current:any)=>current?.thread?.id===id?{...current,messages:[...previous.messages,...current.messages],nextBefore:previous.nextBefore}:current);requestAnimationFrame(()=>{if(list)list.scrollTop+=list.scrollHeight-oldHeight;});}catch(e:any){setError(e.message);}
  }
  const [conceptOpen, setConceptOpen] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const row = conversations.find(item => item.id === selectedId);
  const selected = row ? {...row, messages: detail?.messages || []} : null;
  const draftRecord = drafts.records.get(selectedId);
  const draft = draftRecord?.text || "";
  const sections=inboxSections(conversations,{query,provider,account,status:filter,category,view});
  const filterCount=Number(provider!=='all')+Number(account!=='all')+Number(category!=='all')+Number(filter!=='open');
  const triageReady=conversations.some(item=>item.triage);
  async function correctTriage(value:string){
    setTriageBusy(true);setError('');
    try{
      await api('/inbox/triage',{id:selectedId,projectId,category:value});
      const label=inboxCategories.find(c=>c.value===value)?.label;
      if(value!=='auto')setConversations(items=>items.map(item=>item.id===selectedId?{...item,triage:{category:value,label:label||value,reason:'Für dieses Gespräch von dir festgelegt.',source:'manual'}}:item));
      setTriageOpen(false);
    }catch(e:any){setError(e.message);}finally{setTriageBusy(false);}
  }
  function openConversation(item: Conversation) {
    follow.current=true;
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
        <div className="inbox-view-bar"><div className="inbox-tabs" role="group" aria-label="Inbox-Ansicht">{[["focus","Fokus"],["all","Alle"]].map(([value,label])=><button key={value} type="button" aria-pressed={view===value} onClick={()=>setView(value)}>{label}</button>)}</div><button type="button" className="icon-button" aria-label={filterCount?`Inbox filtern, ${filterCount} aktiv`:'Inbox filtern'} title="Inbox filtern" onClick={()=>setFilterOpen(true)}><SlidersHorizontal size={18}/>{filterCount>0&&<span>{filterCount}</span>}</button></div>
        {(account!=='all'||provider!=='all'||category!=='all'||filter!=='open')&&<button type="button" className="inbox-filter-summary" onClick={()=>setFilterOpen(true)}>{[accounts.find(a=>a.id===account)?.address,provider!=='all'?provider:'',inboxCategories.find(c=>c.value===category)?.label,filter==='unread'?'Ungelesen':filter==='done'?'Erledigt':filter==='all'?'Alle Status':''].filter(Boolean).join(' · ')}</button>}
        {!triageReady&&conversations.some(c=>!c.id.startsWith('msg:'))&&<p className="muted">Grundtriage wird nach dem Serverneustart verfügbar.</p>}
      </div>
      <div className="inbox-list" ref={list} aria-label="Gespräche">
        {sections.main.map((item:Conversation) => <InboxConversationRow key={item.id} conversation={item} selected={item.id === selectedId} onOpen={() => openConversation(item)}/>)}
        {sections.bundles.map((bundle:any)=><div className="inbox-bundle" key={bundle.value}><button type="button" className="inbox-bundle-toggle" aria-expanded={!!expanded[bundle.value]} onClick={()=>setExpanded(old=>({...old,[bundle.value]:!old[bundle.value]}))}><ChevronDown size={16}/><span>{bundle.label}</span><span className="inbox-bundle-count">{bundle.items.length}</span></button>{expanded[bundle.value]&&bundle.items.map((item:Conversation)=><InboxConversationRow key={item.id} conversation={item} selected={item.id===selectedId} onOpen={()=>openConversation(item)}/>)}</div>)}
        {!sections.main.length&&sections.bundles.length>0&&<p className="inbox-focus-empty">Keine weiteren Gespräche im Fokus.</p>}
        {!sections.main.length&&!sections.bundles.length && <div className="inbox-empty" role="status"><Inbox strokeWidth={1.55} size={24}/><p>{query ? "Keine Treffer" : filter === "done" ? "Noch nichts erledigt" : filter === "unread" ? "Alles gelesen" : "Keine passenden Gespräche"}</p></div>}
      </div>
    </div>, sidebarHost)}
    <section className="inbox-page" data-capability="inbox.messages" data-messenger={selectedId.startsWith("msg:")} data-group={!!detail?.thread?.external?.endsWith("@g.us")} aria-label="Nachrichtenverlauf">
      {(error || draftRecord?.error) && <p role="alert">{error || draftRecord.error} {draftRecord?.error && 'Dein Text bleibt hier erhalten. Bitte vor dem Verlassen kopieren und den aktuellen Entwurf neu laden.'}</p>}
      {!selected ? <div className="inbox-empty" role="status"><Inbox size={24}/><p>{loading ? 'Nachrichten werden geladen …' : conversations.length?'Wähle ein Gespräch aus der Inbox.':'Noch keine Nachrichten. Postfach unter Verbindungen einrichten.'}</p></div> : <>
      <header className="inbox-detail-head">
        {!sidebarVisible && <button className="icon-button" type="button" aria-label="Zur Gesprächsliste" onClick={backToList}><ArrowLeft strokeWidth={1.55} size={18}/></button>}
        <BrandIcon name={selected.provider}/>
        <h2 ref={detailHeading} tabIndex={-1} title={`${selected.provider} · ${selected.account}`}>{selected.sender}</h2>
        {selected.triage&&<button className="icon-button" type="button" aria-label="Einordnung ansehen oder ändern" title="Einordnung ansehen oder ändern" onClick={()=>setTriageOpen(true)}><SlidersHorizontal size={18}/></button>}
        <button className="icon-button" type="button" aria-label={selected.done ? "Wieder öffnen" : "Als erledigt markieren"} title={selected.done ? "Wieder öffnen" : "Als erledigt markieren"} aria-pressed={selected.done} onClick={async () => {try {await api(route(selectedId,'mark'),{id:selectedId,projectId,done:!selected.done});setConversations(items=>items.map(item=>item.id===selectedId?{...item,done:!selected.done}:item));}catch(e:any){setError(e.message);}}}><Check strokeWidth={1.55} size={18}/></button>
      </header>
      <div className="inbox-messages" key={selectedId} ref={messageList} onScroll={()=>{const el=messageList.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;}}>
        <div className="inbox-message-column">
          {detail?.nextBefore&&<button type="button" onClick={()=>void earlier()}>Ältere Nachrichten</button>}
          {selected.subject&&<p className="inbox-thread-subject">{selected.subject}</p>}
          {selected.messages.map((message: any, index: number) => <article key={message.id||index} className={"inbox-message " + (message.outgoing ? "inbox-message-outgoing" : "")}>

            {message.quoted&&<blockquote className="inbox-quote"><strong>{message.quoted.sender}</strong><p>{message.quoted.text}</p></blockquote>}
            {message.media?.url&&(message.media.mime.startsWith('image/')?<a href={message.media.url} target="_blank" rel="noreferrer"><img className="inbox-media" src={message.media.url} alt={message.text||'Bild'} loading="lazy"/></a>:message.media.mime.startsWith('audio/')?<InboxVoiceMessage src={message.media.url} transcript={message.transcript}/>:message.media.mime.startsWith('video/')?<video className="inbox-media" controls preload="metadata" src={message.media.url}/>:<a href={message.media.url} download>{message.media.name||'Datei herunterladen'}</a>)}
            {message.missingMedia&&<p className="muted">Originaldatei nicht im übernommenen Verlauf vorhanden.</p>}
            <p>{message.text}</p>
            {!selectedId.startsWith('msg:')&&message.attachments?.map((attachment:any)=><p key={attachment.id}><a href={'/api/inbox/attachment?'+new URLSearchParams({id:message.id,attachmentId:attachment.id,projectId})} download>{attachment.name||'Anhang herunterladen'}</a></p>)}
            {message.transcript&&!(message.media?.url&&message.media.mime.startsWith('audio/'))&&<InboxTranscript text={message.transcript}/>}
            {!!message.reactions?.length&&<div className="inbox-reactions">{message.reactions.map((reaction:any,n:number)=><span key={n} title={reaction.sender}>{reaction.emoji}{reaction.count>1?' '+reaction.count:''}</span>)}</div>}
            <div className="inbox-message-meta"><strong>{message.outgoing?"Du":selectedId.startsWith("msg:")?(detail?.thread?.external?.endsWith("@g.us")?message.sender.split("@")[0]:selected.sender):message.sender}</strong><span>{new Date(message.time).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>{message.outgoing&&message.ack!=null&&<span title={message.ack>=3?'Gelesen':message.ack>=2?'Zugestellt':'Gesendet'}><DeliveryChecks double={message.ack>=2}/></span>}</div>
            {selectedId.startsWith('msg:')&&<div className="inbox-message-actions"><ChatMenu selected={undefined} footer={undefined} label="Nachrichtenaktionen" className="icon-button" items={[{id:'reply',label:'Antworten',icon:<ArrowLeft size={16}/>,action:()=>setReply(message)},...['👍','❤️','😂','😮','😢','🙏',''].map(emoji=>({id:emoji||'remove',label:emoji||'Reaktion entfernen',action:async()=>{try{await api('/messenger/react',{id:selectedId,projectId,messageId:message.id,emoji});setRefreshDetail(n=>n+1);}catch(error:any){setError(error.message);}}}))]}><MoreHorizontal size={16}/></ChatMenu></div>}
          </article>)}
        </div>
      </div>
      <div className="inbox-compose"><InboxComposer key={selectedId} threadId={selectedId} text={draft} onText={(text:string)=>void drafts.edit(selectedId,text)} onSend={()=>void send()} onFile={attach} disabled={!detail||!!draftRecord?.error} busy={sending||uploading} messenger={selectedId.startsWith('msg:')} attachment={attachments[selectedId]} reply={reply} onClearAttachment={()=>setAttachments(old=>{const copy={...old};delete copy[selectedId];return copy;})} onClearReply={()=>setReply(null)}/></div>
      </>}
    </section>
    {filterOpen&&<Modal title="Inbox filtern" onClose={()=>setFilterOpen(false)}>
      <div className="inbox-filter-fields">
        <label className="field"><span>Kanal</span><select value={provider} onChange={e=>{setProvider(e.target.value);setSelectedId('');}}><option value="all">Alle Kanäle</option>{['Gmail','Outlook','WhatsApp','Telegram'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <label className="field"><span>Postfach</span><select value={account} onChange={e=>{setAccount(e.target.value);setSelectedId('');}}><option value="all">Alle Postfächer</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.address}</option>)}</select></label>
        <label className="field"><span>Status</span><select value={filter} onChange={e=>setFilter(e.target.value)}>{[['open','Offen'],['unread','Ungelesen'],['done','Erledigt'],['all','Alle Status']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Einordnung</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Alle Einordnungen</option>{inboxCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
      </div>
      <p className="muted">Die Grundtriage bündelt eindeutige Werbung, Belege und Routinemeldungen. Unklare Nachrichten bleiben im Fokus. Die Originalpostfächer bleiben unverändert.</p>
      <div className="modal-actions"><button type="button" onClick={()=>{setProvider('all');setAccount('all');setFilter('open');setCategory('all');}}>Zurücksetzen</button><button type="button" className="primary" onClick={()=>setFilterOpen(false)}>Anzeigen</button></div>
    </Modal>}
    {triageOpen&&selected?.triage&&<Modal title="Einordnung" onClose={()=>setTriageOpen(false)}>
      <p><strong>{selected.triage.label}</strong></p><p>{selected.triage.reason}</p>
      <p className="muted">Deine Auswahl gilt für dieses Gespräch, auch bei neuen Nachrichten. Mit „Automatisch einordnen“ stellst du die Grundtriage wieder her.</p>
      <div className="inbox-triage-options">{inboxCategories.map(c=><button type="button" key={c.value} disabled={triageBusy} aria-pressed={selected.triage?.category===c.value} onClick={()=>void correctTriage(c.value)}>{c.label}</button>)}<button type="button" disabled={triageBusy} onClick={()=>void correctTriage('auto')}>Automatisch einordnen</button></div>
    </Modal>}
    {conceptOpen && <Modal title="Eine Inbox für alle Nachrichten" onClose={() => setConceptOpen(false)} wide={false} className="inbox-concept">
      <p>Fokus zeigt Gespräche und bündelt eindeutige Werbung, Belege und Routinemeldungen. Alle zeigt die vollständige Liste für den gewählten Status. Die Suche berücksichtigt auch eingeklappte Gruppen. Die Grundtriage arbeitet lokal mit festen Regeln, ohne KI-Aufruf oder CRM-Voraussetzung.</p>
      <p>Outlook und Gmail werden unter Verbindungen eingerichtet. Die Inbox zeigt ausschließlich Nachrichten aus deinen ausdrücklich verbundenen Konten.</p>
      <p>Lesen, Erledigen und Antwortentwürfe werden lokal gespeichert. Der Sendepfeil sendet deinen gespeicherten Entwurf. Eingehende Nachrichten lösen keine automatische Antwort aus.</p>
      <p>Deine WhatsApp- und Telegram-Gespräche erscheinen hier nach der Einrichtung. Der separate Schreibkanal des Agenten bleibt im Hintergrund.</p>
    </Modal>}
  </>;
}
