import React, {useEffect, useState} from 'react';
import {Search, Plus, RefreshCw, FileText, ChevronRight, Link} from './icons.jsx';
import {Modal} from './modal.jsx';
import {FilterPicker} from './filter-picker.jsx';

type Api = <T = any>(url: string, data?: unknown) => Promise<T>;
type Project = {id:string;name:string;path?:string};
type Hit = {path:string;title:string;excerpt:string;projectId:string;method:string};
type Note = {path:string;text:string;version:string|null;links:{target:string;label:string;path:string|null;ambiguous:boolean;candidates:string[]}[];backlinks:{path:string;title:string}[]};
type Embeddings = {configured:boolean;ready:boolean;error:string|null};

export function KnowledgePanel({api,projects,notify}:{api:Api;projects:Project[];notify:(s:string)=>void}) {
  const [query,setQuery]=useState(''),[project,setProject]=useState('all'),[hits,setHits]=useState<Hit[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const [note,setNote]=useState<{path:string;projectId:string;isNew?:boolean}|null>(null);
  const [embeddings,setEmbeddings]=useState<Embeddings|null>(null);
  useEffect(()=>{
    let current=true;
    const timer=setTimeout(async()=>{
      setBusy(true);setError('');
      try { const result=await api('/knowledge/search?q='+encodeURIComponent(query)+'&projectId='+encodeURIComponent(project));
        if(current){setHits(result.results);setEmbeddings(result.embeddings);}
      } catch(e) {if(current)setError((e as Error).message);} finally {if(current)setBusy(false);}
    },180);
    return ()=>{current=false;clearTimeout(timer);};
  },[query,project,revision]);
  return <section className="knowledge-panel" aria-label="Lokales Wissen">
    <div className="skill-filters"><div className="search-box"><Search size={18} strokeWidth={1.55}/><input aria-label="Wissen durchsuchen" placeholder="Text, Thema oder ähnlichen Begriff suchen" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <FilterPicker disabled={false} label="Arbeitsbereich" value={project} onChange={setProject} options={[{value:'all',label:'Alle Arbeitsbereiche'},...projects.map(p=>({value:p.id,label:p.name}))]}/></div>
    <div className="row between library-toolbar"><p className="skill-results-status" role="status">{busy?'Suche läuft …':`${hits.length} Fundstellen`}</p>
      <div className="row"><button aria-label="Wissensindex aktualisieren" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await api('/knowledge/reindex',{});setRevision(v=>v+1);notify(`${r.documents} Textdateien erfasst.`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><RefreshCw size={18} strokeWidth={1.55}/></button>
        <button onClick={()=>{const id=project==='all'?'default':project;const p=projects.find(p=>p.id===id);setNote({path:(p?.path?p.path+'/':'')+'notes/',projectId:id,isNew:true});}}><Plus size={18} strokeWidth={1.55}/>Notiz erstellen</button></div></div>
    {error&&<p role="alert">{error}</p>}
    <div className="integration-grid" aria-busy={busy}>{hits.map(hit=><button className="integration-item knowledge-result" key={hit.path} onClick={()=>setNote({path:hit.path,projectId:hit.projectId})}>
      <div className="app-icon"><FileText size={24} strokeWidth={1.55}/></div><div className="min-w-0"><strong>{hit.title}</strong><p className="knowledge-excerpt">{hit.excerpt}</p><p className="knowledge-path">{hit.path}</p></div><ChevronRight size={17} strokeWidth={1.55}/>
    </button>)}</div>
    {!busy&&!hits.length&&!error&&<div className="empty"><FileText size={28} strokeWidth={1.55}/><h3>{query?'Keine passende Fundstelle':'Dein Wissen beginnt mit einer Notiz'}</h3><p>Markdown- und Textdateien bleiben in deinen Ordnern. Mit [[Notizname]] verbindest du Inhalte.</p></div>}
    <p className="page-note">{embeddings?.error|| (embeddings?.ready?'Volltext, ähnliche Schreibweisen und lokale Bedeutungssuche.':'Volltext und ähnliche Schreibweisen. Lokale Bedeutungssuche lässt sich zusätzlich einrichten.')}</p>
    {note&&<NoteEditor key={note.path} api={api} entry={note} onClose={()=>setNote(null)} onSaved={()=>setRevision(v=>v+1)} onOpen={path=>setNote({...note,path,isNew:false})}/>}
  </section>;
}

function NoteEditor({api,entry,onClose,onSaved,onOpen}:{api:Api;entry:{path:string;projectId:string;isNew?:boolean};onClose:()=>void;onSaved:()=>void;onOpen:(p:string)=>void}) {
  const [note,setNote]=useState<Note|null>(entry.isNew?{path:entry.path,text:'',version:null,links:[],backlinks:[]}:null);
  const [text,setText]=useState(''),[name,setName]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(entry.isNew)return;let current=true;api<Note>('/knowledge/note?path='+encodeURIComponent(entry.path)).then(n=>{if(current){setNote(n);setText(n.text);}}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[entry.path]);
  const dirty=text!==(note?.text||'');
  function close(){if(dirty&&!window.confirm('Ungespeicherte Änderungen verwerfen?'))return;onClose();}
  return <Modal title={entry.isNew?'Notiz erstellen':entry.path.split('/').pop()} wide onClose={close} className="knowledge-note">
    {error&&<p role="alert">{error}</p>}
    {!note&&!error&&<p role="status">Notiz wird geladen …</p>}
    {note&&<form className="grid gap-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{
      const path=entry.isNew?entry.path+name.replace(/\.md$/i,'')+'.md':entry.path;
      const saved=await api<Note>('/knowledge/note',{path,text,version:note.version,projectId:entry.projectId});setNote(saved);onSaved();
      if(entry.isNew)onOpen(saved.path);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      {entry.isNew&&<label>Name<input required maxLength={100} pattern="[^/\\\\]+" placeholder="Zum Beispiel: Projektideen" value={name} onChange={e=>setName(e.target.value)}/></label>}
      <label>Text<textarea aria-label="Notiztext" placeholder="Schreibe eine Notiz. Verlinke mit [[Notizname]] oder [[Notizname|Anzeigetext]]." value={text} onChange={e=>setText(e.target.value)}/></label>
      <div className="row between"><span className="page-note">{dirty?'Ungespeicherte Änderungen':'Als einfache Textdatei gespeichert'}</span><button className="primary" disabled={busy||!text.trim()||(!dirty&&!entry.isNew)}>{busy?'Speichert …':'Speichern'}</button></div>
      {!entry.isNew&&<div className="knowledge-links grid gap-4"><div><strong className="row"><Link size={16} strokeWidth={1.55}/>Verlinkt mit</strong><div className="flex flex-wrap gap-2">{note.links.length?note.links.map((link,i)=> <button type="button" key={i} disabled={!link.path||dirty} onClick={()=>link.path&&onOpen(link.path)}>{link.label||link.target}{!link.path&&(link.ambiguous?' · mehrdeutig':' · noch nicht vorhanden')}</button>):<p className="page-note">Noch keine Verknüpfungen.</p>}</div></div>
        <div><strong>Verweise auf diese Notiz</strong><div className="flex flex-wrap gap-2">{note.backlinks.length?note.backlinks.map(link=><button type="button" key={link.path} disabled={dirty} onClick={()=>onOpen(link.path)}>{link.title}</button>):<p className="page-note">Noch keine Rückverweise.</p>}</div></div></div>}
    </form>}
  </Modal>;
}
