import { readFile, access, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { saveSecret, readSecret } from './integrations.mjs';
import { durable } from './dictation.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const defaults = { provider:'local', voiceId:'', autoMode:false, elevenlabs:false };
export function validateSpeechSettings(b, previous) {
  const next = {...defaults,...previous};
  if (b.provider !== undefined) {
    if (!['local','elevenlabs'].includes(b.provider)) throw new Error('Unbekannte Sprachausgabe.');
    if (b.provider === 'elevenlabs' && !next.elevenlabs) throw new Error('ElevenLabs zuerst unter Verbindungen einrichten.');
    next.provider = b.provider;
  }
  if (b.voiceId !== undefined) { if (!/^[a-zA-Z0-9_-]{0,100}$/.test(b.voiceId)) throw new Error('Ungültige Stimme.'); next.voiceId = b.voiceId; }
  if (b.autoMode !== undefined) { if (typeof b.autoMode !== 'boolean') throw new Error('Ungültiger Automodus.'); next.autoMode = b.autoMode; }
  return next;
}
function runPiper(python, args, text) {
  return new Promise((resolve,reject) => {
    const p = spawn(python,args,{stdio:['pipe','ignore','pipe']});
    let timer = setTimeout(()=> { p.kill('SIGKILL'); reject(new Error('Lokale Sprachausgabe hat zu lange gebraucht.')); },120000);
    p.stderr.on('data',()=>{}); p.stdin.on('error',()=>{});
    p.on('error',()=> { clearTimeout(timer); reject(new Error('Lokale Stimme ist nicht eingerichtet.')); });
    p.on('exit',code=> { clearTimeout(timer); code===0 ? resolve() : reject(new Error('Lokale Sprachausgabe fehlgeschlagen.')); });
    p.stdin.end(text);
  });
}
export async function installSpeechRoutes({route,dataRoot,recordBoundary, fetcher=fetch, secrets={save:saveSecret,read:readSecret}}) {
  const settingsFile=path.join(dataRoot,'speech-settings.json');
  const settings=async()=> { try { return {...defaults,...JSON.parse(await readFile(settingsFile,'utf8'))}; } catch(e) { if(e.code !== 'ENOENT') throw e; return {...defaults}; } };
  let writes=Promise.resolve(), busy=0;
  const serial = secrets.exclusive || (fn => { const run=writes.catch(()=>{}).then(fn); writes=run; return run; });
  const request = async (url,key,options={}) => {
    const r = await fetcher(url,{...options, headers:{'xi-api-key':key,...options.headers},redirect:'error',signal:AbortSignal.timeout(120000)});
    if (!r.ok) throw new Error(`ElevenLabs meldet HTTP ${r.status}. Verbindung und Kontolimit prüfen.`);
    return r;
  };
  route('GET','/api/speech/status',async()=> {
    let localReady=true; try { await access(path.join(dataRoot,'speech-model/ready')); } catch { localReady=false; }
    return {...await settings(),localReady,localVoice:'Thorsten',language:'de'};
  });
  route('POST','/api/speech/settings',b=>serial(async()=> {
    const s=validateSpeechSettings(b,await settings()); await durable(settingsFile,JSON.stringify(s)); return s;
  }));
  route('POST','/api/speech/connect',b=>serial(async()=> {
    if (typeof b.key!=='string' || !b.key.trim() || b.key.length>10000 || /[\r\n\0]/.test(b.key)) throw new Error('API-Schlüssel erforderlich.');
    // Verify before replacing a working key. Never return upstream bodies or the key.
    await request('https://api.elevenlabs.io/v2/voices?page_size=1',b.key);
    await secrets.save('speech-elevenlabs',b.key);
    const s={...await settings(),elevenlabs:true}; await durable(settingsFile,JSON.stringify(s)); return {connected:true};
  }));
  route('POST','/api/speech/disconnect',()=>serial(async()=> {
    const s={...await settings(),elevenlabs:false,provider:'local',voiceId:''}; await durable(settingsFile,JSON.stringify(s)); return {ok:true};
  }));
  route('GET','/api/speech/voices',async(b,u)=> {
    if (!(await settings()).elevenlabs) return {voices:[],hasMore:false};
    const query=new URLSearchParams({page_size:'100'});
    const next=u?.searchParams.get('next'); if(next && next.length <= 1000) query.set('next_page_token',next);
    const r=await request('https://api.elevenlabs.io/v2/voices?'+query,await secrets.read('speech-elevenlabs'));
    const j=await r.json();
    return {voices:(j.voices || []).map(v=>({id:v.voice_id,name:v.name})),next:j.next_page_token || null,hasMore:!!j.has_more};
  });
  route('POST','/api/speech/synthesize',async b=> {
    if (typeof b.text!=='string' || !b.text.trim() || b.text.length>5000) throw new Error('Bitte 1 bis 5.000 Zeichen vorlesen lassen.');
    if (busy>=2) throw new Error('Sprachausgabe ist beschäftigt. Bitte kurz warten.');
    busy++;
    try {
      const s=await settings();
      if (s.provider==='elevenlabs') {
        if (!s.elevenlabs || !s.voiceId) throw new Error('Bitte unter Stimme eine ElevenLabs-Stimme auswählen.');
        await recordBoundary('speech-elevenlabs',{textCharacters:b.text.length,voiceId:s.voiceId,text:b.text});
        const r=await request('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(s.voiceId),await secrets.read('speech-elevenlabs'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:b.text,model_id:'eleven_multilingual_v2'})});
        const audio=Buffer.from(await r.arrayBuffer()); if(audio.length>24*1024*1024) throw new Error('Sprachausgabe zu groß.');
        return {audio:audio.toString('base64'),mime:'audio/mpeg'};
      }
      const temp=await mkdtemp(path.join(dataRoot,'speech-'));
      try {
        const out=path.join(temp,'voice.wav');
        await runPiper(path.join(dataRoot,'dictation-runtime/bin/python'),[path.join(here,'scripts/speech.py'),path.join(dataRoot,'speech-model/de_DE-thorsten-high.onnx'),out],b.text);
        return {audio:(await readFile(out)).toString('base64'),mime:'audio/wav'};
      } finally { await rm(temp,{recursive:true,force:true}); }
    } finally { busy--; }
  });
}
