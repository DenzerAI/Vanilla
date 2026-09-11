import test from 'node:test';
import assert from 'node:assert/strict';
import {createLatestRead} from '../ui/latest-read.mjs';

test('switching history aborts the obsolete request without cancelling another pane',async()=>{
  const calls=[];
  const load=(url,signal)=>new Promise((resolve,reject)=>{
    calls.push({url,signal,resolve});signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  });
  const firstPane=createLatestRead(load),secondPane=createLatestRead(load);
  const old=firstPane.read('old');const rejected=assert.rejects(old,{name:'AbortError'});
  const independent=secondPane.read('other-pane');
  const latest=firstPane.read('latest');
  await rejected;
  assert.equal(calls[0].signal.aborted,true);assert.equal(calls[1].signal.aborted,false);assert.equal(calls[2].signal.aborted,false);
  calls[1].resolve('other');calls[2].resolve('fresh');
  assert.deepEqual(await Promise.all([independent,latest]),['other','fresh']);
});

test('leaving a pane cancels its read and a later visit can read again',async()=>{
  let resolve;
  const reader=createLatestRead((url,signal)=>new Promise((done,reject)=>{resolve=done;signal.addEventListener('abort',()=>reject(signal.reason));}));
  const old=reader.read('chat'),rejected=assert.rejects(old,{name:'AbortError'});
  reader.cancel();await rejected;
  const fresh=reader.read('chat');resolve('ok');assert.equal(await fresh,'ok');
});


test('returning to the same chat cannot let an obsolete read replace its successor',async()=>{
  const calls=[];
  const reader=createLatestRead(()=>new Promise(resolve=>calls.push(resolve)));
  const first=reader.read('A'),middle=reader.read('B'),last=reader.read('A');
  calls[2]('fresh');await last;
  calls[0]('stale');calls[1]('irrelevant');await Promise.all([first,middle]);
  assert.equal(first.isCurrent(),false);assert.equal(middle.isCurrent(),false);assert.equal(last.isCurrent(),true);
  reader.cancel();assert.equal(last.isCurrent(),false);
});
