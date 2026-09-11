import {useId, useState, type FormEvent} from 'react';
import {Lock} from './icons.jsx';
import {Modal} from './modal.jsx';
import {IconButton} from './icon-button';
import {changeChatPrivacy} from './chat-privacy-client.mjs';
import './chat-privacy.css';

type Props = {id:string; action:'setup'|'unlock'|'remove'; api:(url:string, body:any)=>Promise<any>; onDone:()=>void; onClose?:()=>void; preview?:boolean};
export function ChatPrivacyForm({id, action, api, onDone, onClose, preview=false}:Props) {
  const [pin, setPin] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const field = useId(), errorId = useId();
  const setup = action === 'setup';
  async function submit(event:FormEvent) {
    event.preventDefault();
    if(busy) return;
    if(setup && pin !== confirm) {setError('Die beiden PINs stimmen nicht überein.'); return;}
    setBusy(true); setError('');
    try {if(preview) await api(action,{pin}); else await changeChatPrivacy(api, action, id, pin); setPin(''); setConfirm(''); onDone();}
    catch(e) {setError((e as Error).message); setPin(''); setConfirm('');}
    finally {setBusy(false);}
  }
  return <form className="chat-privacy-form" onSubmit={submit}>
    {setup && <p>Vier Ziffern schützen diesen Chat vor Mitlesen in der App. Merke dir die PIN. Es gibt keine PIN-Wiederherstellung.</p>}
    {setup && <p className="page-note">Der Titel wird verborgen und der Chat aus dem aktiven gemeinsamen Gedächtnis entfernt. Bereits exportierte Dateien und Sicherungen bleiben bestehen.</p>}
    {action === 'remove' && <p>Mit deiner PIN entfernst du den Schutz. Das gemeinsame Gedächtnis bleibt für diesen Chat ausgeschaltet.</p>}
    <label htmlFor={field}>{setup ? 'Neue PIN' : 'Vierstellige PIN'}</label>
    <input id={field} type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} required autoComplete="off" autoFocus
      aria-describedby={error ? errorId : undefined} value={pin} onChange={e=>setPin(e.target.value.replace(/[^0-9]/g,''))} disabled={busy}/>
    {setup && <><label htmlFor={field+'-confirm'}>PIN wiederholen</label><input id={field+'-confirm'} type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} minLength={4} required autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value.replace(/[^0-9]/g,''))} disabled={busy}/></>}
    {error && <p id={errorId} role="alert">{error}</p>}
    <div className="row">{onClose && <button type="button" onClick={onClose} disabled={busy}>Abbrechen</button>}<button className="primary" disabled={busy || pin.length !== 4 || (setup && confirm.length !== 4)}><Lock size={18}/>{busy ? 'Bitte warten …' : setup ? 'Chat sperren' : action === 'remove' ? 'Schutz entfernen' : 'Entsperren'}</button></div>
  </form>;
}
export function LockedChat(props:Omit<Props,'action'>) {
  return <div className="chat-privacy-locked"><Lock size={32}/><h2>Privater Chat</h2><p>Dieser Chat ist gesperrt.</p><ChatPrivacyForm {...props} action="unlock"/></div>;
}
export function ChatPrivacyDialog(props:Props & {onClose:()=>void}) {
  return <Modal wide={false} title={props.action === 'setup' ? 'Chat sperren' : 'Schutz entfernen'} onClose={props.onClose}><ChatPrivacyForm {...props}/></Modal>;
}

export function ChatPrivacyPreview() {
  const [locked,setLocked] = useState(true), [setup,setSetup] = useState(false);
  const api = async (_url:string, body:any) => {if(body.pin !== '0042') throw new Error('Die PIN stimmt nicht.');};
  return <section aria-label="Chat-Sperre als Beispiel">
    <p className="page-note">Lokale Vorschau mit Beispiel-PIN 0042. Sie verändert keinen Chat.</p>
    <button onClick={()=>setSetup(true)}>PIN-Dialog zeigen</button>
    {locked ? <LockedChat preview id="privacy-preview" api={api} onDone={()=>setLocked(false)}/> : <div className="row"><span>Beispiel entsperrt</span><IconButton label="Beispiel sperren" onClick={()=>setLocked(true)}><Lock size={18}/></IconButton></div>}
    {setup && <ChatPrivacyDialog preview id="privacy-preview" action="setup" api={api} onClose={()=>setSetup(false)} onDone={()=>{setSetup(false);setLocked(true);}}/>}
  </section>;
}
