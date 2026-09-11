import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPaneShortcuts,parsePaneShortcuts,matchPaneShortcut,validPaneShortcut,shortcutFromEvent} from '../ui/pane-shortcuts.mjs';
import {visiblePanes} from '../ui/chat-layout.mjs';
import {bindDictationShortcut} from '../ui/dictation-shortcut.mjs';
test('default digit codes select all four fixed pane identities even with shifted characters',()=>{
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
