import React,{useState} from 'react';

export function MessengerConnectionForm({connection,api,projectId,Field,onSaved}:any){
  const [current,setCurrent]=useState(connection),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState<any>(null),[qr,setQr]=useState(0);
  const telegram=current.provider==='telegram-user';
  async function run(action:()=>Promise<any>){setBusy(true);setError('');try{const r=await action();setStatus(r);return r;}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  return <div>
    <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(async()=>{const c=await api('/messenger/connections',{id:current.id||'',projectId,provider:current.provider||'whatsapp',name:String(f.get('name')),role:String(f.get('role')||'inbox'),bridgeUrl:String(f.get('bridgeUrl')||''),sourceDb:String(f.get('sourceDb')||''),enabled:true});setCurrent(c);return c;});}}>
      <Field label="Name"><input name="name" defaultValue={current.name|| (telegram?'Telegram':'WhatsApp')} required/></Field>
      {!telegram&&<><Field label="Verwendung"><select name="role" defaultValue={current.role||'inbox'} disabled={!!current.id}><option value="inbox">Meine Inbox</option><option value="agent-send">Schreibkanal des Agenten · im Hintergrund</option></select>{current.id&&<input type="hidden" name="role" value={current.role}/>}</Field><details><summary>Bridge-Einrichtung</summary><Field label="Lokale Bridge-Adresse"><input name="bridgeUrl" defaultValue={current.bridge_url||''} placeholder="http://127.0.0.1:PORT" required/></Field><Field label="Datenbank des vorhandenen Verlaufs"><input name="sourceDb" defaultValue={current.source_db||''} readOnly={!!current.id}/></Field></details></>}
      <div className="modal-actions"><button className="primary" disabled={busy}>Speichern</button></div>
    </form>
    {current.id&&<>
      <p>{current.role==='agent-send'?'Dieser Kanal erscheint nicht in der Inbox. Er startet keine automatischen Antworten.':current.error|| (current.status==='connected'?'Verbunden':'Verbindung prüfen')}</p>
      {!telegram&&current.status!=='connected'&&<><button type="button" onClick={()=>setQr(Date.now())}>QR-Code zur Anmeldung anzeigen</button>{qr>0&&<img className="messenger-pairing" src={'/api/messenger/pairing?'+new URLSearchParams({id:current.id,projectId,t:String(qr)})} alt="WhatsApp-QR-Code zur Gerätekopplung"/>}</>}
      {telegram&&<>
        <details><summary>Telegram-App hinterlegen</summary><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>api('/messenger/telegram/configure',{id:current.id,projectId,apiId:String(f.get('apiId')),apiHash:String(f.get('apiHash'))}));}}><p>App-Zugang aus <a href="https://my.telegram.org/apps" target="_blank" rel="noreferrer">my.telegram.org</a>. Ein Bot-Token meldet dein persönliches Konto nicht an.</p><Field label="API-ID"><input name="apiId" required inputMode="numeric"/></Field><Field label="API-Hash"><input name="apiHash" type="password" required autoComplete="off"/></Field><button disabled={busy}>App speichern</button></form></details>
        <form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>api('/messenger/telegram/start',{id:current.id,projectId,phone:String(f.get('phone'))}));}}><Field label="Rufnummer mit Ländervorwahl"><input type="tel" name="phone" required/></Field><button disabled={busy}>Anmeldecode anfordern</button></form>
        {['code_required','password_required'].includes(status?.state)&&<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void run(()=>api('/messenger/telegram/finish',{id:current.id,projectId,code:String(f.get('code')||''),password:String(f.get('password')||'')}));}}><Field label={status.state==='password_required'?'Telegram-Passwort':'Anmeldecode'}><input name={status.state==='password_required'?'password':'code'} type="password" autoComplete="off" required/></Field><button disabled={busy}>Anmelden</button></form>}
      </>}
      <div className="modal-actions"><button disabled={busy} onClick={()=>void run(async()=>{const c=await api('/messenger/check',{id:current.id,projectId});setCurrent(c);return c;})}>Prüfen</button>{current.role==='inbox'&&<button disabled={busy} onClick={()=>void run(()=>api('/messenger/sync',{id:current.id,projectId}))}>Abgleichen</button>}<button disabled={busy} onClick={()=>void run(async()=>{await api('/messenger/disconnect',{id:current.id,projectId});onSaved();})}>Trennen</button><button className="primary" onClick={onSaved}>Fertig</button></div>
    </>}
    {status&&<p role="status">{status.error|| (status.authorized||status.status==='connected'?'Verbunden':status.messages!=null?`${status.messages} Nachrichten abgeglichen`:status.state==='code_required'?'Code in Telegram nachsehen.':status.state==='password_required'?'Telegram-Passwort erforderlich.':'Gespeichert')}</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
