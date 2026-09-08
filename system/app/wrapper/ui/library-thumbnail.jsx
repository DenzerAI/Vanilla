import React,{useEffect,useRef,useState} from 'react';
import {FileText,Image,Volume2} from './icons.jsx';
import {PdfPreview} from './pdf-preview.jsx';

export function LibraryThumbnail({entry}) {
  const holder=useRef(null),[visible,setVisible]=useState(false),[failed,setFailed]=useState(false),[text,setText]=useState('');
  const url='/api/file/raw?path='+encodeURIComponent(entry.path)+'&scope='+encodeURIComponent(entry.scope||'workspace');
  const format=(entry.name.split('.').pop()||'Datei').slice(0,8).toUpperCase();
  useEffect(()=>{
    const observer=new IntersectionObserver(items=>{if(items.some(item=>item.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'80px'});
    observer.observe(holder.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible||entry.kind!=='text'||entry.missing||entry.size>2e6)return;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    fetch('/api/file/text?path='+encodeURIComponent(entry.path)+'&scope='+encodeURIComponent(entry.scope||'workspace'),{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error();return response.json();}).then(data=>setText(data.text.slice(0,1400))).catch(()=>{if(!controller.signal.aborted)setFailed(true);}).finally(()=>clearTimeout(timer));
    return()=>{controller.abort();clearTimeout(timer);};
  },[visible,entry.path,entry.scope,entry.kind]);
  const preview=visible&&!failed&&!entry.missing;
  return <span ref={holder} className={'library-thumbnail library-thumbnail-'+entry.kind} aria-hidden="true">
    {preview&&entry.kind==='image'?<img src={url} alt="" loading="lazy" onError={()=>setFailed(true)}/>:
    preview&&entry.kind==='pdf'&&entry.size<=24*1024*1024?<PdfPreview url={url} thumbnail onFailure={()=>setFailed(true)}/>:
    preview&&entry.kind==='video'?<video src={url+'#t=0.1'} muted playsInline preload="metadata" onError={()=>setFailed(true)}/>:
    preview&&text?<span className="library-document-mini"><span className="library-document-excerpt">{text}</span><span className="library-format">{format}</span></span>:
    <span className="library-format-icon">{entry.kind==='audio'?<Volume2 size={24}/>:entry.kind==='image'?<Image size={24}/>:<FileText size={24}/>}<span className="library-format">{format}</span></span>}
  </span>;
}
