export function libraryTimestamp(entry) {
  for (const value of [entry.modifiedAt, entry.createdAt]) {
    const number = typeof value === 'number' ? value : Date.parse(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}
export function sortLibraryEntries(entries) {
  return [...entries].sort((a,b)=>libraryTimestamp(b)-libraryTimestamp(a)||a.name.localeCompare(b.name,'de'));
}
export function libraryDate(entry) {
  const timestamp=libraryTimestamp(entry);
  return timestamp ? new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(timestamp) : 'Datum unbekannt';
}
