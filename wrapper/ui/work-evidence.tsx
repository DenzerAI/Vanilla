import React, {useState, type ComponentType, type ReactNode} from 'react';
import {demoSessions, demoTickets, selectSessions, sessionTotals, durationLabel} from './work-evidence.mjs';
import './work-evidence.css';

type HeadingProps = {title:string; onShowSidebar?:()=>void; children?:ReactNode};
export function WorkEvidencePage({PageHeading,onShowSidebar}:{PageHeading:ComponentType<HeadingProps>;onShowSidebar?:()=>void}) {
  const [period,setPeriod]=useState('september');
  const [showDemo,setShowDemo]=useState(true);
  const [ticketFilter,setTicketFilter]=useState('open');
  const [tickets,setTickets]=useState(demoTickets);
  const bounds=period==='september'?['2026-09-01','2026-09-30']:period==='august'?['2026-08-01','2026-08-31']:['',''];
  const rows=selectSessions(showDemo?demoSessions:[],bounds[0],bounds[1]);
  const totals=sessionTotals(rows);
  const last=showDemo?selectSessions(demoSessions,'','')[0]:null;
  const shownTickets=showDemo?tickets.filter(t=>ticketFilter==='all'||t.status===ticketFilter):[];
  const date=(day:string)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
  return <div className="page work-evidence-page">
    <PageHeading title="Arbeitsnachweis" onShowSidebar={onShowSidebar}/>
    <div className="work-evidence-controls">
      <label>Zeitraum<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="september">September 2026</option><option value="august">August 2026</option><option value="all">Alle Beispiele</option></select></label>
      <label className="work-evidence-toggle"><input type="checkbox" checked={showDemo} onChange={e=>setShowDemo(e.target.checked)}/>Beispieldaten anzeigen</label>
    </div>
    <p className="work-evidence-note" role="status">{showDemo?'Konzept mit fiktiven Beispieldaten. Es werden keine echten Arbeitszeiten erfasst.':'Die echte Erfassung ist noch nicht eingerichtet. Es liegen keine Arbeitsnachweise vor.'}</p>
    <dl className="work-evidence-totals" aria-label="Zeiten im gewählten Zeitraum">
      <div><dt>Menschzeit</dt><dd>{durationLabel(totals.human)}</dd></div>
      <div><dt>Agentlaufzeit</dt><dd>{durationLabel(totals.agent)}</dd></div>
    </dl>
    <p className="work-evidence-note">Zeiten können sich überschneiden und werden getrennt ausgewiesen.</p>
    <p className="work-evidence-last">Letzter Zugriff{showDemo?' im Beispiel':''}: {last?`${date(last.day)}, ${last.start} Uhr · ${last.actor} · ${last.channel}`:'Noch kein Nachweis'}</p>
    <section aria-labelledby="work-evidence-sessions"><h2 id="work-evidence-sessions">Einsätze</h2>
      {!rows.length?<p className="work-evidence-note">Keine Einsätze in diesem Zeitraum.</p>:rows.map((row: typeof demoSessions[number])=><details key={row.id} className="work-evidence-row">
        <summary><span className="work-evidence-date">{date(row.day)} · {row.start}</span><span className="work-evidence-summary">{row.summary}<small>{row.actor} · {row.kind==='human'?'Mensch':'Agent'} · {row.channel}</small></span><span className="work-evidence-duration">{durationLabel(row.minutes)}</span></summary>
        <p>{row.detail}</p>
      </details>)}
    </section>
    <section aria-labelledby="work-evidence-tickets"><div className="work-evidence-section-heading"><h2 id="work-evidence-tickets">Meldungen</h2><label>Status<select value={ticketFilter} onChange={e=>setTicketFilter(e.target.value)}><option value="open">Offen</option><option value="done">Erledigt</option><option value="all">Alle</option></select></label></div>
      {!shownTickets.length?<p className="work-evidence-note">Keine {ticketFilter==='done'?'erledigten':ticketFilter==='open'?'offenen':''} Meldungen.</p>:shownTickets.map(ticket=><details key={ticket.id} className="work-evidence-row"><summary><span className="work-evidence-summary">{ticket.title}</span><span className="work-evidence-date">{ticket.status==='open'?'Offen':'Erledigt'}</span></summary><p>{ticket.detail}</p><button onClick={()=>setTickets(current=>current.map(t=>t.id===ticket.id?{...t,status:t.status==='open'?'done':'open'}:t))}>{ticket.status==='open'?'Im Beispiel erledigen':'Im Beispiel wieder öffnen'}</button></details>)}
    </section>
    <p className="work-evidence-note">Meldungsänderungen gelten nur für diese Vorschau und werden beim Verlassen zurückgesetzt. Der A2A-Anschluss ist geplant.</p>
  </div>;
}
