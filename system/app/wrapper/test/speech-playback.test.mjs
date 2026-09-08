import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechPlayback} from '../ui/speech-playback.mjs';
test('stop while synthesis is pending prevents audio; a second player cancels the first',async()=>{
 let started=0;
 globalThis.AudioContext=class {
  state='running'; sampleRate=24000; destination={};
  createBuffer(){return {};}
  createBufferSource(){return {connect(){},start(){started++;},stop(){this.onended?.();}};}
  async decodeAudioData(){return {};}
  async close(){}
 };
 let resolveA, resolveB;
 const statesA=[],statesB=[];
 const a=new SpeechPlayback(()=>new Promise(r=>resolveA=r),s=>statesA.push(s));
 const b=new SpeechPlayback(()=>new Promise(r=>resolveB=r),s=>statesB.push(s));
 const first=a.speak('Erste Antwort.');await new Promise(r=>setImmediate(r));
 const second=b.speak('Zweite Antwort.');await new Promise(r=>setImmediate(r));
 assert.equal(statesA.at(-1),'idle');b.cancel();
 resolveA({audio:'AA=='});resolveB({audio:'AA=='});
 assert.equal(await first,false);assert.equal(await second,false);
 assert.equal(started,2); // gesture priming only, no decoded speech played
 await a.close();await b.close();delete globalThis.AudioContext;
});
