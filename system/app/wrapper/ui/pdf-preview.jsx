import React,{useEffect,useRef,useState} from 'react';
import {Skeleton} from './skeleton.tsx';
import {ChevronLeft,ChevronRight} from './icons.jsx';

let pdfModule;
async function pdfLibrary(){
  if(!pdfModule) pdfModule=Promise.all([import('pdfjs-dist/build/pdf.mjs'),import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([pdf,worker])=>{pdf.GlobalWorkerOptions.workerSrc=worker.default;return pdf;});
  return pdfModule;
}
export function PdfPreview({url,thumbnail=false,onFailure}) {
  const canvas=useRef(null),[page,setPage]=useState(1),[count,setCount]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(true),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let stopped=false,task,render;
    setBusy(true);setError('');
    const timer=setTimeout(()=>{if(!stopped){setError('Die PDF-Vorschau konnte nicht geladen werden.');setBusy(false);stopped=true;onFailure?.();void task?.destroy();}},15000);
    (async()=>{
      const pdf=await pdfLibrary();if(stopped)return;
      task=pdf.getDocument({url,isEvalSupported:false,disableAutoFetch:true,disableStream:true});
      const document=await task.promise;if(stopped)return;
      setCount(document.numPages);
      const sheet=await document.getPage(Math.min(page,document.numPages));if(stopped)return;
      const natural=sheet.getViewport({scale:1});
      const viewport=sheet.getViewport({scale:(thumbnail?240:1200)/Math.max(natural.width,natural.height)});
      canvas.current.width=Math.ceil(viewport.width);canvas.current.height=Math.ceil(viewport.height);
      render=sheet.render({canvas:canvas.current,canvasContext:canvas.current.getContext('2d'),viewport});
      await render.promise;if(!stopped)setBusy(false);
    })().catch(()=>{if(!stopped){setError('Die PDF-Vorschau konnte nicht geladen werden.');setBusy(false);onFailure?.();}}).finally(()=>{clearTimeout(timer);void task?.destroy();});
    return()=>{stopped=true;clearTimeout(timer);render?.cancel();void task?.destroy();};
  },[url,page,thumbnail,attempt]);
  return <div className={thumbnail?'pdf-thumbnail':'pdf-document'}>
    {!thumbnail&&<div className="pdf-navigation"><button className="icon-button" aria-label="Vorherige PDF-Seite" disabled={busy||page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><span>{count?`${page} / ${count}`:'PDF'}</span><button className="icon-button" aria-label="Nächste PDF-Seite" disabled={busy||page>=count} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div>}
    {busy&&!thumbnail&&<Skeleton variant="document" rows={2} label="PDF wird geladen …"/>}
    {error&&!thumbnail&&<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Erneut versuchen</button><a href={url+'&download=1'} download>Herunterladen</a></div>}
    <canvas ref={canvas} hidden={busy||!!error} role="img" aria-label={thumbnail?'Erste PDF-Seite':`PDF-Seite ${page}`}/>
  </div>;
}
