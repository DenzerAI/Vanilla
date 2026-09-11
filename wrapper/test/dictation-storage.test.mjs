import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBObjectStore} from 'fake-indexeddb';
import {write,all,sync,recordingChunks} from '../ui/dictation-storage.mjs';

test('sync skips the archived audio payload and keeps all recordings recoverable',async()=>{
  await write('recordings',{id:'archived',finished:true,finishedSynced:true});
  await write('chunks',{key:'archived:0',id:'archived',seq:0,pcm:new Uint8Array([9,9]).buffer,synced:true});
  await write('recordings',{id:'pending',finished:true,count:2});
  for(let seq=0;seq<2;seq++)await write('chunks',{key:'pending:'+seq,id:'pending',seq,pcm:new Uint8Array([seq,1]).buffer,synced:false});
  const getAll=IDBObjectStore.prototype.getAll;
  const ranges=[];IDBObjectStore.prototype.getAll=function(range,...args){
    if(this.name==='chunks'){assert.ok(range,'audio archive must never be scanned');ranges.push(range.lower);}
    return getAll.call(this,range,...args);
  };
  const calls=[];
  try {
    await Promise.all([sync(async(url,data)=>{calls.push([url,data]);}),sync(async()=>assert.fail('must use shared pass'))]);
    assert.equal(calls.filter(([url])=>url==='/dictation/chunk').length,2);
    assert.equal(calls.filter(([url])=>url==='/dictation/finish').length,1);
    assert.deepEqual(ranges,['pending:']);
    await sync(async()=>assert.fail('already uploaded'));
    assert.equal((await recordingChunks('archived'))[0].pcm.byteLength,2);
    assert.equal((await recordingChunks('pending')).length,2);
    assert.equal((await all('recordings')).length,2);
  } finally {IDBObjectStore.prototype.getAll=getAll;}
});

test('failed upload retries without losing locally saved chunks',async()=>{
  await write('recordings',{id:'retry',finished:true,count:1});
  await write('chunks',{key:'retry:0',id:'retry',seq:0,pcm:new Uint8Array([1,2]).buffer,synced:false});
  await assert.rejects(sync(async url=>{if(url==='/dictation/chunk')throw Error('offline');}),/offline/);
  assert.equal((await recordingChunks('retry'))[0].synced,false);
  const calls=[];await sync(async url=>{calls.push(url);});
  assert.ok(calls.includes('/dictation/chunk'));assert.ok(calls.includes('/dictation/finish'));
  assert.equal((await recordingChunks('retry'))[0].synced,true);
});
