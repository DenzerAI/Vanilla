import React,{useState,useEffect} from 'react';
import {serviceDefinition,connectionStatus} from '../service-catalog.mjs';
import {BrandIcon} from './brand-icon.jsx';
import {SettingRow} from './settings-row.jsx';
import {TelegramUsers} from './telegram-users';
import {telegramUsers} from '../telegram-users.mjs';

export function ServiceConnectionForm({connection,api,notify,onSaved,onChanged,Field,workers,projects,workerSettings={},requests=[],RequestCard,onReply}) {
  const spec=serviceDefinition(connection.provider);
  const [dirty,setDirty]=useState(false),[current,setCurrent]=useState(connection),[busy,setBusy]=useState(false),[sessions,setSessions]=useState([]),[feedback,setFeedback]=useState(''),[error,setError]=useState(''),[result,setResult]=useState(null),[peerText,setPeerText]=useState(''),[contextId,setContextId]=useState('');
  const [config,setConfig]=useState(()=>Object.fromEntries(spec.fields.filter(f=>!f.secret).map(f=>[f.key,f.type==='telegram-users'?telegramUsers(connection.config):connection.config?.[f.key]??f.default??''])));
  const active=current.runtimeActive===true;
  const defaultName=workers.find(w=>w.id===workerSettings.defaultWorker)?.name;
  const defaultLabel='Systemstandard verwenden'+(defaultName?' · '+defaultName:'');
  const canStart=!!spec.runtime&&(spec.id!=='a2a'||config.mode==='server');
  async function refresh(){const [list,history]=await Promise.all([api('/services'),api('/services/sessions?id='+encodeURIComponent(connection.id))]);setCurrent(list.connections.find(c=>c.id===connection.id)||connection);setSessions(history.sessions);onChanged?.(list.connections);}
  useEffect(()=>{if(!connection.id)return;let disposed=false;const update=()=>{if(!disposed)refresh().catch(()=>{});};update();const timer=setInterval(update,3000);return()=>{disposed=true;clearInterval(timer);};},[connection.id]);
  async function perform(fn){setBusy(true);setError('');setFeedback('');try{await fn();}catch(e){setError(e.message);notify(e.message);}finally{setBusy(false);}}
  const fieldValue=key=>Array.isArray(config[key])?config[key].join('\n'):config[key];
  return <div><form onChange={()=>setDirty(true)} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void perform(async()=>{const credentials=Object.fromEntries(spec.fields.filter(f=>f.secret).map(f=>[f.key,data.get(f.key)]));await api('/services/save',{id:connection.id,provider:spec.id,name:data.get('name'),worker:data.get('worker')||'auto',projectId:data.get('projectId')||'default',config,credentials});await onSaved('Verbindung gespeichert.');});}}>
    <div className="row"><BrandIcon name={spec.name}/><strong>{spec.name}</strong></div>
    {connection.id&&<p className="page-note" role="status">{connectionStatus(current)}{current.runtimeError?' · '+current.runtimeError:''}</p>}
    <fieldset disabled={busy||active} className="connection-fields">
      <Field label="Bezeichnung"><input name="name" defaultValue={connection.name||spec.name} maxLength={100} required/></Field>
      {spec.fields.filter(f=>!f.when||config[f.when[0]]===f.when[1]).map(f=>f.type==='telegram-users'?<TelegramUsers key={f.key} users={config[f.key]} onChange={users=>{setConfig(v=>({...v,[f.key]:users}));setDirty(true);}}/>:<Field key={f.key} label={f.label} hint={f.hint}>
        {f.secret?<input name={f.key} type="password" autoComplete="new-password" placeholder={current.secretId?'Gespeichert · leer lassen zum Beibehalten':''}/>
          :f.type==='select'?<select value={config[f.key]} onChange={e=>setConfig(v=>({...v,[f.key]:e.target.value}))}>{f.options.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select>
          :f.type==='list'?<textarea rows={3} value={fieldValue(f.key)} onChange={e=>setConfig(v=>({...v,[f.key]:e.target.value}))}/>
          :<input type={f.type==='number'?'number':f.type==='url'?'url':'text'} min={f.type==='number'?1024:undefined} max={f.type==='number'?65535:undefined} value={fieldValue(f.key)} required={f.required} onChange={e=>setConfig(v=>({...v,[f.key]:e.target.value}))}/>}
      </Field>)}
      {!!spec.runtime&&<div className="form-grid"><Field label="Ausführen mit"><select name="worker" defaultValue={connection.worker||'auto'}><option value="auto">{defaultLabel}</option>{workers.map(w=><option key={w.id} value={w.id} disabled={!w.configured}>{w.name}</option>)}</select></Field><Field label="Arbeitsbereich"><select name="projectId" defaultValue={connection.projectId||'default'}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field></div>}
    </fieldset>
    {spec.id==='telegram'&&<p className="page-note">Der gewählte Agent nutzt Wissen und Themen dieses Arbeitsbereichs. Verwendet bereits ein Hermes-Gateway diesen Bot, muss dessen Empfang vor dem Start hier beendet sein.</p>}
    {spec.id==='whatsapp-local'&&<p className="page-note">Eine bereitgestellte Agentnummer mit WhatsApp koppeln. Jeder Anschluss erhält eine eigene Anmeldung und Bridge. Der bestehende Order-Anschluss bleibt separat.</p>}
    {spec.id==='whatsapp-cloud'&&<p className="page-note">Nach dem Start den lokalen Pfad /whatsapp/webhook über einen HTTPS-Reverse-Proxy bei Meta hinterlegen. Der Empfang unterstützt zunächst Textnachrichten.</p>}
    {spec.id==='microsoft-graph'&&<p className="page-note">Verwendet eine registrierte Microsoft-Anwendung mit freigegebenem Postfachzugriff. Ereignisabonnements und interaktive Kontoanmeldung folgen separat.</p>}
    {spec.id==='discord'&&<p className="page-note">Bot-Zugang und Kanal lassen sich prüfen. Der automatische Discord-Empfang folgt nach Telegram und WhatsApp.</p>}
    {spec.id==='a2a'&&<p className="page-note">Bestehende Hermes-Dienste über ihre Adresse verbinden. Ein neuer Eingang startet ausschließlich auf „Empfang starten“ und übernimmt keinen belegten Port.</p>}
    <p className="page-note"><a href={spec.help} target="_blank" rel="noreferrer">Einrichtung beim Anbieter</a></p>
    {current.qrDataUrl&&<img className="bridge-qr" src={current.qrDataUrl} alt="QR-Code zum Koppeln der eigenen WhatsApp-Nummer"/>}
    {dirty&&connection.id&&<p className="page-note">Änderungen zuerst speichern, anschließend Zugang prüfen oder Empfang starten.</p>}
    {error&&<p role="alert" className="form-help">{error}</p>}{feedback&&<p role="status" className="form-help">{feedback}</p>}
    <div className="row between connection-actions">
      {connection.id?<button type="button" disabled={busy||active} onClick={()=>perform(async()=>{await api('/services/delete',{id:connection.id});await onSaved('Verbindung entfernt.');})}>Entfernen</button>:<span/>}
      {connection.id&&<button type="button" disabled={busy||active||dirty} onClick={()=>perform(async()=>{const r=await api('/services/check',{id:connection.id});setFeedback(r.message);await refresh();})}>Zugang prüfen</button>}
      {connection.id&&canStart&&<button type="button" disabled={busy||dirty&&!active} onClick={()=>perform(async()=>{await api(active?'/services/stop':'/services/start',{id:connection.id});await refresh();})}>{active?'Empfang stoppen':'Empfang starten'}</button>}
      <button className="primary" disabled={busy||active}>{busy?'Bitte warten …':'Speichern'}</button>
    </div>
    </form>
    {connection.id&&spec.id==='microsoft-graph'&&<details className="connection-details"><summary>Postfach und Kalender prüfen</summary><div className="row"><button type="button" disabled={busy||dirty} onClick={()=>perform(async()=>setResult(await api('/services/action',{id:connection.id,action:'inbox'})))}>Posteingang lesen</button><button type="button" disabled={busy||dirty} onClick={()=>perform(async()=>setResult(await api('/services/action',{id:connection.id,action:'calendar'})))}>Kalender lesen</button></div>{result?.value?.map(item=><p key={item.id}>{item.subject||'Ohne Betreff'}</p>)}</details>}
    {connection.id&&spec.id==='a2a'&&config.mode==='client'&&<details className="connection-details"><summary>Auftrag an diesen Agenten</summary><Field label="Nachricht"><textarea rows={3} value={peerText} onChange={e=>setPeerText(e.target.value)}/></Field><button type="button" disabled={busy||dirty||!peerText.trim()} onClick={()=>perform(async()=>{const r=await api('/services/action',{id:connection.id,action:'message',input:{text:peerText,contextId}});setContextId(r.contextId||'');setResult(r);})}>Auftrag senden</button>{result&&<><p role="status">{(result.artifacts?.flatMap(a=>a.parts||[])||result.parts||result.status?.message?.parts||[]).map(p=>p.text).filter(Boolean).join('\n')||result.status?.state||'Auftrag übergeben.'}</p>{result.id&&<button type="button" disabled={busy||dirty} onClick={()=>perform(async()=>setResult(await api('/services/action',{id:connection.id,action:'task',input:{taskId:result.id}})))}>Ergebnis aktualisieren</button>}<button type="button" disabled={busy} onClick={()=>{setContextId('');setResult(null);setPeerText('');}}>Neuer Kontext</button></>}</details>}
    {connection.id&&<details className="connection-details"><summary>Gespräche und Ergebnisse ({sessions.length})</summary>
      {!sessions.length&&<p className="page-note">Noch keine Nachrichten empfangen. Die Zuordnung zur Chatliste bleibt vorerst offen.</p>}
      {sessions.map(s=><div key={s.id} className="settings-group"><SettingRow title={current.config?.users?.find(u=>u.id===s.sender)?.name||s.sender} description={'ID: '+s.sender}/>{s.tasks.map(t=><div key={t.id} className="channel-result"><p>{({received:'Angenommen',running:'In Arbeit',completed:'Abgeschlossen',failed:'Fehlgeschlagen',interrupted:'Unterbrochen'})[t.status]}</p>{t.result&&<p>{t.result}</p>}{t.error&&<p role="alert">{t.error}</p>}{t.deliveryError&&<p role="alert">{t.deliveryError}</p>}</div>)}{requests.filter(r=>r.params?.threadId===s.threadId).map(r=><RequestCard key={r.id} request={r} onReply={onReply}/>)}</div>)}
    </details>}
  </div>;
}
