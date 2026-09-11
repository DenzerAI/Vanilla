import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Storage} from '../storage.mjs';
import {Workers} from '../workers.mjs';
import {saveHandoff, handoffInstructions, handoffSnapshot} from '../chat-handoff.mjs';
import {fastTier} from '../worker-models.mjs';

test('handoff retains one visible chat, native routing, context and history across reopen', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'handoff-test-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const store = new Storage(path.join(root, 'workspace'), path.join(root, 'data')); await store.init();
  const previous = {id:'visible', turns:[{id:'old-turn', status:'interrupted', items:[
    {type:'userMessage', content:[{type:'text',text:'Fiktiver Auftrag: Formular fertigstellen.'}]},
    {type:'agentMessage', text:'Das Formular ist angelegt; Validierung ist offen.'},
    {type:'reasoning', text:'Internal reasoning excluded'},
  ]}]};
  const snapshot = await saveHandoff(store, 'visible', previous);
  store.state.chats.push({id:'visible', workerId:'claw-code', workerThreadId:'native-new', handoffSnapshot:snapshot}); await store.save();
  class Adapter extends EventEmitter {
    connected = true; calls = []; requests = new Map();
    async start() {}
    async call(method, params) { this.calls.push({method,params}); return {thread:{id:'native-new', turns:[{id:'new-turn',items:[],status:'completed'}]}}; }
  }
  const codex = new Adapter(), claude = new Adapter();
  const workers = new Workers({store,root,codex}); await workers.init();
  workers.settings.enabled.push('claw-code'); workers.attach('claw-code',claude);
  const result = await workers.call('thread/read', {threadId:'visible'});
  assert.equal(result.thread.id, 'visible'); assert.deepEqual(result.thread.turns.map(t=>t.id), ['old-turn','new-turn']);
  assert.equal(claude.calls.at(-1).params.threadId, 'native-new');
  const events = []; workers.on('notification', e => events.push(e));
  claude.emit('notification', {method:'turn/completed',params:{threadId:'native-new',turn:{id:'new-turn'}}});
  codex.emit('notification', {method:'turn/completed',params:{threadId:'visible',turn:{id:'old-turn'}}});
  assert.equal(events.length,1); assert.equal(events[0].params.threadId,'visible');
  await assert.rejects(workers.call('thread/rollback',{threadId:'visible',numTurns:2}), /vor dem Anbieterwechsel/);
  assert.ok(!claude.calls.some(c=>c.method==='thread/rollback'));
  const reopened = new Storage(store.root,store.dataRoot); await reopened.init();
  assert.equal(reopened.chat('visible').workerThreadId,'native-new');
  assert.equal((await handoffSnapshot(reopened,reopened.chat('visible'))).turns[0].id,'old-turn');
  const instructions = await handoffInstructions(reopened,reopened.chat('visible'));
  assert.match(instructions,/Validierung ist offen/); assert.doesNotMatch(instructions,/Internal reasoning excluded/);
  const exported = await readFile(path.join(store.root,snapshot.replace(/\.json$/,'.md')),'utf8');
  assert.match(exported,/interrupted/);
  assert.equal(store.state.chats.length,1);
});
test('Fast control uses native tier identifiers only', () => {
  assert.equal(fastTier({additionalSpeedTiers:['fast']}),null);
  assert.equal(fastTier({serviceTiers:[{id:'priority',name:'Fast'}]}).id,'priority');
  assert.equal(fastTier({serviceTiers:[]}),null);
});

test('long handoff retains the initial objective and latest progress without another model call', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'long-handoff-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const store={root};
  const snapshot=await saveHandoff(store,'chat',{turns:[{status:'completed',items:[
    {type:'userMessage',content:[{text:'Initial objective: preserve the export.'}]},
    {type:'agentMessage',text:'intermediate '.repeat(4000)},
    {type:'mcpToolCall',tool:'Validate export',status:'failed'},
    {type:'agentMessage',text:'Latest progress: validation remains open.'},
  ]}]});
  const result=await handoffInstructions(store,{handoffSnapshot:snapshot});
  assert.match(result,/Initial objective/);
  assert.match(result,/Latest progress/);
  assert.match(result,/Validate export/);
  assert.ok(result.length<26000);
});
