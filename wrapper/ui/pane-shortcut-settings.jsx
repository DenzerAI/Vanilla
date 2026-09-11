import {useState,useSyncExternalStore} from 'react';
import {SettingRow} from './settings-row.jsx';
import {paneShortcutKey,paneShortcutEvent,defaultPaneShortcuts,parsePaneShortcuts,shortcutFromEvent,validPaneShortcut,sameShortcut,shortcutLabel} from './pane-shortcuts.mjs';
const read=()=>{try{return localStorage.getItem(paneShortcutKey);}catch{return null;}};
const subscribe=fn=>{window.addEventListener(paneShortcutEvent,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(paneShortcutEvent,fn);window.removeEventListener('storage',fn);};};
export function usePaneShortcuts(){return parsePaneShortcuts(useSyncExternalStore(subscribe,read,()=>null));}
export function PaneShortcutSettings(){
 const bindings=usePaneShortcuts(),[capture,setCapture]=useState(null),[error,setError]=useState('');
 function save(next){try{localStorage.setItem(paneShortcutKey,JSON.stringify(next));window.dispatchEvent(new Event(paneShortcutEvent));setCapture(null);setError('');}catch{setError('Die Tastenkürzel konnten nicht gespeichert werden.');}}
 function record(event,index){
  if(capture!==index)return;
  if(event.key==='Tab'){setCapture(null);return;}
  event.preventDefault();event.stopPropagation();
  if(event.key==='Escape'){setCapture(null);setError('');return;}
  if(event.repeat||event.isComposing||/^(Control|Shift|Alt|Meta)/.test(event.code))return;
  const value=shortcutFromEvent(event);
  if(!validPaneShortcut(value)){setError('Bitte eine Kombination mit Ctrl, Alt oder ⌘ wählen, oder eine F-Taste. Die vorhandenen App-Kürzel bleiben reserviert.');return;}
  if(bindings.some((other,i)=>i!==index&&sameShortcut(other,value))){setError('Diese Kombination ist bereits einer anderen Pane zugeordnet.');return;}
  save(bindings.map((old,i)=>i===index?value:old));
 }
 return <>
  <h3 className="section-heading">Diktieren in Chat 1–4</h3>
  <p className="page-note">Einmal drücken wählt den geöffneten Chat und startet das Diktat. Nochmals drücken beendet und sendet es mit Entwurf und Anhängen. Escape bricht ohne Senden ab. Auf diesem Gerät gespeichert; System- und Browserkürzel können Vorrang haben.</p>
  <div className="settings-group">
   {bindings.map((value,index)=><SettingRow key={index} title={`Chat ${index+1}`}><div className="row compact">
    <button type="button" aria-label={`Tastenkürzel für Chat ${index+1} ändern`} aria-pressed={capture===index} onClick={()=>{setCapture(index);setError('');}} onBlur={()=>setCapture(old=>old===index?null:old)} onKeyDownCapture={event=>record(event,index)}>{capture===index?'Kombination drücken …':shortcutLabel(value)}</button>
    <button type="button" disabled={!value} aria-label={`Tastenkürzel für Chat ${index+1} deaktivieren`} onClick={()=>save(bindings.map((old,i)=>i===index?null:old))}>Aus</button>
   </div></SettingRow>)}
   <SettingRow title="Standardbelegung"><button type="button" onClick={()=>save(defaultPaneShortcuts())}>Ctrl + Shift + 1–4 wiederherstellen</button></SettingRow>
  </div>
  {capture!==null&&<p role="status">Gewünschte Kombination drücken. Escape bricht ab.</p>}
  {error&&<p role="alert">{error}</p>}
 </>;
}
