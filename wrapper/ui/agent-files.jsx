import {Skeleton} from './skeleton.tsx';
import React,{useState,useEffect,useRef} from 'react';
import {ArrowLeft,Folder,FileText,RefreshCw,Download,Lock,ChevronRight} from './icons.jsx';
import {FileContent} from './file-content.jsx';
export function AgentFiles({api,initialFolder,onPreview}) {
  const openedTarget=useRef(null);
  const [showProtected,setShowProtected]=useState(false);
  const [path,setPath]=useState(''),[file,setFile]=useState(null),[data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let current=true; setData(null);setError('');
    api('/agent/files?path='+encodeURIComponent(path)).then(r=>{if(current)setData(r)}).catch(e=>{if(current)setError(e.message)});
    return ()=>{current=false};
  },[path,revision]);
  useEffect(()=>{
    if (initialFolder && openedTarget.current !== initialFolder && data?.root && initialFolder.startsWith(data.root+'/')) {
      openedTarget.current=initialFolder;
      setPath(initialFolder.slice(data.root.length+1));setFile(null);
    }
  },[initialFolder, data?.root]);
  const entries = [...(data?.files || [])].sort((a,b)=>Number(b.directory)-Number(a.directory) || a.name.localeCompare(b.name,'de',{numeric:true}));
  const visibleEntries=entries.filter(entry=>entry.accessible || showProtected);
  const protectedCount=entries.filter(entry=>!entry.accessible).length;
  const rootName=data?.root?.split('/').filter(Boolean).pop() || 'Projektordner';
  return <>
    <div className="file-toolbar">
      <button className="icon-button" aria-label={file?'Zurück zum Ordner':'Übergeordneter Ordner'} disabled={!file&&!path} onClick={()=>file?setFile(null):setPath(path.split('/').slice(0,-1).join('/'))}><ArrowLeft size={15}/></button>
      <span title={file || (data?.root ? data.root+'/'+path : path)}>{file?file.split('/').pop():path?path.split('/').pop():rootName}</span>
      {file?<a className="icon-button" aria-label="Datei herunterladen" href={'/api/file/raw?scope=agent&path='+encodeURIComponent(file)+'&download=1'}><Download size={16}/></a>:<button className="icon-button" aria-label="Dateien aktualisieren" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15}/></button>}
    </div>
    {file?<div className="workspace-file-list"><FileContent key={file} path={file} api={api} scope="agent" readOnly onEnlarge={onPreview?()=>onPreview(file):undefined}/></div>:<>
      <div className="workspace-file-path" title={[data?.root,path].filter(Boolean).join('/')}>{[rootName,...path.split('/').filter(Boolean)].join(' › ')}</div>
      <div className="workspace-file-list" aria-label="Ordnerinhalt">
      {error?<div role="alert"><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>Erneut versuchen</button></div>:!data?<Skeleton compact label="Ordner wird geladen …"/>:!visibleEntries.length?<p>{protectedCount ? "Nur geschützte Einträge in diesem Ordner." : "Dieser Ordner ist leer."}</p>:visibleEntries.map(entry=><button key={entry.path} className="file-row" disabled={!entry.accessible} title={!entry.accessible?'Geschützter Eintrag':entry.path} onClick={()=>entry.directory?setPath(entry.path):setFile(entry.path)}>
        {entry.directory?<Folder size={17}/>:<FileText size={17}/>}<span>{entry.name}</span>{!entry.accessible?<Lock size={13}/>:entry.directory?<ChevronRight size={13}/>:null}
      </button>)}
      </div>
      {data && !error && <div className="workspace-file-footer"><span>{visibleEntries.length} Einträge</span>{protectedCount > 0 && <button aria-pressed={showProtected} onClick={()=>setShowProtected(value=>!value)}>{showProtected ? 'Geschützte ausblenden' : `${protectedCount} geschützte einblenden`}</button>}</div>}
    </>}
  </>;
}
