import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createHmac} from 'node:crypto';
import {Storage} from '../storage.mjs';
import {createSecretStore,installIntegrationRoutes} from '../integrations.mjs';
import {ServiceConnections} from '../service-connections.mjs';
import {ChannelRuntime} from '../channel-runtime.mjs';
import {Library} from '../library.mjs';
import {SkillLibrary} from '../skill-library.mjs';

async function fixture(t, options={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'agent-platform-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const store=new Storage(path.join(root,'workspace'),path.join(root,'state'));await store.init();
  const keys=new Map(),secrets=createSecretStore(store,{save:async(id,value)=>keys.set(id,value),read:async id=>keys.get(id),has:async id=>keys.has(id),remove:async id=>keys.delete(id)});
  const workers={settings:{enabled:['codex','hermes']},adapters:new Map()};
  const services=new ServiceConnections({store,secrets,workers,...options});
  const calls=[],interrupts=[];
  const runtime=await new ChannelRuntime({store,services,run:async p=>{
    calls.push(p);await p.onThread(p.session.threadId||'thread-'+calls.length);return {turn:{id:'turn-'+calls.length}};
  },interrupt:async id=>interrupts.push(id),...options}).init();
  services.runtime=runtime;t.after(()=>runtime.close());
  return {root,store,services,keys,secrets,workers,runtime,calls,interrupts};
}
async function connection(f, provider='telegram',config={},credentials={}) {
  return f.services.save({provider,worker:'hermes',config:{allowedUsers:['123'],...config},credentials,projectId:'default'});
}
async function localServer(t,handler) {
  const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));return {server,port:server.address().port,url:`http://127.0.0.1:${server.address().port}`};
}
async function freePort(){const s=http.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}

test('service credentials persist only as keychain references; native lifecycle cannot be bypassed',async t=>{
  const f=await fixture(t),c=await connection(f,'telegram',{}, {token:'123:synthetic-secret'});
  assert.deepEqual(await f.services.credentials(c),{token:'123:synthetic-secret'});
  assert.doesNotMatch(await readFile(path.join(f.store.dataRoot,'state.json'),'utf8'),/synthetic-secret/);
  const updated=await f.services.save({...c,credentials:{token:''},name:'Support'});
  assert.equal(updated.secretId,c.secretId);
  const routes=new Map();await installIntegrationRoutes({route:(m,u,fn)=>routes.set(m+u,fn),store:f.store,secrets:f.secrets});
  await assert.rejects(routes.get('POST/api/secrets/save')({id:c.secretId,value:'break-bundle'}),/Verbindung/);
  await assert.rejects(routes.get('POST/api/connections/save')({...c,url:'https://example.org'}),/Verbindungsdialog/);
  await assert.rejects(routes.get('POST/api/connections/delete')({id:c.id}),/Verbindungsdialog/);
  await assert.rejects(connection(f,'telegram',{allowedUsers:['nobody']}),/gültige IDs/);
  await assert.rejects(connection(f,'a2a',{mode:'server',host:'anything',port:9900}),/IP-Adresse/);
});

test('channel intake isolates identities, refuses unapproved users and deduplicates concurrent messages',async t=>{
  const f=await fixture(t),a=await connection(f),b=await connection(f);
  assert.equal(await f.runtime.accept(a.id,{sender:'456',chatId:'chat',messageId:'unauthorized',text:'hello'}),null);
  assert.equal(Object.keys(f.runtime.state.sessions).length,0);
  const msg={sender:'123',chatId:'chat',messageId:'same',text:'hello'};
  const [first,duplicate]=await Promise.all([f.runtime.accept(a.id,msg),f.runtime.accept(a.id,msg)]);
  assert.equal(first.id,duplicate.id);assert.equal(f.calls.length,1);assert.equal(f.calls[0].connection.worker,'hermes');
  await assert.rejects(f.runtime.accept(a.id,{...msg,messageId:'overlap'}),/läuft noch/);
  const other=await f.runtime.accept(b.id,msg);assert.notEqual(other.sessionId,first.sessionId);assert.equal(f.calls.length,2);
  const deliveries=[];f.runtime.live.set(a.id,{send:async(...args)=>deliveries.push(args)});
  await f.runtime.complete(first.threadId,{id:first.turnId,status:'completed'},'fertig',[{path:'output/a.txt'}]);
  await f.runtime.deliver(first);assert.equal(deliveries.length,1);assert.equal(deliveries[0][0],'chat');assert.equal(first.result,'fertig');
  await f.runtime.accept(a.id,{...msg,messageId:'next'});assert.equal(f.calls[2].session.threadId,first.threadId);
  await f.runtime.accept(a.id,{...msg,messageId:'stop',text:'/stop'});assert.deepEqual(f.interrupts,[first.threadId]);
  const restarted=await new ChannelRuntime({store:f.store,services:f.services,run:()=>assert.fail('must not replay')}).init();
  assert.equal(restarted.state.tasks[other.id].status,'interrupted');assert.equal((await restarted.accept(a.id,msg)).id,first.id);
});

