import {useState,useSyncExternalStore} from 'react';
import {SettingRow} from './settings-row.jsx';
import {dictationShortcutKey,dictationShortcutEvent,shortcutSettings,shortcutCode} from './dictation-shortcut.mjs';
const read=()=>{try{return localStorage.getItem(dictationShortcutKey);}catch{return null;}};
const subscribe=fn=>{window.addEventListener(dictationShortcutEvent,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(dictationShortcutEvent,fn);window.removeEventListener('storage',fn);};};
export function useDictationShortcut(){return shortcutSettings(useSyncExternalStore(subscribe,read,()=>null));}
export function DictationShortcutSettings(){
  const settings=useDictationShortcut(),[error,setError]=useState('');
  const automatic=shortcutCode('auto',navigator.platform)==='MetaRight'?'Rechte ⌘':'Rechte Strg';
  const save=change=>{try{localStorage.setItem(dictationShortcutKey,JSON.stringify({...settings,...change}));window.dispatchEvent(new Event(dictationShortcutEvent));setError('');}catch{setError('Das Tastenkürzel konnte nicht gespeichert werden.');}};
  return <>
    <SettingRow title="Diktat-Taste" description="Im aktiven Vanilla-Fenster, für die ausgewählte Chat-Pane. Auf diesem Gerät gespeichert.">
      <select aria-label="Diktat-Taste" value={settings.key} onChange={e=>save({key:e.target.value})}>
        <option value="auto">Automatisch · {automatic}</option><option value="MetaRight">Rechte ⌘ / Windows-Taste</option><option value="ControlRight">Rechte Strg</option><option value="off">Aus</option>
      </select>
    </SettingRow>
    <SettingRow title="Diktat-Bedienung" description="Beenden übernimmt den Text als Entwurf. Es wird nichts gesendet.">
      <select aria-label="Diktat-Bedienung" value={settings.mode} disabled={settings.key==='off'} onChange={e=>save({mode:e.target.value})}>
        <option value="toggle">Drücken zum Ein-/Ausschalten</option><option value="hold">Gedrückt halten · Push-to-talk</option>
      </select>
    </SettingRow>
    {error&&<p role="alert">{error}</p>}
  </>;
}
