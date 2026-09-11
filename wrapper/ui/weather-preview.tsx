import {useState} from 'react';
import {AttentionFan} from './components/ui/attention-fan';
export const weatherExamples = [
 {id:'sunny',label:'Sonne',code:0,temperature:24,high:26,low:15},
 {id:'partly',label:'Sonne & Wolken',code:2,temperature:19,high:22,low:12},
 {id:'cloudy',label:'Bedeckt',code:3,temperature:16,high:18,low:11},
 {id:'drizzle',label:'Nieselregen',code:51,temperature:13,high:15,low:10},
 {id:'heavy-rain',label:'Starkregen',code:65,temperature:11,high:14,low:9},
 {id:'wind',label:'Windig',code:2,temperature:16,high:19,low:12,wind:36,gusts:55},
 {id:'hail',label:'Hagelgewitter',code:99,temperature:18,high:23,low:14},
 {id:'rime',label:'Reifnebel',code:48,temperature:-2,high:0,low:-5},
 {id:'rain',label:'Regen',code:63,temperature:12,high:15,low:9},
 {id:'snow',label:'Schnee',code:73,temperature:-2,high:0,low:-5},
 {id:'frost',label:'Frost',code:0,temperature:-7,high:-2,low:-9},
 {id:'ice',label:'Gefrierender Regen',code:66,temperature:-1,high:1,low:-3},
 {id:'fog',label:'Nebel',code:45,temperature:8,high:11,low:6},
 {id:'storm',label:'Gewitter',code:95,temperature:21,high:26,low:18},
 {id:'warning',label:'Warnung · Beispiel',code:95,temperature:21,previewWarning:'Beispiel: Unwetterwarnung'},
];
export function WeatherPreview({initialState='sunny',initialNight=false}:{initialState?:string;initialNight?:boolean}={}){
 const [selected,setSelected]=useState(weatherExamples.some(x=>x.id===initialState)?initialState:'sunny'),[phase,setPhase]=useState(initialNight?'night':'day'),[opened,setOpened]=useState(false);
 const example=weatherExamples.find(x=>x.id===selected)!;
 const sunrise=Date.UTC(2026,5,21,6),sunset=Date.UTC(2026,5,21,20);
 const time=({dawn:sunrise-1800000,morning:sunrise+1800000,day:sunrise+6*3600000,sunset:sunset-1800000,dusk:sunset+1800000,night:sunset+3*3600000})[phase]??sunrise+6*3600000;
 const weather={...example,status:'ready',preview:true,isDay:time>=sunrise&&time<sunset,sunrise,sunset,time};
 return <div className="weather-preview">
  <div className="weather-preview-controls" role="group" aria-label="Wetterzustand">{weatherExamples.map(x=><button key={x.id} type="button" aria-pressed={selected===x.id} onClick={()=>{setSelected(x.id);setOpened(false);}}>{x.label}</button>)}</div>
  <div className="weather-preview-controls" role="group" aria-label="Tageszeit">{[['dawn','Morgendämmerung'],['morning','Morgen'],['day','Tag'],['sunset','Sonnenuntergang'],['dusk','Abenddämmerung'],['night','Nacht']].map(([id,label])=><button key={id} type="button" aria-pressed={phase===id} onClick={()=>setPhase(id)}>{label}</button>)}</div>
  <AttentionFan key={selected} items={[
   {id:'weather',kind:'weather',title:'Beispielstadt',description:`${example.temperature} °C · ${example.label}`,weather,weatherConfigured:true},
   {id:'answer',kind:'chat',title:'Deine Antwort ist da',description:'Hier können wir weitermachen.'},
   {id:'next',kind:'job',title:'Dein nächster Auftrag',description:'Alles an seinem Platz.'},
  ]} onOpen={()=>setOpened(true)}/>
  <p className="page-note" role="status">{opened?'Designvorschau. Im Chat öffnet die Wetterkarte eine neue Session mit aktuellem Bericht, Sieben-Tage-Ausblick und passender Einordnung.':'Beispieldaten. Die Auswahl verändert weder deinen Ort noch dein aktuelles Wetter. Warnungen benötigen eine eigene Warnquelle.'}</p>
 </div>;
}
