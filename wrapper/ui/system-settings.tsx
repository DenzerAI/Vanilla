import React, {useEffect, useRef, useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Modal} from './modal.jsx';
import './system-settings.css';

type Api = (path: string, data?: any) => Promise<any>;
const date = (value: number | string) => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('de-DE') : 'Noch nicht ausgeführt';
const names: Record<string,string> = {ok:'In Ordnung', error:'Prüfen', running:'Läuft', queued:'In Warteschlange', dispatching:'Wird übergeben', completed:'Abgeschlossen', failed:'Fehlgeschlagen', interrupted:'Gestoppt', cancelled:'Abgebrochen'};
function Toggle({label, value, change}: any) { return <button type="button" role="switch" aria-label={label} aria-checked={value} className="apple-switch" onClick={()=>change(!value)}><span/></button>; }
function Group({title, children}: any) { return <><h3 className="section-heading">{title}</h3><div className="settings-group">{children}</div></>; }

export function SystemSettings({api, section, chats, onJobs, onLibrary, onConnections}: {api: Api, section: string, chats: any[], onJobs: ()=>void, onLibrary: ()=>void, onConnections: ()=>void}) {
  const [status,setStatus]=useState<any>(null), [draft,setDraft]=useState<any>(null), [error,setError]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false);
  const [snapshots,setSnapshots]=useState<any[]|null>(null), [restore,setRestore]=useState<any>(null), [access,setAccess]=useState(false), [password,setPassword]=useState('');
  const [target,setTarget]=useState(''), [backupPassword,setBackupPassword]=useState(''), [chatId,setChatId]=useState('');
  const dirty=useRef(false);
  async function load(reset=false) {
    const s=await api('/system/status'); setStatus(s);
    if(reset || !dirty.current) {setDraft(s.settings); setTarget(s.settings.values.backup.target); dirty.current=false;}
  }
  useEffect(()=>{
    let mounted=true;
    const refresh=()=>{if(mounted) load().catch(e=>{if(mounted)setError(e.message);});};
    refresh(); const timer=setInterval(()=>{if(document.visibilityState==='visible') refresh();},15000);
    return ()=>{mounted=false;clearInterval(timer);};
  },[]);
  async function act(fn: ()=>Promise<any>, success='Gespeichert.') {
    setBusy(true); setError('');setMessage('');
    try {await fn(); setMessage(success); await load();} catch(e:any){setError(e.message);} finally{setBusy(false);}
  }
  function change(group:string,key:string,value:any) {setMessage('');setError('');dirty.current=true;setDraft((d:any)=>({...d,values:{...d.values,[group]:{...d.values[group],[key]:value}}}));}
  const run=(id:string)=>act(()=>api('/jobs/run',{id:'system-'+id}),'Auftrag steht in der Warteschlange. Den Verlauf findest du unter Aufträge.');
  const toggle=(group:string,key:string,title:string,description:string)=> <SettingRow title={title} description={description}><Toggle label={title} value={draft.values[group][key]} change={(v:boolean)=>change(group,key,v)}/></SettingRow>;
  const number=(group:string,key:string,title:string,min:number,max:number,description?:string)=><SettingRow title={title} description={description}><input aria-label={title} type="number" min={min} max={max} value={draft.values[group][key]} onChange={e=>change(group,key,e.target.valueAsNumber)}/></SettingRow>;
  const time=(group:string,key:string,title:string)=><SettingRow title={title} description="Lokale Zeitzone dieses Macs"><input aria-label={title} type="time" value={draft.values[group][key]} onChange={e=>change(group,key,e.target.value)}/></SettingRow>;
  if(!status || !draft) return <p role="status">{error || 'System wird geladen …'} {error&&<button onClick={()=>act(()=>load())}>Erneut laden</button>}</p>;
  const v=draft.values;
  return <div className="system-settings" aria-busy={busy}>
    {error&&<p className="form-error" role="alert">{error} <button onClick={()=>act(()=>load(true),'Aktuelle Einstellungen geladen.')}>Neu laden</button></p>}
    {message&&<p className="form-help" role="status">{message}</p>}
    {section!=='access'&&<div className="settings-save-row"><span role="status">{dirty.current?'Ungespeicherte Änderungen':message || 'Keine Änderungen'}</span><button type="button" className="primary" disabled={busy || !dirty.current} onClick={()=>act(async()=>{const saved=await api('/system/settings',draft);dirty.current=false;setDraft(saved);},'Einstellungen gespeichert.')}>{busy?'Bitte warten …':'Einstellungen speichern'}</button></div>}
    <fieldset disabled={busy}>
    {section==='system'&&<>
      <Group title="Heartbeat">
        {toggle('system','heartbeat','System jede Minute prüfen','Prüft Erreichbarkeit, Auftragsplanung und freien Speicher lokal ohne LLM.')}
        {toggle('system','auto_restart','Bei Ausfällen wieder starten','Nach wiederholten Fehlern; laufende Arbeit wird vorher geprüft.')}
        {toggle('system','notifications','Probleme anzeigen','Hinweise bei Zustandsänderungen, ohne Meldung bei jedem erfolgreichen Check.')}
        {toggle('system','quiet_hours','Ruhezeiten für Hinweise','Prüfungen und Aufträge laufen weiter. Die Zustände bleiben in den Einstellungen sichtbar.')}
        {v.system.quiet_hours&&<>{time('system','quiet_start','Ruhezeit ab')}{time('system','quiet_end','Ruhezeit bis')}</>}
        <SettingRow title="Letzte Prüfung" description={date(status.heartbeat?.checked_at)}><span>{!v.system.heartbeat?'Pausiert':status.heartbeat?status.heartbeat.ok?'In Ordnung':'Prüfen':'Dienst einrichten'}</span></SettingRow>
        {Object.entries(status.checks).map(([key,c]:any)=><SettingRow key={key} title={c.message}><span className={c.ok?'':'form-error'}>{c.ok?'In Ordnung':'Prüfen'}</span></SettingRow>)}
      </Group>
      <Group title="Hintergrundbetrieb">
        <SettingRow title="Beim Anmelden starten" description={status.service.loaded?'Der macOS-Dienst ist geladen.':'Startet API und Worker nach deiner Anmeldung. Der Mac muss eingeschaltet sein.'}><button onClick={()=>act(()=>api('/system/service',{action:'install'}),'Dienstdateien installiert. Über den Systeminstaller aktivieren oder nach Abmelden erneut anmelden.')}>{status.service.installed?'Dienst aktualisieren':'Dienst einrichten'}</button></SettingRow>
        {number('system','parallel_jobs','Gleichzeitige Aufträge',1,4,'Python- und Worker-Aufträge teilen sich diese Warteschlange.')}
        <SettingRow title="Aufträge und Protokolle" description="Dreaming, Sicherung und Speicherpflege sind hier gemeinsam nachvollziehbar."><button onClick={onJobs}>Aufträge öffnen</button></SettingRow>
        <SettingRow title="System neu starten" description="Der Neustart wartet auf abgeschlossene Arbeit."><button onClick={()=>act(()=>api('/system/restart',{}),'Neustart angefordert. Die Verbindung wird wiederhergestellt.')}>Neu starten</button></SettingRow>
      </Group>
    </>}
    {section==='memory'&&<>
      <Group title="Gemeinsames Gedächtnis">
        {toggle('memory','capture','Abgeschlossene Gespräche übernehmen','Speichert öffentliche Gesprächsergebnisse mit Quellen im jeweiligen Projekt unter brain/daily. Erkannte Zugangsdaten werden entfernt.')}
        {toggle('memory','dreaming','Dreaming','Verdichtet Quellen lokal, entfernt Wiederholungen und aktualisiert den verlinkten Memory-Index. Manuell bearbeitete Notizen bleiben erhalten.')}
        {time('memory','dream_time','Memory pflegen um')}
        {toggle('memory','shared_notes','Gemeinsame Notizen in Projekte einbeziehen','Gibt notes/shared aus Allgemein für die Kontextsuche anderer Projekte frei.')}
        {toggle('memory','history','Änderungen versionieren','Lokale Git-Historie für Notizen; unabhängig vom GitHub-Repository des Programmcodes.')}
        {number('memory','context_characters','Kontextbudget in Zeichen',1000,16000,'Der Router wählt passende Textstellen und hält Herkunft und Version fest.')}
        <SettingRow title="Quellen" description={`${status.memory.sources} übernommene Beiträge · ${status.memory.pending} noch zu prüfen · lokale Verdichtung`}><button onClick={onLibrary}>Bibliothek öffnen</button></SettingRow>
        <SettingRow title="Memory jetzt pflegen"><button onClick={()=>run('memory')}>Dreaming starten</button></SettingRow>
        <SettingRow title="Vorhandene Gespräche aufnehmen" description="Durchsucht auch abgeschlossene Chats aus der Zeit vor der Einrichtung. Ausgeschlossene Chats werden übersprungen."><button onClick={()=>act(()=>api('/memory/capture',{backfill:true}),'Vorhandene Gespräche wurden geprüft.')}>Nachtragen</button></SettingRow>
      </Group>
      <Group title="Lokale Suche">
        <SettingRow title="Embedding-Modell" description={status.embeddings.model || 'Mehrsprachiges lokales Suchmodell'}><span>{status.embeddings.ready?'Installiert':'Noch nicht bereit'}</span></SettingRow>
        <SettingRow title="Semantische Suche" description="Volltext, unscharfe Suche und lokale Embeddings ergänzen sich. Nach der Installation arbeitet das Modell offline."><div className="row"><button onClick={()=>act(()=>api('/system/setup',{action:status.embeddings.ready?'test-embeddings':'embeddings'}),status.embeddings.ready?'Lokale Suchberechnung erfolgreich.':'Suchmodell installiert und indiziert.')}>{status.embeddings.ready?'Lokal testen':'Modell installieren'}</button><button onClick={()=>run('index')}>Neu indizieren</button></div></SettingRow>
        <SettingRow title="Memory-Werkzeuge für Worker" description="Suche, Kontext und versionierte Notizen über denselben lokalen MCP-Anschluss."><button onClick={()=>act(async()=>{const r=await api('/system/mcp');await navigator.clipboard.writeText(JSON.stringify(r,null,2));},'MCP-Konfiguration kopiert. Sie enthält keine Zugangsdaten.')}>Konfiguration kopieren</button></SettingRow>
      </Group>
      <Group title="Einträge entfernen">
        <SettingRow title="Gespräch aus Memory entfernen" description="Entfernt die aktiven Ableitungen und verhindert erneute Aufnahme. Chat, Git-Historie und vorhandene Sicherungen bleiben bestehen."><div className="system-input"><select aria-label="Gespräch aus Memory entfernen" value={chatId} onChange={e=>setChatId(e.target.value)}><option value="">Gespräch wählen</option>{chats.map(c=><option key={c.id} value={c.id}>{c.title||c.name||c.id}</option>)}</select><button disabled={!chatId} onClick={()=>act(()=>api('/memory/forget',{chatId}),'Gespräch wurde aus dem aktiven Memory entfernt.')}>Entfernen</button></div></SettingRow>
      </Group>
      <Group title="Letzte Änderungen">
        {!status.memory.changes.length&&<SettingRow title="Noch keine Versionen" description="Neue und bearbeitete Notizen werden hier sichtbar."/>}
        {status.memory.changes.slice(0,8).map((c:any)=><SettingRow key={c.id} title={c.path} description={`${date(c.created_at)} · ${c.kind}`}><button onClick={()=>act(async()=>{const current=await api('/knowledge/note?path='+encodeURIComponent(c.path)); await api('/memory/restore',{revision:c.id,path:c.path,version:current.version,projectId:current.projectId||'default'});},'Notiz als neue Version wiederhergestellt.')}>Version wiederherstellen</button></SettingRow>)}
      </Group>
    </>}
    {section==='storage'&&<>
      <Group title="Speicher">
        <SettingRow title="Freier Speicher" description={`${Math.round(status.storage.free_mb/1024)} GB verfügbar · SQLite ${Math.round(status.storage.database_bytes/1024/1024*10)/10} MB`}/>
        {number('retention','minimum_free_mb','Untergrenze in MB',100,100000,'Der Heartbeat meldet, wenn der freie Speicher darunter fällt.')}
      </Group>
      <Group title="Verschlüsselte Sicherung">
        <SettingRow title="Sicherungsordner" description="Absoluter Pfad außerhalb des Workspace. Ein lokaler Ordner schützt vor Änderungen; für einen Geräteausfall ein externes Laufwerk verwenden."><input aria-label="Sicherungsordner" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Automatisch: data/backups"/></SettingRow>
        <SettingRow title="Sicherung einrichten" description={status.backup_installed?'Neue Sicherungen erhalten einen Schlüssel im macOS-Schlüsselbund. Den Schlüssel für einen Gerätewechsel aus dem Tresor sichern.':'Das geprüfte Backup-Programm wird lokal installiert.'}><button onClick={()=>act(async()=>{if(!status.backup_installed)await api('/system/setup',{action:'backup'});await api('/system/backup/setup',{target,password:backupPassword||undefined}); setBackupPassword(''); await load(true);},'Sicherungsziel verbunden und täglicher Zeitplan aktiviert.')}>Einrichten / verbinden</button></SettingRow>
        <SettingRow title="Vorhandener Sicherungsschlüssel" description="Nur beim Verbinden eines bestehenden verschlüsselten Archivs erforderlich."><input aria-label="Vorhandener Sicherungsschlüssel" type="password" autoComplete="new-password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)}/></SettingRow>
        {toggle('backup','enabled','Täglich sichern','Speichert SQLite, Dateien und Memory-Historie verschlüsselt und dedupliziert. Modelle und Cache werden bei Bedarf neu aufgebaut.')}
        {time('backup','time','Sichern um')}
        {number('backup','daily','Tägliche Versionen',1,90)}
        {number('backup','weekly','Wöchentliche Versionen',0,52)}
        {number('backup','monthly','Monatliche Versionen',0,24)}
        <SettingRow title="Letzte Sicherung" description={date(status.maintenance.find((m:any)=>m.name==='backup')?.checked_at)}><button disabled={!v.backup.target} onClick={()=>run('backup')}>Jetzt sichern</button></SettingRow>
        <SettingRow title="Wiederherstellen" description="Zuerst in einen separaten Ordner entpacken und prüfen. Erst danach den Systemstand ersetzen."><button disabled={!v.backup.target} onClick={()=>act(async()=>setSnapshots((await api('/system/backups')).snapshots),'Sicherungsstände geladen.')}>Sicherungen anzeigen</button></SettingRow>
        {snapshots?.length===0&&<SettingRow title="Noch keine Sicherungen" description="Mit Jetzt sichern den ersten Stand erstellen."/>}
        {snapshots?.slice().reverse().map(s=><SettingRow key={s.id} title={date(s.time)} description={s.short_id||s.id.slice(0,8)}><button onClick={()=>act(async()=>setRestore(await api('/system/backups/restore',{snapshot:s.id})),'Sicherung entpackt und Prüfsummen bestätigt.')}>Wiederherstellung prüfen</button></SettingRow>)}
      </Group>
      <Group title="Aufbewahrung">
        {number('retention','logs_days','Python-Protokolle in Tagen',1,90)}
        {number('retention','events_days','Ereignisse und Kontextnachweise in Tagen',1,365)}
        {number('retention','runs_days','Ausführungsdetails in Tagen',7,730)}
        <SettingRow title="Speicherpflege" description="Bereinigt Protokolle, abgelaufene Sitzungen und Sicherungen nach diesen Regeln. Wissensdateien bleiben erhalten."><button onClick={()=>run('cleanup')}>Jetzt bereinigen</button></SettingRow>
      </Group>
    </>}
    {section==='access'&&<>
      <Group title="Zugang">
        <SettingRow title="Anmeldung" description={status.access.enabled?'Der Zugangsschlüssel liegt im macOS-Schlüsselbund.':'Auf diesem Gerät ist noch keine Anmeldung eingerichtet.'}><button onClick={()=>setAccess(true)}>{status.access.enabled?'Schlüssel ändern':'Schlüssel setzen'}</button></SettingRow>
        <SettingRow title="Mobil mit Tailscale" description="Private HTTPS-Verbindung zwischen deinen angemeldeten Geräten. Die App bleibt an localhost gebunden."><button onClick={onConnections}>Verbindung einrichten</button></SettingRow>
        {status.access.origin&&<SettingRow title="Mobile Adresse" description={status.access.origin}><a href={status.access.origin} target="_blank" rel="noreferrer">Öffnen</a></SettingRow>}
      </Group>
    </>}

    </fieldset>
    {access&&<Modal wide={false} title="Zugangsschlüssel" onClose={()=>{setAccess(false);setPassword('');}}><form onSubmit={e=>{e.preventDefault();act(async()=>{await api('/system/access',{password});setPassword('');setAccess(false);location.reload();},'Zugang eingerichtet. Bitte erneut anmelden.');}}><label className="field"><span>Neuer Zugangsschlüssel</span><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><p className="form-help">Bestehende Browser-Sitzungen werden abgemeldet.</p><div className="row end"><button className="primary" disabled={busy}>Schlüssel speichern</button></div></form></Modal>}
    {restore&&<Modal wide={false} title="Geprüfte Sicherung übernehmen" onClose={()=>setRestore(null)}><p>Die Prüfsummen und die SQLite-Datenbank sind gültig. Dieser Stand ersetzt beim Neustart den Workspace und die Datenbank. Der aktuelle Stand wird zuvor lokal zur Rückkehr aufbewahrt.</p><p className="form-help">Sicherung: {restore.snapshot.slice(0,12)} · Laufende Arbeit zuerst abschließen.</p><div className="row end"><button onClick={()=>setRestore(null)}>Abbrechen</button><button className="primary" disabled={busy} onClick={()=>act(()=>api('/system/backups/apply',{id:restore.id}),'Wiederherstellung wird beim Neustart übernommen.')}>Stand übernehmen und neu starten</button></div></Modal>}
  </div>;
}

