import {useEffect,useState,useRef} from 'react';
import {useReducedMotion,motion} from 'motion/react';
import {chatHeadingMotion} from './design-system.mjs';
import {useStartTextMotion} from './chat-start-preferences';
export function ChatStartHeading({texts,reduceMotion=false,paused=false}:{texts:string[];reduceMotion?:boolean;paused?:boolean}) {
 const reduced=useReducedMotion() || reduceMotion,enabled=useStartTextMotion();
 const ref=useRef<HTMLHeadingElement>(null);
 const [frame,setFrame]=useState({index:0,count:0,fading:false}),[onscreen,setOnscreen]=useState(false),[pageVisible,setPageVisible]=useState(true);
 const signature=texts.join('\n');
 const saved=useRef(frame);saved.current=frame;
 useEffect(()=>{const observer=new IntersectionObserver(entries=>setOnscreen(entries[0].isIntersecting));if(ref.current)observer.observe(ref.current);const visible=()=>setPageVisible(!document.hidden);visible();document.addEventListener('visibilitychange',visible);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visible);};},[]);
 useEffect(()=>{setFrame({index:0,count:0,fading:false});saved.current={index:0,count:0,fading:false};},[signature]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  if(reduced || !enabled){setFrame({index:0,count:Array.from(texts[0]||'').length,fading:false});return;}
  if(!onscreen || !pageVisible || paused){setFrame(old=>({...old,count:paused?Array.from(texts[old.index]||texts[0]||'').length:old.count,fading:false}));return;}
  let current={...saved.current,fading:false};
  const tick=()=>{
   const chars=Array.from(texts[current.index]||'');
   if(current.count<chars.length){current={...current,count:current.count+1,fading:false};setFrame(current);timer=setTimeout(tick,/[.!?،,;:]/.test(chars[current.count-1])?chatHeadingMotion.punctuation:chatHeadingMotion.character);}
   else timer=setTimeout(()=>{setFrame({...current,fading:true});timer=setTimeout(()=>{current={index:(current.index+1)%texts.length,count:0,fading:false};setFrame(current);timer=setTimeout(tick,chatHeadingMotion.character);},chatHeadingMotion.fade);},chatHeadingMotion.hold);
  };
  timer=setTimeout(tick,chatHeadingMotion.character);
  return()=>{if(timer)clearTimeout(timer);};
 },[signature,reduced,enabled,onscreen,pageVisible,paused]);
 const text=texts[frame.index]||texts[0]||'',staticText=reduced || !enabled;
 return <h1 ref={ref} className="chat-start-heading" aria-label={text}>
  {texts.map((value,index)=><span key={index} className="chat-heading-measure" aria-hidden="true">{value}<span className="chat-heading-cursor"/></span>)}
  <motion.span className="chat-heading-writing" aria-hidden="true" animate={{opacity:frame.fading?0:1}} transition={{duration:staticText?0:chatHeadingMotion.fade/1000}}>{staticText?text:Array.from(text).slice(0,frame.count).join('')}<span className={'chat-heading-cursor'+(!staticText&&onscreen&&pageVisible&&!paused?' is-writing':'')}/></motion.span>
 </h1>;
}
