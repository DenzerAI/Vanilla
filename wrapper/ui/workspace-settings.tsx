import React,{useEffect,useId,useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {Skeleton} from './skeleton';
import {projectIcons,projectColors} from './appearance.mjs';
import {jobCategoryOptions} from './job-categories.mjs';
import './workspace-settings.css';

export const workspaceExplanation='Ein Workspace bündelt Gespräche, Dateien und besondere Arbeitsweisen für ein Thema. Du arbeitest weiterhin mit deinem Assistenten und dem gemeinsamen Firmenwissen.';
export function WorkspaceInfo({onCreate,busy=false}:{onCreate?:()=>void;busy?:boolean}){
  return <div className="workspace-explanation">
    <p>{workspaceExplanation}</p>
    <p>Ein eigener Workspace ist freiwillig. Zum Sortieren von Aufträgen reicht eine Kategorie. Sie verändert weder die Arbeitsweise noch den Ablageort.</p>
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
export function JobCategoryField({Field,jobs,value,onChange}:{Field:any;jobs:any[];value:string;onChange:(value:string)=>void}){
  const listId=useId();
  const options=[...new Set([...jobCategoryOptions(jobs),'Marketing','Immobilien','Angebote','Vertrieb'])];
  return <Field label="Kategorie" hint="Optional. Nur zum Sortieren; ohne Auswahl: Allgemein.">
    <input name="category" maxLength={80} value={value} onChange={e=>onChange(e.target.value)} list={listId} placeholder="Allgemein"/>
    <datalist id={listId}>{options.map(label=><option key={label} value={label}/>)}</datalist>
  </Field>;
}
export function JobCategoryFilter({jobs,value,onChange}:{jobs:any[];value:string|null;onChange:(value:string|null)=>void}){
  return <label className="job-category-filter"><span>Kategorie</span><select aria-label="Auftragskategorie filtern" value={value===null?'all':'category:'+value} onChange={e=>onChange(e.target.value==='all'?null:e.target.value.slice(9))}>
    <option value="all">Alle Kategorien</option><option value="category:">Allgemein</option>
    {jobCategoryOptions(jobs).map(label=><option key={label} value={"category:"+label}>{label}</option>)}
  </select></label>;
}
export function WorkspaceSettingsPreview(){
  const [saved,setSaved]=useState<any>(null);
  const [category,setCategory]=useState<string|null>(null);
  const [definition,setDefinition]=useState({project:{id:'example',name:'Beispielbereich'},profile:{name:'Beispielbereich',description:'Sammelt Entwürfe und passende Arbeitsweisen.',status:'draft'},body:'# Arbeitsweise\n\nVerwende die gemeinsamen Firmenquellen.\n\n## Skills\n\nVorhandene Abläufe bei Bedarf verlinken.\n',revision:'example'});
  const api:API=async(_route,body)=>{if(body){const next={...definition,profile:body,body:body.body,revision:'example-next'};setDefinition(next);return {project:next.profile};}return definition;};
  return <><WorkspaceInfo/><WorkspaceDefinitionEditor api={api} projectId="example" onSaved={setSaved} onCancel={()=>setSaved({project:{name:'Abgebrochen'}})}/><JobCategoryFilter jobs={[{category:'Marketing'},{category:'Immobilien'}]} value={category} onChange={setCategory}/><p className="page-note">Lokales Beispiel. {saved?'Auswahl: '+saved.project.name:'Es werden keine Workspaces angelegt.'}</p></>;
}
