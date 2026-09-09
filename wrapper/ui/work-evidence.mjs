// Deliberately isolated demo fixtures. No customer records or activity hooks.
export const demoSessions = [
  {id:'demo-1',day:'2026-09-09',start:'09:00',minutes:45,actor:'Operator Alex',kind:'human',channel:'Remote',summary:'Die Sicherung eingerichtet und eine Wiederherstellung geprüft.',detail:'Die Testdatei ließ sich vollständig wiederherstellen. Der Kunde findet die Sicherung jetzt an einem festen Ort.'},
  {id:'demo-2',day:'2026-09-09',start:'09:15',minutes:12,actor:'Service-Agent',kind:'agent',channel:'A2A',summary:'Die eingerichteten Verbindungen geprüft.',detail:'Ein abgelaufener Zugang wurde als Meldung erfasst. Diese Agentlaufzeit überschneidet sich mit dem menschlichen Einsatz.'},
  {id:'demo-3',day:'2026-09-08',start:'14:00',minutes:30,actor:'Operator Alex',kind:'human',channel:'Sprache',summary:'Den Ablauf für neue Dokumente gemeinsam durchgesprochen.',detail:'Der Ablageweg wurde anhand eines Beispiels erklärt und geprüft.'},
  {id:'demo-4',day:'2026-09-07',start:'10:30',minutes:8,actor:'Service-Agent',kind:'agent',channel:'Chat',summary:'Doppelte Verweise in der Anleitung gefunden.',detail:'Die betroffenen Stellen wurden zur Prüfung zusammengestellt.'},
  {id:'demo-5',day:'2026-08-28',start:'11:00',minutes:60,actor:'Operator Alex',kind:'human',channel:'Remote',summary:'Den Dokumenteneingang eingerichtet.',detail:'Drei neutrale Beispieldokumente wurden erfolgreich zugeordnet.'},
];
export const demoTickets = [
  {id:'demo-ticket-1',title:'Zugang zur Dokumentenablage abgelaufen',status:'open',detail:'Der Zugang muss in den Verbindungen erneut bestätigt werden. Noch keine Nachricht versendet.'},
  {id:'demo-ticket-2',title:'Sicherung wiederhergestellt',status:'done',detail:'Die Wiederherstellung wurde mit einer Testdatei geprüft.'},
];
export function selectSessions(sessions, from, to) {
  return sessions.filter(s => (!from || s.day >= from) && (!to || s.day <= to))
    .sort((a,b) => (b.day+b.start).localeCompare(a.day+a.start));
}
export function sessionTotals(sessions) {
  return sessions.reduce((out,s) => {
    if ((s.kind==='human'||s.kind==='agent') && Number.isFinite(s.minutes) && s.minutes>=0) out[s.kind]+=s.minutes;
    return out;
  },{human:0,agent:0});
}
export function durationLabel(minutes) {
  const hours=Math.floor(minutes/60), rest=minutes%60;
  return hours ? `${hours} Std.${rest ? ` ${rest} Min.` : ''}` : `${rest} Min.`;
}
