import {useEffect,useState} from 'react';
import {ChevronLeft} from './icons.jsx';
import {formatStat} from './statistics-data.mjs';
import './usage.css';
export function useAllowances(api:any,enabled=true){
 const [data,setData]=useState<any>(null);
 useEffect(()=>{if(!api||!enabled)return;let alive=true,pending=false,lastLoad=0;
 const load=async()=>{if(pending||document.hidden)return;pending=true;try{const result=await api('/usage/allowances');if(alive)setData(result);}catch{if(alive)setData((old:any)=>({...old,error:true}));}finally{pending=false;lastLoad=Date.now();}};
 void load();const timer=setInterval(load,60000);const refresh=()=>{if(Date.now()-lastLoad>15000)void load();};document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);
 return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};},[api,enabled]);return data;
}
function resetLabel(value:number|null,now:number){
 if(value===null)return 'Reset nicht gemeldet';
 if(value<=now)return 'Reset erreicht · neuer Stand ausstehend';
 const mins=Math.ceil((value-now)/60000),time=new Date(value).toLocaleString('de-DE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return `Reset ${time} · in ${mins<60?`${mins} Min.`:mins<1440?`${Math.floor(mins/60)} Std. ${mins%60} Min.`:`${Math.floor(mins/1440)} Tagen`}`;
}
export function AllowanceBars({data,compact=false}:{data:any;compact?:boolean}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const tick=()=>{if(!document.hidden)setNow(Date.now());};const timer=setInterval(tick,60000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 if(!data)return <span className="usage-note">Kontingente werden geladen …</span>;
 if(data.error&&!data.providers)return <span className="usage-note" role="status">Kontingente gerade nicht erreichbar.</span>;
 const rows=(data.providers||[]).flatMap((p:any)=>p.rows.map((r:any)=>({...r,provider:p.id,stale:p.stale||data.error})));
 // A compact card gives each provider a place; details retain every native bucket.
 const featured=(data.providers||[]).flatMap((p:any)=>{const own=rows.filter((r:any)=>r.provider===p.id);return own.slice(0,1);});
 const shown=compact?[...featured,...rows.filter((r:any)=>!featured.includes(r))].slice(0,2):rows;
 return <span className={'allowance-bars'+(compact?' is-compact':'')}>
  {shown.map((r:any)=><span className="allowance-row" key={r.provider+r.id}>
   <span className="allowance-label"><span>{r.label}</span><span>{r.expired||r.resetAt!==null&&r.resetAt<=now?'–':`${formatStat(r.usedPercent)} %`}</span></span>
   <span className="allowance-track" role={r.expired||r.resetAt!==null&&r.resetAt<=now?"img":"meter"} aria-label={`${r.label}, verbraucht${r.stale?', letzter bekannter Stand':''}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.expired||r.resetAt!==null&&r.resetAt<=now?undefined:Math.min(r.usedPercent,100)} aria-valuetext={r.expired||r.resetAt!==null&&r.resetAt<=now?'Neuer Stand ausstehend':`${r.usedPercent} Prozent verbraucht`}><span style={{width:`${r.expired||r.resetAt!==null&&r.resetAt<=now?0:Math.min(r.usedPercent,100)}%`}}/></span>
   <span className="usage-note">{r.stale?'Letzter Stand · ':''}{resetLabel(r.resetAt,now)}</span>
  </span>)}
  {(data.providers||[]).filter((p:any)=>p.status!=='ready').map((p:any)=><span key={p.id} className="usage-note">{p.name}: {p.status==='error'?'Aktualisierung fehlgeschlagen':'Abo-Kontingent nicht verfügbar'}</span>)}
  {!data.providers?.length&&<span className="usage-note">Noch kein Anbieter für Kontingente eingerichtet.</span>}
  {compact&&rows.length>shown.length&&<span className="usage-note">+ {rows.length-shown.length} weitere Kontingente</span>}
 </span>;
}
export function AllowanceDashboard({data,onBack}:{data:any;onBack:()=>void}){
 return <section className="statistics-report allowance-report" data-capability="chat.allowances" aria-label="Kontingente">
  <div className="statistics-heading"><button className="statistics-back" onClick={onBack}><ChevronLeft size={16}/><span>Zurück zu den Kacheln</span></button><h2>Kontingente</h2></div>
  <AllowanceBars data={data}/>
  {data?.providers?.map((p:any)=><div className="usage-provider-details" key={p.id}>
   {p.resetCredits!=null&&<p>{p.name}: {formatStat(p.resetCredits)} verfügbare Kontingent-Resets</p>}
   {p.credits?.map((c:any)=><p key={c.label}>{c.label} · Credits: {c.unlimited?'Unbegrenzt':c.balance??'Nicht gemeldet'}</p>)}
   {p.extra&&<p>{p.name} · Zusatzverbrauch: {p.extra.enabled?`${formatStat(p.extra.used)} von ${formatStat(p.extra.limit)} ${p.extra.currency||'Credits'}`:'Ausgeschaltet'}</p>}
  </div>)}
  <p className="usage-note">Kontoweite Anbieterwerte · Prozent = verbrauchtes Kontingent. Aktualisierung jede Minute, solange diese Ansicht sichtbar ist.</p>
  {data?.updatedAt&&<p className="statistics-stamp">Abgerufen: {new Date(data.updatedAt).toLocaleString('de-DE')} · Zeiten in deiner Zeitzone</p>}
 </section>;
}
export function TokenBreakdown({data}:{data:any}){
 const rows=[['Eingabe','inputTokens'],['Ausgabe','outputTokens'],['Cache gelesen','cachedInputTokens'],['Cache geschrieben','cacheCreationInputTokens'],['Davon Reasoning','reasoningOutputTokens']];
 return <dl className="statistics-metrics usage-token-metrics">{rows.map(([label,key])=><div key={key}><dt>{label}</dt><dd>{formatStat(data?.[key])}</dd></div>)}</dl>;
}
