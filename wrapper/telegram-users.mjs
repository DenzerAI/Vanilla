// IDs authorize access. Names are display labels only. Legacy ID lists remain readable.
export function telegramUsers(config = {}) {
  let rows = config?.users;
  if (rows === undefined) {
    const legacy = config?.allowedUsers ?? [];
    rows = (Array.isArray(legacy) ? legacy : String(legacy).split(/[\s,;]+/))
      .filter(id => String(id).trim()).map(id => ({id: String(id), name: ''}));
  }
  if (!Array.isArray(rows) || rows.length > 200) throw Error('Maximal 200 zugelassene Nutzer eintragen.');
  const seen = new Set();
  return rows.map(row => {
    if (!row || typeof row !== 'object') throw Error('Nutzer mit Name und ID eintragen.');
    const id = String(row.id ?? '').trim();
    const name = String(row.name ?? '').trim();
    if (!/^[1-9]\d{0,15}$/.test(id) || BigInt(id) > 4503599627370495n)
      throw Error('Telegram: gültige IDs aus positiven Ziffern erforderlich.');
    if (seen.has(id)) throw Error('Diese Telegram-ID ist bereits eingetragen.');
    if (name.length > 100 || /[\x00-\x1f\x7f]/.test(name)) throw Error('Name: maximal 100 Zeichen ohne Zeilenumbruch.');
    seen.add(id);
    return {id, name};
  });
}
