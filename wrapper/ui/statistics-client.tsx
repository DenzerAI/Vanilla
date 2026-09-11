import {useEffect,useState} from 'react';
export const statisticsTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Berlin';
export function useStatisticsData(api:any,projectId:string,revision:string,live=false,enabled=true) {
 const [state,setState]=useState<{projectId:string;data:any}>({projectId:'',data:null});
 useEffect(()=>{if(!api||!enabled)return;let alive=true,pending=false,lastLoad=0;const load=async()=>{if(pending||document.hidden)return;pending=true;try{const data=await api('/statistics?projectId='+encodeURIComponent(projectId)+'&timeZone='+encodeURIComponent(statisticsTimeZone()));if(alive)setState({projectId,data});}catch{if(alive)setState({projectId,data:{error:true}});}finally{pending=false;lastLoad=Date.now();}};void load();const timer=live?setInterval(load,15000):null;const visible=()=>{if(!document.hidden&&Date.now()-lastLoad>15000)void load();};window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);return()=>{alive=false;if(timer)clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};},[api,projectId,revision,live,enabled]);
 return state.projectId===projectId?state.data:null;
}
