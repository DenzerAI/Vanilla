import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.env.UWE_DATA_ROOT || path.resolve(here, '../../data/control');
const runtime = path.join(root, 'dictation-runtime');
const marker = path.join(root, 'dictation-model/ready');
try { await access(marker); await access(path.join(runtime, 'bin/python')); }
catch {
  console.log('Lokales Diktat: Laufzeit und deutsches Whisper-Modell werden eingerichtet (einmaliger Download).');
  await mkdir(root, { recursive: true });
  await exec(process.env.UWE_PYTHON || 'python3', ['-m', 'venv', runtime]);
  const python = path.join(runtime, 'bin/python');
  await exec(python, ['-m', 'pip', 'install', 'faster-whisper==1.2.1'], { timeout: 600000, maxBuffer: 8000000 });
  await exec(python, [path.join(here, 'dictation.py'), 'setup', path.dirname(marker)], { timeout: 1800000, maxBuffer: 8000000 });
  await writeFile(marker, 'small / faster-whisper 1.2.1\n');
  console.log('Lokales deutsches Diktat ist bereit.');
}
