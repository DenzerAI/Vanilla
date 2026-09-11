import {useEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {pixelHash} from './pixel-field.mjs';
import {statisticsMotion} from '../../design-system.mjs';
import './activity-pixels.css';

type Day={day:string;count:number};
export function ActivityPixels({days,active=true,reduceMotion=false,compact=false}:{days:Day[];active?:boolean;reduceMotion?:boolean;compact?:boolean}) {
 const reduced=useReducedMotion()||reduceMotion,ref=useRef<HTMLSpanElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const el=ref.current;if(!el)return;let onscreen=false;const sync=()=>setVisible(onscreen&&!document.hidden);const io=new IntersectionObserver(entries=>{onscreen=entries[0].isIntersecting;sync();});io.observe(el);document.addEventListener('visibilitychange',sync);return()=>{io.disconnect();document.removeEventListener('visibilitychange',sync);};},[]);
 const rows=compact?4:7,shown=compact?days.slice(-56):days,columns=Math.max(14,Math.ceil(shown.length/rows));
 const cells=Array.from({length:columns*rows},(_,i)=>shown[i]||null),peak=Math.max(1,...shown.map(d=>d.count));
 const animate=active&&visible&&!reduced;
 return <span className={'activity-pixels'+(compact?' is-compact':'')} ref={ref}>
  <span className="activity-pixel-grid" role="img" aria-label={`Tagesaktivität: ${shown.filter(d=>d.count>0).length} aktive Tage. Hellere Felder bedeuten mehr Nachrichten.`} style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`,gridTemplateRows:`repeat(${rows},1fr)`}}>
   {cells.map((day,i)=>{const x=Math.floor(i/rows),y=i%rows,level=day?.count?Math.ceil(day.count/peak*4):0;return <span key={day?.day||i} className={'activity-pixel level-'+level} title={day?`${day.day}: ${day.count} Nachrichten`:'Noch kein Tag'} style={{gridColumn:x+1,gridRow:y+1}}><span aria-hidden="true" className="activity-pixel-shimmer" style={{animationDuration:`${statisticsMotion.shimmerDuration}s`,animationName:animate?'activity-pixel-shimmer':'none',animationDelay:`${-pixelHash(x,y)*statisticsMotion.shimmerDuration}s`,animationPlayState:animate?'running':'paused',opacity:animate?undefined:0}}/></span>;})}
  </span>
 </span>;
}
