import test from 'node:test';
import assert from 'node:assert/strict';
import {InboxDrafts,inboxConversation} from '../ui/inbox-data.mjs';

test('drafts survive thread navigation, serialize revisions and stop on conflicts',async()=>{
  const writes=[];
  const drafts=new InboxDrafts(async(_route,b)=>{writes.push(b);await new Promise(r=>setImmediate(r));return {version:b.version+1};},'project-a');
  drafts.load('one',{text:'',version:3,revision:7});
  const pending=drafts.edit('one','First');
  drafts.load('two',{text:'Second',version:1,revision:2});
  await pending;
  assert.deepEqual(writes[0],{id:'one',projectId:'project-a',text:'First',version:3,revision:7});
  assert.equal(drafts.records.get('one').version,4);
  drafts.api=async()=>{throw Error('Conflict');};
  await drafts.edit('one','Keep my text');
  await drafts.edit('one','Latest local text');
  assert.equal(writes.length,1);
  assert.equal(drafts.records.get('one').text,'Latest local text');
  assert.equal(drafts.pending,true);
  assert.equal(drafts.load('one',{text:'stale'}).text,'Latest local text');
});

test('real inbox rows derive unread state from the acknowledged revision',()=>{
  const c=inboxConversation({id:'t',provider:'gmail',address:'synthetic@example.test',updated:'2026-09-09T10:00:00Z',revision:2,seen:1,done:0});
  assert.equal(c.provider,'Gmail');assert.equal(c.unread,true);assert.equal(c.done,false);
});