test('an ambiguous delivery is not sent a second time',async t=>{
  const f=await fixture(t),c=await connection(f);let sends=0;
  const task=await f.runtime.accept(c.id,{sender:'123',chatId:'private',messageId:'msg',text:'hello'});
  f.runtime.live.set(c.id,{send:async()=>{sends++;throw Error('socket dropped after accept');}});
  await f.runtime.complete(task.threadId,{id:task.turnId,status:'completed'},'result');await f.runtime.deliver(task);
  assert.equal(sends,1);assert.match(task.deliveryError,/unbestätigt/);
});

test('Telegram starts once, refuses webhook takeover and stops without handling further messages',async t=>{
  let release,checks=0;
  const f=await fixture(t),c=await connection(f);
  f.services.check=async()=>{checks++;};
  f.services.telegram=async(_c,method)=>method==='getUpdates'?new Promise(r=>release=r):true;
  await Promise.all([f.runtime.start(c.id),f.runtime.start(c.id)]);assert.equal(checks,1);assert.equal(f.runtime.status(c.id).runtimeActive,true);
  await assert.rejects(f.services.save({...c,config:c.config}),/Empfang stoppen/);
  await f.runtime.stop(c.id);release([{update_id:8,message:{from:{id:123},chat:{type:'private',id:123},text:'late'}}]);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,0);
  c.check={webhookConfigured:true};await assert.rejects(f.runtime.start(c.id),/Webhook/);
  c.check=null;c.config.allowedUsers=[];await assert.rejects(f.runtime.start(c.id),/Nutzer/);
});

test('each WhatsApp identity owns a distinct bridge root and routes incoming text',async t=>{
  const bridges=[];const f=await fixture(t,{bridgeFactory:async options=>{bridges.push(options);return {init:async()=>{},connect:async()=>{},status:()=>({status:'connected'}),socket:{sendMessage:async()=>{},end:()=>{}}};}});
  const a=await connection(f,'whatsapp-local',{identity:'Agent A'}),b=await connection(f,'whatsapp-local',{identity:'Agent B'});
  await f.runtime.start(a.id);await f.runtime.start(b.id);assert.notEqual(bridges[0].root,bridges[1].root);
  await bridges[0].store.createOrder({source:{sender:'123',chatId:'123@s.whatsapp.net',messageId:'1'},instructions:'hello'});
  assert.equal(f.calls[0].connection.id,a.id);assert.equal(f.runtime.status(a.id).runtimeStatus,'running');
});

