import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleModels, preferredModel, supportedEffort, sessionModelSelection, applySessionSelection, sessionFast } from '../worker-models.mjs';

test('Codex picker excludes older, hidden and lookalike models without affecting other providers', () => {
  const models = ['gpt-5.5','gpt-5.4-mini','gpt-5.3-codex-spark','gpt-6-astra','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-60','gpt-5.60'].map(model => ({model}));
  models.push({model:'gpt-6-hidden',hidden:true});
  assert.deepEqual(visibleModels(models).map(m=>m.model), ['gpt-6-astra','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna']);
  assert.equal(preferredModel(models,'codex','gpt-5.5').model,'gpt-6-astra');
  assert.equal(visibleModels([{model:'claude-native-model'}],'claw-code').length,1);
});
test('changing models cannot retain an unsupported effort or invent a default', () => {
  const model = {defaultReasoningEffort:'medium',supportedReasoningEfforts:['low','medium','high','xhigh','max'].map(reasoningEffort=>({reasoningEffort}))};
  assert.equal(supportedEffort(model,'ultra'),'medium');
  assert.equal(supportedEffort(model,'max'),'max');
  assert.equal(supportedEffort({supportedReasoningEfforts:[]},'high'),'');
});
test('ACP native names, grouped values and model-specific effort options are preserved exactly', () => {
  const session = {models:{currentModelId:'stale',availableModels:[{modelId:'stale'}]},configOptions:[
    {id:'native-model',category:'model',type:'select',currentValue:'opus',options:[{name:'Models',options:[{value:'opus',name:'Claude Opus'},{value:'haiku',name:'Claude Haiku'}]}]},
    {id:'native-effort',category:'thought_level',type:'select',currentValue:'xhigh',options:[{value:'low',name:'Low'},{value:'xhigh',name:'Extra high'}]},
  ]};
  const result = sessionModelSelection(session);
  assert.equal(result.model,'opus'); assert.equal(result.effort,'xhigh');
  assert.deepEqual(result.models[0].supportedReasoningEfforts.map(e=>[e.reasoningEffort,e.displayName]),[['low','Low'],['xhigh','Extra high']]);
  assert.deepEqual(result.models[1].supportedReasoningEfforts,[]);
  session.configOptions=[];
  assert.deepEqual(sessionModelSelection(session),{model:'',effort:'',models:[]});
  delete session.configOptions;
  assert.equal(sessionModelSelection(session).model,'stale');
});


test('queued native model choice uses newly acknowledged efforts and rejects unavailable values', async () => {
  const make = (model, effort, levels) => ({configOptions:[
    {id:'model',type:'select',currentValue:model,options:[{value:'a'},{value:'b'}]},
    {id:'effort',type:'select',currentValue:effort,options:levels.map(value=>({value}))},
  ]});
  const before = make('a','low',['low']), calls=[];
  const result = await applySessionSelection(before,{model:'b',effort:'high'},async change=>{
    calls.push(change); return calls.length===1 ? make('b','medium',['medium','high']) : make('b','high',['medium','high']);
  });
  assert.deepEqual(calls,[{configId:'model',value:'b'},{configId:'effort',value:'high'}]);
  assert.equal(sessionModelSelection(result).effort,'high');
  assert.equal(sessionModelSelection(before).model,'a');
  await assert.rejects(applySessionSelection(before,{model:'foreign'},()=>assert.fail('No native mutation allowed')),/nicht mehr verfügbar/);
  await assert.rejects(applySessionSelection(before,{model:'a',effort:'ultra'},()=>assert.fail('No native mutation allowed')),/Denkaufwand/);
  await assert.rejects(applySessionSelection(before,{model:'b'},async()=>before),/nicht bestätigt/);
});

test('Claude uses the resolved default label and only advertised native Fast values', () => {
  const session={configOptions:[{id:'model',type:'select',currentValue:'default',options:[{value:'default',name:'Default (recommended)',description:'Claude Example'}]},
    {id:'fast',type:'select',currentValue:'off',options:[{value:'on',name:'On'},{value:'off',name:'Off'}]}]};
  assert.equal(sessionModelSelection(session).models[0].displayName,'Claude Example');
  assert.deepEqual(sessionFast(session),{id:'fast',enabled:false,on:'on',off:'off'});
  session.configOptions[1].currentValue='on';
  assert.equal(sessionFast(session).enabled,true);
  session.configOptions[1].options.pop();
  assert.equal(sessionFast(session),null);
  assert.equal(sessionFast(undefined),null);
});

