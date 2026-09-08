import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile), here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.UWE_DATA_ROOT || path.resolve(here, '../../data/control');
const runtime = path.join(root, 'dictation-runtime'), model = path.join(root,'speech-model');
try { await access(path.join(model,'ready')); }
catch {
  console.log('Lokale Stimme: Piper und Thorsten (Deutsch) werden eingerichtet.');
  await mkdir(model,{recursive:true});
  const python = path.join(runtime,'bin/python');
  await exec(python,['-m','pip','install','piper-tts==1.4.2'],{timeout:600000,maxBuffer:8000000});
  const program = `from huggingface_hub import hf_hub_download\nfrom pathlib import Path\nimport shutil,sys\nfrom piper import PiperVoice\nroot=Path(sys.argv[1])\nfor name in ['de_DE-thorsten-high.onnx','de_DE-thorsten-high.onnx.json','MODEL_CARD']:\n f=hf_hub_download('rhasspy/piper-voices','de/de_DE/thorsten/high/'+name,revision='v1.0.0')\n shutil.copyfile(f,root/name)\nPiperVoice.load(str(root/'de_DE-thorsten-high.onnx'))\n`;
  await exec(python,['-c',program,model],{timeout:1800000,maxBuffer:8000000});
  await writeFile(path.join(model,'ready'),'Piper 1.4.2 · de_DE-thorsten-high\n');
  console.log('Thorsten ist lokal bereit.');
}
