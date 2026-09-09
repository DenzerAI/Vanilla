import {useEffect,useState} from 'react';
export function useChatStartData(api:any,enabled:boolean,revision:number) {
 const [data,setData]=useState({jobs:[] as any[],entries:[] as any[],reports:[] as any[],error:'',loaded:false});
 useEffect(()=>{
  if(!api)return;
  let alive=true,pending=false;
  const load=async()=>{
   if(pending || document.hidden)return;pending=true;
   const results=await Promise.allSettled([api('/jobs'),api('/library'),enabled?api('/planner/results'):Promise.resolve({items:[]})]);
   pending=false;if(!alive)return;
   setData(old=>({loaded:true,jobs:results[0].status==='fulfilled'?results[0].value:old.jobs,entries:results[1].status==='fulfilled'?results[1].value.entries||[]:old.entries,reports:results[2].status==='fulfilled'?results[2].value.items||[]:old.reports,error:results.some(r=>r.status==='rejected')?'Einige Tagesinhalte konnten nicht aktualisiert werden.':''}));
  };
  void load();const visible=()=>{if(!document.hidden)void load();};window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  const changed=(e:Event)=>{if(/^(notification|job|run)\./.test((e as CustomEvent).detail?.kind||''))void load();};window.addEventListener('core/event',changed);
  return()=>{alive=false;window.removeEventListener('core/event',changed);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[api,enabled,revision]);
 return data;
}
