import React, {useEffect, useRef, useState} from 'react';
import {FileText, Image, Globe, Briefcase, ChevronRight, ArrowLeft, Download, Folder} from './icons.jsx';
import {IconButton} from './icon-button';
import {FileContent} from './file-content.jsx';
import {fileKind} from './artifact-content.mjs';
import {Skeleton} from './skeleton';
import './chat-shelf.css';

export type ShelfEntry = {id:string;kind:string;name:string;origin:string;time?:number|null;updatedAt?:number;path?:string;url?:string;jobId?:string;dataUrl?:string};
type ListProps = {entries:ShelfEntry[];title:string;loading?:boolean;error?:string;locked?:boolean;onRetry?:()=>void;onOpen:(entry:ShelfEntry,trigger?:HTMLButtonElement)=>void};
export function ChatShelf({entries,title,loading,error,locked,onRetry,onOpen}:ListProps) {
  let lastDay = '';
  return <>
    <div className="shelf-list" aria-label="Inhalte dieses Chats">
      <div className="shelf-context"><strong>{title}</strong><span>Alles aus diesem Gespräch</span></div>
      {locked ? <p className="shelf-empty">Entsperre den Chat, um seine Ablage zu sehen.</p> : loading ? <Skeleton compact label="Ablage wird geladen …"/> : error ? <div className="shelf-empty" role="alert"><p>{error}</p><button onClick={onRetry}>Erneut laden</button></div> : !entries.length ? <div className="shelf-empty"><Folder size={24}/><p>Hier kommt zusammen, was du hochlädst und was in diesem Chat entsteht.</p></div> : entries.map(entry=>{
        const date = entry.time ? new Date(entry.time) : null;
        const day = date ? date.toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'}) : 'Im Gespräch';
        const heading = lastDay !== day; lastDay = day;
        const Glyph = entry.kind==='job'?Briefcase:entry.kind==='link'?Globe:entry.kind==='image'||fileKind(entry.path)==='image'?Image:FileText;
        return <React.Fragment key={entry.id}>
          {heading && <div className="shelf-day">{day}</div>}
          <button type="button" className="shelf-row" onClick={event=>onOpen(entry,event.currentTarget)} title={entry.name}>
            <Glyph size={18}/><span className="shelf-copy"><span className="shelf-name">{entry.name}</span><span className="shelf-meta">{entry.origin}{date && <> · <time dateTime={date.toISOString()}>{date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</time></>}{entry.updatedAt && ' · aktualisiert'}</span></span><ChevronRight size={14}/>
          </button>
        </React.Fragment>;
      })}
    </div>
    {!loading && !error && !locked && <div className="shelf-footer">{entries.length} {entries.length===1?'Eintrag':'Einträge'} · Dieses Gespräch</div>}
  </>;
}

export function ShelfFilePreview({entry,api,onBack,scope='workspace'}:{entry:ShelfEntry;api:any;onBack:()=>void;scope?:string}) {
  const [failed,setFailed] = useState(false);
  const backButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{backButton.current?.focus({preventScroll:true});},[entry.id]);
  return <div className="shelf-preview">
    <div className="shelf-preview-head"><IconButton ref={backButton} label="Zurück zur Liste" onClick={onBack}><ArrowLeft size={16}/></IconButton><span title={entry.name}>{entry.name}</span><a className="icon-button" aria-label="Datei herunterladen" title="Herunterladen" download href={entry.dataUrl || '/api/file/raw?scope='+scope+'&path='+encodeURIComponent(entry.path || '')+'&download=1'}><Download size={16}/></a></div>
    <div className="shelf-preview-content">{entry.dataUrl ? failed ? <div role="alert"><p>Das Bild konnte nicht geladen werden.</p><button onClick={()=>setFailed(false)}>Erneut versuchen</button></div> : <img className="file-image" src={entry.dataUrl} alt={entry.name} onError={()=>setFailed(true)}/> : <FileContent path={entry.path} api={api} scope={scope} readOnly reading onEnlarge={undefined}/>}</div>
    <details className="shelf-information"><summary>Informationen</summary><p>{entry.origin}</p>{entry.time && <p>{new Date(entry.time).toLocaleString('de-DE')}</p>}{entry.path && <p>{entry.path}</p>}</details>
  </div>;
}

export function ChatShelfPreview() {
  const [selected,setSelected]=useState<ShelfEntry|null>(null);
  const entries:ShelfEntry[]=[{id:'upload',kind:'file',name:'Briefing.md',origin:'Hochgeladen',time:1789200000000},{id:'html',kind:'file',name:'Startseite.html',origin:'Ergebnis',time:1789200600000},{id:'job',kind:'job',name:'Website weiter ausarbeiten',origin:'Auftrag angelegt',time:1789200720000},{id:'link',kind:'link',name:'Website-Vorschau',origin:'Link',time:1789200780000}];
  return <div className="shelf-design-preview"><ChatShelf entries={entries} title="Ein neuer Auftritt" onOpen={entry=>setSelected(entry)}/>{selected && <p role="status">Beispielauswahl: {selected.name}</p>}</div>;
}
