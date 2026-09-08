"use client";
// Adapted from beui.dev/components/motion/loader.
import { motion, useReducedMotion, type TargetAndTransition } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import { EASE_IN_OUT } from '@/components/ui/loader-utils/ease';
import { cn } from '@/lib/utils';
export type LoaderVariant = 'spinner' | 'dots' | 'bars' | 'dot-matrix' | 'dither' | 'ascii' | 'ascii-line' | 'ascii-braille' | 'ascii-blocks' | 'ascii-bounce' | 'morph' | 'comet' | 'scramble' | 'metaballs' | 'newton' | 'helix' | 'percent';
export interface LoaderProps { variant?: LoaderVariant; size?: number; speed?: number; label?: string; className?: string; reduceMotion?: boolean; }
const ASCII_SETS: Partial<Record<LoaderVariant, string[]>> = {
  ascii: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
  'ascii-line': ['|','/','-','\\'], 'ascii-braille': ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷'],
  'ascii-blocks': ['▁','▂','▃','▄','▅','▆','▇','█','▇','▆','▅','▄','▃','▂'],
  'ascii-bounce': ['⠁','⠂','⠄','⡀','⢀','⠠','⠐','⠈'],
};
const BAYER_4 = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function ngonRadius(ang: number, n: number, phase = 0) {
  const seg = 2 * Math.PI / n, a = ang - phase;
  const local = (((a % seg) + seg) % seg) - seg / 2;
  return Math.cos(Math.PI / n) / Math.cos(local);
}
function morphPath(radiusAt: (ang: number) => number) {
  return Array.from({length:24}, (_,i) => {
    const ang = i / 24 * 2 * Math.PI - Math.PI / 2, r = Math.min(1.05, radiusAt(ang));
    return `${i ? 'L' : 'M'}${(50 + Math.cos(ang)*46*r).toFixed(2)} ${(50 + Math.sin(ang)*46*r).toFixed(2)}`;
  }).join(' ') + ' Z';
}
const MORPH_PATHS = [morphPath(()=>1), morphPath(a=>ngonRadius(a,4,Math.PI/4)), morphPath(a=>ngonRadius(a,3)), morphPath(a=>ngonRadius(a,6)), morphPath(a=>ngonRadius(a,4))];
const MORPH_SEQ = [...MORPH_PATHS.flatMap(p=>[p,p]), MORPH_PATHS[0]];
function Glyph({variant,size,speed,reduce}: {variant:LoaderVariant;size:number;speed:number;reduce:boolean}) {
  const [tick,setTick] = useState(0);
  const [scramble,setScramble] = useState('LOADING');
  const frames = ASCII_SETS[variant];
  useEffect(()=>{
    setTick(0); setScramble('LOADING');
    if (reduce) return;
    let step = 0;
    const timer = setInterval(()=>{
      step++;
      setTick(step);
      if (variant === 'scramble') setScramble(Array.from('LOADING',(c,i)=>i < step%11 ? c : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/*#@'[Math.floor(Math.random()*42)]).join(''));
    }, variant === 'percent' ? 40 : speed*1000/(frames?.length || 7)*(variant === 'scramble' ? .55 : 1));
    return ()=>clearInterval(timer);
  },[variant,speed,reduce,frames]);
  const p = Math.min(100, Math.round((tick % (Math.ceil(speed*1000/40)+1))*40/(speed*1000)*100));
  if (variant === 'percent') return <span className="flex flex-col items-center" style={{gap:size*.14,width:size*1.4}}><span style={{fontSize:size*.42}}>{reduce ? '…' : `${p}%`}</span><span className="w-full overflow-hidden rounded-full bg-current/15" style={{height:Math.max(3,size*.1)}}><span className="block h-full rounded-full bg-current" style={{width:reduce?'40%':`${p}%`}} /></span></span>;
  return <span className="font-mono leading-none tabular-nums" style={{fontSize:frames?size:size*.42,letterSpacing:frames?undefined:'.2em'}}>{frames ? frames[tick%frames.length] : scramble}</span>;
}
export function Loader({variant='spinner',size=32,speed=1,label='Loading',className,reduceMotion=false}: LoaderProps) {
  const systemReduce = useReducedMotion();
  const reduce = reduceMotion || !!systemReduce;
  size = Number.isFinite(size) ? Math.max(8,Math.min(128,size)) : 32;
  speed = Number.isFinite(speed) ? Math.max(.2,Math.min(10,speed)) : 1;
  const id = 'loader-' + useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const transition = {duration:speed,ease:EASE_IN_OUT,repeat:Infinity};
  // A static frame respects both the app preference and the operating system.
  const animate = (value: TargetAndTransition) => reduce ? undefined : value;
  let content;
  if (ASCII_SETS[variant] || variant==='scramble' || variant==='percent') content=<Glyph {...{variant,size,speed,reduce}}/>;
  else if (variant==='spinner') {
    const stroke=Math.max(2,size*.09), r=(size-stroke)/2;
    content=<motion.svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} animate={animate({rotate:360})} transition={{duration:speed,ease:'linear',repeat:Infinity}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeOpacity={.2} strokeWidth={stroke}/><path d={`M ${size/2} ${size/2-r} A ${r} ${r} 0 0 1 ${size/2+r} ${size/2}`} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"/></motion.svg>;
  } else if (variant==='dots' || variant==='bars' || variant==='newton') {
    const n=variant==='dots'?3:variant==='bars'?4:5, d=size*(variant==='dots'?.24:variant==='bars'?.16:.2);
    content=<span className="flex items-center justify-center" style={{gap:variant==='newton'?0:size*.1,height:size}}>{Array.from({length:n},(_,i)=><motion.span key={i} className="rounded-full bg-current" style={{width:d,height:variant==='bars'?size:d,originY:1}} animate={animate(variant==='dots'?{y:[0,-size*.3,0],opacity:[.5,1,.5]}:variant==='bars'?{scaleY:[.3,1,.3]}:i===0?{x:[0,-d*1.1,0,0]}:i===4?{x:[0,0,d*1.1,0]}:{})} transition={{...transition,duration:variant==='newton'?speed*1.5:speed,delay:variant==='newton'?0:i*speed*.14,...(variant==='newton'?{times:i===0?[0,.28,.5,1]:[0,.5,.78,1]}:{})}}/>)}</span>;
  } else if (variant==='dot-matrix' || variant==='dither') {
    const n=variant==='dither'?4:3,gap=variant==='dither'?Math.max(1,size*.05):size*.14,d=(size-gap*(n-1))/n;
    content=<span className="grid" style={{gap,gridTemplateColumns:`repeat(${n}, ${d}px)`}}>{Array.from({length:n*n},(_,i)=><motion.span key={i} className={cn('bg-current',variant==='dot-matrix'&&'rounded-full')} style={{width:d,height:d}} animate={animate(variant==='dither'?{opacity:[.1,1,.1]}:{opacity:[.2,1,.2],scale:[.7,1,.7]})} transition={{...transition,delay:(variant==='dither'?BAYER_4[i]/16:((i%n)+Math.floor(i/n))/(2*(n-1)))*speed}}/>)}</span>;
  } else if (variant==='morph') content=<svg width={size} height={size} viewBox="0 0 100 100"><motion.path fill="currentColor" d={MORPH_PATHS[0]} style={{transformBox:'fill-box',transformOrigin:'center'}} animate={animate({d:MORPH_SEQ,rotate:[0,0,72,72,144,144,216,216,288,288,360],scale:[1,1,.88,.88,1,1,.88,.88,1,1,1]})} transition={{...transition,duration:speed*5}}/></svg>;
  else if (variant==='metaballs') content=<svg width={size} height={size} viewBox="0 0 100 100"><defs><filter id={id}><feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/><feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/></filter></defs><g filter={`url(#${id})`} fill="currentColor">{[0,1].map(i=><motion.circle key={i} cy="50" r="15" cx={i?60:40} animate={animate({cx:i?[70,30,70]:[30,70,30]})} transition={{...transition,duration:speed*1.6}}/>)}</g></svg>;
  else if (variant==='comet') content=<span className="relative" style={{width:size,height:size}}><motion.span className="absolute inset-0" animate={animate({rotate:360})} transition={{duration:speed,ease:'linear',repeat:Infinity}}>{Array.from({length:6},(_,i)=>{const d=size*.2*(1-i*.13);return <span key={i} className="absolute top-1/2 left-1/2 rounded-full bg-current" style={{width:d,height:d,marginLeft:-d/2,marginTop:-d/2,opacity:1-i*.16,transform:`rotate(${-i*15}deg) translateY(${-size*.4}px)`}}/>;})}</motion.span></span>;
  else if (variant==='helix') content=<span className="relative" style={{width:size,height:size}}>{Array.from({length:14},(_,i)=>{const row=Math.floor(i/2),flip=i%2,a=size*.32*(flip?-1:1),d=size*.14;return <motion.span key={i} className="absolute rounded-full bg-current" style={{width:d,height:d,left:size/2-d/2,top:row/6*(size-d),x:reduce?a:0}} animate={animate({x:[a,-a,a],scale:flip?[.5,1,.5]:[1,.5,1],opacity:flip?[.45,1,.45]:[1,.45,1]})} transition={{...transition,delay:row/7*speed}}/>;})}</span>;
  return <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center text-foreground',className)}><span aria-hidden="true" className="inline-flex items-center justify-center">{content}</span><span className="sr-only">{label}</span></span>;
}
export default Loader;
