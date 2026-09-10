import path from 'node:path';
import {mkdir, mkdtemp, readFile, realpath, access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {aiCatalog} from '../system/ai-catalog.mjs';
import {atomic, jsonFile} from './storage.mjs';
import {workerEnvironment} from './worker-environment.mjs';
const exec = promisify(execFile);
async function boundedJSON(response,limit) {
  const reader=response.body.getReader();const chunks=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Antwort zu groß.');chunks.push(Buffer.from(value));}}
  finally {await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function versionNumber(value) {
  const match=String(value||'').match(/(?:^|\s|v)(\d+\.\d+\.\d+)(?=$|\s)/);
  return match && stable.test(match[1]) ? match[1] : null;
}
export function newer(a,b) {
  if(!stable.test(a||'') || !stable.test(b||''))return false;
  const left=a.split('.').map(Number),right=b.split('.').map(Number);
  for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]>right[i];
  return false;
}
export async function releaseInfo(entry, previous={}, request=fetch) {
  const url=entry.package?`https://registry.npmjs.org/${encodeURIComponent(entry.package)}/latest`:entry.pypi?`https://pypi.org/pypi/${entry.pypi}/json`:entry.release?`https://api.github.com/repos/${entry.release}/releases/latest`:null;
  if(!url)return null;
  const response=await request(url,{headers:{Accept:'application/json',...(previous.etag?{'If-None-Match':previous.etag}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===304 && previous.latest)return {latest:previous.latest,etag:previous.etag};
  if(!response.ok)throw Error('Versionsquelle vorübergehend nicht erreichbar.');
  const data=await boundedJSON(response,4_000_000);
  const version=entry.package?data.version:entry.pypi?data.info?.version:String(data.tag_name||'').replace(/^v/,'');
  if(!stable.test(version||'') || data.prerelease || data.draft || (entry.package && data.name!==entry.package) || (entry.pypi && data.info?.name!==entry.pypi))throw Error('Keine bestätigte stabile Version.');
  return {latest:version,etag:response.headers.get('etag')||null};
}
// Reconstruct the binary only inside our own version directory. No arbitrary path from JSON.
export async function managedCommand(dataRoot,entry) {
  const state=await jsonFile(path.join(dataRoot,'ai-maintenance.json'),null);
  const selection=state?.items?.[entry.id]?.active;
  if(!selection || !stable.test(selection.version) || !/^[a-zA-Z0-9_-]+$/.test(selection.directory))return null;
  const data=await realpath(dataRoot);
  const base=await realpath(path.join(data,'ai-programs'));
  if(!base.startsWith(data+path.sep))throw Error('KI-Programme liegen außerhalb der Installation.');
  const file=path.join(base,entry.id,selection.directory,'node_modules','.bin',entry.command);
  const resolved=await realpath(file);
  if(!resolved.startsWith(base+path.sep))throw Error('Die verwaltete KI-Installation liegt außerhalb ihres Ordners.');
  await access(resolved,constants.X_OK);
  return file;
}
export async function publicModelCatalog(request=fetch) {
  const response=await request('https://models.dev/api.json',{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Modellkatalog nicht erreichbar.');
  const data=await boundedJSON(response,16_000_000), result={};
  const providers={codex:'openai','claw-code':'anthropic',gemini:'google',kimi:'moonshotai',deepseek:'deepseek',qwen:'alibaba'};
  for(const [id,provider] of Object.entries(providers)) {
    if(!data[provider]?.models || typeof data[provider].models!=='object')throw Error('Unvollständiger Modellkatalog.');
    result[id]=Object.values(data[provider].models).filter(m=>typeof m.id==='string' && m.id.length<=200 && typeof m.name==='string' && m.name.length<=200 && /^\d{4}-\d{2}-\d{2}$/.test(m.release_date||''))
      .map(m=>({id:m.id,name:m.name,releasedAt:m.release_date,openWeights:m.open_weights===true}))
      .sort((a,b)=>b.releasedAt.localeCompare(a.releasedAt)||a.id.localeCompare(b.id)).slice(0,100);
  }
  return result;
}
export class AIMaintenance {
  constructor({dataRoot,workers,activate,probeLocal=async()=>({machines:[]}),request=fetch,run=exec,clock=Date.now,catalog=aiCatalog,modelCatalog=publicModelCatalog}) {
    Object.assign(this,{dataRoot,workers,activate,probeLocal,request,run,clock,catalog,modelCatalog});
    this.file=path.join(dataRoot,'ai-maintenance.json');
    this.pending=null; this.writes=Promise.resolve(); this.controller=new AbortController();
  }
  async init() {
    this.state=await jsonFile(this.file,{schemaVersion:1,automatic:true,checkedAt:null,nextCheck:0,items:{},events:[]});
    if(this.state.schemaVersion!==1 || typeof this.state.automatic!=='boolean' || !this.state.items || typeof this.state.items!=='object' || !Array.isArray(this.state.events))throw Error('Unbekanntes Format der KI-Aktualisierung.');
    for(const item of Object.values(this.state.items))if(item.phase==='installing') {item.phase='error';item.failedVersion=item.latest;item.error='Aktualisierung wurde unterbrochen. Erneut prüfen.';}
  }
  save(){const snapshot=structuredClone(this.state);this.writes=this.writes.catch(()=>{}).then(()=>atomic(this.file,snapshot,{durable:true}));return this.writes;}
  async close(){this.controller.abort();await this.pending?.catch(()=>{});}
  status(){return {automatic:this.state.automatic,checkedAt:this.state.checkedAt,nextCheck:this.state.nextCheck,checking:!!this.pending,modelCatalogError:this.state.modelCatalogError||null,modelCatalogCheckedAt:this.state.modelCatalogCheckedAt||null,items:this.catalog.map(entry=>({...entry,...this.state.items[entry.id]})),events:this.state.events};}
  async configure(automatic) {
    if(typeof automatic!=='boolean')throw Error('Automatische Aktualisierung muss ein- oder ausgeschaltet sein.');
    this.state.automatic=automatic;await this.save();return this.status();
  }
  event(entry,type,version,text) {
    const id=`ai-${entry.id}-${type}-${version}`;
    if(!this.state.events.some(e=>e.id===id))this.state.events.push({id,title:`${entry.program||entry.name}: ${text}`,body:version?`Version ${version}. Details unter KI & Modelle.`:'Details unter KI & Modelle.',status:type==='error'?'failed':'completed',subject:entry.id});
    this.state.events=this.state.events.slice(-200);
  }
  check({force=false}={}) {
    if(this.pending)return this.pending;
    if(!force && this.state.nextCheck>this.clock())return Promise.resolve(this.status());
    this.pending=this.perform(force).finally(()=>{this.pending=null;});return this.pending;
  }
  async perform(force=false) {
    // Persist the retry boundary before network or installation work; crashes cannot cause a tight loop.
    this.state.nextCheck=this.clock()+3600000;await this.save();
    try {
      const discovered=await this.modelCatalog(this.request);
      for(const entry of this.catalog)if(discovered[entry.id]) {
        const old=this.state.items[entry.id]||{};
        if(old.publicModels) {
          const added=discovered[entry.id].filter(m=>!old.publicModels.some(known=>known.id===m.id));
          if(added.length)this.event(entry,'discovered',added[0].id,'neue Modelle im Katalog');
        }
        this.state.items[entry.id]={...old,publicModels:discovered[entry.id]};
      }
      this.state.modelCatalogCheckedAt=this.clock();this.state.modelCatalogError=null;
    }catch {this.state.modelCatalogError='Der öffentliche Modellkatalog konnte nicht aktualisiert werden. Der letzte Stand bleibt sichtbar.';}
    const status=await this.workers.status();
    const modelLists=await this.workers.modelLists().catch(()=>({}));
    const local=await this.probeLocal().catch(()=>({machines:[]}));
    for(const entry of this.catalog) {
      if(this.controller.signal.aborted)break;
      const old=this.state.items[entry.id]||{};
      if(force)delete old.failedVersion;
      const worker=status.workers.find(w=>w.id===entry.worker);
      const machine=local.machines?.find(m=>m.provider===entry.id && m.local);
      const item=this.state.items[entry.id]={...old,installed:!!(worker?.installed||machine?.installed),connected:!!(worker?.connected||machine?.connected),phase:'checking',error:null};
      const models=(modelLists[entry.worker]||[]).map(m=>m.model||m.id).filter(m=>typeof m==='string').sort();
      if(models.length) {
        if(old.models)for(const model of models.filter(m=>!old.models.includes(m)))this.event(entry,'model',model,'neues Modell verfügbar');
        item.models=models;
      }
      try {
        let command=entry.worker?await this.workers.resolveCommand(this.workers.entry(entry.worker)):null;
        item.installedVersion=null;
        if(command && entry.command) {
          try {const {stdout}=await this.run(command,['--version'],{timeout:10000,maxBuffer:8192,env:workerEnvironment()});item.installedVersion=versionNumber(stdout);}catch{}
        }
        const release=await releaseInfo(entry,old,this.request);
        if(release)Object.assign(item,release,{checkedAt:this.clock()});
        const available=item.installed && newer(item.latest,item.installedVersion);
        item.phase=!release?'external':!item.installed?'not-installed':!item.installedVersion?'unknown':available?'available':'current';
        // A conservative supported installation path. Native apps and Python tools retain their own updater.
        item.canManage=!!(entry.package && ['codex','gemini'].includes(entry.id) && !process.env[this.workers.entry(entry.worker).env]);
        if(available)this.event(entry,'available',item.latest,'Update verfügbar');
        if(available && item.failedVersion===item.latest){item.phase='error';item.error='Diese Version konnte nicht aktiviert werden. Jetzt prüfen versucht es erneut.';}
        if(available && this.state.automatic && item.canManage && item.failedVersion!==item.latest) {
          item.phase='installing';await this.save();
          const candidate=await this.install(entry,item.latest);
          // Recheck the setting after the potentially long download.
          if(!this.state.automatic){item.phase='available';continue;}
          const previous=item.active||null;
          const activated=await this.activate(entry.worker,candidate.command,async()=>{item.active={version:item.latest,directory:candidate.directory};try{await this.save();}catch(error){item.active=previous;throw error;}});
          if(activated) {
            item.previous=previous;item.installedVersion=item.latest;item.phase='current';item.updatedAt=this.clock();
            this.event(entry,'updated',item.latest,'automatisch aktualisiert');
          }else {item.phase='waiting';this.state.nextCheck=Math.min(this.state.nextCheck,this.clock()+60000);}
        }
      }catch {
        if(item.phase==='installing')item.failedVersion=item.latest;
        item.phase='error';item.error='Prüfung oder Aktualisierung fehlgeschlagen. Die bisherige Installation bleibt erhalten.';
        this.event(entry,'error',item.latest||'check','Aktualisierung braucht Aufmerksamkeit');
      }
      await this.save();
    }
    this.state.checkedAt=this.clock();
    if(!Object.values(this.state.items).some(i=>['error','waiting'].includes(i.phase)))this.state.nextCheck=this.clock()+6*3600000;
    await this.save();return this.status();
  }
  async install(entry,version) {
    if(!['codex','gemini'].includes(entry.id) || !stable.test(version))throw Error('Automatische Installation hier nicht unterstützt.');
    const root=path.join(this.dataRoot,'ai-programs',entry.id);await mkdir(root,{recursive:true,mode:0o700});
    const safeRoot=await realpath(root),data=await realpath(this.dataRoot);
    if(!safeRoot.startsWith(data+path.sep))throw Error('Installationsordner liegt außerhalb der Datenablage.');
    // Reuse a completely downloaded candidate while waiting for idle; never reuse partial installs.
    const cached=this.state.items[entry.id]?.candidate;
    if(cached?.version===version && /^[a-zA-Z0-9_-]+$/.test(cached.directory)) {
      const command=path.join(root,cached.directory,'node_modules','.bin',entry.command);
      try {if(!(await realpath(command)).startsWith(safeRoot+path.sep))throw Error('Ungültiger Kandidat.');await access(command,constants.X_OK);return {command,directory:cached.directory};}catch{}
    }
    const folder=await mkdtemp(path.join(root,`v${version}-`));
    const env={...workerEnvironment(),HOME:folder,USERPROFILE:folder,npm_config_userconfig:path.join(folder,'.npmrc'),npm_config_globalconfig:path.join(folder,'.global-npmrc'),npm_config_cache:path.join(folder,'.cache')};
    await this.run('npm',['install','--prefix',folder,'--registry=https://registry.npmjs.org','--ignore-scripts','--no-audit','--no-fund','--save-exact',`${entry.package}@${version}`],{env,cwd:folder,signal:this.controller.signal,timeout:300000,maxBuffer:1024*1024});
    const manifest=JSON.parse(await readFile(path.join(folder,'node_modules',entry.package,'package.json'),'utf8'));
    if(manifest.name!==entry.package || manifest.version!==version)throw Error('Installationsversion stimmt nicht.');
    const command=path.join(folder,'node_modules','.bin',entry.command);
    const {stdout}=await this.run(command,['--version'],{env,cwd:folder,timeout:15000,maxBuffer:8192});
    if(versionNumber(stdout)!==version)throw Error('Programmversion stimmt nicht.');
    const directory=path.basename(folder);this.state.items[entry.id].candidate={version,directory};await this.save();
    return {command,directory};
  }
}
export function installAIMaintenanceRoutes({route,maintenance}) {
  route('GET','/api/ai-maintenance',()=>maintenance.status());
  route('POST','/api/ai-maintenance/settings',body=>maintenance.configure(body.automatic));
  route('POST','/api/ai-maintenance/check',()=>{void maintenance.check({force:true}).catch(()=>{});return maintenance.status();});
  route('POST','/api/ai-maintenance/tick',()=>{void maintenance.check().catch(()=>{});return maintenance.status();});
}
