import React, {useMemo, useState, useRef, useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
import {CopyButton} from './copy-button';
import DOMPurify from 'dompurify';
import {chatMarkup} from './chat-rich-content.mjs';
import {localFilePath} from './artifact-content.mjs';
import {toolImages, isComputerTool} from './tool-content.mjs';
import {Modal} from './modal.jsx';
import './chat-rich-content.css';

// Retain focus, text selection and table position when the surrounding chat updates.
const Markup = React.memo(function Markup({html}) {
  return <div dangerouslySetInnerHTML={{__html:html}}/>;
});
export function Markdown({text = '', onFile, workspace = '', directory = workspace}) {
  const root = useRef(null);
  const [copyTargets, setCopyTargets] = useState([]);
  const html = useMemo(()=>DOMPurify.sanitize(chatMarkup(text,workspace,directory)),[text,workspace,directory]);
  useLayoutEffect(() => {
    setCopyTargets([...root.current.querySelectorAll('[data-copy-code]')].map(node => ({
      node, text: node.closest('.chat-code').querySelector('pre code').textContent.replace(/\n$/, ''),
    })));
  }, [html]);
  return <div ref={root} className="markdown" onClick={e=>{
    const a=e.target.closest('a'); if (!a) return;
    const href=a.getAttribute('href'), local=localFilePath(href,workspace,directory);
    if (local && onFile) {e.preventDefault();onFile(local);}
    else if (/^https?:/i.test(href)) {e.preventDefault();window.open(href,'_blank','noopener,noreferrer');}
  }}><Markup html={html}/>{copyTargets.map(({node, text}, index) => createPortal(<CopyButton text={text} label="Code kopieren" />, node, String(index)))}</div>;
}
function ToolImage({block,index,generated}) {
  const [failed,setFailed]=useState(false);
  const [open,setOpen]=useState(false);
  const url=`data:${block.mimeType};base64,${block.data}`;
  const label=generated ? `Erzeugtes Bild ${index+1}` : `Aufnahme ${index+1}`;
  const download=<a href={url} download={`${generated?'bild':'aufnahme'}-${index+1}.${block.mimeType.split('/')[1]}`} aria-label={`${label} herunterladen`}>Herunterladen</a>;
  if (!generated) return failed ? <p role="status">Bild konnte nicht angezeigt werden.</p> : <a href={url} download={`aufnahme-${index+1}.${block.mimeType.split('/')[1]}`} aria-label={`${label} herunterladen`}><img loading="lazy" src={url} alt={`${label} aus dem Werkzeug`} onError={()=>setFailed(true)}/></a>;
  return <div className="generated-image-result">
    {failed ? <div className="file-feedback" role="alert"><p>Bild konnte nicht angezeigt werden.</p><button type="button" onClick={()=>setFailed(false)}>Erneut versuchen</button></div> : <button type="button" className="generated-image-open" aria-label={`${label} vergrößern`} onClick={()=>setOpen(true)}><img loading="lazy" src={url} alt={label} onError={()=>setFailed(true)}/></button>}
    <div className="generated-image-actions">{download}</div>
    {open && <Modal wide className="generated-image-modal" title={label} onClose={()=>setOpen(false)}><img src={url} alt={label}/>{download}</Modal>}
  </div>;
}
export function ToolImages({item,generated = false}) {
  const images=useMemo(()=>toolImages(item),[item]);
  if (!images.length) return null;
  return <div className="tool-images" aria-label={generated?'Erzeugte Bilder':isComputerTool(item)?'Bildschirmaufnahmen':'Werkzeugbilder'}>{images.map((block,n)=><ToolImage key={n} block={block} index={n} generated={generated}/>)}</div>;
}
