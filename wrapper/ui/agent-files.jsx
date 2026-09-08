import React,{useState,useEffect,useRef} from 'react';
import {ArrowLeft,Folder,FileText,RefreshCw,Download,Lock,ChevronRight} from './icons.jsx';
import {FileContent} from './file-content.jsx';
export function AgentFiles({api,onPreview,initialFolder}) {
  const openedTarget=useRef(null);
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
  useEffect(()=>{onPreview(!!file);return ()=>onPreview(false)},[file]);
  return <>
    <div className="file-toolbar">
      <button aria-label={file?'Zurück zum Ordner':'Übergeordneter Ordner'} disabled={!file&&!path} onClick={()=>file?setFile(null):setPath(path.split('/').slice(0,-1).join('/'))}><ArrowLeft size={15}/></button>
      <span title={file || (data?.root ? data.root+'/'+path : path)}>{file?file.split('/').pop():path?path.split('/').pop():'agent'}</span>
      {file?<a className="icon-button" aria-label="Datei herunterladen" href={'/api/file/raw?scope=agent&path='+encodeURIComponent(file)+'&download=1'}><Download size={16}/></a>:<button className="icon-button" aria-label="Dateien aktualisieren" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={15}/></button>}
    </div>
    {file?<FileContent key={file} path={file} api={api} scope="agent" readOnly/>:<>
      <p className="file-root-path">{data?.root}{path?'/'+path:''}</p>
      {error?<div role="alert"><p>{error}</p><button onClick={()=>setRevision(n=>n+1)}>Erneut versuchen</button></div>:!data?<p role="status">Ordner wird geladen …</p>:!data.files.length?<p>Dieser Ordner ist leer.</p>:data.files.map(entry=><button key={entry.path} className="file-row" disabled={!entry.accessible} title={!entry.accessible?'Geschützter Eintrag':entry.path} onClick={()=>entry.directory?setPath(entry.path):setFile(entry.path)}>
        {entry.directory?<Folder size={17}/>:<FileText size={17}/>}<span>{entry.name}</span>{!entry.accessible?<Lock size={13}/>:entry.directory?<ChevronRight size={13}/>:null}
      </button>)}
    </>}
  </>;
}
