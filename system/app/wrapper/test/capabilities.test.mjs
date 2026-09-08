import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {inventory} from '../../system/capabilities.mjs';
test('system map resolves all source contracts and speech endpoints',async()=>{
 const map=await inventory();
 for(const domain of map.domains) for(const file of [...domain.sources,domain.contract]) await access(new URL('../../'+file,import.meta.url));
 assert.equal(new Set(map.actions.map(a=>a.id)).size,map.actions.length);
 const speech=map.actions.find(a=>a.id==='chat.message.read-aloud');
 for(const endpoint of Object.values(speech.api)) assert.ok(map.endpoints.some(e=>`${e.method} ${e.path}`===endpoint),endpoint);
 assert.ok(map.endpoints.length>100);
});

test('full installer includes local speech and pins its complete model file set',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {speechAsset}=await import('../../system/runtime-assets.mjs');
 const setup=await readFile(new URL('../../scripts/setup-system.mjs',import.meta.url),'utf8');
 assert.match(setup,/await run\('npm',\['--prefix','wrapper','run','setup:dictation'\]\)/);
 assert.match(setup,/await run\('npm',\['--prefix','wrapper','run','setup:speech'\]\)/);
 assert.ok(setup.indexOf("'setup:speech'")<setup.indexOf("'control:build'"));
 for(const hash of Object.values(speechAsset.files)) assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(Object.keys(speechAsset.files).length,3);
 const requirements=await readFile(new URL('../../'+speechAsset.requirements,import.meta.url),'utf8');
 for(const line of requirements.split('\n').filter(l=>l&&!l.startsWith('#'))) assert.match(line,/^[\w-]+==[\d.]+$/);
 assert.ok(requirements.includes('piper-tts=='+speechAsset.version));
});
