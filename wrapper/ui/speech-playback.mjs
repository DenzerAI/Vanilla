// Only assistant prose is read; tools, reasoning and fenced code stay silent.
export function spokenText(text) {
  return String(text || '').replace(/```[\s\S]*?```/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[*_`#>]/g,'').trim();
}
export function speechChunks(text, max = 2000) {
  let remaining = spokenText(text); const parts=[];
  while(remaining.length) { let end=Math.min(max,remaining.length); if(end<remaining.length) { const space=remaining.lastIndexOf(' ',end); if(space>max/2) end=space; } parts.push(remaining.slice(0,end)); remaining=remaining.slice(end).trimStart(); }
  return parts;
}
let activePlayback = null;
const playbackListeners = new Set();
export function onPlaybackStart(listener) { playbackListeners.add(listener); return () => playbackListeners.delete(listener); }
const microphoneOwners = new Set();
const microphoneListeners = new Set();
export const microphoneBusy = () => microphoneOwners.size > 0;
export function onMicrophoneChange(listener) { microphoneListeners.add(listener); return () => microphoneListeners.delete(listener); }
export function holdMicrophone(owner) {
  microphoneOwners.add(owner);
  activePlayback?.pause();
  for (const listener of microphoneListeners) listener(true);
  return () => { microphoneOwners.delete(owner); for (const listener of microphoneListeners) listener(microphoneBusy()); };
}
export class SpeechPlayback {
  /** @param {any} api @param {(state: string) => void} onState */
  constructor(api, onState=()=>{}) { this.api=api; this.onState=onState; this.generation=0; }
  async unlock() {
    this.context ||= new AudioContext();
    // WebKit needs an actual source started by the user's gesture, not only resume().
    if (!this.primed) {
      const source=this.context.createBufferSource();
      source.buffer=this.context.createBuffer(1,1,this.context.sampleRate);
      source.connect(this.context.destination);source.start();this.primed=true;
    }
    if (this.context.state!=='running') await this.context.resume();
  }
  claim() {
    if(activePlayback && activePlayback!==this) { const previous=activePlayback; previous.cancel(); previous.onReplaced?.(); }
    activePlayback=this;
    for(const listener of playbackListeners) listener(this);
  }
  pause() {
    if(this.paused) return;
    this.paused=true;
    this.resumeGate=new Promise(resolve=>{this.releasePause=resolve;});
    void this.context?.suspend().catch(()=>{});
    this.onState('paused');
  }
  async resume() {
    if(microphoneBusy()) throw new Error('Bitte zuerst das Diktat beenden.');
    const generation=this.generation;
    await this.unlock();
    if(generation!==this.generation) return;
    if(microphoneBusy()) { await this.context?.suspend(); throw new Error('Bitte zuerst das Diktat beenden.'); }
    this.paused=false; this.releasePause?.(); this.releasePause=null;
    this.onState(this.source?'playing':'loading');
  }
  cancel() { this.paused=false; this.releasePause?.(); this.releasePause=null; if(activePlayback===this) activePlayback=null; this.generation++; this.source?.stop(); this.source=null; this.onState('idle'); }
  async close() { this.cancel(); await this.context?.close(); this.context=null; this.primed=false; }
  async speak(text) {
    if(microphoneBusy()) throw new Error('Bitte zuerst das Diktat beenden.');
    if(activePlayback && activePlayback!==this) { const previous=activePlayback; previous.cancel(); previous.onReplaced?.(); }
    this.cancel(); this.claim(); const generation=this.generation;
    this.onState('loading');
    try {
      try { await this.unlock(); } catch { if(generation!==this.generation) return false; throw new Error('Wiedergabe freigeben: Bitte auf Vorlesen klicken.'); }
      if(microphoneBusy()) this.pause();
      for(const part of speechChunks(text)) {
        if(this.paused) await this.resumeGate;
        if(generation!==this.generation) return false;
        this.onState('loading');
        const r=await this.api('/speech/synthesize',{text:part});
        if(generation!==this.generation) return false;
        const raw=Uint8Array.from(atob(r.audio),c=>c.charCodeAt(0));
        const decoded=await this.context.decodeAudioData(raw.buffer);
        if(generation!==this.generation) return false;
        if(this.paused) await this.resumeGate;
        if(generation!==this.generation) return false;
        if(this.context.state!=='running') throw new Error('Wiedergabe pausiert. Bitte erneut auf Vorlesen klicken.');
        const source=this.context.createBufferSource(); source.buffer=decoded; source.connect(this.context.destination); this.source=source;
        this.onState('playing');
        await new Promise(resolve=> {source.onended=resolve;source.start();});
        if(this.source===source) this.source=null;
      }
      return generation===this.generation;
    } catch(error) { if(generation!==this.generation) return false; throw error;
    } finally { if(generation===this.generation) { if(activePlayback===this) activePlayback=null; this.onState('idle'); } }
  }
}
