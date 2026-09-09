import {useEffect,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton';
import {userProfilePath,readUserProfile,saveUserProfile} from './user-profile.mjs';
export function UserPreferences({api}:{api:any}) {
 const [source,setSource]=useState<string|null>(null),[draft,setDraft]=useState({name:'',location:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let alive=true;api('/file/text?path='+encodeURIComponent(userProfilePath)).then((data:any)=>{if(alive){setSource(data.text);setDraft(readUserProfile(data.text));setError('');}}).catch((e:Error)=>{if(alive)setError(e.message);});return()=>{alive=false;};},[api,revision]);
 if(source===null)return error?<p role="alert">Dein Profil konnte nicht geladen werden. <button onClick={()=>setRevision(r=>r+1)}>Erneut versuchen</button></p>:<Skeleton variant="settings" label="Dein Profil wird geladen …"/>;
 const saved=readUserProfile(source),dirty=saved.name!==draft.name||saved.location!==draft.location;
 return <form className="agent-preferences" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const text=await saveUserProfile(api,source,draft);setSource(text);setDraft(readUserProfile(text));setMessage('Dein Profil wurde gespeichert.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
  <div className="settings-save-row"><span role="status">{dirty?'Ungespeicherte Änderungen':message||'Keine Änderungen'}</span><button className="primary" disabled={busy||!dirty} type="submit">{busy?'Wird gespeichert …':'Speichern'}</button></div>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  <fieldset className="agent-form-fields" disabled={busy}>
   <h3 className="section-heading">Über dich</h3><div className="settings-group"><SettingRow title={<label htmlFor="user-name">Dein Name</label>} description="So möchtest du angesprochen werden."><input id="user-name" className="agent-name-input" autoComplete="nickname" maxLength={100} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></SettingRow></div>
   <h3 className="section-heading">Wetter</h3><div className="settings-group"><SettingRow title={<label htmlFor="user-weather-location">Dein Ort</label>} description="Stadt und bei Bedarf Land. Du kannst den Ort jederzeit ändern."><input id="user-weather-location" className="agent-name-input" autoComplete="address-level2" maxLength={100} value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/></SettingRow><SettingRow title="Wetterdaten" description="Der Ort wird gespeichert. Der Wetterabruf ist noch nicht angeschlossen."/></div>
  </fieldset>
 </form>;
}
