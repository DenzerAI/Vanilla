import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import path from 'node:path';

test('search HTTP route reads saved sessions without starting a turn', {timeout:30000}, async () => {
  const dir = await mkdtemp(new URL('../.test-search-http-', import.meta.url));
  const reservation = net.createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port = reservation.address().port; await new Promise(resolve=>reservation.close(resolve));
  let child, exited;
  try {
    const workspace = path.join(dir,'workspace'), data = path.join(dir,'data');
    await mkdir(path.join(workspace,'chats','example'),{recursive:true}); await mkdir(data);
    await writeFile(path.join(data,'state.json'),JSON.stringify({chats:[{id:'example',title:'Budgetrunde',projectId:'default'}],settings:{name:'Test'},connections:[],secrets:[]}));
    await writeFile(path.join(workspace,'chats','example','transcript.json'),JSON.stringify({id:'example',turns:[{items:[{type:'userMessage',content:[{type:'text',text:'Die Finanzierung ist freigegeben.'}]}]}]}));
    child = spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,HOME:dir,UWE_CODEX_SOURCE_HOME:'',UWE_PORT:String(port),UWE_WORKSPACE:workspace,UWE_DATA_ROOT:data},stdio:['ignore','pipe','pipe']});
    exited = once(child,'exit');
    let response;
    for (let i=0;i<200;i++) {
      try { response = await fetch(`http://127.0.0.1:${port}/api/search?q=Finanzierugn`); if(response.ok) break; } catch {}
      if (child.exitCode !== null) throw Error('Search test server exited');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(response?.status,200);
    const result = await response.json();
    assert.equal(result.total,1); assert.equal(result.results[0].id,'example');
    assert.match(result.results[0].snippet,/Finanzierung/);
    const state = await (await fetch(`http://127.0.0.1:${port}/api/chats`)).json();
    assert.deepEqual(state.active,{}); assert.equal(state.chats.length,1);
  } finally { if(child?.exitCode===null) {child.kill();await exited;} await rm(dir,{recursive:true,force:true}); }
});
