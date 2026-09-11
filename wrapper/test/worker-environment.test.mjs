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
