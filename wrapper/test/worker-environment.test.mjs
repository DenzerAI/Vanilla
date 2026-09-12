import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {workerEnvironment,installationEnvironment} from '../worker-environment.mjs';

test('only OS plumbing crosses the launcher boundary; profiles stay local',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'neutral-worker-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const filtered=workerEnvironment({PATH:'/bin',LANG:'de_DE',OPENAI_API_KEY:'synthetic-key',ANTHROPIC_AUTH_TOKEN:'synthetic-token',CODEX_HOME:'/foreign',HOME:'/foreign',HTTPS_PROXY:'synthetic-proxy'});
  assert.deepEqual(filtered,{PATH:'/bin',LANG:'de_DE'});
  const env=await installationEnvironment(dir);
  assert.ok(Object.values(env).every(value=>value.startsWith(dir) || value.startsWith('/private'+dir)));
  assert.ok(env.CODEX_HOME.endsWith('/codex'));
  const foreign=await mkdtemp(path.join(os.tmpdir(),'foreign-profile-'));
  t.after(()=>rm(foreign,{recursive:true,force:true}));
  await writeFile(path.join(foreign,'auth.json'),'synthetic');
  await symlink(path.join(foreign,'auth.json'),path.join(dir,'codex/auth.json'));
  await assert.rejects(installationEnvironment(dir),/fremden Anschluss/);
});

test('provider-specific startup excludes unrelated profiles but still checks its own and shared home', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'scoped-worker-'));
  const foreign=await mkdtemp(path.join(os.tmpdir(),'external-worker-'));
  t.after(()=>Promise.all([rm(dir,{recursive:true,force:true}),rm(foreign,{recursive:true,force:true})]));
  await installationEnvironment(dir);
  await writeFile(path.join(foreign,'auth.json'),'synthetic');
  await symlink(path.join(foreign,'auth.json'),path.join(dir,'codex/auth.json'));
  const env=await installationEnvironment(dir,'claw-code');
  assert.ok(env.CLAUDE_CONFIG_DIR.endsWith('/claude'));
  assert.equal(env.CODEX_HOME,undefined);
  assert.equal(env.HERMES_HOME,undefined);
  await assert.rejects(installationEnvironment(dir,'codex'),/fremden Anschluss/);
  await symlink(path.join(foreign,'auth.json'),path.join(dir,'claude/auth.json'));
  await assert.rejects(installationEnvironment(dir,'claw-code'),/fremden Anschluss/);
  await rm(path.join(dir,'claude/auth.json'));
  await symlink(foreign,path.join(dir,'worker-home/external'));
  await assert.rejects(installationEnvironment(dir,'claw-code'),/fremden Anschluss/);
});


test('service credentials require an explicit local selector and stay with their provider', async () => {
 const root=await mkdtemp(path.join(os.tmpdir(),'worker-auth-'));
 try {
  const environment={ANTHROPIC_API_KEY:'test-service-value'};
  assert.equal((await installationEnvironment(root,'claw-code',environment)).ANTHROPIC_API_KEY,undefined);
  await writeFile(path.join(root,'worker-auth.json'),JSON.stringify({version:1,environment:{'claw-code':'api-key'}}));
  assert.equal((await installationEnvironment(root,'claw-code',environment)).ANTHROPIC_API_KEY,environment.ANTHROPIC_API_KEY);
  assert.equal((await installationEnvironment(root,'codex',environment)).ANTHROPIC_API_KEY,undefined);
  await assert.rejects(installationEnvironment(root,'claw-code',{}),/konfigurierte Claude-Zugang fehlt/);
 } finally {await rm(root,{recursive:true,force:true});}
});

test('OAuth service bindings reject malformed selectors and external binding files', async t => {
 const root=await mkdtemp(path.join(os.tmpdir(),'worker-oauth-'));
 const foreign=await mkdtemp(path.join(os.tmpdir(),'foreign-auth-'));
 t.after(()=>Promise.all([rm(root,{recursive:true,force:true}),rm(foreign,{recursive:true,force:true})]));
 const file=path.join(root,'worker-auth.json'),environment={CLAUDE_CODE_OAUTH_TOKEN:'synthetic',ANTHROPIC_API_KEY:'unselected'};
 await writeFile(file,JSON.stringify({version:1,environment:{'claw-code':'oauth'}}));
 const env=await installationEnvironment(root,'claw-code',environment);
 assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN,'synthetic');assert.equal(env.ANTHROPIC_API_KEY,undefined);
 for(const value of [null,[],{version:2,environment:{}},{version:1,environment:[]},{version:1,environment:{'claw-code':'PATH'}}]) {
  await writeFile(file,JSON.stringify(value));
  await assert.rejects(installationEnvironment(root,'claw-code',environment),/Unbekannt/);
 }
 await rm(file); await writeFile(path.join(foreign,'auth.json'),'{}');
 await symlink(path.join(foreign,'auth.json'),file);
 await assert.rejects(installationEnvironment(root,'claw-code',environment),/außerhalb/);
});

