import React, {useState} from 'react';
import {SettingRow} from './settings-row.jsx';
import {demoSessions, demoTickets, selectSessions, sessionTotals, durationLabel} from './work-evidence.mjs';
import './work-evidence.css';

export function ServiceSettings() {
  const [expanded,setExpanded]=useState({sessions:false,tickets:false});
  const [period,setPeriod]=useState('september');
  const [showDemo,setShowDemo]=useState(false);
  const [ticketFilter,setTicketFilter]=useState('open');
  const [tickets,setTickets]=useState(demoTickets);
  const bounds=period==='september'?['2026-09-01','2026-09-30']:period==='august'?['2026-08-01','2026-08-31']:['',''];
  const rows=selectSessions(showDemo?demoSessions:[],bounds[0],bounds[1]);
  const totals=sessionTotals(rows);
  const last=showDemo?selectSessions(demoSessions,'','')[0]:null;
  const shownTickets=showDemo?tickets.filter(t=>ticketFilter==='all'||t.status===ticketFilter):[];
  const date=(day:string)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
  return <div className="work-evidence-settings">
    <p className="section-intro">Betreuung und Einsätze an deinem System. Vorschau mit Beispieldaten.</p>
    <div className="settings-group">
      <SettingRow title="Zeitraum" action={<select aria-label="Zeitraum" value={period} onChange={e=>setPeriod(e.target.value)}><option value="september">September 2026</option><option value="august">August 2026</option><option value="all">Alle Beispiele</option></select>}/>
      <SettingRow title="Menschzeit" action={<span className="work-evidence-duration">{durationLabel(totals.human)}</span>}/>
      <SettingRow title="Agentlaufzeit" action={<span className="work-evidence-duration">{durationLabel(totals.agent)}</span>}/>
    </div>
    <div className="settings-group">
      <SettingRow title="Einsätze" description={last?`Zuletzt ${date(last.day)} um ${last.start} Uhr`:'Noch kein Nachweis'} action={<button aria-expanded={expanded.sessions} aria-controls="service-sessions" onClick={()=>setExpanded(v=>({...v,sessions:!v.sessions}))}>{expanded.sessions?'Schließen':`${rows.length} anzeigen`}</button>}/>
      {expanded.sessions&&<div id="service-sessions" className="work-evidence-expanded">
        {!rows.length?<p className="work-evidence-note">Keine Einsätze in diesem Zeitraum.</p>:rows.map((row: typeof demoSessions[number])=><details key={row.id} className="work-evidence-row">
          <summary><span className="work-evidence-summary">{row.summary}<small>{date(row.day)} · {row.actor} · {row.channel}</small></span><span className="work-evidence-duration">{durationLabel(row.minutes)}</span><span aria-hidden="true">⌄</span></summary>
          <p>{row.kind==='human'?'Mensch':'Agent'} · {row.start} Uhr. {row.detail}</p>
        </details>)}
      </div>}
      <SettingRow title="Meldungen" description={showDemo?`${tickets.filter(t=>t.status==='open').length} offen`:'Keine Meldungen'} action={<button aria-expanded={expanded.tickets} aria-controls="service-tickets" onClick={()=>setExpanded(v=>({...v,tickets:!v.tickets}))}>{expanded.tickets?'Schließen':'Anzeigen'}</button>}/>
      {expanded.tickets&&<div id="service-tickets" className="work-evidence-expanded">
        <label className="work-evidence-filter">Status<select value={ticketFilter} onChange={e=>setTicketFilter(e.target.value)}><option value="open">Offen</option><option value="done">Erledigt</option><option value="all">Alle</option></select></label>
        {!shownTickets.length?<p className="work-evidence-note">Keine Meldungen für diesen Status.</p>:shownTickets.map(ticket=><details key={ticket.id} className="work-evidence-row"><summary><span className="work-evidence-summary">{ticket.title}</span><span className="work-evidence-date">{ticket.status==='open'?'Offen':'Erledigt'}</span><span aria-hidden="true">⌄</span></summary><p>{ticket.detail}</p><button onClick={()=>setTickets(current=>current.map(t=>t.id===ticket.id?{...t,status:t.status==='open'?'done':'open'}:t))}>{ticket.status==='open'?'Im Beispiel erledigen':'Im Beispiel wieder öffnen'}</button></details>)}
      </div>}
    </div>
    <details className="work-evidence-concept"><summary>Über diese Vorschau</summary>
      <p>Alle Einträge sind fiktiv. Es werden keine echten Arbeitszeiten erfasst. Menschzeit und Agentlaufzeit können sich überschneiden und bleiben getrennt.</p>
      <p>Die Bedienung über eine Session und der begrenzte A2A-Anschluss sind noch offen. Meldungsänderungen gelten nur bis zum Verlassen dieser Ansicht.</p>
      <div className="settings-group"><SettingRow title="Beispieldaten anzeigen" action={<button type="button" role="switch" className="apple-switch" aria-label="Beispieldaten anzeigen" aria-checked={showDemo} onClick={()=>setShowDemo(v=>!v)}><span/></button>}/></div>
    </details>
    {!showDemo&&<p className="work-evidence-note" role="status">Die echte Erfassung ist noch nicht implementiert.</p>}
  </div>;
}
