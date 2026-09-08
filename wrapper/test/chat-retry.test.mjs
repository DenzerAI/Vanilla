import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../ui/app.jsx',import.meta.url),'utf8');
const body=source.slice(source.indexOf('  async function revise('),source.indexOf('  async function saveSettings('));
function harness(api,extra={}) {
  const values={api,retryPending:{current:false},busy:false,running:false,setBusy(){},followScroll:{current:false},chatId:'original',model:'chosen',effort:'medium',mode:'execute',refreshChats(){throw Error('unexpected chat creation');},openChatHere(){throw Error('unexpected navigation');},setText(){throw Error('draft changed');},setAttachments(){throw Error('draft changed');},inputRef:{current:null},notify(){},...extra};
  return Function(...Object.keys(values),body+'; return revise;')(...Object.values(values));
}
const turn={id:'stopped',status:'interrupted',items:[{type:'userMessage',content:[{type:'text',text:'Bitte fortsetzen'},{type:'localImage',path:'/input/bild.png'}]}]};
test('retry a stopped turn in the original session without changing draft or making a copy',async()=>{
 const calls=[]; await harness(async(...args)=>calls.push(args))(turn,true);
 assert.deepEqual(calls,[['/turn',{id:'original',text:'Bitte fortsetzen',attachments:[{path:'/input/bild.png',name:'bild.png'}],model:'chosen',effort:'medium',mode:'execute'}]]);
});
test('double click is suppressed until request finishes and failures allow explicit retry',async()=>{
 let reject,calls=0; const state={current:false};
 const retry=harness(()=>{calls++;return new Promise((_,r)=>reject=r);},{retryPending:state});
 const first=retry(turn,true); await retry(turn,true); assert.equal(calls,1);
 reject(Error('offline')); await assert.rejects(first,/offline/); assert.equal(state.current,false);
});
test('running conversations do not retry',async()=>{
 await harness(()=>{throw Error('should not send');},{running:true})(turn,true);
});
test('fork from an older answer uses the next turn as the exclusive boundary',async()=>{
 const calls=[]; const code=source.slice(source.indexOf('  async function fork('),source.indexOf('  const retryPending'));
 const fork=Function('api','chatId','thread','refreshChats','openChatHere','notify',code+';return fork;')(async(...args)=>{calls.push(args);return {thread:{id:'branch'}};},'original',{turns:[{id:'a'},{id:'b'},{id:'c'}]},async()=>{},async()=>{},()=>{});
 await fork({id:'a'}); assert.deepEqual(calls,[['/fork',{id:'original',beforeTurnId:'b'}]]);
});
