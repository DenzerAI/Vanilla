import test from 'node:test';
import assert from 'node:assert/strict';
import {collectShelfEntries,shelfJobs,shelfTime} from '../ui/chat-shelf.mjs';
import {browserThread} from '../thread-view.mjs';
const collect=turns=>collectShelfEntries(turns,'/workspace','/workspace/projects/demo');

test('shelf combines actual uploads, explicit links and deliverables in transcript order',()=>{
 const turns=[{id:'a',status:'completed',startedAt:1700000000000,completedAt:1700000010000,items:[
  {type:'userMessage',content:[{type:'localImage',path:'/workspace/projects/demo/input/photo.png'},{type:'text',text:'Angehängte Datei: /workspace/projects/demo/input/brief.md\nLies diese Datei für den Auftrag.'}]},
  {type:'fileChange',status:'completed',changes:[{path:'output/site.html'},{path:'src/internal.tsx'}]},
  {type:'agentMessage',text:'[Website](output/site.html) [Konzept](output/plan.md) [Vorschau](https://example.com/demo) [1](https://example.com/source)'}]}];
 const entries=collect(turns);
 assert.deepEqual(entries.map(e=>e.name),['photo.png','brief.md','site.html','plan.md','Vorschau']);
 assert.equal(entries[0].origin,'Hochgeladen');assert.equal(entries[0].time,1700000000000);
 assert.equal(entries[2].path,'projects/demo/output/site.html');
 assert.equal(entries.filter(e=>e.path?.endsWith('site.html')).length,1);
});

test('failed writes, comments, code examples and unsafe links do not become shelf results',()=>{
 const entries=collect([{id:'a',status:'completed',items:[
 {type:'fileChange',status:'failed',changes:[{path:'output/no.md'}]},
 {type:'agentMessage',phase:'commentary',text:'[plan](output/later.html)'},
 {type:'agentMessage',text:'`[example](output/no.md)` [unsafe](javascript:alert) [outside](/other/file.md) [escape](../file.md)'}]}]);
 const credentialUrl=new URL('https://example.com/');credentialUrl.username='fixture';credentialUrl.password='placeholder';
 assert.deepEqual(collect([{id:'credentials',status:'completed',items:[{type:'agentMessage',text:`[Private link](${credentialUrl.href})`}]}]),[]);
 assert.deepEqual(entries,[]);
 const ongoing=collect([{id:'a',status:'inProgress',items:[{type:'agentMessage',text:'[draft](output/unfinished.html)'}]}]);
 assert.deepEqual(ongoing,[]);
});

test('same file remains one row on updates; separate variants retain their own row',()=>{
 const turns=['a','b'].map((id,i)=>({id,status:'completed',completedAt:1700000000000+i*1000,items:[{type:'fileChange',status:'completed',changes:[{path:'output/site.html'},...(i?[{path:'output/site-2.html'}]:[])]}]}));
 const entries=collect(turns);assert.equal(entries.length,2);assert.equal(entries[0].updatedAt,1700000001000);assert.equal(entries[0].time,1700000000000);
});

test('jobs require successful structured creation receipts and survive deferred histories',()=>{
 const receipt={created:true,job:{id:'routine-demo',name:'Weekly report',instructions:'x'.repeat(7000)}};
 const item={id:'tool',type:'mcpToolCall',status:'completed',tool:'routine_create',result:{content:[{type:'text',text:JSON.stringify(receipt)}]}};
 assert.deepEqual(shelfJobs(item),[{jobId:'routine-demo',name:'Weekly report'}]);
 for(const candidate of [{...item,status:'failed'},{...item,result:{isError:true,content:item.result.content}},{...item,result:{...receipt,created:false}},{status:'completed',arguments:receipt}]) assert.deepEqual(shelfJobs(candidate),[]);
 const thread={turns:[{id:'a',status:'completed',items:[item]}]};
 const projected=browserThread(thread);
 assert.equal(projected.turns[0].items[0].detailsDeferred,true);
 assert.deepEqual(collect(projected.turns),collect(thread.turns));
 assert.deepEqual(collect(thread.turns).map(e=>e.kind),['job']);
});

test('root relative upload receipts do not get a second project prefix; chats stay separate',()=>{
 const turns=[{id:'a',items:[{type:'userMessage',content:[{type:'attachment',path:'projects/demo/input/doc.pdf'}]}]}];
 assert.equal(collect(turns)[0].path,'projects/demo/input/doc.pdf');
 assert.deepEqual(collect([]),[]);
 assert.equal(shelfTime(1700000000),1700000000000);assert.equal(shelfTime(undefined),null);
});

test('native generated images are collected; screenshots stay in the tool history',()=>{
 const item={id:'im',type:'mcpToolCall',tool:'imagegen',status:'completed',result:{content:[{type:'image',mimeType:'image/png',data:'AAAA'}]}};
 assert.equal(collect([{id:'a',items:[item]}])[0].kind,'image');
 assert.deepEqual(collect([{id:'a',items:[{...item,tool:'computer_use_screenshot'}]}]),[]);
});
