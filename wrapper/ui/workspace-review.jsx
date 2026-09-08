import React, {useEffect, useState} from 'react';
import {RefreshCw, GitBranch} from './icons.jsx';
import {DiffView} from './chat-artifacts.jsx';
export function ReviewPanel({api, projectId, projectName}) {
  const [result,setResult] = useState(null), [error,setError] = useState(''), [loading,setLoading] = useState(true), [revision,setRevision] = useState(0);
  useEffect(()=>{
    let current = true;
    setLoading(true); setError(''); setResult(null);
    api('/review?projectId='+encodeURIComponent(projectId)).then(data=>{if(current)setResult(data)}).catch(e=>{if(current)setError(e.message)}).finally(()=>{if(current)setLoading(false)});
    return ()=>{current=false};
  },[projectId,revision]);
  return <div className="workspace-review">
    <div className="review-toolbar"><GitBranch size={16}/><span>{result?.branch || projectName || 'Projekt'}</span><button className="icon-button" aria-label="Änderungen aktualisieren" disabled={loading} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/></button></div>
    {loading ? <p role="status">Änderungen werden geladen …</p> : error ? <p role="alert">{error}</p> : result && !('repository' in result) ? <><p>Die neue Git-Dateiliste wird nach dem nächsten Serverstart verfügbar.</p><DiffView diff={result.stdout || result.aggregatedOutput || result.stderr || ''}/></> : !result?.repository ? <p>In diesem Ordner ist kein Git-Repository vorhanden.</p> : <>
      <p className="muted">{result.files.length ? `${result.files.length} geänderte Dateien` : 'Keine Änderungen im Projekt.'}</p>
      {result.files.map(file=><details className="review-file" key={file.path} open={result.files.length===1}>
        <summary><span className="review-status">{file.status === '??' ? 'Neu' : file.status.trim()}</span><span title={file.path}>{file.path}</span></summary>
        {file.status === '??' ? <p>Neue, noch nicht versionierte Datei.</p> : <>
          {file.staged && <section><h4>Vorgemerkt</h4><DiffView diff={file.staged}/></section>}
          {file.unstaged && <section><h4>Arbeitskopie</h4><DiffView diff={file.unstaged}/></section>}
          {!file.staged && !file.unstaged && <p>Keine Textänderungen verfügbar.</p>}
        </>}
      </details>)}
      {result.truncated && <p>Die Ausgabe wurde begrenzt. Weitere Dateien bitte direkt mit Git prüfen.</p>}
    </>}
  </div>;
}
