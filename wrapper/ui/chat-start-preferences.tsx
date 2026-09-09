import {useState,useSyncExternalStore} from 'react';
import {SettingRow} from './settings-row.jsx';
const key='agent-start-text-motion',event='agent-start-text-change';
const read=()=>{try{return localStorage.getItem(key)!=='off';}catch{return true;}};
const subscribe=(fn:()=>void)=>{window.addEventListener(event,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(event,fn);window.removeEventListener('storage',fn);};};
export function useStartTextMotion(){return useSyncExternalStore(subscribe,read,()=>false);}
export function StartTextMotionSetting(){
 const enabled=useStartTextMotion(),[error,setError]=useState('');
 return <SettingRow title="Lebendiger Starttext" description="Langsames Schreiben und wechselnde Impulse. Auf diesem Gerät gespeichert.">
  <button type="button" role="switch" className="apple-switch" aria-label="Lebendiger Starttext" aria-checked={enabled} onClick={()=>{try{localStorage.setItem(key,enabled?'off':'on');window.dispatchEvent(new Event(event));setError('');}catch{setError('Die Auswahl konnte nicht gespeichert werden.');}}}><span/></button>
  {error&&<span role="alert">{error}</span>}
 </SettingRow>;
}
