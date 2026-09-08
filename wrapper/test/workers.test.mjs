import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Workers, findWorkerCommand } from "../workers.mjs";
import { ACPWorker } from "../acp-worker.mjs";
import { Storage } from "../storage.mjs";
import { workerCatalog } from "../../system/worker-catalog.mjs";
import { workerInstructions } from "../../backend/worker-context.mjs";
import { sharedSkills } from "../shared-skills.mjs";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

async function fixture(t, {beforeCleanup} = {}) {
  const dir = await mkdtemp(fileURLToPath(new URL("../.test-worker-contract-", import.meta.url)));
  t.after(async () => { await beforeCleanup?.(); await rm(dir, { recursive: true, force: true }); });
  const store = new Storage(path.join(dir, "workspace"), path.join(dir, "data")); await store.init();
  return { dir, store };
}
class Adapter extends EventEmitter {
  connected = false; requests = new Map(); calls = [];
  async start() { if (this.fail) throw new Error("Nicht erreichbar"); this.connected = true; }
  async call(method, p) { this.calls.push([method, p]); if (this.failCall) throw new Error("Abgebrochen nach Annahme"); return {}; }
  stop() { this.connected = false; this.emit("disconnected", { message: "Getrennt" }); }
}
test("catalog separates all requested workers and discovers configured executables without shell", async t => {
  const {dir} = await fixture(t);
  assert.deepEqual(workerCatalog.map(w => w.id), ["codex", "hermes", "openclaw", "claw-code"]);
  const executable = path.join(dir, "worker with spaces"); await writeFile(executable, "#!/bin/sh\nexit 0", { mode: 0o700 });
  assert.equal(await findWorkerCommand(workerCatalog[1], { UWE_HERMES_BINARY: executable }), executable);
  assert.equal(await findWorkerCommand(workerCatalog[1], { UWE_HERMES_BINARY: "/missing; echo bad" }), null);
});
test("automatic fallback happens before dispatch; pinned chats and explicit jobs never switch", async t => {
  const { store } = await fixture(t), primary = new Adapter(), backup = new Adapter();
  const workers = new Workers({ store, root: store.root, codex: primary, resolveCommand: async () => process.execPath, makeACP: () => backup });
  await workers.init(); await workers.connect("hermes"); await workers.preferences({ defaultWorker: "codex", fallbackWorker: "hermes" });
  primary.fail = true;
  assert.equal((await workers.select()).id, "hermes");
  await assert.rejects(workers.select("codex"), /Nicht erreichbar/);
  await assert.rejects(workers.select("auto", { mode: "plan" }), /Planmodus/);
  store.state.chats.push({ id: "old" });
  await assert.rejects(workers.call("turn/start", { threadId: "old" }), /Nicht erreichbar/);
  assert.equal(backup.calls.length, 0);
  primary.fail = false; primary.failCall = true;
  await assert.rejects(workers.call("turn/start", { threadId: "old" }), /nach Annahme/);
  assert.equal(backup.calls.length, 0);
});
test("worker preferences survive restart; failed connection never enables an unavailable worker", async t => {
  const { store } = await fixture(t), primary = new Adapter();
  const workers = new Workers({ store, root: store.root, codex: primary, resolveCommand: async () => null }); await workers.init();
  await assert.rejects(workers.connect("hermes"), /Programm nicht gefunden/);
  assert.deepEqual(workers.settings.enabled, ["codex"]);
  await assert.rejects(workers.preferences({ defaultWorker: "hermes" }), /zuerst verbinden/);
  await workers.preferences({ defaultWorker: "codex", fallbackWorker: null });
  const reopened = new Workers({ store, root: store.root, codex: new Adapter() }); await reopened.init();
  assert.deepEqual(reopened.settings, workers.settings);
  await assert.rejects(workers.preferences({ defaultWorker: "codex", fallbackWorker: "codex" }), /anderer/);
});
test("concurrent connections share one adapter and one initialization", async t => {
  const {store} = await fixture(t); let created = 0, starts = 0;
  const worker = new Adapter(); worker.start = async () => { starts++; await new Promise(r => setTimeout(r, 15)); worker.connected = true; };
  const workers = new Workers({store, root: store.root, codex: new Adapter(), resolveCommand: async () => process.execPath, makeACP: () => { created++; return worker; }}); await workers.init();
  await Promise.all([workers.connect("hermes"), workers.connect("hermes")]);
  assert.equal(created, 1); assert.equal(starts, 1); assert.equal(workers.settings.enabled.filter(id => id === "hermes").length, 1);
});
test("each job can use the catalog and legacy worker values stay pinned", async t => {
  const {store} = await fixture(t);
  for (const worker of ["auto", "n8n", ...workerCatalog.map(w => w.id)]) {
    const job = await store.saveJob({ name: worker, worker, instructions: "Fiktiver Test" });
    assert.equal(job.worker, worker);
    assert.equal((await store.jobs()).find(j => j.id === job.id).worker, worker);
  }
});
test("fresh shared context includes company, system, identity and project without copying files", async t => {
  const {dir, store} = await fixture(t); await mkdir(path.join(dir, "firmenbasis"));
  await writeFile(path.join(dir, "firmenbasis/AGENTS.md"), "# Regeln\n[Prüfen](pruefen/SKILL.md)");
  await writeFile(path.join(dir, "firmenbasis/FIRMA.md"), "Testfirma Nord");
  const first = await workerInstructions({root: dir, workspace: store.root});
  assert.match(first, /Testfirma Nord/); assert.match(first, /So arbeitet jeder Worker/); assert.match(first, /Anzeigename: Agent/); assert.match(first, /pruefen\/SKILL.md/);
  await writeFile(path.join(dir, "firmenbasis/FIRMA.md"), "Testfirma Süd");
  assert.match(await workerInstructions({root: dir, workspace: store.root}), /Testfirma Süd/);
});
test("shared skill discovery works without an engine and follows fresh map entries", async t => {
  const {dir}=await fixture(t), base=path.join(dir,"company"); await mkdir(path.join(base,"check"),{recursive:true});
  await writeFile(path.join(base,"AGENTS.md"),"[Prüfen](check/SKILL.md)");
  await writeFile(path.join(base,"FIRMA.md"),"Testfirma");
  await writeFile(path.join(base,"check/SKILL.md"),"---\nname: check\ndescription: Fiktive Prüfung.\n---\nAnweisung");
  const result=await sharedSkills(base);assert.equal(result[0].name,"check");assert.equal(result[0].description,"Fiktive Prüfung.");
  await writeFile(path.join(base,"AGENTS.md"),"Keine Arbeitsweise ausgewählt.");assert.deepEqual(await sharedSkills(base),[]);
});
test("ACP permission replies choose only a once option; unadvertised client methods are denied", async t => {
  const {store}=await fixture(t), rpc=new EventEmitter(); rpc.write=m=>rpc.messages.push(m);rpc.messages=[];
  const adapter=new ACPWorker({id:"hermes",name:"Hermes",rpc,readThread:async()=>null,persist:async()=>{}});
  adapter.sessions.set("native","chat");adapter.running.set("chat",{id:"turn"});
  adapter.receive({id:1,method:"session/request_permission",params:{sessionId:"native",toolCall:{title:"Testdatei schreiben"},options:[{optionId:"once",kind:"allow_once"},{optionId:"always",kind:"allow_always"}]}});
  adapter.respond("hermes:1",{decision:"accept"});
  assert.deepEqual(rpc.messages.at(-1).result.outcome,{outcome:"selected",optionId:"once"});
  adapter.receive({id:2,method:"fs/write_text_file",params:{sessionId:"native",path:"/not-authorized",content:"bad"}});
  assert.equal(rpc.messages.at(-1).error.code,-32601);
  adapter.receive({id:3,method:"session/request_permission",params:{sessionId:"native",options:[{optionId:"always",kind:"allow_always"}]}});
  assert.throws(()=>adapter.respond("hermes:3",{decision:"accept"}),/einmalige/);
});

