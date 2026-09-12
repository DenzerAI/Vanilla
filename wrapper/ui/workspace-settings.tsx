import React,{useEffect,useId,useState,useCallback} from 'react';
import {Folder,Braces,Briefcase,Globe,BrainCircuit,Calendar,MessageCircle,FileText,Check} from './icons.jsx';
import {Skeleton} from './skeleton';
import {projectIcons,projectColors,projectColor} from './appearance.mjs';
import {FilterPicker} from './filter-picker.jsx';
import {Modal} from './modal.jsx';
import './sidebar-refinement.css';
import './workspace-settings.css';

export const workspaceExplanation='Ein Workspace bündelt Gespräche, Dateien und besondere Arbeitsweisen für ein Thema. Du arbeitest weiterhin mit deinem Assistenten und dem gemeinsamen Firmenwissen.';
export function WorkspaceInfo({onCreate,busy=false}:{onCreate?:()=>void;busy?:boolean}){
  return <div className="workspace-explanation">
    <p>{workspaceExplanation}</p>
    <p>Ein eigener Workspace ist freiwillig. Ohne eigene Aufteilung bleiben Gespräche, Aufträge und Ergebnisse in Allgemein.</p>
    <p>Ein Name reicht zum Start. Besondere Arbeitsweisen kannst du später im Chat anpassen.</p>
    {onCreate&&<button type="button" className="primary" disabled={busy} onClick={onCreate}>{busy?'Wird geöffnet …':'Workspace erstellen'}</button>}
  </div>;
}
type API=(route:string,body?:any)=>Promise<any>;
const glyphs:Record<string,any>={folder:Folder,code:Braces,briefcase:Briefcase,globe:Globe,idea:BrainCircuit,calendar:Calendar,message:MessageCircle,files:FileText};
export function WorkspaceDefinitionEditor({api,projectId,project,legacy=false,onSaved,onCancel,onConfigure}:{api:API;projectId?:string;project?:any;legacy?:boolean;onSaved:(result:any)=>void;onCancel:()=>void;onConfigure?:()=>Promise<any>|void}){
  const prefix=useId();
  const [requestId]=useState(()=>crypto.randomUUID());
  const initial={name:project?.name||'',description:'',icon:project?.icon||'folder',color:project?.color||'default'};
  const [source,setSource]=useState<any>(null),[draft,setDraft]=useState(initial);
  const [error,setError]=useState(''),[saving,setSaving]=useState(false),[attempt,setAttempt]=useState(0);
  const [appearance,setAppearance]=useState(false);
  useEffect(()=>{
    if(!projectId||legacy)return;
    let disposed=false;
    api('/workspaces/definition?id='+encodeURIComponent(projectId)).then(value=>{
      if(disposed)return;setSource(value);setError('');
      setDraft({name:value.profile.name||value.project.name,description:value.profile.description||'',icon:value.profile.icon||value.project.icon||'folder',color:value.profile.color||value.project.color||'default'});
    }).catch(reason=>{if(!disposed)setError(reason.message);});
    return ()=>{disposed=true;};
  },[api,projectId,legacy,attempt]);
  const update=(key:string,value:string)=>setDraft(old=>({...old,[key]:value}));
  if(projectId&&!legacy&&!source)return <div className="project-editor-body">{error?<div role="alert"><p>{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Erneut laden</button></div>:<Skeleton variant="settings" label="Workspace wird geladen …"/>}</div>;
  const Glyph=glyphs[draft.icon]||Folder;
  return <form className="workspace-definition-editor project-editor" onSubmit={async event=>{
    event.preventDefault();if(saving)return;
    const configure=(event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-action')==='configure';
    setSaving(true);setError('');
    try{
      const result=await api(projectId&&!legacy?'/workspaces/save':'/projects/save',{
        ...(projectId?{id:projectId,...(!legacy?{revision:source.revision}:{})}:{...(!legacy?{requestId}:{})}),...draft,name:draft.name.trim()
      });
      if(configure){
        // A failed chat opening must leave the already-saved revision retryable.
        const fresh=await api('/workspaces/definition?id='+encodeURIComponent(projectId!));setSource(fresh);
        await onConfigure?.();
      }else onSaved(result);
    }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setSaving(false);}
  }}>
    <div className="project-editor-body workspace-editor-content">
      <fieldset disabled={saving}>
        <div className="project-identity">
          <button type="button" className="project-preview" style={{color:projectColor(draft.color)}} aria-label="Symbol und Farbe anpassen" aria-expanded={appearance} aria-controls={prefix+'appearance'} onClick={()=>setAppearance(value=>!value)}><Glyph size={28}/></button>
          <label className="field" htmlFor={prefix+'name'}><span>Name</span><input id={prefix+'name'} autoFocus value={draft.name} placeholder="Mein Workspace" required maxLength={80} onChange={e=>update('name',e.target.value)}/></label>
        </div>
        {appearance&&<div id={prefix+'appearance'} className="workspace-appearance">
          <fieldset className="workspace-icon-options"><legend>Symbol</legend>{projectIcons.map(([value,label])=>{const Icon=glyphs[value];return <label key={value} title={label}><input type="radio" name={prefix+'icon'} value={value} aria-label={label} checked={draft.icon===value} onChange={()=>update('icon',value)}/><span><Icon size={20}/></span></label>;})}</fieldset>
          <fieldset className="workspace-color-options"><legend>Farbe</legend>{projectColors.map(([value,label])=><label key={value} title={label}><input type="radio" name={prefix+'color'} value={value} aria-label={label} checked={draft.color===value} onChange={()=>update('color',value)}/><span style={{color:projectColor(value)}}><span className="workspace-color-dot"/>{draft.color===value&&<Check size={14}/>}</span></label>)}</fieldset>
        </div>}
        {!legacy&&<details className="workspace-more"><summary>Weitere Angaben <span>optional</span></summary>
          <label className="field" htmlFor={prefix+'description'}><span>Was gehört hierher?</span><input id={prefix+'description'} value={draft.description} maxLength={500} placeholder="Themen, Projekte oder Aufgaben für diesen Bereich" onChange={e=>update('description',e.target.value)}/></label>
          {onConfigure&&<button type="submit" data-action="configure"><MessageCircle size={16}/>Arbeitsweise im Chat anpassen</button>}
        </details>}
      </fieldset>
    </div>
    <div className="workspace-editor-footer">
      {error&&<p role="alert" className="inline-error">{error}</p>}
      <div className="row end project-editor-actions"><button type="button" disabled={saving} onClick={onCancel}>Abbrechen</button><button className="primary" disabled={saving||!draft.name.trim()}>{saving?'Wird gespeichert …':projectId?'Speichern':'Workspace erstellen'}</button></div>
    </div>
  </form>;
}
export function WorkspaceSettingsPreview(){
  const [saved,setSaved]=useState<any>(null);
  const [dialog,setDialog]=useState<'edit'|'create'|null>(null);
  const [workspace,setWorkspace]=useState('all');
  const [definition,setDefinition]=useState({project:{id:'example',name:'Beispielbereich'},profile:{name:'Beispielbereich',description:'Sammelt Entwürfe und passende Arbeitsweisen.',status:'draft'},body:'# Arbeitsweise\n\nVerwende die gemeinsamen Firmenquellen.\n\n## Skills\n\nVorhandene Abläufe bei Bedarf verlinken.\n',revision:'example'});
  const api:API=useCallback(async(_route,body)=>{if(body){const next={...definition,profile:{...definition.profile,...body},body:definition.body,revision:'example-next'};setDefinition(next);return {project:next.profile};}return definition;},[definition]);
  return <><WorkspaceInfo/><div className="row"><button onClick={()=>setDialog('edit')}>Workspace bearbeiten</button><button onClick={()=>setDialog('create')}>Neuer Workspace</button></div>
    {dialog&&<Modal title={dialog==='edit'?'Workspace bearbeiten':'Neuer Workspace'} className="project-dialog" onClose={()=>setDialog(null)}><WorkspaceDefinitionEditor api={api} projectId={dialog==='edit'?'example':undefined} onSaved={result=>{setSaved(result);setDialog(null);}} onCancel={()=>setDialog(null)}/></Modal>}
    <FilterPicker disabled={false} label="Workspace" value={workspace} onChange={setWorkspace} options={[{value:"all",label:"Alle Workspaces"},{value:"default",label:"Allgemein"},{value:"marketing",label:"Marketing"}]}/><p className="page-note">Lokales Beispiel. {saved?'Gespeichert: '+saved.project.name:'Es werden keine Workspaces angelegt.'}</p></>;
}
