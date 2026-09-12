import React, {useEffect, useRef, useState} from 'react';
import {addDays, monday, parseDay, monthGrid, timedLayout} from './planner-dates.mjs';
import type {PlannerEvent} from './planner-demo';

type Props = {
  date: string; today: string; mode: string; workweek: boolean; timezone: string;
  events: PlannerEvent[]; onDate: (date: string) => void;
  onOpen: (event: PlannerEvent) => void; onCreate: (date: string, hour?: number) => void;
};
const label = (day: string) => parseDay(day).toLocaleDateString('de-DE', {weekday:'long', day:'numeric', month:'long'});
const hourLabel = (hour: number) => `${String(hour).padStart(2,'0')}:00`;
function EventChip({event, onOpen}: {event: PlannerEvent; onOpen: () => void}) {
  return <button type="button" className="calendar-event-chip" data-external={event.readOnly || undefined}
    onClick={onOpen} title={`${event.title} · ${event.allDay ? 'Ganztägig' : event.start + '–' + event.end} · ${event.source}`}>
    {!event.allDay && <time>{event.start}</time>}<span>{event.title}</span>
  </button>;
}
export function PlannerCalendar({date,today,mode,workweek,timezone,events,onDate,onOpen,onCreate}: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const [now,setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()),60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight / 24 * 7; }, [mode]);
  const onDay = (day: string) => events.filter(event => event.date === day);
  const days = mode === 'day' ? [date] : Array.from({length: workweek ? 5 : 7},(_,i) => addDays(monday(date),i));
  const mobileDay = days.includes(date) ? date : days[0];
  const clock = new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now));
  const [hour,minute] = clock.split(':').map(Number);
  const weekday = (day: string) => parseDay(day).toLocaleDateString('de-DE',{weekday:'short'}).replace('.','');
  const dayButton = (day: string) => <button type="button" className="calendar-date-button" aria-label={label(day)}
    aria-current={day === today ? 'date' : undefined} aria-pressed={day === date} onClick={() => onDate(day)}>{parseDay(day).getDate()}</button>;
  if (mode === 'month') return <>
    <div className="calendar-month-grid" data-columns={workweek ? 5 : 7}>
      <div className="calendar-weekdays">{monthGrid(date,workweek)[0].map((day: string) => <span key={day}>{weekday(day)}</span>)}</div>
      {monthGrid(date,workweek).map((week: string[]) => <div className="calendar-month-row" key={week[0]}>
        {week.map(day => <section key={day} className="calendar-month-cell" aria-label={label(day)}
          data-outside={day.slice(0,7) !== date.slice(0,7) || undefined} data-selected={day === date || undefined}>
          {dayButton(day)}
          <div className="calendar-cell-events">{onDay(day).slice(0,3).map(event => <EventChip key={event.id} event={event} onOpen={() => onOpen(event)} />)}
          {onDay(day).length > 3 && <button type="button" className="calendar-more" onClick={() => onDate(day)}>+{onDay(day).length - 3} weitere</button>}</div>
          <button type="button" className="calendar-mobile-count" aria-label={`${onDay(day).length} Termine am ${label(day)}`} onClick={() => onDate(day)}>
            {onDay(day).length > 0 && <><span aria-hidden="true">•</span><span>{onDay(day).length}</span></>}
          </button>
        </section>)}
      </div>)}
    </div>
    <section className="calendar-selected-agenda" aria-label="Termine am ausgewählten Tag">
      <header><h3>{label(date)}</h3><button type="button" className="small-button" onClick={() => onCreate(date)}>Termin hinzufügen</button></header>
      {onDay(date).length ? onDay(date).map(event => <EventChip key={event.id} event={event} onOpen={() => onOpen(event)} />) : <p className="planner-empty">Keine Termine</p>}
    </section>
  </>;
  return <div className={'calendar-time-view ' + (mode === 'week' ? 'calendar-time-week' : '')}
    data-columns={days.length}>
    <div className="calendar-time-headers"><span className="calendar-zone-label">{mode === 'week' ? 'Woche' : weekday(date)}</span>
      {days.map(day => <div key={day} className="calendar-time-header" data-active={day === mobileDay || undefined}><span>{weekday(day)}</span>{dayButton(day)}</div>)}
    </div>
    <div className="calendar-all-day"><span>Ganztägig</span>{days.map(day => <div key={day} data-active={day === mobileDay || undefined}>
      {onDay(day).filter(event => event.allDay).map(event => <EventChip key={event.id} event={event} onOpen={() => onOpen(event)} />)}
    </div>)}</div>
    <div className="calendar-time-scroll" ref={scroll} tabIndex={0} aria-label="Stundenraster, 0 bis 24 Uhr">
      <div className="calendar-time-grid">
        <div className="calendar-hour-labels">{Array.from({length:24},(_,hour) => <span key={hour}>{hourLabel(hour)}</span>)}</div>
        {days.map(day => <div key={day} className="calendar-time-column" data-active={day === mobileDay || undefined} aria-label={label(day)}>
          {Array.from({length:24},(_,hour) => <button key={hour} type="button" className="calendar-hour-slot"
            aria-label={`Termin am ${label(day)} um ${hourLabel(hour)} hinzufügen`} onClick={() => onCreate(day,hour)} />)}
          {timedLayout(onDay(day)).map(({event,start,end,column,columns}: any) => <button key={event.id} type="button" className="calendar-time-event"
            data-external={event.readOnly || undefined} title={`${event.title} · ${event.start}–${event.end} · ${event.location || event.source}`}
            aria-label={`${event.title}, ${event.start} bis ${event.end}`} onClick={() => onOpen(event)}
            style={{top:`${start / 1440 * 100}%`,height:`${(end-start) / 1440 * 100}%`,left:`${column / columns * 100}%`,width:`${100 / columns}%`}}>
            <strong>{event.title}</strong><span>{event.start}–{event.end}</span>{event.location && end-start >= 60 && <span>{event.location}</span>}
          </button>)}
          {day === today && <div className="calendar-now-line" style={{top:`${(hour*60+minute) / 1440 * 100}%`}} aria-label={`Jetzt ${clock}`} />}
        </div>)}
      </div>
    </div>
  </div>;
}