const nativeFixture = `const readline = require('node:readline');
const send = m => process.stdout.write(JSON.stringify({jsonrpc:'2.0',...m})+'\\n');
let pending; const threads = new Map();
readline.createInterface({input:process.stdin}).on('line', line => {
 const m=JSON.parse(line), p=m.params||{}; if(!m.method)return;
 if(process.env.FIXTURE_LOG)require('node:fs').appendFileSync(process.env.FIXTURE_LOG,JSON.stringify(m)+'\\n');
 const reply = result => send({id:m.id,result});
 if(m.method==='thread/start'){const thread={id:require('node:crypto').randomUUID(),turns:[],model:'fixture-model'};threads.set(thread.id,thread);return reply({thread,model:'fixture-model'});}
 if(m.method==='thread/read'||m.method==='thread/resume')return reply({thread:threads.get(p.threadId)});
 if(m.method==='turn/start'){
  const turn={id:require('node:crypto').randomUUID(),status:'completed',items:[{type:'userMessage',content:p.input},{type:'agentMessage',text:'Codex fixture result'}]};
  threads.get(p.threadId).turns.push(turn);reply({turn});
  setTimeout(()=>send({method:'turn/completed',params:{threadId:p.threadId,turn}}),30);return;
 }
 if(m.method==='initialize')return reply({userAgent:'Fixture 1',protocolVersion:1,agentCapabilities:{loadSession:true,promptCapabilities:{image:true}},agentInfo:{name:'fixture',version:'1'}});
 if(m.method==='model/list')return reply({data:[{model:'fixture-model',displayName:'Fixture',isDefault:true}]});
 if(m.method==='account/read')return reply({});
 if(m.method==='mcpServerStatus/list')return reply({data:[]});
 if(m.method==='session/new') { reply({sessionId:'native-session',models:{currentModelId:'fixture-model',availableModels:[{modelId:'fixture-model',name:'Fixture'}]}});
  send({method:'session/update',params:{sessionId:'native-session',update:{sessionUpdate:'available_commands_update',availableCommands:[{name:'inspect',description:'Inspect fixture',input:{hint:'query'}}]}}});
  send({method:'session/update',params:{sessionId:'native-session',update:{sessionUpdate:'config_option_update',configOptions:[{id:'quality',name:'Quality',type:'select',currentValue:'low',options:[{value:'low',name:'Low'},{value:'high',name:'High'}]}]}}});
  return;
 }
 if(m.method==='session/set_config_option')return reply({configOptions:[{id:'quality',name:'Quality',type:'select',currentValue:p.value,options:[{value:'low',name:'Low'},{value:'high',name:'High'}]}]});
 if(m.method==='session/load')return reply({models:{currentModelId:'fixture-model',availableModels:[{modelId:'fixture-model',name:'Fixture'}]}});
 if(m.method==='session/set_model')return reply({});
 if(m.method==='session/cancel' && pending){send({id:pending,result:{stopReason:'cancelled'}});pending=null;return;}
 if(m.method==='session/prompt'){
  const text=p.prompt.map(b=>b.text||'').join(' ');
  if(text.includes('WAIT')){pending=m.id;return;}
  if(text.includes('CRASH')){process.exit(1);return;}
  const update=u=>send({method:'session/update',params:{sessionId:p.sessionId,update:u}});
  update({sessionUpdate:'tool_call',toolCallId:'one',title:'Datei prüfen',kind:'read',status:'in_progress'});
  update({sessionUpdate:'tool_call_update',toolCallId:'one',status:'completed',content:[{type:'content',content:{type:'text',text:'OK'}}]});
  update({sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Ergebnis: '}});
  update({sessionUpdate:'agent_message_chunk',content:{type:'text',text:p.prompt[0].text.includes('FIRMA')?'Kontext erhalten':'Kontext fehlt'}});
  reply({stopReason:'end_turn'});
 }
});`;
async function acpFixture(t) {
  const {dir, store} = await fixture(t), file = path.join(dir, "worker.cjs"); await writeFile(file, nativeFixture);
  const create = () => new ACPWorker({ id:"hermes", name:"Test-Worker", command:process.execPath, args:[file], cwd:store.root,
    readThread: async id => JSON.parse(await readFile(path.join(store.root,"chats",id,"transcript.json"),"utf8")), persist: thread => store.exportThread(thread) });
  const adapter = create(); t.after(() => adapter.stop());
  return {adapter, create, store};
}
const input = text => ({ input:[{type:"text",text}], collaborationMode:{mode:"default",settings:{developer_instructions:"FIRMA: fiktiver Prüfkontext"}}, sandboxPolicy:{type:"dangerFullAccess"} });
function completion(adapter) { return new Promise(resolve => { const cb = msg => { if(msg.method === "turn/completed") {adapter.off("notification", cb); resolve(msg.params.turn);} }; adapter.on("notification", cb); }); }
test("real stdio ACP lifecycle streams tools and answers, exports only the user message and resumes", async t => {
  const {adapter, create, store} = await acpFixture(t), events=[]; adapter.on("notification", msg=>events.push(msg));
  const {thread} = await adapter.call("thread/start", {cwd:store.root});
  assert.equal(adapter.connected,true); assert.equal(adapter.models(thread)[0].model,"fixture-model");
  const done=completion(adapter); await adapter.call("turn/start", {threadId:thread.id,...input("Testauftrag")});
  assert.equal((await done).status,"completed");
  assert.ok(events.some(e=>e.method==='item/agentMessage/delta'));
  const persisted = JSON.parse(await readFile(path.join(store.root,"chats",thread.id,"transcript.json"),"utf8"));
  assert.equal(persisted.turns[0].items[0].content[0].text,"Testauftrag");
  assert.equal(persisted.turns[0].items.at(-1).text,"Ergebnis: Kontext erhalten");
  adapter.stop();
  const reopened=create(); t.after(()=>reopened.stop());
  await reopened.call("thread/resume", {threadId:thread.id,cwd:store.root});
  assert.equal((await reopened.call("thread/read",{threadId:thread.id})).thread.turns.length,1);
  const next=completion(reopened); await reopened.call("turn/start",{threadId:thread.id,...input("Fortsetzen")});
  assert.equal((await next).status,"completed");
});
test("ACP rejects unsupported planning and foreign models before dispatch; cancellation is confirmed", async t => {
  const {adapter, store}=await acpFixture(t), {thread}=await adapter.call("thread/start",{cwd:store.root});
  await assert.rejects(adapter.call("turn/start", {threadId:thread.id,...input("Test"), sandboxPolicy:{type:"readOnly"}}), /Planmodus/);
  delete adapter.threads.get(thread.id).workerSession.configOptions;
  await assert.rejects(adapter.call("turn/start", {threadId:thread.id,...input("Test"), model:"foreign"}), /Modell gehört nicht/);
  assert.equal((await adapter.call("thread/read",{threadId:thread.id})).thread.turns.length,0);
  const done=completion(adapter); await adapter.call("turn/start",{threadId:thread.id,...input("WAIT")});
  await new Promise(r=>setImmediate(r));
  await adapter.call("turn/interrupt",{threadId:thread.id});
  assert.equal((await done).status,"interrupted");
});
test("worker crash finalizes only its own turn as failed and never replays the prompt", async t => {
  const {adapter,store}=await acpFixture(t), {thread}=await adapter.call("thread/start",{cwd:store.root});
  const done=completion(adapter); await adapter.call("turn/start",{threadId:thread.id,...input("CRASH")});
  assert.equal((await done).status,"failed"); assert.equal(adapter.connected,false);
  assert.equal((await adapter.call("thread/read",{threadId:thread.id})).thread.turns.length,1);
});

