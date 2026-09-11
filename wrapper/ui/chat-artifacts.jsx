import React, {useId, useMemo, useState} from 'react';
import {FileText, Download, ChevronDown} from './icons.jsx';
import {collectChatArtifacts, fileKind, diffLines} from './artifact-content.mjs';
import {FileContent} from './file-content.jsx';
import './chat-artifacts.css';
import {changeStats} from './activity-detail.mjs';
import {generatedImageItems} from './tool-content.mjs';
import {ToolImages, Markdown} from './chat-rich-content.jsx';

export function DiffStats({changes, status, stats:providedStats}) {
  const stats = providedStats || changeStats(changes);
  if (!stats) return null;
  const confirmed = status === 'completed';
  const label = `${confirmed ? 'Änderungsumfang' : 'Übermittelter, nicht bestätigter Änderungsumfang'}: ${stats.added} Zeilen hinzugefügt, ${stats.removed} entfernt${stats.partial ? ', nur vorhandene Diffs' : ''}`;
  return <span className="diff-stats" data-confirmed={confirmed ? 'true' : 'false'} title={label}>
    <span className="sr-only">{label}</span>
    <span className="diff-stat-added" aria-hidden="true">+{stats.added}</span>
    <span className="diff-stat-removed" aria-hidden="true">−{stats.removed}</span>
    {stats.partial && <span aria-hidden="true">· teilweise</span>}
  </span>;
}


function Artifact({file, onFile, api}) {
  const image = fileKind(file.path) === 'image';
  const [open, setOpen] = useState(false);
  return <div className={'chat-artifact' + (image ? ' chat-artifact-image' : '')}>
    {image && <div className="artifact-preview"><FileContent key={file.path} path={file.path} api={api} readOnly compact/></div>}
    <div className="artifact-row">
      <button className="artifact-open" onClick={()=>onFile(file.path)} title={file.path}><FileText size={16}/><span>{file.label}</span></button>
      {!image && fileKind(file.path) !== 'download' && <button className="icon-button" aria-label={'Vorschau: '+file.label} title="Vorschau" aria-expanded={open} onClick={()=>setOpen(!open)}><ChevronDown size={16}/></button>}
      <a className="icon-button" aria-label={'Herunterladen: '+file.label} title="Herunterladen" href={'/api/file/raw?path='+encodeURIComponent(file.path)+'&download=1'} download><Download size={16}/></a>
    </div>
    {open && <div className="artifact-preview"><FileContent key={file.path} path={file.path} api={api} readOnly reading compact/></div>}
  </div>;
}

export function ChatArtifacts({items, workspace, directory, onFile, api}) {
  const files = useMemo(()=>collectChatArtifacts(items,workspace,directory),[items,workspace,directory]);
  const generated = useMemo(()=>generatedImageItems(items),[items]);
  const images = files.filter(file=>fileKind(file.path) === 'image');
  const documents = files.filter(file=>fileKind(file.path) !== 'image');
  const [all, setAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [allImages, setAllImages] = useState(false);
  const filesId = useId();
  if (!files.length && !generated.length) return null;
  return <div className="chat-artifacts" role="group" aria-label="Ergebnisse dieser Antwort">
    {generated.map((item,index)=><ToolImages key={item.id || index} item={item} generated/>)}
    {!!images.length && <div className="artifact-images" aria-label="Erstellte Bilder">
      {(allImages ? images : images.slice(0,4)).map(file=><Artifact key={file.path} file={file} onFile={onFile} api={api}/>)}
      {images.length>4 && <button className="artifact-more" aria-expanded={allImages} onClick={()=>setAllImages(!allImages)}>{allImages?'Weniger Bilder':`${images.length-4} weitere Bilder`}</button>}
    </div>}
    {!!documents.length && <>
      <button className="artifact-toggle" aria-expanded={expanded} aria-controls={filesId} onClick={()=>setExpanded(!expanded)}><FileText size={16}/><span>{documents.length === 1 ? '1 Ergebnis' : `${documents.length} Ergebnisse`}</span><ChevronDown size={14}/></button>
      <div id={filesId} hidden={!expanded}>
        {expanded && <>
          {(all?documents:documents.slice(0,4)).map(file=><Artifact key={file.path} file={file} onFile={onFile} api={api}/>)}
          {documents.length>4 && <button className="artifact-more" onClick={()=>setAll(!all)}>{all?'Weniger Ergebnisse':`${documents.length-4} weitere Ergebnisse`}</button>}
        </>}
      </div>
    </>}
  </div>;
}

export function ChatArtifactsPreview() {
  const [selected,setSelected] = useState('');
  const items = [{type:'fileChange',status:'completed',changes:[{path:'output/Projektplan.docx'},{path:'output/Übersicht.xlsx'},{path:'output/component.tsx'}]}];
  return <div className="artifact-example">
    <ChatArtifacts items={items} workspace="/example" directory="/example" onFile={path=>setSelected(path.split('/').pop())}/>
    {selected && <p className="muted" role="status">Beispielauswahl: {selected}</p>}
    <Markdown text={'```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100"><rect width="360" height="100" rx="12" fill="Canvas"/><g fill="CanvasText" text-anchor="middle"><text x="180" y="26">Beispiel: Hauptagent</text><text x="80" y="82">Marketing</text><text x="280" y="82">Angebote</text></g><path d="M180 34v18H80v14m100-14h100v14" fill="none" stroke="CanvasText"/></svg>\n```'}/>
  </div>;
}

export function DiffView({diff}) {
  const [expanded, setExpanded] = useState(false);
  const {lines,total} = diffLines(diff,expanded?2000:160);
  if (!diff) return <p className="muted">Für diese Änderung liegt kein Diff vor.</p>;
  return <div className="diff-view"><pre aria-label="Dateiänderungen">{lines.map((line,n)=><span className={'diff-line '+line.kind} key={n}>{line.text || ' '}</span>)}</pre>{total>lines.length && <button onClick={()=>setExpanded(true)} disabled={expanded}>{expanded?'Ausgabe auf 2.000 Zeilen begrenzt':`Weitere Änderungen anzeigen (${total} Zeilen)`}</button>}</div>;
}

export function ToolText({value}) {
  const [more, setMore] = useState(false);
  let text;
  try { text = typeof value === 'string' ? value : JSON.stringify(value, null, 2); } catch { text = 'Diese Werkzeugausgabe konnte nicht dargestellt werden.'; }
  if (!text) return null;
  const limit = more ? 250000 : 12000;
  return <><pre>{text.slice(0,limit)}</pre>{text.length>limit && <button disabled={more} onClick={()=>setMore(true)}>{more?'Ausgabe begrenzt':'Mehr Ausgabe anzeigen'}</button>}</>;
}
