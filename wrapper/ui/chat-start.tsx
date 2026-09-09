import {useMemo,useState,useCallback} from 'react';
import {AttentionFan,type AttentionItem} from './components/ui/attention-fan';
import {chatStartFeed,headlinesForItem} from './chat-start-feed.mjs';
import {ChatStartHeading} from './chat-start-heading';
import {Avatar} from './avatar.jsx';
export function ChatStart({greeting,profile,requests,notifications,chats,projectId,onOpen,error,composing=false}:{greeting:string;profile:any;requests:any[];notifications:any[];chats:any[];projectId:string;onOpen:(item:AttentionItem)=>Promise<void>|void;error?:string;composing?:boolean}) {
  const items=useMemo(()=>chatStartFeed({requests,notifications,chats,projectId}),[requests,notifications,chats,projectId]);
  const [selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[failure,setFailure]=useState(''),[interacting,setInteracting]=useState(false);
  const choose=useCallback((item:AttentionItem)=>setSelected(item.id),[]);
  const open=async(item:AttentionItem)=>{if(busy)return;setBusy(true);setFailure('');try{await onOpen(item);}catch(e){setFailure((e as Error).message || 'Das Gespräch konnte nicht geöffnet werden. Bitte versuche es erneut.');}finally{setBusy(false);}};
  return <div className="welcome agent-chat-welcome chat-start" onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocus={()=>setInteracting(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setInteracting(false);}}>
    <div className="chat-start-intro">
    <Avatar avatar={profile.avatar} color={profile.avatarColor} large/>
    <ChatStartHeading paused={composing || interacting || busy} texts={headlinesForItem(items.find(item=>item.id===selected) || items[0],greeting)} reduceMotion={profile.reduceMotion==='on'}/>
    </div>
    <AttentionFan items={items} onOpen={open} onActiveChange={choose} reduceMotion={profile.reduceMotion==='on'} disabled={busy}/>
    {(failure || error)&&<p role="alert" className="chat-start-error">{failure || 'Neue Hinweise konnten gerade nicht geladen werden. Die Glocke bleibt erreichbar.'}</p>}
  </div>;
}
