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

test('concatenated native prompt keeps loaded context separate from the unchanged user request', async()=>{
  const {worker,thread,rpc,calls}=fixture();
  rpc.call=async(method,params)=>{calls.push({method,params});return {stopReason:'end_turn'};};
  const text='Execute the authorized file check.';
  await worker.call('turn/start',{threadId:'chat',input:[{type:'text',text}],collaborationMode:{settings:{developer_instructions:'AGENTS.md: last rule without a newline.'}}});
  await new Promise(resolve=>setImmediate(resolve));
  const prompt=calls.find(c=>c.method==='session/prompt').params.prompt;
  assert.match(prompt.map(p=>p.text).join(''),/last rule without a newline\.\n<\/vanilla_context>\n\nAktuelle Nutzernachricht:\n\nExecute the authorized file check\./);
  assert.equal(prompt[1].text,text);
  assert.equal(thread.turns[0].items[0].content[0].text,text);
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

test('native model switches replace effort levels only after acknowledgement and reject foreign values', async()=>{
  const {worker,thread,rpc,calls}=fixture();
  const configs = model => [
    {id:'model',category:'model',type:'select',currentValue:model,options:[{value:'large',name:'Large'},{value:'small',name:'Small'}]},
    {id:'effort',category:'thought_level',type:'select',currentValue:'low',options:(model==='large'?['low','high','max']:['low','high']).map(value=>({value,name:value}))},
  ];
  thread.workerSession.configOptions=configs('large');
  rpc.call=async(method,params)=>{calls.push({method,params});return {configOptions:configs(params.value)};};
  await worker.call('session/set_config_option',{threadId:'chat',configId:'model',value:'small'});
  const selected=worker.models(thread).find(m=>m.isDefault);
  assert.equal(selected.model,'small');
  assert.deepEqual(selected.supportedReasoningEfforts.map(e=>e.reasoningEffort),['low','high']);
  await assert.rejects(worker.call('session/set_config_option',{threadId:'chat',configId:'effort',value:'max'}),/nicht angeboten/);
  await assert.rejects(worker.call('session/set_config_option',{threadId:'chat',configId:'model',value:'gpt-6-astra'}),/nicht angeboten/);
  assert.equal(calls.length,1);
  rpc.call=async()=>{throw Error('Not authenticated');};
  await assert.rejects(worker.call('session/set_config_option',{threadId:'chat',configId:'model',value:'large'}),/Not authenticated/);
  assert.equal(worker.models(thread).find(m=>m.isDefault).model,'small');
});

test('legacy model selection is validated, persisted and used by the next prompt', async()=>{
  const {worker,thread,rpc,calls,saved}=fixture();
  delete thread.workerSession.configOptions;
  thread.workerSession.models={currentModelId:'first',availableModels:[{modelId:'first',name:'First'},{modelId:'second',name:'Second'}]};
  await assert.rejects(worker.call('session/set_model',{threadId:'chat',modelId:'foreign'}),/nicht angeboten/);
  await worker.call('session/set_model',{threadId:'chat',modelId:'second'});
  assert.equal(saved.at(-1).workerSession.models.currentModelId,'second');
  rpc.call=async(method,params)=>{calls.push({method,params});return {stopReason:'end_turn'};};
  await worker.call('turn/start',{threadId:'chat',model:'second',input:[{type:'text',text:'Test'}]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.filter(c=>c.method==='session/set_model').length,1);
  assert.equal(calls.filter(c=>c.method==='session/prompt').length,1);
});

test('an unauthenticated CLI model list never creates a selectable chat; a later native login works', async()=>{
  const {worker,rpc,saved}=fixture();
  worker.info.agentCapabilities._meta={authStatus:{}};
  let authenticated=false;
  rpc.call=async()=>{
    setImmediate(()=>worker.receive({method:'_auth/status_update',params:{authStatus:{kind:authenticated?'account':'none',detail:'private identity'}}}));
    return {sessionId:'new-native',models:{currentModelId:'native',availableModels:[{modelId:'native',name:'Native'}]}};
  };
  await assert.rejects(worker.call('thread/start',{cwd:'/fixture'}),/nicht angemeldet/);
  assert.equal(worker.threads.size,1); assert.equal(saved.length,0);
  authenticated=true;
  // A new session reports the freshly signed-in account before returning.
  rpc.call=async()=>{
    worker.receive({method:'_auth/status_update',params:{authStatus:{kind:'account',detail:'private identity'}}});
    return {sessionId:'signed-in',models:{currentModelId:'native',availableModels:[{modelId:'native',name:'Native'}]}};
  };
  const result=await worker.call('thread/start',{cwd:'/fixture'});
  assert.equal(worker.models(result.thread)[0].model,'native');
  assert.equal(worker.authenticated,true);
  assert.ok(!JSON.stringify(saved).includes('private identity'));
});

test('commands received while the initial native auth probe runs remain attached to the new session', async()=>{
  const {worker,rpc}=fixture();
  worker.info.agentCapabilities._meta={authStatus:{}};
  rpc.call=async()=>{
    setImmediate(()=>{
      worker.receive({method:'session/update',params:{sessionId:'auth-wait',update:{sessionUpdate:'available_commands_update',availableCommands:[{name:'model'}]}}});
      worker.receive({method:'_auth/status_update',params:{authStatus:{kind:'api_key'}}});
    });
    return {sessionId:'auth-wait'};
  };
  const result=await worker.call('thread/start',{cwd:'/fixture'});
  assert.equal(result.thread.workerSession.availableCommands[0].name,'model');
});

test('retry waits for a delayed native login update instead of rejecting the cached logged-out state', async()=>{
  const {worker,rpc,saved}=fixture();
  worker.info.agentCapabilities._meta={authStatus:{}};
  worker.receive({method:'_auth/status_update',params:{authStatus:{kind:'none'}}});
  rpc.call=async()=>{
    setImmediate(()=>worker.receive({method:'_auth/status_update',params:{authStatus:{kind:'account',detail:'private identity'}}}));
    return {sessionId:'after-login'};
  };
  const result=await worker.call('thread/start',{cwd:'/fixture'});
  assert.equal(result.thread.workerSession.sessionId,'after-login');
  assert.equal(worker.authenticated,true);
  assert.ok(!JSON.stringify(saved).includes('private identity'));
  assert.equal(worker.listenerCount('authentication'),0);
});

test('a fresh logged-out report still refuses the retry without persisting a chat', async()=>{
  const {worker,rpc,saved}=fixture();
  worker.info.agentCapabilities._meta={authStatus:{}}; worker.authenticated=false;
  rpc.call=async()=>{
    worker.receive({method:'_auth/status_update',params:{authStatus:{kind:'none'}}});
    return {sessionId:'still-logged-out'};
  };
  await assert.rejects(worker.call('thread/start',{cwd:'/fixture'}),/nicht angemeldet/);
  assert.equal(saved.length,0);
});

test('missing unused Claude session is restored under the same chat with native settings and no prompt', async()=>{
  const {worker,thread,rpc,calls,saved}=fixture();
  worker.id=thread.workerId='claw-code';worker.sessions.clear();
  const configs=(model,effort)=>[
    {id:'effort',category:'thought_level',type:'select',currentValue:effort,options:[{value:'low'},{value:'high'}]},
    {id:'model',category:'model',type:'select',currentValue:model,options:[{value:'small'},{value:'large'}]},
    ...config('two'),
  ];
  thread.workerSession.configOptions=configs('large','high');
  let current=configs('small','low');current[2].currentValue='one';
  rpc.call=async(method,params)=>{
    calls.push({method,params});
    if(method==='session/load')throw Error('Resource not found: native');
    if(method==='session/new')return {sessionId:'replacement',configOptions:structuredClone(current)};
    if(method==='session/set_config_option'){
      current=current.map(o=>({...o,currentValue:o.id===params.configId?params.value:o.currentValue}));
      return {configOptions:structuredClone(current)};
    }
    throw Error('Unexpected method');
  };
  const result=await worker.call('thread/resume',{threadId:'chat',cwd:'/fixture'});
  assert.equal(result.thread.id,'chat'); assert.deepEqual(result.thread.turns,[]);
  assert.equal(result.thread.workerSession.sessionId,'replacement');
  assert.deepEqual(result.thread.workerSession.configOptions,configs('large','high'));
  assert.deepEqual(calls.map(c=>c.method),['session/load','session/new','session/set_config_option','session/set_config_option','session/set_config_option']);
  assert.equal(calls[2].params.configId,'model');
  assert.equal(worker.sessions.get('replacement'),'chat');assert.equal(worker.sessions.has('native'),false);
  assert.equal(saved.at(-1).id,'chat');
});

test('Claude recovery never replaces a session with accepted work or an unrelated load failure', async()=>{
  for(const [turns,message] of [[[{id:'accepted',status:'failed',items:[]}],'Resource not found: native'],[[],'Connection interrupted']]){
    const {worker,thread,rpc,calls,saved}=fixture();
    worker.id=thread.workerId='claw-code';worker.sessions.clear();thread.turns=turns;
    rpc.call=async(method)=>{calls.push(method);throw Error(message);};
    await assert.rejects(worker.call('thread/resume',{threadId:'chat',cwd:'/fixture'}),e=>e.message===message);
    assert.deepEqual(calls,['session/load']);assert.equal(saved.length,0);
    assert.equal(thread.workerSession.sessionId,'native');
  }
});

test('unavailable saved settings leave the original empty Claude session intact', async()=>{
  const {worker,thread,rpc,saved}=fixture();
  worker.id=thread.workerId='claw-code';worker.sessions.clear();
  const previous=structuredClone(thread);
  rpc.call=async(method)=>{
    if(method==='session/load')throw Error('Resource not found: native');
    return {sessionId:'replacement',configOptions:[]};
  };
  await assert.rejects(worker.call('thread/resume',{threadId:'chat',cwd:'/fixture'}),/nicht mehr verfügbar/);
  assert.deepEqual(thread,previous);assert.equal(saved.length,0);assert.equal(worker.sessions.size,0);
});

test('native session setup has a bounded startup budget and never retries a timed-out mutation', async () => {
  const {worker,rpc}=fixture(); const calls=[];
  rpc.call=async (method,params,timeout)=>{calls.push({method,timeout});throw Error('session timeout');};
  await assert.rejects(worker.setup('session/load',{sessionId:'native'}),/session timeout/);
  assert.deepEqual(calls,[{method:'session/load',timeout:60000}]);
  assert.equal(worker.setupCount,0);
});

test('expired authentication blocks restored sessions and prompts before accepting user work', async () => {
  const {worker,rpc,thread,calls}=fixture();
  worker.authenticated=false; worker.sessions.clear();
  const original=structuredClone(thread.workerSession);
  rpc.call=async()=>({configOptions:config('two')});
  await assert.rejects(worker.call('thread/resume',{threadId:'chat',cwd:'/fixture'}),/nicht angemeldet/);
  assert.deepEqual(thread.workerSession,original);
  assert.equal(worker.sessions.size,0);
  await assert.rejects(worker.call('turn/start',{threadId:'chat',input:[{type:'text',text:'Continue'}]}),/nicht angemeldet/);
  assert.equal(thread.turns.length,0);
  assert.equal(calls.length,0);
});

test('token-only Claude login uses the native CLI result and ignores stale probes', async () => {
  const rpc = new EventEmitter(); let resolve;
  const worker = new ACPWorker({id:'claw-code', name:'Claude', rpc, contextEnv:{CLAUDE_CODE_OAUTH_TOKEN:'synthetic'},
    persist:async()=>{}, readThread:async()=>null, probeAuthentication:()=>new Promise(r=>resolve=r)});
  worker.connected=true; worker.info={agentCapabilities:{_meta:{authStatus:{}}}};
  const report=kind=>worker.receive({method:'_auth/status_update',params:{authStatus:{kind}}});
  report('none'); await Promise.resolve();
  assert.equal(worker.authenticated,undefined);
  const checked=worker.checkAuthentication(); resolve(true); await checked;
  assert.equal(worker.authenticated,true);
  report('none'); await Promise.resolve(); report('api_key'); resolve(false);
  await new Promise(r=>setImmediate(r)); assert.equal(worker.authenticated,true);
  report('none'); await Promise.resolve();
  const rejected=assert.rejects(worker.checkAuthentication(),/nicht angemeldet/); resolve(false); await rejected;
  report('none'); await Promise.resolve(); rpc.emit('disconnected',{}); worker.connected=true; resolve(true);
  await new Promise(r=>setImmediate(r)); assert.equal(worker.authenticated,undefined);
});

test('native token probe forwards only to the configured adapter and requires a positive OAuth result', async () => {
  const {readClaudeServiceAuthentication} = await import('../acp-worker.mjs');
  const request={command:'fixture-adapter',args:['fixture-flag'],cwd:'/fixture',env:{CLAUDE_CODE_OAUTH_TOKEN:'synthetic'}};
  const result=await readClaudeServiceAuthentication(request,async(command,args,options)=>{
    assert.equal(command,request.command);
    assert.deepEqual(args,['fixture-flag','--cli','auth','status','--json']);
    assert.equal(options.env.CLAUDE_CODE_OAUTH_TOKEN,'synthetic');
    assert.equal(options.timeout,5000);
    return {stdout:JSON.stringify({loggedIn:true,authMethod:'oauth_token'})};
  });
  assert.equal(result,true);
  for(const stdout of ['bad','{}','{"loggedIn":false,"authMethod":"oauth_token"}','{"loggedIn":true,"authMethod":"api_key"}'])
    assert.equal(await readClaudeServiceAuthentication(request,async()=>({stdout})),false);
  assert.equal(await readClaudeServiceAuthentication(request,async()=>{throw Error('private');}),false);
});
