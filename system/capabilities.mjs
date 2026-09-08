// Source inventory, not a promise that a provider is connected on this host.
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const capabilities = {
  schemaVersion: 1,
  availability: 'Query the referenced status endpoint at runtime; source presence is not readiness.',
  domains: [
    {id:'chat', sources:['wrapper/ui/app.jsx','wrapper/server.mjs'], contract:'wrapper/surfaces/chat.md'},
    {id:'speech', sources:['wrapper/ui/message-speech.tsx','wrapper/ui/speech-playback.mjs','wrapper/speech.mjs','system/runtime-assets.mjs','requirements-speech.lock','scripts/setup-system.mjs'], contract:'wrapper/VOICE.md', status:'/api/speech/status'},
    {id:'dictation', sources:['wrapper/ui/dictation.jsx','wrapper/dictation.mjs'], contract:'wrapper/DICTATION.md', status:'/api/dictation/status'},
    {id:'connections', sources:['wrapper/ui/connection-catalog.mjs','wrapper/service-catalog.mjs','wrapper/crm-catalog.mjs','wrapper/integrations.mjs'], contract:'wrapper/surfaces/connections.md'},
    {id:'workers', sources:['system/worker-catalog.mjs','wrapper/workers.mjs','wrapper/local-model-catalog.mjs'], contract:'wrapper/WORKERS.md'},
    {id:'jobs', sources:['core/queue.py','wrapper/job-templates.mjs'], contract:'wrapper/surfaces/jobs.md'},
    {id:'library', sources:['wrapper/ui/library.jsx','core/files.py'], contract:'wrapper/surfaces/library.md'},
    {id:'skills', sources:['wrapper/ui/skill-details.jsx'], contract:'wrapper/surfaces/skills.md'},
    {id:'knowledge', sources:['core/knowledge.py','core/memory.py','core/mcp.py'], contract:'docs/CORE.md'},
    {id:'channels', sources:['wrapper/channel-runtime.mjs'], contract:'wrapper/CHANNELS.md'},
    {id:'settings', sources:['core/settings.py','wrapper/ui/voice-settings.jsx'], contract:'wrapper/surfaces/settings.md'},
    {id:'operations', sources:['core/operations.py','core/service.py','core/backups.py','core/restore.py','core/secrets.py'], contract:'docs/OPERATIONS.md'},
  ],
  actions: [
    {id:'chat.message.edit', surface:'user message actions', component:'wrapper/ui/app.jsx#Item', behavior:'Edit and branch via existing confirmation flow'},
    {id:'chat.message.delete', surface:'user message actions', component:'wrapper/ui/app.jsx#Item', behavior:'Direct delete button opens existing confirmation; disabled during active turn'},
    {id:'chat.message.read-aloud', surface:'final assistant message actions', component:'wrapper/ui/message-speech.tsx', selector:'[data-capability="chat.message.read-aloud"]', playback:'wrapper/ui/speech-playback.mjs', api:{status:'GET /api/speech/status', synthesize:'POST /api/speech/synthesize', settings:'POST /api/speech/settings', voices:'GET /api/speech/voices', connect:'POST /api/speech/connect'}, request:{text:'1–5000 characters; playback chunks at 2000'}, response:{audio:'base64',mime:'audio/wav or audio/mpeg'}, providers:[{id:'local',engine:'Piper',voice:'de_DE-thorsten-high',setup:'npm --prefix wrapper run setup:speech',ready:'localReady'},{id:'elevenlabs',connection:'speech-elevenlabs',ready:'elevenlabs && voiceId && provider === elevenlabs'}], settingsFile:'speech-settings.json under UWE_DATA_ROOT', secrets:'existing core secret store via integrations.mjs; never in this manifest', behavior:'User gesture; final prose only; exclusive playback; stop/unmount cancels; no automatic cloud fallback'},
  ],
};

// Enumerate every literal API declaration from the current source tree, so the
// inventory grows with route modules instead of maintaining a second route list.
export async function inventory(root = fileURLToPath(new URL('../', import.meta.url))) {
  const endpoints = [];
  for(const dir of ['wrapper','core']) {
    for(const file of (await readdir(path.join(root,dir))).sort()) {
      if(!/\.(mjs|py)$/.test(file)) continue;
      const source = `${dir}/${file}`;
      const text = await readFile(path.join(root,source),'utf8');
      const patterns = [ /\broute\(\s*['"](GET|POST|PUT|PATCH|DELETE)['"]\s*,\s*['"]([^'"]+)['"]/g, /@app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g ];
      for(const pattern of patterns) for(const match of text.matchAll(pattern)) endpoints.push({method:match[1].toUpperCase(),path:match[2],source,line:text.slice(0,match.index).split('\n').length});
    }
  }
  return {...capabilities, endpointCoverage:'All literal route(...) and @app.method(...) declarations in wrapper/*.mjs and core/*.py; dynamic routes and external worker tools remain in referenced catalogs.', endpoints};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await inventory(),null,2));
