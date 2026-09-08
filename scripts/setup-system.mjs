// Explicit installer. Downloads pinned runtime dependencies and the local search model.
import {spawn} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.PIP_CACHE_DIR=path.join(root,'.cache/pip');
process.env.npm_config_cache=path.join(root,'.cache/npm');
process.env.HF_HOME=path.join(root,'.cache/huggingface');
process.env.TMPDIR=path.join(root,'.cache/tmp');
mkdirSync(process.env.TMPDIR,{recursive:true});
const python=path.join(root,'.venv/bin/python');
async function run(command,args) {
  await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd:root,stdio:'inherit'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} beendet mit ${code}`)));
  });
}
try {
  if(!existsSync(python))await run(process.env.AGENT_PYTHON||'python3',['-m','venv','.venv']);
  await run(python,['-c','import sys; assert sys.version_info >= (3,12), "Python 3.12+ erforderlich"']);
  await run(python,['-m','pip','install','-r','requirements.lock','-r','requirements-embeddings.lock']);
  await run(python,['-m','pip','install','-e','.','--no-deps']);
  await run('npm',['ci']);
  await run('npm',['--prefix','wrapper','ci']);
  process.env.UWE_PYTHON ||= python;
  await run('npm',['--prefix','wrapper','run','setup:dictation']);
  await run('npm',['--prefix','wrapper','run','setup:speech']);
  await run('npm',['run','control:build']);
  await run(python,['-m','core.setup','--embeddings']);

  console.log('System vorbereitet. Mit npm start öffnen; Zugang und Sicherungsziel in den Einstellungen einrichten. Globale macOS-Dienste werden nicht installiert.');
} catch(error) {console.error(error.message);process.exitCode=1;}
