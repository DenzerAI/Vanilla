import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {questionRequest,questionResult,questionReceipt} from '../worker-questions.mjs';
import {ACPWorker} from '../acp-worker.mjs';
import {Workers} from '../workers.mjs';
import {askUserQuestionsToCreateRequest,applyAskElicitationResponse} from '../node_modules/@agentclientprotocol/claude-agent-acp/dist/elicitation.js';

const codex = {id:7,method:'item/tool/requestUserInput',params:{threadId:'chat',turnId:'turn',questions:[{id:'scope',question:'Which scope?',options:[{label:'One'},{label:'Two'}]}]}};
test('native Codex keeps question IDs and native reply envelope; prose never opens a card',()=>{
  const model=questionRequest(codex);
  assert.deepEqual(questionResult(model,{scope:{selected:['Two']}}),{answers:{scope:{answers:['Two']}}});
  assert.deepEqual(questionResult(model,{scope:{text:'Something else'}}),{answers:{scope:{answers:['Something else']}}});
  assert.throws(()=>questionResult(model,{}),/Antwort/);
  assert.equal(questionRequest({method:'item/completed',params:{item:{text:'Please choose One or Two'}}}),null);
  assert.equal(questionRequest({method:'item/commandExecution/requestApproval'}),null);
});
test('installed Claude AskUserQuestion bridge round-trips choices, multi-select and per-question Other',()=>{
  const questions=[{header:'Scope',question:'Which scope?',options:[{label:'One',description:'First'},{label:'Two'}]}, {question:'Which files?',multiSelect:true,options:[{label:'A'},{label:'B'}]}];
  const params=askUserQuestionsToCreateRequest(questions,'native','call');
  const model=questionRequest({method:'mcpServer/elicitation/request',params});
  assert.equal(model.questions.length,2);
  assert.equal(model.questions[0].options[0].description,'First');
  const result=questionResult(model,{question_0:{text:'Custom scope'},question_1:{selected:['A','B']}});
  assert.deepEqual(result,{action:'accept',content:{question_0_custom:'Custom scope',question_1:['A','B']}});
  const applied=applyAskElicitationResponse(result,{questions},questions);
  assert.deepEqual(applied.updatedInput.answers,{'Which scope?':'Custom scope','Which files?':'A, B'});
});
test('form answers preserve primitive types and validate constraints',()=>{
  const model=questionRequest({method:'mcpServer/elicitation/request',params:{message:'Settings?',requestedSchema:{type:'object',required:['count','enabled'],properties:{count:{type:'integer',minimum:1,maximum:9},enabled:{type:'boolean'}}}}});
  assert.deepEqual(questionResult(model,{count:{text:'3'},enabled:{selected:[false]}}),{action:'accept',content:{count:3,enabled:false}});
  assert.throws(()=>questionResult(model,{count:{text:'3.5'},enabled:{selected:[false]}}),/Zahl/);
  assert.throws(()=>questionResult(model,{count:{text:'10'},enabled:{selected:[false]}}),/Bereich/);
  assert.throws(()=>questionResult(model,{count:{text:'3'},enabled:{text:'yes'}}),/auswählen/);
});
function acpFixture() {
  const rpc=new EventEmitter(),writes=[];
  rpc.write=msg=>writes.push(msg);
  const worker=new ACPWorker({id:'claw-code',name:'Claude Code',rpc,persist:async()=>{},readThread:async()=>null});
  worker.sessions.set('native','chat');
  const turn={id:'turn',items:[],status:'inProgress'};
  worker.threads.set('chat',{id:'chat',turns:[turn]});worker.running.set('chat',turn);
  return {worker,rpc,writes};
}
test('ACP advertises form support, holds the native request and responds once to its original ID',async()=>{
  const {worker,rpc,writes}=acpFixture();
  const calls=[];rpc.start=()=>{};rpc.stop=()=>{};rpc.call=async(method,params)=>{calls.push({method,params});return {protocolVersion:1,agentCapabilities:{}};};
  await worker.start();assert.deepEqual(calls[0].params.clientCapabilities.elicitation,{form:{}});
  const native={id:23,method:'elicitation/create',params:askUserQuestionsToCreateRequest([{question:'Which?',options:[{label:'A'},{label:'B'}]}],'native','call')};
  let publicRequest;worker.on('request',r=>publicRequest=r);worker.receive(native);
  assert.equal(writes.length,0);assert.equal(worker.running.size,1);
  assert.equal(publicRequest.params.threadId,'chat');assert.equal(publicRequest.params.turnId,'turn');
  const result=questionResult(questionRequest(publicRequest),{question_0:{selected:['B']}});
  worker.respond(publicRequest.id,result);
  assert.deepEqual(writes,[{id:23,result}]);
  assert.throws(()=>worker.respond(publicRequest.id,result),/nicht mehr offen/);
  assert.equal(worker.running.size,1);
});
test('finished requests disappear and cannot resume a cancelled turn',async()=>{
  const {worker,writes}=acpFixture();const resolved=[];worker.on('notification',e=>resolved.push(e));
  worker.receive({id:1,method:'elicitation/create',params:{sessionId:'native',requestedSchema:{type:'object',properties:{answer:{type:'string'}}}}});
  await worker.finish('chat','interrupted');
  assert.equal(worker.requests.size,0);
  assert.ok(resolved.some(e=>e.method==='serverRequest/resolved'));
  assert.throws(()=>worker.respond('claw-code:1',{action:'accept',content:{}}),/nicht mehr offen/);
  assert.equal(writes.length,0);
});
test('worker disconnect resolves only its own pending cards, including intentional stops',()=>{
  const a=new EventEmitter(),b=new EventEmitter();a.requests=new Map();b.requests=new Map();
  const workers=new Workers({store:{dataRoot:'/fixture',state:{chats:[{id:'chat',workerId:'codex'},{id:'other',workerId:'claw-code'}]}},codex:a});
  workers.attach('claw-code',b);const events=[];workers.on('notification',e=>events.push(e));
  a.emit('request',codex);b.emit('request',{...codex,id:'claw-code:7',params:{...codex.params,threadId:'other'}});
  workers.stopping.add('codex');a.emit('disconnected',{message:'Stopped'});
  assert.equal(workers.requests.size,1);assert.ok(workers.requests.has('claw-code:7'));
  assert.ok(events.some(e=>e.method==='serverRequest/resolved'&&e.params.requestId==='7'));
});
test('history contains the question and answer but omits secret questions and external forms',()=>{
  const item=questionReceipt(codex,{answers:{scope:{answers:['Two']}}});
  assert.equal(item.result.content[0].text,'Which scope?\nTwo');
  assert.equal(questionReceipt({...codex,params:{...codex.params,questions:[{id:'secret',question:'Secret?',isSecret:true}]}},{answers:{secret:{answers:['private']}}}),null);
  assert.equal(questionReceipt({method:'mcpServer/elicitation/request',params:{requestedSchema:{type:'object',properties:{token:{type:'string'}}}}},{action:'accept',content:{token:'private'}}),null);
});
