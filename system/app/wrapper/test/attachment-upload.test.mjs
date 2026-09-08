import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadAttachmentBatch } from '../ui/attachment-upload.mjs';
test('attachment batches retain their project and continue after size, read and network failures', async () => {
  const entries = [
    {name:'large',size:24000001}, {name:'unreadable',size:1},
    {name:'offline',size:1}, {name:'photo.png',size:24,type:'image/png'},
    {name:'notes.txt',size:5,type:'text/plain'}
  ].map((file,id)=>({file,id}));
  const sent=[], accepted=[], failed=[], finished=[];
  await uploadAttachmentBatch(entries, {
    projectId:'original-project',
    read:async file=>{if(file.name==='unreadable') throw Error('read');return 'encoded';},
    send:async body=>{sent.push(body);if(body.name==='offline')throw Error('network');return {name:body.name,path:'input/'+body.name};},
    success:(_entry,file)=>accepted.push(file), failure:entry=>failed.push(entry.id), finish:entry=>finished.push(entry.id)
  });
  assert.deepEqual(failed,[0,1,2]);
  assert.deepEqual(finished,[0,1,2,3,4]);
  assert.deepEqual(accepted.map(file=>[file.name,file.image]),[['photo.png',true],['notes.txt',false]]);
  assert.ok(sent.every(body=>body.projectId==='original-project'));
  assert.equal(sent.length,3);
});
