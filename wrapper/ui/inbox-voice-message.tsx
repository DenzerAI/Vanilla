import React, {useRef, useState} from 'react';
import {ChevronDown, Pause, Play} from './icons.jsx';
import {IconButton} from './icon-button';

const clock = (seconds:number) => {
  const value=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
};
export function InboxTranscript({text}:{text:string}) {
  const [open,setOpen]=useState(true);
  return <details className="inbox-transcript" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary><span>Transkript</span><ChevronDown size={16}/></summary>
    <p>{text}</p>
  </details>;
}
export function InboxVoiceMessage({src,transcript}:{src:string;transcript?:string}) {
  const audio=useRef<HTMLAudioElement>(null);
  const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState('');
  async function toggle() {
    const el=audio.current;if(!el)return;
    if(!el.paused){el.pause();return;}
    document.querySelectorAll<HTMLAudioElement>('.inbox-voice audio').forEach(other=>{if(other!==el)other.pause();});
    try {setError('');await el.play();}catch{setError('Audio konnte nicht abgespielt werden. Bitte erneut versuchen.');}
  }
  return <div className="inbox-voice">
    <audio ref={audio} src={src} preload="metadata" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onDurationChange={e=>setDuration(e.currentTarget.duration)} onError={()=>{setPlaying(false);setError('Audio ist gerade nicht verfügbar.');}}/>
    <div className="inbox-voice-player" role="group" aria-label="Sprachnachricht">
      <IconButton label={playing?'Sprachnachricht pausieren':'Sprachnachricht abspielen'} onClick={()=>void toggle()}>{playing?<Pause size={20}/>:<Play size={20}/>}</IconButton>
      <div className="inbox-voice-progress"><input type="range" aria-label="Wiedergabeposition" min={0} max={Number.isFinite(duration)&&duration>0?duration:1} step={0.1} value={position} disabled={!Number.isFinite(duration)||duration<=0} onChange={e=>{if(audio.current){audio.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}}/><div><span>{clock(position)}</span><span>{duration>0&&Number.isFinite(duration)?clock(duration):'–:––'}</span></div></div>
    </div>
    {error&&<p role="alert" className="muted">{error}</p>}
    {transcript?<InboxTranscript text={transcript}/>:<p className="inbox-transcript-pending">Transkript noch nicht verfügbar.</p>}
  </div>;
}
