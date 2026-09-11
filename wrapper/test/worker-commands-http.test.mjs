import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const peer = `
const {createInterface}=require('node:readline');
const send=m=>process.stdout.write(JSON.stringify(m)+'\\n');
const threads=new Map(),goals=new Map();let calls=[];
createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line),p=m.params||{},reply=result=>send({id:m.id,result});
 if(!m.method)return;
 if(m.method==='initialize')return reply({userAgent:'Commands fixture'});
 if(m.method==='model/list')return reply({data:[{model:'fixture-model',displayName:'Fixture',isDefault:true}]});
 if(m.method==='account/read')return reply({});
 if(m.method==='mcpServerStatus/list')return reply({data:[]});
 if(m.method==='skills/list')return reply({data:[{cwd:p.cwds[0],skills:[{name:'fresh-skill',description:'New native skill',path:p.cwds[0]+'/SKILL.md',enabled:true}]}]});
 if(m.method==='thread/start'){const thread={id:require('node:crypto').randomUUID(),turns:[],model:'fixture-model'};threads.set(thread.id,thread);return reply({thread,model:'fixture-model'});}
 if(m.method==='thread/read'||m.method==='thread/resume')return reply({thread:threads.get(p.threadId)});
 if(m.method==='thread/goal/set'){
  if(p.objective==='reject')return send({id:m.id,error:{message:'Native goal rejected'}});
  const goal={...(goals.get(p.threadId)||{}),...p};goals.set(p.threadId,goal);calls.push(m.method);return reply({goal});
 }
 if(m.method==='thread/goal/get')return reply({goal:goals.get(p.threadId)||null});
 if(m.method==='thread/goal/clear'){const cleared=goals.delete(p.threadId);return reply({cleared});}
 if(m.method==='turn/start'){
  const thread=threads.get(p.threadId);
  const turn={id:require('node:crypto').randomUUID(),status:'inProgress',items:[{id:'user',type:'userMessage',content:p.input},{id:'result',type:'agentMessage',text:JSON.stringify({calls,goal:goals.get(p.threadId),mode:p.collaborationMode.mode,sandbox:p.sandboxPolicy})}]};
  thread.turns.push(turn);reply({turn});
  setTimeout(()=>{turn.status='completed';send({method:'turn/completed',params:{threadId:thread.id,turn}});},30);return;
 }
 if(m.id!==undefined)reply({});
});`;

test('HTTP slash dispatch uses native goals, fresh skills, plan policy and durable delivery once', {timeout:20000},async t=>{
 const dir=await mkdtemp(fileURLToPath(new URL('../.test-commands-http-',import.meta.url)));
 let child,exited;
 t.after(async()=>{if(child&&child.exitCode===null){child.kill();await exited;}await rm(dir,{recursive:true,force:true});});
 const binary=path.join(dir,'peer.cjs');await writeFile(binary,`#!${process.execPath}\n${peer}`,{mode:0o700});
 await mkdir(path.join(dir,'company'));await writeFile(path.join(dir,'company/AGENTS.md'),'# Fixture');await writeFile(path.join(dir,'company/FIRMA.md'),'# Fictional fixture');
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{PATH:process.env.PATH,HOME:dir,UWE_PORT:String(port),UWE_WORKSPACE:path.join(dir,'workspace'),UWE_DATA_ROOT:path.join(dir,'data'),COMPANY_BASE:path.join(dir,'company'),UWE_CODEX_BINARY:binary},stdio:['ignore','pipe','pipe']});
 exited=once(child,'exit');let diagnostics='';child.stderr.on('data',v=>diagnostics+=v);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test startup timeout')),7000);child.stdout.on('data',v=>{if(String(v).includes('Agent läuft')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(Error(diagnostics));});});
 const base=`http://127.0.0.1:${port}/api`;const boot=await (await fetch(base+'/bootstrap')).json();
 const raw=(url,body)=>fetch(base+url,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-uwe-token':boot.token},...(body?{body:JSON.stringify(body)}:{})});
 const api=async(url,body)=>{const r=await raw(url,body),result=await r.json();assert.equal(r.status,200,result.error);return result;};
 const wait=async predicate=>{for(let i=0;i<100;i++){const v=await predicate();if(v)return v;await new Promise(r=>setTimeout(r,20));}throw Error('Fixture timeout');};
 await api('/workers/connect',{id:'codex'});
 const {thread}=await api('/chats',{mode:'default',title:'Commands fixture'});
 const id=thread.id;
 const catalog=await api('/worker-commands?id='+id+'&workerId=codex');
 assert.ok(catalog.commands.some(c=>c.name==='fresh-skill'));
 const waitIdle=()=>wait(async()=> !(await api('/bootstrap')).active[id]);
 const delivery={clientMessageId:'goal-message-0001',localId:id,id,text:'/ziel Verify the fixture',attachments:[],model:'fixture-model',mode:'default',projectId:'default'};
 await api('/delivery',delivery);await api('/delivery',delivery);
 await wait(async()=> (await api('/delivery?clientMessageId='+delivery.clientMessageId)).status==='started');
 await waitIdle();
 let history=(await api('/thread?id='+id)).thread;
 assert.equal(history.turns.length,1);
 const result=JSON.parse(history.turns[0].items.find(i=>i.type==='agentMessage').text);
 assert.deepEqual(result.calls,['thread/goal/set']);
 assert.equal(result.goal.objective,'Verify the fixture');
 assert.equal(history.turns[0].items[0].content[0].text,'/goal Verify the fixture');
 assert.match((await api('/worker-command',{id,workerId:'codex',text:'/goal'})).message,/Verify the fixture/);
 await api('/worker-command',{id,workerId:'codex',text:'/ziel pause'});
 assert.equal((await api('/worker-command',{id,workerId:'codex',text:'/goal'})).goal.status,'paused');
 await api('/turn',{id,text:'/goal resume',mode:'default'});await waitIdle();
 assert.equal((await api('/thread?id='+id)).thread.turns.length,2);
 assert.equal((await api('/worker-command',{id,workerId:'codex',text:'/goal'})).goal.status,'active');
 await api('/worker-command',{id,workerId:'codex',text:'/goal clear'});
 assert.equal((await api('/worker-command',{id,workerId:'codex',text:'/goal'})).goal,null);
 assert.notEqual((await raw('/worker-command',{id,workerId:'claw-code',text:'/goal clear'})).status,200);
 assert.notEqual((await fetch(base+'/worker-command',{method:'POST',body:JSON.stringify({id,workerId:'codex',text:'/goal clear'})})).status,200);
 assert.notEqual((await raw('/turn',{id,text:'/goal reject',mode:'default'})).status,200);
 assert.equal((await api('/thread?id='+id)).thread.turns.length,2);
 assert.notEqual((await raw('/turn',{id,text:'/login',mode:'default'})).status,200);
 await api('/turn',{id,text:'/plan Read the fixture',mode:'default'});await waitIdle();
 history=(await api('/thread?id='+id)).thread;
 const planned=JSON.parse(history.turns.at(-1).items.find(i=>i.type==='agentMessage').text);
 assert.equal(planned.mode,'plan');assert.equal(planned.sandbox.type,'readOnly');
 await api('/turn',{id,text:'/fresh-skill Do it',mode:'default'});await waitIdle();
 history=(await api('/thread?id='+id)).thread;
 assert.ok(history.turns.at(-1).items[0].content.some(i=>i.type==='skill'&&i.name==='fresh-skill'));
});
