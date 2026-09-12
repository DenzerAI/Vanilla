import {useEffect,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton';
import {formatStat} from './statistics-data.mjs';
import {featuredAllowances,remainingPercent} from '../usage.mjs';
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
 // The card shows the allowances that carry real work, as remaining share.
 if(compact){
  const featured=featuredAllowances(data.providers||[]).map((r:any)=>({...r,stale:(data.providers||[]).find((p:any)=>p.id===r.provider)?.stale||data.error}));
  return <span className="allowance-bars is-compact">
   {featured.map((r:any)=>{
    const left=remainingPercent(r,now);
    return <span className="allowance-row" key={r.provider+r.id} data-level={left===null?'unknown':left<=10?'low':left<=25?'warn':'ok'}>
     <span className="allowance-label" title={resetLabel(r.resetAt,now)}><span>{r.label}</span><span>{left===null?(r.missing?'Nicht verfügbar':'–'):`${formatStat(left)} % übrig`}</span></span>
     <span className="allowance-track" role={left===null?'img':'meter'} aria-label={`${r.label}, übrig${r.stale?', letzter bekannter Stand':''}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={left??undefined} aria-valuetext={left===null?(r.missing?'Wochenkontingent nicht verfügbar':'Neuer Stand ausstehend'):`${left} Prozent übrig`}><span style={{width:`${left??0}%`}}/></span>
     <span className="usage-note allowance-reset">{r.stale?'Letzter Stand · ':''}{resetLabel(r.resetAt,now)}</span>
    </span>;})}
   {(data.providers||[]).filter((p:any)=>p.status!=='ready').map((p:any)=><span key={p.id} className="usage-note" title={p.unavailableReason==='profile_required'?'Der Claude-Dienstzugang erlaubt Modellaufrufe, aber keine Abo-Abfrage. Claude Code für diese Installation mit deinem Abo anmelden.':undefined}>{p.name}: {p.unavailableReason==='profile_required'?'Für Abo-Werte erneut anmelden':p.status==='error'?'Aktualisierung fehlgeschlagen':'Abo-Kontingent nicht verfügbar'}</span>)}
   {!data.providers?.length&&<span className="usage-note">Noch kein Anbieter für Kontingente eingerichtet.</span>}
   {!!featured.length&&rows.length>featured.filter((r:any)=>!r.missing).length&&<span className="usage-note">+ {rows.length-featured.filter((r:any)=>!r.missing).length} weitere Kontingente</span>}
  </span>;
 }
 const shown=rows;
 return <span className="allowance-bars">
  {shown.map((r:any)=><span className="allowance-row" key={r.provider+r.id}>
   <span className="allowance-label"><span>{r.label}</span><span>{r.expired||r.resetAt!==null&&r.resetAt<=now?'–':`${formatStat(r.usedPercent)} %`}</span></span>
   <span className="allowance-track" role={r.expired||r.resetAt!==null&&r.resetAt<=now?"img":"meter"} aria-label={`${r.label}, verbraucht${r.stale?', letzter bekannter Stand':''}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.expired||r.resetAt!==null&&r.resetAt<=now?undefined:Math.min(r.usedPercent,100)} aria-valuetext={r.expired||r.resetAt!==null&&r.resetAt<=now?'Neuer Stand ausstehend':`${r.usedPercent} Prozent verbraucht`}><span style={{width:`${r.expired||r.resetAt!==null&&r.resetAt<=now?0:Math.min(r.usedPercent,100)}%`}}/></span>
   <span className="usage-note">{r.stale?'Letzter Stand · ':''}{resetLabel(r.resetAt,now)}</span>
  </span>)}
  {(data.providers||[]).filter((p:any)=>p.status!=='ready').map((p:any)=><span key={p.id} className="usage-note" title={p.unavailableReason==='profile_required'?'Der Claude-Dienstzugang erlaubt Modellaufrufe, aber keine Abo-Abfrage. Claude Code für diese Installation mit deinem Abo anmelden.':undefined}>{p.name}: {p.unavailableReason==='profile_required'?'Für Abo-Werte erneut anmelden':p.status==='error'?'Aktualisierung fehlgeschlagen':'Abo-Kontingent nicht verfügbar'}</span>)}
  {!data.providers?.length&&<span className="usage-note">Noch kein Anbieter für Kontingente eingerichtet.</span>}
 </span>;
}
export function UsageSettings({api}:{api:any}){
 const data=useAllowances(api);
 return <UsageDetails data={data}/>;
}
export function UsageDetails({data}:{data:any}){
 return <section className="usage-settings" data-capability="chat.allowances" aria-label="Anbieter-Kontingente">
  <p className="usage-note">Kontoweite Nutzung von Codex und Claude, einschließlich anderer Geräte. Die Balken zeigen den verbrauchten Anteil. Aktualisierung jede Minute, solange diese Ansicht sichtbar ist.</p>
  {!data?<Skeleton variant="settings" rows={2} label="Kontingente werden geladen …"/>:<>
   {data.error&&<p className="usage-note" role="alert">Kontingente konnten nicht aktualisiert werden. Erneuter Versuch bei der nächsten Aktualisierung.</p>}
   {!data.providers?.length&&!data.error&&<p className="usage-note">Noch kein Anbieter für Kontingente eingerichtet.</p>}
   {data.providers?.map((p:any)=><div className="settings-group" key={p.id}>
    <SettingRow title={p.name} description={p.updatedAt?`${p.stale||data.error?'Letzter bekannter Stand':'Abgerufen'}: ${new Date(p.updatedAt).toLocaleString('de-DE')}`:undefined}/>
    <div className="usage-provider-content">
     <AllowanceBars data={{providers:[p],error:data.error}}/>
     {p.resetCredits!=null&&<p className="usage-note">{formatStat(p.resetCredits)} verfügbare Kontingent-Resets</p>}
     {p.credits?.map((c:any)=><p className="usage-note" key={c.label}>{c.label} · Credits: {c.unlimited?'Unbegrenzt':c.balance??'Nicht gemeldet'}</p>)}
     {p.extra&&<p className="usage-note">Zusatzverbrauch: {p.extra.enabled?`${formatStat(p.extra.used)} von ${formatStat(p.extra.limit)} ${p.extra.currency||'Credits'}`:'Ausgeschaltet'}</p>}
    </div>
   </div>)}
  </>}
 </section>;
}
export function TokenBreakdown({data}:{data:any}){
 const rows=[['Eingabe','inputTokens'],['Ausgabe','outputTokens'],['Cache gelesen','cachedInputTokens'],['Cache geschrieben','cacheCreationInputTokens'],['Davon Reasoning','reasoningOutputTokens']];
 return <dl className="statistics-metrics usage-token-metrics">{rows.map(([label,key])=><div key={key}><dt>{label}</dt><dd>{formatStat(data?.[key])}</dd></div>)}</dl>;
}
