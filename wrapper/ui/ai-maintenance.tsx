import React, {useEffect, useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton.tsx';

type Entry = {id:string;name:string;program?:string;kind:string;source:string;note?:string;phase?:string;installed?:boolean;connected?:boolean;installedVersion?:string;latest?:string;checkedAt?:number;error?:string;models?:string[];publicModels?:{id:string;name:string;releasedAt:string;openWeights:boolean}[];canManage?:boolean};
type State = {modelCatalogError?:string;modelCatalogCheckedAt?:number;automatic:boolean;checkedAt:number|null;checking:boolean;items:Entry[]};
const phases:Record<string,string>={checking:'Wird geprüft',installing:'Wird aktualisiert',waiting:'Update wartet auf eine Arbeitspause',available:'Update verfügbar',current:'Aktuell',unknown:'Installiert · Version nicht erkennbar',error:'Prüfung fehlgeschlagen',external:'Updates beim Anbieter', 'not-installed':'Nicht installiert'};
const stamp=(value?:number|null)=>value?new Date(value).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}):'Noch nicht geprüft';
export function AIMaintenanceSettings({api}:{api:(path:string,body?:unknown)=>Promise<any>}) {
 const [data,setData]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState('');
 useEffect(()=>{let alive=true,pending=false;
  const load=async()=>{if(pending)return;pending=true;try{const value=await api('/ai-maintenance');if(alive){setData(value);setError('');}}catch{if(alive)setError('KI-Aktualisierungen konnten nicht geladen werden.');}finally{pending=false;}};
  void load();const timer=setInterval(()=>{if(!document.hidden)void load();},5000);
  return()=>{alive=false;clearInterval(timer);};
 },[api]);
 async function act(route:string,body:unknown){setBusy(true);setError('');try{setData(await api(route,body));}catch{setError('Änderung fehlgeschlagen. Bitte erneut versuchen.');}finally{setBusy(false);}}
 if(!data&&!error)return <Skeleton variant="settings" label="KI-Aktualisierungen laden"/>;
 return <section className="worker-settings" aria-label="KI-Aktualisierungen">
  {error&&<p className="worker-error" role="alert">{error}</p>}
  <h3>Aktuell bleiben</h3>
  <div className="settings-group">
   <SettingRow title="Im Hintergrund prüfen" description={data?.checking?'Versionsquellen werden geprüft …':`Alle sechs Stunden · ${stamp(data?.checkedAt)}`} action={<button disabled={busy||data?.checking} onClick={()=>void act('/ai-maintenance/check',{})}>Jetzt prüfen</button>}/>
   {data&&<SettingRow title="Programme automatisch aktualisieren" description="Codex und Gemini werden in einer Arbeitspause aktualisiert. Deine Modellwahl bleibt erhalten." action={<button type="button" role="switch" className="apple-switch" aria-label="Programme automatisch aktualisieren" aria-checked={data.automatic} disabled={busy} onClick={()=>void act('/ai-maintenance/settings',{automatic:!data.automatic})}><span/></button>}/>}
  </div>
  <h3>KI entdecken</h3>
  <p className="worker-routing">Öffentlicher Modellkatalog von <a href="https://models.dev" target="_blank" rel="noreferrer">Models.dev</a> · {stamp(data?.modelCatalogCheckedAt)}. Ein Katalogeintrag bedeutet noch keinen eingerichteten Zugang.</p>
  {data?.modelCatalogError&&<p role="status">{data.modelCatalogError}</p>}
  <div className="local-controls"><input type="search" aria-label="KI und Modelle suchen" placeholder="GPT, Gemini, DeepSeek, Kimi …" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="settings-group">{data?.items.filter(item=>`${item.name} ${item.program||''} ${(item.models||[]).join(' ')} ${(item.publicModels||[]).map(m=>m.name).join(' ')}`.toLowerCase().includes(query.toLowerCase())).map(item=><React.Fragment key={item.id}>
   <SettingRow title={item.name} description={`${item.kind==='local'?'Auf deinem Rechner':item.kind==='agent'?'KI-Programm':'Cloud-KI'}${item.program?' · '+item.program:''} · ${item.phase?phases[item.phase]:'Noch nicht geprüft'}${item.connected?' · Verbunden':''}${item.publicModels?.[0]?' · Im Katalog: '+item.publicModels[0].name:''}`} action={<a className="button" href={item.source} target="_blank" rel="noreferrer">Beim Anbieter ↗</a>}/>
   <details className="worker-detail"><summary>Versionen & Details · {item.program||item.name}</summary>
    {!!item.publicModels?.length&&<p>Zuletzt veröffentlicht laut Katalog: {item.publicModels.slice(0,5).map(m=>`${m.name} (${m.releasedAt}${m.openWeights?', offene Modellgewichte':''})`).join('; ')}.</p>}
    {item.note&&<p>{item.note}</p>}
    <p>Installiert: {item.installedVersion||(item.installed?'Version unbekannt':'Nein')}. Neueste stabile Programmversion: {item.latest||'Nicht automatisch ermittelbar'}.</p>
    <p>Letzte erfolgreiche Versionsprüfung: {stamp(item.checkedAt)}.</p>
    {item.error&&<p role="status">{item.error}</p>}
    {!item.canManage&&<p>Die automatische Installation ist für diesen Anschluss noch nicht verfügbar.</p>}
    {!!item.models?.length&&<p>Über deinen Anschluss gemeldete Modelle: {item.models.join(', ')}.</p>}
    <p>Modelle und Zugänge sind vom installierten Programm unabhängig. Die tatsächliche Auswahl hängt von deinem Konto oder den lokal geladenen Modellen ab.</p>
   </details>
  </React.Fragment>)}</div>
  {data&&!data.items.some(item=>`${item.name} ${item.program||''} ${(item.models||[]).join(' ')} ${(item.publicModels||[]).map(m=>m.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()))&&<p>Keine passende KI gefunden.</p>}
 </section>;
}

export function AIMaintenancePreview() {
 const value=React.useRef<State>({automatic:true,checkedAt:Date.UTC(2026,0,1,12),checking:false,items:[
  {id:'codex',name:'OpenAI · GPT',program:'Codex',kind:'cloud',source:'https://developers.openai.com/codex/cli/',installed:true,connected:true,installedVersion:'1.0.0',latest:'1.1.0',phase:'waiting',canManage:true},
  {id:'gemini',name:'Google · Gemini',program:'Gemini CLI',kind:'cloud',source:'https://geminicli.com/docs/',installed:false,latest:'1.0.0',phase:'not-installed',canManage:true},
  {id:'deepseek',name:'DeepSeek',kind:'cloud',source:'https://api-docs.deepseek.com/',phase:'external',note:'Modellzugang separat einrichten.'},
 ]});
 const api=React.useCallback(async(route:string,body?:any)=>{if(route.endsWith('/settings'))value.current={...value.current,automatic:body.automatic};return structuredClone(value.current);},[]);
 return <><p className="page-note">Beispielzustände mit fiktiven Versionen. Keine Installation oder Netzabfrage.</p><AIMaintenanceSettings api={api}/></>;
}
