import {useEffect,useState,useRef} from 'react';
import {useReducedMotion} from 'motion/react';
import {chatHeadingMotion} from './design-system.mjs';
export function ChatStartHeading({text,reduceMotion=false}:{text:string;reduceMotion?:boolean}) {
  const systemReduced=useReducedMotion(),ref=useRef<HTMLHeadingElement>(null);
  const [visible,setVisible]=useState(0),[active,setActive]=useState(false);
  const reduced=reduceMotion || systemReduced;
  const words=text.split(/\s+/);
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined,alive=true;
    const start=()=>{
      if(timer)clearTimeout(timer);
      if(reduced || document.hidden){setVisible(words.length);setActive(false);return;}
      let count=1;setVisible(count);setActive(true);
      const next=()=>{if(!alive)return;if(count<words.length){setVisible(++count);timer=setTimeout(next,chatHeadingMotion.wordDelay);}else timer=setTimeout(()=>setActive(false),chatHeadingMotion.settle);};
      timer=setTimeout(next,chatHeadingMotion.wordDelay);
    };
    const observer=new IntersectionObserver(entries=>{if(entries[0].isIntersecting)start();else{if(timer)clearTimeout(timer);setActive(false);setVisible(words.length);}});
    if(ref.current)observer.observe(ref.current);
    const hidden=()=>{if(document.hidden){if(timer)clearTimeout(timer);setActive(false);setVisible(words.length);}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{alive=false;if(timer)clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',hidden);};
  },[text,reduced]);
  return <h1 ref={ref} className="chat-start-heading" aria-label={text}>
    <span className="chat-heading-measure" aria-hidden="true">{text}<span className="chat-heading-cursor"/></span>
    <span className="chat-heading-writing" aria-hidden="true">{(reduced?words:words.slice(0,visible)).join(' ')}<span className={'chat-heading-cursor'+(active&&!reduced?' is-writing':'')}/></span>
  </h1>;
}
