import {useState,useSyncExternalStore} from 'react';
import {SettingRow} from './settings-row.jsx';
const key='agent-weather-motion',event='agent-weather-motion-change';
const read=()=>{try{return localStorage.getItem(key)!=='off';}catch{return true;}};
const subscribe=(fn:()=>void)=>{window.addEventListener(event,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(event,fn);window.removeEventListener('storage',fn);};};
export function useWeatherMotion(){return useSyncExternalStore(subscribe,read,()=>false);}
export function WeatherMotionSetting(){
 const enabled=useWeatherMotion(),[error,setError]=useState('');
 return <SettingRow title="Wetterbewegung" description="Wolken, Licht, Regen und Schnee bewegen, auch auf seitlichen Karten. Auf diesem Gerät gespeichert.">
  <button type="button" role="switch" className="apple-switch" aria-label="Wetterbewegung" aria-checked={enabled} onClick={()=>{try{localStorage.setItem(key,enabled?'off':'on');window.dispatchEvent(new Event(event));setError('');}catch{setError('Die Auswahl konnte nicht gespeichert werden.');}}}><span/></button>
  {error&&<span role="alert">{error}</span>}
 </SettingRow>;
}
