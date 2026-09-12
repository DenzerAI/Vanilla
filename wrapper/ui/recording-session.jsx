import React, {createContext,useContext,useState,useRef,useId,useLayoutEffect,useEffect,useImperativeHandle,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {subscribeSync} from './dictation-storage.mjs';
import {privacyEvent} from './chat-privacy-client.mjs';
import {createRecordingSession} from './recording-session.mjs';
import {Dictation} from './dictation.jsx';
import {Mic,Pause,Play,Square} from './icons.jsx';
import {IconButton} from './icon-button';
import {useDictationShortcut} from './dictation-shortcut-settings.jsx';
import {bindDictationShortcut,shortcutCode} from './dictation-shortcut.mjs';
import './recording-session.css';

const RecordingContext=createContext(null);
export function RecordingProvider({children,api}) {
  const [store]=useState(createRecordingSession);
  useEffect(()=>subscribeSync(api),[api]);
  const control=useRef(null);
  useEffect(()=>{
    const changed=({detail})=>{
      if(detail.locked && store.restrict(detail.id)) {
        if(control.current)control.current.cancel();else store.done();
      }
    };
    window.addEventListener(privacyEvent,changed);
    return()=>window.removeEventListener(privacyEvent,changed);
  },[store]);
  const [value]=useState(()=>({store,control}));
  return <RecordingContext.Provider value={value}>{children}<RecordingHost store={store} control={control}/></RecordingContext.Provider>;
}

function RecordingHost({store,control}) {
  const state=useSyncExternalStore(store.subscribe,store.snapshot);
  const source=state.source;
  const anchor=source && [...store.anchors.values()].find(item=>item.key===source.key && item.visible);
  const floating=!!source && !anchor;
  const departure=useRef(0),checkpoint=departure.current;
  useLayoutEffect(()=>{if(floating)departure.current++;},[floating]);
  const capsule=useRef(null);
  useLayoutEffect(()=>{
    if(!floating)return;
    const measure=()=>document.documentElement.style.setProperty('--recording-notice-offset',`${capsule.current?.getBoundingClientRect().height+8 || 0}px`);
    measure();const observer=new ResizeObserver(measure);if(capsule.current)observer.observe(capsule.current);
    return()=>{observer.disconnect();document.documentElement.style.removeProperty('--recording-notice-offset');};
  },[floating]);
  if(!source)return null;
  const renderSurface=content=>createPortal(floating ? <div ref={capsule} className="recording-capsule" role="group" aria-label={state.phase==='paused'?'Pausierte Aufnahme':'Laufende Aufnahme'} data-capability="chat.dictation.persistent" data-phase={state.phase}>
    <IconButton className="recording-origin" label={`Zum ursprünglichen Entwurf: ${source.title}`} data-icon-motion="off" onClick={source.onReturn}><Mic size={16}/></IconButton>{content}
  </div> : content,anchor?.node || document.body);
  return <Dictation {...source.props} autoStart controlRef={control} onDone={()=>store.done()} onPhaseChange={phase=>store.phase(phase)}
    floating={floating} renderSurface={renderSurface} onText={text=>{
      source.props.onText(text);
      if(![...store.anchors.values()].some(item=>item.key===source.key && item.visible))source.props.notify('Diktat liegt im ursprünglichen Entwurf.');
    }} canSend={()=>{
      const current=[...store.anchors.values()].find(item=>item.key===source.key && item.visible);
      return checkpoint===departure.current && !!current && current.props.current.canSend();
    }} running={anchor?.props.current.running || false} onSendText={text=>{
      const current=[...store.anchors.values()].find(item=>item.key===source.key && item.visible);
      return current?.props.current.onSendText(text);
    }}/>
}

export function DictationComposer({sourceKey,title,visible,onReturn,controlRef,...props}) {
  const {store,control}=useContext(RecordingContext);
  const state=useSyncExternalStore(store.subscribe,store.snapshot);
  const id=useId(),node=useRef(null),latest=useRef(null);
  latest.current={...props,sourceKey,title,onReturn,visible};
  const shortcut=useDictationShortcut();
  const owns=state.source?.key===sourceKey;
  useLayoutEffect(()=>store.register(id,{key:sourceKey,node:node.current,visible,props:latest}),[store,id,sourceKey,visible,props.running]);
  const actions=useRef(null);
  actions.current={
    available:()=>latest.current.shortcutEnabled && !document.hidden && document.hasFocus() && !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'),
    phase:()=>store.snapshot().source?.key===latest.current.sourceKey ? store.snapshot().phase : store.snapshot().source?'waiting':'idle',
    start:()=>{const p=latest.current;store.start({key:p.sourceKey,title:p.title,onReturn:p.onReturn,props:{...p,enabled:true,shortcutEnabled:false}});},
    finish:()=>{if(store.snapshot().source?.key===latest.current.sourceKey)control.current?.finish();},
    cancelPending:()=>{if(store.snapshot().source?.key===latest.current.sourceKey){if(control.current)control.current.cancel();else store.done();}},
  };
  useImperativeHandle(controlRef,()=>({
    toggle(){
      if(!actions.current.available())return;
      if(!store.snapshot().source)actions.current.start();
      else if(store.snapshot().source.key===latest.current.sourceKey)control.current?.finish(true);
    },
    cancel(){return store.snapshot().source?.key===latest.current.sourceKey ? control.current?.cancel() || false : false;},
  }));
  useEffect(()=>{
    if(!props.shortcutEnabled)return;
    const invoke=name=>(...args)=>actions.current[name](...args);
    return bindDictationShortcut(window,{key:shortcutCode(shortcut.key,navigator.platform),mode:shortcut.mode,
      available:invoke('available'),phase:()=>store.snapshot().source?.key===sourceKey?store.snapshot().phase:store.snapshot().source?'waiting':'idle',start:invoke('start'),
      finish:()=>{if(store.snapshot().source?.key===sourceKey)control.current?.finish();},
      cancelPending:()=>{if(store.snapshot().source?.key===sourceKey){if(control.current)control.current.cancel();else store.done();}}});
  },[shortcut.key,shortcut.mode,props.shortcutEnabled,sourceKey]);
  return <div className="dictation-anchor" ref={node}>
    {!owns && <IconButton label={state.source?'Eine Aufnahme läuft bereits':'Diktieren'} disabled={!!state.source} onClick={()=>actions.current.start()}><Mic size={18}/></IconButton>}
  </div>;
}

function RecordingMark({phase}) {
  const label=phase==='recording'?'Aufnahme läuft':phase==='paused'?'Aufnahme pausiert':'Diktat wird vorbereitet';
  return <span className="recording-mark" data-phase={phase} data-icon-motion="off" role="img" aria-label={label} title={label}>
    {phase==='paused'?<Pause size={12}/>:<span className="recording-symbol" aria-hidden="true"/>}
  </span>;
}

export function RecordingIndicator({chatId,paneNumber}) {
  const {store}=useContext(RecordingContext);
  const state=useSyncExternalStore(store.subscribe,store.snapshot);
  if(!state.source || state.source.props.chatId!==chatId || paneNumber!==undefined && state.source.props.paneNumber!==paneNumber)return null;
  return <RecordingMark phase={state.phase}/>;
}

export function RecordingPreview() {
  const [paused,setPaused]=useState(false),[stopped,setStopped]=useState(false);
  const phase=stopped?'idle':paused?'paused':'recording';
  return <div className="recording-example">
    <div className="row"><span>Projektplanung</span>{!stopped&&<RecordingMark phase={phase}/>}</div>
    <div className="recording-capsule recording-preview" data-phase={phase} role="group" aria-label="Aufnahmepille-Beispiel">
      <IconButton className="recording-origin" label="Zum Entwurf · Beispiel zurücksetzen" data-icon-motion="off" onClick={()=>{setStopped(false);setPaused(false);}}><Mic size={16}/></IconButton>
      <div className="voice-strip" data-capturing={!stopped}><span className="voice-phase" role="status">{stopped?'Im Entwurf':paused?'Pausiert':'Diktat'}</span><span className="voice-time">1:24</span>
        <IconButton label={paused?'Fortsetzen':'Pause'} disabled={stopped} onClick={()=>setPaused(!paused)}>{paused?<Play size={18}/>:<Pause size={18}/>}</IconButton>
        <IconButton label="Aufnahme beenden und in Entwurf übernehmen" disabled={stopped} onClick={()=>setStopped(true)}><Square size={18}/></IconButton>
      </div>
    </div>
  </div>;
}
