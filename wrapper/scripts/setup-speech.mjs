import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {speechAsset} from '../../system/runtime-assets.mjs';
const exec=promisify(execFile), here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.env.UWE_DATA_ROOT || path.resolve(here,'../../data/control'));
const runtime=path.join(root,'dictation-runtime'), model=path.join(root,'speech-model');
const python=path.join(runtime,process.platform==='win32'?'Scripts/python.exe':'bin/python');
const requirements=path.resolve(here,'../../',speechAsset.requirements);
const signature=createHash('sha256').update(JSON.stringify(speechAsset)).update(await readFile(requirements)).digest('hex');
const marker=path.join(model,'ready');
async function checkFiles() {
  for(const [name,hash] of Object.entries(speechAsset.files)) {
    if(createHash('sha256').update(await readFile(path.join(model,name))).digest('hex')!==hash) throw Error('Prüfsumme der lokalen Stimme stimmt nicht: '+name);
  }
}
async function checkRuntime() {
  await exec(python,['-c',`from importlib.metadata import version\nfrom piper import PiperVoice\nassert version('piper-tts') == '${speechAsset.version}'\nPiperVoice.load(${JSON.stringify(path.join(model,speechAsset.voice+'.onnx'))})`],{timeout:120000});
}
let ready=false;
try {ready=(await readFile(marker,'utf8')).trim()===signature;if(ready){await checkFiles();await checkRuntime();}} catch {ready=false;}
if(!ready) {
  console.log('Lokale Stimme: Piper und Thorsten (Deutsch) werden eingerichtet.');
  await mkdir(model,{recursive:true});await rm(marker,{force:true});
  try {await access(python);} catch {await exec(process.env.UWE_PYTHON || process.env.AGENT_PYTHON || 'python3',['-m','venv',runtime]);}
  await exec(python,['-m','pip','install','--no-cache-dir','-r',requirements],{timeout:600000,maxBuffer:8000000});
  const program=`from huggingface_hub import hf_hub_download\nfrom pathlib import Path\nimport shutil,sys,json\nroot=Path(sys.argv[1])\nasset=json.loads(sys.argv[2])\nfor name in asset['files']:\n f=hf_hub_download(asset['repository'],asset['directory']+'/'+name,revision=asset['revision'],cache_dir=str(root/'.cache'))\n shutil.copyfile(f,root/name)\n`;
  await exec(python,['-c',program,model,JSON.stringify(speechAsset)],{timeout:1800000,maxBuffer:8000000});
  await checkFiles();await checkRuntime();await writeFile(marker,signature+'\n');
  console.log('Thorsten ist lokal bereit.');
} else console.log('Thorsten ist lokal bereit (Version und Prüfsummen bestätigt).');
