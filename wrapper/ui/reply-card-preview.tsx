import {useEffect,useState} from 'react';
import {replyPreview} from './chat-start-feed.mjs';
import type {AttentionItem} from './components/ui/attention-fan';

/** Fetch only the visible cards, through the existing protected conversation route. */
export function ReplyCardPreview({api,item}:{api?:any;item:AttentionItem}) {
 const key=JSON.stringify([item.threadId,item.turnId]);
 const [preview,setPreview]=useState({key:'',text:''});
 useEffect(()=>{
  if(!api||!item.threadId||!item.turnId)return;
  let alive=true;
  api('/thread?id='+encodeURIComponent(item.threadId)).then((result:any)=>{
   if(alive)setPreview({key,text:replyPreview(result.thread,item.turnId)||'Antwort im Gespräch ansehen.'});
  }).catch(()=>{if(alive)setPreview({key,text:'Vorschau nicht verfügbar. Antwort im Gespräch ansehen.'});});
  return()=>{alive=false;};
 },[api,key,item.threadId,item.turnId]);
 return <span className="attention-fan-description">{preview.key===key?preview.text:api?'Antwort wird geladen …':item.description||'Antwort im Gespräch ansehen.'}</span>;
}
