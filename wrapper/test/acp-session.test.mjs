import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ACPWorker } from '../acp-worker.mjs';

const config = value => [{id:'custom',name:'Custom',category:'_future',type:'select',currentValue:value,options:[{group:'group',name:'Group',options:[{value:'one',name:'One'},{value:'two',name:'Two'}]}]}];
function fixture() {
  const rpc = new EventEmitter(), calls = [], saved = [], events = [];
  const worker = new ACPWorker({id:'test',name:'Fixture',rpc,readThread:async()=>saved.at(-1),persist:async thread=>saved.push(thread)});
  worker.connected = true; worker.info = {agentCapabilities:{loadSession:true,promptCapabilities:{image:false}}};
  const thread = {id:'chat',workerId:'test',turns:[],workerSession:{sessionId:'native',configOptions:config('one')}};
  worker.threads.set(thread.id,thread); worker.sessions.set('native','chat');
  worker.on('notification', e=>events.push(e));
  rpc.call = async (method,params) => {calls.push({method,params}); return {configOptions:config(params.value)};};
  rpc.write = message => calls.push(message);
  const update = u => worker.receive({method:'session/update',params:{sessionId:'native',update:u}});
  return {worker,rpc,thread,calls,saved,events,update};
}
test('idle metadata replaces lists, preserves unknown categories and reports unknown updates without private payloads', async()=>{
  const {worker,thread,update,events,saved}=fixture();
  assert.equal(worker.capabilities.attachments,false);
  update({sessionUpdate:'available_commands_update',availableCommands:[{name:'future',description:'New'}]});
  update({sessionUpdate:'available_commands_update',availableCommands:[]});
  update({sessionUpdate:'config_option_update',configOptions:config('two')});
  update({sessionUpdate:'current_mode_update',currentModeId:'native-mode'});
  update({sessionUpdate:'future_update',privateValue:'must not leak'});
  await worker.persist(thread);
  assert.deepEqual(saved.at(-1).workerSession.availableCommands,[]);
  assert.equal(saved.at(-1).workerSession.configOptions[0].currentValue,'two');
  assert.equal(thread.workerSession.modes.currentModeId,'native-mode');
  assert.deepEqual(thread.workerSession.unsupportedUpdates,['future_update']);
  assert.ok(events.every(e=>!JSON.stringify(e).includes('must not leak')));
  update({sessionUpdate:'config_option_update',configOptions:[]});
  assert.deepEqual(thread.workerSession.configOptions,[]);
});
test('config changes validate advertised grouped values, apply complete response and reject while busy', async()=>{
  const {worker,thread,calls,rpc}=fixture();
  await assert.rejects(worker.call('session/set_config_option',{threadId:'chat',configId:'custom',value:'invented'}),/nicht angeboten/);
  assert.equal(calls.length,0);
  await worker.call('session/set_config_option',{threadId:'chat',configId:'custom',value:'two'});
  assert.deepEqual(calls[0],{method:'session/set_config_option',params:{sessionId:'native',configId:'custom',value:'two'}});
  assert.equal(thread.workerSession.configOptions[0].currentValue,'two');
  rpc.call=async()=>{throw Error('Native rejection');};
  await assert.rejects(worker.call('session/set_config_option',{threadId:'chat',configId:'custom',value:'one'}),/Native rejection/);
  assert.equal(thread.workerSession.configOptions[0].currentValue,'two');
  worker.running.set('chat',{id:'turn'});
  await assert.rejects(worker.call('session/set_config_option',{threadId:'chat',configId:'custom',value:'one'}),/laufende Antwort/);
});
test('legacy modes require advertised values and config options take precedence', async()=>{
  const {worker,thread,calls}=fixture();
  thread.workerSession.modes={currentModeId:'ask',availableModes:[{id:'ask',name:'Ask'},{id:'native',name:'Native'}]};
  await assert.rejects(worker.call('session/set_mode',{threadId:'chat',modeId:'native'}),/nicht angeboten/);
  delete thread.workerSession.configOptions;
  await worker.call('session/set_mode',{threadId:'chat',modeId:'native'});
  assert.equal(thread.workerSession.modes.currentModeId,'native');
  assert.deepEqual(calls[0].params,{sessionId:'native',modeId:'native'});
});
test('load keeps metadata emitted before its response but does not duplicate transcript replay', async()=>{
  const {worker,thread,rpc,update,saved}=fixture();
  worker.sessions.clear(); thread.turns=[{id:'old',items:[]}];
  rpc.call=async()=>{
    update({sessionUpdate:'agent_message_chunk',content:{type:'text',text:'old replay'}});
    update({sessionUpdate:'available_commands_update',availableCommands:[{name:'loaded'}]});
    update({sessionUpdate:'config_option_update',configOptions:config('two')});
    return {};
  };
  await worker.call('thread/resume',{threadId:'chat',cwd:'/fixture'});
  assert.equal(thread.turns.length,1); assert.equal(thread.turns[0].items.length,0);
  assert.equal(thread.workerSession.availableCommands[0].name,'loaded');
  assert.equal(saved.at(-1).workerSession.configOptions[0].currentValue,'two');
});
test('slash command and arguments stay first and exact; no shell or local command dispatch', async()=>{
  const {worker,thread,rpc,calls}=fixture();
  rpc.call=async(method,params)=>{calls.push({method,params});return {stopReason:'end_turn'};};
  const text='/inspect  a "quoted argument"\nsecond line';
  await worker.call('turn/start',{threadId:'chat',input:[{type:'text',text}],collaborationMode:{settings:{developer_instructions:'Shared context'}}});
  await new Promise(resolve=>setImmediate(resolve));
  const request=calls.find(c=>c.method==='session/prompt');
  assert.deepEqual(request.params.prompt,[{type:'text',text}]);
  assert.equal(thread.turns[0].status,'completed');
  assert.equal(thread.turns[0].items[0].content[0].text,text);
});

test('a resumed session does not advertise removed settings from its persisted snapshot', async()=>{
  const {worker,thread,rpc}=fixture();
  thread.workerSession.availableCommands=[{name:'old'}];
  worker.sessions.clear(); rpc.call=async()=>({});
  await worker.call('thread/resume',{threadId:'chat',cwd:'/fixture'});
  assert.equal(thread.workerSession.availableCommands,undefined);
  assert.equal(thread.workerSession.configOptions,undefined);
});

test('concurrent session creation assigns early commands to their own chat', async()=>{
  const {worker,rpc}=fixture();
  rpc.call=async(method,params)=>{
    const sessionId=params.cwd;
    worker.receive({method:'session/update',params:{sessionId,update:{sessionUpdate:'available_commands_update',availableCommands:[{name:sessionId}]}}});
    return {sessionId};
  };
  const results=await Promise.all(['first','second'].map(cwd=>worker.call('thread/start',{cwd})));
  assert.deepEqual(results.map(r=>r.thread.workerSession.availableCommands[0].name),['first','second']);
});
