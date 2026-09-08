import React, {useEffect,useState} from 'react';
import { BrandIcon } from './brand-icon.jsx';
import { Plus, ChevronRight, Plug, Calendar, Workflow, Terminal, PanelLeft } from './icons.jsx';
import { connectionCategories, connectionCategory, connectionBrand, groupConnections, matchesConnection, catalogForFeatures, audioServices, crmStatus } from './connection-catalog.mjs';
import { connectionStatus } from '../service-catalog.mjs';

const cStatus=c=>c.synced?'Mit Inbox verbunden':'Verbunden · erster Abruf folgt';
const toolNames={codex_apps:['Codex-Dienste','codex',Plug], 'computer-use':['Computersteuerung',null,PanelLeft], cua_repl:['Browser & Apps',null,PanelLeft], node_repl:['JavaScript-Werkzeuge',null,Terminal]};
export function ConnectionsContent({api, features, integrations, audioConnections, loaded, error, category, onCategory, search, onSearch, setModal, onRetry, FilterPicker, SearchBox}) {
  const [network,setNetwork]=useState(null);
  const [mailAccounts,setMailAccounts]=useState([]),[mailError,setMailError]=useState('');
  useEffect(()=>{let active=true;if(features.mailInbox)api('/mail/accounts?projectId='+encodeURIComponent(integrations.mailProject||'default')).then(r=>{if(active){setMailAccounts(r.accounts);setMailError('');}}).catch(e=>{if(active)setMailError(e.message);});return()=>{active=false;};},[features.mailInbox,integrations.connections,integrations.mailProject]);
  useEffect(()=>{if(features.operations)api('/system/tailscale').then(setNetwork).catch(()=>{});},[features.operations]);
  const accepts=entry=>matchesConnection(entry,search) && (category==='all'||connectionCategory(entry)===category);
  const installed=[
    ...(network?.connected?[{name:'Tailscale',provider:'tailscale',kind:'system',category:'automation',description:network.serving?'Privater HTTPS-Zugang verbunden':'Angemeldet · Serve einrichten'}]:[]),
    ...audioServices.filter(s=>audioConnections[s.name]).map(s=>({...s,id:'audio-'+s.name})),
    ...mailAccounts.map(c=>({...c,kind:'mail',category:'office',name:c.address})),
    ...integrations.connections,
    ...integrations.mcp.map(m=>({ ...m,id:'mcp-'+m.name,kind:'mcp',category:'automation',sourceName:m.name,name:toolNames[m.name]?.[0]||m.name})),
  ];
  const catalog=catalogForFeatures(features).filter(s=>!(s.kind==='system'&&network?.connected)&&!audioConnections[s.name] && !(s.kind==='crm'&&integrations.connections.some(c=>c.kind==='crm'&&c.provider===s.provider)));
  function open(entry) {
    if(entry.kind==='system') {setModal({type:'tailscale'});return;}
    setModal(entry.kind==='audio'?{type:'audio-connection',name:entry.name}:{type:entry.kind==='mail'?'mail-connection':entry.kind==='crm'?'crm-connection':entry.kind==='service'?'service-connection':'connection',connection:entry});
  }
  function groups(entries, adding) {
    return groupConnections(entries.filter(accepts)).map(group=>(
      <section className="connection-category" key={group.id} aria-label={group.name}>
        <h3 className="connection-category-title">{group.name}<span>{group.entries.length}</span></h3>
        <div className="integration-grid">{group.entries.map(entry=>{
          const tool=entry.kind==='mcp', spec=toolNames[entry.sourceName];
          const fallback=entry.provider==='calendar'?Calendar:spec?.[2]||Workflow;
          const content=<><BrandIcon name={tool?spec?.[1]:connectionBrand(entry)} fallback={fallback}/><div><strong>{entry.name}</strong><p>{adding||['audio','system'].includes(entry.kind)?entry.description:tool?`${Object.keys(entry.tools||{}).length} Werkzeuge · vom Worker bereitgestellt`:entry.kind==='mail'?(entry.error||(!entry.enabled?'Getrennt':cStatus(entry))):entry.kind==='crm'?crmStatus(entry):entry.kind==='service'?connectionStatus(entry):entry.kind==='webhook'?'Workflow-Webhook':'Link zum Dienst'}</p></div>{!tool&&(adding?<Plus size={20}/>:<ChevronRight size={17}/>)}</>;
          return tool?<div key={entry.id} className="integration-item" title={entry.sourceName}>{content}</div>:<button key={entry.id||entry.provider||entry.name} className="integration-item" onClick={()=>open(entry)} aria-label={`${entry.name} ${adding?'hinzufügen':'bearbeiten'}`}>{content}</button>;
        })}</div>
      </section>
    ));
  }
  const filteredInstalled=installed.filter(accepts), filteredCatalog=catalog.filter(accepts);
  return <>
    <div className="skill-filters connection-filters">
      <SearchBox value={search} onChange={onSearch} placeholder="Verbindungen suchen"/>
      <FilterPicker label="Verbindungskategorie" value={category} onChange={onCategory} options={[{value:'all',label:'Alle Kategorien'},...connectionCategories.map(c=>({value:c.id,label:c.name}))]}/>
    </div>
    <section aria-labelledby="installed-connections">
      <h2 id="installed-connections" className="section-heading">Eingerichtet</h2>
      {!loaded&&!error&&!installed.length?<p className="connection-status" role="status">Verbindungen werden geladen …</p>:groups(installed,false)}
      {error&&<p className="connection-status" role="status">{error} <button className="connection-retry" onClick={onRetry}>Erneut laden</button></p>}
      {loaded&&!error&&!filteredInstalled.length&&<p className="connection-status">{installed.length?'Keine eingerichtete Verbindung passt zu deiner Auswahl.':integrations.mcpLoading?'Werkzeuge des Workers werden ermittelt …':'Noch keine Verbindung eingerichtet.'}</p>}
      {mailError&&<p role="alert">{mailError}</p>}
      {integrations.mcpError&&<p className="connection-status" role="status">{integrations.mcpError} Vorhandene Einträge bleiben sichtbar.</p>}
    </section>
    <section aria-labelledby="available-connections">
      <h2 id="available-connections" className="section-heading">Weitere Dienste einrichten</h2>
      {groups(catalog,true)}
      {!filteredCatalog.length&&<p className="connection-status">Keine weiteren Dienste für diese Auswahl.</p>}
    </section>
  </>;
}
