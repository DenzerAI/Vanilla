export const paneShortcutKey='agent-pane-shortcuts-v1';
export const paneShortcutEvent='agent-pane-shortcuts-change';
const modifiers=['ctrlKey','shiftKey','altKey','metaKey'];
export const defaultPaneShortcuts=()=>[1,2,3,4].map(n=>({code:`Digit${n}`,ctrlKey:true,shiftKey:true,altKey:false,metaKey:false}));
export function shortcutFromEvent(event){return {code:event.code,...Object.fromEntries(modifiers.map(key=>[key,!!event[key]]))};}
export function validPaneShortcut(value){
 if(!value || !/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|F([1-9]|1[0-9]|2[0-4])|Arrow(Up|Down|Left|Right)|Space|Comma|Period|Slash|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote)$/.test(value.code))return false;
 if(modifiers.some(key=>typeof value[key]!=='boolean'))return false;
 if(!value.ctrlKey&&!value.altKey&&!value.metaKey&&!/^F\d+$/.test(value.code))return false;
 if((value.ctrlKey||value.metaKey)&&['KeyK','KeyN','Comma'].includes(value.code))return false;
 return true;
}
export function sameShortcut(a,b){return !!a&&!!b&&a.code===b.code&&modifiers.every(key=>a[key]===b[key]);}
export function parsePaneShortcuts(raw){
 let values;try{values=JSON.parse(raw);}catch{}
 if(!Array.isArray(values)||values.length!==4)return defaultPaneShortcuts();
 if(values.some((v,i)=>v!==null&&(!validPaneShortcut(v)||values.slice(0,i).some(old=>sameShortcut(old,v)))))return defaultPaneShortcuts();
 return values;
}
export function matchPaneShortcut(event,bindings){
 if(event.repeat||event.isComposing||event.defaultPrevented)return -1;
 return bindings.findIndex(value=>sameShortcut(value,shortcutFromEvent(event)));
}
export function shortcutLabel(value){
 if(!value)return 'Aus';
 const key=value.code.replace(/^Digit|^Key|^Numpad/,'').replace('Arrow','Pfeil ').replace('Space','Leertaste');
 return [value.ctrlKey&&'Ctrl',value.altKey&&'Alt / ⌥',value.shiftKey&&'Shift',value.metaKey&&'⌘ / Win',key].filter(Boolean).join(' + ');
}