test('native Codex executable aliases survive a subsequent startup without admitting profile links', async t => {
 const root=await mkdtemp(path.join(os.tmpdir(),'native-shim-'));
 const foreign=await mkdtemp(path.join(os.tmpdir(),'native-binary-'));
 t.after(()=>Promise.all([rm(root,{recursive:true,force:true}),rm(foreign,{recursive:true,force:true})]));
 await installationEnvironment(root,'codex');
 const dir=path.join(root,'codex/tmp/arg0/codex-argFixture'),binary=path.join(foreign,'codex');
 await mkdir(dir,{recursive:true}); await writeFile(binary,'synthetic executable',{mode:0o700});
 for(const name of ['applypatch','apply_patch','codex-execve-wrapper'])await symlink(binary,path.join(dir,name));
 await installationEnvironment(root,'codex');
 await symlink(binary,path.join(root,'codex/auth.json'));
 await assert.rejects(installationEnvironment(root,'codex'),/fremden Anschluss/);
 await rm(path.join(root,'codex/auth.json'));
 await symlink(foreign,path.join(dir,'profile'));
 await assert.rejects(installationEnvironment(root,'codex'),/fremden Anschluss/);
 await rm(path.join(dir,'profile'));await rm(path.join(dir,'apply_patch'));
 await writeFile(path.join(foreign,'auth.json'),'synthetic');await symlink(path.join(foreign,'auth.json'),path.join(dir,'apply_patch'));
 await assert.rejects(installationEnvironment(root,'codex'),/fremden Anschluss/);
});

test('explicit existing profile bindings retain native links and reject retargeting or cross-provider reuse', async t => {
 const root=await mkdtemp(path.join(os.tmpdir(),'bound-profile-')), foreign=await mkdtemp(path.join(os.tmpdir(),'own-native-'));
 t.after(()=>Promise.all([rm(root,{recursive:true,force:true}),rm(foreign,{recursive:true,force:true})]));
 await installationEnvironment(root,'codex');
 const {realpath,readlink}=await import('node:fs/promises');
 const auth=path.join(foreign,'auth.json'),other=path.join(foreign,'other.json');
 await writeFile(auth,'synthetic');await writeFile(other,'different');
 const native=await realpath(auth),link=path.join(root,'codex/auth.json');
 await symlink(native,link);await assert.rejects(installationEnvironment(root,'codex'),/fremden Anschluss/);
 await writeFile(path.join(root,'worker-auth.json'),JSON.stringify({version:1,profileLinks:{codex:{'auth.json':native}}}));
 await installationEnvironment(root,'codex');assert.equal(await readlink(link),native);
 await writeFile(auth,'refreshed');await installationEnvironment(root,'codex');
 await installationEnvironment(root,'claw-code');await symlink(native,path.join(root,'claude/auth.json'));
 await assert.rejects(installationEnvironment(root,'claw-code'),/fremden Anschluss/);
 await rm(link);await symlink(other,link);await assert.rejects(installationEnvironment(root,'codex'),/fremden Anschluss/);
 await writeFile(path.join(root,'worker-auth.json'),JSON.stringify({version:1,profileLinks:{codex:{'../worker-home/auth.json':native}}}));
 await assert.rejects(installationEnvironment(root,'codex'),/Profilbindung/);
});

test('SwiftPM config and cache links from a build in the worker home are tolerated, other Library links are not', async t => {
 const root=await mkdtemp(path.join(os.tmpdir(),'swift-shim-')), library=await mkdtemp(path.join(os.tmpdir(),'Library-'));
 t.after(()=>Promise.all([rm(root,{recursive:true,force:true}),rm(library,{recursive:true,force:true})]));
 await installationEnvironment(root,'codex');
 const swift=path.join(root,'worker-home/.config/swiftpm'); await mkdir(swift,{recursive:true});
 for(const [name,target] of [['configuration','Library/org.swift.swiftpm/configuration'],['security','Library/org.swift.swiftpm/security'],['cache','Library/Caches/org.swift.swiftpm']]) {
  await mkdir(path.join(library,target),{recursive:true}); await symlink(path.join(library,target),path.join(swift,name));
 }
 await installationEnvironment(root,'codex');
 await mkdir(path.join(library,'Library/Keychains'),{recursive:true});
 await symlink(path.join(library,'Library/Keychains'),path.join(swift,'keys'));
 await assert.rejects(installationEnvironment(root,'codex'),/fremden Anschluss/);
});
