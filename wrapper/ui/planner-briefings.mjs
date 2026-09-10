import {addDays, parseDay} from './planner-dates.mjs';

export function demoBriefings(today) {
  const summaries = [
    'Projektabstimmung um 10 Uhr, Angebot am Nachmittag. Die neue Terminänderung braucht noch deine Entscheidung.',
    'Die Anforderungen sind gesammelt. Als Nächstes stehen die Projektabstimmung und der Angebotsentwurf an.',
    'Ein ruhiger Vormittag für die Vorbereitung. Offene Fragen für das nächste Projektgespräch zusammenstellen.',
    'Rückmeldungen sichten und die nächsten Schritte sortieren. Zeit für die Projektvorbereitung freihalten.',
  ];
  return summaries.map((body, index) => {
    const date = addDays(today, -index);
    const at = parseDay(date); at.setHours(7, 0, 0, 0);
    return {id:'demo-briefing-' + date, date, title:'Morgenbriefing', body,
      created_at:at.getTime()/1000, demo:true};
  });
}

export function briefingText(item) {
  if(item.kind==='weather')return item.body;
  return '# ' + item.title + '\n\n' + new Date(item.created_at * 1000).toLocaleString('de-DE')
    + (item.demo ? ' · Beispielbericht' : ' · Routine-Ergebnis') + '\n\n' + item.body
    + (item.demo ? '\n\n**Quellen:** Fiktiver Kalender, verknüpfter Beispielkontakt und Beispielnachricht. Dieser Bericht zeigt einen früheren Stand; spätere Änderungen gehören zum aktuellen Tagesplan. Alle Angaben in diesem Beispiel sind erfunden.' : '');
}
