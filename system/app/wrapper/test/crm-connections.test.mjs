import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {Storage} from '../storage.mjs';
import {createSecretStore, installIntegrationRoutes} from '../integrations.mjs';
import {crmCatalog, crmStatus} from '../crm-catalog.mjs';
import {matchesConnection, catalogForFeatures} from '../ui/connection-catalog.mjs';

async function fixture(t, request = async () => Response.json({data:{__typename:'Query'}})) {
  const root = await mkdtemp(path.join(os.tmpdir(),'crm-connections-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  const store = new Storage(path.join(root,'workspace'),path.join(root,'data')); await store.init();
  const keys = new Map();
  const secrets = createSecretStore(store, {
    save:async(id,value)=>keys.set(id,value), read:async id=>keys.get(id),
    has:async id=>keys.has(id), remove:async id=>keys.delete(id),
  });
  const routes = new Map();
  await installIntegrationRoutes({store,secrets,request,route:(m,u,f)=>routes.set(m+u,f)});
  const call = (route,body) => routes.get('POST/api/'+route)(body);
  return {store,secrets,keys,call,save:input=>call('connections/save',{kind:'crm',provider:'hero',...input})};
}

test('CRM login lifecycle uses only keychain, preserves exact passwords and protects references',async t=>{
  const f=await fixture(t);
  let c=await f.save({provider:'labelwin',name:'Werkstatt',config:{method:'login',password:'must-not-persist'},credentials:{username:'synthetic@example.invalid',password:'  synthetic password  '}});
  assert.equal(c.provider,'labelwin'); assert.match(crmStatus(c),/nicht angemeldet/);
  assert.deepEqual(JSON.parse(f.keys.get(c.secretId)),{username:'synthetic@example.invalid',password:'  synthetic password  '});
  assert.equal((await f.secrets.list()).find(s=>s.id===c.secretId).format,'crm-credentials');
  const secretId=c.secretId;
  c=await f.save({...c,name:'Anderer Name',credentials:{username:'',password:''}});
  assert.equal(c.secretId,secretId);
  assert.equal(JSON.parse(f.keys.get(c.secretId)).password,'  synthetic password  ');
  assert.doesNotMatch(await readFile(path.join(f.store.dataRoot,'state.json'),'utf8'),/synthetic@example|synthetic password|must-not-persist/);
  assert.doesNotMatch(JSON.stringify(c),/synthetic@example|synthetic password/);
  await assert.rejects(f.call('secrets/delete',{id:c.secretId}),/noch von einer Verbindung/);
  await assert.rejects(f.call('secrets/save',{id:c.secretId,value:'invalid-json'}),/zugehörige Verbindung/);
  await assert.rejects(f.call('connections/save',{kind:'webhook',name:'Other',url:'https://example.com',secretId:c.secretId}),/nicht als Bearer/);
  await f.call('connections/delete',{id:c.id});
  assert.ok(f.keys.has(secretId));
  await f.call('secrets/delete',{id:secretId});
  assert.ok(!f.keys.has(secretId));
});

test('all presets validate their own API or login schema without claiming a connection',async t=>{
  const f=await fixture(t);
  for (const provider of crmCatalog) {
    const method=provider.api.auth?'api':'login';
    const c=await f.save({provider:provider.id,config:{method,url:provider.id==='weclapp'?'https://synthetic.weclapp.com':'https://example.com',tenant:'synthetic-db'},
      credentials:{token:'synthetic-token',username:'synthetic-user',password:'synthetic-password',access:'synthetic-access'}});
    assert.equal(c.provider,provider.id);assert.equal(c.check,undefined);
    const reopened=new Storage(f.store.root,f.store.dataRoot);await reopened.init();
    assert.equal(reopened.state.connections.find(x=>x.id===c.id).secretId,c.secretId);
  }
});

test('a failed connection save leaves its credential bundle typed and unavailable as a webhook token after restart',async t=>{
  const f=await fixture(t), originalSave=f.store.save.bind(f.store);
  let writes=0;
  f.store.save=async()=>{if(++writes===2)throw Error('synthetic disk failure');return originalSave();};
  await assert.rejects(f.save({config:{method:'login'},credentials:{username:'synthetic-user',password:'synthetic-password'}}),/synthetic disk failure/);
  const reopened=new Storage(f.store.root,f.store.dataRoot);await reopened.init();
  assert.equal(reopened.state.connections.length,0);
  assert.equal(reopened.state.secrets.length,1);
  assert.equal(reopened.state.secrets[0].format,'crm-credentials');
  f.store.state=reopened.state;f.store.save=originalSave;
  await assert.rejects(f.call('connections/save',{name:'Webhook',kind:'webhook',url:'https://example.com',secretId:reopened.state.secrets[0].id}),/nicht als Bearer/);
  assert.equal(f.store.state.connections.length,0);
});

test('new credentials get a private reference; blank edits keep secrets; mode changes require new credentials',async t=>{
  const f=await fixture(t);
  const c=await f.save({config:{method:'api'},credentials:{token:'old-key'}});
  const edited=await f.save({...c,credentials:{token:'new-key'}});
  assert.notEqual(c.secretId,edited.secretId);assert.equal(JSON.parse(f.keys.get(c.secretId)).token,'old-key');
  await assert.rejects(f.save({...edited,config:{method:'login'},credentials:{}}),/Benutzername/);
  const login=await f.save({...edited,config:{method:'login'},credentials:{username:'user',password:'pw'}});
  assert.deepEqual(JSON.parse(f.keys.get(login.secretId)),{username:'user',password:'pw'});
  await assert.rejects(f.save({...c,name:'Stale'}),/zwischenzeitlich/);
  await assert.rejects(f.save({...login,provider:'weclapp'}),/Anbieter/);
  await assert.rejects(f.call('connections/save',{id:login.id,kind:'link',url:'https://example.com'}),/CRM-Anschluss/);
});

test('missing credentials, unknown methods and credential-bearing URLs fail before any write',async t=>{
  const f=await fixture(t);
  for (const input of [
    {config:{method:'api'},credentials:{}},
    {provider:'invented'},
    {config:{method:'oauth'}},
    {provider:'winworker',config:{method:'api'}},
    ...['http://example.com','https://user:pass@example.com','https://example.com/?token=secret','https://example.com/#secret','javascript:alert(1)'].map(url=>({config:{method:'login',url},credentials:{username:'user',password:'pw'}})),
    {credentials:{token:'token\r\ninjected-header'}},
    {provider:'weclapp',config:{method:'api',url:'https://weclapp.com.evil.test'},credentials:{token:'test'}},
  ]) await assert.rejects(f.save(input));
  assert.equal(f.keys.size,0);assert.equal(f.store.state.connections.length,0);
});

test('HERO checks GraphQL errors as well as HTTP, never exposes vendor echoes, and invalidates checks on edit',async t=>{
  let response=()=>Response.json({data:{__typename:'Query'}}), sent=[];
  const f=await fixture(t,async(url,options)=>{sent.push({url,options});return response();});
  let c=await f.save({config:{method:'api',url:'https://ignored.example'},credentials:{token:'private-synthetic-key'}});
  assert.equal((await f.call('connections/test',{id:c.id})).ok,true);
  assert.equal(sent[0].url,'https://login.hero-software.de/api/external/v7/graphql');
  assert.equal(sent[0].options.headers.authorization,'Bearer private-synthetic-key');
  assert.deepEqual(JSON.parse(sent[0].options.body),{query:'query ConnectionCheck { __typename }'});
  response=()=>Response.json({errors:[{message:'private-synthetic-key'}]});
  const failed=await f.call('connections/test',{id:c.id});
  assert.equal(failed.ok,false);assert.doesNotMatch(JSON.stringify(failed),/private-synthetic-key/);
  assert.match(crmStatus(f.store.state.connections[0]),/fehlgeschlagen/);
  c=await f.save({...c,credentials:{token:'replacement'}});assert.equal(c.check,undefined);
  response=()=>{throw Error('private-synthetic-key');};
  assert.doesNotMatch(JSON.stringify(await f.call('connections/test',{id:c.id})),/private-synthetic-key/);
});

test('weclapp and CentralStationCRM use documented header auth and reject invalid responses',async t=>{
  const calls=[];
  const f=await fixture(t,async(url,options)=>{
    calls.push({url,options});return url.includes('weclapp')?Response.json({result:{id:'test-user'}}):new Response(null,{status:204});
  });
  for (const provider of ['weclapp','centralstationcrm']) {
    const c=await f.save({provider,config:{method:'api',url:'https://synthetic.weclapp.com/webapp/'},credentials:{token:'synthetic-key'}});
    assert.equal((await f.call('connections/test',{id:c.id})).ok,true);
  }
  assert.equal(calls[0].url,'https://synthetic.weclapp.com/webapp/api/v2/user/currentUser');
  assert.equal(calls[0].options.headers.AuthenticationToken,'synthetic-key');
  assert.equal(calls[1].url,'https://api.centralstationcrm.net/api/check_connection');
  assert.equal(calls[1].options.headers['X-apikey'],'synthetic-key');
  assert.ok(calls.every(c=>!c.url.includes('synthetic-key')));
});

test('prepared APIs and saved logins never run a check or claim to be connected',async t=>{
  const f=await fixture(t,()=>{throw Error('must not call network');});
  for (const input of [{provider:'labelwin',config:{method:'login'},credentials:{username:'user',password:'pw'}},
    {provider:'plancraft',config:{method:'api'},credentials:{token:'synthetic'}}]) {
    const c=await f.save(input);
    await assert.rejects(f.call('connections/test',{id:c.id}),/noch keine automatische/);
    assert.equal(f.store.state.connections.find(x=>x.id===c.id).check,undefined);
  }
});

test('in-flight check cannot verify credentials replaced or removed while waiting',async t=>{
  let unblock, started;
  const ready=new Promise(r=>started=r);
  const f=await fixture(t,async()=>{started();await new Promise(r=>unblock=r);return Response.json({data:{__typename:'Query'}});});
  const c=await f.save({credentials:{token:'before'}});
  const checking=f.call('connections/test',{id:c.id});await ready;
  const edited=await f.save({...c,credentials:{token:'after'}});
  unblock();await assert.rejects(checking,/während der Prüfung geändert/);
  assert.equal(edited.check,undefined);
});

test('catalog search covers aliases and groups, feature gating and verified local brand assets',async()=>{
  const entries=catalogForFeatures({crmConnections:true}).filter(s=>s.kind==='crm');
  assert.equal(entries.length,13);
  assert.equal(catalogForFeatures({}).filter(s=>s.kind==='crm').length,0);
  assert.equal(entries.filter(s=>matchesConnection(s,'Handwerk')).length,13);
  assert.equal(entries.filter(s=>matchesConnection(s,'CRM')).length,13);
  assert.equal(entries.find(s=>matchesConnection(s,'Label Software')).provider,'labelwin');
  assert.equal(entries.find(s=>matchesConnection(s,'SAP B1')).provider,'sap-business-one');
  const sources=JSON.parse(await readFile(new URL('../ui/assets/crm/sources.json',import.meta.url)));
  assert.equal(sources.length,13);
  for (const source of sources) {
    const bytes=await readFile(new URL('../ui/assets/crm/'+source.file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
    assert.ok(source.source.startsWith('https://'));
  }
});
