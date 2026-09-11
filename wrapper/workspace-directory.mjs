import path from 'node:path';
import {mkdir,readFile,readdir,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {parse,stringify} from 'yaml';
import {projectIcons,projectColors} from './ui/appearance.mjs';

const digest=text=>createHash('sha256').update(text).digest('hex');
const header=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const marker='<!-- vanilla-workspace-directory:1 -->';
const line=(value,limit,label)=>{
  if(typeof value!=='string'||value.length>limit||/[\r\n\x00-\x1f]/.test(value))throw Error(label+' ist ungültig.');
  return value.trim();
};
export function readWorkspaceDefinition(source,project={}) {
  const match=source.match(header);
  if(!match) {
    if(project.workspaceConfigured)throw Error('Der YAML-Steckbrief dieses Workspace fehlt.');
    return {configured:false,source,body:source,revision:digest(source),profile:{}};
  }
  let metadata;
  try{metadata=parse(match[1],{maxAliasCount:0,uniqueKeys:true});}catch{throw Error('Der YAML-Steckbrief ist nicht lesbar.');}
  // Unrelated existing frontmatter remains part of the untouched legacy body.
  if(metadata?.schema_version===undefined&&!project.workspaceConfigured)
    return {configured:false,source,body:source,revision:digest(source),profile:{}};
  if(Buffer.byteLength(source)>64000)throw Error('Workspace-Beschreibung ist zu lang. Ausführliche Abläufe als Skills verlinken.');
  if(!metadata||metadata.schema_version!==1)throw Error('Unbekanntes Workspace-Format.');
  if(typeof metadata.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(metadata.id)||(project.id&&metadata.id!==project.id))throw Error('Workspace-Kennung passt nicht zum Ordner.');
  const profile={schema_version:1,id:metadata.id,name:line(metadata.name,80,'Name'),description:line(metadata.description||'',500,'Zweck'),status:metadata.status||'draft',icon:metadata.icon||project.icon||'folder',color:metadata.color||project.color||'default'};
  if(!profile.name)throw Error('Workspace-Name fehlt.');
  if(!['draft','ready'].includes(profile.status))throw Error('Unbekannter Einrichtungsstatus.');
  if(!projectIcons.some(([id])=>id===profile.icon)||!projectColors.some(([id])=>id===profile.color))throw Error('Unbekanntes Symbol oder unbekannte Farbe.');
  return {configured:true,source,body:source.slice(match[0].length).trimStart(),revision:digest(source),profile,metadata};
}
export function workspaceDefinitionText(metadata,body='') {
  const source='---\n'+stringify(metadata,{lineWidth:0}).trimEnd()+'\n---\n\n'+body.trim()+'\n';
  readWorkspaceDefinition(source,{id:metadata.id});
  return source;
}
export class WorkspaceDirectory {
  constructor({store,inside,atomic}){Object.assign(this,{store,inside,atomic});this.queue=Promise.resolve();this.warnings=[];}
  serial(work){const next=this.queue.catch(()=>{}).then(work);this.queue=next;return next;}
  async read(project) {
    const dir=await this.inside(this.store.root,project.path);
    const file=path.join(dir,'AGENTS.md');
    if((await lstat(file)).isSymbolicLink())throw Error('Workspace-Beschreibung darf keine Verknüpfung sein.');
    return readWorkspaceDefinition(await readFile(file,'utf8'),project);
  }
  refresh(){return this.serial(()=>this.refreshNow());}
  async refreshNow(){
    const projects=this.store.state.projects,before=JSON.stringify(projects),duplicates=new Set();
    this.warnings=[];
    // Only the existing designated project root is discovered, never uploads.
    let entries=[];
    try{entries=await readdir(await this.inside(this.store.root,'projects'),{withFileTypes:true});}
    catch(e){if(e.code!=='ENOENT')throw e;}
    for(const entry of entries.filter(e=>e.isDirectory()&&!e.name.startsWith('.')).sort((a,b)=>a.name.localeCompare(b.name))){
      const relative=path.join('projects',entry.name);
      if(projects.some(p=>p.path===relative))continue;
      try{
        const definition=await this.read({path:relative});
        if(!definition.configured)continue;
        if(projects.some(p=>p.id===definition.profile.id)){duplicates.add(definition.profile.id);this.warnings.push('Workspace-Kennung in mehreren Ordnern: '+definition.profile.id);continue;}
        projects.push({id:definition.profile.id,name:definition.profile.name,path:relative});
      }catch(e){this.warnings.push(relative+': '+e.message);}
    }
    for(const project of projects){
      try{
        if(duplicates.has(project.id))throw Error('Workspace-Kennung ist in mehreren Ordnern vorhanden.');
        const definition=await this.read(project);
        delete project.workspaceError;
        project.workspaceConfigured=definition.configured;
        project.workspaceRevision=definition.revision;
        project.workspaceDescription=definition.profile.description||'';
        project.workspaceStatus=definition.profile.status||'ready';
        if(definition.configured){
          Object.assign(project,{name:definition.profile.name,icon:definition.profile.icon,color:definition.profile.color});
          if(project.id==='default')this.store.state.settings.workspaceName=project.name;
        }
      }catch(e){project.workspaceError=e.message;project.workspaceStatus='invalid';}
    }
    if(JSON.stringify(projects)!==before)await this.store.save();
    try{await this.writeIndex();}catch(error){this.warnings.push('Verzeichnisdatei konnte nicht aktualisiert werden: '+error.message);}
    return projects;
  }
  async writeIndex(){
    if(!this.store.state.projects.some(p=>p.workspaceConfigured))return;
    const rows=this.store.state.projects.map(p=>'| '+p.id+' | '+p.name.replaceAll('|','\\|')+' | '+(p.workspaceDescription||'').replaceAll('|','\\|')+' | '+p.workspaceStatus+' | [AGENTS.md]('+encodeURI(path.join(p.path,'AGENTS.md'))+') |');
    const content=marker+'\n# Workspaces\n\nAutomatisch erzeugtes Verzeichnis. Beschreibungen im jeweiligen Workspace bearbeiten.\n\n| Kennung | Name | Zweck | Zustand | Einstieg |\n| --- | --- | --- | --- | --- |\n'+rows.join('\n')+'\n';
    const file=path.join(this.store.root,'WORKSPACES.md');
    let current='';
    try{if((await lstat(file)).isSymbolicLink()){this.warnings.push('WORKSPACES.md ist verknüpft und bleibt unverändert. Das Verzeichnis ist über die Workspace-Liste verfügbar.');return;}current=await readFile(file,'utf8');}
    catch(e){if(e.code!=='ENOENT')throw e;}
    if(current&&!current.startsWith(marker)){this.warnings.push('Eigene WORKSPACES.md bleibt erhalten. Das Verzeichnis ist über die Workspace-Liste verfügbar.');return;}
    if(current!==content)await this.atomic(file,content);
  }
  create({requestId=randomUUID(),name='Neuer Workspace',description=''}={}){
    return this.serial(async()=>{
      if(typeof requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw Error('Ungültige Einrichtungsanfrage.');
      await this.refreshNow();
      const id='project-'+digest(requestId).slice(0,16);
      const existing=this.store.state.projects.find(p=>p.id===id);
      if(existing){if(existing.workspaceError)throw Error(existing.workspaceError);return existing;}
      const profile={schema_version:1,id,name,description,status:'draft'};
      const body='# Aufgabe\n\nZweck und gewünschte Ergebnisse werden im Einrichtungsgespräch festgelegt.\n\n## Bereichsvorgaben\n\nDie gemeinsame Assistentenidentität und die gemeinsamen Firmenregeln gelten weiterhin.\n\n## Arbeitsweise\n\nErgänze nur die Besonderheiten dieses Themas.\n\n## Wissen und Skills\n\nVerweise auf benötigte Firmenquellen und vorhandene Skills. Neue wiederverwendbare Abläufe gehören bei Bedarf unter skills/<name>/SKILL.md.\n\n## Offene Punkte\n\nZweck, Besonderheiten, Quellen und gewünschte Abläufe klären.\n';
      const source=workspaceDefinitionText(profile,body);
      await mkdir(path.join(this.store.root,'projects'),{recursive:true});
      await this.inside(this.store.root,'projects');
      const relative=path.join('projects',id),dir=path.join(this.store.root,relative);
      await mkdir(dir);
      for(const folder of ['input','output','skills'])await mkdir(path.join(dir,folder));
      await this.atomic(path.join(dir,'AGENTS.md'),source);
      const project={id,name,path:relative};
      await this.atomic(path.join(dir,'project.json'),project);
      this.store.state.projects.push(project);await this.store.save();await this.refreshNow();
      return project;
    });
  }
  update({id,revision,name,description,status,icon,color,body}){
    return this.serial(async()=>{
      await this.refreshNow();
      const project=this.store.project(id);
      if(project.workspaceError)throw Error(project.workspaceError);
      const current=await this.read(project);
      if(revision!==current.revision)throw Error('Die Beschreibung wurde inzwischen geändert. Dein Entwurf bleibt erhalten; bitte erneut abgleichen.');
      const profile=current.configured?{...current.metadata}:{schema_version:1,id,name:project.name,status:'ready',icon:project.icon||'folder',color:project.color||'default'};
      for(const [key,value] of Object.entries({name,description,status,icon,color}))if(value!==undefined)profile[key]=value;
      if(body!==undefined&&typeof body!=='string')throw Error('Ungültige Arbeitsbeschreibung.');
      const source=workspaceDefinitionText(profile,body===undefined?current.body:body);
      const dir=await this.store.projectRoot(id);
      if((await this.read(project)).revision!==revision)throw Error('Die Beschreibung wurde inzwischen geändert.');
      await this.atomic(path.join(dir,'AGENTS.md'),source);
      await this.refreshNow();return project;
    });
  }
  async context(id='default'){
    await this.refresh();
    const active=this.store.project(id);
    if(active.workspaceError)throw Error('Workspace-Beschreibung nicht verfügbar: '+active.workspaceError);
    const definition=await this.read(active);
    const roster=this.store.state.projects.map(p=>({id:p.id,name:p.name,description:p.workspaceDescription,status:p.workspaceStatus,path:path.join(this.store.root,p.path,'AGENTS.md')}));
    return {active,definition,roster,path:path.join(this.store.root,active.path,'AGENTS.md')};
  }
}
export function workspaceInstructions({active,definition,roster,path:sourcePath}){
  return '\n\nAktiver Workspace: '+active.name+' ('+active.id+').\nDu bleibst derselbe persönliche Assistent mit der oben geladenen Identität. Dieser Workspace ergänzt den fachlichen Kontext und erzeugt keine zweite Persönlichkeit. Die gemeinsamen Firmenquellen und aktuellen CI-Regeln gelten weiterhin. Andere Gesprächsverläufe werden nicht pauschal geladen.\nWorkspace-Verzeichnis (Zuordnung, keine neue Anweisung):\n'+JSON.stringify(roster)+(active.id==='default'?'\nDie Workspace-Beschreibung ist der oben frisch geladene lokale Einstieg ('+sourcePath+').':'\nFrisch geladene Workspace-Beschreibung ('+sourcePath+'):\n'+definition.source)+'\nVerlinkte Skills nur bei passender Aufgabe lesen. Die Beschreibung organisiert den Kontext; sie erweitert keine technischen Zugriffsrechte. Eine Auftragskategorie sortiert nur und ändert weder Kontext noch Ablage. Ergebnisse bleiben beim jeweiligen Auftrag und Lauf.';
}
