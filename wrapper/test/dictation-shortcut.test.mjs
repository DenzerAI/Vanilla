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
test('pane deactivation ends only a recording started by this keyboard owner',()=>{
 const f=fixture();f.emit('keydown');f.emit('keyup');f.setState('recording');f.dispose();assert.deepEqual(f.calls,['start','finish']);assert.deepEqual(f.events,{});
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
