import {isoWeek} from './planner-dates.mjs';
const instant=v=>Date.parse(v);
const safe=v=>String(v||'').replace(/[\r\n|<>`\[\]*_#]/g,' ').slice(0,300);
export function calendarState(data,now=Date.now()) {
 if(!data)return 'loading';
 if(data.error)return 'error';
 if(!data.localReady&&!data.feeds?.length)return 'unavailable';
 if((data.feeds||[]).some(f=>f.error||!f.covered||!Number.isFinite(instant(f.synced))||now-instant(f.synced)>600000))return 'stale';
 return 'ready';
}
export function calendarClock(now,timezone) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=k=>parts.find(p=>p.type===k).value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function calendarCard(data,now=Date.now()) {
 const timezone=data?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 const date=calendarClock(now,timezone),state=calendarState(data,now);
 const valid=data?.date===date;
 const events=(valid?data?.events||[]:[]).filter(e=>e.date===date);
 const timed=events.filter(e=>!e.allDay&&Number.isFinite(instant(e.startsAt))&&instant(e.endsAt)>now).sort((a,b)=>instant(a.startsAt)-instant(b.startsAt));
 const next=timed[0]||events.find(e=>e.allDay);
 let relative='';
 if(next){const minutes=Math.max(1,Math.ceil((instant(next.startsAt)-now)/60000));relative=next.allDay?'Ganztägig':instant(next.startsAt)<=now?'Läuft gerade':minutes<60?`in ${minutes} Min.`:`in ${Math.floor(minutes/60)} Std.${minutes%60?' '+minutes%60+' Min.':''}`;}
 return {date,timezone,week:isoWeek(date).week,state:!valid&&state==='ready'?'loading':state,next,relative,following:timed.filter(e=>e!==next).slice(0,2),events};
}
export function calendarGaps(data,now=Date.now()) {
 if(calendarState(data,now)!=='ready'||data.events.some(e=>e.allDay))return [];
 const start=Math.max(instant(data.windowStart),now),end=instant(data.windowEnd);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return [];
 const occupied=data.events.filter(e=>!e.allDay).map(e=>[Math.max(start,instant(e.startsAt)),Math.min(end,instant(e.endsAt))]).filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).sort((a,b)=>a[0]-b[0]);
 const gaps=[];let cursor=start;
 for(const [a,b] of occupied){if(a-cursor>=15*60000)gaps.push([cursor,a]);cursor=Math.max(cursor,b);}
 if(end-cursor>=15*60000)gaps.push([cursor,end]);return gaps;
}
export function calendarReport(data) {
 const now=instant(data.now),state=calendarState(data,now),clock=v=>new Intl.DateTimeFormat('de-DE',{timeZone:data.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(v));
 const day=new Intl.DateTimeFormat('de-DE',{timeZone:data.timezone,dateStyle:'full'}).format(now);
 const lines=data.events.map(e=>`- **${e.allDay?'Ganztägig':e.start+'–'+e.end} · ${safe(e.title)}**${e.location?' · '+safe(e.location):''} (${safe(e.source)})`);
 const gaps=calendarGaps(data,now);
 const availability=state!=='ready'?'Der Kalenderstand ist unvollständig oder veraltet. Freie Zeiten lassen sich noch nicht verlässlich bestimmen.':data.events.some(e=>e.allDay)?'Ganztägige Einträge vorhanden. Bitte klären, ob sie Zeit blockieren; keine pauschale Freizeitaussage.':gaps.length?gaps.map(([a,b])=>`- ${clock(a)}–${clock(b)} · ${Math.floor((b-a)/60000)} Minuten ohne eingetragenen Termin`).join('\n'):'Heute verbleibt im betrachteten Zeitfenster keine Lücke von mindestens 15 Minuten.';
 return `# Dein Tag · ${day}\n\n**KW ${isoWeek(data.date).week}** · Stand ${clock(now)} (${data.timezone})\n\n## Termine\n\n${lines.join('\n')||(state==='ready'?'Heute sind im verfügbaren Kalender keine Termine eingetragen.':'Termine sind derzeit nicht vollständig verfügbar.')}\n\n## Wo noch Luft ist\n\n${availability}\n\nBetrachtet wird heute ab jetzt innerhalb **08:00–18:00 Uhr**, keine hinterlegte persönliche Arbeitszeit. Freie Kalendereinträge garantieren keine Verfügbarkeit; Fahrt, Vorbereitung und Pausen sind nicht automatisch enthalten.\n\nDieser Bericht ist eine Momentaufnahme. Spätere Terminänderungen bitte neu abrufen.`;
}
export const calendarPrompt='Ordne den gerade angezeigten Tagesbericht kurz und hilfreich ein: nächster Termin, heutige Schwerpunkte und bis zu drei passende Vorbereitungshinweise. Nutze nur die ausgewiesenen Termine und belegten Kontext dieses Workspaces. Nenne Überschneidungen, wenn sie aus den Zeiten hervorgehen. Freie Kalenderlücken sind keine Zusage tatsächlicher Verfügbarkeit. Erfinde weder Wegezeiten noch Teilnehmer, Baustellen, Arbeitszeiten oder Aufgaben. Bei veralteten oder unvollständigen Quellen keine freie Zeit behaupten. Ganztägige Einträge zuerst einordnen. Wiederhole die Terminliste nicht. Keine Termine anlegen, ändern, löschen oder Einladungen versenden. Der Nutzer kann im Gespräch weiterplanen.';
