import {useEffect,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Modal} from './modal.jsx';
import {Skeleton} from './skeleton';

type Api=(path:string,data?:any)=>Promise<any>;
type User={id:string;name:string;role:'owner'|'member';createdAt?:number};
const roleLabel=(role:string)=>role==='owner'?'Eigentümer':'Mitglied';

/** Benutzer dieser Installation. Eigentümer verwalten Konten, Mitglieder ändern nur ihr Passwort. */
export function UsersSettings({api,user}:{api:Api;user:User}) {
  const [users,setUsers]=useState<User[]|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [adding,setAdding]=useState(false),[passwordFor,setPasswordFor]=useState<User|null>(null),[removing,setRemoving]=useState<User|null>(null);
  const owner=user.role==='owner', legacy=user.id==='owner';
  async function load(){try{const data=await api('/users');setUsers(data.users);setError('');}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void load();},[]);
  async function act(fn:()=>Promise<any>,success:string){setBusy(true);setError('');setMessage('');try{await fn();setMessage(success);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(users===null&&!error)return <Skeleton variant="settings" label="Benutzer werden geladen …"/>;
  if(users===null)return <p role="alert">Die Benutzer konnten nicht geladen werden: {error} <button type="button" onClick={()=>void load()}>Erneut laden</button></p>;
  return <div className="agent-preferences">
    <div className="settings-save-row"><span role="status">{error||message||(legacy?'Angemeldet mit dem Zugangscode der Installation.':`Angemeldet als ${user.name}.`)}</span>
      <button type="button" onClick={()=>act(async()=>{await api('/auth/logout',{});location.reload();},'Abgemeldet.')} disabled={busy}>Abmelden</button></div>
    <h3 className="section-heading">Konten</h3>
    <div className="settings-group">
      {(users||[]).map(u=><SettingRow key={u.id} title={<>{u.name}{u.id===user.id&&<span className="page-note"> · du</span>}</>} description={roleLabel(u.role)}>
        <span className="row">
          {(owner||u.id===user.id)&&<button type="button" disabled={busy} onClick={()=>setPasswordFor(u)}>Passwort</button>}
          {owner&&u.id!==user.id&&<button type="button" disabled={busy} onClick={()=>act(()=>api(`/users/${u.id}/role`,{role:u.role==='owner'?'member':'owner'}),'Rolle geändert.')}>{u.role==='owner'?'Zum Mitglied':'Zum Eigentümer'}</button>}
          {owner&&u.id!==user.id&&<button type="button" className="danger" disabled={busy} onClick={()=>setRemoving(u)}>Entfernen</button>}
        </span>
      </SettingRow>)}
      {!users?.length&&<SettingRow title="Noch keine Konten" description="Bis jemand ein Konto hat, gilt allein der Zugangscode. Lege zuerst dein eigenes Konto als Eigentümer an."/>}
      {owner&&<SettingRow title="Konto anlegen" description="Name und ein erstes Passwort. Mitglieder sehen nur ihre eigenen Chats; Eigentümer sehen alle und verwalten Konten."><button type="button" className="primary" disabled={busy} onClick={()=>setAdding(true)}>Anlegen</button></SettingRow>}
    </div>
    <h3 className="section-heading">Was Benutzer bedeuten</h3>
    <div className="settings-group">
      <SettingRow title="Chats" description="Jeder Chat gehört der Person, die ihn begonnen hat. Kanäle und Aufträge gehören der Installation und damit den Eigentümern."/>
      <SettingRow title="Private Chats" description="Die Chat-PIN bleibt der Schutz für persönliche Inhalte, auch gegenüber Eigentümern."/>
      <SettingRow title="Gemeinsames Gedächtnis" description="Memory, CRM und Firmenbasis sind je Installation gemeinsam. Benutzer trennen Chats, nicht das Wissen."/>
    </div>
    {adding&&<UserForm title="Konto anlegen" busy={busy} withRole onClose={()=>setAdding(false)} onSubmit={draft=>act(async()=>{await api('/users',draft);setAdding(false);},'Konto angelegt.')}/>}
    {passwordFor&&<UserForm title={`Passwort für ${passwordFor.name}`} busy={busy} passwordOnly withCurrent={!owner&&passwordFor.id===user.id} onClose={()=>setPasswordFor(null)} onSubmit={draft=>act(async()=>{await api(`/users/${passwordFor.id}/password`,{password:draft.password,current:draft.current});setPasswordFor(null);if(passwordFor.id===user.id)location.reload();},'Passwort geändert.')}/>}
    {removing&&<Modal className="system-confirmation" title={`${removing.name} entfernen?`} onClose={()=>!busy&&setRemoving(null)}>
      <p>Die Person kann sich nicht mehr anmelden. Ihre Chats bleiben in der Installation erhalten und gehören dann den Eigentümern.</p>
      <div className="system-confirmation-actions"><button data-autofocus type="button" disabled={busy} onClick={()=>setRemoving(null)}>Abbrechen</button><button type="button" className="danger" disabled={busy} onClick={()=>act(async()=>{await api(`/users/${removing.id}/remove`,{});setRemoving(null);},'Konto entfernt.')}>Entfernen</button></div>
    </Modal>}
  </div>;
}

function UserForm({title,busy,withRole=false,passwordOnly=false,withCurrent=false,onClose,onSubmit}:{title:string;busy:boolean;withRole?:boolean;passwordOnly?:boolean;withCurrent?:boolean;onClose:()=>void;onSubmit:(draft:any)=>void}) {
  const [draft,setDraft]=useState({name:'',password:'',current:'',role:'member'});
  return <Modal wide={false} title={title} onClose={()=>!busy&&onClose()}>
    <form onSubmit={e=>{e.preventDefault();onSubmit(draft);}}>
      {!passwordOnly&&<label className="field"><span>Name</span><input data-autofocus autoComplete="off" maxLength={60} minLength={2} required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>}
      {withCurrent&&<label className="field"><span>Aktuelles Passwort</span><input type="password" autoComplete="current-password" required value={draft.current} onChange={e=>setDraft({...draft,current:e.target.value})}/></label>}
      <label className="field"><span>{passwordOnly?'Neues Passwort':'Passwort'}</span><input {...(passwordOnly&&!withCurrent?{'data-autofocus':true}:{})} type="password" autoComplete="new-password" minLength={8} required value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/></label>
      {withRole&&<label className="field"><span>Rolle</span><select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}><option value="member">Mitglied</option><option value="owner">Eigentümer</option></select></label>}
      <p className="form-help">{passwordOnly?'Alle Sitzungen dieser Person werden beendet.':'Mindestens 8 Zeichen. Das Passwort kann später geändert werden.'}</p>
      <div className="row end"><button type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button className="primary" disabled={busy}>{busy?'Wird gespeichert …':'Speichern'}</button></div>
    </form>
  </Modal>;
}
