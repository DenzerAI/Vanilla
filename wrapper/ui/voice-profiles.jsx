import React, {useState} from 'react';
import {Plus, Check, SquarePen, Trash2} from './icons.jsx';
import {Modal} from './modal.jsx';
import {SettingRow} from './settings-row.jsx';

export {voiceOptions} from './voice-profiles.mjs';
const button=(label,Icon,onClick,disabled,selected=false)=><button type="button" className="icon-button" aria-label={label} title={label} aria-pressed={selected} onClick={onClick} disabled={disabled}><Icon size={18}/></button>;

export function VoiceProfiles({profiles=[], selected='', disabled=false, onSave, onRemove, onSelect}) {
  const [editing,setEditing]=useState(null),[pending,setPending]=useState(false),[error,setError]=useState('');
  async function act(fn) {setPending(true);setError('');try {await fn();}catch(e){setError(e.message);}finally{setPending(false);}}
  const busy=disabled || pending;
  return <>
    <SettingRow title="Gespeicherte Stimmen">{button('Stimme hinzufügen',Plus,()=>setEditing({id:'',name:'',isNew:true}),busy)}</SettingRow>
    {profiles.map(v=><SettingRow key={v.id} title={v.name} description={v.id}><div className="row compact">
      {button(selected===v.id?'Stimme ausgewählt':'Stimme auswählen: '+v.name,Check,()=>act(()=>onSelect(v.id)),busy,selected===v.id)}
      {button('Stimme bearbeiten: '+v.name,SquarePen,()=>setEditing({...v,isNew:false}),busy)}
      {button('Profil entfernen: '+v.name,Trash2,()=>act(()=>onRemove(v.id)),busy)}
    </div></SettingRow>)}
    {error && <p role="alert">{error}</p>}
    {editing && <VoiceProfileForm profile={editing} onClose={()=>setEditing(null)} onSave={onSave}/>}
  </>;
}
function VoiceProfileForm({profile,onClose,onSave}) {
  const [id,setId]=useState(profile.id),[name,setName]=useState(profile.name),[saving,setSaving]=useState(false),[error,setError]=useState('');
  async function submit(e) {e.preventDefault();if(saving)return;setSaving(true);setError('');try{await onSave({id:id.trim(),name:name.trim(),select:profile.isNew});onClose();}catch(e){setError(e.message);}finally{setSaving(false);}}
  return <Modal title={profile.isNew?'Stimme hinzufügen':'Stimme bearbeiten'} onClose={()=>{if(!saving)onClose();}}>
    <form onSubmit={submit}>
      <label className="field"><span>Voice-ID</span><input value={id} onChange={e=>setId(e.target.value)} required maxLength={100} pattern="[a-zA-Z0-9_\-]+" readOnly={!profile.isNew} disabled={saving} autoComplete="off" spellCheck={false}/></label>
      <label className="field"><span>Name · optional</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={80} disabled={saving} autoComplete="off"/></label>
      <p className="muted">Ohne eigenen Namen übernehmen wir den Namen von ElevenLabs.</p>
      {error && <p role="alert">{error}</p>}
      <div className="row between"><button type="button" disabled={saving} onClick={onClose}>Abbrechen</button><button className="primary" disabled={saving}>{saving?'Wird gespeichert …':'Speichern'}</button></div>
    </form>
  </Modal>;
}
export function VoiceProfilesPreview() {
  const [profiles,setProfiles]=useState([{id:'demo_voice',name:'Erzählstimme'}]),[selected,setSelected]=useState('demo_voice');
  return <div className="settings-group"><VoiceProfiles profiles={profiles} selected={selected} onSelect={async id=>setSelected(id)} onSave={async v=>{setProfiles(p=>[...p.filter(x=>x.id!==v.id),{id:v.id,name:v.name || 'Beispielstimme'}]);if(v.select)setSelected(v.id);}} onRemove={async id=>{setProfiles(p=>p.filter(v=>v.id!==id));if(selected===id)setSelected('');}}/></div>;
}
