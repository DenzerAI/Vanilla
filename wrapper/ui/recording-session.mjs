// One explicit dictation per application tab. Navigation only moves its controls.
export function createRecordingSession() {
  let state = {source:null, phase:'idle', revision:0};
  const listeners = new Set(), anchors = new Map();
  const emit = change => {state = {...state, ...change, revision:state.revision+1};listeners.forEach(fn=>fn());};
  return {
    snapshot:()=>state,
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    anchors,
    register(id, anchor){anchors.set(id,anchor);emit({});return()=>{anchors.delete(id);emit({});};},
    start(source){if(state.source)return false;emit({source,phase:'starting'});return true;},
    phase(phase){if(state.source && state.phase!==phase)emit({phase});},
    restrict(chatId){if(!state.source || !chatId || state.source.props?.chatId!==chatId)return false;emit({source:{...state.source,title:'Privater Chat'}});return true;},
    done(){emit({source:null,phase:'idle'});},
  };
}

export function appendDictation(cache, origin, current, setText, transcript) {
  const append = text => text ? text+'\n'+transcript : transcript;
  if(origin===current) setText(append);
  else {const saved=cache.get(origin)||{};cache.set(origin,{...saved,text:append(saved.text)});}
}
