import {loadWeather,weatherInterval} from './weather-client.mjs';
import {useEffect,useState} from 'react';
import {readUserProfile,userProfilePath} from './user-profile.mjs';
export function useChatStartData(api:any,enabled:boolean,revision:number) {
 const [data,setData]=useState({jobs:[] as any[],entries:[] as any[],reports:[] as any[],userProfile:{name:'',location:''},weather:null as any,profileError:false,error:'',loaded:false});
 useEffect(()=>{
  if(!api)return;
  let alive=true,pending=false,weatherRun=0;
  const load=async()=>{
   if(pending || document.hidden)return;pending=true;
   const results=await Promise.allSettled([api('/jobs'),enabled?api('/planner/results'):Promise.resolve({items:[]}),api('/file/text?path='+encodeURIComponent(userProfilePath))]);
   pending=false;if(!alive)return;
   const profile=results[2].status==='fulfilled'?readUserProfile(results[2].value.text):null;
   const run=++weatherRun;
   if(profile){void loadWeather(api,profile).then((weather:any)=>{if(alive&&run===weatherRun)setData(old=>({...old,weather}));});}
   setData(old=>({weather:profile&&JSON.stringify(profile)===JSON.stringify(old.userProfile)?old.weather:{status:'loading'},loaded:true,userProfile:results[2].status==='fulfilled'?readUserProfile(results[2].value.text):old.userProfile,profileError:results[2].status==='rejected',jobs:results[0].status==='fulfilled'?results[0].value:old.jobs,entries:old.entries,reports:results[1].status==='fulfilled'?results[1].value.items||[]:old.reports,error:results.some(r=>r.status==='rejected')?'Einige Tagesinhalte konnten nicht aktualisiert werden.':''}));
  };
  void load();const timer=setInterval(()=>void load(),weatherInterval);const visible=()=>{if(!document.hidden)void load();};window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  const changed=(e:Event)=>{if(/^(notification|job|run)\./.test((e as CustomEvent).detail?.kind||''))void load();};window.addEventListener('core/event',changed);window.addEventListener('user-profile-saved',visible);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('user-profile-saved',visible);window.removeEventListener('core/event',changed);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[api,enabled,revision]);
 return data;
}
