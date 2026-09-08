import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { serviceDefinition, serviceCatalog } from './service-catalog.mjs';
import { safeName } from './storage.mjs';
import { safeRequest } from './safe-request.mjs';

const text = value => String(value ?? '').trim();
function address(value) {
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash)
    throw Error('HTTP(S)-Adresse ohne Zugangsdaten, Suchparameter oder Fragment erforderlich.');
  return u.href.replace(/\/$/, '');
}
export function validateService(input, store) {
  const spec = serviceDefinition(input.provider);
  if (!spec) throw Error('Unbekannter Anschluss.');
  const config = {};
  for (const field of spec.fields.filter(f => !f.secret)) {
    let value = input.config?.[field.key] ?? field.default ?? '';
    if (field.type === 'list') {
      value = [...new Set((Array.isArray(value) ? value : text(value).split(/[\s,;]+/)).map(text).filter(Boolean))];
      if (value.length > 200 || value.some(v => !/^\+?\d{1,22}$/.test(v))) throw Error(`${field.label}: gültige IDs oder Rufnummern erforderlich.`);
      if (spec.id.startsWith('whatsapp')) value = value.map(v => v.replace(/^\+/, ''));
    } else if (field.type === 'number') {
      value = Number(value);
      if (!Number.isInteger(value) || value < 1024 || value > 65535) throw Error('Port muss zwischen 1024 und 65535 liegen.');
    } else {
      value = text(value);
      if (value.length > 2000) throw Error(`${field.label} ist zu lang.`);
      if (field.required && !value) throw Error(`${field.label} fehlt.`);
      if (field.options && !field.options.some(([id]) => id === value)) throw Error('Ungültige Auswahl.');
      if (field.type === 'url' && value) value = address(value);
    }
    config[field.key] = value;
  }
  if (spec.id === 'a2a') {
    if (config.mode === 'client' && !config.url) throw Error('Agent-Adresse fehlt.');
    if (config.mode === 'server' && !isIP(config.host)) throw Error('Bind Host muss eine IP-Adresse sein.');
  }
  if (spec.id === 'microsoft-graph' && ![config.tenantId,config.clientId].every(s => /^[\da-f-]{36}$/i.test(s))) throw Error('Mandanten- und Anwendungs-ID müssen UUIDs sein.');
  if (spec.id === 'whatsapp-cloud' && (!/^\d+$/.test(config.phoneNumberId) || !/^v\d+\.\d+$/.test(config.apiVersion))) throw Error('Phone Number ID oder Graph-API-Version ungültig.');
  if (spec.id === 'openai-image' && !/^gpt-image-[\w.-]+$/.test(config.model)) throw Error('Ein unterstütztes GPT-Image-Modell eingeben.');
  const projectId = input.projectId || 'default';
  store.project(projectId);
  return { config, projectId, worker: input.worker || 'auto' };
}

