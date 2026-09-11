import React, {useEffect, useRef, useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton.tsx';
import './device-connection.css';

type Api = (path: string, data?: any) => Promise<any>;
const labels: Record<string,string> = {error:'Verbindungsprüfung fehlgeschlagen',unchecked:'Noch nicht geprüft',paired:'Gekoppelt · Verbindung fehlt',connected:'Verbindung zuletzt bestätigt',disconnected:'Getrennt'};
const permissions = [['read','Bildschirm lesen','Status und Bildschirmbilder'],['control','Bedienen','Tasten, Berührungen und Texteingabe'],['apps','Apps öffnen','Android-Apps starten'],['shell','Erweiterte ADB-Befehle','Vollständige Shell-Rechte auf diesem Android-Gerät']];
const keys = [['home','Home'],['back','Zurück'],['up','Hoch'],['down','Runter'],['left','Links'],['right','Rechts'],['ok','OK'],['volume-down','Leiser'],['volume-up','Lauter'],['mute','Stumm'],['power','Ein/Aus']];
export const changedDevices = () => window.dispatchEvent(new Event('device-connections-changed'));
function fields(device:any) {
  const names=['id','revision','name','provider','transport','host','port','serial','url','allowPublic','enabled','projectId','workers','permissions'];
  return Object.fromEntries(names.map(k=>[k, device[k]]));
}
export function DeviceConnection({connection, api, Field, projects=[], workers=[], onClose}: {connection:any, api:Api, Field:any, projects?:any[], workers?:any[], onClose:()=>void}) {
  const android=connection.provider==='android-adb';
  const defaults={id:'',revision:0,name:android?'Android':'Samsung TV',provider:connection.provider,transport:'network',host:'',port:5555,serial:'',url:'',allowPublic:false,enabled:false,projectId:'default',workers:['codex'],permissions:['read','control']};
  const [saved,setSaved]=useState<any>(connection.id?connection:null), [draft,setDraft]=useState<any>(connection.id?fields(connection):defaults);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[code,setCode]=useState(''),[pairingPort,setPairingPort]=useState(''),[usb,setUsb]=useState<any[]>([]),[adb,setAdb]=useState<boolean|null>(null),[audit,setAudit]=useState<any[]>([]),[image,setImage]=useState('');
  const inFlight=useRef(false);
  const dirty=JSON.stringify(draft)!==JSON.stringify(saved?fields(saved):defaults);
  const update=(key:string,value:any)=>setDraft((old:any)=>({...old,[key]:value}));
  useEffect(()=>{let alive=true;api('/devices').then(r=>{if(alive)setAdb(r.adbInstalled);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
  function accept(value:any){setSaved(value);setDraft(fields(value));changedDevices();}
  async function refresh(){const r=await api('/devices');const item=r.devices.find((d:any)=>d.id===saved?.id);if(item)accept(item);}
  async function perform(fn:()=>Promise<void>){if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setMessage('');try{await fn();}catch(e:any){setError(e.message);}finally{inFlight.current=false;setBusy(false);}}
  async function action(value:any){await perform(async()=>{try{const r=await api(`/devices/${saved.id}/action`,value);setMessage(r.message||(r.status==='connected'?'Verbindung bestätigt.':r.status==='disconnected'?'Getrennt.':'Befehl ausgeführt.'));if(r.image)setImage(`data:${r.mimeType};base64,${r.image}`);}finally{setCode('');await refresh();}});}
  const canUse=!!saved&&!dirty&&!busy;
  return <div>
    <form onSubmit={e=>{e.preventDefault();void perform(async()=>{const d=await api('/devices/save',draft);accept(d);setMessage(d.enabled?'Für die ausgewählten Agenten freigegeben.':'Gespeichert. Verbinden und anschließend für Agenten freigeben.');});}}>
      <p className="form-help">{android?'Android per USB, WLAN oder privatem Tailscale-Netz steuern.':'Samsung-Fernseher im Netzwerk steuern. Die Verbindungsanfrage am eingeschalteten Fernseher zulassen.'}</p>
      <Field label="Gerätename"><input value={draft.name} maxLength={100} required disabled={busy} onChange={e=>update('name',e.target.value)}/></Field>
      {android?<>
        <Field label="Verbindung"><select value={draft.transport} disabled={busy} onChange={e=>update('transport',e.target.value)}><option value="network">WLAN / Tailscale</option><option value="usb">USB</option></select></Field>
        {draft.transport==='network'?<>
          <Field label="Geräteadresse"><input value={draft.host} placeholder="IP-Adresse oder Tailscale-Gerätename" required disabled={busy} onChange={e=>update('host',e.target.value)}/></Field>
          <Field label="Verbindungsport" hint="Steht unter Entwickleroptionen → WLAN-Debugging. Kann sich nach einem Neustart ändern."><input type="number" min={1} max={65535} value={draft.port||''} required disabled={busy} onChange={e=>update('port',Number(e.target.value))}/></Field>
        </>:<>
          <Field label="USB-Gerät"><select value={draft.serial} required disabled={busy} onChange={e=>update('serial',e.target.value)}><option value="">Gerät auswählen</option>{draft.serial&&!usb.some(d=>d.serial===draft.serial)&&<option value={draft.serial}>{draft.serial}</option>}{usb.map(d=><option key={d.serial} value={d.serial}>{d.serial} · {d.status==='device'?'bereit':'am Gerät bestätigen'}</option>)}</select></Field>
          <button type="button" disabled={busy} onClick={()=>perform(async()=>{setUsb((await api('/devices/usb')).devices);setAdb(true);})}>USB-Geräte suchen</button>
          <p className="form-help">USB-Debugging am Android-Gerät einschalten, Kabel anschließen und die Anfrage auf dem Gerät zulassen.</p>
        </>}
        {adb===false&&<p className="form-help">ADB fehlt auf diesem Rechner. <a href="https://developer.android.com/tools/releases/platform-tools" target="_blank" rel="noreferrer">Android Platform Tools installieren</a> und adb im Suchpfad verfügbar machen.</p>}
      </>:<>
        <Field label="Fernseher-Adresse" hint="Direkt: ws://IP-Adresse:8001. Über einen HTTPS-Proxy: wss://Hostname. Der Proxy muss zu diesem Samsung-Fernseher führen."><input type="url" value={draft.url} required placeholder="ws://Adresse:8001" disabled={busy} onChange={e=>update('url',e.target.value)}/></Field>
        <details className="connection-details"><summary>Fernzugriff</summary><div className="settings-group"><SettingRow title="Öffentliche WSS-Adresse" description="Nur für einen bereits eingerichteten, geschützten Fernzugriff. Ein beliebiger Link ist keine Fernseher-Schnittstelle."><button type="button" className="apple-switch" role="switch" aria-label="Öffentliche WSS-Adresse" aria-checked={draft.allowPublic} disabled={busy} onClick={()=>update('allowPublic',!draft.allowPublic)}><span/></button></SettingRow></div></details>
        <p className="form-help">Für Samsung Tizen mit Netzwerk-Fernbedienung. Kein Samsung-Konto erforderlich. Manche Modelle verlangen nach einem App-Neustart eine erneute Bestätigung. Einschalten aus dem Standby ist modellabhängig.</p>
      </>}
      {saved&&<div className="settings-group"><SettingRow title="Verbindung" description={saved.checkedAt?`${labels[saved.status]||saved.status} · ${new Date(saved.checkedAt*1000).toLocaleString('de-DE')}`:labels.unchecked}/><SettingRow title="Für Agenten freigeben" description="Gilt für den ausgewählten Arbeitsbereich und die erlaubten Aktionen."><button type="button" className="apple-switch" role="switch" aria-label="Für Agenten freigeben" aria-checked={draft.enabled} disabled={busy||saved.status!=='connected'} onClick={()=>update('enabled',!draft.enabled)}><span/></button></SettingRow></div>}
      <details className="connection-details"><summary>Arbeitsbereich und Rechte</summary>
        <Field label="Arbeitsbereich"><select value={draft.projectId} disabled={busy} onChange={e=>update('projectId',e.target.value)}><option value="default">Allgemein</option>{projects.filter(p=>p.id!=='default').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <div className="settings-group">{Array.from(new Map([...workers.map(w=>[w.id,w] as const),...draft.workers.filter((id:string)=>!workers.some(w=>w.id===id)).map((id:string)=>[id,{id,name:id}] as const)]).values()).map((w:any)=><SettingRow key={w.id} title={w.name||w.id}><button type="button" role="switch" className="apple-switch" aria-label={`${w.name||w.id} zulassen`} aria-checked={draft.workers.includes(w.id)} disabled={busy} onClick={()=>update('workers',draft.workers.includes(w.id)?draft.workers.filter((id:string)=>id!==w.id):[...draft.workers,w.id])}><span/></button></SettingRow>)}</div>
        <div className="settings-group">{permissions.filter(([id])=>android||['read','control'].includes(id)).map(([id,label,hint])=><SettingRow key={id} title={!android&&id==='read'?'Status lesen':label} description={!android&&id==='read'?'Verbindung prüfen':hint}><button type="button" role="switch" className="apple-switch" aria-label={label} aria-checked={draft.permissions.includes(id)} disabled={busy} onClick={()=>update('permissions',draft.permissions.includes(id)?draft.permissions.filter((p:string)=>p!==id):[...draft.permissions,id])}><span/></button></SettingRow>)}</div>
      </details>
      {dirty&&saved&&<p className="form-help">Änderungen zuerst speichern. Eine geänderte Geräteadresse benötigt eine neue Verbindung und Freigabe.</p>}
      <div className="row end connection-actions"><button className="primary" disabled={busy||!!saved&&!dirty}>{busy?'Bitte warten …':saved?'Speichern':'Gerät hinzufügen'}</button></div>
    </form>
    {saved&&<>
      {android&&draft.transport==='network'&&<details className="connection-details"><summary>Mit Code koppeln</summary>
        <p className="form-help">Am Android-Gerät: Entwickleroptionen → WLAN-Debugging → Gerät mit Kopplungscode koppeln. Den dort angezeigten Port und Code eingeben. Der Kopplungsport unterscheidet sich meist vom Verbindungsport oben.</p>
        <Field label="Kopplungsport"><input type="number" min={1} max={65535} value={pairingPort} disabled={!canUse} onChange={e=>setPairingPort(e.target.value)}/></Field>
        <Field label="Kopplungscode"><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={!canUse} onChange={e=>setCode(e.target.value)}/></Field>
        <button type="button" disabled={!canUse||!/^\d{6}$/.test(code)||!Number(pairingPort)} onClick={()=>action({action:'pair',code,pairingPort:Number(pairingPort)})}>Koppeln</button>
      </details>}
      <div className="row connection-actions"><button type="button" disabled={!canUse} onClick={()=>action({action:'connect'})}>Verbinden</button><button type="button" disabled={!canUse} onClick={()=>action({action:'status'})}>Verbindung prüfen</button><button type="button" disabled={!canUse} onClick={()=>action({action:'disconnect'})}>Trennen</button>{saved.enabled&&<button type="button" onClick={async()=>{try{accept(await api(`/devices/${saved.id}/revoke`,{}));setMessage('Gesperrt. Bereits gesendete Befehle können nicht zurückgenommen werden.');}catch(e:any){setError(e.message);}}}>Sofort sperren</button>}</div>
      <details className="connection-details"><summary>Fernbedienung</summary><div className="row connection-actions">{keys.map(([key,label])=><button type="button" key={key} disabled={!canUse} onClick={()=>action({action:'key',key})}>{label}</button>)}{android&&<button type="button" disabled={!canUse} onClick={()=>action({action:'screenshot'})}>Bildschirm ansehen</button>}</div>{image&&<img className="device-screen" src={image} alt="Zuletzt abgerufener Android-Bildschirm"/>}</details>
      <details className="connection-details" onToggle={e=>{if(e.currentTarget.open)api(`/devices/${saved.id}/audit`).then(r=>setAudit(r.entries)).catch(e=>setError(e.message));}}><summary>Nutzungsprotokoll</summary>{!audit.length?<p className="form-help">Noch keine Einträge.</p>:<div className="settings-group">{audit.slice().reverse().map(e=><SettingRow key={e.id} title={`${e.action} · ${e.outcome}`} description={`${new Date(e.at*1000).toLocaleString('de-DE')} · ${e.actor}`}/>)}</div>}</details>
      <details className="connection-details"><summary>Gerät entfernen</summary><p className="form-help">Entfernt das Gerät und seine Agentenfreigaben aus dieser App. Eine ADB-Kopplung widerrufst du zusätzlich am Android-Gerät.</p><button type="button" disabled={!canUse} onClick={()=>perform(async()=>{await api(`/devices/${saved.id}/remove`,{revision:saved.revision});changedDevices();onClose();})}>Gerät entfernen</button></details>
    </>}
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-help" role="status">{message}</p>}
  </div>;
}

export function NetworkConnection({api}: {api:Api}) {
  const [state,setState]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[publicConfirmed,setPublicConfirmed]=useState(false);
  const refresh=async()=>{const r=await api('/network/status');setState(r);changedDevices();};
  useEffect(()=>{let alive=true;api('/network/status').then(r=>{if(alive)setState(r);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
  useEffect(()=>{if(!state?.loginPending)return;const t=setInterval(()=>refresh().catch(e=>setError(e.message)),3000);return()=>clearInterval(t);},[state?.loginPending]);
  async function run(action:string){setBusy(true);setError('');try{setState(await api('/network/action',{action,publicConfirmed}));setPublicConfirmed(false);changedDevices();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  return <>
    <p className="form-help">Tailscale verbindet deine Geräte in einem privaten Netz. Auf diesem Rechner und deinen Mobilgeräten mit dem gewünschten Tailscale-Konto anmelden.</p>
    {!state&&!error&&<Skeleton variant="settings" label="Tailscale wird geprüft …"/>}
    {state&&<div className="settings-group">
      <SettingRow title="Tailscale" description={!state.installed?'Noch nicht installiert':state.connected?'Im privaten Netzwerk angemeldet':'Anmeldung erforderlich'}><button disabled={busy} onClick={()=>refresh().catch(e=>setError(e.message))}>Erneut prüfen</button></SettingRow>
      {!state.installed&&<SettingRow title="Installation"><a href="https://tailscale.com/download" target="_blank" rel="noreferrer">Tailscale installieren</a></SettingRow>}
      {state.installed&&!state.connected&&!state.managed&&<SettingRow title="Konto verbinden" description="Die Anmeldung erfolgt direkt bei Tailscale."><button disabled={busy||state.loginPending} onClick={()=>run('login')}>{state.loginPending?'Anmeldung läuft …':'Anmelden'}</button></SettingRow>}
      {state.loginUrl&&!state.connected&&<SettingRow title="Anmeldung bestätigen"><a href={state.loginUrl} target="_blank" rel="noreferrer">Tailscale-Anmeldung öffnen</a></SettingRow>}
      <SettingRow title={state.funnel?'Öffentlicher Zugriff · Funnel':'Privater App-Zugriff · Serve'} description={state.serving?state.url:state.managed?'Wird zentral am Host eingerichtet.':'Öffnet diese App für deine angemeldeten Geräte.'}>{state.serving?<a href={state.url} target="_blank" rel="noreferrer">App öffnen</a>:<button disabled={busy||!state.connected||state.managed} onClick={()=>run('serve')}>Privaten Zugriff einrichten</button>}</SettingRow>
      {state.ownsRule&&<SettingRow title="Freigabe beenden" description="Beendet nur die von dieser App eingerichtete Freigabe."><button disabled={busy} onClick={()=>run('stop')}>Beenden</button></SettingRow>}
    </div>}
    {state&&!state.managed&&<details className="connection-details"><summary>Öffentlicher Zugriff</summary><p className="form-help">Funnel macht diese App im Internet erreichbar. Für Geräte genügt normalerweise das private Netz. ADB wird niemals veröffentlicht.</p>{!state.loginRequired&&<p className="form-help">Zuerst eine eigene App-Anmeldung einrichten. Ohne Anmeldung bleibt Funnel gesperrt.</p>}<div className="settings-group"><SettingRow title="Öffentlich erreichbar machen" description="Ich möchte diese App über Funnel im Internet freigeben."><button type="button" className="apple-switch" role="switch" aria-label="Öffentlichen Zugriff bestätigen" aria-checked={publicConfirmed} disabled={busy||!state.loginRequired} onClick={()=>setPublicConfirmed(!publicConfirmed)}><span/></button></SettingRow></div><button disabled={busy||!state.connected||!state.loginRequired||!publicConfirmed||state.serving} onClick={()=>run('funnel')}>Funnel einrichten</button>{state.serving&&<p className="form-help">Vor einem Wechsel die bisherige App-Freigabe beenden.</p>}</details>}
    {(error||state?.error)&&<p className="form-error" role="alert">{error||state.error}</p>}
  </>;
}
