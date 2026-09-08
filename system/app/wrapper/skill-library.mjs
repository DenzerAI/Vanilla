import os from 'node:os';
import path from 'node:path';
import {readFile,readdir,realpath,stat,mkdir,copyFile,rename,rm,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {parse} from 'yaml';
import {jsonFile,atomic,safeName,inside} from './storage.mjs';
import {sharedSkills} from './shared-skills.mjs';

const digest = value=>createHash('sha256').update(value).digest('hex');
const within=(root,file)=>file===root||file.startsWith(root+path.sep);
export class SkillLibrary {
  constructor({store,companyRoot,workers,home=os.homedir(),hermesHome=process.env.HERMES_HOME||path.join(home,'.hermes')}) {
    Object.assign(this,{store,companyRoot,workers,home,hermesHome});this.cache=new Map();this.queue=Promise.resolve();
  }
  async scan(root,source,owner,{hub=false}={}) {
    const result=[];let canonical;try{canonical=await realpath(root);}catch{return result;}
    const walk=async(dir,depth=0)=>{
      if(depth>8||result.length>=2000)return;
      const entries=await readdir(dir,{withFileTypes:true});
      if(entries.some(e=>e.name==='SKILL.md'&&e.isFile())){
        try{
          const file=path.join(dir,'SKILL.md'),info=await stat(file);if(info.size>256000)return;
          const content=await readFile(file,'utf8'),header=content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          const meta=header?parse(header[1],{maxAliasCount:20}):{};
          const name=typeof meta?.name==='string'?meta.name:path.basename(dir);
          const manifest=await jsonFile(path.join(dir,'.source.json'),null).catch(()=>null);
          const record={id:digest(file),name,description:typeof meta?.description==='string'?meta.description:'Keine Beschreibung vorhanden.',path:file,
            source:typeof manifest?.source==='string'?manifest.source.slice(0,160):source,owner,scope:owner==='company'?'company':owner==='shared'?'workspace':'user',enabled:true,hub,
            originalPath:manifest?.originalPath||null,version:digest(content),modified:manifest?.installedHash?manifest.installedHash!==digest(content):null,
            availability:owner==='company'||owner==='shared'?'shared':'native',author:typeof meta?.author==='string'?meta.author:null};
          this.cache.set(record.id,{...record,root:canonical});result.push(record);
        }catch{}
        return;
      }
      for(const entry of entries){if(!entry.isDirectory()||entry.isSymbolicLink()||entry.name.startsWith('.')||entry.name==='node_modules')continue;await walk(path.join(dir,entry.name),depth+1);}
    };
    await walk(canonical);return result;
  }
  async list() {
    this.cache.clear();const results=[],warnings=[];
    const roots=[
      [this.store.defaultFile('skills'),'Eigene Skills','shared'],
      [path.join(this.home,'.codex','skills'),'Codex','codex'],
      [path.join(this.home,'.codex','skills','.system'),'Codex · System','codex'],
      [path.join(this.home,'.claude','skills'),'Claude Code','claude'],
      [path.join(this.home,'.agents','skills'),'Gemeinsame lokale Skills','shared'],
      [path.join(this.hermesHome,'skills'),'Hermes','hermes'],
    ];
    for(const project of this.store.state.projects.filter(p=>p.path)) roots.push([path.join(this.store.root,project.path,'skills'),'Projekt: '+project.name,'shared']);
    for(const [root,source,owner] of roots){try{results.push(...await this.scan(root,source,owner));}catch{warnings.push(`${source} konnte nicht vollständig gelesen werden.`);}}
    let companySkills=[];
    try{companySkills=await sharedSkills(this.companyRoot);}catch{warnings.push('Firmenbasis derzeit nicht lesbar. Lokale Skills bleiben verfügbar.');}
    for(const skill of companySkills){
      const canonical=await realpath(skill.path);const entry={...skill,path:canonical,id:digest(canonical),source:'Firmenbasis',owner:'company',availability:'shared',version:digest(await readFile(canonical,'utf8'))};
      this.cache.set(entry.id,{...entry,root:await realpath(this.companyRoot)});results.push(entry);
    }
    // Read native catalogs for already-connected workers only; never launch a worker for indexing.
    for(const [workerId,adapter] of this.workers.adapters||[]){
      if(!adapter.connected||!this.workers.capability(workerId).skills)continue;
      try{
        const native=await adapter.call('skills/list',{cwds:[this.store.root],forceReload:true});
        for(const group of native.data||[])for(const skill of group.skills||[]) {
          if(!skill.path)continue;let canonical;try{canonical=await realpath(skill.path);}catch{continue;}
          if(results.some(s=>s.path===canonical))continue;
          const entry={...skill,path:canonical,id:digest(canonical),source:workerId==='codex'?'Codex · Plugin':workerId,owner:workerId,availability:'native',version:digest(await readFile(canonical,'utf8'))};
          this.cache.set(entry.id,{...entry,root:path.dirname(canonical)});results.push(entry);
        }
      }catch{warnings.push('Ein nativer Skillkatalog ist derzeit nicht erreichbar. Lokale Quellen bleiben verfügbar.');}
    }
    // Bundled records provide evidence of distribution, not authorship.
    const bundled=await readFile(path.join(this.hermesHome,'skills','.bundled_manifest'),'utf8').catch(()=>'');
    const names=new Set(bundled.split('\n').filter(Boolean).map(l=>l.split(':')[0]));
    for(const entry of results)if(entry.owner==='hermes'&&names.has(path.basename(path.dirname(entry.path)))){entry.source='Hermes · mitgeliefert';this.cache.get(entry.id).source=entry.source;}
    return {data:[{cwd:this.store.root,skills:[...new Map(results.map(s=>[s.id,s])).values()]}],warning:warnings.join(' ')||null};
  }
  async hub(){return {skills:await this.scan(path.join(this.hermesHome,'hermes-agent','optional-skills'),'Hermes · optional','hermes',{hub:true})};}
  async get(id){if(!this.cache.has(id)){await this.list();await this.hub();}const skill=this.cache.get(id);if(!skill)throw Error('Skill nicht gefunden. Liste neu laden.');const canonical=await realpath(skill.path);if(!within(skill.root,canonical))throw Error('Skill-Pfad hat sich geändert.');return {...skill,path:canonical};}
  async read(id){const skill=await this.get(id),info=await stat(skill.path);if(info.size>256000)throw Error('Skill-Datei ist zu groß.');const content=await readFile(skill.path,'utf8');return {skill,content,version:digest(content)};}
  async copy({id,name,version}) {
    const run=this.queue.catch(()=>{}).then(async()=>{
      const {skill,content,version:current}=await this.read(id);
      if(version && version!==current)throw Error('Der Skill wurde geändert. Vorschau erneut öffnen.');
      name=safeName(name);const parent=await inside(this.store.root,path.relative(this.store.root,this.store.defaultFile('skills'))),target=path.join(parent,name);
      try{await stat(target);throw Error('Dieser Skillname ist bereits vorhanden.');}catch(e){if(e.code!=='ENOENT')throw e;}
      const staging=path.join(parent,'.import-'+randomUUID());await mkdir(staging,{mode:0o700});
      let files=0,total=0;
      const copy=async(source,dest,depth=0)=>{
        if(depth>8)throw Error('Zu tief verschachtelter Skill.');
        for(const entry of await readdir(source,{withFileTypes:true})){
          if(entry.isSymbolicLink())throw Error('Skills mit Verknüpfungen können nicht automatisch kopiert werden.');
          if(entry.name.startsWith('.')||entry.name==='node_modules'||entry.name==='__pycache__')continue;
          const from=path.join(source,entry.name),to=path.join(dest,entry.name);
          if(entry.isDirectory()){await mkdir(to);await copy(from,to,depth+1);}
          else if(entry.isFile()){const info=await stat(from);total+=info.size;if(++files>250||total>20*1024*1024)throw Error('Skill überschreitet die Importgrenze.');await copyFile(from,to);}
        }
      };
      try{
        await copy(path.dirname(skill.path),staging);
        // Preserve reference files and original instructions; record a distinct local name in the catalog.
        const updated=content.startsWith('---')?(content.match(/^name:\s*.+$/m)?content.replace(/^(name:\s*).+$/m,`$1${name}`):content.replace(/^---\r?\n/,`---\nname: ${name}\n`)):`---\nname: ${name}\ndescription: Eigene Skillvariante\n---\n\n${content}`;
        await writeFile(path.join(staging,'SKILL.md'),updated);
        if(skill.owner==='hermes'){const license=await readFile(path.join(this.hermesHome,'hermes-agent','LICENSE'),'utf8').catch(()=>null);if(license)await writeFile(path.join(staging,'HERMES-LICENSE.txt'),license);}
        await atomic(path.join(staging,'.source.json'),{source:'Eigene Variante · '+skill.source,originalPath:skill.path,originalVersion:current,installedHash:digest(updated),installedAt:new Date().toISOString()});
        await rename(staging,target);
      }catch(e){await rm(staging,{recursive:true,force:true});throw e;}
      await this.list();return {ok:true,path:path.join(target,'SKILL.md')};
    });this.queue=run;return run;
  }
  async proposal({name,description,content}) {
    const run=this.queue.catch(()=>{}).then(async()=>{
    name=safeName(name);if(typeof content!=='string'||!content.trim()||content.length>60000)throw Error('Anweisung mit 1 bis 60.000 Zeichen erforderlich.');
    const parent=await inside(this.store.root,path.relative(this.store.root,this.store.defaultFile('skills'))),dir=path.join(parent,name);
    await mkdir(dir,{mode:0o700});
    await writeFile(path.join(dir,'SKILL.md'),`---\nname: ${name}\ndescription: ${JSON.stringify(String(description||'Eigene Arbeitsweise').slice(0,500))}\n---\n\n${content}\n`,{flag:'wx',mode:0o600});
    await atomic(path.join(dir,'.source.json'),{source:'Selbst erstellt',createdAt:new Date().toISOString()});return {ok:true};
    });this.queue=run;return run;
  }
}
export function installSkillRoutes({route,skills}){
  route('GET','/api/skills',()=>skills.list());
  route('GET','/api/skills/hub',()=>skills.hub());
  route('GET','/api/skills/read',(_b,u)=>skills.read(u.searchParams.get('id')));
  route('POST','/api/skills/copy',b=>skills.copy(b));
  route('POST','/api/skills/create',b=>skills.proposal(b));
}
