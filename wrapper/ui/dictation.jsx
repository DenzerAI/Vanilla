import {useDictationShortcut} from './dictation-shortcut-settings.jsx';
import {bindDictationShortcut,shortcutCode} from './dictation-shortcut.mjs';
import React, {useState,useRef,useEffect,useImperativeHandle} from 'react';
import {Mic,ArrowUp,Pause,Play,Trash2,Check,X,Square,Volume2,Download} from './icons.jsx';
import {write,sync,all,downloadLocal,subscribeSync} from './dictation-storage.mjs';
import {microphone,microphoneError} from './dictation-audio.mjs';
import {SpeechPlayback} from './speech-playback.mjs';
import {VoiceWave,VoiceStatus} from './voice-visual';
import {voiceWaveGeometry} from './design-system.mjs';
import './dictation.css';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function Dictation({api,notify,onText,onVoiceText,onSendText,chatId,reply,running=false,enabled=true,shortcutEnabled=false,controlRef,openSettings}) {
  const shortcut=useDictationShortcut();
  const shortcutState=useRef(null),shortcutBinding=useRef(null),paneOwned=useRef(false);
  const [awaitingId,setAwaitingId]=useState(null);
  const [phase,setPhase]=useState('idle'),[seconds,setSeconds]=useState(0),[levels,setLevels]=useState(Array(voiceWaveGeometry.samples).fill(0)),[sessionActive,setSessionActive]=useState(false),[output,setOutput]=useState('idle'),[issue,setIssue]=useState('');
  const current=useRef(null),mounted=useRef(true),stopRef=useRef(null),startRef=useRef(null),generation=useRef(0),session=useRef(null),playback=useRef(null),latest=useRef({reply,chatId});latest.current={reply,chatId,onSendText,onText,running};
  if(!playback.current)playback.current=new SpeechPlayback(api,s=>{if(mounted.current)setOutput(s);});
  const phaseRef=useRef(phase);phaseRef.current=phase;
  function report(e){if(mounted.current){setIssue(e.message);notify(e.message);}}
  useEffect(()=>{
    mounted.current=true;
    const unsubscribeSync=subscribeSync(api);
    const before=e=>{if(current.current){e.preventDefault();e.returnValue='';}};
    const hidden=()=>{if(document.hidden && current.current){current.current.node.port.postMessage('pause');setPhase('paused');}};
    window.addEventListener('beforeunload',before);document.addEventListener('visibilitychange',hidden);
    return()=>{mounted.current=false;generation.current++;session.current=null;unsubscribeSync();window.removeEventListener('beforeunload',before);document.removeEventListener('visibilitychange',hidden);void stopRef.current?.(false,false);void playback.current.close();};
  },[]);
  useEffect(()=>{
    const s=session.current;
    if(s && !s.sending && s.chatId!==chatId){void end();}
    else if(!s && phaseRef.current!=='idle'){generation.current++;void stopRef.current?.(false,false);setPhase('idle');}
  },[chatId]);
  useEffect(()=>{
    const s=session.current;
    if(!s?.waiting || !reply || reply.id===s.lastReply || reply.chatId!==s.chatId)return;
    s.waiting=false;s.lastReply=reply.id;
    if(reply.status!=='completed'){setPhase('idle');setIssue('Antwort unterbrochen. Du kannst erneut sprechen.');return;}
    setPhase('idle');
    void playback.current.speak(reply.text).then(async complete=>{
      if(complete && session.current===s && s.auto && mounted.current && !document.hidden) await startRef.current?.();
    }).catch(report);
  },[reply?.id,reply?.status,reply?.text,awaitingId]);
  useEffect(()=>{if(!enabled)void end();},[enabled]);
  async function beginConversation(){
    if(running)return;
    try {
      await playback.current.unlock();
      const settings=await api('/speech/status');
      session.current={auto:settings.autoMode,chatId,lastReply:reply?.id,sending:false,waiting:false};
      setSessionActive(true);await start();
    }catch(e){session.current=null;setSessionActive(false);report(e);}
  }
  async function start(){
    if(current.current || phaseRef.current==='starting')return;
    const g=++generation.current;phaseRef.current='starting';setPhase('starting');setIssue('');playback.current.cancel();
    let stream,context;
    try{
      await all('recordings');
      try { await navigator.storage?.persist?.(); } catch { /* Persistence is optional; IndexedDB remains the required durable store. */ }
      if(!mounted.current || g!==generation.current)return;
      stream=await microphone(navigator.mediaDevices,localStorage.getItem('agent-microphone') || '');
      if(!mounted.current || g!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}
      // Use the hardware's native rate. Resampling happens in the worklet.
      context=new AudioContext();await context.audioWorklet.addModule('/dictation-worklet.js');await context.resume();
      const node=new AudioWorkletNode(context,'dictation-capture');
      const r={id:crypto.randomUUID(),createdAt:new Date().toISOString(),finished:false};await write('recordings',r);
      const s={r,stream,context,node,seq:0,samples:0,pending:Promise.resolve(),failed:false,unsaved:[],chatId:latest.current.chatId,heard:0,silence:0};
      if(!mounted.current || g!==generation.current){stream.getTracks().forEach(t=>t.stop());await context.close();return;}
      current.current=s;
      node.port.onmessage=({data})=>{
        if(data.stopped){s.stopped?.();return;}
        const seq=s.seq++,chunk={key:`${r.id}:${seq}`,id:r.id,seq,pcm:data.pcm,synced:false};s.samples+=data.pcm.byteLength/2;
        s.pending=s.pending.then(async()=>{
          await write('chunks',chunk);
          if(mounted.current){setSeconds(s.samples/16000);setLevels(old=>[...old.slice(1),data.level]);}
        }).catch(e=>{s.unsaved.push(chunk);s.failed=true;node.port.postMessage('pause');if(mounted.current){setPhase('paused');setIssue('Speicher voll. Bitte eine Sicherheitskopie laden.');}});
        if(session.current?.auto && !s.stopping && phaseRef.current==='recording'){
          if(data.level>0.018){s.heard+=data.pcm.byteLength/32000;s.silence=0;}else s.silence+=data.pcm.byteLength/32000;
          if(s.heard>0.35 && s.silence>1.5)void stopRef.current?.(false,true);
          if(!s.heard && s.silence>20){node.port.postMessage('pause');setPhase('paused');setIssue('Keine Sprache erkannt.');}
        }
      };
      context.createMediaStreamSource(stream).connect(node);node.connect(context.destination);
      stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{setIssue('Mikrofon getrennt. Audio ist gesichert.');void stopRef.current?.(false,false);}));
      context.onstatechange=()=>{if(context.state==='suspended' && current.current===s && !s.stopping){node.port.postMessage('pause');setPhase('paused');}};
      setSeconds(0);setLevels(Array(voiceWaveGeometry.samples).fill(0));phaseRef.current='recording';setPhase('recording');
    }catch(e){stream?.getTracks().forEach(t=>t.stop());await context?.close();if(mounted.current && g===generation.current){phaseRef.current='idle';setPhase('idle');report(new Error(microphoneError(e)));}}
  }
  startRef.current=start;
  shortcutState.current={
    available:()=>shortcutEnabled && enabled && !document.hidden && document.hasFocus() && !session.current && output==='idle' && !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]'),
    phase:()=>phaseRef.current,
    start:()=>{void startRef.current?.();},
    finish:()=>{void stopRef.current?.(false,true);},
    cancelPending:()=>{generation.current++;phaseRef.current='idle';setPhase('idle');},
  };
  useImperativeHandle(controlRef,()=>({
    toggle(){
      if(!shortcutState.current.available())return;
      const currentPhase=phaseRef.current;
      if(currentPhase==='idle'){
        paneOwned.current=true;void startRef.current?.();
      }else if(currentPhase==='starting'){
        paneOwned.current=false;shortcutState.current.cancelPending();
      }else if(['recording','paused'].includes(currentPhase)){
        paneOwned.current=false;
        shortcutBinding.current?.releaseOwnership?.();
        // The existing delivery path preserves drafts and blocks busy sends.
        void stopRef.current?.(false,true,true);
      }
    },
    cancel(){
      if(phaseRef.current==='idle' || phaseRef.current==='waiting' || session.current)return false;
      paneOwned.current=false;shortcutBinding.current?.releaseOwnership?.();
      void end();return true;
    },
  }));
  useEffect(()=>{
    const interrupt=()=>{
      if(!paneOwned.current)return;
      paneOwned.current=false;
      if(phaseRef.current==='starting')shortcutState.current.cancelPending();
      else if(['recording','paused'].includes(phaseRef.current))void stopRef.current?.(false,true);
    };
    const hidden=()=>{if(document.hidden)interrupt();};
    if(!shortcutEnabled || !enabled)interrupt();
    window.addEventListener('blur',interrupt);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('blur',interrupt);document.removeEventListener('visibilitychange',hidden);interrupt();};
  },[shortcutEnabled,enabled,chatId]);
  useEffect(()=>{
    if(!shortcutEnabled || !enabled)return;
    const invoke=name=>(...args)=>shortcutState.current[name](...args);
    const dispose=bindDictationShortcut(window,{key:shortcutCode(shortcut.key,navigator.platform),mode:shortcut.mode,available:invoke('available'),phase:invoke('phase'),start:invoke('start'),finish:invoke('finish'),cancelPending:invoke('cancelPending')});
    shortcutBinding.current=dispose;
    const hidden=()=>{if(document.hidden)dispose.interrupt?.();};
    document.addEventListener('visibilitychange',hidden);
    return()=>{document.removeEventListener('visibilitychange',hidden);dispose();};
  },[shortcut.key,shortcut.mode,shortcutEnabled,enabled,chatId]);
  useEffect(()=>{if(phase==='idle'){paneOwned.current=false;shortcutBinding.current?.releaseOwnership?.();}},[phase]);

  async function transcribe(id,g,conversation,direct=false){
    const targetChat=latest.current.chatId;
    setPhase('recognizing');
    await api('/dictation/transcribe',{id});
    for(let i=0;i<1800;i++){
      await delay(1000);if(!mounted.current || g!==generation.current)return;
      const status=await api('/dictation/status');
      if(!mounted.current || g!==generation.current || latest.current.chatId!==targetChat)return;
      const r=status.recordings.find(r=>r.id===id);
      if(!r)throw new Error('Aufnahme ist unter Stimme wiederherstellbar.');
      if(r.processing)continue;
      if(r.error)throw new Error(r.error);
      if(!r.text?.trim()){setPhase('idle');setIssue('Keine Sprache erkannt.');return;}
      if(direct){
        if(latest.current.running){
          latest.current.onText(r.text);setPhase('idle');
          setIssue('Chat ist beschäftigt. Das Diktat steht im Entwurf.');return;
        }
        setPhase('waiting');
        await latest.current.onSendText(r.text);
        if(mounted.current && g===generation.current)setPhase('idle');
      }else if(conversation && session.current===conversation){
        conversation.sending=true;setPhase('waiting');
        try{const result=await onVoiceText(r.text);conversation.chatId=result.id;conversation.waiting=true;setAwaitingId(crypto.randomUUID());}
        finally{conversation.sending=false;}
      }else{onText(r.text);setPhase('idle');}
      return;
    }
    throw new Error('Erkennung dauert länger. Die Aufnahme bleibt unter Stimme verfügbar.');
  }
  async function stop(trash=false,recognize=true,direct=false){
    const s=current.current;if(!s || s.stopping)return;
    s.stopping=true;const g=generation.current,conversation=session.current;
    if(mounted.current){phaseRef.current='saving';setPhase('saving');}
    let secured=false;
    try{
      await Promise.race([new Promise(resolve=>{s.stopped=resolve;s.node.port.postMessage('stop');}),delay(1500)]);await s.pending;
      for(const chunk of s.unsaved)await write('chunks',chunk);s.unsaved=[];s.failed=false;
      if(s.seq)await write('recordings',{...s.r,finished:true,count:s.seq,trash});secured=true;
      s.stream.getTracks().forEach(t=>t.stop());await s.context.close();current.current=null;
      if(!s.seq){if(mounted.current && g===generation.current)setPhase('idle');return;}
      await sync(api);
      if(mounted.current && g===generation.current && !trash && recognize)await transcribe(s.r.id,g,conversation,direct);
      else if(mounted.current && g===generation.current)setPhase('idle');
    }catch(e){
      if(!secured){s.stopping=false;s.failed=true;if(mounted.current){setPhase('paused');setIssue('Audio noch im Speicher. Sicherheitskopie herunterladen.');}}
      else if(mounted.current && g===generation.current){setPhase('idle');setIssue('Audio gesichert. Unter Stimme erneut versuchen.');notify(e.message);}
    }
  }
  stopRef.current=stop;
  async function pause(){
    const s=current.current;if(!s)return;
    if(phase==='paused'){
      if(s.failed)return;
      await s.context.resume();s.silence=0;s.node.port.postMessage('resume');setPhase('recording');setIssue('');
    }else{s.node.port.postMessage('pause');setPhase('paused');}
  }
  async function end(){generation.current++;session.current=null;setSessionActive(false);playback.current.cancel();await stop(false,false);if(mounted.current){if(current.current?.failed){setPhase('paused');setIssue('Audio noch im Speicher. Sicherheitskopie herunterladen.');}else{setPhase('idle');setIssue('');}}}
  const action=(label,Icon,fn,disabled=false)=><button type="button" className="icon-button" title={label} aria-label={label} disabled={disabled} onClick={()=>Promise.resolve(fn()).catch(report)}><Icon size={18}/></button>;
  const active=phase!=='idle' || sessionActive || output!=='idle';
  const capturing=phase==='recording' || phase==='paused';
  const label=output==='playing'?'Spricht':output==='loading'?'Stimme wird vorbereitet':phase==='recording'?(sessionActive?'Hört zu':'Diktat'):phase==='paused'?'Pausiert':phase==='starting'?'Mikrofon …':phase==='saving'?'Sichern …':phase==='recognizing'?'Wird erkannt':phase==='waiting'?'Senden …':'Sprachchat';
  return <div className="dictation-control">
    {!active && action('Diktieren',Mic,start)}
    {active && <div className="voice-strip" data-capturing={capturing} role="group" aria-label={label}>
      <VoiceStatus label={label} busy={['starting','saving','recognizing','waiting'].includes(phase)}/>
      {capturing && <><VoiceWave levels={levels}/><span className="voice-time">{Math.floor(seconds/60)}:{String(Math.floor(seconds%60)).padStart(2,'0')}</span>{action(phase==='paused'?'Fortsetzen':'Pause',phase==='paused'?Play:Pause,pause)}{action('Aufnahme verwerfen',Trash2,()=>stop(true,false))}{action(sessionActive?'Senden':'Diktat übernehmen',Check,()=>stop(false,true))}{!sessionActive && onSendText && <button type="button" className="send-button" title="Diktat direkt senden" aria-label="Diktat direkt senden" disabled={running} onClick={()=>void stop(false,true,true)}><ArrowUp size={21}/></button>}</>}
      {phase==='idle' && sessionActive && output==='idle' && <>{action('Weiter sprechen',Mic,start,running)}{reply?.text && action('Antwort vorlesen',Volume2,()=>playback.current.speak(reply.text))}</>}
      {output!=='idle' && action('Wiedergabe stoppen',Square,()=>playback.current.cancel())}
      {(!capturing || sessionActive) && action('Sprachsteuerung schließen',X,end)}
    </div>}
    {issue && <div className="voice-issue" role="alert"><span>{issue}</span>{current.current?.failed? action('Sicherheitskopie herunterladen',Download,()=>downloadLocal(current.current.r.id,current.current.unsaved)):<button type="button" onClick={openSettings}>Stimme öffnen</button>}{action('Hinweis schließen',X,()=>setIssue(''))}</div>}
  </div>;
}
