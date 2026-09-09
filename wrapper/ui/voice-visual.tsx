import {useEffect, useRef, useState} from 'react';
import {AppLoader} from './app-loader';
import {voiceWaveGeometry as geometry} from './design-system.mjs';
import './dictation.css';

export function VoiceWave({levels}: {levels: number[]}) {
  const ref=useRef<SVGSVGElement>(null);
  const [width,setWidth]=useState(geometry.width);
  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  const count=Math.max(3,Math.min(geometry.samples,Math.floor(width/geometry.spacing)));
  const visible=levels.slice(-count);
  return <span className="voice-wave-slot"><svg ref={ref} className="voice-wave" style={{maxWidth:geometry.width}} viewBox={`0 0 ${count*geometry.spacing} 24`} preserveAspectRatio="none" role="img" aria-label="Mikrofonpegel">
    {Array.from({length:count},(_,i)=>{
      const level=visible[i] || 0;
      const amplitude=Math.max(geometry.rest,Math.min(geometry.height,level*geometry.gain));
      return <g key={i} transform={`translate(${i*geometry.spacing+geometry.spacing/2},12)`}>
        <line y1={-geometry.height} y2={geometry.height} strokeWidth={geometry.stroke} vectorEffect="non-scaling-stroke" style={{transform:`scaleY(${amplitude/geometry.height})`}}/>
      </g>;
    })}
  </svg></span>;
}

export function VoiceStatus({label,busy=false}: {label:string;busy?:boolean}) {
  return <span className="voice-status" role="status">
    {busy && <AppLoader size={14} preview/>}
    <span>{label}</span>
  </span>;
}
