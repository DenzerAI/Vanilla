import test from 'node:test';
import assert from 'node:assert/strict';
import {slashCommand,canonicalCommand,commandCatalog,codexTurnCommand,codexControl} from '../worker-commands.mjs';
import {submitComposerCommand} from '../ui/composer-command-submit.mjs';

test('aliases preserve multiline arguments exactly and paths are not commands',()=>{
  assert.equal(canonicalCommand('/ziel  a "quoted"\nsecond line'),'/goal  a "quoted"\nsecond line');
  for(const text of ['/tmp/file.txt','/Users/example','Text /goal',' /goal','//comment'])assert.equal(slashCommand(text),null);
  assert.equal(canonicalCommand('/mcp:server:future a'),'/mcp:server:future a');
});
test('native commands update without a name allowlist; empty lists remove stale commands',()=>{
  const commands=[{name:'future-command',description:'New',input:{hint:'Args'}},{name:'goal'}, {name:'future-command'}, {name:'bad name'}];
  assert.deepEqual(commandCatalog('claw-code',commands).map(c=>c.name),['future-command','goal','ziel']);
  assert.deepEqual(commandCatalog('claw-code',[]),[]);
  assert.equal(commandCatalog('claw-code',commands)[0].input.hint,'Args');
});
test('Codex discovers enabled skills, preserves native paths, and does not pretend terminal commands are prompts',()=>{
  const commands=commandCatalog('codex',undefined,[{name:'fresh',enabled:true,path:'/fixture/SKILL.md'},{name:'disabled',enabled:false,path:'/fixture/off.md'},{name:'goal',enabled:true,path:'/fixture/shadow.md'}]);
  assert.deepEqual(codexTurnCommand('/fresh details',commands),{skill:{type:'skill',name:'fresh',path:'/fixture/SKILL.md'}});
  assert.throws(()=>codexTurnCommand('/disabled',commands),/nicht ausführbar/);
  assert.throws(()=>codexTurnCommand('/login',commands),/native CLI/);
  assert.deepEqual(codexTurnCommand('/ziel Build exits 0',commands),{objective:'Build exits 0'});
  assert.deepEqual(codexTurnCommand('/goal resume',commands),{resume:true});
  assert.deepEqual(codexTurnCommand('/plan Read the files',commands),{mode:'plan'});
  assert.throws(()=>codexTurnCommand('/goal '+ 'x'.repeat(4001),commands),/4.000/);
});
test('goal controls call only native goal methods and propagate rejections',async()=>{
  const calls=[];
  const call=async(method,params)=>{calls.push({method,params});return {cleared:true,goal:{objective:'Finish',status:params.status || 'active'}};};
  assert.equal((await codexControl(call,'chat','/ziel')).message,'Aktiv: Finish');
  await codexControl(call,'chat','/goal pause');
  assert.equal((await codexControl(call,'chat','/ziel stop')).goal,null);
  assert.deepEqual(calls.map(c=>c.method),['thread/goal/get','thread/goal/set','thread/goal/clear']);
  assert.deepEqual(calls[1].params,{threadId:'chat',status:'paused'});
  await assert.rejects(codexControl(async()=>{throw Error('Unsupported native feature');},'chat','/goal'),/Unsupported native/);
  await assert.rejects(codexControl(call,'chat','/goal edit'),/neuen Ziel/);
  await assert.rejects(codexControl(call,'chat','/goal resume'),/normale Nachrichtenübergabe/);
  await assert.rejects(codexControl(call,'chat','/compact unintended'),/Kein unterstützter/);
});

test('composer keeps rejected drafts, isolates chat switches and can clear a running goal',async()=>{
  const calls=[];let cleared=0, reports=[];
  const context={workerId:'codex',running:true,chatId:'chat',sameWorker:true,attachments:[],
    api:async(url,body)=>{calls.push({url,body});return {message:'Cleared'};},setMode:()=>{},setBusy:()=>{},notify:()=>{},report:m=>reports.push(m),currentId:()=> 'other-chat',clearDraft:()=>cleared++};
  assert.equal(await submitComposerCommand('/goal clear',context),true);
  assert.equal(calls.length,1);assert.equal(cleared,0);
  await submitComposerCommand('/goal another goal',context);
  assert.equal(calls.length,1);assert.match(reports.at(-1),/laufende Antwort/);
  await assert.rejects(submitComposerCommand('/goal clear',{...context,api:async()=>{throw Error('Rejected');}}),/Rejected/);
  assert.equal(cleared,0);
  assert.equal(await submitComposerCommand('/ziel New objective',{...context,running:false}),false);
  assert.equal(await submitComposerCommand('/goal resume',{...context,running:false}),false);
  assert.equal(await submitComposerCommand('/future arg',{...context,workerId:'claw-code',running:false}),false);
});
