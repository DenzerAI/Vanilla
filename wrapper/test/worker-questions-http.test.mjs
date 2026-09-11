import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// A real stdio peer deliberately holds its turn until the original RPC is answered.
const peer = `
if (!process.argv.includes('features.default_mode_request_user_input=true')) process.exit(2);
const {createInterface}=require('node:readline');
const send=m=>process.stdout.write(JSON.stringify(m)+'\\n');
const threads=new Map();let thread,requestId=70,pending,pendingThread;
createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line),p=m.params||{},reply=result=>send({id:m.id,result});
 if(!m.method){if(pending&&m.id===requestId){
  pending.items.push({id:'result',type:'agentMessage',text:JSON.stringify(m.result)});pending.status='completed';
  send({method:'turn/completed',params:{threadId:pendingThread.id,turn:pending}});pending=null;
 }return;}
 if(m.method==='initialize')return reply({userAgent:'Question fixture'});
 if(m.method==='model/list')return reply({data:[{model:'fixture-model',displayName:'Fixture',isDefault:true}]});
 if(m.method==='account/read')return reply({});
 if(m.method==='mcpServerStatus/list')return reply({data:[]});
 if(m.method==='thread/start'){thread={id:require('node:crypto').randomUUID(),turns:[],model:'fixture-model'};threads.set(thread.id,thread);return reply({thread,model:'fixture-model'});}
 if(m.method==='thread/read'||m.method==='thread/resume')return reply({thread:threads.get(p.threadId)});
 if(m.method==='turn/start'){
  const thread=threads.get(p.threadId);pendingThread=thread;
  const turn={id:require('node:crypto').randomUUID(),status:'inProgress',items:[{id:'user',type:'userMessage',content:p.input}]};
  thread.turns.push(turn);pending=turn;reply({turn});requestId++;
  setTimeout(()=>send({id:requestId,method:'item/tool/requestUserInput',params:{threadId:thread.id,turnId:turn.id,questions:[{id:'scope',question:'Which scope?',options:[{label:'One'},{label:'Two'}]}]}}),15);return;
 }
 if(m.method==='turn/interrupt'&&pending){pending.status='interrupted';reply({});send({method:'turn/completed',params:{threadId:pendingThread.id,turn:pending}});pending=null;return;}
 if(m.id!==undefined)reply({});
});`;

test('HTTP → pending native RPC → reply → completed turn and persistent question receipt', {timeout:15000},async t=>{
 const dir=await mkdtemp(fileURLToPath(new URL('../.test-question-http-',import.meta.url)));
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
 const {thread}=await api('/chats',{mode:'default',title:'Question fixture'});await api('/turn',{id:thread.id,text:'Ask a fixture question',mode:'default'});
 const request=await wait(async()=> (await api('/bootstrap')).requests[0]);
 assert.equal(request.params.threadId,thread.id);
 const waiting=await api('/thread?id='+thread.id);assert.equal(waiting.thread.turns.length,1);assert.equal(waiting.thread.turns[0].status,'inProgress');
 assert.equal((await fetch(base+'/respond',{method:'POST',body:JSON.stringify({id:request.id,result:{}})})).status,403);
 const result={answers:{scope:{answers:['Custom scope']}}};await api('/respond',{id:request.id,result});
 assert.notEqual((await raw('/respond',{id:request.id,result})).status,200);
 const completed=await wait(async()=>{const r=await api('/thread?id='+thread.id);return r.thread.turns[0].items.some(i=>i.tool==='Rückfrage beantwortet')&&r.thread.turns[0].status==='completed'&&r;});
 assert.equal(completed.thread.turns.length,1);
 assert.ok(completed.thread.turns[0].items.some(i=>i.type==='agentMessage'&&i.text===JSON.stringify(result)));
 assert.equal(completed.thread.turns[0].items.find(i=>i.tool==='Rückfrage beantwortet').result.content[0].text,'Which scope?\nCustom scope');
 assert.equal((await api('/bootstrap')).requests.length,0);
 await api('/turn',{id:thread.id,text:'Another fixture question',mode:'default'});
 const cancelled=await wait(async()=> (await api('/bootstrap')).requests[0]);
 await api('/stop',{id:thread.id});await wait(async()=>!(await api('/bootstrap')).requests.length);
 assert.notEqual((await raw('/respond',{id:cancelled.id,result})).status,200);
});
