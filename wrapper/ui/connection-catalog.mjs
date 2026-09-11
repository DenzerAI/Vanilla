// Connections contract: every service uses the same catalog tile and setup dialog.
import {serviceDefinition} from '../service-catalog.mjs';
import { crmCatalog, crmDefinition } from '../crm-catalog.mjs';
export { crmDefinition, crmStatus } from '../crm-catalog.mjs';
export const connectionCategories = [
  {id:'crm', name:'CRM & Handwerk', aliases:['Kunden','ERP','Warenwirtschaft']},
  {id:'office', name:'E-Mail & Kalender', aliases:['Mail','Büro','Termine']},
  {id:'messaging', name:'Nachrichten', aliases:['Messaging','Chat','Messenger']},
  {id:'design', name:'Design & Medien', aliases:['Bild','Video','Marketing']},
  {id:'voice', name:'Sprache', aliases:['Audio','Stimme','Diktat']},
  {id:'automation', name:'Automatisierung & Agenten', aliases:['Workflow','Automation','MCP','Tools']},
];
export function connectionCategory(entry) {
  if (connectionCategories.some(c=>c.id===entry.category)) return entry.category;
  if (entry.kind==='crm') return 'crm';
  const known=connectionCatalog.find(s=>entry.provider ? s.provider===entry.provider : s.name===entry.name);
  return known?.category || 'automation';
}
export function connectionBrand(entry) {
  return crmDefinition(entry.provider)?.name || serviceDefinition(entry.provider)?.name ||
    connectionCatalog.find(s=>s.provider===entry.provider && entry.provider)?.name || entry.name;
}
export function groupConnections(entries) {
  return connectionCategories.map(category=>({...category,entries:entries.filter(entry=>connectionCategory(entry)===category.id)})).filter(group=>group.entries.length);
}
export function matchesConnection(service, search) {
  const provider = service.kind === 'crm' ? crmDefinition(service.provider) : null;
  const category=connectionCategories.find(c=>c.id===connectionCategory(service));
  return [service.name, service.sourceName, connectionBrand(service), service.description, serviceDefinition(service.provider)?.name, provider?.name, provider?.group, category?.name, ...(category?.aliases || []),
    ...(provider?.aliases || []), ...(provider ? ['CRM','KMU',provider.api.auth ? 'API' : 'Login'] : [])]
    .filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'));
}
const service = (id,icon,category) => {const s=serviceDefinition(id);return {name:s.name,description:s.description,provider:id,kind:'service',icon,category};};
export const connectionCatalog = [
  {name:'GitHub',provider:'github',category:'automation',icon:'plug',description:'Updates und privater Codeaustausch',kind:'github'},
  {name:'Tailscale',provider:'tailscale',category:'automation',icon:'plug',description:'Privater HTTPS-Zugang für Mobilgeräte',kind:'system'},
  ...crmCatalog.map(provider => ({name:provider.name, description:provider.description, kind:'crm', category:'crm', provider:provider.id, icon:'plug'})),
  {name:'Gmail',provider:'gmail',category:'office',icon:'mail',description:'E-Mail über einen Workflow anbinden',kind:'webhook'},
  service('microsoft-graph','mail','office'),
  {name:'Kalender',provider:'calendar',category:'office',icon:'calendar',description:'Termine über einen Workflow anbinden',kind:'webhook'},
  service('whatsapp-local','message','messaging'),
  service('telegram','message','messaging'),
  service('whatsapp-cloud','message','messaging'),
  service('a2a','plug','automation'),
  service('discord','message','messaging'),
  service('openai-image','image','design'),
  {name:'n8n',provider:'n8n',category:'automation',icon:'workflow',description:'Vorhandene Workflows ausführen',kind:'webhook'},
  {name:'Higgsfield',provider:'higgsfield',category:'design',icon:'image',description:'Bild- und Videodienste öffnen',kind:'link'},
  {name:'21st.dev',provider:'21st',category:'design',icon:'image',description:'UI-Komponenten, Vorlagen und MCP-Einrichtung',kind:'link',url:'https://21st.dev',setupUrl:'https://21st.dev/mcp',setupNote:'Komponenten und Vorlagen im Browser öffnen. Für den MCP-Zugang ist ein eigener API-Schlüssel bei 21st.dev nötig. Das Speichern dieses Links aktiviert keine MCP-Werkzeuge.'},
  {name:'Groq',provider:'groq',category:'voice',icon:'audio',description:'Schnelle Diktaterkennung',kind:'audio'},
  {name:'ElevenLabs',provider:'elevenlabs',category:'voice',icon:'volume',description:'Stimmen für den Sprachchat',kind:'audio'},
  {name:'Eigener Dienst',provider:'custom',category:'automation',icon:'plug',description:'Link oder Workflow-Webhook',kind:'webhook'},
];
export const audioServices=connectionCatalog.filter(s=>s.kind==='audio');

// The static UI can be rebuilt while older server processes finish active chats.
export function catalogForFeatures(features={}) {
  const catalog = connectionCatalog.map(s=>features.mailInbox && s.provider==='calendar'?{...s,provider:'microsoft-graph',kind:'service',description:'Microsoft-Termine mit dem Kalender abgleichen'}:features.mailInbox && ['gmail','microsoft-graph'].includes(s.provider)?{...s,name:s.provider==='gmail'?'Gmail':'Outlook',provider:s.provider==='gmail'?'gmail':'outlook',kind:'mail',description:'Postfach mit der Inbox verbinden'}:s);
  const available = catalog.filter(service => (service.kind !== 'github' || features.github) && (service.kind !== 'crm' || features.crmConnections) && (service.kind !== 'system' || features.operations));
  if(features.serviceConnections)return available;
  return available.flatMap(s=>s.kind!=='service'?[s]:s.provider==='microsoft-graph'?[{name:'Outlook',provider:'outlook',category:'office',icon:'mail',description:'E-Mail über einen Workflow anbinden',kind:'webhook'}]:s.provider==='whatsapp-local'?[{name:'WhatsApp',provider:'whatsapp',category:'messaging',icon:'message',description:'Bestehende Bridge oder Workflow anbinden',kind:'webhook'}]:[]);
}
