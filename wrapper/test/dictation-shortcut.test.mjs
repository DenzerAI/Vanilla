import test from 'node:test';
import assert from 'node:assert/strict';
import {bindDictationShortcut,shortcutCode,shortcutSettings} from '../ui/dictation-shortcut.mjs';
function fixture(mode='toggle',key='MetaRight'){
 const events={},calls=[];let state='idle',active=true;
 const target={addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
 const dispose=bindDictationShortcut(target,{key,mode,available:()=>active,phase:()=>state,start:()=>{calls.push('start');state='starting';},finish:()=>{calls.push('finish');state='saving';},cancelPending:()=>{calls.push('cancel');state='idle';}});
 const emit=(type,code=key,extra={})=>events[type]?.({code,...extra});
 return {calls,events,dispose,emit,setState:v=>state=v,setActive:v=>active=v};
}
test('platform defaults and corrupt settings remain usable',()=>{
 assert.equal(shortcutCode('auto','MacIntel'),'MetaRight');assert.equal(shortcutCode('auto','Win32'),'ControlRight');
 assert.deepEqual(shortcutSettings('bad'),{key:'auto',mode:'toggle'});
 assert.deepEqual(shortcutSettings('{"key":"AltRight","mode":"invalid"}'),{key:'auto',mode:'toggle'});
});
test('one isolated press toggles on release and the second finishes into draft',()=>{
 const f=fixture();f.emit('keydown');assert.deepEqual(f.calls,[]);f.emit('keyup');assert.deepEqual(f.calls,['start']);
 f.setState('recording');f.emit('keydown');f.emit('keyup');assert.deepEqual(f.calls,['start','finish']);
});
test('repeats, left command, shortcuts and modifier-click do not toggle',()=>{
 for(const action of [f=>{f.emit('keydown','MetaLeft');f.emit('keyup','MetaLeft');},f=>{f.emit('keydown');f.emit('keydown','KeyC');f.emit('keyup');},f=>{f.emit('keydown');f.emit('pointerdown');f.emit('keyup');},f=>{f.emit('keydown','ShiftLeft');f.emit('keydown');f.emit('keyup');}]){
  const f=fixture();action(f);assert.deepEqual(f.calls,[]);
 }
 const f=fixture();f.emit('keydown');f.emit('keydown','MetaRight',{repeat:true});f.emit('keyup');assert.deepEqual(f.calls,['start']);
});
test('hold release while microphone permission is pending cancels late startup',()=>{
 const f=fixture('hold');f.emit('keydown');f.emit('keyup');assert.deepEqual(f.calls,['start','cancel']);
});
test('hold records until release or focus loss, preserving captured audio',()=>{
 for(const exit of ['keyup','blur']){const f=fixture('hold');f.emit('keydown');f.setState('recording');f.emit(exit);assert.deepEqual(f.calls,['start','finish']);}
});
test('inactive panes and recognition never start another recording',()=>{
 const f=fixture();f.setActive(false);f.emit('keydown');f.emit('keyup');assert.deepEqual(f.calls,[]);
 f.setActive(true);f.setState('recognizing');f.emit('keydown');f.emit('keyup');assert.deepEqual(f.calls,[]);
});
test('toggle recording survives pane deactivation and releases shortcut listeners',()=>{
 const f=fixture();f.emit('keydown');f.emit('keyup');f.setState('recording');f.dispose();assert.deepEqual(f.calls,['start']);assert.deepEqual(f.events,{});
 const other=fixture();other.setState('recording');other.dispose();assert.deepEqual(other.calls,[]);
});
test('Windows right Ctrl behaves the same and off installs no listeners',()=>{
 const f=fixture('toggle','ControlRight');f.emit('keydown');f.emit('keyup');assert.deepEqual(f.calls,['start']);
 const off=fixture('toggle','off');assert.deepEqual(off.events,{});
});
test('visibility interruption resets held state and allows the next explicit gesture',()=>{
 const f=fixture('hold');f.emit('keydown');f.dispose.interrupt();f.emit('keyup');f.emit('keydown');assert.deepEqual(f.calls,['start','cancel','start']);
});

test('completed shortcut does not retain ownership of a later mouse recording',()=>{
 const f=fixture();f.emit('keydown');f.emit('keyup');f.setState('idle');f.dispose.releaseOwnership();
 f.setState('recording');f.emit('blur');assert.deepEqual(f.calls,['start']);
});

// Exercise the actual component boundaries with controlled async replies, as in
// composer-dictation.test.mjs. No microphone, worker or live message is involved.
const {readFile}=await import('node:fs/promises');
const component=await readFile(new URL('../ui/dictation.jsx',import.meta.url),'utf8');
const controlSource=component.slice(component.indexOf('  useImperativeHandle(controlRef,'),component.indexOf('  useEffect(()=>{if(autoStart)'));
function paneControl(initial='idle'){
 const calls=[],phaseRef={current:initial};let control;
 const env={controlRef:{},phaseRef,generation:{current:1},setPhase:phase=>{phaseRef.current=phase;calls.push(phase);},
  stopRef:{current:(...args)=>{calls.push(args);phaseRef.current='saving';}},end:()=>{calls.push('end');phaseRef.current='idle';},useImperativeHandle:(_ref,factory)=>control=factory()};
 new Function(...Object.keys(env),controlSource)(...Object.values(env));return {control,calls,phaseRef};
}
test('explicit direct finish submits only once and capsule finish requests a draft',()=>{
 const s=paneControl('recording');s.control.finish(true);s.control.finish(true);assert.deepEqual(s.calls,[[false,true,true]]);
 const draft=paneControl('recording');draft.control.finish();assert.deepEqual(draft.calls,[[false,true,false]]);
});
test('pending permission is cancellable and processing cannot trigger another finish',()=>{
 const starting=paneControl('starting');starting.control.finish();assert.deepEqual(starting.calls,['idle']);
 const paused=paneControl('paused');paused.control.finish();assert.deepEqual(paused.calls,[[false,true,false]]);
 for(const phase of ['saving','recognizing','waiting']){const s=paneControl(phase);s.control.finish();assert.deepEqual(s.calls,[]);}
});
test('Escape cancels recording and recognition but never recalls an already submitted message',()=>{
 for(const phase of ['starting','recording','paused','saving','recognizing']){const s=paneControl(phase);assert.equal(s.control.cancel(),true);assert.deepEqual(s.calls,['end']);}
 for(const phase of ['idle','waiting']){const s=paneControl(phase);assert.equal(s.control.cancel(),false);assert.deepEqual(s.calls,[]);}
});
const transcribeSource=component.slice(component.indexOf('  async function transcribe('),component.indexOf('  async function stop('));
async function recognitionScenario(change){
 let release,requested;const pending=new Promise(resolve=>release=resolve),started=new Promise(resolve=>requested=resolve),calls=[];
 const generation={current:1},mounted={current:true},latest={current:{chatId:'original',running:false,onSendText:async text=>calls.push(['send',text]),onText:text=>calls.push(['draft',text])}};
 const env={generation,mounted,latest,canSend:()=>latest.current.chatId==='original',onText:text=>calls.push(['draft',text]),setPhase:()=>{},setIssue:message=>calls.push(['issue',message]),delay:async()=>{},api:async path=>{if(path==='/dictation/transcribe')return {};requested();await pending;return {recordings:[{id:'recording',text:'Beispiel'}]};}};
 const transcribe=new Function(...Object.keys(env),`${transcribeSource};return transcribe;`)(...Object.values(env));
 const result=transcribe('recording',1,null,true);await started;change?.({generation,mounted,latest});release();await result;return calls;
}
test('late recognition is ignored after Escape or unmount',async()=>{
 for(const change of [s=>s.generation.current++,s=>s.mounted.current=false])assert.deepEqual(await recognitionScenario(change),[]);
});
test('recognition sends once to the original chat and busy chats keep a draft',async()=>{
 assert.deepEqual(await recognitionScenario(),[['send','Beispiel']]);
 const calls=await recognitionScenario(s=>s.latest.current.running=true);assert.equal(calls[0][0],'draft');assert.ok(calls.every(c=>c[0]!=='send'));
});

test('chat change during explicit direct recognition falls back to the bound original draft',async()=>{
 assert.deepEqual(await recognitionScenario(s=>s.latest.current.chatId='other'),[['draft','Beispiel']]);
});
