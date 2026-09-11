import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Maximize,Minimize,Play,Square} from './icons.jsx';
import {IconButton} from './icon-button';
import {presentationProtocol,presentationState} from '../html-presentation.mjs';
import './html-preview.css';

type Props={path:string;scope?:string;revision?:number;onLoad?:()=>void;onError?:()=>void};
type Deck={count:number;index:number;presenting:boolean};
export function HtmlPreview({path,scope='workspace',revision=0,onLoad,onError}:Props) {
  const root=useRef<HTMLElement>(null),frame=useRef<HTMLIFrameElement>(null),wasFullscreen=useRef(false);
  const [deck,setDeck]=useState<Deck|null>(null),[fullscreen,setFullscreen]=useState(false),[error,setError]=useState('');
  const channel=useMemo(()=>crypto.randomUUID(),[path,scope,revision]);
  const query=new URLSearchParams({path,scope,revision:String(revision),presentation:channel});
  const send=useCallback((message:Record<string,unknown>)=>frame.current?.contentWindow?.postMessage({protocol:presentationProtocol,channel,...message},'*'),[channel]);
  useEffect(()=>{setDeck(null);setError('');},[channel]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow || event.origin!=='null')return;
      const state=presentationState(event.data,channel);
      if(state){setDeck(state);return;}
      if(event.data?.protocol===presentationProtocol && event.data.channel===channel && event.data.type==='exit'){
        if(document.fullscreenElement===root.current)void document.exitFullscreen().catch(()=>setError('Vollbild konnte nicht beendet werden. Bitte Escape drücken.'));
      }
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[channel]);
  useEffect(()=>{
    const changed=()=>{
      const active=document.fullscreenElement===root.current;
      setFullscreen(active);
      if(wasFullscreen.current && !active){send({type:'mode',presenting:false});root.current?.querySelector<HTMLButtonElement>('[data-fullscreen]')?.focus({preventScroll:true});}
      wasFullscreen.current=active;
    };
    document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);
  },[send]);
  const toggleFullscreen=async()=>{
    setError('');
    try{
      if(document.fullscreenElement===root.current)await document.exitFullscreen();
      else if(root.current?.requestFullscreen){await root.current.requestFullscreen();root.current.focus({preventScroll:true});}
      else setError('Dein Browser unterstützt hier kein Vollbild.');
    }catch{setError('Dein Browser erlaubt hier kein Vollbild. Die Vorschau bleibt geöffnet.');}
  };
  const navigate=(action:string)=>send({type:'navigate',action});
  return <section ref={root} tabIndex={-1} className="html-presentation" data-capability="workspace.html-presentation" data-presenting={deck?.presenting||undefined} aria-label={'HTML: '+path.split('/').pop()} onKeyDown={event=>{
    if(!deck?.presenting || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))return;
    if(event.key==='Escape'){event.stopPropagation();send({type:'mode',presenting:false});return;}
    const action=({ArrowRight:'next',PageDown:'next',ArrowLeft:'previous',PageUp:'previous',Home:'first',End:'last'} as Record<string,string>)[event.key];
    if(action && deck.count){event.preventDefault();event.stopPropagation();navigate(action);}
  }}>
    <div className="html-presentation-toolbar">
      <span className="html-presentation-title" title={path.split('/').pop()}>{path.split('/').pop()}</span>
      <div className="html-presentation-actions">
        {deck&&<IconButton label={deck.presenting?'Präsentation beenden':'Präsentieren'} active={deck.presenting} onClick={()=>send({type:'mode',presenting:!deck.presenting})}>{deck.presenting?<Square size={16}/>:<Play size={16}/>}</IconButton>}
        <IconButton data-fullscreen label={fullscreen?'Vollbild verlassen':'Vollbild'} active={fullscreen} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={16}/>:<Maximize size={16}/>}</IconButton>
      </div>
    </div>
    {error&&<p className="html-file-status" role="status">{error}</p>}
    <iframe ref={frame} className="html-document-preview" title={'HTML-Vorschau: '+path.split('/').pop()}
      src={'/api/file/preview?'+query} sandbox="allow-scripts" referrerPolicy="no-referrer"
      onLoad={()=>{send({type:'hello'});onLoad?.();}} onError={onError}/>
    {deck?.presenting&&deck.count>0&&<nav className="html-presentation-navigation" aria-label="Foliensteuerung">
      <IconButton label="Vorherige Folie" disabled={deck.index===0} onClick={()=>navigate('previous')}><ChevronLeft size={16}/></IconButton>
      <span role="status" aria-live="polite" aria-atomic="true">{deck.index+1} / {deck.count}</span>
      <IconButton label="Nächste Folie" disabled={deck.index===deck.count-1} onClick={()=>navigate('next')}><ChevronRight size={16}/></IconButton>
    </nav>}
  </section>;
}