test('A2A authenticates, speaks v1 envelopes, accepts Hermes contexts and supports task polling',async t=>{
  const f=await fixture(t),c=await connection(f,'a2a',{mode:'server',host:'127.0.0.1',port:await freePort()},{token:'synthetic-token-at-least-24-chars'});
  await f.runtime.start(c.id);const base=`http://127.0.0.1:${c.config.port}`;
  const card=await (await fetch(base+'/.well-known/agent-card.json')).json();assert.equal(card.supportedInterfaces[0].protocolVersion,'1.0');assert.equal(card.capabilities.streaming,false);
  assert.equal((await fetch(base,{method:'POST',body:'{}'})).status,401);
  const rpc=async(method,params,id=0)=>(await (await fetch(base,{method:'POST',headers:{authorization:'Bearer synthetic-token-at-least-24-chars'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})})).json());
  const sent=await rpc('SendMessage',{message:{messageId:'m1',contextId:'hermes-new-context',role:'ROLE_USER',parts:[{text:'Hallo'}]},configuration:{returnImmediately:true}});
  assert.equal(sent.id,0);assert.equal(sent.result.task.status.state,'TASK_STATE_WORKING');assert.equal(f.calls.length,1);
  const task=f.runtime.state.tasks[sent.result.task.id];await f.runtime.complete(task.threadId,{id:task.turnId,status:'completed'},'Antwort');
  const polled=await rpc('GetTask',{id:task.id});assert.equal(polled.result.artifacts[0].parts[0].text,'Antwort');
  const pending=rpc('SendMessage',{message:{messageId:'m2',contextId:task.sessionId,parts:[{text:'Weiter'}]}});
  while(f.calls.length<2)await new Promise(resolve=>setTimeout(resolve,5));
  const next=Object.values(f.runtime.state.tasks).at(-1);await f.runtime.complete(next.threadId,{id:next.turnId,status:'completed'},'Synchron');
  assert.equal((await pending).result.task.artifacts[0].parts[0].text,'Synchron');
  assert.equal((await rpc('madeUp',{})).error.code,-32601);
  assert.equal((await rpc('GetTask',{id:'missing'})).jsonrpc,'2.0');
  const duplicate=await rpc('SendMessage',{message:{messageId:'m1',parts:[{text:'Hallo'}]},configuration:{returnImmediately:true}});assert.equal(duplicate.result.task.id,task.id);assert.equal(f.calls.length,2);
});

test('A2A client uses the advertised same-origin endpoint and unwraps v1 task responses',async t=>{
  const received=[];let base;
  const server=await localServer(t,async(req,res)=>{res.setHeader('content-type','application/json');if(req.method==='GET')res.end(JSON.stringify({name:'Test Hermes',supportedInterfaces:[{url:base+'/rpc',protocolBinding:'JSONRPC',protocolVersion:'1.0',tenant:'local'}]}));else {let raw='';for await(const chunk of req)raw+=chunk;received.push({url:req.url,rpc:JSON.parse(raw)});res.end(JSON.stringify({jsonrpc:'2.0',id:'reply',result:{task:{id:'t',contextId:'c',status:{state:'TASK_STATE_COMPLETED'},artifacts:[{parts:[{text:'Fertig'}]}]}}}));}});base=server.url;
  const f=await fixture(t),c=await connection(f,'a2a',{mode:'client',url:base});
  assert.equal((await f.services.check(c.id)).identity,'Test Hermes');
  const result=await f.services.action(c.id,'message',{text:'Arbeite'});assert.equal(result.id,'t');assert.equal(received[0].url,'/rpc');assert.equal(received[0].rpc.params.tenant,'local');assert.equal(received[0].rpc.params.configuration.returnImmediately,true);
  await f.services.action(c.id,'task',{taskId:'t'});assert.equal(received[1].rpc.method,'GetTask');
  const occupied=await connection(f,'a2a',{mode:'server',host:'127.0.0.1',port:server.port},{token:'synthetic-token-at-least-24-chars'});
  await assert.rejects(f.runtime.start(occupied.id),/belegt/);assert.equal((await fetch(base)).status,200);
});

test('WhatsApp Cloud checks signature, account, allowlist, deduplication and verification challenge',async t=>{
  const f=await fixture(t),c=await connection(f,'whatsapp-cloud',{phoneNumberId:'900',apiVersion:'v23.0',port:await freePort()},{token:'test',appSecret:'signature-secret',verifyToken:'verify-secret'});f.services.check=async()=>{};await f.runtime.start(c.id);
  const url=`http://127.0.0.1:${c.config.port}/whatsapp/webhook`;
  assert.equal(await (await fetch(url+'?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=challenge')).text(),'challenge');
  const raw=JSON.stringify({entry:[{changes:[{value:{metadata:{phone_number_id:'900'},messages:[{id:'approved',from:'123',type:'text',text:{body:'Hallo'}},{id:'denied',from:'456',type:'text',text:{body:'No'}}]}}]}]});
  assert.equal((await fetch(url,{method:'POST',body:raw})).status,401);
  const signature='sha256='+createHmac('sha256','signature-secret').update(raw).digest('hex');
  for(let n=0;n<2;n++)assert.equal((await fetch(url,{method:'POST',headers:{'x-hub-signature-256':signature},body:raw})).status,200);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'Hallo');
});

