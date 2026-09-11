import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {addPresentationBridge,presentationBridge,presentationProtocol,presentationState} from '../html-presentation.mjs';
const channel='fixture-channel';
test('the preview channel rejects malformed counts, indices and unrelated messages',()=>{
 const state={protocol:presentationProtocol,channel,type:'state',count:3,index:1,presenting:true};
 assert.deepEqual(presentationState(state,channel),{count:3,index:1,presenting:true});
 for(const change of [{channel:'other'},{type:'exit'},{count:501},{count:-1},{index:3},{index:NaN},{index:1.5},{presenting:'yes'}])assert.equal(presentationState({...state,...change},channel),null);
 assert.deepEqual(presentationState({...state,count:0,index:0},channel),{count:0,index:0,presenting:true});
});
test('bridge insertion preserves standards mode and document content without accepting script injection',()=>{
 const original='<!DOCTYPE html><html><head><title>Übersicht</title></head><body>Original</body></html>';
 const result=addPresentationBridge(Buffer.from(original),channel).toString();
 assert.ok(result.startsWith('<!DOCTYPE html><script>'));assert.ok(result.endsWith(original.slice('<!DOCTYPE html>'.length)));
 assert.ok(addPresentationBridge(Buffer.from('<h1>Fragment</h1>'),channel).toString().startsWith('<!doctype html>'));
 for(const invalid of ['',null,'</script><script>alert(1)</script>','a'.repeat(81)])assert.throws(()=>addPresentationBridge(Buffer.from(original),invalid),/Vorschaukanal/);
});
function fixture(count=3){
 const listeners={},keys={},messages=[],scrollCalls=[];
 class Element {constructor(){this.hidden=false;this.attributes=new Set();this.parentElement=null;}closest(){return null;}toggleAttribute(name,on){on?this.attributes.add(name):this.attributes.delete(name);}hasAttribute(name){return this.attributes.has(name);}}
 const slides=Array.from({length:count},()=>new Element());
 const parent={postMessage:m=>messages.push(m)};
 const window={scrollX:12,scrollY:320,scrollTo:(x,y)=>scrollCalls.push([x,y]),addEventListener:(name,fn)=>listeners[name]=fn};
 const document={readyState:'complete',querySelectorAll:()=>slides,createElement:()=>({}),head:{append(){}},addEventListener:(name,fn)=>keys[name]=fn};
 vm.runInNewContext('('+presentationBridge.toString()+')('+JSON.stringify(channel)+')',{window,document,parent,Element});
 const send=(data,source=parent)=>listeners.message({source,data:{protocol:presentationProtocol,channel,...data}});
 return {slides,messages,scrollCalls,send,parent,keys,Element};
}
test('slides navigate within bounds and restore original hidden state and scroll position',()=>{
 const f=fixture();f.slides[2].hidden=true;
 f.send({type:'mode',presenting:true});assert.deepEqual(f.slides.map(s=>s.hidden),[false,true,true]);
 f.send({type:'navigate',action:'next'});assert.deepEqual(f.slides.map(s=>s.hidden),[true,false,true]);
 f.send({type:'navigate',action:'last'});f.send({type:'navigate',action:'next'});assert.equal(f.messages.at(-1).index,2);
 f.send({type:'mode',presenting:false});assert.deepEqual(f.slides.map(s=>s.hidden),[false,false,true]);assert.deepEqual(f.scrollCalls.at(-1),[12,320]);
 f.send({type:'navigate',action:'first'});assert.equal(f.messages.at(-1).index,2);
 f.send({type:'mode',presenting:true});assert.equal(f.slides[2].hidden,false);
});
test('unrelated windows and edit fields do not navigate; ordinary HTML is not turned into slides',()=>{
 const f=fixture();f.send({type:'mode',presenting:true},{});assert.equal(f.messages.at(-1).presenting,false);
 f.send({type:'mode',presenting:true});const target=new f.Element();target.closest=()=>true;
 f.keys.keydown({key:'ArrowRight',target});assert.equal(f.messages.at(-1).index,0);
 target.closest=()=>false;let prevented=false;f.keys.keydown({key:'ArrowRight',target,preventDefault(){prevented=true;}});assert.equal(f.messages.at(-1).index,1);assert.ok(prevented);
 const doc=fixture(0);doc.send({type:'mode',presenting:true});doc.send({type:'navigate',action:'next'});assert.equal(doc.messages.at(-1).count,0);assert.equal(doc.scrollCalls.length,0);
});

test('oversized decks stay ordinary documents instead of displaying uncounted extra slides',()=>{
 const f=fixture(501);f.send({type:'mode',presenting:true});assert.equal(f.messages.at(-1).count,0);assert.ok(f.slides.every(s=>!s.hidden));
});
