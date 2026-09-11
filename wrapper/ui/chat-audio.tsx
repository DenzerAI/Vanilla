import React, {useEffect, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {chatAudio} from './chat-audio.mjs';
import {createEventSubscription} from './chat-events.mjs';
import {Pause, Play, Square, Volume2} from './icons.jsx';
import './chat-audio.css';
export const useChatAudio=()=>useSyncExternalStore(chatAudio.subscribe,chatAudio.snapshot);
export function ChatAudioButton({Button,chatId}:{Button:React.ElementType;chatId?:string}) {
  const state=useChatAudio();
  if(!state.chatId || chatId && state.chatId!==chatId) return null;
  const paused=state.status==='paused';
  const Icon=paused?Play:state.status==='waiting'?Volume2:Pause;
  return <Button label={`${paused?'Vorlesen fortsetzen':'Vorlesen pausieren'}: ${state.title}`} active onClick={()=>paused?void chatAudio.resume():chatAudio.pause()}><Icon size={16}/></Button>;
}
export function ChatAudioControls({Button}:{Button:React.ElementType}) {
  const state=useChatAudio();
  useEffect(()=>{
    const events=createEventSubscription();
    events.onmessage=({data})=>{try{chatAudio.event(JSON.parse(data));}catch{/* malformed event */}};
    return()=>{events.close();chatAudio.stop();};
  },[]);
  if(!state.chatId&&!state.error) return null;
  return createPortal(<div className="chat-audio-controls" role="group" aria-label="Wiedergabe" data-capability="chat.audio.control">
    {state.chatId&&<><ChatAudioButton Button={Button}/><Button label="Vorlesen ausschalten" onClick={chatAudio.stop}><Square size={15}/></Button></>}
    {state.error&&<button className="inline-error" onClick={chatAudio.stop} role="alert">{state.error}</button>}
  </div>,document.body);
}