test("standalone adapter preserves sessions and denies dispatch without the privacy core", {timeout:20000}, async t => {
  let child, exited, token;
  const {dir} = await fixture(t, {beforeCleanup: async () => {
    if (child && child.exitCode === null) { child.kill(); await exited; }
  }}), binary = path.join(dir,"worker.cjs");
  await writeFile(binary, `#!${process.execPath}\n${nativeFixture}`, {mode:0o700});
  await mkdir(path.join(dir,"company"));
  await writeFile(path.join(dir,"company/AGENTS.md"),"# Testregeln");
  await writeFile(path.join(dir,"company/FIRMA.md"),"FIRMA: Fiktiver Betrieb");
  const reservation=net.createServer(); await new Promise(r=>reservation.listen(0,"127.0.0.1",r));
  const port=reservation.address().port; await new Promise(r=>reservation.close(r));
  const base=`http://127.0.0.1:${port}/api`;
  async function start() {
    child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{PATH:process.env.PATH,HOME:dir,UWE_PORT:String(port),UWE_WORKSPACE:path.join(dir,'runtime'),UWE_DATA_ROOT:path.join(dir,'runtime-data'),COMPANY_BASE:path.join(dir,'company'),UWE_CODEX_BINARY:binary,UWE_HERMES_BINARY:binary,FIXTURE_LOG:path.join(dir,'wire.ndjson')},stdio:['ignore','pipe','pipe']});
    let diagnostics=''; child.stderr.on('data', data => { diagnostics += data; });
    exited=once(child,'exit');
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Testserver startet nicht')),8000);child.stdout.on('data',data=>{if(String(data).includes('Agent läuft')){clearTimeout(timer);resolve();}});child.once('exit',()=>{clearTimeout(timer);reject(new Error('Testserver beendet: '+diagnostics));});child.once('error',reject);});
    token=(await (await fetch(base+'/bootstrap')).json()).token;
  }
  async function call(route,body) {
    const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-uwe-token':token},...(body?{body:JSON.stringify(body)}:{})});
    const result=await r.json();assert.equal(r.status,200,result.error);return result;
  }
  await start();
  assert.equal((await fetch(base+'/workers/preferences',{method:'POST',body:'{}'})).status,403);
  assert.equal((await fetch(base+'/worker-session',{method:'POST',body:'{}'})).status,403);
  await call('/workers/connect',{id:'hermes'});
  await call('/workers/preferences',{defaultWorker:'auto',fallbackWorker:'hermes'});
  const autoBoot = await call('/bootstrap');
  assert.equal(autoBoot.workerSettings.defaultWorker,'auto');
  assert.equal(autoBoot.effectiveWorker,'codex');
  assert.equal((await call('/status')).engine.name,'Codex');
  assert.deepEqual((await call('/workers')).routingOrder,['codex','hermes']);

  await call('/workers/preferences',{defaultWorker:'hermes',fallbackWorker:'codex'});
  const created=await call('/chats',{mode:'default'});
  assert.equal(created.meta.workerId,'hermes');
  const session = (await call('/thread?id='+created.thread.id)).thread.workerSession;
  assert.equal(session.availableCommands[0].name, 'inspect');
  assert.equal(session.configOptions[0].currentValue, 'low');
  const configured = await call('/worker-session', {id:created.thread.id,configId:'quality',value:'high'});
  assert.equal(configured.thread.workerSession.configOptions[0].currentValue, 'high');
  const invalid = await fetch(base+'/worker-session',{method:'POST',headers:{'content-type':'application/json','x-uwe-token':token},body:JSON.stringify({id:created.thread.id,configId:'quality',value:'invented'})});
  assert.notEqual(invalid.status,200);
  const denied=await fetch(base+'/turn',{method:'POST',headers:{'content-type':'application/json','x-uwe-token':token},body:JSON.stringify({id:created.thread.id,text:'Fiktiver Test',mode:'default'})});
  assert.equal(denied.status,400);
  assert.match((await denied.json()).error,/Datenschutzprüfung/);
  const before = await call('/thread?id='+created.thread.id);
  assert.equal(before.thread.turns.length,0);
  child.kill();await exited;await start();
  assert.equal((await call('/workers')).settings.defaultWorker,'hermes');
  const after=await call('/thread?id='+created.thread.id);
  assert.equal(after.thread.workerSession.configOptions[0].currentValue,'high');
  const wire=(await readFile(path.join(dir,'wire.ndjson'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(wire.some(m=>m.method==='session/prompt'||m.method==='turn/start'),false);
  // Full dispatch, fresh context, jobs and resume are exercised through the real
  // Python privacy service in core/tests/test_integration.py.

});


test("Auto tries configured workers in stable order, reserves explicit backup and preserves pinned turns", async t => {
  const {store} = await fixture(t), codex = new Adapter();
  const adapters = new Map([['hermes',new Adapter()],['openclaw',new Adapter()]]);
  const workers = new Workers({store,root:store.root,codex,resolveCommand:async()=>process.execPath,makeACP:({id})=>adapters.get(id)});
  await workers.init(); await workers.connect('hermes'); await workers.connect('openclaw');
  await workers.preferences({defaultWorker:'auto',fallbackWorker:'hermes'});
  assert.deepEqual(workers.routingOrder(),['codex','openclaw','hermes']);
  codex.fail = true; adapters.get('openclaw').fail = true;
  const choice = await workers.select();
  assert.equal(choice.id,'hermes'); assert.equal(choice.fallbackFrom,'codex'); assert.equal(choice.failures.length,2);
  await assert.rejects(workers.select('openclaw'),/Nicht erreichbar/);
  await assert.rejects(workers.select('auto',{mode:'plan'}),/Planmodus/);
  store.state.chats.push({id:'pinned',workerId:'codex'});
  await assert.rejects(workers.call('turn/start',{threadId:'pinned'}),/Nicht erreichbar/);
  assert.equal(adapters.get('hermes').calls.length,0);
  const reloaded = new Workers({store,root:store.root,codex:new Adapter()}); await reloaded.init();
  assert.equal(reloaded.settings.defaultWorker,'auto'); assert.deepEqual(reloaded.routingOrder(),workers.routingOrder());
});
