// Source inventory, not a promise that a provider is connected on this host.
import {readFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const capabilities = {
  schemaVersion: 1,
  availability: 'Query the referenced status endpoint at runtime; source presence is not readiness.',
  domains: [
    {id:"work-evidence", ui:"settings/service", sources:["wrapper/ui/work-evidence.tsx","wrapper/ui/work-evidence.mjs","wrapper/ui/work-evidence.css"], contract:"wrapper/surfaces/work-evidence.md", status:"explicit fictional demo only", backend:"none; real time capture and scoped A2A planned"},
    {id:'crm-core', sources:['core/crm.py','core/crm_schema.py','core/crm_models.py','core/crm_mapping.py','core/crm_api.py','core/mcp.py'], contract:'docs/CRM.md', status:'/api/crm/schema', backend:'FastAPI and existing SQLite; no connector sync enabled'},
    {id:'planner', sources:['wrapper/ui/planner.tsx','wrapper/ui/planner.css','wrapper/ui/planner-dates.mjs','wrapper/ui/planner-data.mjs','wrapper/ui/planner-demo.ts'], contract:'wrapper/surfaces/today.md', status:'interactive concept with live CRM reads and existing notifications', backend:'existing CRM and notification APIs; calendar, weather and briefing feeds pending'},
    {id:'source-privacy', sources:['scripts/security-scan.py','scripts/source-sync.py','scripts/verify-source-adoption.mjs','scripts/install-git-hooks.mjs','backend/company-base.mjs','system/source-policy.json'], contract:'docs/CODE-SYNC.md', status:'npm run source:check; local hooks require source:setup', backend:'local Git CLI', surface:null},
    {id:'inbox', sources:['wrapper/ui/inbox.tsx','wrapper/ui/inbox.css'], contract:'wrapper/surfaces/inbox.md', status:'design-preview-only', backend:null},
    {id:'chat', sources:['wrapper/ui/app.jsx','wrapper/server.mjs'], contract:'wrapper/surfaces/chat.md'},
    {id:'speech', sources:['wrapper/ui/message-speech.tsx','wrapper/ui/speech-playback.mjs','wrapper/speech.mjs','system/runtime-assets.mjs','requirements-speech.lock','scripts/setup-system.mjs'], contract:'wrapper/VOICE.md', status:'/api/speech/status'},
    {id:'dictation', sources:['wrapper/ui/dictation.jsx','wrapper/dictation.mjs'], contract:'wrapper/DICTATION.md', status:'/api/dictation/status'},
    {id:'connections', sources:['wrapper/ui/connection-catalog.mjs','wrapper/service-catalog.mjs','wrapper/crm-catalog.mjs','wrapper/integrations.mjs'], contract:'wrapper/surfaces/connections.md'},
    {id:'workers', sources:['system/worker-catalog.mjs','wrapper/workers.mjs','wrapper/acp-worker.mjs','wrapper/local-model-catalog.mjs'], contract:'wrapper/WORKERS.md', status:'/api/workers'},
    {id:'jobs', sources:['core/queue.py','core/routines.py','core/notifications.py','core/mcp.py','wrapper/job-notifications.mjs','wrapper/ui/job-notifications.jsx','wrapper/job-templates.mjs'], contract:'wrapper/surfaces/jobs.md', status:'/api/routines/tool (routine_capabilities)', backend:'existing SQLite scheduler'},
    {id:'library', sources:['wrapper/ui/library.jsx','core/files.py'], contract:'wrapper/surfaces/library.md'},
    {id:'skills', sources:['wrapper/ui/skill-details.jsx'], contract:'wrapper/surfaces/skills.md'},
    {id:'knowledge', sources:['core/knowledge.py','core/memory.py','core/mcp.py'], contract:'docs/CORE.md'},
    {id:'channels', sources:['wrapper/channel-runtime.mjs'], contract:'wrapper/CHANNELS.md'},
    {id:'settings', sources:['core/settings.py','wrapper/ui/voice-settings.jsx'], contract:'wrapper/surfaces/settings.md'},
    {id:'operations', sources:['core/operations.py','core/service.py','core/backups.py','core/restore.py','core/secrets.py'], contract:'docs/OPERATIONS.md'},
  ],
  actions: [
    {id:'planner.report-chat', surface:'Heute: Briefings & Ergebnisse', component:'wrapper/ui/planner.tsx', sources:['wrapper/briefing-chat.mjs','wrapper/chat-handoff.mjs','core/notifications.py'], api:{list:'GET /api/planner/results',open:'POST /api/planner/chat'}, behavior:'Latest five completed routine receipts; immutable assistant report snapshot in a reusable conversation; explicit labelled demo reports; no worker turn on open', contract:'wrapper/surfaces/today.md'},
    {id:'settings.agent-animation', surface:'settings appearance visual; agent avatar picker', component:'wrapper/ui/avatar-motion-setting.jsx', sources:['wrapper/ui/avatar.jsx','wrapper/ui/agent-avatars.mjs','wrapper/ui/avatar-motion.mjs','wrapper/ui/appearance.mjs'], api:{settings:'POST /api/settings',identity:'POST /api/identity'}, behavior:'Eight footless SVG faces; shared persisted motion choices; neutral reduced-motion state and visibility pause; expressions are decorative, not status', contract:'wrapper/surfaces/settings.md'},
    {id:'library.html-preview', surface:'chat HTML links; workspace files; library preview', component:'wrapper/ui/html-preview.tsx', sources:['wrapper/ui/file-content.jsx','wrapper/html-preview.mjs'], api:{preview:'GET /api/file/preview',info:'GET /api/file/info'}, behavior:'Shared sandboxed HTML rendering; responsive compact workspace first; expand same iframe on demand; explicit source/edit mode; embedded assets only; no live file watch', contract:'wrapper/surfaces/library.md'},
    {id:'connections.21st', surface:'settings connections; Design & Medien', component:'wrapper/ui/connection-catalog.mjs', api:{save:'POST /api/connections/save',status:'GET /api/integrations'}, behavior:'Browser link only; setup at https://21st.dev/mcp. External MCP https://21st.dev/api/mcp requires x-api-key; saving the link does not install or authenticate MCP tools.', contract:'wrapper/surfaces/connections.md'},
    {id:'crm.facts', surface:'shared MCP and API; customer forms not yet connected', component:'core/crm_api.py', api:{schema:'GET /api/crm/schema',query:'POST /api/crm/query',propose:'POST /api/crm/proposals',decide:'POST /api/crm/decisions'}, behavior:'Typed workspace entities, per-field sources, proposals before facts, optimistic revisions and incoming-evidence freshness; no autonomous approval or external writes'},
    {id:'jobs.chat-routines', surface:'agent chat and jobs form', component:'wrapper/ui/job-notifications.jsx', api:{tools:'POST /api/routines/tool', notifications:'GET /api/notifications', read:'POST /api/notifications/read', targets:'GET /api/jobs/notification-targets', preference:'POST /api/notifications/preference'}, behavior:'MCP create/list/update/capabilities; one scheduler; durable receipts; existing Telegram and active WhatsApp targets; no mail or closed-browser Web Push; uncertain sends are not retried'},
    {id:'planner.overview', surface:'main navigation first; ?view=today or ?view=calendar; legacy pipeline link opens today', component:'wrapper/ui/planner.tsx', selector:'[data-capability="planner.overview"]', api:{schema:'GET /api/crm/schema',crm:'POST /api/crm/query',entity:'GET /api/crm/entities/{entity_id}',notifications:'GET /api/notifications'}, behavior:'Today briefing, agenda, decisions; day/week/month calendar with ISO weeks and optional weekdays; labelled isolated interactive examples, real CRM due steps and existing notifications; no external calendar sync, geolocation, weather fetch or persistent event writes', contract:'docs/PLANNER.md'},
    {id:'chat.model.select', surface:'composer model popover', component:'wrapper/ui/model-picker.jsx', sources:['wrapper/worker-models.mjs','system/worker-catalog.mjs'], api:{activate:'POST /api/workers/activate', create:'POST /api/chats', configure:'POST /api/worker-session', nextTurn:'POST /api/turn', handoff:'POST /api/chat/provider', speed:'POST /api/chat/speed', status:'GET /api/workers'}, behavior:'Explicit Codex/Claude Code selection; native CLI/OAuth auth; no worker restart; GPT-5.6/6 UI filter; exact advertised effort values with a terracotta step slider; per-chat next-turn selections leave active turns unchanged; confirmed ACP configs; explicit provider handoff retains the visible chat and supplies prior context after confirmed cancellation; native Codex Fast tier applies to the next turn'},
    {id:'inbox.preview', surface:'sidebar above jobs; inbox replaces sidebar with conversation list and back action', component:'wrapper/ui/inbox.tsx', selector:'[data-capability="inbox.preview"]', api:null, behavior:'Local fictional examples only; no connector calls, persistent drafts, agent work or sending. Concept: docs/INBOX.md'},
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