test('library indexes outputs, preserves provenance/favorites and rejects outside references',async t=>{
  const f=await fixture(t);await mkdir(path.join(f.root,'data/artifacts/run'),{recursive:true});await writeFile(path.join(f.root,'data/artifacts/run/result.txt'),'Legacy');
  await writeFile(path.join(f.store.root,'output/result.txt'),'Result');await writeFile(path.join(f.store.root,'input/private.txt'),'Input');await symlink(path.join(f.store.root,'input/private.txt'),path.join(f.store.root,'output/link.txt'));
  const lib=await new Library({store:f.store,root:f.root}).init();await lib.add('output/result.txt',{origin:'Bildgenerierung',worker:'test'});
  let list=await lib.refresh();assert.equal(list.entries.length,2);assert.equal(list.entries.find(e=>e.scope==='workspace').origin,'Bildgenerierung');
  const e=list.entries.find(e=>e.scope==='workspace');await lib.favorite(e.id,true);
  await writeFile(path.join(f.store.root,'output/result.txt'),'Longer result');await lib.refresh();assert.equal(lib.state.entries[e.id].favorite,true);assert.equal(lib.state.entries[e.id].size,13);
  const reused=await lib.reuse(e.id,'default');assert.equal(await readFile(path.join(f.store.root,reused.path),'utf8'),'Longer result');
  await assert.rejects(lib.resolve('../outside','artifacts'),/registriert/);
  await rm(path.join(f.store.root,'output/result.txt'));await lib.refresh();assert.equal(lib.state.entries[e.id].missing,true);
});

test('image output is validated and registered through the configured provider',async t=>{
  const f=await fixture(t),c=await connection(f,'openai-image',{}, {token:'synthetic-image-key'}),lib=await new Library({store:f.store,root:f.root}).init();let request;
  f.services.json=async(url,options)=>{request=JSON.parse(options.body);assert.equal(url,'https://api.openai.com/v1/images/generations');return {data:[{b64_json:'iVBORw0KGgo='}]};};
  const e=await lib.generate(f.services,{connectionId:c.id,prompt:'Test'});assert.equal(e.kind,'image');assert.equal(request.model,'gpt-image-2');assert.equal((await stat(path.join(f.store.root,e.path))).size,8);
  f.services.json=async()=>({data:[{b64_json:Buffer.from('not png').toString('base64')}]});await assert.rejects(lib.generate(f.services,{connectionId:c.id,prompt:'Bad'}),/kein PNG/);
});