test('Claude model versions come from exact session metadata, preserving IDs and context variants', async () => {
  const {attachClaudeModelMetadata} = await import('../worker-models.mjs');
  const options=[{id:'model',type:'select',currentValue:'sonnet',options:[
    {value:'default',name:'Default',description:'Sonnet'},
    {value:'sonnet',name:'Sonnet'}, {value:'sonnet[1m]',name:'Sonnet'},
    {value:'fable',name:'Fable'}, {value:'opus',name:'Opus'},
  ]}];
  const infos=[{value:'sonnet',resolvedModel:'claude-sonnet-5'},
    {value:'sonnet[1m]',resolvedModel:'claude-sonnet-5[1m]'},
    {value:'fable',resolvedModel:'claude-fable-5-1'}, {value:'opus',resolvedModel:'claude-opus-5'}];
  const snapshot=structuredClone(options);
  const models=sessionModelSelection({configOptions:attachClaudeModelMetadata(options,infos)}).models;
  assert.deepEqual(visibleModels(models,'claw-code').map(m=>[m.model,m.displayName]),[
    ['sonnet','Claude Sonnet 5'],['sonnet[1m]','Claude Sonnet 5 · 1M'],['fable','Claude Fable 5.1'],['opus','Claude Opus 5'],
  ]);
  assert.deepEqual(options,snapshot);
  const other=sessionModelSelection({configOptions:attachClaudeModelMetadata(options,[{value:'sonnet',resolvedModel:'claude-sonnet-4-5-20250929'}])});
  assert.equal(other.models[1].displayName,'Claude Sonnet 4.5');
  assert.equal(models[1].displayName,'Claude Sonnet 5');
  assert.equal(visibleModels([...models,models[1]],'claw-code').length,4);
  assert.deepEqual(visibleModels([models[0]],'claw-code'),[models[0]]);
});

test('model metadata never guesses a version or crosses a provider option', async () => {
  const {nativeModelName,attachClaudeModelMetadata}=await import('../worker-models.mjs');
  assert.equal(nativeModelName({value:'custom',name:'My deployment'}),'My deployment');
  const options=[{id:'effort',type:'select',options:[{value:'sonnet'}]}];
  assert.deepEqual(attachClaudeModelMetadata(options,[{value:'sonnet',resolvedModel:'claude-sonnet-5'}]),options);
  assert.equal(nativeModelName({value:'claude-haiku-4-5-20251001',name:'Haiku'}),'Claude Haiku 4.5');
});

test('Claude metadata follows new, loaded, changed and notified sessions independently', async () => {
  const {decorateClaudeModelMetadata}=await import('../worker-models.mjs');
  const options=[{id:'model',type:'select',currentValue:'sonnet',options:[{value:'sonnet',name:'Sonnet'}]}];
  const events=[];
  const agent={sessions:{a:{modelInfos:[{value:'sonnet',resolvedModel:'claude-sonnet-5'}]},
    b:{modelInfos:[{value:'sonnet',resolvedModel:'claude-sonnet-4-5'}]}},
    client:{sessionUpdate:async event=>events.push(event)}};
  for(const method of ['newSession','loadSession','resumeSession','unstable_forkSession','setSessionConfigOption'])
    agent[method]=async params=>({sessionId:params.sessionId,configOptions:options});
  decorateClaudeModelMetadata(agent);
  for(const method of ['newSession','loadSession','resumeSession','unstable_forkSession','setSessionConfigOption']) {
    assert.equal(sessionModelSelection(await agent[method]({sessionId:'a'})).models[0].displayName,'Claude Sonnet 5');
    assert.equal(sessionModelSelection(await agent[method]({sessionId:'b'})).models[0].displayName,'Claude Sonnet 4.5');
  }
  await agent.client.sessionUpdate({sessionId:'b',update:{sessionUpdate:'config_option_update',configOptions:options}});
  assert.equal(sessionModelSelection(events[0].update).models[0].displayName,'Claude Sonnet 4.5');
  assert.equal(options[0].options[0]._meta,undefined);
  await agent.client.sessionUpdate({sessionId:'a',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Example'}}});
  assert.equal(events[1].update.content.text,'Example');
});
