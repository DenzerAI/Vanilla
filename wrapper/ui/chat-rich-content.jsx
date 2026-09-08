import React, {useMemo, useState} from 'react';
import DOMPurify from 'dompurify';
import {chatMarkup} from './chat-rich-content.mjs';
import {localFilePath} from './artifact-content.mjs';
import {toolImages, isComputerTool} from './tool-content.mjs';
import './chat-rich-content.css';

// Retain focus, text selection and table position when the surrounding chat updates.
const Markup = React.memo(function Markup({html}) {
  return <div dangerouslySetInnerHTML={{__html:html}}/>;
});
export function Markdown({text = '', onFile, workspace = '', directory = workspace}) {
  const [notice,setNotice] = useState('');
  const html = useMemo(()=>DOMPurify.sanitize(chatMarkup(text,workspace,directory)),[text,workspace,directory]);
  return <div className="markdown" onClick={async e=>{
    const button = e.target.closest('[data-copy-code]');
    if (button) {
      try { await navigator.clipboard.writeText(button.closest('.chat-code').querySelector('pre code').textContent.replace(/\n$/,'')); setNotice('Code kopiert'); }
      catch { setNotice('Kopieren nicht möglich. Code markieren und kopieren.'); }
      return;
    }
    const a=e.target.closest('a'); if (!a) return;
    const href=a.getAttribute('href'), local=localFilePath(href,workspace,directory);
    if (local && onFile) {e.preventDefault();onFile(local);}
    else if (/^https?:/i.test(href)) {e.preventDefault();window.open(href,'_blank','noopener,noreferrer');}
  }}><Markup html={html}/>{notice && <span className="copy-notice" role="status">{notice}</span>}</div>;
}
function ToolImage({block,index}) {
  const [failed,setFailed]=useState(false);
  return failed ? <p role="status">Bild konnte nicht angezeigt werden.</p> : <a href={`data:${block.mimeType};base64,${block.data}`} download={`aufnahme-${index+1}.${block.mimeType.split('/')[1]}`} aria-label={`Aufnahme ${index+1} herunterladen`}><img loading="lazy" src={`data:${block.mimeType};base64,${block.data}`} alt={`Aufnahme ${index+1} aus dem Werkzeug`} onError={()=>setFailed(true)}/></a>;
}
export function ToolImages({item}) {
  const images=useMemo(()=>toolImages(item),[item]);
  if (!images.length) return null;
  return <div className="tool-images" aria-label={isComputerTool(item)?'Bildschirmaufnahmen':'Werkzeugbilder'}>{images.map((block,n)=><ToolImage key={n} block={block} index={n}/>)}</div>;
}
