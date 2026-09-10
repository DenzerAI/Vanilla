import { requireDesignAudit } from './scripts/design-audit.mjs';
import { uiSourceVersion, recordUiBuild } from '../scripts/ui-build.mjs';
import { build } from 'vite';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { renderDesignCSS, themes } from './ui/design-system.mjs';
await writeFile(new URL('./ui/design-tokens.css',import.meta.url),renderDesignCSS());
await requireDesignAudit();
const uiVersion=await uiSourceVersion();
process.env.AGENT_UI_VERSION=uiVersion;
await build({configFile:new URL('./vite.config.ts',import.meta.url).pathname});
await cp(new URL('./public/',import.meta.url),new URL('./dist/',import.meta.url),{recursive:true});
await cp(new URL('./ui/assets/skills/',import.meta.url),new URL('./dist/skill-icons/',import.meta.url),{recursive:true});
for(const file of ['dictation-worklet.js','dictation-audio.mjs'])
  await cp(new URL('./ui/'+file,import.meta.url),new URL('./dist/'+file,import.meta.url));

// Login must work before authentication, when a separate token URL is unavailable.
await writeFile(new URL('./dist/login.css', import.meta.url), renderDesignCSS() +
  '@media (prefers-color-scheme: light) { :root {' + Object.entries(themes.light).map(([k,v])=>'--'+k+':'+v+';').join('') + '} }\n' +
  await readFile(new URL('./public/login.css', import.meta.url), 'utf8'));

await recordUiBuild(undefined, uiVersion);
