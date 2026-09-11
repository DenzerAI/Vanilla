import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChatAudio} from '../ui/chat-audio.mjs';
import {SpeechPlayback,holdMicrophone} from '../ui/speech-playback.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(options={}) {
 const played=[],players=[];
 const audio=new ChatAudio({...options,playerFactory:(_,changed)=>{
  const p={unlock:async()=>{},speak(text){played.push(text);changed('playing');return new Promise(r=>p.finish=()=>r(true));},pause(){changed('paused');},resume:async()=>{},close:async()=>{p.closed=true;p.finish?.();}};
  players.push(p);return p;
 }});return {audio,played,players};
}
const event=(id,text,phase='commentary',threadId='a')=>({method:'item/completed',params:{threadId,turnId:'t',item:{id,type:'agentMessage',text,phase}}});
test('follow survives navigation, deduplicates completed events, ignores tools and other chats, bounds backlog',async()=>{
 const {audio,played,players}=fixture();
 await audio.start(null,{chatId:'a',title:'A',mode:'follow'});
 audio.event(event('1','One.'));audio.event(event('1','One.'));
 audio.event(event('x','Other.','commentary','b'));
 audio.event({method:'item/completed',params:{threadId:'a',item:{id:'tool',type:'reasoning',text:'private'}}});
 audio.event(event('2','Old.'));audio.event(event('3','Latest.'));
 players[0].finish();await tick();assert.deepEqual(played,['One.','Latest.']);
 audio.event(event('4','Final.','final'));players[0].finish();await tick();
 assert.equal(played.at(-1),'Final.');players[0].finish();await tick();assert.equal(audio.state.status,'waiting');audio.stop();
});
test('pause drops commentary, retains final, expires, and switching disables prior session',async()=>{
 const {audio,played,players}=fixture({pauseMs:20});
 await audio.start(null,{chatId:'a',mode:'follow'});audio.pause();
 audio.event(event('1','Old.'));audio.event(event('2','Result.','final'));
 assert.deepEqual(played,[]);await audio.resume();assert.deepEqual(played,['Result.']);
 await audio.start(null,{chatId:'b',text:'B.'});assert.ok(players[0].closed);
 audio.event(event('3','Wrong.'));assert.deepEqual(played,['Result.','B.']);
 audio.pause();await new Promise(r=>setTimeout(r,30));assert.equal(audio.state.chatId,undefined);
});
test('pending synthesis stays silent during dictation; cancel and replacement discard delayed audio',async()=>{
 let count=0;
 globalThis.AudioContext=class {
  state='running';sampleRate=24000;destination={};
  createBuffer(){return {};}
  createBufferSource(){return {connect(){},start(){count++;},stop(){this.onended?.();}};}
  async suspend(){this.state='suspended';} async resume(){this.state='running';}
  async decodeAudioData(){return {};}
  async close(){}
 };
 let resolve;
 const p=new SpeechPlayback(()=>new Promise(r=>resolve=r));
 const result=p.speak('Hi.');await tick();const release=holdMicrophone('test');
 resolve({audio:'AA=='});await tick();assert.equal(count,1); // Only silent gesture priming.
 await assert.rejects(p.resume(),/Diktat/);release();assert.equal(p.paused,true);
 p.cancel();assert.equal(await result,false);await p.close();delete globalThis.AudioContext;
});
test('locking narrated chat stops it',async()=>{
 const {audio}=fixture();await audio.start(null,{chatId:'a',mode:'follow'});
 audio.event({method:'chat/privacy',params:{id:'a'}});assert.equal(audio.state.chatId,undefined);
});
