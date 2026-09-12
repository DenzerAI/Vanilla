import { createPortal } from 'react-dom';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal } from './modal.jsx';
import { X } from './icons.jsx';
import { LucideRotateCcw as RotateCcw } from './icon-variants.jsx';
import { GlassButton } from './components/ui/glass-button';
import { reconnectEventStream } from './chat-events.mjs';
import './system-notice.css';
import { AppLoader } from './app-loader';
import { createRestartRecovery } from './restart-recovery.mjs';

export function SystemNotice({api, message, onDismiss, ref, onBusyChange, user}) {
  const [status,setStatus] = useState(null), [confirmation,setConfirmation] = useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [authRequired,setAuthRequired] = useState(false), [loginOpen,setLoginOpen] = useState(false);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useImperativeHandle(ref, () => ({restart: () => {
    if (!busy && !confirmation) return restartServer();
  }}));
  const actionInFlight = useRef(false);
  const recovery = useRef(null);
  recovery.current ||= createRestartRecovery({reload: () => window.location.reload()});
  const wasUnauthorized = useRef(false);
  const presenceId = useRef(crypto.randomUUID());
  const initialInstance = useRef(null);
  useEffect(() => {
    let disposed = false, timer;
    async function poll() {
      if (document.hidden && !recovery.current.pending && !document.querySelector('.voice-strip')) {
        timer = setTimeout(poll,5000); return;
      }
      let next = null;
      try {
        next = await api('/updates');
        if (disposed) return;
        initialInstance.current ||= next.instanceId;
        setStatus(next);
        if (wasUnauthorized.current) {
          wasUnauthorized.current = false; setAuthRequired(false); setLoginOpen(false); setError('');
          reconnectEventStream();
        }
        // Presence is advisory and must not delay recovery after the new instance answers.
        if (!recovery.current.pending) {
          await api('/updates/presence', {id:presenceId.current, active:!!document.querySelector('.voice-strip')});
        }
      } catch (e) {
        if (!disposed && e.status === 401) {
          wasUnauthorized.current = true; setAuthRequired(true); setStatus(null);
          setConfirmation(null);
        }
      }
      if (disposed) return;
      const result = recovery.current.check(next);
      if (result === 'reloading') return;
      if (result === 'timeout') {
        actionInFlight.current = false;
        setBusy(false); setError('Der Server ist noch nicht erreichbar. Bitte Verbindung prüfen.');
      }
      timer = setTimeout(poll, recovery.current.pending ? 1000 : 5000);
    }
    poll();
    return () => {disposed = true; clearTimeout(timer);};
  }, [api]);
  const restart = status?.restartRequired;
  const reload = status && (status.uiVersion !== __UI_VERSION__ || status.instanceId !== initialInstance.current);
  async function restartServer(token) {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true); setError('');
    try {
      const latest = await api('/updates');
      if (!latest.instanceId) throw new Error('Der Serverstatus ist unvollständig. Bitte erneut versuchen.');
      await api('/updates/presence', {id:presenceId.current, active:!!document.querySelector('.voice-strip')});
      const result = await api('/updates/restart', token ? {confirmation:token} : {});
      if (result.confirmationRequired) { setConfirmation({...result,action:'restart'}); setBusy(false); actionInFlight.current = false; }
      else {setConfirmation(null); recovery.current.start(latest.instanceId);}
    } catch(e) {setError(e.message); setBusy(false); setConfirmation(null); actionInFlight.current = false;}
  }
  function reloadPage() {
    // HTML is fresh; versioned assets reuse the browser cache. Server turns
    // continue independently while the browser loads the current UI.
    window.location.reload();
  }
  const updateOnly = !authRequired && !error && !message && (busy || restart || reload);
  const visible = authRequired || restart || reload || busy || error || message;
  return <>
    {visible && createPortal(<div className={"system-notice" + (updateOnly ? " system-update" : "")} role="status" aria-live="polite">
      {!updateOnly && <span className="system-notice-text">{authRequired ? 'Bitte erneut anmelden.' : error || message}</span>}
      {authRequired && <button onClick={()=>setLoginOpen(true)}>Anmelden</button>}
      {!authRequired && (busy || restart || reload) && <GlassButton size="sm" disabled={busy} aria-busy={busy} onClick={()=>restart ? restartServer() : reloadPage()}><span className="system-notice-icon" aria-hidden="true">{busy ? <AppLoader size={14} preview /> : <RotateCcw size={14}/>}</span><span>{busy ? 'Neustarten …' : restart ? 'Neustarten' : 'Aktualisieren'}</span></GlassButton>}
      {!authRequired && !busy && (message || error || (!restart && !reload)) && <button className="system-notice-close" aria-label="Hinweis schließen" onClick={()=>{setError('');onDismiss();}}><X size={16}/></button>}
    </div>, document.body)}
    {loginOpen && <SessionLogin api={api} onClose={()=>setLoginOpen(false)} onAuthenticated={account=>{
      // Eine andere Person sieht andere Chats: dann sauber neu laden statt fremden Zustand weiterzuführen.
      if (user?.id && account?.id && account.id !== user.id) { window.location.reload(); return; }
      wasUnauthorized.current=false; setAuthRequired(false); setLoginOpen(false); setError('');
      onDismiss(); reconnectEventStream();
    }}/>}
    {confirmation && <Modal className="system-confirmation" title="Laufende Session beenden?" onClose={()=>!busy && setConfirmation(null)}>
      <p>{confirmation.count === 1 ? 'Eine Session läuft noch.' : `${confirmation.count} Sessions laufen noch.`} Beim Neustart werden laufende Sessions beendet.</p>
      <div className="system-confirmation-actions">
        <button data-autofocus disabled={busy} onClick={()=>setConfirmation(null)}>Abbrechen</button>
        <button className="danger" disabled={busy} onClick={()=>restartServer(confirmation.confirmation)}>Beenden und neu starten</button>
      </div>
    </Modal>}
  </>;
}

function SessionLogin({api,onClose,onAuthenticated}) {
  const [name,setName]=useState(''), [password,setPassword]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api('/auth/login', name.trim() ? {name:name.trim(),password} : {token:password});
      await api('/bootstrap');
      onAuthenticated(result?.user);
    } catch(e) { setError(e.message); }
    finally { setPassword(''); setBusy(false); }
  }
  return <Modal className="system-confirmation" title="Erneut anmelden" onClose={()=>!busy&&onClose()}>
    <p>Deine geöffneten Chats und Entwürfe bleiben erhalten.</p>
    <form onSubmit={submit}>
      <label className="field"><span>Name</span><input data-autofocus type="text" autoComplete="username" autoCapitalize="off" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
      <label className="field"><span>Passwort</span><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
      <p className="form-help">Ohne Konto: Name leer lassen und den Zugangscode der Installation eintragen.</p>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="system-confirmation-actions"><button type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button type="submit" disabled={busy}>{busy?'Anmeldung läuft …':'Anmelden'}</button></div>
    </form>
  </Modal>;
}
