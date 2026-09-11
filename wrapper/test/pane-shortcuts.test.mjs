import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPaneShortcuts,defaultPaneShortcuts,parsePaneShortcuts,matchPaneShortcut,validPaneShortcut,shortcutFromEvent} from '../ui/pane-shortcuts.mjs';
import {visiblePanes,selectPaneCount} from '../ui/chat-layout.mjs';
import {bindDictationShortcut} from '../ui/dictation-shortcut.mjs';
test('default digit codes select all four configured positions even with shifted characters',()=>{
 for(let n=1;n<=4;n++)assert.equal(matchPaneShortcut({code:`Digit${n}`,key:['!','@','#','$'][n-1],ctrlKey:true,shiftKey:true},defaultPaneShortcuts()),n-1);
 assert.equal(matchPaneShortcut({code:'Digit2',ctrlKey:true},defaultPaneShortcuts()),-1);
 assert.equal(matchPaneShortcut({code:'Digit2',ctrlKey:true,shiftKey:true,altKey:true},defaultPaneShortcuts()),-1);
});
test('repeats, composition and handled events do not move focus',()=>{
 for(const flag of ['repeat','isComposing','defaultPrevented'])assert.equal(matchPaneShortcut({code:'Digit2',ctrlKey:true,shiftKey:true,[flag]:true},defaultPaneShortcuts()),-1);
});
test('custom function key, disabled pane and saved preferences survive roundtrip',()=>{
 const values=defaultPaneShortcuts();values[0]=shortcutFromEvent({code:'F13'});values[1]=null;
 assert.deepEqual(parsePaneShortcuts(JSON.stringify(values)),values);
 assert.equal(matchPaneShortcut({code:'F13'},values),0);
 assert.equal(matchPaneShortcut({code:'Digit2',ctrlKey:true,shiftKey:true},values),-1);
});
test('invalid, duplicate and reserved bindings restore a usable default',()=>{
 assert.deepEqual(parsePaneShortcuts('broken'),defaultPaneShortcuts());
 const duplicate=defaultPaneShortcuts();duplicate[1]=duplicate[0];assert.deepEqual(parsePaneShortcuts(JSON.stringify(duplicate)),defaultPaneShortcuts());
 assert.equal(validPaneShortcut(shortcutFromEvent({code:'KeyK',ctrlKey:true})),false);
 assert.equal(validPaneShortcut(shortcutFromEvent({code:'Digit1'})),false);
 assert.equal(validPaneShortcut(shortcutFromEvent({code:'KeyA',shiftKey:true})),false);
 assert.equal(validPaneShortcut(shortcutFromEvent({code:'MetaRight'})),false);
});
test('selected hidden pane becomes reachable at narrow widths and in maximized mode',()=>{
 assert.deepEqual(visiblePanes([0,1,2,3],3,390),[3]);
 assert.deepEqual(visiblePanes([0,1,2,3],2,1800,true),[2]);
});
test('right-Control pane chord does not toggle dictation on release',()=>{
 const events={},calls=[];
 const dispose=bindDictationShortcut({addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]}, {key:'ControlRight',mode:'toggle',available:()=>true,phase:()=> 'idle',start:()=>calls.push('start'),finish:()=>calls.push('finish'),cancelPending:()=>{}});
 events.keydown({code:'ControlRight',ctrlKey:true});events.keydown({code:'ShiftLeft',ctrlKey:true,shiftKey:true});events.keydown({code:'Digit2',ctrlKey:true,shiftKey:true});events.keyup({code:'Digit2',ctrlKey:true,shiftKey:true});events.keyup({code:'ShiftLeft',ctrlKey:true});events.keyup({code:'ControlRight'});
 assert.deepEqual(calls,[]);dispose();
});

