import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal } from './modal.jsx';
import { X, RotateCcw } from './icons.jsx';
import { reconnectEventStream } from './chat-events.mjs';
import './system-notice.css';

export function SystemNotice({api, message, onDismiss, ref, onBusyChange}) {
  const [status,setStatus] = useState(null), [confirmation,setConfirmation] = useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [authRequired,setAuthRequired] = useState(false), [loginOpen,setLoginOpen] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useImperativeHandle(ref, () => ({restart: () => {
    if (!busy && !confirmation) return restartServer();
  }}));
  const restartInstance = useRef(null);
  const wasUnauthorized = useRef(false);
  const presenceId = useRef(crypto.randomUUID());
  const initialInstance = useRef(null), deadline = useRef(0);
  useEffect(() => {
    let disposed = false;
    async function poll() {
      try {
        const next = await api('/updates');
        if (disposed) return;
        initialInstance.current ||= next.instanceId;
        if (deadline.current && next.instanceId !== restartInstance.current) {
          deadline.current = 0; setBusy(false); setError('');
          // Reload stays explicit: drafts and recordings remain available until then.
        }
        setStatus(next);
        if (wasUnauthorized.current) {
          wasUnauthorized.current = false; setAuthRequired(false); setLoginOpen(false); setError('');
          reconnectEventStream();
        }
        await api('/updates/presence', {id:presenceId.current, active:!!document.querySelector('.voice-strip')});
      } catch (e) {
        if (!disposed && e.status === 401) {
          wasUnauthorized.current = true; setAuthRequired(true); setStatus(null);
          deadline.current = 0; setBusy(false); setError(''); setConfirmation(null);
        }
      }
      if (!disposed && deadline.current && Date.now() > deadline.current) {
        deadline.current = 0; setBusy(false); setError('Der Server ist noch nicht erreichbar. Bitte Verbindung prüfen.');
      }
    }
    poll(); const timer = setInterval(poll, 5000);
    return () => {disposed = true; clearInterval(timer);};
  }, [api]);
  const restart = status?.restartRequired;
  const reload = status && (status.uiVersion !== __UI_VERSION__ || status.instanceId !== initialInstance.current);
  async function restartServer(token) {
    setBusy(true); setError('');
    try {
      const latest = await api('/updates');
      restartInstance.current = latest.instanceId;
      await api('/updates/presence', {id:presenceId.current, active:!!document.querySelector('.voice-strip')});
      const result = await api('/updates/restart', token ? {confirmation:token} : {});
      if (result.confirmationRequired) { setConfirmation({...result,action:'restart'}); setBusy(false); }
      else {setConfirmation(null); deadline.current = Date.now()+60000;}
    } catch(e) {setError(e.message); setBusy(false); setConfirmation(null);}
  }
  async function reloadPage() {
    setBusy(true); setError('');
    try {
      const latest = await api('/updates');
      setStatus(latest);
      const recording = !!document.querySelector('.voice-strip');
      const draft = [...document.querySelectorAll('textarea')].some(field=>field.value.trim()) || !!document.querySelector('.attachment');
      if (latest.activeCount || recording || draft) {setConfirmation({action:'reload', count:latest.activeCount, recording, draft}); setBusy(false);}
      else window.location.reload();
    } catch(e) {setError(e.message); setBusy(false);}
  }
  const updateOnly = !authRequired && !error && !busy && (restart || reload);
  const visible = authRequired || restart || reload || busy || error || message;
  return <>
    {visible && <div className={"system-notice" + (updateOnly ? " system-update" : "")} role="status" aria-live="polite">
      {!updateOnly && <span className="system-notice-text">{authRequired ? 'Bitte erneut anmelden.' : error || (busy ? (deadline.current ? 'Startet neu …' : 'Wird vorbereitet …') : restart ? 'Update bereit' : reload ? 'Neue Version' : message)}</span>}
      {authRequired && <button onClick={()=>setLoginOpen(true)}>Anmelden</button>}
      {!authRequired && !busy && (restart || reload) && <button onClick={()=>restart ? restartServer() : reloadPage()}><RotateCcw size={14} aria-hidden="true"/><span>{restart ? 'Neustarten' : 'Aktualisieren'}</span></button>}
      {!authRequired && !restart && !reload && !busy && <button className="system-notice-close" aria-label="Hinweis schließen" onClick={()=>{setError('');onDismiss();}}><X size={16}/></button>}
    </div>}
    {loginOpen && <SessionLogin api={api} onClose={()=>setLoginOpen(false)} onAuthenticated={()=>{
      wasUnauthorized.current=false; setAuthRequired(false); setLoginOpen(false); setError('');
      onDismiss(); reconnectEventStream();
    }}/>}
    {confirmation && <Modal className="system-confirmation" title={confirmation.action === 'restart' ? 'Laufende Session beenden?' : 'Seite wirklich neu laden?'} onClose={()=>!busy && setConfirmation(null)}>
      <p>{confirmation.action === 'restart'
        ? `${confirmation.count === 1 ? 'Eine Session läuft noch.' : `${confirmation.count} Sessions laufen noch.`} Beim Neustart werden laufende Sessions beendet.`
        : 'Beim Neuladen werden lokale Sprachaufnahmen und nicht gesendete Entwürfe geschlossen. Laufende Antworten auf dem Server arbeiten weiter.'}</p>
      <div className="system-confirmation-actions">
        <button data-autofocus disabled={busy} onClick={()=>setConfirmation(null)}>Abbrechen</button>
        <button className="danger" disabled={busy} onClick={()=>confirmation.action === 'restart' ? restartServer(confirmation.confirmation) : window.location.reload()}>{confirmation.action === 'restart' ? 'Beenden und neu starten' : 'Trotzdem neu laden'}</button>
      </div>
    </Modal>}
  </>;
}

function SessionLogin({api,onClose,onAuthenticated}) {
  const [password,setPassword]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('/auth/login',{token:password});
      await api('/bootstrap');
      onAuthenticated();
    } catch(e) { setError(e.message); }
    finally { setPassword(''); setBusy(false); }
  }
  return <Modal className="system-confirmation" title="Erneut anmelden" onClose={()=>!busy&&onClose()}>
    <p>Deine geöffneten Chats und Entwürfe bleiben erhalten.</p>
    <form onSubmit={submit}>
      <label className="field"><span>Zugangscode</span><input data-autofocus type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="system-confirmation-actions"><button type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button type="submit" disabled={busy}>{busy?'Anmeldung läuft …':'Anmelden'}</button></div>
    </form>
  </Modal>;
}
