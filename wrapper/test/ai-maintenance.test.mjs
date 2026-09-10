import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AIMaintenance,newer,versionNumber,releaseInfo,managedCommand} from '../ai-maintenance.mjs';
const catalog=[{id:'codex',name:'OpenAI',program:'Codex',worker:'codex',package:'@openai/codex',command:'codex'}];
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{etag:'v2'}});
async function fixture(t,changes={}) {
 const dataRoot=await mkdtemp(path.join(os.tmpdir(),'ai-maintenance-'));t.after(()=>rm(dataRoot,{recursive:true,force:true}));
 const instance=new AIMaintenance({dataRoot,catalog,modelCatalog:async()=>({}),workers:{status:async()=>({workers:[{id:'codex',installed:true,connected:true}]}),entry:()=>({env:'TEST_AI_BINARY'}),resolveCommand:async()=>'/fixture/codex',modelLists:async()=>({})},activate:async()=>true,run:async()=>({stdout:'codex-cli 1.0.0'}),request:async()=>response({name:'@openai/codex',version:'1.1.0'}),clock:()=>1000,...changes});
 await instance.init();instance.install=async()=>({command:'/fixture/new',directory:'v1-abc'});return instance;
}
test('stable versions compare numerically; prereleases and unknowns never install',()=>{
 assert.equal(newer('1.10.0','1.9.0'),true);assert.equal(newer('1.0.0','2.0.0'),false);assert.equal(newer('2.0.0',null),false);assert.equal(newer('2.0.0-beta','1.0.0'),false);
 assert.equal(versionNumber('codex-cli 1.10.0\n'),'1.10.0');assert.equal(versionNumber('1.0.0-beta'),null);
});
test('metadata validates identity, stable channel and HTTP errors, reuses ETag',async()=>{
 await assert.rejects(releaseInfo(catalog[0],{},async()=>response({name:'wrong',version:'1.0.0'})));
 await assert.rejects(releaseInfo(catalog[0],{},async()=>response({name:'@openai/codex',version:'1.0.0-beta'})));
 await assert.rejects(releaseInfo(catalog[0],{},async()=>response({},429)));
 const result=await releaseInfo(catalog[0],{latest:'1.0.0',etag:'old'},async(url,opts)=>{assert.equal(opts.headers['If-None-Match'],'old');assert.equal(opts.redirect,'error');return new Response(null,{status:304});});
 assert.equal(result.latest,'1.0.0');
});
test('concurrent checks share work; installed update commits only after successful activation',async t=>{
 let count=0;const service=await fixture(t,{activate:async(id,command,commit)=>{count++;await commit();return true;}});
 await Promise.all([service.check({force:true}),service.check({force:true})]);
 assert.equal(count,1);assert.equal(service.state.items.codex.active.version,'1.1.0');assert.equal(service.state.items.codex.phase,'current');
 const restarted=await fixture(t);restarted.file=service.file;await restarted.init();assert.equal(restarted.state.items.codex.active.version,'1.1.0');
 assert.equal(service.state.events.filter(e=>e.id.includes('updated')).length,1);
});
test('busy worker defers activation and emits no success',async t=>{
 const service=await fixture(t,{activate:async()=>false});await service.check();assert.equal(service.state.items.codex.phase,'waiting');assert.equal(service.state.items.codex.active,undefined);assert.equal(service.state.events.some(e=>e.id.includes('updated')),false);assert.equal(service.state.nextCheck,61000);
});
test('disabled auto update checks but never installs; choice survives reload',async t=>{
 const service=await fixture(t);let installs=0;service.install=async()=>{installs++;};await service.configure(false);await service.check();assert.equal(installs,0);assert.equal(service.state.items.codex.phase,'available');await service.init();assert.equal(service.state.automatic,false);
});
test('offline retains last release and successful-check timestamp with error',async t=>{
 const service=await fixture(t,{request:async()=>{throw Error('offline');}});service.state.items.codex={latest:'1.1.0',checkedAt:10};await service.check();assert.equal(service.state.items.codex.latest,'1.1.0');assert.equal(service.state.items.codex.checkedAt,10);assert.equal(service.state.items.codex.phase,'error');
});
test('failed candidate preserves active program and deduplicates problem notices',async t=>{
 const service=await fixture(t,{activate:async()=>{throw Error('bad handshake');}});service.state.items.codex={active:{version:'1.0.0',directory:'old'}};await service.check();await service.check({force:true});assert.equal(service.state.items.codex.active.version,'1.0.0');assert.equal(service.state.events.filter(e=>e.status==='failed').length,1);
});
test('managed command rejects directory traversal and missing active binary',async t=>{
 const service=await fixture(t);service.state.items.codex={active:{version:'1.0.0',directory:'../../escape'}};await service.save();assert.equal(await managedCommand(service.dataRoot,catalog[0]),null);
 service.state.items.codex.active.directory='missing';await service.save();await assert.rejects(managedCommand(service.dataRoot,catalog[0]));
});
test('installer pins package and registry, suppresses scripts, isolates environment, verifies binary',async t=>{
 const calls=[];const service=await fixture(t,{run:async(command,args,options)=>{calls.push({command,args,options});if(command==='npm'){const folder=args[args.indexOf('--prefix')+1];await mkdir(path.join(folder,'node_modules','@openai','codex'),{recursive:true});await writeFile(path.join(folder,'node_modules','@openai','codex','package.json'),JSON.stringify({name:'@openai/codex',version:'1.1.0'}));return {stdout:''};}return {stdout:'codex-cli 1.1.0'};}});
 service.state.items.codex={};await AIMaintenance.prototype.install.call(service,catalog[0],'1.1.0');
 assert(calls[0].args.includes('@openai/codex@1.1.0'));assert(calls[0].args.includes('--ignore-scripts'));assert(calls[0].args.includes('--registry=https://registry.npmjs.org'));assert.equal(calls[0].options.env.OPENAI_API_KEY,undefined);assert.equal(calls.length,2);
});

test('public catalog is data only, sorted by publication and rejects incomplete sources',async()=>{
 const {publicModelCatalog}=await import('../ai-maintenance.mjs');
 const data=Object.fromEntries(['openai','anthropic','google','moonshotai','deepseek','alibaba'].map(id=>[id,{models:{old:{id:'older',name:'Older',release_date:'2026-01-01'},fresh:{id:'fresh',name:'Fresh',release_date:'2026-02-01',command:'never execute',open_weights:true},bad:{id:'bad',name:'Bad',release_date:'unknown'}}}]));
 const result=await publicModelCatalog(async()=>response(data));assert.deepEqual(result.codex.map(m=>m.id),['fresh','older']);assert.equal(result.codex[0].command,undefined);
 await assert.rejects(publicModelCatalog(async()=>response({openai:{models:{}}})));
});

test('failed version is not repeatedly installed in the background',async t=>{
 let attempts=0;const service=await fixture(t,{clock:(()=>{let now=0;return()=>now+=4_000_000;})(),activate:async()=>{attempts++;throw Error('incompatible');}});
 await service.check();await service.check();assert.equal(attempts,1);await service.check({force:true});assert.equal(attempts,2);
});
