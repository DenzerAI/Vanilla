import path from 'node:path';
import {readdir,stat,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {atomic,jsonFile,inside} from './storage.mjs';
import {collectArtifacts,fileKind} from './ui/artifact-content.mjs';

export class Library {
  constructor({store,root}){this.store=store;this.root=root;this.artifactRoot=path.join(root,'data','artifacts');this.file=path.join(store.dataRoot,'library.json');this.queue=Promise.resolve();}
  async init(){this.state=await jsonFile(this.file,{version:1,entries:{}});return this;}
  exclusive(fn){const p=this.queue.catch(()=>{}).then(fn);this.queue=p;return p;}
  async add(file,source={}) {
    const scope=source.scope||'workspace',base=scope==='artifacts'?this.artifactRoot:this.store.root;
    const full=await inside(base,file),info=await stat(full);if(!info.isFile())return;
    const id=Object.values(this.state.entries).find(e=>e.path===file&&e.scope===scope)?.id || createHash('sha256').update(scope+':'+file).digest('hex');
    const before=this.state.entries[id]||{};
    const metadata=Object.fromEntries(Object.entries(source).filter(([k,v])=>v!=null&&['projectId','threadId','turnId','worker','origin','jobId','connectionId'].includes(k)));
    if(before.origin&&['Output','Auftrag','Order-System'].includes(metadata.origin))delete metadata.origin;
    this.state.entries[id]={...before,...metadata,id,path:file,scope,name:path.basename(file),kind:fileKind(file),size:info.size,modifiedAt:info.mtimeMs,createdAt:before.createdAt||info.birthtimeMs||info.mtimeMs,missing:false};
    return this.state.entries[id];
  }
  async registerThread(thread,meta) {
    return this.exclusive(async()=>{
      const result=[];
      for(const turn of thread.turns||[]) {
        const items=(turn.items||[]).filter(i=>i.type==='agentMessage'||i.type==='imageGeneration'||i.artifacts);
        for(const f of collectArtifacts(items,this.store.root,meta.cwd||this.store.root)) {
          try{const e=await this.add(f.path,{threadId:thread.id,turnId:turn.id,projectId:meta.projectId,worker:meta.workerId||'codex',origin:meta.channelOnly?'Kanal':meta.jobId?'Auftrag':'Chat',jobId:meta.jobId});if(e)result.push(e);}catch{}
        }
      }
      await atomic(this.file,this.state);return result;
    });
  }
  async refresh() {
    if(this.refreshing)return this.refreshing;
    this.refreshing=this.exclusive(async()=>{
      let count=0;const warnings=[];
      for(const entry of Object.values(this.state.entries))entry.missing=true;
      const scan=async(base,relative,source,depth=0)=>{
        if(depth>10||count>=5000)return;
        let dir;try{dir=await inside(base,relative);}catch{return;}
        for(const item of await readdir(dir,{withFileTypes:true})){
          if(item.name.startsWith('.')||item.isSymbolicLink()||item.name==='node_modules')continue;
          const next=path.join(relative,item.name);
          if(item.isDirectory())await scan(base,next,source,depth+1);
          else if(item.isFile()){try{await this.add(next,source);count++;}catch{} }
          if(count>=5000)break;
        }
      };
      for(const project of this.store.state.projects)await scan(this.store.root,path.join(project.path,'output'),{projectId:project.id,origin:'Output'});
      for(const job of await this.store.jobs())await scan(this.store.root,path.join(job.path||path.join('jobs',job.id),'output'),{jobId:job.id,projectId:job.projectId,origin:'Auftrag'});
      await scan(this.artifactRoot,'',{scope:'artifacts',origin:'Order-System'});
      // Retain explicit files outside output/, and restore richer provenance after scanning.
      for(const chat of this.store.state.chats){
        try{
          const thread=await jsonFile(this.store.chatFile(chat.id,'transcript.json'),null);if(!thread)continue;
          for(const turn of thread.turns||[])for(const f of collectArtifacts((turn.items||[]).filter(i=>i.type==='agentMessage'||i.type==='imageGeneration'||i.artifacts),this.store.root,chat.cwd||this.store.root)) {
            try{await this.add(f.path,{threadId:chat.id,turnId:turn.id,projectId:chat.projectId,worker:chat.workerId||'codex',origin:chat.channelOnly?'Kanal':chat.jobId?'Auftrag':'Chat'});}catch{}
          }
        }catch{warnings.push('Ein Gesprächsexport konnte nicht gelesen werden.');}
      }
      for(const entry of Object.values(this.state.entries).filter(e=>e.missing)) {
        try{await this.add(entry.path,{...entry});this.state.entries[entry.id].missing=false;}catch{}
      }
      await atomic(this.file,this.state);
      return {entries:this.entries(),warnings:[...new Set(warnings)],truncated:count>=5000};
    });
    try{return await this.refreshing;}finally{this.refreshing=null;}
  }
  entries(){return Object.values(this.state.entries).sort((a,b)=>b.createdAt-a.createdAt);}
  async resolve(file,scope){if(!this.entries().some(e=>e.path===file&&e.scope===scope))throw Error('Datei ist nicht in der Bibliothek registriert.');return inside(scope==='artifacts'?this.artifactRoot:this.store.root,file);}
  async favorite(id,value){return this.exclusive(async()=>{const e=this.state.entries[id];if(!e)throw Error('Ergebnis nicht gefunden.');e.favorite=value===true;await atomic(this.file,this.state);return e;});}
  async reuse(id,projectId){const entry=this.state.entries[id];if(!entry)throw Error('Ergebnis nicht gefunden.');const file=await this.resolve(entry.path,entry.scope),project=this.store.project(projectId);const dir=await inside(this.store.root,path.join(project.path,'input'));const name=randomUUID()+'-'+entry.name;await copyFile(file,path.join(dir,name));return {name:entry.name,path:path.join(project.path,'input',name),size:entry.size};}
  async generate(services,{connectionId,projectId='default',prompt}) {
    const c=services.get(connectionId);if(c.provider!=='openai-image')throw Error('Eine Bildverbindung auswählen.');
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>10000)throw Error('Bildbeschreibung mit 1 bis 10.000 Zeichen erforderlich.');
    const project=this.store.project(projectId),output=await inside(this.store.root,path.join(project.path,'output'));
    const {token}=await services.credentials(c);if(!token)throw Error('API-Schlüssel fehlt.');
    await services.recordBoundary('image',{connectionId,projectId,promptCharacters:prompt.length});
    const result=await services.json('https://api.openai.com/v1/images/generations',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({model:c.config.model,prompt,n:1,output_format:'png'}),timeoutMs:300000,maxBytes:36*1024*1024});
    const encoded=result.data?.[0]?.b64_json;if(typeof encoded!=='string'||encoded.length>34*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Keine gültigen Bilddaten erhalten.');
    const bytes=Buffer.from(encoded,'base64');if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Anbieter hat kein PNG geliefert.');
    const filename='bild-'+randomUUID()+'.png';await writeFile(path.join(output,filename),bytes,{flag:'wx',mode:0o600});
    return this.exclusive(async()=>{const entry=await this.add(path.join(project.path,'output',filename),{projectId,worker:c.config.model,origin:'Bildgenerierung',connectionId});await atomic(this.file,this.state);return entry;});
  }
}
export function installLibraryRoutes({route,library,services}) {
  route('GET','/api/library',()=>library.refresh());
  route('POST','/api/library/favorite',b=>library.favorite(b.id,b.favorite));
  route('POST','/api/library/reuse',b=>library.reuse(b.id,b.projectId));
  route('POST','/api/library/image',b=>library.generate(services,b));
}
