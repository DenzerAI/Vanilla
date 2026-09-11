export const dictationShortcutKey = 'agent-dictation-shortcut-v1';
export const dictationShortcutEvent = 'agent-dictation-shortcut-change';
export function shortcutSettings(raw) {
  let value; try { value = JSON.parse(raw); } catch {}
  return {key:['auto','MetaRight','ControlRight','off'].includes(value?.key)?value.key:'auto', mode:value?.mode==='hold'?'hold':'toggle'};
}
export function shortcutCode(key, platform = '') {
  return key === 'auto' ? (/Mac|iPhone|iPad/.test(platform)?'MetaRight':'ControlRight') : key;
}

// A lone modifier toggles on release, so Command/Ctrl chords remain ordinary shortcuts.
// Hold mode owns its recording until release, focus loss or pane deactivation.
export function bindDictationShortcut(target, {key,mode,available,phase,start,finish,cancelPending}) {
  let pressed=false, chord=false, owned=false;
  const held=new Set();
  function endOwned() {
    if (!owned) return;
    owned=false;
    if (phase()==='starting') cancelPending();
    else if (['recording','paused'].includes(phase())) finish();
  }
  function begin() { owned=true; start(); }
  function reset() { pressed=false;chord=false;held.clear();endOwned(); }
  function down(event) {
    held.add(event.code);
    if(event.code!==key) {
      if(pressed){chord=true;if(mode==='hold')endOwned();}
      return;
    }
    if(event.repeat || pressed || event.isComposing || !available())return;
    const other = event.altKey || event.shiftKey || (key==='MetaRight'?event.ctrlKey:event.metaKey);
    if(other || held.size>1)return;
    pressed=true;chord=false;
    if(mode==='hold' && phase()==='idle')begin();
  }
  function up(event) {
    held.delete(event.code);
    if(event.code!==key || !pressed)return;
    pressed=false;
    if(key==='MetaRight')held.clear();
    if(mode==='hold'){endOwned();return;}
    if(chord || event.isComposing || !available())return;
    if(phase()==='idle')begin();
    else if(phase()==='starting'){owned=false;cancelPending();}
    else if(['recording','paused'].includes(phase())){owned=false;finish();}
  }
  if(key==='off')return ()=>{};
  const pointer=()=>{if(pressed){chord=true;if(mode==='hold')endOwned();}};
  target.addEventListener('pointerdown',pointer);
  target.addEventListener('keydown',down);target.addEventListener('keyup',up);target.addEventListener('blur',reset);
  const dispose=()=>{target.removeEventListener('pointerdown',pointer);target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);target.removeEventListener('blur',reset);reset();};
  dispose.interrupt=reset;
  dispose.releaseOwnership=()=>{owned=false;};
  return dispose;
}