function router(){
 const events={},frames=new Map(),calls=[];let active=0,next=0,allowed=true;
 const state={view:'chat',modal:null,order:[0,1,2,3],bindings:defaultPaneShortcuts(),activate:id=>{active=id;calls.push(['activate',id]);}};
 const sessions=state.order.map(id=>({id:`chat-${id}`,projectId:'example',focusComposer:()=>calls.push(['focus',id]),toggleDictation:()=>calls.push(['dictation',id]),cancelDictation:()=>{calls.push(['cancel',id]);return true;}}));
 const target={addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name]};
 const dispose=bindPaneShortcuts(target,{state:()=>state,available:()=>allowed,active:()=>active,session:id=>sessions[id],notify:message=>calls.push(['notice',message]),schedule:fn=>{frames.set(++next,fn);return next;},cancel:id=>frames.delete(id)});
 const press=(n,extra={})=>{const e={code:`Digit${n}`,ctrlKey:true,shiftKey:true,preventDefault(){this.defaultPrevented=true;},...extra};events.keydown(e);return e;};
 return {state,sessions,calls,events,press,dispose,allow:value=>allowed=value,flush:()=>{for(const [id,fn] of frames){frames.delete(id);fn();}}};
}
test('every pane gesture selects then invokes its own dictation, including a second press',()=>{
 const r=router();
 for(let n=1;n<=4;n++)for(let press=0;press<2;press++){
  r.calls.length=0;r.press(n);assert.deepEqual(r.calls,[['activate',n-1]]);
  r.flush();assert.deepEqual(r.calls,[['activate',n-1],['focus',n-1],['dictation',n-1]]);
 }
 r.dispose();assert.deepEqual(Object.keys(r.events),[]);
});
test('rapid switching starts only the last selected pane; repeats do not send again',()=>{
 const r=router();r.press(1);r.press(3);r.press(3,{repeat:true});r.flush();
 assert.deepEqual(r.calls.filter(c=>c[0]==='dictation'),[['dictation',2]]);
});
test('Escape cancels a scheduled microphone start and targets the selected recording',()=>{
 const r=router();r.press(2);assert.equal(r.press(0,{key:'Escape'}).defaultPrevented,true);r.flush();
 assert.deepEqual(r.calls,[['activate',1],['cancel',1]]);
});
test('closed panes, dialogs, composition and background windows cannot start dictation',()=>{
 const r=router();r.state.order=[0];r.press(4);r.flush();assert.equal(r.calls[0][0],'notice');
 r.calls.length=0;r.state.modal='settings';r.press(1);r.state.modal=null;
 r.press(1,{isComposing:true});r.press(1,{defaultPrevented:true});r.allow(false);r.press(1);r.flush();assert.deepEqual(r.calls,[]);
});
test('chat replacement, lost focus or a newly opened dialog cancel deferred start',()=>{
 for(const change of [r=>r.sessions[0].id='other',r=>r.sessions[0].projectId='other',r=>r.events.blur(),r=>r.events.visibilitychange(),r=>r.state.modal='search',r=>r.allow(false),r=>r.state.view='settings']){
  const r=router();r.press(1);change(r);r.flush();assert.deepEqual(r.calls,[['activate',0]]);
 }
});

test('reducing four panes to one routes shortcut 1 to any retained active chat',()=>{
 for(let active=0;active<4;active++){
  const r=router();r.state.order=selectPaneCount([0,1,2,3],active,1);
  for(let press=0;press<2;press++){r.press(1);r.flush();}
  assert.deepEqual(r.calls.filter(c=>c[0]==='dictation'),[['dictation',active],['dictation',active]]);
  assert.ok(!r.calls.some(c=>c[0]==='notice'));
  r.press(0,{key:'Escape'});assert.deepEqual(r.calls.at(-1),['cancel',active]);
 }
});
test('one through four fields, gaps and reopened layouts follow displayed order',()=>{
 for(let active=0;active<4;active++)for(let count=1;count<=4;count++){
  const r=router();r.state.order=selectPaneCount([0,1,2,3],active,count);
  for(let n=1;n<=count;n++){r.press(n);r.flush();assert.deepEqual(r.calls.at(-1),['dictation',r.state.order[n-1]]);}
  if(count<4){r.press(count+1);r.flush();assert.equal(r.calls.at(-1)[0],'notice');}
  r.state.order=selectPaneCount(r.state.order,active,4);
  for(let n=1;n<=4;n++){r.press(n);r.flush();assert.deepEqual(r.calls.at(-1),['dictation',r.state.order[n-1]]);}
 }
 const r=router();r.state.order=[3,1];r.press(1);r.flush();assert.deepEqual(r.calls.at(-1),['dictation',3]);r.press(2);r.flush();assert.deepEqual(r.calls.at(-1),['dictation',1]);
});
test('layout remapping before deferred capture never starts the former position',()=>{
 const r=router();r.state.order=[2,3];r.press(1);r.state.order=[3,2];r.flush();assert.deepEqual(r.calls,[['activate',2]]);
});
