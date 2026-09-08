import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectionCatalog,audioServices} from '../ui/connection-catalog.mjs';
test('speech providers share the connection catalog and original bundled brand icons',async()=>{
 assert.equal(new Set(connectionCatalog.map(s=>s.name)).size,connectionCatalog.length);
 assert.deepEqual(audioServices.map(s=>s.name),['Groq','ElevenLabs']);
 const ui=await readFile(new URL('../ui/app.jsx',import.meta.url),'utf8');
 const connections=await readFile(new URL('../ui/connections-page.jsx',import.meta.url),'utf8');
 assert.ok(connections.includes('catalogForFeatures(features).filter'));assert.ok(connections.includes('Weitere Dienste einrichten'));assert.ok(ui.includes('<ConnectionsContent'));assert.ok(!ui.includes('<DictationSettings'));
 const composer=await readFile(new URL('../ui/dictation.jsx',import.meta.url),'utf8');
 assert.ok(!composer.includes('>Aufnahmen<'));
 for(const file of ['groq.svg','elevenlabs.svg'])assert.match(await readFile(new URL('../ui/assets/'+file,import.meta.url),'utf8'),/<svg/);
 for(const name of ['chat','jobs','connections','skills','settings','modules'])assert.ok((await readFile(new URL('../surfaces/'+name+'.md',import.meta.url),'utf8')).length>400);
});
