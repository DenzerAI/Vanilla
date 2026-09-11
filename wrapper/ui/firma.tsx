import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronRight,Check} from './icons.jsx';
import {Skeleton} from './skeleton';
import {firmaSteps} from '../firma-catalog.mjs';
import './firma.css';
type Item={id:string;title:string;status:string;threadId?:string|null};
type Step={id:string;title:string;complete:boolean;unlocked:boolean;items:Item[]};
type State={steps:Step[];complete:number;total:number;percent:number};
type Api=(url:string,body?:unknown)=>Promise<any>;
const labels:Record<string,string>={open:'',working:'In Arbeit',ready:'Bestätigen',review:'Erneut prüfen',complete:'Bestätigt'};
export function FirmaList({state,onOpen,busy,error}:{state:State;onOpen:(id:string)=>void;busy?:string;error?:string}){
 return <div className="firma-list">
  {state.steps.map((step,index)=><details className="firma-step" key={step.id}>
   <summary><span className={'firma-step-number'+(step.complete?' complete':'')}>{step.complete?<Check size={16}/>:index+1}</span><span className="firma-step-title">{step.title}</span><span className="firma-count">{step.items.filter(i=>i.status==='complete').length}/{step.items.length}</span><ChevronDown size={16}/></summary>
   <div className="firma-items">{step.items.map(item=><button className="firma-item" type="button" key={item.id} disabled={!!busy} onClick={()=>onOpen(item.id)} aria-label={item.title+' · '+(labels[item.status]?labels[item.status]+' · ':'')+'Im Chat öffnen'}><span>{item.title}</span><span className="firma-item-end"><span className="firma-item-status">{busy===item.id?'Öffnen …':labels[item.status]}</span>{item.status==='complete'?<Check size={16}/>:<ChevronRight size={16}/>}</span></button>)}{!step.unlocked&&<p className="firma-hint">Vorbereiten geht schon. Bestätigen nach den vorherigen Schritten.</p>}</div>
  </details>)}
  {error&&<p className="firma-error" role="alert">{error}</p>}
 </div>;
}
export function FirmaPage({PageHeading,api,onChat,onShowSidebar}:{PageHeading:React.ComponentType<any>;api:Api;onChat:(id:string,warning?:string)=>Promise<void>;onShowSidebar?:()=>void}){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const live=useRef(true),sequence=useRef(0),opening=useRef(false);
 async function load(){const seq=++sequence.current;try{const next=await api('/firma');if(live.current&&sequence.current===seq){setState(next);setError('');}}catch(e){if(live.current&&sequence.current===seq)setError(e instanceof Error?e.message:'Firma konnte nicht geladen werden.');}}
 useEffect(()=>{live.current=true;void load();const refresh=()=>{if(!document.hidden)void load();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);const timer=window.setInterval(refresh,15000);return()=>{live.current=false;sequence.current++;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[api]);
 async function open(id:string){if(opening.current)return;opening.current=true;setBusy(id);setError('');try{const result=await api('/firma/chat',{itemId:id});if(live.current){await onChat(result.thread.id,result.startError);}}catch(e){if(live.current)setError(e instanceof Error?e.message:'Der Chat konnte nicht geöffnet werden.');}finally{opening.current=false;if(live.current)setBusy('');}}
 return <section className="page firma-page"><PageHeading title="Firma" onShowSidebar={onShowSidebar}>{state&&<span className="firma-progress" aria-label={state.complete+' von '+state.total+' Punkten bestätigt'}>{state.complete}/{state.total} · {state.percent} %</span>}</PageHeading>
  <div className="firma-content">{state?<FirmaList state={state} onOpen={open} busy={busy} error={error}/>:error?<p role="alert">{error}</p>:<Skeleton variant="list" rows={8} label="Firma wird geladen …"/>}{error&&<button type="button" onClick={()=>void load()}>Erneut laden</button>}</div>
 </section>;
}
export function FirmaPreview(){
 const [selected,setSelected]=useState('');
 const state:State={complete:0,total:32,percent:0,steps:firmaSteps.map((step:any,i:number)=>({...step,complete:false,unlocked:i===0,items:step.items.map((item:any)=>({...item,status:'open'}))}))};
 return <div className="firma-preview"><FirmaList state={state} onOpen={setSelected}/>{selected&&<p className="firma-hint" role="status">Beispiel: Dieser Punkt öffnet einen eigenen Arbeitschat mit Ziel, vorhandenen Quellen und festem Ablageort. Es wurde kein Chat gestartet.</p>}</div>;
}

export function FirmaReview({api,chatId,revision,running}:{api:Api;chatId:string;revision:string;running:boolean}){
 const [review,setReview]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
 useEffect(()=>{let alive=true;setReview(null);setError('');setConfirmed(false);if(!running)api('/firma/review?id='+encodeURIComponent(chatId)).then(result=>{if(alive)setReview(result.review);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[api,chatId,revision,running]);
 async function confirm(){setBusy(true);setError('');try{await api('/firma/confirm',{id:chatId,code:review.code,fingerprint:review.fingerprint});setReview(null);setConfirmed(true);}catch(e){setError(e instanceof Error?e.message:'Bestätigung fehlgeschlagen.');}finally{setBusy(false);}}
 if(confirmed)return <p className="firma-hint" role="status">Ergebnis bestätigt.</p>;
 if(!review)return error?<p className="firma-error" role="alert">{error}</p>:null;
 return <details className="firma-review"><summary>Ergebnis prüfen</summary><div className="firma-review-content"><p>{review.summary}</p>{review.criteria.map((c:any)=><div key={c.id}><strong>{c.text}</strong><p>{c.finding}</p><p className="firma-hint">Quelle: {c.path}</p></div>)}{error&&<p className="firma-error" role="alert">{error}</p>}{review.unlocked?<button type="button" disabled={busy||running} onClick={()=>void confirm()}>{busy?'Bestätigen …':'Ergebnis bestätigen'}</button>:<p className="firma-hint">Vorherige Schritte zuerst abschließen.</p>}</div></details>;
}
