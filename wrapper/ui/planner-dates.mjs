// Calendar arithmetic uses local civil dates; no UTC conversion or 24-hour stepping.
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDay(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw Error("Ungültiges Datum");
  const [y, m, d] = key.split("-").map(Number);
  const result = new Date(y, m - 1, d, 12);
  if (dateKey(result) !== key) throw Error("Ungültiges Datum");
  return result;
}
export function addDays(key, days) {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function shiftMonth(key, months) {
  const d = parseDay(key),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateKey(d);
}
export function monday(key) {
  const d = parseDay(key);
  return addDays(key, -((d.getDay() + 6) % 7));
}
export function isoWeek(key) {
  const local = parseDay(key),
    d = new Date(
      Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()),
    );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  return {
    year,
    week: Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7),
  };
}
export function monthWeeks(key, workweek = false) {
  const d = parseDay(key),
    first = dateKey(new Date(d.getFullYear(), d.getMonth(), 1, 12)),
    last = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  const weeks = [];
  for (let start = monday(first); start <= last; start = addDays(start, 7)) {
    const days = Array.from({ length: workweek ? 5 : 7 }, (_, i) =>
      addDays(start, i),
    ).filter((day) => day >= first && day <= last);
    if (days.length) weeks.push({ start, ...isoWeek(start), days });
  }
  return weeks;
}
export function eventOnDay(event, day) {
  return event.date === day;
}
export function sortEvents(events) {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.allDay) - Number(a.allDay) ||
      a.start.localeCompare(b.start) ||
      a.title.localeCompare(b.title),
  );
}

// Full weeks keep month cells aligned, including adjacent months.
export function monthGrid(key, workweek = false) {
  const first = key.slice(0, 7) + '-01';
  const last = addDays(shiftMonth(first, 1), -1);
  const rows = [];
  for (let start = monday(first); start <= last; start = addDays(start, 7)) {
    const days = Array.from({length: workweek ? 5 : 7}, (_, index) => addDays(start, index));
    if (days.some(day => day >= first && day <= last)) rows.push(days);
  }
  return rows;
}

export function timedLayout(events) {
  const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const items = events.filter(event => !event.allDay).map(event => {
    const start = minutes(event.start);
    const end = Math.min(1440, Math.max(start + 15, minutes(event.end) || 1440));
    return {event, start, end, column: 0, columns: 1};
  }).sort((a,b) => a.start - b.start || b.end - a.end);
  let group = [], ends = [], groupEnd = -1;
  const finish = () => { for (const item of group) item.columns = ends.length; };
  for (const item of items) {
    if (item.start >= groupEnd) { finish(); group = []; ends = []; groupEnd = -1; }
    let column = ends.findIndex(end => end <= item.start);
    if (column < 0) column = ends.length;
    ends[column] = item.end;
    item.column = column;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.end);
  }
  finish();
  return items;
}
