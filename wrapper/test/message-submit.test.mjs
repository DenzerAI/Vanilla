import test from 'node:test';
import assert from 'node:assert/strict';
import {submitMessage} from '../ui/message-submit.mjs';

test('lost response and reload reuse an opaque key; unknown dispatch is never resent',async()=>{
  const state=new Map(),storage={getItem:k=>state.get(k),setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)},calls=[];
  const api=async(_url,b)=>{calls.push(b);if(calls.length===1)throw Error('Lost response');return {message:{status:'unknown'}};};
  await assert.rejects(submitMessage(api,'chat',{text:'Synthetic message'},storage));
  await assert.rejects(submitMessage(api,'chat',{text:'Synthetic message'},storage),/unklar/);
  assert.equal(calls[0].messageId,calls[1].messageId);
  assert.doesNotMatch(JSON.stringify([...state]),/Synthetic message/);
  await submitMessage(async(_u,b)=>{assert.equal(b.messageId,calls[0].messageId);return {message:{status:'delivered'}};},'chat',{text:'Synthetic message'},storage);
  assert.equal(state.size,0);
});
