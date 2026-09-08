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
