import React, {useState, useEffect, useRef, useCallback} from 'react';
import {Bell} from './icons.jsx';
import {SettingsNavigationRow} from './settings-patterns.jsx';
import {Skeleton} from './skeleton.tsx';
import {Markdown} from './chat-rich-content.jsx';

export function useJobNotifications(api, enabled, notify) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [signal,setSignal]=useState(0);
  const refresh=useCallback(async()=>{
    if(!enabled) return;
    try {setData(await api('/notifications'));setError('');} catch(e) {setError(e.message);}
  },[api,enabled]);
  const seen=useRef(new Set());
  useEffect(()=>{
    if(!enabled) return;
    refresh();
    const event=e=>{
      const p=e.detail;
      if(!p.kind?.startsWith('notification.')) return;
      refresh();
      if(p.kind==='notification.created' && !seen.current.has(p.entity_id)) {
        seen.current.add(p.entity_id);
        setSignal(value => value + 1);
        notify(p.payload?.title || 'Neues Ergebnis');
        if(globalThis.Notification?.permission==='granted' && document.visibilityState==='hidden') {
          try {const n=new Notification(p.payload?.title || 'Neues Ergebnis',{body:'In der Schaltzentrale öffnen.',tag:p.entity_id});n.onclick=()=>{window.focus();window.dispatchEvent(new Event('open-job-notifications'));n.close();};} catch { /* The durable app receipt remains available on unsupported devices. */ }
        }
      }
    };
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    window.addEventListener('core/event',event);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',visible);
    const timer=setInterval(refresh,30000);
    return()=>{window.removeEventListener('core/event',event);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);clearInterval(timer);};
  },[enabled,refresh,notify]);
  return {data,error,refresh,signal};
}

export function NotificationRow({item,onClick}) {
  return <SettingsNavigationRow icon={<Bell size={18}/>} title={item.title} description={new Date(item.created_at*1000).toLocaleString('de-DE')} value={item.read_at?'Gelesen':'Neu'} onClick={onClick}/>;
}

export function NotificationPreference({api,Field,job,form=false}) {
  const [targets,setTargets]=useState([]), [value,setValue]=useState(job?.notification?.target || 'app'), [error,setError]=useState(''), [loaded,setLoaded]=useState(false), [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    setError('');
    try {
      const [options,preference]=await Promise.all([api('/jobs/notification-targets'),api('/notifications/preference')]);
      setTargets(options.targets);setValue(job?.notification?.target||preference.target);setLoaded(true);
    } catch(e){setError(e.message);}
  },[api,job]);
  useEffect(()=>{load();},[load]);
  const choose=async target=>{
    if(form){setValue(target);return;}
    setBusy(true);setError('');
    try{await api('/notifications/preference',{target,when:'always'});setValue(target);}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <>
    <Field label={form?'Ergebnis zustellen':'Neue Routinen benachrichtigen mich'}>
      <select name="notificationTarget" value={value} disabled={!loaded||busy} onChange={e=>choose(e.target.value)}>
        <option value="app">In der App</option>
        {value!=='app'&&!targets.some(t=>t.id===value)&&<option value={value} disabled>Bisheriges Ziel nicht verfügbar</option>}
        {targets.map(t=><option key={t.id} value={t.id} disabled={!t.ready}>{t.label}{t.ready?'':' · Nicht bereit'}</option>)}
      </select>
    </Field>
    {form&&<Field label="Benachrichtigen"><select name="notificationWhen" defaultValue={job?.notification?.when||'always'}><option value="always">Bei Ergebnis oder Problem</option><option value="errors">Nur wenn etwas schiefläuft</option></select></Field>}
    {!form&&<p className="form-help">Ergebnisse bleiben immer in der App. Telegram erreicht dich auch bei geschlossenem Browser; WhatsApp benötigt seinen laufenden Anschluss. Weitere Konten richtest du unter Verbindungen ein.</p>}
    {error&&<p role="alert" className="form-error">{error} <button type="button" onClick={load}>Erneut laden</button></p>}
  </>;
}

