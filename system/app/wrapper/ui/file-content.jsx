import {HtmlPreview} from './html-preview';
import {PdfPreview} from './pdf-preview.jsx';
import {Skeleton} from './skeleton.tsx';
import React, {useEffect, useState} from 'react';
import {Markdown} from './chat-rich-content.jsx';
import {fileKind} from './artifact-content.mjs';

export function FileContent({path, api, readOnly = false, reading = false, compact = false, scope = "workspace", onEnlarge}) {
  const [attempt, setAttempt] = useState(0), [state, setState] = useState({loading:true}), [text, setText] = useState(''), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [mediaReady, setMediaReady] = useState(false);
  const [source, setSource] = useState(false), [savedText, setSavedText] = useState(''), [revision, setRevision] = useState(0);
  const kind = fileKind(path), url = '/api/file/raw?path=' + encodeURIComponent(path) + '&scope=' + encodeURIComponent(scope);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(() => controller.abort(), 12000);
    setState({loading:true}); setText(''); setSaveError(''); setMediaReady(false);
    const get = async endpoint => {
      const response = await fetch(endpoint, {signal:controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.startsWith('ENOENT') ? 'Datei nicht gefunden. Sie wurde möglicherweise verschoben oder entfernt.' : data.error || 'Datei konnte nicht geladen werden.');
      return data;
    };
    (async () => {
      const info = await get('/api/file/info?path=' + encodeURIComponent(path) + '&scope=' + encodeURIComponent(scope));
      const preview = kind !== 'download' && info.size <= (['text','html'].includes(kind) ? 2e6 : (compact ? 8 : 24) * 1024 * 1024);
      if (preview && ['text','html'].includes(kind)) {
        const content = await get('/api/file/text?path=' + encodeURIComponent(path) + '&scope=' + encodeURIComponent(scope));
        if (current) {setText(content.text);setSavedText(content.text);}
      }
      if (current) setState({preview, htmlPreview:info.htmlPreview});
    })().catch(error => { if (current) setState({error: error.name === 'AbortError' ? 'Das Laden dauert zu lange. Bitte erneut versuchen.' : error.message}); })
      .finally(() => clearTimeout(timer));
    return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [path, attempt, kind, compact, scope]);
  useEffect(() => {
    if (!state.preview || kind === 'text' || (kind === 'html' && (source || !state.htmlPreview)) || (kind === 'pdf' && reading) || mediaReady) return;
    const timer = setTimeout(() => setState({error:'Die Vorschau lädt zu lange. Bitte erneut versuchen oder herunterladen.'}), 12000);
    return () => clearTimeout(timer);
  }, [state.preview, state.htmlPreview, source, kind, mediaReady, attempt]);
  const error = () => setState({error:'Die Vorschau konnte nicht geladen werden.'});
  if (state.loading) return <Skeleton variant={["image","video","pdf"].includes(kind)?"media":"document"} rows={compact?2:4} label="Datei wird geladen …"/>;
  if (state.error) return <div className="file-feedback" role="alert"><p>{state.error}</p><button onClick={() => setAttempt(n=>n+1)}>Erneut versuchen</button></div>;
  if (!state.preview) return <div className="file-feedback"><p>Diese Datei lässt sich herunterladen und in der passenden App öffnen.</p><a href={url+'&download=1'} download>Datei herunterladen</a></div>;
  if (kind === 'html') return <div className="html-file-content">
    <div className="html-file-actions" role="group" aria-label="HTML-Ansicht">
      <button type="button" aria-pressed={!source} onClick={()=>setSource(false)}>Vorschau</button>
      <button type="button" aria-pressed={source} onClick={()=>setSource(true)}>{readOnly?'Quelltext':'Bearbeiten'}</button>
      {onEnlarge && <button type="button" onClick={onEnlarge}>Vollbild</button>}
      <button type="button" disabled={saving || text!==savedText} onClick={()=>setAttempt(n=>n+1)}>Aktualisieren</button>
    </div>
    {text!==savedText && <p className="html-file-status" role="status">Ungespeicherte Änderungen. Die Vorschau zeigt den gespeicherten Stand.</p>}
    {source ? <>{readOnly ? <pre className="file-source" tabIndex={0} aria-label="HTML-Quelltext">{text}</pre> : <>
      <textarea className="file-editor" aria-label="HTML bearbeiten" value={text} onChange={e=>setText(e.target.value)}/>
      <button className="primary" disabled={saving || text===savedText} onClick={async()=>{setSaving(true);setSaveError('');try{await api('/file/save',{path,text});setSavedText(text);setRevision(n=>n+1);}catch(e){setSaveError(e.message);}finally{setSaving(false);}}}>{saving?'Speichert …':'Speichern'}</button>
      {saveError && <p role="alert">{saveError} Dein Entwurf bleibt erhalten.</p>}
    </>}</> : state.htmlPreview ? <div className="html-preview-surface">
      {!mediaReady && <Skeleton variant="document" label="HTML-Vorschau wird geladen …"/>}
      <HtmlPreview path={path} scope={scope} revision={revision+attempt} onLoad={()=>setMediaReady(true)} onError={error}/>
    </div> : <p role="status">Die HTML-Vorschau benötigt den neuen Serverstand. Nach dem Serverneustart „Aktualisieren“ wählen.</p>}
  </div>;
  if (kind === 'image') return <div className="file-media-loading" data-pending={!mediaReady}>{!mediaReady&&<Skeleton variant="media" rows={1} label="Vorschau wird geladen …"/>}<img className="file-image" src={url} alt={path.split('/').pop()} onError={error} onLoad={()=>setMediaReady(true)}/></div>;
  if (kind === 'pdf' && reading) return <PdfPreview key={url} url={url}/>;
  if (kind === 'pdf') return <div className="file-media-loading" data-pending={!mediaReady}>{!mediaReady&&<Skeleton variant="media" rows={1} label="Vorschau wird geladen …"/>}<iframe title={'PDF: '+path.split('/').pop()} src={url} onError={error} onLoad={()=>setMediaReady(true)}/></div>;
  if (kind === 'audio') return <div className="file-media-loading" data-pending={!mediaReady}>{!mediaReady&&<Skeleton variant="document" rows={1} label="Vorschau wird geladen …"/>}<audio controls preload="metadata" src={url} onError={error} onLoadedMetadata={()=>setMediaReady(true)}/></div>;
  if (kind === 'video') return <div className="file-media-loading" data-pending={!mediaReady}>{!mediaReady&&<Skeleton variant="media" rows={1} label="Vorschau wird geladen …"/>}<video controls preload="metadata" src={url} onError={error} onLoadedMetadata={()=>setMediaReady(true)}/></div>;
  if (readOnly && reading) return /\.(md|markdown)$/i.test(path)
    ? <article className="file-document" aria-label="Dokumentinhalt"><Markdown text={text}/></article>
    : <pre className="file-source" tabIndex={0} aria-label="Dateiinhalt">{text}</pre>;
  return <><textarea className="file-editor" aria-label="Dateiinhalt" value={text} readOnly={readOnly} onChange={e=>setText(e.target.value)}/>{!readOnly && <button className="primary" disabled={saving} onClick={async()=>{setSaving(true);setSaveError('');try {await api('/file/save',{path,text});}catch(e){setSaveError(e.message);}finally{setSaving(false);}}}>{saving?'Speichert …':'Speichern'}</button>}{saveError && <p role="alert">{saveError} Dein Entwurf bleibt erhalten.</p>}</>;
}
