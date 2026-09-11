import {loadWeather,weatherInterval} from './weather-client.mjs';
import {useEffect,useState} from 'react';
import {readUserProfile} from './user-profile.mjs';
import {loadStartData} from './start-data-loader.mjs';
export function useChatStartData(api:any,enabled:boolean,revision:number,visiblePane=true) {
 const [data,setData]=useState({jobs:[] as any[],entries:[] as any[],reports:[] as any[],userProfile:{name:'',location:''},weather:null as any,profileError:false,profileLoading:true,error:'',loaded:false});
 useEffect(()=>{
  if(!api||!visiblePane)return;
  let alive=true,pending=false,weatherRun=0,lastLoad=0;
  const load=async()=>{
   if(pending || document.hidden)return;pending=true;
   const run=++weatherRun;
   const failures=new Set();
   await loadStartData(api,enabled,(key:string,result:any)=>{
    if(!alive)return;
    if(result.error)failures.add(key);
    const profile=key==='profile'&&!result.error?readUserProfile(result.value.text):null;
    setData(old=>({...old,loaded:true,error:failures.size?'Einige Tagesinhalte konnten nicht aktualisiert werden.':'',
      ...(key==='jobs'&&!result.error?{jobs:result.value}:{}),
      ...(key==='reports'&&!result.error?{reports:result.value.items||[]}:{}),
      ...(key==='profile'?{profileError:!!result.error,profileLoading:false}:{}),
      ...(profile?{userProfile:profile,weather:JSON.stringify(profile)===JSON.stringify(old.userProfile)?old.weather:{status:'loading'}}:{})}));
    if(profile)void loadWeather(api,profile).then((weather:any)=>{if(alive&&run===weatherRun)setData(old=>({...old,weather}));});
   });
   pending=false;lastLoad=Date.now();
  };
  void load();const timer=setInterval(()=>void load(),weatherInterval);const visible=()=>{if(!document.hidden&&Date.now()-lastLoad>15000)void load();};window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  const changed=(e:Event)=>{if(/^(notification|job|run)\./.test((e as CustomEvent).detail?.kind||''))void load();};window.addEventListener('core/event',changed);window.addEventListener('user-profile-saved',load);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('user-profile-saved',load);window.removeEventListener('core/event',changed);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[api,enabled,revision,visiblePane]);
 return data;
}
