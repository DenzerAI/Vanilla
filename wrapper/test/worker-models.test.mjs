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
