import test from 'node:test';
import assert from 'node:assert/strict';
import {browserThread,threadItem} from '../thread-view.mjs';
import {collectChatArtifacts} from '../ui/artifact-content.mjs';
import {loadStartData} from '../ui/start-data-loader.mjs';
import {settingsIntegrations} from '../connection-summary.mjs';

test('connection list retains names and counts without changing native tool schemas',()=>{
  const source={connections:[{id:'example'}],secrets:[],mcp:[{name:'example',tools:{read:{inputSchema:{description:'Large schema '.repeat(10000)}}}}]};
  const summary=settingsIntegrations(source);
  assert.deepEqual(Object.keys(summary.mcp[0].tools),['read']);
  assert.ok(source.mcp[0].tools.read.inputSchema);
  assert.equal(summary.connections,source.connections);
  assert.ok(JSON.stringify(summary).length<JSON.stringify(source).length/100);
});

test('browser keeps messages, context controls and artifacts while deferring large tool details',()=>{
  const tool={id:'tool',type:'fileChange',status:'completed',changes:[{path:'output/report.md',kind:'add',diff:'@@\n+Report\n-old'}],aggregatedOutput:'Synthetic output '.repeat(10000)};
  const message={id:'answer',type:'agentMessage',text:'Your report is ready.'};
  const native={id:'chat',workerSession:{model:'example',nativeThreadId:'native'},turns:[{id:'turn',status:'completed',items:[tool,message]}]};
  const before=JSON.stringify(native),view=browserThread(native),summary=view.turns[0].items[0];
  assert.equal(JSON.stringify(native),before);
  assert.equal(view.workerSession,native.workerSession);assert.equal(view.turns[0].items[1],message);
  assert.equal(summary.detailsDeferred,true);assert.equal(summary.aggregatedOutput,undefined);
  assert.deepEqual(summary.displayDiffStats,{added:1,removed:1,partial:false});
  assert.deepEqual(collectChatArtifacts(view.turns[0].items),collectChatArtifacts(native.turns[0].items));
  assert.ok(JSON.stringify(view).length<before.length/100);
  assert.equal(threadItem(native,'turn','tool').item,tool);
  assert.throws(()=>threadItem(native,'other','tool'));
  const running={...tool,status:'inProgress'};
  assert.equal(browserThread({turns:[{items:[running]}]}).turns[0].items[0],running,'Ongoing output must keep receiving live deltas');
});

test('generated answer images stay visible, inspected screenshots defer',()=>{
  const result={content:[{type:'text',text:'Generated images are saved to an output folder.'},{type:'image',mimeType:'image/png',data:'AAAA'.repeat(2000)}]};
  const image={id:'generated',type:'mcpToolCall',status:'completed',tool:'imagegen',result};
  const screenshot={...image,id:'screen',tool:'computer_use_screenshot'};
  const items=browserThread({turns:[{id:'turn',items:[image,screenshot]}]}).turns[0].items;
  assert.equal(items[0],image);assert.equal(items[1].detailsDeferred,true);
});

test('optional startup results arrive independently and a failure preserves successful data',async()=>{
  let resolveProfile;const received=[];
  const loading=loadStartData(url=>url.includes('/file/')?new Promise(resolve=>resolveProfile=resolve):url==='/jobs'?Promise.resolve([{id:'job'}]):Promise.reject(Error('offline')),true,(key,result)=>received.push({key,...result}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(received.find(r=>r.key==='jobs').value,[{id:'job'}]);
  assert.ok(received.find(r=>r.key==='reports').error);
  assert.ok(!received.some(r=>r.key==='profile'));
  resolveProfile({text:''});await loading;
  assert.ok(received.some(r=>r.key==='profile'));
});
