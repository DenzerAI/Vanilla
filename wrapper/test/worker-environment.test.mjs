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
