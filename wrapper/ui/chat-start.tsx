import {useAllowances,AllowanceDashboard} from './usage';
import {useStatisticsData} from './statistics-client';
import {useChatStartData} from './chat-start-data';
import {useMemo,useState,useCallback,useRef} from 'react';
import {AttentionFan,type AttentionItem} from './components/ui/attention-fan';
import {chatStartFeed,headlinesForItem} from './chat-start-feed.mjs';
import {ChatStartHeading} from './chat-start-heading';
import {Avatar} from './avatar.jsx';
export function ChatStart({greeting,profile,requests,notifications,chats,projectId,onOpen,error,composing=false,api,routines=false,revision=0,visible=true}:{greeting:string;profile:any;requests:any[];notifications:any[];chats:any[];projectId:string;onOpen:(item:AttentionItem)=>Promise<void>|void;error?:string;composing?:boolean;api?:any;routines?:boolean;revision?:number;visible?:boolean}) {
  const allowances=useAllowances(api,visible);
  const [showAllowances,setShowAllowances]=useState(false);
  const data=useChatStartData(api,routines,revision,visible);
  const statistics=useStatisticsData(api,projectId,JSON.stringify(chats.map(c=>[c.id,c.updatedAt,c.lastCompletedTurnId])),false,visible);
  const firstCard=useRef('');
  const items=useMemo(()=>chatStartFeed({requests,notifications,chats,projectId,...data,includeWeather:!data.profileLoading,includeCalendar:true,includeStatistics:true,statistics,includeAllowances:true,allowances}),[requests,notifications,chats,projectId,data,statistics,allowances]);
  const [selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[failure,setFailure]=useState(''),[interacting,setInteracting]=useState(false);
  if(data.loaded&&!firstCard.current)firstCard.current=items[0]?.id||'';
  const choose=useCallback((item:AttentionItem)=>setSelected(item.id),[]);
  const open=async(item:AttentionItem)=>{if(item.kind==='allowances'){setShowAllowances(true);return;}if(busy)return;setBusy(true);setFailure('');try{await onOpen(item);}catch(e){setFailure((e as Error).message || 'Das Gespräch konnte nicht geöffnet werden. Bitte versuche es erneut.');}finally{setBusy(false);}};
  if(showAllowances)return <AllowanceDashboard data={allowances} onBack={()=>setShowAllowances(false)}/>;
  return <div className="welcome agent-chat-welcome chat-start" onMouseEnter={()=>setInteracting(true)} onMouseLeave={()=>setInteracting(false)} onFocus={()=>setInteracting(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setInteracting(false);}}>
    <div className="chat-start-intro">
    <Avatar avatar={profile.avatar} color={profile.avatarColor} large/>
    <ChatStartHeading paused={composing || busy} pauseAdvance={interacting} texts={headlinesForItem(items.find(item=>item.id===selected) || items[0],greeting,(!selected||selected===firstCard.current)?data.userProfile.name:'')} reduceMotion={profile.reduceMotion==='on'}/>
    </div>
    <AttentionFan api={api} items={items} onOpen={open} onActiveChange={choose} reduceMotion={profile.reduceMotion==='on'} disabled={busy}/>
    {(failure || error || data.error)&&<p role="alert" className="chat-start-error">{failure || data.error || 'Neue Hinweise konnten gerade nicht geladen werden. Die Glocke bleibt erreichbar.'}</p>}
  </div>;
}
