import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, cp, symlink, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';

// Start the actual entrypoint with copied SOURCE ONLY and a synthetic HOME/state.
test('actual order HTTP routes protect data and downloads; legitimate synthetic client works', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'order-http-synthetic-'));
  t.after(() => rm(root, { recursive:true, force:true }));
  for (const dir of ['backend','frontend','soul','brain','skills','data/artifacts/run-test']) await mkdir(path.join(root,dir), {recursive:true});
  for (const name of ['server','security','artifacts','store','bootstrap','company-base','worker-context','hero-client','whatsapp-bridge'])
    await copyFile(new URL(`../backend/${name}.mjs`, import.meta.url),path.join(root,'backend',`${name}.mjs`));
  await mkdir(path.join(root, 'wrapper'));
  for (const name of ['isolation', 'identity-preferences'])
    await copyFile(new URL(`../wrapper/${name}.mjs`, import.meta.url), path.join(root, 'wrapper', `${name}.mjs`));
  await mkdir(path.join(root, 'workspaces/default/soul'), {recursive:true});
  await writeFile(path.join(root, 'workspaces/default/soul/IDENTITY.md'), 'Anzeigename: Synthetic');
  await cp(new URL('../system', import.meta.url), path.join(root, 'system'), {recursive:true});
  await cp(new URL('../firmenbasis', import.meta.url), path.join(root, 'firmenbasis'), {recursive:true});
  await symlink(new URL('../node_modules',import.meta.url).pathname,path.join(root,'node_modules'));
  await writeFile(path.join(root,'brain/learnings.ndjson'),'');
  await writeFile(path.join(root,'frontend/index.html'),'synthetic UI');
  await writeFile(path.join(root,'data/artifacts/run-test/test.txt'),'synthetic artifact');
  for (const token of ['', 'synthetic-main-token-'.repeat(3)]) {
    const child = spawn(process.execPath, [path.join(root,'backend/server.mjs')], {
      env:{PATH:process.env.PATH,HOME:root,HOST:'127.0.0.1',PORT:'0',ORDER_SYSTEM_TOKEN:token,
        TAILSCALE_BASE_URL:'http://example.invalid',WHATSAPP_AUTO_START:'false'},stdio:['ignore','pipe','pipe'],
    });
    const exited = once(child,'exit');
    t.after(()=>child.kill());
    const url = await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('synthetic server startup timeout')),10000);
      child.stdout.on('data',data=>{const m=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});
      child.once('error',reject);
    });
    for (const route of ['/api/health','/api/orders','/api/people','/api/whatsapp/status','/api/bootstrap/test','/api/company-base?file=AGENTS.md','/artifacts/run-test/test.txt']) {
      for (const authorization of ['', 'Bearer synthetic-invalid','Basic '+token]) {
        const r=await fetch(url+route,{headers:{authorization}});
        assert.equal(r.status,token?401:503,route);await r.text();
      }
    }
    if (token) {
      const headers={authorization:'Bearer '+token,'content-type':'application/json'};
      const bootstrap=await (await fetch(url+'/api/bootstrap/test',{headers})).json();
      assert.equal(bootstrap.bootstrap.skills[0].path,'report-result/SKILL.md');
      const workflow=await (await fetch(url+bootstrap.bootstrap.skills[0].endpoint,{headers})).json();
      assert.match(workflow.content,/name: report-result/);
      assert.equal((await fetch(url+'/api/company-base?file=..%2FREADME.md',{headers})).status,404);
      const r=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify({title:'synthetic',instructions:'synthetic'})});
      assert.equal(r.status,201);const created=await r.json();
      assert.equal((await fetch(url+'/api/orders/'+created.order.id,{headers})).status,200);
      const file=await fetch(url+'/artifacts/run-test/test.txt',{headers});assert.equal(file.status,200);
      assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.equal(await file.text(),'synthetic artifact');
      assert.equal((await fetch(url+'/artifacts/run-test/.env',{headers})).status,404);
    }
    assert.equal((await fetch(url+'/')).status,200);
    child.kill();await exited;
  }
});