export class ServiceConnections {
  constructor({store,secrets,workers,request = safeRequest,recordBoundary = async()=>{}}) {
    Object.assign(this,{store,secrets,workers,request,recordBoundary});
    this.runtime = null;
  }
  get(id) {
    const c = this.store.state.connections.find(c=>c.id===id && c.kind==='service');
    if (!c) throw Error('Anschluss nicht gefunden.');
    return c;
  }
  list() { return this.store.state.connections.filter(c=>c.kind==='service').map(c=>({...c,...this.runtime?.status(c.id)})); }
  async credentials(c) { try{return c.secretId ? JSON.parse(await this.secrets.read(c.secretId)) : {};}catch{throw Error('Zugangsdaten nicht lesbar. Im Verbindungsdialog erneut hinterlegen.');} }
  async save(input) {
    return this.secrets.exclusive(async()=>{
      const previous = input.id ? this.get(input.id) : null;
      if (previous && previous.provider !== input.provider) throw Error('Anschlusstyp kann nicht gewechselt werden.');
      if (this.runtime?.running(previous?.id)) throw Error('Bitte zuerst den Empfang stoppen.');
      const values = validateService(input,this.store);
      if (values.worker !== 'auto' && !this.workers.settings.enabled.includes(values.worker)) throw Error('Worker ist nicht verbunden.');
      const entry = {id:previous?.id || 'service-'+randomUUID().slice(0,12),kind:'service',provider:input.provider,
        name:text(input.name || serviceDefinition(input.provider).name).slice(0,100),...values,
        secretId:previous?.secretId || null,updatedAt:new Date().toISOString()};
      const secretFields = serviceDefinition(input.provider).fields.filter(f=>f.secret);
      const changes = Object.fromEntries(secretFields.filter(f=>text(input.credentials?.[f.key])).map(f=>[f.key,text(input.credentials[f.key])]));
      if (Object.values(changes).some(v=>v.length>16000 || /[\r\n]/.test(v))) throw Error('Zugangsdaten sind ungültig.');
      if (Object.keys(changes).length) {
        const credentials = {...(previous ? await this.credentials(previous) : {}),...changes};
        entry.secretId = (await this.secrets.save('service-key-'+randomUUID().slice(0,12),JSON.stringify(credentials),entry.name+' · Zugang')).id;
      }
      // Retain verification only when every setting and credential is unchanged.
      if (previous && !Object.keys(changes).length && JSON.stringify(previous.config)===JSON.stringify(entry.config)) {
        entry.checkedAt=previous.checkedAt;entry.check=previous.check;
      }
      const before = this.store.state.connections;
      this.store.state.connections = before.filter(c=>c.id!==entry.id).concat(entry);
      try {await this.store.save();} catch(e){this.store.state.connections=before;throw e;}
      return entry;
    });
  }
  async remove(id) {
    return this.secrets.exclusive(async()=>{
      this.get(id);
      if ((await this.store.jobs()).some(j=>j.connectionId===id)) throw Error('Dieser Anschluss wird von einem Auftrag verwendet.');
      if (this.runtime?.hasActive(id)) throw Error('Ein Kanalauftrag läuft noch. Bitte zuerst stoppen oder abwarten.');
      await this.runtime?.stop(id);
      this.store.state.connections=this.store.state.connections.filter(c=>c.id!==id);await this.store.save();return {ok:true};
    });
  }
  async json(url,options={}) {
    const r=await this.request(url,{method:'GET',maxBytes:2e6,...options});
    if(!r.ok) throw Error(`Anbieter meldet HTTP ${r.status}. Zugang und Berechtigungen prüfen.`);
    try {return JSON.parse(await r.text());} catch {throw Error('Anbieter hat keine gültige JSON-Antwort geliefert.');}
  }
  async telegram(c,method,payload={}) {
    const {token}=await this.credentials(c);if(!token || !/^\d+:[\w-]+$/.test(token)) throw Error('Gültiger Bot-Token fehlt.');
    const r=await this.json(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),timeoutMs:35000});
    if(!r.ok) throw Error('Telegram hat den Aufruf abgelehnt. Bot-Einrichtung prüfen.');return r.result;
  }
  async graphToken(c) {
    const {clientSecret}=await this.credentials(c);if(!clientSecret) throw Error('Anwendungsgeheimnis fehlt.');
    const r=await this.json(`https://login.microsoftonline.com/${c.config.tenantId}/oauth2/v2.0/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.config.clientId,client_secret:clientSecret,grant_type:'client_credentials',scope:'https://graph.microsoft.com/.default'}).toString()});
    if(!r.access_token) throw Error('Microsoft hat keinen Zugangstoken geliefert.');return r.access_token;
  }
  async graph(c,resource,options={}) {
    const token=await this.graphToken(c);
    return this.json(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(c.config.mailbox)}/${resource}`,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json'}});
  }
  async a2aCard(c) {
    const {token}=await this.credentials(c),headers=token?{authorization:'Bearer '+token}:{};
    let card;
    for(const suffix of ['/.well-known/agent-card.json','/.well-known/agent.json']) {
      const url=c.config.url+suffix;
      const r=await this.request(url,{method:'GET',internalUrls:[url],headers,maxBytes:200000});
      if(r.status===404)continue;
      if(!r.ok)throw Error('Agent Card konnte nicht gelesen werden. Zugang prüfen.');
      card=JSON.parse(await r.text());break;
    }
    const iface=card?.supportedInterfaces?.find(i=>i.protocolBinding==='JSONRPC');
    if(!card?.name||(!iface&&!card.url))throw Error('Keine Agent Card mit JSON-RPC-Schnittstelle.');
    const rpcUrl=address(iface?.url||card.url);
    if(new URL(rpcUrl).origin!==new URL(c.config.url).origin)throw Error('Die Agent Card verweist auf einen anderen Host. Dessen Adresse ausdrücklich als Verbindung einrichten.');
    return {card,rpcUrl,protocol:iface?.protocolVersion||card.protocolVersion||'0.3',tenant:iface?.tenant};
  }
  async check(id) {
    const c=this.get(id), credential=await this.credentials(c); let result;
    if(c.provider==='telegram') {
      const bot=await this.telegram(c,'getMe'); const webhook=await this.telegram(c,'getWebhookInfo');
      result={message:`Bot @${bot.username || bot.id} erreichbar.`,identity:String(bot.id),webhookConfigured:!!webhook.url};
    } else if(c.provider==='a2a' && c.config.mode==='client') {
      const {card,rpcUrl,protocol,tenant}=await this.a2aCard(c);
      result={message:`Agent ${String(card.name).slice(0,100)} erreichbar.`,identity:String(card.name).slice(0,100),rpcUrl,protocol,tenant,streaming:card.capabilities?.streaming===true};
    } else if(c.provider==='a2a') {
      if(!credential.token || credential.token.length<24) throw Error('Für den Empfang einen Bearer-Token mit mindestens 24 Zeichen hinterlegen.');
      result={message:'Empfangskonfiguration geprüft. Der Port wird erst beim Start gebunden.'};
    } else if(c.provider==='whatsapp-local') {
      result={message:'Bridge vorbereitet. Anmeldung erfolgt beim Start per QR-Code.'};
    } else if(c.provider==='whatsapp-cloud') {
      if(!credential.token) throw Error('Access Token fehlt.');
      const data=await this.json(`https://graph.facebook.com/${c.config.apiVersion}/${c.config.phoneNumberId}?fields=id,display_phone_number`,{headers:{authorization:'Bearer '+credential.token}});
      result={message:'Rufnummer erreichbar.',identity:data.display_phone_number || data.id};
    } else if(c.provider==='microsoft-graph') {
      await this.graph(c,'mailFolders/inbox/messages?$top=1&$select=id');
      result={message:'Anmeldung und Postfach-Lesezugriff geprüft. Kalender- und Schreibrechte werden separat benötigt.'};
    } else if(c.provider==='discord') {
      if(!credential.token) throw Error('Bot-Token fehlt.');
      const headers={authorization:'Bot '+credential.token};
      const bot=await this.json('https://discord.com/api/v10/users/@me',{headers});
      await this.json('https://discord.com/api/v10/channels/'+encodeURIComponent(c.config.channelId),{headers});
      result={message:'Bot und Kanal erreichbar. Automatischer Discord-Empfang ist noch nicht verfügbar.',identity:bot.username};
    } else if(c.provider==='openai-image') {
      if(!credential.token) throw Error('API-Schlüssel fehlt.');
      await this.json('https://api.openai.com/v1/models/'+encodeURIComponent(c.config.model),{headers:{authorization:'Bearer '+credential.token}});
      result={message:'Modellzugang geprüft. Es wurde kein Bild erzeugt.'};
    }
    c.checkedAt=new Date().toISOString();c.check=result;await this.store.save();return result;
  }
  async action(id,action,input={}) {
    const c=this.get(id);
    await this.recordBoundary('service',{connectionId:id,action},{text:JSON.stringify(input)});
    if(c.provider==='microsoft-graph' && action==='inbox') return this.graph(c,'mailFolders/inbox/messages?$top=10&$select=id,subject,receivedDateTime,from');
    if(c.provider==='microsoft-graph' && action==='calendar') return this.graph(c,'events?$top=10&$select=id,subject,start,end');
    if(c.provider==='a2a' && c.config.mode==='client' && ['message','task'].includes(action)) {
      if(action==='message'&&(typeof input.text!=='string'||!text(input.text)||input.text.length>30000))throw Error('Nachricht fehlt oder ist zu lang.');
      if(action==='task'&&(typeof input.taskId!=='string'||input.taskId.length>256))throw Error('Auftragskennung fehlt.');
      const {token}=await this.credentials(c),{rpcUrl:url,protocol,tenant}=await this.a2aCard(c),legacy=protocol.startsWith('0.');
      const method=action==='task'?(legacy?'tasks/get':'GetTask'):(legacy?'message/send':'SendMessage');
      const params=action==='task'?{id:input.taskId}:{message:{messageId:randomUUID(),role:legacy?'user':'ROLE_USER',parts:[{text:input.text,...(legacy?{kind:'text'}:{})}],...(input.contextId?{contextId:String(input.contextId)}:{})},configuration:legacy?{blocking:false}:{returnImmediately:true}};
      if(tenant)params.tenant=tenant;
      const r=await this.json(url,{internalUrls:[url],method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({jsonrpc:'2.0',id:randomUUID(),method,params}),timeoutMs:180000});
      if(r.error) throw Error('A2A-Gegenstelle hat die Anfrage abgelehnt.');return r.result?.task||r.result?.message||r.result;
    }
    throw Error('Diese Aktion wird von diesem Anschluss nicht unterstützt.');
  }
}

export function installServiceRoutes({route,services,runtime}) {
  route('GET','/api/services',async()=>({connections:services.list(),catalog:serviceCatalog}));
  route('POST','/api/services/save',b=>services.save(b));
  route('POST','/api/services/delete',b=>services.remove(b.id));
  route('POST','/api/services/check',b=>services.check(b.id));
  route('POST','/api/services/start',b=>runtime.start(b.id));
  route('POST','/api/services/stop',b=>runtime.stop(b.id));
  route('POST','/api/services/action',b=>services.action(b.id,b.action,b.input));
  route('GET','/api/services/sessions',async(_b,url)=>runtime.sessions(url.searchParams.get('id')));
}
