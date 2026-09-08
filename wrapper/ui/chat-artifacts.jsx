import React, {useId, useMemo, useState} from 'react';
import {FileText, Download, ChevronDown} from './icons.jsx';
import {collectArtifacts, fileKind, diffLines} from './artifact-content.mjs';
import {FileContent} from './file-content.jsx';
import './chat-artifacts.css';


function Artifact({file, onFile, api}) {
  const [open, setOpen] = useState(fileKind(file.path) === 'image');
  return <div className="chat-artifact">
    <div className="artifact-row">
      <button className="artifact-open" onClick={()=>onFile(file.path)} title={file.path}><FileText size={16}/><span>{file.label}</span></button>
      {fileKind(file.path) !== 'download' && <button className="icon-button" aria-label={'Vorschau: '+file.label} title="Vorschau" aria-expanded={open} onClick={()=>setOpen(!open)}><ChevronDown size={16}/></button>}
      <a className="icon-button" aria-label={'Herunterladen: '+file.label} title="Herunterladen" href={'/api/file/raw?path='+encodeURIComponent(file.path)+'&download=1'} download><Download size={16}/></a>
    </div>
    {open && <div className="artifact-preview"><FileContent key={file.path} path={file.path} api={api} readOnly compact/></div>}
  </div>;
}

export function ChatArtifacts({items, workspace, directory, onFile, api}) {
  const files = useMemo(()=>collectArtifacts(items,workspace,directory),[items,workspace,directory]);
  const [all, setAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const filesId = useId();
  if (!files.length) return null;
  return <div className="chat-artifacts" role="group" aria-label="Dateien aus diesem Arbeitsschritt">
    <button className="artifact-toggle" aria-expanded={expanded} aria-controls={filesId} onClick={()=>setExpanded(!expanded)}><FileText size={16}/><span>{files.length === 1 ? '1 Datei' : `${files.length} Dateien`}</span><ChevronDown size={14}/></button>
    <div id={filesId} hidden={!expanded}>
      {expanded && <>
        {(all?files:files.slice(0,4)).map(file=><Artifact key={file.path} file={file} onFile={onFile} api={api}/>)}
        {files.length>4 && <button className="artifact-more" onClick={()=>setAll(!all)}>{all?'Weniger Dateien':`${files.length-4} weitere Dateien`}</button>}
      </>}
    </div>
  </div>;
}

export function DiffView({diff}) {
  const [expanded, setExpanded] = useState(false);
  const {lines,total} = diffLines(diff,expanded?2000:160);
  if (!diff) return <p className="muted">Für diese Änderung liegt kein Diff vor.</p>;
  return <div className="diff-view"><pre aria-label="Dateiänderungen">{lines.map((line,n)=><span className={'diff-line '+line.kind} key={n}>{line.text || ' '}{'\n'}</span>)}</pre>{total>lines.length && <button onClick={()=>setExpanded(true)} disabled={expanded}>{expanded?'Ausgabe auf 2.000 Zeilen begrenzt':`Weitere Änderungen anzeigen (${total} Zeilen)`}</button>}</div>;
}

export function ToolText({value}) {
  const [more, setMore] = useState(false);
  let text;
  try { text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); } catch { text = 'Diese Werkzeugausgabe konnte nicht dargestellt werden.'; }
  if (!text) return null;
  const limit = more ? 250000 : 12000;
  return <><pre>{text.slice(0,limit)}</pre>{text.length>limit && <button disabled={more} onClick={()=>setMore(true)}>{more?'Ausgabe begrenzt':'Mehr Ausgabe anzeigen'}</button>}</>;
}
