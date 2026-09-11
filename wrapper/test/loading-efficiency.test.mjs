import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedReads,createSharedApi} from '../ui/shared-reads.mjs';
import {copyThreadForEvent,reconcileThreadSnapshot} from '../ui/thread-update.mjs';
import {browserChat} from '../chat-summary.mjs';

test('API shares only concurrent uncancelled reads and preserves mutation deadlines',async()=>{
  const calls=[];
  const api=createSharedApi((...args)=>new Promise(resolve=>calls.push({args,resolve})));
  const a=api('/chats'),b=api('/chats');
  await Promise.resolve();assert.equal(calls.length,1);
  const controller=new AbortController();
  const independent=api('/chats',undefined,true,controller.signal);
  assert.equal(calls.length,2);assert.equal(calls[1].args[3],controller.signal);
  const body={text:'A synthetic message'};
  const mutation=api('/send',body,false,controller.signal);
  assert.deepEqual(calls[2].args,['/send',body,false,controller.signal]);
  const fresh=api('/chats');await Promise.resolve();assert.equal(calls.length,4);
  calls.forEach((call,index)=>call.resolve(index));
  assert.deepEqual(await Promise.all([a,b,independent,mutation,fresh]),[0,0,1,2,3]);
});

test('concurrent panes share one read, and failures can be retried',async()=>{
  const reads=createSharedReads(); let calls=0;
  const load=async()=>{calls++;return {chats:[]};};
  const [a,b]=await Promise.all([reads.read('chats',load),reads.read('chats',load)]);
  assert.equal(calls,1);assert.equal(a,b);
  await reads.read('chats',load);assert.equal(calls,2);
  await assert.rejects(reads.read('chats',()=>Promise.reject(Error('offline'))));
  await reads.read('chats',load);assert.equal(calls,3);
});

test('a mutation invalidates reads; old completion cannot evict the replacement',async()=>{
  const reads=createSharedReads();let oldResolve,newResolve;
  const old=reads.read('chats',()=>new Promise(resolve=>{oldResolve=resolve;}));
  await Promise.resolve();reads.clear();
  const fresh=reads.read('chats',()=>new Promise(resolve=>{newResolve=resolve;}));
  await Promise.resolve();oldResolve('before locking');await old;
  assert.equal(reads.read('chats',()=>assert.fail('duplicate')),fresh);
  newResolve('after locking');assert.equal(await fresh,'after locking');
});

test('streaming copies only the affected turn and item, preserving large history',()=>{
  const oldTurn={id:'old',items:[{id:'tool',data:'large saved tool result'}]};
  const oldItem={id:'answer',text:'Hello',summary:['Earlier']};
  const before={id:'chat',turns:[oldTurn,{id:'current',items:[oldItem]}]};
  const after=copyThreadForEvent(before,{turnId:'current',itemId:'answer'});
  after.turns[1].items[0].text+=' world';after.turns[1].items[0].summary[0]+=' detail';
  assert.equal(after.turns[0],oldTurn);
  assert.equal(before.turns[1].items[0].text,'Hello');
  assert.deepEqual(before.turns[1].items[0].summary,['Earlier']);
  assert.notEqual(after.turns[1],before.turns[1]);
  const pending={turns:[{id:'draft',clientPending:true,items:[]}]};
  const started=copyThreadForEvent(pending,{turn:{id:'real'}});
  delete started.turns[0].clientPending;
  assert.equal(pending.turns[0].clientPending,true);
});

test('compact sidebar omits counters while keeping all controls and report snapshots',()=>{
  const chat={id:'chat',private:true,capabilities:{fork:true},model:'model',statisticsSnapshot:{id:'report'},tokenUsage:{big:'counter'},statisticsTurns:{old:'counter'}};
  assert.equal(browserChat(chat,false),chat);
  const summary=browserChat(chat,true);
  assert.equal(summary.tokenUsage,undefined);assert.equal(summary.statisticsTurns,undefined);
  assert.equal(summary.statisticsSnapshot,chat.statisticsSnapshot);
  assert.equal(summary.capabilities,chat.capabilities);assert.equal(summary.private,true);
  assert.ok(chat.tokenUsage);
});


test('late snapshots cannot erase streamed answers, completed work or newer turns',()=>{
  const current={id:'chat',turns:[{id:'old',status:'completed',items:[{id:'old-answer',text:'Saved answer'}]},
    {id:'live',status:'completed',items:[{id:'answer',text:'Hello world'},{id:'tool',type:'tool',output:'Finished'}]},
    {id:'next',status:'inProgress',items:[{id:'new-answer',text:'Next answer'}]}]};
  const stale={id:'chat',turns:[{id:'live',status:'inProgress',items:[{id:'answer',text:'Hello'}]}]};
  const result=reconcileThreadSnapshot(current,stale);
  assert.deepEqual(result.turns.map(t=>t.id),['old','live','next']);
  assert.equal(result.turns[1].items[0].text,'Hello world');
  assert.equal(result.turns[1].items[1].output,'Finished');
  assert.equal(result.turns[1].status,'completed');
  assert.equal(reconcileThreadSnapshot(current,{id:'chat',turns:[]}).turns.length,3);
  assert.deepEqual(stale.turns[0].items,[{id:'answer',text:'Hello'}]);
  const other={id:'other',turns:[]};
  assert.equal(reconcileThreadSnapshot(current,other),other);
});

test('fresh snapshots still add final text, tool output and a new turn',()=>{
  const current={id:'chat',turns:[{id:'turn',status:'inProgress',items:[{id:'answer',text:'Hello'}]}]};
  const incoming={id:'chat',turns:[{id:'turn',status:'completed',items:[{id:'answer',text:'Hello world'},{id:'tool',output:'Done'}]}, {id:'new',items:[]}]};
  const result=reconcileThreadSnapshot(current,incoming);
  assert.equal(result.turns[0].status,'completed');
  assert.equal(result.turns[0].items[0].text,'Hello world');
  assert.equal(result.turns[0].items[1].output,'Done');
  assert.equal(result.turns[1].id,'new');
});


test('panel boot reserves one conversation and composer without a second sidebar',async()=>{
  const {build}=await import('esbuild');
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {fileURLToPath,pathToFileURL}=await import('node:url');
  const {default:React}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const dir=await mkdtemp(root+'.verify-skeleton-');
  try {
    const result=await build({entryPoints:[root+'ui/skeleton.tsx'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'}});
    const file=dir+'/skeleton.mjs';await writeFile(file,result.outputFiles[0].contents);
    const {Skeleton}=await import(pathToFileURL(file));
    const render=variant=>renderToStaticMarkup(React.createElement(Skeleton,{variant}));
    for(const variant of ['shell','chat-panel']) {
      const html=render(variant);
      assert.equal((html.match(/class="skeleton-sidebar"/g)||[]).length,variant==='shell'?1:0);
      assert.equal((html.match(/class="message-column"/g)||[]).length,1);
      assert.equal((html.match(/class="skeleton-composer"/g)||[]).length,1);
      assert.equal((html.match(/role="status"/g)||[]).length,1);
    }
    for(const variant of ['list','settings','chat','document','media','attention']) {
      assert.doesNotMatch(render(variant),/skeleton-sidebar|skeleton-composer/);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});