export function JobNotifications({api,state,Field,onRun,onChat,requests,onRequests,initialId}) {
  const [selected,setSelected]=useState(null),[error,setError]=useState(''),[more,setMore]=useState([]),[cursor,setCursor]=useState(undefined),[loadingMore,setLoadingMore]=useState(false);
  const [permission,setPermission]=useState(globalThis.Notification?.permission);
  useEffect(()=>{
    if(!initialId)return;
    let alive=true;
    api('/notifications/item?id='+encodeURIComponent(initialId)).then(async item=>{if(alive){setSelected(item);await api('/notifications/read',{id:item.id});state.refresh();}}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[initialId]);
  async function open(item){
    setSelected(item);setError('');
    try{await api('/notifications/read',{id:item.id});await state.refresh();}catch(e){setError(e.message);}
  }
  async function chat(){
    try{
      const detail=await api('/core/executions/'+selected.id.replace(/^attention-/,''));
      const id=detail.run.thread_id||detail.run.result?.threadId;
      if(!id)throw Error('Dieser Lauf hat keinen Agentenchat. Öffne die Ausführung für das Ergebnis.');
      await onChat(id);
    }catch(e){setError(e.message);}
  }
  async function allow(){
    try {setPermission(await Notification.requestPermission());}catch {setError('Gerätehinweise sind hier nicht verfügbar. Wähle Telegram oder WhatsApp für Hinweise außerhalb der App.');}
  }
  if(selected)return <>
    <button onClick={()=>setSelected(null)}>Zurück zu Benachrichtigungen</button>
    <h3>{selected.title}</h3>
    <Markdown text={selected.body}/>
    <p className="form-help">{({app:'In der App verfügbar',pending:'Versand wartet',sending:'Wird versendet',sent:'An den Anschluss übergeben',failed:'Zustellung fehlgeschlagen',unknown:'Zustellung unbestätigt'})[(state.data?.items.find(n=>n.id===selected.id)||selected).delivery]}</p>
    {(state.data?.items.find(n=>n.id===selected.id)||selected).delivery_error&&<p role="alert">{(state.data?.items.find(n=>n.id===selected.id)||selected).delivery_error}</p>}
    <div className="row"><button onClick={()=>onRun(selected)}>Ausführung öffnen</button><button onClick={chat}>Chat öffnen</button></div>
    {error&&<p role="alert">{error}</p>}
  </>;
  return <>
    {requests>0&&<button onClick={onRequests}>{requests} offene Rückfragen</button>}
    {state.error&&<p role="alert">{state.error} <button onClick={state.refresh}>Erneut laden</button></p>}
    {!state.data&&!state.error&&<Skeleton layout="jobs" label="Benachrichtigungen werden geladen …"/>}
    {state.data?.items.length===0&&<p>Noch keine Ergebnisse. Beauftrage im Chat deine erste Routine.</p>}
    <div className="settings-group">{[...(state.data?.items||[]),...more].filter((n,i,a)=>a.findIndex(x=>x.id===n.id)===i).map(item=><NotificationRow key={item.id} item={item} onClick={()=>open(item)}/>)}</div>
    {(cursor===undefined?state.data?.next:cursor)&&<button disabled={loadingMore} onClick={async()=>{setLoadingMore(true);try{const d=await api('/notifications?before='+(cursor===undefined?state.data.next:cursor));setMore(m=>[...m,...d.items]);setCursor(d.next);}catch(e){setError(e.message);}finally{setLoadingMore(false);}}}>Ältere laden</button>}
    <NotificationPreference api={api} Field={Field}/>
    {permission!==undefined&&<button disabled={permission==='granted'||permission==='denied'} onClick={allow}>{permission==='granted'?'Gerätehinweise erlaubt':permission==='denied'?'Gerätehinweise im Browser blockiert':'Gerätehinweise erlauben'}</button>}
    <p className="form-help">Gerätehinweise benötigen eine geöffnete App und Browserunterstützung. Der Mac muss für Routinen wach und die Schaltzentrale gestartet sein.</p>
    {error&&<p role="alert">{error}</p>}
  </>;
}
