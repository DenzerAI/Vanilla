import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestartGate, fingerprint} from '../updates.mjs';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('restart requires explicit confirmation for the current sessions and rejects replay', async()=>{
  let active=['chat:turn1'], calls=0;
  const gate=createRestartGate({sessions:()=>[...active],restart:async()=>{calls++;}});
  const first=await gate.request({force:true});
  assert.equal(first.confirmationRequired,true); assert.equal(calls,0);
  active.push('other:turn2');
  const second=await gate.request({confirmation:first.confirmation});
  assert.equal(second.confirmationRequired,true); assert.equal(second.count,2); assert.equal(calls,0);
  assert.deepEqual(await gate.request({confirmation:second.confirmation}),{restarting:true});
  assert.equal(calls,1);
  await assert.rejects(gate.request({confirmation:second.confirmation}),/bereits/);
});
test('idle restart proceeds; unsupported or failed restart remains retryable',async()=>{
  let calls=0;
  const gate=createRestartGate({sessions:()=>[],restart:async()=>{if(!calls++)throw Error('unavailable');}});
  await assert.rejects(gate.request(),/unavailable/);assert.equal(gate.restarting,false);
  assert.deepEqual(await gate.request(),{restarting:true});
});
test('content fingerprint ignores timestamps and detects code changes and deletion',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'update-hash-'));
  try {
    await writeFile(path.join(dir,'server.mjs'),'first'); const first=await fingerprint(dir);
    await writeFile(path.join(dir,'server.mjs'),'first'); assert.equal(await fingerprint(dir),first);
    await writeFile(path.join(dir,'server.mjs'),'other'); assert.notEqual(await fingerprint(dir),first);
    await rm(path.join(dir,'server.mjs')); assert.notEqual(await fingerprint(dir),first);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('HTTP restart is token protected and replaces the server at the same address', {timeout:30000}, async()=>{
  const {spawn}=await import('node:child_process');
  const {once}=await import('node:events');
  const net=await import('node:net');
  const dir=await mkdtemp(new URL('../.test-restart-http-',import.meta.url));
  const reservation=net.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,HOME:dir,UWE_CODEX_SOURCE_HOME:'',UWE_PORT:String(port),UWE_WORKSPACE:path.join(dir,'workspace'),UWE_DATA_ROOT:path.join(dir,'data')},stdio:'ignore'});
  const exited=once(child,'exit');
  const url=`http://127.0.0.1:${port}/api`;
  async function ready(previous) {
    for(let i=0;i<200;i++) {
      try {const r=await fetch(url+'/updates');const s=await r.json();if(r.ok && s.instanceId!==previous)return s;}catch{}
      if(child.exitCode!==null)throw Error('Server exited');
      await new Promise(r=>setTimeout(r,50));
    }
    throw Error('Server did not become ready');
  }
  try {
    const first=await ready();assert.equal(first.restartRequired,false);assert.equal(first.activeCount,0);
    const denied=await fetch(url+'/updates/restart',{method:'POST',body:'{}'});assert.equal(denied.status,403);
    const boot=await (await fetch(url+'/bootstrap')).json();
    const response=await fetch(url+'/updates/restart',{method:'POST',headers:{'content-type':'application/json','x-uwe-token':boot.token},body:'{}'});
    assert.deepEqual(await response.json(),{restarting:true});
    const second=await ready(first.instanceId);assert.notEqual(second.instanceId,first.instanceId);assert.equal(second.restartRequired,false);
  }finally{child.kill();await exited;await rm(dir,{recursive:true,force:true});}
});

test('UI builds and development metadata only need reload; runtime changes need restart', async () => {
  const {serverFingerprint} = await import('../updates.mjs');
  const {mkdir} = await import('node:fs/promises');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'update-boundary-'));
  try {
    for (const name of ['wrapper/ui', 'backend', 'system', 'core']) await mkdir(path.join(dir, name), {recursive:true});
    const put = (name, content) => writeFile(path.join(dir, name), content);
    const manifest = {version:'1', dependencies:{react:'1'}, devDependencies:{vite:'1'}};
    await put('wrapper/package.json', JSON.stringify(manifest));
    for (const file of ['statistics-data', 'appearance', 'tool-content', 'artifact-content', 'agent-avatars', 'connection-catalog']) await put(`wrapper/ui/${file}.mjs`, 'original');
    await put('wrapper/server.mjs', 'original');
    const original = await serverFingerprint(dir);
    await put('wrapper/build.mjs', 'new build');
    await put('wrapper/package-lock.json', JSON.stringify({packages:{'node_modules/vite':{dev:true,version:'2'}}}));
    await put('wrapper/ui/design-system.mjs', 'new colors');
    await put('wrapper/ui/app.jsx', 'new layout');
    await put('wrapper/package.json', JSON.stringify({...manifest, version:'2', devDependencies:{vite:'2'}}));
    assert.equal(await serverFingerprint(dir), original);
    for (const file of ['wrapper/server.mjs', 'wrapper/ui/statistics-data.mjs', 'wrapper/ui/artifact-content.mjs', 'core/app.py']) {
      await put(file, 'changed');
      assert.notEqual(await serverFingerprint(dir), original, file);
      if (file === 'core/app.py') await rm(path.join(dir, file)); else await put(file, 'original');
    }
    await put('wrapper/package-lock.json', JSON.stringify({packages:{'node_modules/react':{version:'2'}}}));
    assert.notEqual(await serverFingerprint(dir), original);
    await put('wrapper/package-lock.json', '{}');
    await put('wrapper/package.json', JSON.stringify({...manifest, dependencies:{react:'2'}}));
    assert.notEqual(await serverFingerprint(dir), original);
  } finally { await rm(dir, {recursive:true, force:true}); }
});
