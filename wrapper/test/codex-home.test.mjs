import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {prepareCodexHome} from '../codex-home.mjs';

test('new Codex home stays empty and old host import arguments fail explicitly',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'neutral-codex-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const home=path.join(root,'own'),sourceHome=path.join(root,'foreign');
  await mkdir(sourceHome);await writeFile(path.join(sourceHome,'auth.json'),'synthetic-host-account');
  const first=await prepareCodexHome({home});
  assert.deepEqual(first.imported,[]);assert.deepEqual(await readdir(home),[]);
  await assert.rejects(prepareCodexHome({home,sourceHome}),/nicht importiert/);
  assert.equal(await readFile(path.join(sourceHome,'auth.json'),'utf8'),'synthetic-host-account');
  assert.deepEqual(await readdir(home),[]);
  await writeFile(path.join(home,'config.toml'),'# Own installation configuration');
  await prepareCodexHome({home});
  assert.equal(await readFile(path.join(home,'config.toml'),'utf8'),'# Own installation configuration');
});
