import {useEffect,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Modal} from './modal.jsx';
import {Skeleton} from './skeleton';
import {UserPreferences} from './user-preferences';

type Api=(path:string,data?:any)=>Promise<any>;
type User={id:string;name:string;role:'owner'|'member';createdAt?:number};
const roleLabel=(role:string)=>role==='owner'?'Eigentümer':'Mitglied';
const randomKey=()=>{const a=new Uint8Array(18);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('').replace(/(.{6})(?=.)/g,'$1-');};

/** Konto: dein Profil, deine Anmeldung, weitere Personen und der Rückweg-Schlüssel der Installation. */
export function UsersSettings({api,user,accounts=true}:{api:Api;user:User;accounts?:boolean}) {
  return <>
    <UserPreferences api={api}/>
    {accounts&&<AccountsSection api={api} user={user}/>}
  </>;
}

function AccountsSection({api,user}:{api:Api;user:User}) {
  const [users,setUsers]=useState<User[]|null>(null),[accessConfigured,setAccessConfigured]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [adding,setAdding]=useState(false),[passwordFor,setPasswordFor]=useState<User|null>(null),[removing,setRemoving]=useState<User|null>(null),[keyChange,setKeyChange]=useState(false);
  const owner=user.role==='owner', legacy=user.id==='owner';
  async function load(){try{const data=await api('/users');setUsers(data.users);setAccessConfigured(data.accessConfigured!==false);setError('');}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void load();},[]);
  async function act(fn:()=>Promise<any>,success:string){setBusy(true);setError('');setMessage('');try{await fn();setMessage(success);await load();return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
  if(users===null&&!error)return <Skeleton variant="settings" label="Konten werden geladen …"/>;
  if(users===null)return <p role="alert">Die Konten konnten nicht geladen werden: {error} <button type="button" onClick={()=>void load()}>Erneut laden</button></p>;
  const first=!users.length;
  const modalOpen=adding||!!passwordFor||keyChange||!!removing;
  return <div className="agent-preferences">
    <h3 className="section-heading">Anmeldung</h3>
    <div className="settings-group">
      <SettingRow title={legacy?(accessConfigured?'Angemeldet mit dem Rückweg-Schlüssel':'Noch ohne Anmeldung'):`Angemeldet als ${user.name}`} description={legacy?(accessConfigured?'Ohne persönliches Konto. Lege unten deines an.':'Lege dein Konto an, dann ist die Installation geschützt.'):roleLabel(user.role)}>
        {(accessConfigured||!first)&&<button type="button" onClick={()=>act(async()=>{await api('/auth/logout',{});location.reload();},'Abgemeldet.')} disabled={busy}>Abmelden</button>}
      </SettingRow>
      {(message||(error&&!modalOpen))&&<SettingRow title={<span role={error?'alert':'status'} className={error?'inline-error':undefined}>{error||message}</span>}/>}
    </div>
    <h3 className="section-heading">Konten</h3>
    <div className="settings-group">
      {users.map(u=><SettingRow key={u.id} title={<>{u.name}{u.id===user.id&&<span className="page-note"> · du</span>}</>} description={roleLabel(u.role)}>
        <span className="row">
          {(owner||u.id===user.id)&&<button type="button" disabled={busy} onClick={()=>{setError('');setPasswordFor(u);}}>Passwort</button>}
          {owner&&u.id!==user.id&&<button type="button" disabled={busy} onClick={()=>act(()=>api(`/users/${u.id}/role`,{role:u.role==='owner'?'member':'owner'}),'Rolle geändert.')}>{u.role==='owner'?'Zum Mitglied':'Zum Eigentümer'}</button>}
          {owner&&u.id!==user.id&&<button type="button" className="danger" disabled={busy} onClick={()=>setRemoving(u)}>Entfernen</button>}
        </span>
      </SettingRow>)}
      {first&&<SettingRow title="Dein Konto" description="Das erste Konto bist du, als Eigentümer. Dabei entsteht der Rückweg-Schlüssel der Installation."/>}
      {owner&&<SettingRow title={first?'Konto anlegen':'Weitere Person'} description={first?'Name und Passwort. Ab dann meldet sich jeder mit Name und Passwort an.':'Mitglieder sehen nur ihre eigenen Chats; Eigentümer sehen alle und verwalten Konten.'}><button type="button" className="primary" disabled={busy} onClick={()=>{setError('');setAdding(true);}}>Anlegen</button></SettingRow>}
    </div>
    {owner&&<>
      <h3 className="section-heading">Rückweg-Schlüssel</h3>
      <div className="settings-group">
        <SettingRow title="Ein Schlüssel für die ganze Installation" description={accessConfigured?'Gesetzt. Damit kommst du ohne Konto hinein, falls ein Passwort verloren geht; Skripte nutzen ihn als Zugang. Mindestens 8 Zeichen, beliebige Zeichen. Ändern meldet alle Geräte ab.':'Entsteht mit dem ersten Konto.'}>
          {accessConfigured&&<button type="button" disabled={busy} onClick={()=>{setError('');setKeyChange(true);}}>Ändern</button>}
        </SettingRow>
      </div>
    </>}
    <h3 className="section-heading">Was Konten bedeuten</h3>
    <div className="settings-group">
      <SettingRow title="Chats" description="Jeder Chat gehört der Person, die ihn begonnen hat. Kanäle und Aufträge gehören der Installation und damit den Eigentümern."/>
      <SettingRow title="Private Chats" description="Die Chat-PIN bleibt der Schutz für persönliche Inhalte, auch gegenüber Eigentümern."/>
      <SettingRow title="Gemeinsames Gedächtnis" description="Memory, CRM und Firmenbasis sind je Installation gemeinsam. Konten trennen Chats, nicht das Wissen."/>
    </div>
    {adding&&<UserForm title={first?'Dein Konto anlegen':'Konto anlegen'} busy={busy} error={error} withRole={!first} withKey={!accessConfigured} onClose={()=>{setAdding(false);setError('');}} onSubmit={draft=>act(async()=>{
      const payload:any={name:draft.name,password:draft.password,role:first?'owner':draft.role};
      if(!accessConfigured)payload.accessKey=draft.accessKey;
      await api('/users',payload);
      if(!accessConfigured){await api('/auth/login',{name:draft.name,password:draft.password});location.reload();return;}
      setAdding(false);
    },'Konto angelegt.')}/>}
    {passwordFor&&<UserForm title={`Passwort für ${passwordFor.name}`} busy={busy} error={error} passwordOnly withCurrent={!owner&&passwordFor.id===user.id} onClose={()=>{setPasswordFor(null);setError('');}} onSubmit={draft=>act(async()=>{await api(`/users/${passwordFor.id}/password`,{password:draft.password,current:draft.current});setPasswordFor(null);if(passwordFor.id===user.id)location.reload();},'Passwort geändert.')}/>}
    {keyChange&&<UserForm title="Rückweg-Schlüssel ändern" busy={busy} error={error} keyOnly onClose={()=>{setKeyChange(false);setError('');}} onSubmit={draft=>act(async()=>{await api('/system/access',{password:draft.accessKey});location.reload();},'Schlüssel geändert.')}/>}
    {removing&&<Modal className="system-confirmation" title={`${removing.name} entfernen?`} onClose={()=>!busy&&setRemoving(null)}>
      <p>Die Person kann sich nicht mehr anmelden. Ihre Chats bleiben in der Installation erhalten und gehören dann den Eigentümern.</p>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="system-confirmation-actions"><button data-autofocus type="button" disabled={busy} onClick={()=>setRemoving(null)}>Abbrechen</button><button type="button" className="danger" disabled={busy} onClick={()=>act(async()=>{await api(`/users/${removing.id}/remove`,{});setRemoving(null);},'Konto entfernt.')}>Entfernen</button></div>
    </Modal>}
  </div>;
}

function UserForm({title,busy,error,withRole=false,withKey=false,passwordOnly=false,keyOnly=false,withCurrent=false,onClose,onSubmit}:{title:string;busy:boolean;error?:string;withRole?:boolean;withKey?:boolean;passwordOnly?:boolean;keyOnly?:boolean;withCurrent?:boolean;onClose:()=>void;onSubmit:(draft:any)=>void}) {
  const [draft,setDraft]=useState({name:'',password:'',current:'',role:'member',accessKey:withKey||keyOnly?randomKey():''});
  return <Modal wide={false} title={title} onClose={()=>!busy&&onClose()}>
    <form onSubmit={e=>{e.preventDefault();onSubmit(draft);}}>
      {!passwordOnly&&!keyOnly&&<label className="field"><span>Name</span><input data-autofocus autoComplete="off" maxLength={60} minLength={2} required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>}
      {withCurrent&&<label className="field"><span>Aktuelles Passwort</span><input type="password" autoComplete="current-password" required value={draft.current} onChange={e=>setDraft({...draft,current:e.target.value})}/></label>}
      {!keyOnly&&<label className="field"><span>{passwordOnly?'Neues Passwort':'Passwort'}</span><input {...(passwordOnly&&!withCurrent?{'data-autofocus':true}:{})} type="password" autoComplete="new-password" minLength={8} required value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/></label>}
      {withRole&&<label className="field"><span>Rolle</span><select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}><option value="member">Mitglied</option><option value="owner">Eigentümer</option></select></label>}
      {(withKey||keyOnly)&&<label className="field"><span>Rückweg-Schlüssel</span><input {...(keyOnly?{'data-autofocus':true}:{})} type="text" autoComplete="off" spellCheck={false} minLength={8} required value={draft.accessKey} onChange={e=>setDraft({...draft,accessKey:e.target.value})}/></label>}
      <p className="form-help">{keyOnly?'Ein Schlüssel für die ganze Installation, mindestens 8 Zeichen. Alle Geräte werden abgemeldet.':withKey?'Vorgeschlagen und frei änderbar. Notiere den Schlüssel: Er ist der einzige Weg hinein, falls dein Passwort verloren geht. Nach dem Speichern bist du mit deinem Konto angemeldet.':passwordOnly?'Alle Sitzungen dieser Person werden beendet.':'Mindestens 8 Zeichen. Das Passwort kann später geändert werden.'}</p>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="row end"><button type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button className="primary" disabled={busy}>{busy?'Wird gespeichert …':'Speichern'}</button></div>
    </form>
  </Modal>;
}
