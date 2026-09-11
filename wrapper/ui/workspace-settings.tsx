import React,{useEffect,useId,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton';
import {projectIcons,projectColors} from './appearance.mjs';
import {FilterPicker} from './filter-picker.jsx';
import './workspace-settings.css';

export const workspaceExplanation='Ein Workspace bündelt Gespräche, Dateien und besondere Arbeitsweisen für ein Thema. Du arbeitest weiterhin mit deinem Assistenten und dem gemeinsamen Firmenwissen.';
export function WorkspaceInfo({onCreate,busy=false}:{onCreate?:()=>void;busy?:boolean}){
  return <div className="workspace-explanation">
    <p>{workspaceExplanation}</p>
    <p>Ein eigener Workspace ist freiwillig. Ohne eigene Aufteilung bleiben Gespräche, Aufträge und Ergebnisse in Allgemein.</p>
    <p>Die Einrichtung im Chat klärt Zweck, Besonderheiten, benötigte Unterlagen und Skills. Bereits bekannte Angaben werden übernommen.</p>
    {onCreate&&<button type="button" className="primary" disabled={busy} onClick={onCreate}>{busy?'Wird geöffnet …':'Im Chat einrichten'}</button>}
  </div>;
}
type API=(route:string,body?:any)=>Promise<any>;
export function WorkspaceDefinitionEditor({api,projectId,onSaved,onCancel,onConfigure}:{api:API;projectId:string;onSaved:(result:any)=>void;onCancel:()=>void;onConfigure?:()=>void}){
  const prefix=useId();
  const [source,setSource]=useState<any>(null),[draft,setDraft]=useState<any>({});
  const [error,setError]=useState(''),[saving,setSaving]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let disposed=false;
    api('/workspaces/definition?id='+encodeURIComponent(projectId)).then(value=>{
      if(disposed)return;setSource(value);setError('');
      setDraft({name:value.profile.name||value.project.name,description:value.profile.description||'',status:value.profile.status||'ready',icon:value.profile.icon||value.project.icon||'folder',color:value.profile.color||value.project.color||'default',body:value.body});
    }).catch(reason=>{if(!disposed)setError(reason.message);});
    return ()=>{disposed=true;};
  },[api,projectId,attempt]);
  const update=(key:string,value:string)=>setDraft((old:any)=>({...old,[key]:value}));
  if(!source)return error?<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Erneut laden</button></div>:<Skeleton variant="settings" label="Workspace wird geladen …"/>;
  return <form className="workspace-definition-editor" onSubmit={async event=>{
    event.preventDefault();setSaving(true);setError('');
    try{const result=await api('/workspaces/save',{id:projectId,revision:source.revision,...draft});if((event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action')==='configure')onConfigure?.();else onSaved(result);}
    catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setSaving(false);}
  }}>
    <p className="page-note">Name und Arbeitsweise gehören zu diesem Thema. Dein Assistent und die vorhandenen Dateien bleiben dieselben.</p>
    {error&&<p role="alert" className="inline-error">{error}</p>}
    <fieldset disabled={saving}>
      <div className="settings-group">
        <SettingRow title={<label htmlFor={prefix+'name'}>Name</label>}><input id={prefix+'name'} value={draft.name} required maxLength={80} onChange={e=>update('name',e.target.value)}/></SettingRow>
        <SettingRow title={<label htmlFor={prefix+'description'}>Zweck</label>}><input id={prefix+'description'} value={draft.description} maxLength={500} onChange={e=>update('description',e.target.value)}/></SettingRow>
        <SettingRow title={<label htmlFor={prefix+'status'}>Einrichtung</label>}><select id={prefix+'status'} value={draft.status} onChange={e=>update('status',e.target.value)}><option value="draft">In Einrichtung</option><option value="ready">Bereit</option></select></SettingRow>
        <SettingRow title={<label htmlFor={prefix+'icon'}>Symbol</label>}><select id={prefix+'icon'} value={draft.icon} onChange={e=>update('icon',e.target.value)}>{projectIcons.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></SettingRow>
        <SettingRow title={<label htmlFor={prefix+'color'}>Farbe</label>}><select id={prefix+'color'} value={draft.color} onChange={e=>update('color',e.target.value)}>{projectColors.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></SettingRow>
      </div>
      <label className="workspace-definition-body"><span>Arbeitsweise, Quellen und Skills</span><textarea rows={9} value={draft.body} onChange={e=>update('body',e.target.value)}/></label>
      <p className="form-help">Vorhandene Skills hier verlinken. Eigene wiederverwendbare Abläufe können im Einrichtungschat angelegt werden.</p>
      {onConfigure&&<button type="submit" data-action="configure">Speichern und im Chat weiter einrichten</button>}
    </fieldset>
    <div className="row end"><button type="button" disabled={saving} onClick={onCancel}>Abbrechen</button><button className="primary" disabled={saving}>{saving?'Wird gespeichert …':'Speichern'}</button></div>
  </form>;
}
export function WorkspaceSettingsPreview(){
  const [saved,setSaved]=useState<any>(null);
  const [workspace,setWorkspace]=useState('all');
  const [definition,setDefinition]=useState({project:{id:'example',name:'Beispielbereich'},profile:{name:'Beispielbereich',description:'Sammelt Entwürfe und passende Arbeitsweisen.',status:'draft'},body:'# Arbeitsweise\n\nVerwende die gemeinsamen Firmenquellen.\n\n## Skills\n\nVorhandene Abläufe bei Bedarf verlinken.\n',revision:'example'});
  const api:API=async(_route,body)=>{if(body){const next={...definition,profile:body,body:body.body,revision:'example-next'};setDefinition(next);return {project:next.profile};}return definition;};
  return <><WorkspaceInfo/><WorkspaceDefinitionEditor api={api} projectId="example" onSaved={setSaved} onCancel={()=>setSaved({project:{name:'Abgebrochen'}})}/><FilterPicker disabled={false} label="Workspace" value={workspace} onChange={setWorkspace} options={[{value:"all",label:"Alle Workspaces"},{value:"default",label:"Allgemein"},{value:"marketing",label:"Marketing"}]}/><p className="page-note">Lokales Beispiel. {saved?'Auswahl: '+saved.project.name:'Es werden keine Workspaces angelegt.'}</p></>;
}
