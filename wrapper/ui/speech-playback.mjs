// Only final assistant prose is read; tools, reasoning and fenced code stay silent.
export function spokenText(text) {
  return String(text || '').replace(/```[\s\S]*?```/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[*_`#>]/g,'').trim();
}
export function speechChunks(text, max = 2000) {
  let remaining = spokenText(text); const parts=[];
  while(remaining.length) { let end=Math.min(max,remaining.length); if(end<remaining.length) { const space=remaining.lastIndexOf(' ',end); if(space>max/2) end=space; } parts.push(remaining.slice(0,end)); remaining=remaining.slice(end).trimStart(); }
  return parts;
}
export class SpeechPlayback {
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
  cancel() { this.generation++; this.source?.stop(); this.source=null; this.onState('idle'); }
  async close() { this.cancel(); await this.context?.close(); this.context=null; this.primed=false; }
  async speak(text) {
    this.cancel(); const generation=this.generation;
    try { await this.unlock(); } catch { throw new Error('Wiedergabe freigeben: Bitte auf Vorlesen klicken.'); }
    try {
      for(const part of speechChunks(text)) {
        if(generation!==this.generation) return false;
        this.onState('loading');
        const r=await this.api('/speech/synthesize',{text:part});
        if(generation!==this.generation) return false;
        const raw=Uint8Array.from(atob(r.audio),c=>c.charCodeAt(0));
        const decoded=await this.context.decodeAudioData(raw.buffer);
        if(generation!==this.generation) return false;
        if(this.context.state!=='running') throw new Error('Wiedergabe pausiert. Bitte erneut auf Vorlesen klicken.');
        const source=this.context.createBufferSource(); source.buffer=decoded; source.connect(this.context.destination); this.source=source;
        this.onState('playing');
        await new Promise(resolve=> {source.onended=resolve;source.start();});
        if(this.source===source) this.source=null;
      }
      return generation===this.generation;
    } finally { if(generation===this.generation) this.onState('idle'); }
  }
}
