import {useEffect,useState} from 'react';
import {calendarCard} from './calendar-day.mjs';
import {AttentionFan} from './components/ui/attention-fan';
import {ArrowUpRight} from './icons.jsx';
import './calendar-card.css';
export function useCalendarDay(api:any,projectId:string){
 const [data,setData]=useState<any>(null);
 useEffect(()=>{let alive=true,busy=false;setData(null);async function refresh(){if(busy||document.hidden)return;busy=true;try{const result=await api('/calendar/day?'+new URLSearchParams({projectId}));if(alive)setData(result);}catch{if(alive)setData({error:true});}finally{busy=false;}}
 void refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener('calendar-changed',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('calendar-changed',refresh);};},[api,projectId]);return data;
}
export function CalendarCardContent({data,preview=false}:{data:any;preview?:boolean}){
 const [now,setNow]=useState(Date.now);useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[]);
 const card=calendarCard(data,preview?Date.parse(data.now):now),day=new Date(card.date+'T12:00:00Z');
 const label=(options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('de-DE',{timeZone:'UTC',...options}).format(day);
 const status=card.state==='error'?'Kalender nicht erreichbar':card.state==='loading'?'Kalender wird geladen …':card.state==='unavailable'?'Kalender einrichten':card.state==='stale'?'Termine möglicherweise nicht aktuell':card.events.length?'Heute keine weiteren Termine':'Heute keine Termine';
 return <span className="calendar-card-content" data-quiet={card.state==='ready'&&!card.next ? 'true' : undefined}>
  <span className="calendar-weekday">{label({weekday:'long'})}</span>
  <span className="calendar-date">{day.getUTCDate()}</span>
  <span className="calendar-month">{label({month:'long'})} · KW {card.week}</span>
  <span className="calendar-next">{card.next?<><span className="calendar-countdown">{card.relative}{!card.next.allDay?' · '+card.next.start:''}</span><span className="calendar-event-title">{card.next.title}</span></>:status}</span>
  {card.state==='stale'&&card.next&&<span className="calendar-status">Termine möglicherweise nicht aktuell</span>}
  <span className="calendar-card-action">{preview?'Beispieldaten': 'Deinen Tag besprechen'}<ArrowUpRight size={16}/></span>
 </span>;
}
export function CalendarPreview(){const now=new Date();now.setHours(9,35,0,0);const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;const events=[['Abstimmung','10:00','10:45'],['Projekt vorbereiten','13:00','14:00']].map(([title,start,end],i)=>({id:String(i),title,start,end,date,startsAt:new Date(date+'T'+start).toISOString(),endsAt:new Date(date+'T'+end).toISOString(),allDay:false}));return <AttentionFan items={[{id:'calendar',kind:'calendar',title:'Dein Tag · Beispiel',description:'Kalendervorschau',calendar:{date,now:now.toISOString(),timezone,localReady:true,feeds:[],events,preview:true}}]} onOpen={()=>{}}/>;}
