import http from 'node:http';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {atomic,jsonFile,inside} from './storage.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const equal = (a,b) => typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const pause = ms => new Promise(resolve=>{const timer=setTimeout(resolve,ms);timer.unref?.();});
async function readBody(req) {
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>1024*1024)throw Error('Nachricht zu groß.');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
const reply=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
const taskState = status => ({received:'TASK_STATE_SUBMITTED',running:'TASK_STATE_WORKING',completed:'TASK_STATE_COMPLETED',failed:'TASK_STATE_FAILED',interrupted:'TASK_STATE_CANCELED'}[status] || 'TASK_STATE_WORKING');

export class ChannelRuntime {
  constructor({store,services,run,interrupt,bridgeFactory,waiting=()=>false}) {
    Object.assign(this,{store,services,run,interrupt,bridgeFactory,waiting});this.live=new Map();this.locks=new Map();this.starting=new Map();this.writes=Promise.resolve();
    this.file=path.join(store.dataRoot,'channels.json');
  }
  async init() {
    this.state=await jsonFile(this.file,{version:1,sessions:{},tasks:{},offsets:{}});
    for(const task of Object.values(this.state.tasks)) if(['received','running'].includes(task.status)){task.status='interrupted';task.error='Server wurde während des Auftrags beendet. Keine automatische Wiederholung.';}
    await this.save();return this;
  }
  save(){const snapshot=structuredClone(this.state);const write=this.writes.catch(()=>{}).then(()=>atomic(this.file,snapshot));this.writes=write;return write;}
  status(id){const r=this.live.get(id),bridge=r?.bridge?.status();return r?{runtimeActive:!r.stopped,runtimeStatus:bridge?.status==='qr'?'qr':r.error?'error':r.stopped?'stopped':bridge&&bridge.status!=='connected'?'connecting':'running',runtimeError:r.error||null,qrDataUrl:bridge?.qrDataUrl||null}:{runtimeStatus:'stopped',runtimeActive:false};}
  running(id){const r=this.live.get(id);return this.starting.has(id)||!!r && !r.stopped;}
  hasActive(id){return Object.values(this.state.tasks).some(t=>t.connectionId===id&&['received','running'].includes(t.status));}
  sessions(id){this.services.get(id);return {sessions:Object.values(this.state.sessions).filter(s=>s.connectionId===id).map(s=>({...s,tasks:Object.values(this.state.tasks).filter(t=>t.sessionId===s.id).slice(-20)}))};}
  async accept(id,{sender,chatId,messageId,text,attachments=[],trusted=false}) {
    const c=this.services.get(id);
    if(!trusted && !(c.config.allowedUsers||[]).includes(String(sender))) return null;
    if(messageId==null||String(messageId).length>256||String(sender).length>256||String(chatId).length>256)throw Error('Ungültige Nachrichtenkennung.');
    if(!text?.trim() && !attachments.length) return null;
    if(String(text||'').length>30000) throw Error('Nachricht ist zu lang.');
    const sessionId=hash(JSON.stringify([id,String(chatId),String(sender)]));
    const receipt=hash(JSON.stringify([id,String(messageId)]));
    // Serialize intake per conversation, not the whole system. Persist before starting a worker.
    const previous=this.locks.get(sessionId)||Promise.resolve();
    const next=previous.catch(()=>{}).then(async()=>{
      if(this.state.tasks[receipt]) return this.state.tasks[receipt];
      if(Object.values(this.state.tasks).filter(t=>t.connectionId===id&&['received','running'].includes(t.status)).length>=8)throw Error('Maximal acht gleichzeitige Kanalaufträge.');
      let session=this.state.sessions[sessionId];
      if(!session) session=this.state.sessions[sessionId]={id:sessionId,connectionId:id,chatId:String(chatId),sender:String(sender),threadId:null,createdAt:Date.now()};
      if(!trusted && c.provider==='telegram' && /^\/start(?:\s|$)/.test(text?.trim()||'')) {await this.save();return {status:'completed',result:'Verbunden. Schreib mir hier deine Nachricht. Mit /new beginnst du ein neues Gespräch, mit /status siehst du den Stand und mit /stop stoppst du eine laufende Antwort.'};}
      if(!trusted && text?.trim()==='/stop') {if(session.threadId)await this.interrupt(session.threadId);return {status:'completed',result:'Stopp angefordert.'};}
      if(!trusted && text?.trim()==='/status') {const tasks=Object.values(this.state.tasks).filter(t=>t.sessionId===sessionId);return {status:'completed',result:tasks.at(-1)?.status||'Noch kein Auftrag.'};}
      if(Object.values(this.state.tasks).some(t=>t.sessionId===sessionId&&['received','running'].includes(t.status))) throw Error('Die vorherige Antwort läuft noch. Mit /stop unterbrechen.');
      if(!trusted && text?.trim()==='/new') {session.threadId=null;await this.save();return {status:'completed',result:'Das nächste Gespräch beginnt neu.'};}
      if(trusted && Object.values(this.state.tasks).filter(t=>t.sessionId===sessionId).length>=5) throw Error('Kontextlimit erreicht. Bitte einen neuen A2A-Kontext beginnen.');
      const task={id:receipt,sessionId,connectionId:id,status:'received',createdAt:Date.now(),threadId:session.threadId};
      this.state.tasks[receipt]=task;await this.save();
      try {
        const r=await this.run({connection:c,session,text,attachments,onThread:async threadId=>{session.threadId=threadId;task.threadId=threadId;await this.save();}});
        task.turnId=r.turn.id;if(task.status==='received')task.status='running';await this.save();
      }catch(e){task.status='failed';task.error='Auftrag konnte nicht gestartet werden. Worker-Verbindung prüfen.';await this.save();throw e;}
      return task;
    });
    this.locks.set(sessionId,next);try{return await next;}finally{if(this.locks.get(sessionId)===next)this.locks.delete(sessionId);}
  }
  async complete(threadId,turn,text,files=[]) {
    const task=Object.values(this.state.tasks).find(t=>t.threadId===threadId&&(!t.turnId||t.turnId===turn.id)&&['received','running'].includes(t.status));
    if(!task)return;
    task.turnId=turn.id;task.status=turn.status==='completed'?'completed':turn.status==='interrupted'?'interrupted':'failed';task.result=text||'Auftrag beendet.';task.completedAt=Date.now();task.files=files;
    await this.save();
    await this.deliver(task);
  }
  async deliver(task) {
    const r=this.live.get(task.connectionId);if(!r?.send || task.deliveredAt || task.deliveryAttemptedAt)return;
    const session=this.state.sessions[task.sessionId];
    task.deliveryAttemptedAt=Date.now();await this.save();
    try{await r.send(session.chatId,task.result||task.error,task.files||[]);task.deliveredAt=Date.now();task.deliveryError=null;}
    catch {task.deliveryError='Zustellung unbestätigt. Ergebnis ist in der Verbindung abrufbar; kein automatischer Doppelversand.';}
    await this.save();
  }
  async start(id) {
    if(this.starting.has(id))return this.starting.get(id);
    if(this.running(id))return this.status(id);
    const promise=this.startOnce(id);this.starting.set(id,promise);
    try{return await promise;}finally{this.starting.delete(id);}
  }
  async startOnce(id) {
    const c=this.services.get(id);
    if(!['telegram','whatsapp-local','whatsapp-cloud','a2a'].includes(c.provider)||c.provider==='a2a'&&c.config.mode!=='server')throw Error('Dieser Anschluss hat keinen lokalen Nachrichtenempfang.');
    if(c.provider!=='a2a' && !c.config.allowedUsers?.length)throw Error('Zuerst mindestens einen Nutzer freigeben.');
    await this.services.check(id);
    if(c.provider==='telegram' && c.check?.webhookConfigured)throw Error('Der Bot verwendet bereits einen Webhook. Bestehenden Anschluss vor der Übernahme bewusst trennen.');
    const r={stopped:false,error:null};this.live.set(id,r);
    try{
      if(c.provider==='telegram') {
        r.send=(chatId,text,files)=>this.sendTelegram(c,chatId,text,files);
        void this.pollTelegram(c,r);
      } else if(c.provider==='whatsapp-local') await this.startWhatsApp(c,r);
      else await this.listen(c,r);
      return this.status(id);
    }catch(e){r.stopped=true;r.error=e.code==='EADDRINUSE'?'Adresse/Port bereits belegt. Bestehenden Dienst verbinden oder einen anderen Port wählen.':e.message;throw Error(r.error);}
  }
  async stop(id){if(this.starting.has(id))await this.starting.get(id).catch(()=>{});const r=this.live.get(id);if(r){r.stopped=true;clearTimeout(r.bridge?.reconnectTimer);if(r.bridge){r.bridge.handleConnectionUpdate=async()=>{};r.bridge.socket?.end(undefined);}if(r.server)await new Promise(resolve=>{r.server.close(resolve);r.server.closeAllConnections?.();});this.live.delete(id);}return {runtimeStatus:'stopped'};}
  async close(){await Promise.all([...new Set([...this.live.keys(),...this.starting.keys()])].map(id=>this.stop(id)));}
  async pollTelegram(c,r) {
    while(!r.stopped){
      try{
        const updates=await this.services.telegram(c,'getUpdates',{offset:this.state.offsets[c.id]||0,timeout:25,allowed_updates:['message']});
        if(r.stopped)break;
        for(const update of updates){
          if(r.stopped)break;
          const m=update.message;
          if(m?.chat?.type==='private' && c.config.allowedUsers.includes(String(m.from?.id))) {
            try {
              const attachments=await this.telegramAttachments(c,m);
              if(r.stopped)break;
              const task=await this.accept(c.id,{sender:m.from.id,chatId:m.chat.id,messageId:update.update_id,text:m.text||m.caption||'',attachments});
              if(task?.result && !task.id)await r.send(String(m.chat.id),task.result);
            }catch {if(!r.stopped)await r.send(String(m.chat.id),'Nachricht konnte nicht übernommen werden. Verbindung und Auftragsstatus in der Schaltzentrale prüfen.').catch(()=>{});}
          }
          this.state.offsets[c.id]=update.update_id+1;await this.save();
        }
        r.error=null;
      }catch {if(!r.stopped){r.error='Telegram-Empfang fehlgeschlagen. Bot-Zugang prüfen; möglicherweise läuft ein zweiter Empfänger.';await pause(5000);}}
    }
  }
  async telegramAttachments(c,m) {
    const item=m.document||m.photo?.at(-1);if(!item)return [];
    if(item.file_size>20*1024*1024)throw Error('Datei zu groß.');
    const info=await this.services.telegram(c,'getFile',{file_id:item.file_id});
    if(!/^[\w./-]+$/.test(info.file_path)||info.file_path.split('/').includes('..'))throw Error('Ungültiger Medienpfad.');
    const {token}=await this.services.credentials(c);
    const response=await this.services.request(`https://api.telegram.org/file/bot${token}/${info.file_path}`,{method:'GET',maxBytes:20*1024*1024});
    if(!response.ok)throw Error('Datei nicht verfügbar.');
    const project=this.store.project(c.projectId),dir=await inside(this.store.root,path.join(project.path,'input'));
    const filename=randomUUID()+'-'+path.basename(item.file_name||'bild.jpg').replace(/[^\p{L}\p{N}._ -]/gu,'_');
    await writeFile(path.join(dir,filename),await response.bytes(),{flag:'wx',mode:0o600});
    return [{path:path.join(project.path,'input',filename),name:filename}];
  }
  async sendTelegram(c,chatId,text,files=[]) {
    for(let at=0;at<String(text||'').length;at+=3500)await this.services.telegram(c,'sendMessage',{chat_id:chatId,text:text.slice(at,at+3500)});
    for(const file of files.slice(0,10)) {
      const full=await inside(this.store.root,file.path),bytes=await readFile(full);if(bytes.length>20*1024*1024)continue;
      const {token}=await this.services.credentials(c);const form=new FormData();form.set('chat_id',String(chatId));form.set('document',new Blob([bytes]),path.basename(full));
      const request=new Request('https://api.telegram.org',{method:'POST',body:form});
      const response=await this.services.json(`https://api.telegram.org/bot${token}/sendDocument`,{method:'POST',headers:Object.fromEntries(request.headers),body:Buffer.from(await request.arrayBuffer()),timeoutMs:60000});
      if(!response.ok)throw Error('Dateizustellung fehlgeschlagen.');
    }
  }
  async startWhatsApp(c,r) {
    const factory=this.bridgeFactory||((options)=>import('../backend/whatsapp-bridge.mjs').then(({WhatsAppBridge})=>new WhatsAppBridge(options)));
    const intake={hasSourceMessage:async()=>false,createOrder:async order=>{
      const result=await this.accept(c.id,{sender:order.source.sender,chatId:order.source.chatId,messageId:order.source.messageId,text:order.instructions});if(result?.result&&!result.id)await r.send?.(order.source.chatId,result.result);return {id:result?.id||'ignored'};
    }};
    r.bridge=await factory({root:path.join(this.store.dataRoot,'bridges',c.id),store:intake,env:{WHATSAPP_ALLOWED_NUMBERS:c.config.allowedUsers.join(','),WHATSAPP_COMMAND_PREFIX:'',WHATSAPP_ACKNOWLEDGE:'false',WHATSAPP_ALLOW_GROUPS:'false'}});
    await r.bridge.init();await r.bridge.connect();
    r.send=async(chatId,text)=>{if(r.bridge.status().status!=='connected')throw Error('WhatsApp ist getrennt.');for(let n=0;n<text.length;n+=3500)await r.bridge.socket.sendMessage(chatId,{text:text.slice(n,n+3500)});};
  }
  a2aTask(task){const waiting=['received','running'].includes(task.status)&&this.waiting(task.threadId);return {id:task.id,contextId:task.sessionId,status:{state:waiting?'TASK_STATE_INPUT_REQUIRED':taskState(task.status),timestamp:new Date(task.completedAt||task.createdAt).toISOString(),...(waiting||task.error?{message:{messageId:task.id+'-status',role:'ROLE_AGENT',parts:[{text:waiting?'Rückfrage in der Schaltzentrale beantworten.':task.error}]}}:{})},...(task.result?{artifacts:[{artifactId:task.id,parts:[{text:task.result}]}]}:{})};}
  async listen(c,r) {
    const credentials=await this.services.credentials(c),a2a=c.provider==='a2a';
    if(!a2a && (!credentials.appSecret || !credentials.verifyToken))throw Error('App Secret und Verify Token fehlen.');
    if(!a2a)r.send=async(chatId,text)=>{
      for(let n=0;n<text.length;n+=3500)await this.services.json(`https://graph.facebook.com/${c.config.apiVersion}/${c.config.phoneNumberId}/messages`,{method:'POST',headers:{authorization:'Bearer '+credentials.token,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:chatId,type:'text',text:{body:text.slice(n,n+3500)}})});
    };
    r.server=http.createServer(async(req,res)=>{
      let rpc;
      try{
        const url=new URL(req.url,'http://localhost');
        if(a2a){
          if(req.method==='GET' && url.pathname==='/.well-known/agent-card.json')return reply(res,200,{name:c.name,description:'Gemeinsame Schaltzentrale',version:'1.0.0',supportedInterfaces:[{url:c.config.publicUrl||`http://${c.config.host}:${c.config.port}`,protocolBinding:'JSONRPC',protocolVersion:'1.0'}],capabilities:{streaming:false,pushNotifications:false},defaultInputModes:['text/plain'],defaultOutputModes:['text/plain'],skills:[{id:'task',name:'Auftrag',description:'Aufträge mit dem zugewiesenen Worker bearbeiten',tags:['task']}],securitySchemes:{bearer:{httpAuthSecurityScheme:{scheme:'bearer'}}},securityRequirements:[{schemes:{bearer:{}}}]});
          if(req.method!=='POST'||url.pathname!=='/')return reply(res,404,{error:'Nicht gefunden.'});
          if(!equal(req.headers.authorization,'Bearer '+credentials.token))return reply(res,401,{error:'Nicht autorisiert.'});
          try{rpc=JSON.parse((await readBody(req)).toString());}catch{return reply(res,200,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Ungültiges JSON.'}});}
          let result;
          if(!rpc||rpc.jsonrpc!=='2.0'||!['string','number'].includes(typeof rpc.id))return reply(res,200,{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Ungültige JSON-RPC-Nachricht.'}});
          if(['SendMessage','message/send'].includes(rpc.method)){
            const m=rpc.params?.message;const text=m?.parts?.map(p=>p.text||'').join('\n');
            if(!m?.messageId||!text?.trim())throw Error('Text und messageId erforderlich.');
            // A caller may continue only its own connection's context.
            const old=m.contextId && this.state.sessions[m.contextId];
            if(old&&old.connectionId!==c.id)throw Error('Unbekannter Kontext.');
            const chatId=old?.chatId||m.contextId||randomUUID();
            const task=await this.accept(c.id,{sender:'authenticated-peer',chatId,messageId:m.messageId,text,trusted:true});
            const blocking=rpc.method==='SendMessage'?rpc.params?.configuration?.returnImmediately!==true:rpc.params?.configuration?.blocking===true;
            while(blocking&&['received','running'].includes(task.status)&&!this.waiting(task.threadId)&&!res.destroyed&&!r.stopped)await pause(200);
            if(res.destroyed)return;
            result=rpc.method==='SendMessage'?{task:this.a2aTask(task)}:this.a2aTask(task);
          } else if(['GetTask','tasks/get','CancelTask','tasks/cancel'].includes(rpc.method)) {
            const task=this.state.tasks[rpc.params?.id];if(!task||task.connectionId!==c.id)throw Error('Auftrag nicht gefunden.');
            if(['CancelTask','tasks/cancel'].includes(rpc.method)&&['received','running'].includes(task.status))await this.interrupt(task.threadId);
            result=this.a2aTask(task);
          } else return reply(res,200,{jsonrpc:'2.0',id:rpc.id,error:{code:-32601,message:'Methode nicht unterstützt.'}});
          return reply(res,200,{jsonrpc:'2.0',id:rpc.id,result});
        }
        if(url.pathname!=='/whatsapp/webhook')return reply(res,404,{error:'Nicht gefunden.'});
        if(req.method==='GET') {
          if(url.searchParams.get('hub.mode')!=='subscribe'||!equal(url.searchParams.get('hub.verify_token'),credentials.verifyToken))return reply(res,403,{error:'Verifikation fehlgeschlagen.'});
          res.writeHead(200,{'content-type':'text/plain'});res.end(url.searchParams.get('hub.challenge')||'');return;
        }
        if(req.method!=='POST')return reply(res,405,{error:'Methode nicht erlaubt.'});
        const raw=await readBody(req),signature='sha256='+createHmac('sha256',credentials.appSecret).update(raw).digest('hex');
        if(!equal(req.headers['x-hub-signature-256'],signature))return reply(res,401,{error:'Signatur ungültig.'});
        const event=JSON.parse(raw.toString());
        for(const entry of event.entry||[])for(const change of entry.changes||[]) {
          const v=change.value;if(String(v?.metadata?.phone_number_id)!==c.config.phoneNumberId)continue;
          for(const m of v.messages||[])if(m.type==='text')await this.accept(c.id,{sender:m.from,chatId:m.from,messageId:m.id,text:m.text?.body});
        }
        return reply(res,200,{ok:true});
      }catch {if(!res.headersSent&&!res.destroyed)reply(res,a2a?200:400,a2a?{jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32602,message:'Anfrage konnte nicht übernommen werden. Parameter und laufende Aufträge prüfen.'}}:{error:'Anfrage konnte nicht übernommen werden.'});}
    });
    r.server.requestTimeout=15000;r.server.headersTimeout=10000;
    await new Promise((resolve,reject)=>{r.server.once('error',reject);r.server.listen(c.config.port,a2a?c.config.host:'127.0.0.1',resolve);});
  }
}
