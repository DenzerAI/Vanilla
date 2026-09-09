import {submitMessage} from '../ui/message-submit.mjs';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const source=await readFile(new URL('../ui/app.jsx', import.meta.url),'utf8');
// Exercise the production submit boundary without mounting the full application.
// The JSX app keeps this function local; no network or worker is used here.
assert.ok(source.includes('  async function submit('));
assert.ok(source.includes('  async function upload('));
const submit=source.slice(source.indexOf('  async function submit('),source.indexOf('  async function upload('));
async function scenario({fail=false,busy=false,upload=false}={}) {
 let draft='Vorhandener Entwurf',files=[{name:'Beispiel.txt',path:'input/example.txt'}],calls=[];
 const cache=new Map(),storage={getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)};
 const env={submitMessage:(api,id,body)=>submitMessage(api,id,body,storage),text:draft,attachments:files,busy,running:false,nextSelection:null,pickerModel:'test-model',pickerEffort:'medium',mode:'default',chatId:'test-chat',draftKey:()=> 'test-chat',uploadCounts:{current:new Map(upload?[['test-chat',1]]:[])},setText:v=>{draft=typeof v==='function'?v(draft):v;},setAttachments:v=>{files=v;},setBusy:()=>{},notify:()=>{},followScroll:{current:false},chatRef:{current:'test-chat'},setThread:()=>{},active:{},inputRef:{current:null},api:async(path,body)=>{calls.push({path,body});if(fail)throw new Error('Send failed');return {};}};
 const fn=new Function(...Object.keys(env),`${submit}; return submit;`)(...Object.values(env));
 try {await fn(undefined,'Zweite Aufnahme',true);}catch(e){assert.match(e.message,/Send failed|beschäftigt|angeheftet/);}
 return {draft,files,calls};
}
test('direct dictation submits existing draft and attachments exactly once', async () => {
  const s=await scenario();
  assert.equal(s.calls.length,1);
  assert.equal(s.calls[0].path,'/turn');
  assert.equal(s.calls[0].body.text,'Vorhandener Entwurf\nZweite Aufnahme');
  assert.equal(s.calls[0].body.attachments[0].name,'Beispiel.txt');
  assert.equal(s.draft,'');assert.deepEqual(s.files,[]);
});
test('failed direct delivery retains combined draft and attachments without retry', async () => {
  const s=await scenario({fail:true});
  assert.equal(s.calls.length,1);
  assert.equal(s.draft,'Vorhandener Entwurf\nZweite Aufnahme');
  assert.equal(s.files.length,1);
});
test('busy composer and pending attachments preserve recognized text without sending', async () => {
  for(const options of [{busy:true},{upload:true}]) {
    const s=await scenario(options);
    assert.equal(s.calls.length,0);
    assert.equal(s.draft,'Vorhandener Entwurf\nZweite Aufnahme');
    assert.equal(s.files.length,1);
  }
});
