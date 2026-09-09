"use client";
import {useState,useEffect,useRef} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {ArrowUpRight,Bell,FileText,MessageCircle,BrainCircuit,ChevronLeft,ChevronRight} from '../../icons.jsx';
import {attentionFanMotion} from '../../design-system.mjs';
import './attention-fan.css';
export interface AttentionItem {id:string;kind:string;title:string;description:string;prompt?:string;threadId?:string;noticeId?:string;}
export function AttentionFan({items,onOpen,onActiveChange,reduceMotion=false,disabled=false}:{items:AttentionItem[];onOpen:(item:AttentionItem)=>void;onActiveChange?:(item:AttentionItem)=>void;reduceMotion?:boolean;disabled?:boolean}) {
  const [selected,setSelected]=useState<string|null>(null);
  const index=Math.max(0,items.findIndex(item=>item.id===selected)), active=items[index];
  const reduced=useReducedMotion() || reduceMotion;
  const track=useRef<HTMLElement|null>(null),[compact,setCompact]=useState(true);
  useEffect(()=>{const el=track.current;if(!el)return;const observer=new ResizeObserver(entries=>setCompact(entries[0].contentRect.width<380));observer.observe(el);return()=>observer.disconnect();},[]);
  const touch=useRef<{x:number;y:number}|null>(null),ignoreClick=useRef(0);
  useEffect(()=>{if(active){setSelected(active.id);onActiveChange?.(active);}},[active?.id,onActiveChange]);
  if(!active)return null;
  const select=(i:number)=>{if(!disabled)setSelected(items[(i+items.length)%items.length].id);};
  const visible=items.length<3?items.map((_,i)=>i):[(index-1+items.length)%items.length,index,(index+1)%items.length];
  return <section ref={track} className="attention-fan" aria-label="Anknüpfungspunkte für dein Gespräch" aria-roledescription="Karussell"
    onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(index+(e.key==='ArrowRight'?1:-1));}}}
    onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};ignoreClick.current=0;}}
    onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){ignoreClick.current=Date.now()+400;select(index+(dx<0?1:-1));}}}
    onTouchCancel={()=>{touch.current=null;}}>
    <div className="attention-fan-track">
      {visible.map(i=>{
        const item=items[i],isActive=i===index,side=isActive?0:i===(index+1)%items.length?1:-1;
        const Icon=item.kind==='request'||item.kind==='notice'?Bell:item.kind==='report'?FileText:item.kind==='chat'?MessageCircle:BrainCircuit;
        return <motion.button type="button" key={item.id} className={'attention-fan-card'+(isActive?' is-active':'')} data-side={side}
          initial={false} animate={{rotate:side*(compact?attentionFanMotion.compactRotation:attentionFanMotion.rotation),y:isActive?0:attentionFanMotion.depth,scale:isActive?1:attentionFanMotion.scale}}
          transition={reduced?{duration:0}:{type:'spring',...attentionFanMotion.spring}}
          disabled={disabled} aria-label={item.title+(isActive?' öffnen':' auswählen')} aria-current={isActive?'true':undefined}
          onClick={()=>{if(Date.now()<ignoreClick.current)return;isActive?onOpen(item):select(i);}}>
          <span className="attention-fan-kind"><Icon size={20} strokeWidth={undefined}/><span>{({request:'Rückfrage',notice:'Hinweis',report:'Ergebnis',chat:'Neue Antwort',prompt:'Mit dir'})[item.kind as 'request']}</span></span>
          <strong>{item.title}</strong><span className="attention-fan-description">{item.description}</span>
          <ArrowUpRight className="attention-fan-arrow" size={18} strokeWidth={undefined}/>
        </motion.button>;
      })}
    </div>
    {items.length>1&&<div className="attention-fan-navigation"><button type="button" className="icon-button" aria-label="Vorherige Karte" disabled={disabled} onClick={()=>select(index-1)}><ChevronLeft size={16} strokeWidth={undefined}/></button><span aria-live="polite">{index+1} / {items.length}</span><button type="button" className="icon-button" aria-label="Nächste Karte" disabled={disabled} onClick={()=>select(index+1)}><ChevronRight size={16} strokeWidth={undefined}/></button></div>}
  </section>;
}
