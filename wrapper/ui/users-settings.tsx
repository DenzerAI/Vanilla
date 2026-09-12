import {useEffect,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Modal} from './modal.jsx';
import {Skeleton} from './skeleton';
import {UserPreferences} from './user-preferences';
import {userProfilePath,readUserProfile,saveUserProfile} from './user-profile.mjs';

type Api=(path:string,data?:any)=>Promise<any>;
type User={id:string;name:string;role:'owner'|'developer'|'member';createdAt?:number};
const ROLES:[string,string][]=[['owner','Eigentümer'],['developer','Entwickler'],['member','Mitarbeiter']];
const roleLabel=(role:string)=>ROLES.find(([id])=>id===role)?.[1]||role;
const randomKey=()=>{const a=new Uint8Array(18);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghjkmnpqrstuvwxyz23456789'[b%31]).join('').replace(/(.{6})(?=.)/g,'$1-');};

/** Konto: du, deine Anrede, weitere Personen und der Rückweg-Schlüssel der Installation. */
export function UsersSettings({api,user,accounts=true}:{api:Api;user:User;accounts?:boolean}) {
  const [account,setAccount]=useState<User|null>(null),[data,setData]=useState<{users:User[];accessConfigured:boolean}|null>(null),[loadError,setLoadError]=useState('');
  const load=async()=>{try{const d=await api('/users');setData({users:d.users,accessConfigured:d.accessConfigured!==false});setAccount(d.me&&d.me.id!=='owner'?d.me:null);setLoadError('');}catch(e){setLoadError((e as Error).message);}};
  useEffect(()=>{if(accounts)void load();},[]);
  if(!accounts)return <UserPreferences api={api}/>;
  if(data===null&&!loadError)return <Skeleton variant="settings" label="Konto wird geladen …"/>;
  if(data===null)return <p role="alert">Das Konto konnte nicht geladen werden: {loadError} <button type="button" onClick={()=>void load()}>Erneut laden</button></p>;
  return <>
    <AccountsSection api={api} user={user} data={data} reload={load} part="me"/>
    <UserPreferences api={api} accountName={account?.name}/>
    <AccountsSection api={api} user={user} data={data} reload={load} part="others"/>
  </>;
}

function AccountsSection({api,user,data,reload,part}:{api:Api;user:User;data:{users:User[];accessConfigured:boolean};reload:()=>Promise<void>;part:'me'|'others'}) {
  const {users,accessConfigured}=data;
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [adding,setAdding]=useState(false),[passwordFor,setPasswordFor]=useState<User|null>(null),[removing,setRemoving]=useState<User|null>(null),[keyChange,setKeyChange]=useState(false);
  const owner=user.role==='owner', legacy=user.id==='owner', first=!users.length;
  async function act(fn:()=>Promise<any>,success:string){setBusy(true);setError('');setMessage('');try{await fn();setMessage(success);await reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const modalOpen=adding||!!passwordFor||keyChange||!!removing;
  const me=users.find(u=>u.id===user.id);
  const others=users.filter(u=>u.id!==user.id);
  const status=(message||(error&&!modalOpen))&&<SettingRow title={<span role={error?'alert':'status'} className={error?'inline-error':undefined}>{error||message}</span>}/>;
  const modals=<>
    {adding&&<UserForm title={first?'Dein Konto anlegen':'Person anlegen'} busy={busy} error={error} withRole={!first} withKey={!accessConfigured} onClose={()=>{setAdding(false);setError('');}} onSubmit={draft=>act(async()=>{
      const payload:any={name:draft.name,password:draft.password,role:first?'owner':draft.role};
      if(!accessConfigured)payload.accessKey=draft.accessKey;
      await api('/users',payload);
      if(first){
        // Die Anrede folgt dem Kontonamen, solange niemand einen Alias setzt.
        try{const current=await api('/file/text?path='+encodeURIComponent(userProfilePath));const profile=readUserProfile(current.text);if(!profile.name)await saveUserProfile(api,current.text,{...profile,name:draft.name});}catch{}
        await api('/auth/login',{name:draft.name,password:draft.password});location.reload();return;
      }
      setAdding(false);
    },'Konto angelegt.')}/>}
    {passwordFor&&<UserForm title={`Passwort für ${passwordFor.name}`} busy={busy} error={error} passwordOnly withCurrent={!owner&&passwordFor.id===user.id} onClose={()=>{setPasswordFor(null);setError('');}} onSubmit={draft=>act(async()=>{await api(`/users/${passwordFor.id}/password`,{password:draft.password,current:draft.current});setPasswordFor(null);if(passwordFor.id===user.id)location.reload();},'Passwort geändert.')}/>}
    {keyChange&&<UserForm title="Rückweg-Schlüssel ändern" busy={busy} error={error} keyOnly onClose={()=>{setKeyChange(false);setError('');}} onSubmit={draft=>act(async()=>{await api('/system/access',{password:draft.accessKey});location.reload();},'Schlüssel geändert.')}/>}
    {removing&&<Modal className="system-confirmation" title={`${removing.name} entfernen?`} onClose={()=>!busy&&setRemoving(null)}>
      <p>Die Person kann sich nicht mehr anmelden. Ihre Chats bleiben in der Installation erhalten und gehören dann den Eigentümern.</p>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="system-confirmation-actions"><button data-autofocus type="button" disabled={busy} onClick={()=>setRemoving(null)}>Abbrechen</button><button type="button" className="danger" disabled={busy} onClick={()=>act(async()=>{await api(`/users/${removing.id}/remove`,{});setRemoving(null);},'Konto entfernt.')}>Entfernen</button></div>
    </Modal>}
  </>;
  if(part==='me')return <div className="agent-preferences">
    <h3 className="section-heading">Du</h3>
    <div className="settings-group">
      {me?<SettingRow title={me.name} description={roleLabel(me.role)}>
        <span className="row"><button type="button" disabled={busy} onClick={()=>{setError('');setPasswordFor(me);}}>Passwort</button><button type="button" disabled={busy} onClick={()=>act(async()=>{await api('/auth/logout',{});location.reload();},'Abgemeldet.')}>Abmelden</button></span>
      </SettingRow>
      :first?<SettingRow title="Noch kein Konto" description="Das erste Konto bist du, als Eigentümer. Dabei entsteht der Rückweg-Schlüssel der Installation."><button type="button" className="primary" disabled={busy} onClick={()=>{setError('');setAdding(true);}}>Konto anlegen</button></SettingRow>
      :<SettingRow title={legacy?'Angemeldet mit dem Rückweg-Schlüssel':`Angemeldet als ${user.name}`} description={legacy?'Ohne persönliches Konto.':roleLabel(user.role)}><button type="button" disabled={busy} onClick={()=>act(async()=>{await api('/auth/logout',{});location.reload();},'Abgemeldet.')}>Abmelden</button></SettingRow>}
      {status}
    </div>
    {modals}
  </div>;
  return <div className="agent-preferences">
    {(owner||others.length>0)&&<><h3 className="section-heading">Weitere Personen</h3>
    <div className="settings-group">
      {others.map(u=><SettingRow key={u.id} title={u.name} description={roleLabel(u.role)}>
        {owner&&<span className="row">
          <button type="button" disabled={busy} onClick={()=>{setError('');setPasswordFor(u);}}>Passwort</button>
          <RolePicker value={u.role} disabled={busy} onChange={role=>act(()=>api(`/users/${u.id}/role`,{role}),'Rolle geändert.')}/>
          <button type="button" className="danger" disabled={busy} onClick={()=>setRemoving(u)}>Entfernen</button>
        </span>}
      </SettingRow>)}
      {owner&&!first&&<SettingRow title="Person anlegen" description="Name, Passwort und Rolle. Entwickler und Mitarbeiter sehen nur ihre eigenen Chats; Eigentümer sehen alle und verwalten Konten."><button type="button" className="primary" disabled={busy} onClick={()=>{setError('');setAdding(true);}}>Anlegen</button></SettingRow>}
      {owner&&first&&<SettingRow title="Weitere Personen" description="Sobald dein eigenes Konto steht, kannst du hier Personen anlegen."/>}
      {status}
    </div></>}
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
      <SettingRow title="Rollen" description="Eigentümer verwalten Konten und sehen alle Chats. Entwickler und Mitarbeiter sind vorerst Titel mit denselben Rechten: eigene Chats, gemeinsames Wissen."/>
      <SettingRow title="Chats" description="Jeder Chat gehört der Person, die ihn begonnen hat. Kanäle und Aufträge gehören der Installation und damit den Eigentümern."/>
      <SettingRow title="Private Chats" description="Die Chat-PIN bleibt der Schutz für persönliche Inhalte, auch gegenüber Eigentümern."/>
    </div>
    {modals}
  </div>;
}

function RolePicker({value,disabled,onChange}:{value:string;disabled:boolean;onChange:(role:string)=>void}) {
  return <select aria-label="Rolle" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{ROLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>;
}

function UserForm({title,busy,error,withRole=false,withKey=false,passwordOnly=false,keyOnly=false,withCurrent=false,onClose,onSubmit}:{title:string;busy:boolean;error?:string;withRole?:boolean;withKey?:boolean;passwordOnly?:boolean;keyOnly?:boolean;withCurrent?:boolean;onClose:()=>void;onSubmit:(draft:any)=>void}) {
  const [draft,setDraft]=useState({name:'',password:'',current:'',role:'member',accessKey:withKey||keyOnly?randomKey():''});
  return <Modal wide={false} title={title} onClose={()=>!busy&&onClose()}>
    <form onSubmit={e=>{e.preventDefault();onSubmit(draft);}}>
      {!passwordOnly&&!keyOnly&&<label className="field"><span>Name</span><input data-autofocus autoComplete="off" maxLength={60} minLength={2} required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>}
      {withCurrent&&<label className="field"><span>Aktuelles Passwort</span><input type="password" autoComplete="current-password" required value={draft.current} onChange={e=>setDraft({...draft,current:e.target.value})}/></label>}
      {!keyOnly&&<label className="field"><span>{passwordOnly?'Neues Passwort':'Passwort'}</span><input {...(passwordOnly&&!withCurrent?{'data-autofocus':true}:{})} type="password" autoComplete="new-password" minLength={8} required value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/></label>}
      {withRole&&<label className="field"><span>Rolle</span><select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}>{ROLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
      {(withKey||keyOnly)&&<label className="field"><span>Rückweg-Schlüssel</span><input {...(keyOnly?{'data-autofocus':true}:{})} type="text" autoComplete="off" spellCheck={false} minLength={8} required value={draft.accessKey} onChange={e=>setDraft({...draft,accessKey:e.target.value})}/></label>}
      <p className="form-help">{keyOnly?'Ein Schlüssel für die ganze Installation, mindestens 8 Zeichen. Alle Geräte werden abgemeldet.':withKey?'Vorgeschlagen und frei änderbar. Notiere den Schlüssel: Er ist der einzige Weg hinein, falls dein Passwort verloren geht. Nach dem Speichern bist du mit deinem Konto angemeldet.':passwordOnly?'Alle Sitzungen dieser Person werden beendet.':'Mindestens 8 Zeichen. Das Passwort kann später geändert werden.'}</p>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="row end"><button type="button" disabled={busy} onClick={onClose}>Abbrechen</button><button className="primary" disabled={busy}>{busy?'Wird gespeichert …':'Speichern'}</button></div>
    </form>
  </Modal>;
}
