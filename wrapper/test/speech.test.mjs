import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PCMResampler,microphone} from '../ui/dictation-audio.mjs';
import {speechChunks,spokenText} from '../ui/speech-playback.mjs';
import {installSpeechRoutes,validateSpeechSettings} from '../speech.mjs';
test('native 44.1/48 kHz microphone audio retains duration and sample amplitude at 16 kHz across blocks',()=>{
 for(const rate of [16000,44100,48000,96000]) {
   const out=[],r=new PCMResampler(rate),signal=new Float32Array(rate).fill(0.25);
   for(let i=0;i<signal.length;i+=128)r.push(signal.subarray(i,i+128),v=>out.push(v));
   assert.equal(out.length,16000);assert.ok(out.every(v=>v===8192));
 }
});
test('microphone uses native defaults and falls back from an invalid saved device without masking denial',async()=>{
 const calls=[];const media={getUserMedia:async c=>{calls.push(c);if(c.audio!==true)throw Object.assign(new Error('Invalid constraint'),{name:'OverconstrainedError'});return 'stream';}};
 assert.equal(await microphone(media),'stream');assert.deepEqual(calls,[{audio:true}]);
 calls.length=0;assert.equal(await microphone(media,'removed-device'),'stream');assert.equal(calls.length,2);
 await assert.rejects(microphone({getUserMedia:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}},'x'),/denied/);
});
test('speech omits code, avoids silent truncation and bounds every synthesis chunk',()=>{
 assert.equal(spokenText('Hallo **Welt**.\n```sh\nsecret command\n```\n[Quelle](https://a.example)'),'Hallo Welt.\n\nQuelle');
 const raw='Lange Antwort. '.repeat(1000);const chunks=speechChunks(raw);
 assert.ok(chunks.length>1);assert.ok(chunks.every(t=>t.length<=2000));assert.equal(chunks.join(' '),raw.trim());
});
test('cloud speech requires a connected provider, validates settings and exposes only voice metadata',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'speech-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const routes=new Map(),calls=[],stored=new Map(),boundaries=[];
 const fetcher=async(url,options)=>{calls.push({url,options});return url.includes('/text-to-speech/')?new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'audio/mpeg'}}):Response.json({voices:[{voice_id:'test_voice',name:'Deutsch',secret:'not-returned'}],has_more:false});};
 await installSpeechRoutes({route:(m,u,fn)=>routes.set(m+u,fn),dataRoot:root,recordBoundary:async(...v)=>boundaries.push(v),fetcher,secrets:{save:async(k,v)=>stored.set(k,v),read:async k=>stored.get(k)}});
 const post=(p,b)=>routes.get('POST/api/speech/'+p)(b);
 await assert.rejects(post('settings',{provider:'elevenlabs'}),/einrichten/);
 assert.throws(()=>validateSpeechSettings({autoMode:'yes'},{}));assert.throws(()=>validateSpeechSettings({voiceId:'../escape'},{}));
 await post('connect',{key:'private-key'});
 assert.equal((await routes.get('GET/api/speech/status')()).provider,'local');
 const voices=await routes.get('GET/api/speech/voices')({},new URL('http://localhost'));
 assert.deepEqual(voices.voices,[{id:'test_voice',name:'Deutsch'}]);
 await post('settings',{provider:'elevenlabs',voiceId:'test_voice',autoMode:true});
 const audio=await post('synthesize',{text:'Guten Tag.'});assert.equal(audio.mime,'audio/mpeg');
 const call=calls.at(-1);assert.equal(call.options.headers['xi-api-key'],'private-key');assert.equal(call.options.redirect,'error');assert.equal(JSON.parse(call.options.body).text,'Guten Tag.');assert.equal(boundaries.length,1);
 assert.ok(!(await readFile(path.join(root,'speech-settings.json'),'utf8')).includes('private-key'));
 await post('disconnect',{});assert.equal((await routes.get('GET/api/speech/status')()).provider,'local');
 await assert.rejects(post('synthesize',{text:'x'.repeat(5001)}),/5.000/);
});