export function TailscaleConnection({api}: {api:Api}) {
  const [state,setState]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const refresh=()=>api('/system/tailscale').then(setState).catch(e=>setError(e.message));
  useEffect(()=>{refresh();},[]);
  return <><p className="form-help">Tailscale verbindet deinen Mac und dein Mobilgerät über ein privates Netz. Melde beide Geräte im selben Tailnet an.</p><div className="settings-group"><SettingRow title="Tailscale" description={error||(!state?'Wird geprüft …':!state.installed?'Tailscale ist noch nicht installiert.':state.connected?'Auf diesem Mac angemeldet.':'Tailscale öffnen und anmelden.')}><button disabled={busy} onClick={refresh}>Erneut prüfen</button></SettingRow>{state?.installed&&<SettingRow title="HTTPS-Zugang" description={state.serving?state.url:'Gibt diese Anwendung im privaten Tailnet frei.'}><button disabled={busy||!state.connected||state.serving} onClick={async()=>{setBusy(true);setError('');try{setState(await api('/system/tailscale',{action:'serve'}));}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{busy?'Wird verbunden …':state.serving?'Verbunden':'Serve aktivieren'}</button></SettingRow>}</div>{state?.requiresApproval&&<p className="form-help">Tailscale benötigt eine einmalige Freigabe im Konto. <a href={state.approvalUrl} target="_blank" rel="noreferrer">Serve im Konto freigeben</a>. Danach erneut prüfen und verbinden.</p>}{!state?.installed&&<a href="https://tailscale.com/download" target="_blank" rel="noreferrer">Tailscale installieren</a>}{state?.serving&&<div className="row end"><a href={state.url} target="_blank" rel="noreferrer">Mobile Adresse öffnen</a></div>}</>;
}

export function CoreRunDetails({api,id}: {api:Api,id:string}) {
  const [data,setData]=useState<any>(null),[error,setError]=useState('');
  useEffect(()=>{let alive=true;const refresh=()=>api('/core/executions/'+id).then(d=>{if(alive)setData(d);}).catch(e=>{if(alive)setError(e.message);});refresh();const timer=setInterval(refresh,3000);return()=>{alive=false;clearInterval(timer);};},[id]);
  return <>{error&&<p role="alert" className="form-error">{error}</p>}{data?<><div className="settings-group"><SettingRow title="Ausführung" description={id}><span>{names[data.run.status]||data.run.status}</span></SettingRow><SettingRow title="Beginn" description={date(data.run.started_at)}/><SettingRow title="Versuch" description={String(data.run.attempt)}/>{data.run.error&&<SettingRow title="Fehler" description={data.run.error}/>}</div>{data.log&&<pre className="system-log">{data.log}</pre>}{Object.keys(data.run.result||{}).length>0&&<pre className="system-log">{JSON.stringify(data.run.result,null,2)}</pre>}{['queued','dispatching','running'].includes(data.run.status)&&<div className="row end"><button onClick={()=>api('/core/executions/'+id+'/cancel',{}).catch(e=>setError(e.message))}>Ausführung stoppen</button></div>}</>:<p role="status">Ausführung wird geladen …</p>}</>;
}
