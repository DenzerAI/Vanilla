import {useEffect,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton';
import {userProfilePath,readUserProfile,saveUserProfile} from './user-profile.mjs';
import {loadWeather,weatherDescription} from './weather-client.mjs';
type Point={latitude:number;longitude:number};
type Profile={name:string;location:string;point?:Point};
export function UserPreferences({api}:{api:any}) {
 const [source,setSource]=useState<string|null>(null),[draft,setDraft]=useState<Profile>({name:'',location:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[revision,setRevision]=useState(0);
 const [places,setPlaces]=useState<(Point&{id:number;label:string})[]>([]),[searchState,setSearchState]=useState(''),[searchRevision,setSearchRevision]=useState(0),[weather,setWeather]=useState<any>(null),[weatherRevision,setWeatherRevision]=useState(0);
 useEffect(()=>{let alive=true;api('/file/text?path='+encodeURIComponent(userProfilePath)).then((data:any)=>{if(alive){setSource(data.text);setDraft(readUserProfile(data.text));setError('');}}).catch((e:Error)=>{if(alive)setError(e.message);});return()=>{alive=false;};},[api,revision]);
 useEffect(()=>{
  let alive=true;setPlaces([]);setSearchState('');
  if(draft.point||draft.location.trim().length<2)return;
  setSearchState('Orte werden gesucht …');
  const timer=setTimeout(()=>{api('/weather/locations?q='+encodeURIComponent(draft.location.trim())).then((data:any)=>{if(alive){setPlaces(data.items);setSearchState(data.items.length?'Bitte wähle den passenden Ort.':'Kein Ort gefunden. Versuche Stadt oder Postleitzahl.');}}).catch(()=>{if(alive)setSearchState('Die Ortssuche ist gerade nicht erreichbar.');});},400);
  return()=>{alive=false;clearTimeout(timer);};
 },[api,draft.location,draft.point,searchRevision]);
 useEffect(()=>{
  let alive=true;if(source===null)return;setWeather({status:'loading'});
  void loadWeather(api,readUserProfile(source)).then((value:any)=>{if(alive)setWeather(value);});
  return()=>{alive=false;};
 },[api,source,weatherRevision]);
 if(source===null)return error?<p role="alert">Dein Profil konnte nicht geladen werden. <button onClick={()=>setRevision(r=>r+1)}>Erneut versuchen</button></p>:<Skeleton variant="settings" label="Dein Profil wird geladen …"/>;
 const saved=readUserProfile(source),dirty=saved.name!==draft.name||saved.location!==draft.location||JSON.stringify(saved.point)!==JSON.stringify(draft.point),needsPlace=!!draft.location.trim()&&!draft.point;
 return <form className="agent-preferences" onSubmit={async e=>{e.preventDefault();if(busy||needsPlace)return;setBusy(true);setError('');try{const text=await saveUserProfile(api,source,draft);setSource(text);setDraft(readUserProfile(text));setMessage('Dein Profil wurde gespeichert.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
  <div className="settings-save-row"><span role="status">{dirty?'Ungespeicherte Änderungen':message||'Keine Änderungen'}</span><button className="primary" disabled={busy||!dirty||needsPlace} type="submit">{busy?'Wird gespeichert …':'Speichern'}</button></div>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  <fieldset className="agent-form-fields" disabled={busy}>
   <h3 className="section-heading">Über dich</h3><div className="settings-group"><SettingRow title={<label htmlFor="user-name">Dein Name</label>} description="So möchtest du angesprochen werden."><input id="user-name" className="agent-name-input" autoComplete="nickname" maxLength={100} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></SettingRow></div>
   <h3 className="section-heading">Wetter</h3><div className="settings-group">
    <SettingRow title={<label htmlFor="user-weather-location">Dein Ort</label>} description="Stadt oder Postleitzahl eingeben und einen Treffer mit Region und Land auswählen."><input id="user-weather-location" className="agent-name-input" autoComplete="off" maxLength={100} aria-describedby="weather-search-status" value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value,point:undefined})}/></SettingRow>
    <SettingRow title="Ortsauswahl" description={<span id="weather-search-status" role="status">{draft.point?'Ort bestätigt. Beim Speichern wird das Wetter geladen.':searchState||'Gib mindestens zwei Zeichen ein.'}</span>}/>
    {places.map(place=><SettingRow key={place.id} title={place.label}><button type="button" onClick={()=>{setDraft({...draft,location:place.label,point:{latitude:place.latitude,longitude:place.longitude}});setPlaces([]);}}>Auswählen<span className="sr-only">: {place.label}</span></button></SettingRow>)}
    {searchState==='Die Ortssuche ist gerade nicht erreichbar.'&&<SettingRow title="Ortssuche"><button type="button" onClick={()=>setSearchRevision(r=>r+1)}>Erneut versuchen</button></SettingRow>}
    <SettingRow title="Wetterdaten" description={dirty?'Neue Ortsauswahl wird nach dem Speichern übernommen.':!saved.location?'Wähle deinen Wetterort aus.':weatherDescription(weather)}>{saved.point&&!dirty&&<button type="button" disabled={weather?.status==='loading'} onClick={()=>setWeatherRevision(r=>r+1)}>Aktualisieren</button>}</SettingRow>
    <SettingRow title="Datenquelle" description={<><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>, Ortsdaten von <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>. Die Suche übermittelt deine Ortseingabe, der Wetterabruf die Koordinaten. Aktualisierung alle zehn Minuten bei geöffnetem Chatstart. Keine amtliche Adressprüfung.</>}/>
   </div>
  </fieldset>
 </form>;
}
