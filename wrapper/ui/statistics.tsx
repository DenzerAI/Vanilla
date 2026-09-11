import {TokenBreakdown} from './usage';
import {useStatisticsData} from './statistics-client';
import {useMemo,useState} from 'react';
import {ActivityPixels} from './components/ui/activity-pixels';
import {ChevronLeft} from './icons.jsx';
import {summarizeStatistics,formatStat} from './statistics-data.mjs';
import './statistics.css';

export function StatisticsCard({data,active,reduceMotion}:{data:any;active:boolean;reduceMotion:boolean}) {
 const summary=data?.events?summarizeStatistics(data):null;
 const today=summary?.calendar.at(-1)?.count||0;
 return <>
  <strong>{summary?`${summary.activeDays} aktive Tage`:'Statistik'}</strong>
  {summary?<><span className="attention-fan-description">{formatStat(summary.sessions)} Gespräche · {formatStat(summary.messages)} Nachrichten</span><ActivityPixels days={summary.calendar} compact active={active} reduceMotion={reduceMotion}/><span className="statistics-card-note"><span>{formatStat(today)} Nachrichten heute</span><span>Serie {summary.streak} Tage · Rekord {summary.longest}</span></span></>:<span className="attention-fan-description">{data?.error?'Statistik konnte nicht geladen werden. Klicke zum erneuten Laden.':'Deine Aktivität wird geladen …'}</span>}
 </>;
}
export function StatisticsDashboard({data,reduceMotion=false,onBack,api,visible=true}:{data:any;reduceMotion?:boolean;onBack?:()=>void;api?:any;visible?:boolean}) {
 const [period,setPeriod]=useState(0),[tab,setTab]=useState('overview');
 const live=useStatisticsData(api,data.projectId,'',true,tab==='usage'&&visible);
 const source=tab==='usage'&&live?.events?live:data;
 const days=[0,30,7][period],s=useMemo(()=>summarizeStatistics(source,days),[source,days]);
 const periods=['Gesamt','Letzte 30 Tage','Letzte 7 Tage'];
 const metrics=[['Gespräche',s.sessions],['Nachrichten',s.messages],['Tokens',s.tokens],['Aktive Tage',s.activeDays],['Tage in Folge',s.streak],['Längste Serie',s.longest],['Häufigste Uhrzeit',s.peak===null?'–':`${s.peak} Uhr`],['Häufigstes Modell',s.preferred]];
 const total=s.models.reduce((n,m)=>n+m.turns,0);
 return <section className="statistics-report" aria-label="Statistik" data-capability="chat.statistics">
  <div className="statistics-heading">{onBack&&<button type="button" className="statistics-back" onClick={onBack}><ChevronLeft size={16}/><span>Zurück zu den Kacheln</span></button>}<h2>Statistik</h2></div>
  <div className="statistics-controls">
   <div className="design-segments" role="group" aria-label="Statistikansicht">{[['overview','Übersicht'],['models','Modelle'],['usage','Verbrauch']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
   <div className="design-segments statistics-period" role="group" aria-label="Zeitraum">{['Gesamt','30 Tage','7 Tage'].map((label,index)=><button type="button" key={label} aria-label={periods[index]} aria-pressed={period===index} onClick={()=>setPeriod(index)}>{label}</button>)}</div>
  </div>
  <div aria-live="polite" className="sr-only">{periods[period]}: {s.messages} Nachrichten an {s.activeDays} Tagen.</div>
  {tab==='usage'?<>
   <div className="usage-live-heading"><span>{api?'Live-Verbrauch':'Verbrauch'} · {formatStat(s.tokens)} Tokens</span><span className="usage-note">{live?.error?'Aktualisierung fehlgeschlagen · gespeicherter Stand':api?'Aktualisiert während der Arbeit':'Gespeicherter Stand'}</span></div>
   <TokenBreakdown data={s.usage}/>
   {s.usageModels.map((m:any)=><details key={m.workerId+m.name} className="statistics-coverage"><summary>{m.workerId==='claw-code'?'Claude Code':'Codex'} · {m.name}</summary><TokenBreakdown data={m.tokens}/></details>)}
   <p className="usage-note">{s.usageTurns} von {s.periodTurns} Runden mit vollständig erfassten Verbrauchswerten. Ältere Werte lassen sich nicht vollständig nach Datum oder Modell aufteilen. „–“ bedeutet nicht gemeldet.</p>
   <p className="usage-note">Codex zählt Cache-Lesen innerhalb der Eingabe; Claude meldet Cache separat. Reasoning ist Teil der Ausgabe, bei Claude nicht getrennt ausgewiesen. Modellwerte von Claude können zusätzliche interne Aufrufe enthalten.</p>
  </>:tab==='overview'?<dl className="statistics-metrics">{metrics.map(([label,value])=><div key={String(label)}><dt>{label}</dt><dd>{typeof value==='number'?formatStat(value):value===null?'–':value}</dd></div>)}</dl>:<div className="statistics-models">{s.models.length?s.models.map(model=><div className="statistics-model" key={model.name}><span>{model.name}</span><span>{formatStat(model.turns)} Runden · {Math.round(model.turns/total*100)} %</span><meter min={0} max={total} value={model.turns} aria-label={`${model.name}: ${model.turns} Gesprächsrunden`}/></div>):<p>Noch keine Modellnutzung erfasst.</p>}<p className="page-note">Eine Runde besteht aus deiner Nachricht und der Antwort. Ältere Modellwechsel sind nicht immer belegt.</p></div>}
  <div className="statistics-calendar" key={period}><ActivityPixels days={s.calendar} reduceMotion={reduceMotion}/><div className="statistics-legend"><span>{s.chartFrom} bis {s.calendar.at(-1)?.day}</span><span>Ein Feld = ein Tag · heller = mehr Nachrichten</span></div></div>
  {!s.messages&&<p>Noch keine datierten Gespräche in diesem Zeitraum.</p>}
  <details className="statistics-coverage"><summary>Was zählt hier mit?</summary><p>Gespeicherte Gespräche dieses Workspaces, einschließlich Archiv. Private Chats, Aufträge und Berichtschats bleiben außen vor. Gezählt werden deine Nachrichten und eine finale Antwort pro Runde. Werkzeugschritte und Zwischenmeldungen zählen nicht. Übernommene Runden zählen einmal.</p><p>Die aktuelle Serie läuft weiter, wenn du gestern aktiv warst und heute noch Zeit bleibt. Die längste Serie bezieht sich auf den gewählten Zeitraum.</p><p>{data.coverage.availableSessions} von {data.totalSessions} Verläufen verfügbar. {data.coverage.undated} Runden ohne Datum und {data.coverage.unknownModels} ohne belegtes Modell. Undatierte Nachrichten zählen nur unter Gesamt; aktive Tage und Serien beruhen auf belegten Datumsangaben.</p><p>Tokens sind verarbeitete Textbausteine, einschließlich wiederholt gelesenem Kontext. Gesamtsummen sind für {data.coverage.tokenSessions} Gespräche belegt. Ältere Gesamtsummen und übernommene Verläufe lassen sich nicht verlässlich aufteilen. Der Verbrauch zeigt zusätzlich neu erfasste Runden mit ihrer Datenabdeckung. Die Aktivitätsgrafik zeigt höchstens die letzten 26 Wochen.</p></details>
  <p className="statistics-stamp">{tab==='usage'&&live?.events?'Aktueller Stand: ':'Gespeicherter Stand: '}{new Date(source.generatedAt).toLocaleString('de-DE',{timeZone:data.timeZone})} · {data.timeZone}</p>
 </section>;
}
