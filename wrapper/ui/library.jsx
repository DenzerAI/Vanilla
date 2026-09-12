import {fileKind} from './artifact-content.mjs';
import {LibraryThumbnail} from './library-thumbnail.jsx';
import {Skeleton} from './skeleton.tsx';
import React,{useEffect,useState,useRef} from 'react';
import {FilterPicker} from './filter-picker.jsx';
import {FileText,Search,RefreshCw,Image,ChevronLeft,ChevronRight,Blocks,Maximize,X} from './icons.jsx';
import {libraryDate,sortLibraryEntries} from './library-order.mjs';
import {Modal} from './modal.jsx';
import {FileContent} from './file-content.jsx';
const kindLabels={html:'HTML',image:'Bild',pdf:'PDF',text:'Text / Code',audio:'Audio',video:'Video',download:'Datei'};
function rawUrl(entry){return '/api/file/raw?path='+encodeURIComponent(entry.path)+'&scope='+encodeURIComponent(entry.scope||'workspace');}
export function LibraryPage({api,notify,onOpen,onReuse,onSource,onJob,jobFilter,onClearJob,projects,PageHeading,onShowSidebar,revision}) {
  const [layout,setLayout]=useState(()=>{try{return localStorage.getItem('library-view')==='grid'?'grid':'list';}catch{return 'list';}});
  const [selection,setSelection]=useState(null), listRef=useRef(null), inspectorRef=useRef(null);
  const [data,setData]=useState({entries:[]}),[query,setQuery]=useState(''),[kind,setKind]=useState('all'),[project,setProject]=useState('all'),[busy,setBusy]=useState(true),[error,setError]=useState('');
  async function refresh(){setBusy(true);setError('');try{setData(await api('/library'));}catch(e){setError(e.message);notify(e.message);}finally{setBusy(false);}}
  useEffect(()=>{void refresh();},[revision]);
  function changeLayout(value){setLayout(value);try{localStorage.setItem('library-view',value);}catch{}}
  const entries=sortLibraryEntries(data.entries.map(entry=>({...entry,kind:fileKind(entry.path)}))).filter(e=>(kind==='all'||kind==='favorite'&&e.favorite||e.kind===kind)&&(project==='all'||e.projectId===project)&&(!jobFilter||e.jobId===jobFilter.id)&&`${e.name} ${e.path} ${e.origin||''} ${e.jobName||''}`.toLowerCase().includes(query.toLowerCase()));
  const selected=entries.find(e=>e.id===selection);
  useEffect(()=>{if(inspectorRef.current)inspectorRef.current.scrollTop=0;},[selected?.id]);
  function closePreview(){listRef.current?.querySelector('[aria-pressed="true"]')?.focus();setSelection(null);}
  function fileKey(event,index){
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key===' '){event.preventDefault();onOpen(entries[index],entries);return;}
    if(event.key==='Escape'){event.preventDefault();closePreview();return;}
    const buttons=[...listRef.current.querySelectorAll('.library-entry')];
    const columns=layout==='grid'?Math.max(1,buttons.filter(button=>button.offsetTop===buttons[0]?.offsetTop).length):1;
    const offset={ArrowDown:columns,ArrowUp:-columns,ArrowLeft:-1,ArrowRight:1}[event.key];
    const next=event.key==='Home'?0:event.key==='End'?entries.length-1:offset!==undefined?Math.max(0,Math.min(entries.length-1,index+offset)):null;
    if(next!==null){event.preventDefault();setSelection(entries[next].id);buttons[next]?.focus();}
  }
  return <div className="page library-page library-browser">
    <PageHeading title="Ergebnisse" onShowSidebar={onShowSidebar}>
      <div className="library-view-switch" role="group" aria-label="Dateiansicht"><button className="icon-button" title="Liste" aria-label="Liste" aria-pressed={layout==='list'} onClick={()=>changeLayout('list')}><FileText size={18}/></button><button className="icon-button" title="Bildraster" aria-label="Bildraster" aria-pressed={layout==='grid'} onClick={()=>changeLayout('grid')}><Blocks size={18}/></button></div>
      <button className="icon-button" aria-label="Ergebnisse aktualisieren" title="Aktualisieren" disabled={busy} onClick={refresh}><RefreshCw size={18}/></button>
    </PageHeading>
    <div className="library-controls"><div className="search-box"><Search size={16}/><input aria-label="Dateien suchen" placeholder="Suchen" value={query} onChange={e=>{setQuery(e.target.value);setSelection(null);}}/></div><FilterPicker label="Dateityp" value={kind} onChange={value=>{setKind(value);setSelection(null);}} options={['all','favorite','image','pdf','html','text','audio','video','download'].map((v,i)=>({value:v,label:['Alle Dateien','Favoriten','Bilder','PDFs','HTML-Seiten','Text und Code','Audio','Video','Weitere Dateien'][i]}))}/><FilterPicker label="Workspace" value={project} onChange={value=>{setProject(value);setSelection(null);}} options={[{value:'all',label:'Alle Workspaces'},...projects.map(p=>({value:p.id,label:p.name}))]}/>{jobFilter&&<><span className="page-note">Auftrag: {jobFilter.name}</span><button onClick={()=>{onClearJob();setSelection(null);}}>Alle Aufträge</button></>}</div>
    {error&&<p role="alert">{error}</p>}{data.truncated&&<p className="page-note">Die Erfassung ist auf 5.000 Dateien begrenzt.</p>}{data.warnings?.map(w=><p className="page-note" key={w}>{w}</p>)}
    <div className="library-browser-body">
      <div className="library-files">
        {layout==='list'&&<div className="library-columns" aria-hidden="true"><span>Name</span><span>Art</span><span>Geändert ↓</span></div>}
        <div ref={listRef} className={'library-entries'+(busy&&!data.entries.length&&!error?'':' library-entries-'+layout)} aria-label="Dateien" aria-busy={busy}>
        {busy&&!data.entries.length&&!error&&<Skeleton layout={"library-"+layout} rows={layout==='grid'?6:8} label="Dateien werden geladen …" announce={false}/>}

          {entries.map((e,index)=><button className="library-entry" key={e.id} aria-pressed={selected?.id===e.id} tabIndex={index===(selected?entries.indexOf(selected):0)?0:-1} title={e.name} onClick={()=>setSelection(e.id)} onDoubleClick={()=>onOpen(e,entries)} onKeyDown={event=>fileKey(event,index)}>
            <span className="library-entry-name"><LibraryThumbnail key={e.scope+e.path+e.modifiedAt} entry={e}/><span>{e.name}</span></span><span className="library-entry-kind">{e.missing?'Fehlt':kindLabels[e.kind]||'Datei'}</span><time className="library-entry-date">{libraryDate(e)}</time>
          </button>)}
        </div>
        {!busy&&!entries.length&&!error&&<div className="empty"><FileText size={28}/><h3>Keine Ergebnisse</h3><p>{query||kind!=='all'||project!=='all'||jobFilter?'Keine passenden Ergebnisse.':'Ergebnisse aus Aufträgen und Chats erscheinen hier.'}</p></div>}
        <p className="library-status" role="status">{busy?'Dateien werden geladen …':`${entries.length} Dateien · Zuletzt geändert`}</p>
      </div>
      {selected&&<aside className="workspace-panel library-inspector" aria-label="Ablage-Dateivorschau" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();closePreview();}}}>
        <div className="panel-head"><span>Vorschau</span><div className="row"><button className="icon-button" aria-label="Vorschau vergrößern" title="Vergrößern" onClick={()=>onOpen(selected,entries)}><Maximize size={16}/></button><button className="icon-button" aria-label="Vorschau schließen" onClick={closePreview}><X size={16}/></button></div></div>
        <div ref={inspectorRef} className="library-inspector-content"><div className="library-preview"><FileContent key={selected.scope+selected.path} path={selected.path} scope={selected.scope} api={api} readOnly reading/></div><h2>{selected.name}</h2><p className="page-note">{kindLabels[selected.kind]||'Datei'}{Number.isFinite(selected.size)?' · '+new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(selected.size/1024)+' KB':''}</p><details className="library-file-details"><summary>Informationen</summary><p>Geändert: {libraryDate(selected)}</p><p>{selected.origin}</p><code className="path-label">{selected.path}</code></details><div className="library-inspector-actions"><button disabled={selected.missing} onClick={()=>onReuse(selected)}>Im Chat verwenden</button><a href={rawUrl(selected)+'&download=1'} download>Herunterladen</a><button aria-pressed={!!selected.favorite} onClick={async()=>{try{const entry=await api('/library/favorite',{id:selected.id,favorite:!selected.favorite});setData(current=>({...current,entries:current.entries.map(item=>item.id===entry.id?entry:item)}));}catch(error){notify(error.message);}}}>{selected.favorite?'Favorit entfernen':'Als Favorit merken'}</button>{onJob&&selected.jobId&&<button disabled={!selected.jobAvailable} onClick={()=>onJob(selected)}>{selected.jobAvailable?'Zum Auftrag':'Auftrag nicht verfügbar'}</button>}{onSource&&selected.threadId&&<button onClick={()=>onSource(selected)}>Zum Gespräch</button>}</div></div>
      </aside>}
    </div>
  </div>;
}
export function ImageForm({api,connections,projects,projectId,onCreated,Field}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const available=connections.filter(c=>c.provider==='openai-image');
  return <form onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError('');try{await onCreated(await api('/library/image',Object.fromEntries(f)));}catch(e){setError(e.message);}finally{setBusy(false);}}}>
    {available.length?<><Field label="Bildverbindung"><select name="connectionId">{available.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></Field><Field label="Workspace"><select name="projectId" defaultValue={projectId}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Bildbeschreibung"><textarea name="prompt" required rows={5} maxLength={10000}/></Field><p className="page-note">Verwendet den eingerichteten API-Zugang. Das erzeugte Bild wird im Arbeitsbereich gespeichert.</p><div className="row end"><button disabled={busy} className="primary">{busy?'Bild wird erzeugt …':'Bild erzeugen'}</button></div></>:<p>Bitte zuerst unter Verbindungen einen OpenAI-Bildzugang einrichten. Vorhandene Bildwerkzeuge eines Workers bleiben im Chat nutzbar.</p>}{error&&<p role="alert">{error}</p>}
  </form>;
}

export function LibraryPreview({entry,entries=[],onNavigate,onClose,children}) {
  const index=entries.findIndex(item=>item.id===entry.id);
  function navigate(offset){const next=entries[index+offset];if(index>=0&&next)onNavigate(next);}
  useEffect(()=>{
    function keydown(event){
      if(event.defaultPrevented||event.altKey||event.metaKey||event.ctrlKey||event.shiftKey||event.target.closest('input,textarea,select,audio,video'))return;
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigate(event.key==='ArrowLeft'?-1:1);}
    }
    document.addEventListener('keydown',keydown);
    return()=>document.removeEventListener('keydown',keydown);
  },[entry.id,entries]);
  return <Modal wide className={'library-quicklook'+(fileKind(entry.path)==='html'?' html-quicklook':'')} title={entry.name} onClose={onClose}>
    <div className="library-preview-toolbar"><span/>{index>=0&&<div className="row"><button className="icon-button" aria-label="Vorherige Datei" disabled={index===0} onClick={()=>navigate(-1)}><ChevronLeft size={18}/></button><span>{index+1} / {entries.length}</span><button className="icon-button" aria-label="Nächste Datei" disabled={index===entries.length-1} onClick={()=>navigate(1)}><ChevronRight size={18}/></button></div>}</div>
    {children}
  </Modal>;
}
