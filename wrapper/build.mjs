import { fingerprint } from './updates.mjs';
import { build } from 'vite';
import { createHash } from 'node:crypto';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { renderDesignCSS } from './ui/design-system.mjs';
await writeFile(new URL('./ui/design-tokens.css',import.meta.url),renderDesignCSS());
const uiVersion=createHash('sha256').update(JSON.stringify(await Promise.all([
  fingerprint(new URL('./ui/',import.meta.url).pathname,true),
  fingerprint(new URL('./public/',import.meta.url).pathname,true),
  ...['build.mjs','vite.config.ts','package-lock.json'].map(file=>readFile(new URL(file,import.meta.url),'utf8')),
]))).digest('hex');
process.env.AGENT_UI_VERSION=uiVersion;
await build({configFile:new URL('./vite.config.ts',import.meta.url).pathname});
await cp(new URL('./public/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
await cp(new URL('./ui/assets/skills/',import.meta.url),new URL('./dist/skill-icons/',import.meta.url),{recursive:true});
for(const file of ['dictation-worklet.js','dictation-audio.mjs'])
  await cp(new URL('./ui/'+file,import.meta.url),new URL('./dist/'+file,import.meta.url));
await writeFile(new URL('./dist/version.json',import.meta.url),JSON.stringify({uiVersion}));
