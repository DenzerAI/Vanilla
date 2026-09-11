import React from 'react';
import {spokenText} from './speech-playback.mjs';
import {chatAudio} from './chat-audio.mjs';
import {useChatAudio} from './chat-audio';
import {Volume2, Square, LoaderCircle} from './icons.jsx';
type Props = {text:string;chatId:string;messageId:string;disabled?:boolean;api:(url:string,data?:unknown)=>Promise<any>;Button:React.ElementType};
export function MessageSpeech({text,chatId,messageId,disabled,api,Button}:Props) {
  const state=useChatAudio();
  const active=state.chatId===chatId&&state.key===messageId;
  const Icon=active?(state.status==='loading'?LoaderCircle:Square):Volume2;
  return <Button label={active?'Vorlesen stoppen':'Antwort vorlesen'} active={active} aria-pressed={active} disabled={!active&&(disabled||!spokenText(text))} onClick={()=>active?chatAudio.stop():void chatAudio.start(api,{chatId,title:'Antwort',key:messageId,text}).catch(error=>chatAudio.fail(error))} data-capability="chat.message.read-aloud"><Icon size={15} strokeWidth={1.55}/></Button>;
}
