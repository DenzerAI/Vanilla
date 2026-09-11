import {VoiceProfiles,voiceOptions} from './voice-profiles.jsx';
import {DictationShortcutSettings} from './dictation-shortcut-settings.jsx';
import {Skeleton} from './skeleton.tsx';
import { SettingRow as SettingsRow } from "./settings-row.jsx";
import React, {useState,useEffect,useRef} from 'react';
import {Play, Square, Download, Trash2, RotateCcw, Check, Volume2, Plus} from './icons.jsx';
import {BrandIcon} from './brand-icon.jsx';
import {all,sync,downloadLocal} from './dictation-storage.mjs';
import {microphone,microphoneError} from './dictation-audio.mjs';
import {SpeechPlayback} from './speech-playback.mjs';
const actionButton=(label,Icon,action,disabled=false)=><button type="button" className="icon-button" aria-label={label} title={label} onClick={action} disabled={disabled}><Icon size={18}/></button>;
export function VoiceSettings({api,notify,openConnections,onText}) {
  const [speech,setSpeech]=useState(null),[dictation,setDictation]=useState(null),[devices,setDevices]=useState([]),[device,setDevice]=useState(()=>localStorage.getItem('agent-microphone') || ''),[voices,setVoices]=useState([]),[next,setNext]=useState(null),[saving,setSaving]=useState(false),[playState,setPlayState]=useState('idle'),[history,setHistory]=useState(false),[local,setLocal]=useState([]),[trash,setTrash]=useState(false);
  const [loadError,setLoadError]=useState('');
  const playback=useRef(null); if(!playback.current) playback.current=new SpeechPlayback(api,setPlayState);
  async function refresh() { setLoadError(''); const [s,d,l]=await Promise.all([api('/speech/status'),api('/dictation/status'),all('recordings').catch(()=>[])]);setSpeech(s);setDictation(d);setLocal(l); }
  const act=fn=>async()=>{setSaving(true);try{await fn();await refresh();}catch(e){notify(e.message);}finally{setSaving(false);}};
  async function listDevices(){const items=await navigator.mediaDevices?.enumerateDevices?.() || [];setDevices(items.filter(d=>d.kind==='audioinput'));}
  useEffect(()=> {refresh().catch(e=>setLoadError(e.message));listDevices().catch(()=>{});navigator.mediaDevices?.addEventListener?.('devicechange',listDevices);return()=>{void playback.current.close();navigator.mediaDevices?.removeEventListener?.('devicechange',listDevices);};},[]);
  useEffect(()=>{if(!history)return;const t=setInterval(()=>sync(api).then(refresh).catch(()=>{}),2000);return()=>clearInterval(t);},[history]);
  async function loadVoices(token){const r=await api('/speech/voices'+(token?'?next='+encodeURIComponent(token):''));setVoices(v=>token?[...v,...r.voices]:r.voices);setNext(r.hasMore?r.next:null);}
  useEffect(()=>{if(speech?.elevenlabs)loadVoices().catch(e=>notify(e.message));},[speech?.elevenlabs]);
  if ((!speech || !dictation) && !loadError) return <Skeleton variant="settings" label="Stimme wird geladen …"/>;
  if ((!speech || !dictation) && loadError) return <p role="alert">{loadError} <button onClick={()=>refresh().catch(e=>setLoadError(e.message))}>Erneut laden</button></p>;
  const patch=changes=>act(()=>api('/speech/settings',changes));
  const audition=()=>{if(playState!=='idle'){playback.current.cancel();return;}void playback.current.speak('Hallo, ich bin deine deutsche Stimme. Wie kann ich dir helfen?').catch(e=>notify(e.message));};
  return <>
    <h3 className="section-heading">Allgemein</h3>
    <div className="settings-group">
      <SettingsRow title="Mikrofon" description="Für Diktat und Sprachchat."><select aria-label="Mikrofon" value={device} onChange={e=>{setDevice(e.target.value);localStorage.setItem('agent-microphone',e.target.value);}}><option value="">Systemstandard</option>{devices.filter(d=>d.deviceId && d.deviceId!=='default').map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${i+1}`}</option>)}</select></SettingsRow>
      <SettingsRow title="Mikrofon prüfen"><button type="button" disabled={saving} onClick={act(async()=>{let s;try{s=await microphone(navigator.mediaDevices,device);await listDevices();notify('Mikrofon ist bereit.');}catch(e){throw new Error(microphoneError(e));}finally{s?.getTracks().forEach(t=>t.stop());}})}>Prüfen</button></SettingsRow>
    </div>
    <h3 className="section-heading">Diktat</h3>
    <div className="settings-group">
      <SettingsRow title="Erkennung" description={dictation?.provider==='groq'?'Audio wird mit Groq verarbeitet.':'Deutsch · auf diesem Mac.'}><select aria-label="Diktaterkennung" disabled={!dictation || saving} value={dictation?.provider || 'local'} onChange={e=>act(()=>api('/dictation/settings',{provider:e.target.value}))()}><option value="local">Whisper · lokal{dictation?.localReady?'':' · nicht bereit'}</option>{dictation?.groq && <option value="groq">Groq</option>}</select></SettingsRow>
      <DictationShortcutSettings/>
      <SettingsRow title="Gesicherte Aufnahmen" description="Auch verworfene Aufnahmen bleiben erhalten."><button type="button" onClick={()=>setHistory(!history)}>{history?'Schließen':'Verwalten'}</button></SettingsRow>
    </div>
    {history && <div className="voice-recordings">
      <div className="voice-history-filter"><button type="button" aria-pressed={!trash} onClick={()=>setTrash(false)}>Aufnahmen</button><button type="button" aria-pressed={trash} onClick={()=>setTrash(true)}>Papierkorb</button></div>
      {!trash && local.filter(r=>!dictation?.recordings.some(s=>s.id===r.id)).map(r=><SettingsRow key={r.id} title={new Date(r.createdAt).toLocaleString('de-DE')} description="Nur im Browser gesichert">{actionButton('Browserkopie herunterladen',Download,act(()=>downloadLocal(r.id)))}</SettingsRow>)}
      {dictation?.recordings.filter(r=>(r.state==='trash')===trash).map(r=><div key={r.id} className="voice-recording"><SettingsRow title={new Date(r.createdAt).toLocaleString('de-DE')} description={r.processing?'Wird erkannt …':r.error || (r.state==='recording'?'Unterbrochen':r.text?'Text verfügbar':undefined)}><div className="row compact"><a className="icon-button" aria-label="Audio herunterladen" title="Audio herunterladen" href={'/api/dictation/audio?id='+r.id} download><Download size={18}/></a>{trash?actionButton('Wiederherstellen',RotateCcw,act(()=>api('/dictation/trash',{id:r.id,restore:true}))):<>{actionButton('Erneut erkennen',RotateCcw,act(async()=>{await sync(api);await api('/dictation/transcribe',{id:r.id});}),r.processing)}{actionButton('Verwerfen',Trash2,act(()=>api('/dictation/trash',{id:r.id})),r.processing)}</>}</div></SettingsRow>{r.text && !trash && <details><summary>Text anzeigen</summary><p>{r.text}</p><button type="button" onClick={()=>onText(r.text)}>In Chat übernehmen</button></details>}{local.some(l=>l.id===r.id) && <details><summary>Browserkopie</summary><button type="button" onClick={act(()=>downloadLocal(r.id))}>WAV herunterladen</button></details>}</div>)}
      {!dictation?.recordings.some(r=>(r.state==='trash')===trash) && <p className="muted">{trash?'Papierkorb ist leer.':'Noch keine Aufnahmen auf dem Mac.'}</p>}
    </div>}
    <h3 className="section-heading">Sprachchat</h3>
    <div className="settings-group">
      <SettingsRow title="Sprachausgabe" description={speech?.provider==='elevenlabs'?'Antworttexte werden an ElevenLabs übertragen.':'Piper · deutsche Stimme lokal installiert.'}><select aria-label="Sprachausgabe" disabled={!speech || saving} value={speech?.provider || 'local'} onChange={e=>patch({provider:e.target.value})()}><option value="local">Lokal</option>{speech?.elevenlabs && <option value="elevenlabs">ElevenLabs</option>}</select></SettingsRow>
      <SettingsRow title="Stimme" description={speech?.provider==='local'?(speech?.localReady?'Thorsten · Deutsch · bereit':'Thorsten wird noch eingerichtet.'):undefined}><div className="row compact">{speech?.provider==='elevenlabs'?<select aria-label="Stimme auswählen" value={speech?.voiceId || ''} disabled={saving} onChange={e=>patch({voiceId:e.target.value})()}><option value="">Stimme wählen</option>{voiceOptions(speech.voiceProfiles,voices,speech.voiceId).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>:<span>Thorsten</span>}{actionButton(playState==='idle'?'Stimme anhören':'Wiedergabe stoppen',playState==='idle'?Play:Square,audition,!speech || (speech.provider==='local'?!speech.localReady:!speech.voiceId))}</div></SettingsRow>
      {speech?.provider==='elevenlabs' && next && <SettingsRow title="Weitere Stimmen"><button type="button" onClick={act(()=>loadVoices(next))}>Laden</button></SettingsRow>}
      {speech?.provider==='elevenlabs' && <VoiceProfiles profiles={speech.voiceProfiles} selected={speech.voiceId} disabled={saving} onSave={async profile=>{setSpeech(await api('/speech/voices/save',profile));}} onRemove={async id=>{setSpeech(await api('/speech/voices/remove',{id}));}} onSelect={async voiceId=>{setSpeech(await api('/speech/settings',{voiceId}));}}/>}
      <SettingsRow title="Automodus" description="Im Sprachchat nach einer Sprechpause senden, Antwort vorlesen und wieder zuhören."><span className="voice-toggle"><button type="button" className="apple-switch" role="switch" aria-label="Automodus" aria-checked={!!speech?.autoMode} disabled={!speech || saving} onClick={patch({autoMode:!speech?.autoMode})}><span/></button></span></SettingsRow>
    </div>
    <p className="page-note">Sprachchat startet erst per Klick. Diktat bleibt ein Entwurf.</p>
    <div className="settings-group"><SettingsRow title="Sprachdienste" description="Groq und ElevenLabs hinzufügen oder bearbeiten."><button type="button" onClick={openConnections}>Verbindungen</button></SettingsRow></div>
  </>;
}
export function AudioConnectionForm({name,connected,api,onSaved,notify}) {
  const [key,setKey]=useState(''),[saving,setSaving]=useState(false);
  async function save(e){e.preventDefault();setSaving(true);try{if(name==='Groq'){const s=await api('/dictation/status');await api('/dictation/settings',{provider:s.provider,key});}else await api('/speech/connect',{key});setKey('');await onSaved();}catch(e){notify(e.message);}finally{setSaving(false);}}
  return <form onSubmit={save}><div className="connection-brand"><BrandIcon name={name}/><strong>{name}</strong></div><label className="field"><span>API-Schlüssel</span><input type="password" autoComplete="new-password" required value={key} onChange={e=>setKey(e.target.value)} placeholder={connected?'Schlüssel ersetzen':''}/></label><p className="muted">Im macOS-Schlüsselbund gespeichert.</p><div className="row between">{connected?<button type="button" disabled={saving} onClick={async()=>{setSaving(true);try{await api(name==='Groq'?'/dictation/disconnect':'/speech/disconnect',{});await onSaved();}catch(e){notify(e.message);}finally{setSaving(false);}}}>Verbindung entfernen</button>:<span/>}<button className="primary" disabled={saving}>{saving?'Wird verbunden …':connected?'Speichern':'Verbinden'}</button></div></form>;
}
