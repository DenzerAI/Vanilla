import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ChatStart} from './chat-start';
import {AgentCompanion} from './agent-companion.jsx';
import {ComposerHeading} from './chat-controls.jsx';
import {createChatScroll} from './chat-scroll.mjs';
import {Skeleton} from './skeleton';
import './chat-start-preview.css';

const chats=[{id:'preview-chat',title:'Projekt besprechen',projectId:'preview',updatedAt:1,lastTurnStatus:'completed',lastCompletedTurnId:'preview-turn',readTurnId:'preview-turn'}];
/** Neutral specimen of the real start screen; never uses the application's API. */
export function ChatStartPreview() {
  const [loading,setLoading]=useState(false),[attachment,setAttachment]=useState(false),[draft,setDraft]=useState(''),[action,setAction]=useState('');
  const viewport=useRef<HTMLDivElement>(null),following=useRef(true);
  const api=useMemo(()=>loading?()=>new Promise(()=>{}):async(path:string)=>path==='/jobs'?[]:path.startsWith('/file/text')?{text:''}:{items:[]},[loading]);
  useLayoutEffect(()=>{
    if(!viewport.current)return;
    const controller=createChatScroll(viewport.current,following,()=>{});controller.sync();
    return()=>controller.dispose();
  },[loading]);
  return <section className="chat-start-preview" aria-label="Gesprächseinstieg als Designreferenz">
    <div className="blueprint-controls"><button type="button" aria-pressed={loading} onClick={()=>setLoading(!loading)}>Ladezustand</button><button type="button" aria-pressed={attachment} onClick={()=>setAttachment(!attachment)}>Mit Anhang</button></div>
    <div className="chat-main chat-start-preview-panel">
      <div ref={viewport} className="conversation"><ChatStart key={String(loading)} api={api} greeting="Was möchtest du heute angehen?" profile={{avatar:'nori',avatarColor:'neutral',reduceMotion:'on'}} requests={[]} notifications={[]} chats={chats} projectId="preview" composing={!!draft || attachment} onOpen={item=>{if(item.prompt)setDraft(item.prompt);setAction(item.threadId?'Vorschau: Gespräch öffnen.':item.kind==='weather'?'Vorschau: Wetterort im Profil einrichten.':'Vorschau: Entwurf vorbereiten.');}}/></div>
      <div className="composer-area"><div className="composer pill-composer">
        {attachment&&<div className="chat-start-preview-attachment"><Skeleton variant="media" announce={false}/><span className="page-note">Beispielanhang</span></div>}
        <ComposerHeading><span className="model-trigger">Modell · Denkstufe</span></ComposerHeading>
        <div className="composer-entry"><AgentCompanion avatar="lumi" color="neutral" chatId="preview" running={false} waiting={false} busy={false} connection="online" activity={null} lastTurnStatus={null} hasTurns={false}/><textarea aria-label="Nachricht · Vorschau" placeholder="Nachricht" rows={1} value={draft} onChange={event=>setDraft(event.target.value)}/></div>
      </div></div>
    </div>
    <p className="page-note" role="status">{action||'Kartenaktionen zeigen hier nur ihr Ziel. Es wird keine Nachricht gesendet.'}</p>
  </section>;
}