test('skills keep provenance, install optional reference files and do not modify original installations',async t=>{
  const f=await fixture(t),home=path.join(f.root,'home'),hermesHome=path.join(home,'.hermes'),company=path.join(f.root,'company');await mkdir(company);
  const original='---\nname: sample\ndescription: A sample\n---\n\nRead references/info.txt.';
  for(const dir of [path.join(f.store.dataRoot,'codex/skills/codex-one'),path.join(hermesHome,'skills/hermes-one'),path.join(hermesHome,'hermes-agent/optional-skills/test/optional-one')]){await mkdir(path.join(dir,'references'),{recursive:true});await writeFile(path.join(dir,'SKILL.md'),original);await writeFile(path.join(dir,'references/info.txt'),'Supporting file');}
  await writeFile(path.join(hermesHome,'hermes-agent/LICENSE'),'Test license');
  const skills=new SkillLibrary({store:f.store,companyRoot:company,workers:f.workers,home,hermesHome});
  const listed=(await skills.list()).data[0].skills;assert.deepEqual(new Set(listed.map(s=>s.owner)),new Set(['codex','hermes']));
  const optional=(await skills.hub()).skills[0],preview=await skills.read(optional.id);
  await assert.rejects(skills.copy({id:optional.id,name:'mine',version:'stale'}),/geändert/);
  await skills.copy({id:optional.id,name:'mine',version:preview.version});assert.equal(await readFile(optional.path,'utf8'),original);assert.equal(await readFile(path.join(f.store.root,'skills/mine/references/info.txt'),'utf8'),'Supporting file');
  assert.match(await readFile(path.join(f.store.root,'skills/mine/SKILL.md'),'utf8'),/name: mine/);assert.equal(await readFile(path.join(f.store.root,'skills/mine/HERMES-LICENSE.txt'),'utf8'),'Test license');
  await assert.rejects(skills.copy({id:optional.id,name:'mine'}),/vorhanden/);
  await skills.proposal({name:'created',content:'Do the task',description:'Own workflow'});
  const own=(await skills.list()).data[0].skills.find(s=>s.name==='created');assert.equal(own.source,'Selbst erstellt');
  await symlink(path.join(f.root,'company'),path.join(path.dirname(optional.path),'escape'));await assert.rejects(skills.copy({id:optional.id,name:'unsafe'}),/Verknüpfungen/);
  assert.equal((await skills.list()).data[0].skills.some(s=>s.name==='unsafe'),false);
});


test('new provider entries wait for backend support during an active-server upgrade',async()=>{
  const {catalogForFeatures}=await import('../ui/connection-catalog.mjs');
  assert.equal(catalogForFeatures().some(c=>c.kind==='service'),false);
  assert.equal(catalogForFeatures().find(c=>c.name==='Outlook').kind,'webhook');
  assert.equal(catalogForFeatures({serviceConnections:true}).find(c=>c.name==='Telegram').provider,'telegram');
});


test('stopping Telegram during a media download prevents a late worker dispatch',async t=>{
  const f=await fixture(t),c=await connection(f);let releaseDownload,downloadStarted;
  const started=new Promise(resolve=>downloadStarted=resolve);
  f.services.check=async()=>{};
  f.services.telegram=async()=>[{update_id:1,message:{from:{id:123},chat:{type:'private',id:123},text:'attachment'}}];
  f.runtime.telegramAttachments=async()=>{downloadStarted();return new Promise(resolve=>releaseDownload=resolve);};
  await f.runtime.start(c.id);await started;await f.runtime.stop(c.id);releaseDownload([]);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,0);
});

test('Microsoft calendar follows complete bounded pages and rejects foreign continuations',async t=>{
  let foreign=false,calls=[];
  const f=await fixture(t,{request:async(url,options)=>{
    calls.push(String(url));
    if(String(url).includes('/oauth2/'))return {ok:true,text:async()=>JSON.stringify({access_token:'synthetic-access'})};
    const next='https://graph.microsoft.com/v1.0/users/inbox%40example.test/calendar/calendarView?$skiptoken=next';
    return {ok:true,text:async()=>JSON.stringify(String(url).includes('$skiptoken')?{value:[{id:'second'}]}:{value:[{id:'first'}],'@odata.nextLink':foreign?'https://example.test/private':next})};
  }});
  const c=await connection(f,'microsoft-graph',{tenantId:'00000000-0000-4000-8000-000000000001',clientId:'00000000-0000-4000-8000-000000000002',mailbox:'inbox@example.test'},{clientSecret:'synthetic-application-secret'});
  const bounds={start:'2026-10-01T00:00:00+02:00',end:'2026-11-01T00:00:00+01:00'};
  const result=await f.services.action(c.id,'calendar',bounds);
  assert.equal(result.complete,true);assert.deepEqual(result.value.map(e=>e.id),['first','second']);
  foreign=true;calls=[];
  await assert.rejects(f.services.action(c.id,'calendar',bounds),/Paginierung/);
  assert.ok(calls.every(url=>!url.startsWith('https://example.test')));
  await assert.rejects(f.services.action(c.id,'calendar',{}),/Zeitraum|zeitraum/);
});
