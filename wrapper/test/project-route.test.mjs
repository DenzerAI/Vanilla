import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

test('project HTTP route retains selected color and icon across server restart', {timeout:60000}, async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'project-http-'));
  const reservation=net.createServer(); reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port=reservation.address().port; await new Promise(r=>reservation.close(r));
  let child, exited;
  const start=async()=>{
    child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,UWE_PORT:String(port),UWE_WORKSPACE:path.join(dir,'workspace'),UWE_DATA_ROOT:path.join(dir,'data')},stdio:['ignore','pipe','pipe']});
    exited=once(child,'exit');
    for(let i=0;i<200;i++){
      try{const r=await fetch(`http://127.0.0.1:${port}/api/chats`);if(r.ok)return;}catch{}
      if(child.exitCode!==null)throw Error('Test server exited');
      await new Promise(r=>setTimeout(r,50));
    }
    throw Error('Test server did not start');
  };
  const get=async route=>(await fetch(`http://127.0.0.1:${port}/api/${route}`)).json();
  const stop=async()=>{child.kill();await exited;};
  try{
    await start();let boot=await get('bootstrap');
    const save=async body=>{
      const r=await fetch(`http://127.0.0.1:${port}/api/projects/save`,{method:'POST',headers:{'Content-Type':'application/json','x-uwe-token':boot.token},body:JSON.stringify(body)});
      assert.equal(r.status,200);return r.json();
    };
    let result=await save({name:'Farbtest',icon:'globe',color:'purple'});
    assert.equal(result.project.color,'purple');const id=result.project.id;
    result=await save({id,name:'Farbtest',icon:'idea',color:'green'});
    assert.equal(result.project.color,'green');assert.equal(result.project.icon,'idea');
    await save({id:'default',name:'Allgemein',icon:'code',color:'blue'});
    await stop();await start();boot=await get('bootstrap');
    assert.equal(boot.projects.find(p=>p.id===id).color,'green');
    assert.equal(boot.projects.find(p=>p.id===id).icon,'idea');
    assert.equal(boot.projects.find(p=>p.id==='default').color,'blue');
    const disk=JSON.parse(await readFile(path.join(dir,'workspace','projects',id,'project.json'),'utf8'));
    assert.equal(disk.color,'green');
  }finally{if(child?.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
