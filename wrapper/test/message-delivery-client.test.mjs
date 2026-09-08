import test from 'node:test';
import assert from 'node:assert/strict';
import { stageMessage, deliverMessage, localMessages, reconcileLocal } from '../ui/message-delivery-client.mjs';
test('browser persists before HTTP; lost response retains identity, other tabs and chats keep their entries', async () => {
  const values=new Map();
  globalThis.localStorage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k),key:i=>[...values.keys()][i],get length(){return values.size;}};
  globalThis.window={dispatchEvent:()=>{}};
  try {
    const a={id:'chat-a',messageId:'message-a',text:'first'},b={id:'chat-b',messageId:'message-b',text:'second'};
    stageMessage(a);stageMessage(b);
    await assert.rejects(deliverMessage(async()=>{throw Error('connection lost');},a));
    assert.deepEqual(localMessages('chat-a'),[a]);assert.deepEqual(localMessages('chat-b'),[b]);
    // Reconnect reads the authoritative ledger; no worker call is repeated.
    reconcileLocal([{id:a.messageId,status:'unknown'}]);assert.deepEqual(localMessages('chat-a'),[]);assert.deepEqual(localMessages('chat-b'),[b]);
    await deliverMessage(async(_url,body)=>{assert.equal(body.messageId,b.messageId);return {message:{status:'waiting'}};},b);
    assert.equal(values.size,0);
  } finally {delete globalThis.localStorage;delete globalThis.window;}
});
