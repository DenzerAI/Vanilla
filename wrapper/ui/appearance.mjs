export const appearanceOptions = {
  welcomeParticles: { default: 'on', options: [['off', 'Aus'], ['on', 'Nur neue Chats'], ['all', 'Alle Chats']] },
  uiFont: { default: 'inter', options: [['inter', 'Inter'], ['system', 'Systemschrift']] },
  textSize: { default: 'standard', options: [['small', 'Klein'], ['standard', 'Standard'], ['large', 'Groß']] },
  reduceMotion: { default: 'system', options: [['system', 'Wie im System'], ['on', 'Reduzieren']] },
};
export const projectIcons = [['folder','Ordner'], ['code','Code'], ['briefcase','Arbeit'], ['globe','Web'], ['idea','Ideen'], ['calendar','Planung'], ['message','Gespräche'], ['files','Dokumente']];
export function validateAppearance(change) {
  const result = {};
  for (const [key, spec] of Object.entries(appearanceOptions)) {
    if (change[key] === undefined) continue;
    if (!spec.options.some(([value]) => value === change[key])) throw new Error('Unbekannte Darstellungseinstellung.');
    result[key] = change[key];
  }
  return result;
}
export function relativeTime(value, now = Date.now()) {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  const mins = Math.max(0, Math.floor((now - ms) / 60000));
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.floor(hours / 24)} Tagen`;
}
export function projectChatList(chats, projectId, expanded) {
  const all = chats.filter(c => !c.archived && (c.projectId || 'default') === projectId).sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const pinned = all.filter(c => c.pinned), rest = all.filter(c => !c.pinned);
  return { visible: [...pinned, ...(expanded ? rest : rest.slice(0,5))], more: rest.length > 5 };
}

export const projectColors = [['default', 'Standard'], ['red', 'Rot'], ['orange', 'Orange'], ['yellow', 'Gelb'], ['green', 'Grün'], ['blue', 'Blau'], ['purple', 'Violett'], ['pink', 'Rosa']];
export function projectColor(value) {
  return value !== 'default' && projectColors.some(([key]) => key === value) ? `var(--project-${value})` : 'var(--muted)';
}

// Compare local calendar days so midnight and daylight-saving changes stay correct.
export function chatDateGroup(chat, now = Date.now()) {
  if (chat.pinned) return 'Angeheftet';
  const date = new Date(chat.updatedAt);
  if (!Number.isFinite(date.getTime())) return 'Älter';
  const today = new Date(now);
  const day = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const age = Math.round((day(today) - day(date)) / 86400000);
  if (age <= 0) return 'Heute';
  if (age === 1) return 'Gestern';
  if (age < 7) return 'Letzte 7 Tage';
  if (age < 30) return 'Letzte 30 Tage';
  return 'Älter';
}
