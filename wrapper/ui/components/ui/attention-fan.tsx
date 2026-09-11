import {AllowanceBars} from '../../usage';
import {StatisticsCard} from '../../statistics';
import {WeatherCardContent} from './weather-scene';
import {CalendarCardContent} from '../../calendar-card';
import {MapPin} from 'lucide-react';
import {LibraryThumbnail} from '../../library-thumbnail.jsx';
"use client";
import {useState,useEffect,useLayoutEffect,useRef} from 'react';
import {AnimatePresence,motion,useReducedMotion,useIsPresent} from 'motion/react';
import {ArrowUpRight,Calendar,Bell,FileText,MessageCircle,BrainCircuit,ChevronLeft,ChevronRight,Clock,Inbox,Activity,Zap} from '../../icons.jsx';
import {attentionFanMotion} from '../../design-system.mjs';
import './attention-fan.css';
import {reconcileFan,entryTime,inboxAction,inboxKindLabel} from '../../chat-start-feed.mjs';
import {ReplyCardPreview} from '../../reply-card-preview';
export interface AttentionItem {id:string;kind:string;title:string;description:string;prompt?:string;continuation?:boolean;threadId?:string;turnId?:string;noticeId?:string;entry?:any;job?:any;calendar?:any;weather?:any;weatherConfigured?:boolean;statistics?:any;allowances?:any;entries?:any[];count?:number;lead?:any;}
export function AttentionFan({items,onOpen,onActiveChange,reduceMotion=false,disabled=false,autoplay=false,api}:{items:AttentionItem[];onOpen:(item:AttentionItem)=>void;onActiveChange?:(item:AttentionItem)=>void;reduceMotion?:boolean;disabled?:boolean;autoplay?:boolean;api?:any}) {
  const signature=JSON.stringify(items.map(item=>item.id));
  const [order,setOrder]=useState(()=>({...reconcileFan({ids:[],selected:''},items),signature}));
  const [hovered,setHovered]=useState<string|null>(null);
  if(order.signature!==signature)setOrder({...reconcileFan(order,items),signature});
  const byId=new Map(items.map(item=>[item.id,item]));
  items=order.ids.map(id=>byId.get(id)).filter(Boolean) as AttentionItem[];
  const index=Math.max(0,items.findIndex(item=>item.id===order.selected)), active=items[index];
  const reduced=useReducedMotion() || reduceMotion;
  const track=useRef<HTMLElement|null>(null),[width,setWidth]=useState(0),measured=useRef(false);
  const hasItems=items.length>0;
  useLayoutEffect(()=>{
    const el=track.current;if(!el)return;
    setWidth(el.getBoundingClientRect().width);
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));observer.observe(el);
    const frame=requestAnimationFrame(()=>{measured.current=true;});
    return()=>{observer.disconnect();cancelAnimationFrame(frame);measured.current=false;};
  },[hasItems]);
  const compact=width<380,wide=width>=attentionFanMotion.wideThreshold,veryWide=width>=attentionFanMotion.veryWideThreshold;
  const focusedCard=useRef<string|null>(null);
  useEffect(()=>{
    if(!focusedCard.current||byId.has(focusedCard.current))return;
    const frame=requestAnimationFrame(()=>{
      const current=document.activeElement;
      if(current===document.body||current?.hasAttribute('inert'))track.current?.querySelector<HTMLButtonElement>('[aria-current="true"]:not([inert])')?.focus({preventScroll:true});
      focusedCard.current=null;
    });
    return()=>cancelAnimationFrame(frame);
  },[signature]);
  const wheel=useRef({sum:0,last:0,at:0});
  const touch=useRef<{x:number;y:number}|null>(null),ignoreClick=useRef(0);
  useEffect(()=>{if(active){onActiveChange?.(active);}},[active?.id,onActiveChange]);
  const step=useRef((_:number)=>{});
  step.current=(direction:number)=>{if(!disabled&&items.length>1)setOrder(old=>({...old,selected:items[(index+direction+items.length)%items.length].id}));};
  useEffect(()=>{
    if(!autoplay||reduced||disabled||hovered||items.length<2)return;
    const timer=setInterval(()=>{if(!document.hidden)step.current(1);},attentionFanMotion.autoplayInterval);
    return()=>clearInterval(timer);
  },[autoplay,reduced,disabled,hovered,signature,items.length]);
  if(!active)return null;
  const select=(i:number)=>{if(!disabled){setHovered(null);setOrder(old=>({...old,selected:items[(i+items.length)%items.length].id}));}};
  const count=Math.min(items.length,veryWide?7:wide?5:3),left=Math.floor((count-1)/2);
  const visible=Array.from({length:count},(_,n)=>({i:(index+n-left+items.length)%items.length,side:n-left}));
  const spread=compact?attentionFanMotion.compactSpread:veryWide?attentionFanMotion.veryWideSpread:wide?attentionFanMotion.wideSpread:attentionFanMotion.spread;
  return <section ref={track} onPointerLeave={()=>setHovered(null)} data-autoplay={autoplay&&!reduced&&!disabled&&!hovered&&items.length>1?"on":"off"} data-dbg={`a${+autoplay}r${+reduced}d${+disabled}h${+!!hovered}`} className="attention-fan" aria-label="Anknüpfungspunkte für dein Gespräch" aria-roledescription="Karussell"
    onWheel={e=>{const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.shiftKey?e.deltaY:0;if(!delta)return;const now=Date.now(),state=wheel.current;if(now-state.at>180||Math.sign(delta)!==Math.sign(state.sum))state.sum=0;state.at=now;state.sum+=delta*(e.deltaMode===1?16:1);if(Math.abs(state.sum)>=attentionFanMotion.wheelThreshold&&now-state.last>=attentionFanMotion.wheelCooldown){select(index+(state.sum>0?1:-1));state.sum=0;state.last=now;}}}
    onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();select(index+(e.key==='ArrowRight'?1:-1));}}}
    onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};ignoreClick.current=0;}}
    onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5){ignoreClick.current=Date.now()+400;select(index+(dx<0?1:-1));}}}
    onTouchCancel={()=>{touch.current=null;}}>
    <div className="attention-fan-track"><AnimatePresence initial={false}>
      {visible.map(({i,side})=>{
        const item=items[i],isActive=i===index,isHovered=hovered===item.id,distance=Math.abs(side),outer=distance===2,far=distance>=3;
        const weatherReady=item.kind==='weather'&&item.weather?.status==='ready';
        const Icon=item.kind==='inbox'?Inbox:item.kind==='statistics'?Activity:item.kind==='allowances'?Zap:item.kind==='calendar'?Calendar:item.kind==='weather'?MapPin:item.kind==='job'?Clock:item.kind==='artifact'?FileText:item.kind==='request'||item.kind==='notice'?Bell:item.kind==='report'?FileText:item.kind==='chat'?MessageCircle:BrainCircuit;
        return <FanCard type="button" key={item.id} className={'attention-fan-card'+(weatherReady?' weather-card':'')+(isActive?' is-active':'')+(isHovered?' is-hovered':'')} data-side={side} data-kind={item.kind} style={{zIndex:isHovered?8:5-distance}}
          initial={reduced?false:{opacity:0,y:attentionFanMotion.arrivalY,scale:attentionFanMotion.arrivalScale,x:side*width*spread}} exit={reduced?{opacity:0,transition:{duration:0}}:{opacity:0,y:attentionFanMotion.departureY,scale:attentionFanMotion.departureScale,transition:{duration:attentionFanMotion.exitDuration,ease:attentionFanMotion.ease}}} animate={{opacity:1,x:side*width*spread,rotate:isHovered?0:far?Math.sign(side)*attentionFanMotion.farRotation:outer?Math.sign(side)*attentionFanMotion.outerRotation:side*(compact?attentionFanMotion.compactRotation:attentionFanMotion.rotation),y:isHovered?attentionFanMotion.hoverLift:isActive?0:far?attentionFanMotion.farDepth:outer?attentionFanMotion.outerDepth:attentionFanMotion.depth,scale:isHovered?attentionFanMotion.hoverScale:isActive?1:far?attentionFanMotion.farScale:outer?attentionFanMotion.outerScale:attentionFanMotion.scale}}
          transition={reduced||!measured.current?{duration:0}:{type:'spring',...attentionFanMotion.spring,opacity:{duration:attentionFanMotion.enterDuration,ease:attentionFanMotion.ease}}}
          onPointerEnter={e=>{if(e.pointerType==='mouse'&&!disabled)setHovered(item.id);}}
          onFocus={e=>{if(e.currentTarget.matches(':focus-visible')){setHovered(item.id);focusedCard.current=item.id;}}} onBlur={e=>{setHovered(null);if(e.relatedTarget)focusedCard.current=null;}}
          disabled={disabled} aria-label={item.title+(weatherReady?' · '+item.description:'')+(isActive||isHovered?(weatherReady?' · Wetterbericht in neuem Chat öffnen':' öffnen'):' auswählen')} aria-current={isActive?'true':undefined}
          onClick={()=>{if(Date.now()<ignoreClick.current)return;isActive||isHovered?onOpen(item):select(i);}}>
          <>{item.kind==='calendar'?<CalendarCardContent data={item.calendar} preview={item.calendar?.preview}/>:weatherReady?<WeatherCardContent item={item} active={isActive||isHovered} reduceMotion={!!reduced}/>:<>
          <span className="attention-fan-kind"><Icon size={20} strokeWidth={undefined}/><span className="attention-fan-kind-label">{item.continuation?'Weitermachen':({inbox:'Posteingang',calendar:'Kalender',allowances:'Kontingente',statistics:'Statistik',weather:'Wetter',artifact:'Zum Weitermachen',job:'Als Nächstes',request:'Braucht dich',notice:'Hinweis',report:'Für dich',chat:'Neue Antwort',prompt:'Mit dir'})[item.kind as 'request']}</span>{(item.count||0)>1&&<span className="attention-fan-count">{item.count}</span>}</span>
          {item.kind==='artifact'&&item.entry&&<LibraryThumbnail key={item.entry.id || item.entry.path} entry={item.entry} variant="card"/>}
          {item.kind==='inbox'?<InboxStack item={item}/>:item.kind==='allowances'?<AllowanceBars data={item.allowances} compact/>:item.kind==='statistics'?<StatisticsCard data={item.statistics} active={isActive||isHovered} reduceMotion={!!reduced}/>:<><strong>{item.title}</strong>{item.kind==='chat'&&!item.continuation&&item.turnId?<ReplyCardPreview api={api} item={item}/>:item.description&&<span className="attention-fan-description">{item.description}</span>}
          </>}{item.kind==='weather'&&item.weather?.status==='ready'&&<span className="attention-fan-action">Open-Meteo · Stand {new Date(item.weather.time).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span>}
          <span className="attention-fan-action"><span>{item.kind==='inbox'?inboxAction(item.lead?.kind):item.kind==='calendar'?'Kalender öffnen':item.kind==='allowances'?'Alle Kontingente':item.kind==='statistics'?'Statistik öffnen':item.kind==='artifact'?'Weitermachen':item.kind==='weather'?(item.weatherConfigured&&item.weather?.status!=='unresolved'?'Wetterbericht öffnen':'Ort einstellen'):item.kind==='chat'?(item.continuation?'Gespräch öffnen':'Antwort ansehen'):item.kind==='report'?'Ergebnis besprechen':item.kind==='job'?'Auftrag ansehen':item.kind==='request'?'Antworten':item.kind==='notice'?'Hinweis ansehen':'Entwurf vorbereiten'}</span><ArrowUpRight className="attention-fan-arrow" size={18} strokeWidth={undefined}/></span>
          </>}</>
        </FanCard>;
      })}
    </AnimatePresence></div>
    {<div className="attention-fan-navigation">{items.length>1&&<><button type="button" className="icon-button" aria-label="Vorherige Karte" disabled={disabled} onClick={()=>select(index-1)}><ChevronLeft size={16} strokeWidth={undefined}/></button><span aria-live="polite">{index+1} / {items.length}</span><button type="button" className="icon-button" aria-label="Nächste Karte" disabled={disabled} onClick={()=>select(index+1)}><ChevronRight size={16} strokeWidth={undefined}/></button></>}</div>}
    <div className="attention-fan-credit">{active.kind==='weather'&&active.weather?.status==='ready'&&!active.weather.preview&&<a href="https://open-meteo.com/" target="_blank" rel="noreferrer" title="Wetterdaten von Open-Meteo">Open-Meteo</a>}</div>
  </section>;
}

function InboxStack({item}:{item:AttentionItem}) {
 const entries=item.entries||[];
 return <ul className="attention-fan-stack">{entries.map((entry,n)=><li key={entry.id} className={'attention-fan-stack-row'+(n?'':' is-lead')}>
  <span className="attention-fan-stack-title">{entry.title}</span>
  <span className="attention-fan-stack-meta">{inboxKindLabel[entry.kind as 'chat']||'Neu'}{entry.at?' · '+entryTime(entry.at):''}</span>
 </li>)}</ul>;
}

function FanCard(props: React.ComponentProps<typeof motion.button>) {
 const present=useIsPresent();
 return <motion.button {...props} inert={!present} aria-hidden={!present||undefined}/>;
}
