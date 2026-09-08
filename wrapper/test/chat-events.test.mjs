import test from 'node:test';
import assert from 'node:assert/strict';
import {createEventSubscription,reconnectEventStream} from '../ui/chat-events.mjs';

test('reauthentication reconnects one shared stream and preserves every chat subscription',()=>{
  const original=globalThis.EventSource, sources=[];
  globalThis.EventSource=class {
    readyState=0; listeners={};
    constructor(url){assert.equal(url,'/api/events');sources.push(this);}
    addEventListener(name,listener){this.listeners[name]=listener;}
    close(){this.readyState=2;}
  };
  const a=createEventSubscription(),b=createEventSubscription();
  try {
    const messagesA=[],messagesB=[];
    a.onmessage=e=>messagesA.push(e.data);b.onmessage=e=>messagesB.push(e.data);
    assert.equal(sources.length,1);
    sources[0].close(); // HTTP 401 permanently closes native EventSource.
    reconnectEventStream();
    assert.equal(sources.length,2);
    sources[1].listeners.message({data:'after-login'});
    assert.deepEqual(messagesA,['after-login']);assert.deepEqual(messagesB,['after-login']);
    a.close();sources[1].listeners.message({data:'remaining-chat'});
    assert.deepEqual(messagesA,['after-login']);assert.deepEqual(messagesB,['after-login','remaining-chat']);
    b.close();assert.equal(sources[1].readyState,2);
    reconnectEventStream();assert.equal(sources.length,2);
  } finally {a.close();b.close();globalThis.EventSource=original;}
});
