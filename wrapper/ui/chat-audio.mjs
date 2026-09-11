import {SpeechPlayback, spokenText, onMicrophoneChange, microphoneBusy, onPlaybackStart} from './speech-playback.mjs';

// One owner per app tab, independent of mounted messages, panels and navigation.
export class ChatAudio {
  constructor({playerFactory=(api,changed)=>new SpeechPlayback(api,changed), pauseMs=300000}={}) {
    this.playerFactory=playerFactory; this.pauseMs=pauseMs; this.listeners=new Set();
    /** @type {{chatId?:string,title?:string,mode?:string,key?:string,status?:string,error?:string}} */
    this.state={}; this.pending=new Map(); this.queue=[]; this.seen=new Set(); this.revision=0;
  }
  subscribe=(fn)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
  snapshot=()=>this.state;
  emit(patch) { this.state={...this.state,...patch}; for(const fn of this.listeners) fn(); }
  stop=()=>{
    this.revision++; clearTimeout(this.timer); this.queue=[]; this.seen.clear(); this.pending.clear();
    const player=this.player; this.player=null; void player?.close().catch(()=>{});
    this.state={}; for(const fn of this.listeners) fn();
  };
  async start(api,{chatId,title,mode='message',key,text}) {
    if(microphoneBusy()) throw new Error('Bitte zuerst das Diktat beenden.');
    this.stop(); const revision=this.revision;
    this.emit({chatId,title,mode,key,status:'loading',error:''});
    this.player=this.playerFactory(api,status=>{
      if(revision!==this.revision) return;
      if(status==='paused') this.armPause();
      if(status!=='idle') this.emit({status});
    });
    this.player.onReplaced=this.stop; this.player.claim?.();
    try { await this.player.unlock(); }
    catch(error) { if(revision===this.revision) this.fail(error); return; }
    if(revision!==this.revision) return;
    if(text) this.queue.push(text);
    if(microphoneBusy() || this.state.status==='paused') this.pause();
    else if(mode==='follow'&&!text) this.emit({status:'waiting'});
    void this.drain();
  }
  fail(error) { this.stop(); this.emit({error:error.message||'Vorlesen fehlgeschlagen.'}); }
  armPause() { clearTimeout(this.timer); this.timer=setTimeout(this.stop,this.pauseMs); }
  pause=()=>{
    if(!this.player||this.state.status==='paused') return;
    this.player.pause(); this.emit({status:'paused'}); this.armPause();
  };
  resume=async()=>{
    if(!this.player) return;
    if(microphoneBusy()) { this.emit({error:'Bitte zuerst das Diktat beenden.'}); return; }
    clearTimeout(this.timer); this.emit({error:''});
    try { await this.player.resume(); if(!this.draining) {this.emit({status:'waiting'}); void this.drain();} }
    catch(error) { this.fail(error); }
  };
  async drain() {
    if(this.draining===this.revision+1 || this.state.status==='paused') return;
    const revision=this.revision, token=revision+1; this.draining=token;
    try {
      while(this.queue.length && revision===this.revision && this.state.status!=='paused') {
        const text=this.queue.shift();
        if(!await this.player.speak(text)) return;
      }
      if(revision===this.revision && this.state.status!=='paused') {
        if(this.state.mode==='message') this.stop();
        else this.emit({status:'waiting'});
      }
    } catch(error) { if(revision===this.revision) this.fail(error); }
    finally { if(this.draining===token) this.draining=0; }
  }
  event(event) {
    const p=event.params||{};
    if(event.method==='chat/privacy' && p.id===this.state.chatId) {this.stop();return;}
    if(this.state.mode!=='follow'||p.threadId!==this.state.chatId) return;
    if(event.method==='item/agentMessage/delta') {
      const item=this.pending.get(p.itemId)||{id:p.itemId,type:'agentMessage',text:''};
      item.text+=p.delta||''; this.pending.set(p.itemId,item); return;
    }
    if(event.method==='item/started') {
      // ACP closes a prose segment by starting a tool, rather than emitting item/completed.
      for(const [id,item] of this.pending) if(id!==p.item?.id) {
        this.pending.delete(id);
        this.event({method:'item/completed',params:{...p,item:{...item,phase:item.phase||'commentary'}}});
      }
      if(p.item?.type==='agentMessage') this.pending.set(p.item.id,{...p.item});
      return;
    }
    const items=event.method==='item/completed'?[p.item]:event.method==='turn/completed'?p.turn?.items||[]:[];
    for(const item of items) {
      if(item?.type!=='agentMessage'||!item.id||!spokenText(item.text)) continue;
      const key=`${p.turnId||p.turn?.id}:${item.id}`;
      if(this.seen.has(key)) continue;
      this.seen.add(key); this.pending.delete(item.id);
      // While paused, discard commentary. Keep the latest result for resuming.
      if(item.phase==='commentary' && this.state.status==='paused') continue;
      this.queue=[item.text];
    }
    if(this.queue.length) void this.drain();
  }
}
export const chatAudio=new ChatAudio();
onMicrophoneChange(busy=>{if(busy)chatAudio.pause();});

onPlaybackStart(player=>{if(chatAudio.player && chatAudio.player!==player) chatAudio.stop();});
