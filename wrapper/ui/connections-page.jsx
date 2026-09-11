import {Skeleton} from './skeleton.tsx';
import React, {useEffect,useState} from 'react';
import { BrandIcon } from './brand-icon.jsx';
import { Plus, ChevronRight, Plug, Calendar, Workflow, Terminal, PanelLeft } from './icons.jsx';
import { connectionCategories, connectionCategory, connectionBrand, groupConnections, matchesConnection, catalogForFeatures, audioServices, crmStatus } from './connection-catalog.mjs';
import { connectionStatus } from '../service-catalog.mjs';

const toolNames={codex_apps:['Codex-Dienste','codex',Plug], 'computer-use':['Computersteuerung',null,PanelLeft], cua_repl:['Browser & Apps',null,PanelLeft], node_repl:['JavaScript-Werkzeuge',null,Terminal]};
export function ConnectionsContent({api, projectId="default", features, integrations, audioConnections, loaded, error, category, onCategory, search, onSearch, setModal, onRetry, FilterPicker, SearchBox}) {
  const [github,setGitHub]=useState(null),[githubError,setGitHubError]=useState('');
  useEffect(()=>{let alive=true;if(features.github)api('/github/status').then(s=>{if(alive){setGitHub(s);setGitHubError('');}}).catch(e=>{if(alive)setGitHubError(e.message);});return()=>{alive=false;};},[features.github,integrations]);
  const [network,setNetwork]=useState(null),[devices,setDevices]=useState([]),[deviceError,setDeviceError]=useState('');
  const [mailAccounts,setMailAccounts]=useState([]),[mailError,setMailError]=useState('');
  useEffect(()=>{let alive=true;setMailAccounts([]);if(features.mailInbox) api('/mail/accounts?projectId='+encodeURIComponent(projectId)).then(result=>{if(alive){setMailAccounts(result.accounts);setMailError('');}}).catch(e=>{if(alive)setMailError(e.message);});return()=>{alive=false;};},[features.mailInbox,projectId,integrations]);
  useEffect(()=>{let alive=true;const refresh=()=>{if(features.operations)api(features.deviceConnections?'/network/status':'/system/tailscale').then(r=>{if(alive)setNetwork(r);}).catch(e=>{if(alive)setDeviceError(e.message);});if(features.deviceConnections)api('/devices').then(r=>{if(alive){setDevices(r.devices);setDeviceError('');}}).catch(e=>{if(alive)setDeviceError(e.message);});};refresh();window.addEventListener('device-connections-changed',refresh);return()=>{alive=false;window.removeEventListener('device-connections-changed',refresh);};},[features.operations,features.deviceConnections]);
  const accepts=entry=>matchesConnection(entry,search) && (category==='all'||connectionCategory(entry)===category);
  const installed=[
    ...(github?.account?[{name:'GitHub',provider:'github',kind:'github',category:'automation',description:github.error||(github.connected?github.account.login:'Erneut anmelden')}]:[]),
    ...(network?.connected?[{name:'Tailscale',provider:'tailscale',kind:'system',category:'devices',description:network.serving?'Privater HTTPS-Zugang verbunden':'Angemeldet · Serve einrichten'}]:[]),
    ...devices,
    ...audioServices.filter(s=>audioConnections[s.name]).map(s=>({...s,id:'audio-'+s.name})),
    ...integrations.connections,
    ...mailAccounts.map(account=>({...account,kind:'mail',category:'office',name:account.provider==='gmail'?'Gmail':'Outlook',description:account.address})),
    ...integrations.mcp.map(m=>({ ...m,id:'mcp-'+m.name,kind:'mcp',category:'automation',sourceName:m.name,name:toolNames[m.name]?.[0]||m.name})),
  ];
  const catalog=catalogForFeatures(features).filter(s=>!(s.kind==='github'&&github?.account)&&!(s.kind==='system'&&network?.connected)&&!audioConnections[s.name] && !(s.kind==='crm'&&integrations.connections.some(c=>c.kind==='crm'&&c.provider===s.provider)));
  function open(entry) {
    if(entry.kind==='github') {setModal({type:'github-connection'});return;}

    if(entry.kind==='device') {setModal({type:'device-connection',connection:entry});return;}
    if(entry.kind==='system') {setModal({type:'tailscale'});return;}
    setModal(entry.kind==='audio'?{type:'audio-connection',name:entry.name}:{type:entry.kind==='mail'?'mail-connection':entry.kind==='crm'?'crm-connection':entry.kind==='service'?'service-connection':'connection',connection:entry});
  }
  function groups(entries, adding) {
    return groupConnections(entries.filter(accepts)).map(group=>(
      <section className="connection-category" key={group.id} aria-label={group.name}>
        <h3 className="connection-category-title">{group.name}<span>{group.entries.length}</span></h3>
        <div className="integration-grid">{group.entries.map(entry=>{
          const tool=entry.kind==='mcp', spec=toolNames[entry.sourceName];
          const fallback=entry.provider==='calendar'?Calendar:entry.kind==='device'||entry.provider==='tailscale'?Plug:spec?.[2]||Workflow;
          const content=<><BrandIcon name={tool?spec?.[1]:connectionBrand(entry)} fallback={fallback}/><div><strong>{entry.name}</strong><p>{adding||['audio','system','github'].includes(entry.kind)?entry.description:tool?`${Object.keys(entry.tools||{}).length} Werkzeuge · vom Worker bereitgestellt`:entry.kind==='device'?(entry.enabled?'Für Agenten freigegeben':'Für Agenten gesperrt'):entry.kind==='mail'?(entry.enabled?(entry.error||entry.status==='error'?'Verbindung prüfen':entry.status==='connected'&&entry.synced?'Postfach verbunden':'Abgleich ausstehend'):'Getrennt'):entry.kind==='crm'?crmStatus(entry):entry.kind==='service'?connectionStatus(entry):entry.kind==='webhook'?'Workflow-Webhook':'Link zum Dienst'}</p></div>{!tool&&(adding?<Plus size={20}/>:<ChevronRight size={17}/>)}</>;
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
      {!loaded&&!error&&!installed.length?<Skeleton layout="connections" label="Verbindungen werden geladen …" rows={4}/>:groups(installed,false)}
      {githubError&&<p className="connection-status" role="alert">{githubError}</p>}
      {mailError&&<p className="connection-status" role="alert">{mailError}</p>}
      {deviceError&&<p className="connection-status" role="alert">Geräte & Netzwerk: {deviceError} <button onClick={()=>window.dispatchEvent(new Event('device-connections-changed'))}>Erneut laden</button></p>}
      {error&&<p className="connection-status" role="status">{error} <button className="connection-retry" onClick={onRetry}>Erneut laden</button></p>}
      {loaded&&!error&&!filteredInstalled.length&&<p className="connection-status">{installed.length?'Keine eingerichtete Verbindung passt zu deiner Auswahl.':integrations.mcpLoading?'Werkzeuge des Workers werden ermittelt …':'Noch keine Verbindung eingerichtet.'}</p>}
      {integrations.mcpError&&<p className="connection-status" role="status">{integrations.mcpError} Vorhandene Einträge bleiben sichtbar.</p>}
    </section>
    <section aria-labelledby="available-connections">
      <h2 id="available-connections" className="section-heading">Weitere Dienste einrichten</h2>
      {groups(catalog,true)}
      {!filteredCatalog.length&&<p className="connection-status">Keine weiteren Dienste für diese Auswahl.</p>}
    </section>
  </>;
}
