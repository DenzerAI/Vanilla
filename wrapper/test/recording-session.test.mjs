import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecordingSession,appendDictation} from '../ui/recording-session.mjs';

test('navigation and a closed source pane never replace a live recording',()=>{
 const store=createRecordingSession(),source={key:'pane-0:chat-a',title:'Original'};
 const remove=store.register('composer',{key:source.key,visible:true,node:{}});
 assert.equal(store.start(source),true);store.phase('recording');remove();
 store.register('composer',{key:'pane-0:chat-b',visible:true,node:{}});
 assert.equal(store.snapshot().source,source);assert.equal(store.snapshot().phase,'recording');
 assert.equal(store.start({key:'pane-0:chat-b'}),false);
 store.phase('paused');assert.equal(store.snapshot().source,source);
 store.done();assert.equal(store.start({key:'pane-0:chat-b'}),true);
});
test('navigation while microphone permission or transcription is pending preserves its original owner',()=>{
 for(const phase of ['starting','recognizing','saving']) {
  const store=createRecordingSession();store.start({key:'origin'});store.phase(phase);
  const remove=store.register('pane',{key:'origin',visible:true});remove();
  store.register('pane',{key:'other',visible:true});
  assert.equal(store.snapshot().source.key,'origin');assert.equal(store.snapshot().phase,phase);
 }
});
test('transcription appends to the latest origin draft without changing other text or attachments',()=>{
 const file={name:'example.txt'},cache=new Map([['origin',{text:'Edited while recording',attachments:[file],scroll:140}]]);
 let other='Other chat';
 appendDictation(cache,'origin','other',next=>other=next(other),'Recording');
 assert.equal(other,'Other chat');assert.deepEqual(cache.get('origin'),{text:'Edited while recording\nRecording',attachments:[file],scroll:140});
});
test('returning before recognition finishes appends to the current input exactly once',()=>{
 let draft='Current revision';const cache=new Map([['origin',{text:'Old revision'}]]);
 appendDictation(cache,'origin','origin',next=>draft=next(draft),'Recording');
 assert.equal(draft,'Current revision\nRecording');
});
test('unsaved workspace drafts remain isolated across navigation',()=>{
 const cache=new Map();appendDictation(cache,'new:workspace-a','new:workspace-b',()=>assert.fail('wrong draft'),'Recording');
 assert.equal(cache.get('new:workspace-a').text,'Recording');assert.equal(cache.has('new:workspace-b'),false);
});
test('locking the origin redacts its global title without touching another recording',()=>{
 const store=createRecordingSession();store.start({key:'origin',title:'Original',props:{chatId:'chat-a'}});
 assert.equal(store.restrict('chat-b'),false);assert.equal(store.snapshot().source.title,'Original');
 assert.equal(store.restrict('chat-a'),true);assert.equal(store.snapshot().source.title,'Privater Chat');
});
