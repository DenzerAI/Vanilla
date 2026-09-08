import {isComputerTool} from "./tool-content.mjs";
export function timestamp(value) {
  if (value == null) return null;
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}
export function dayLabel(value, now = Date.now()) {
  const ms = timestamp(value);
  if (ms == null) return null;
  const date = new Date(ms), today = new Date(now), yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Heute';
  if (date.toDateString() === yesterday.toDateString()) return 'Gestern';
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function durationLabel(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  return `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
}
const activityKinds = {
  reasoning: ['Überlegungen', 'Denkt nach', 'Überlegungen'],
  web: ['Im Web gesucht', 'Sucht im Web', 'Websuche'],
  edit: ['Dateien bearbeitet', 'Bearbeitet Dateien', 'Dateiänderung'],
  read: ['Dateien gelesen', 'Liest Dateien', 'Dateizugriff'],
  command: ['Befehle ausgeführt', 'Führt Befehle aus', 'Befehl'],
  browser: ['Browser verwendet', 'Verwendet den Browser', 'Browseraktion'],
  image: ['Bildwerkzeuge verwendet', 'Arbeitet mit Bildern', 'Bildverarbeitung'],
  agent: ['Mit Agenten abgestimmt', 'Stimmt sich mit Agenten ab', 'Abstimmung'],
  context: ['Kontext zusammengefasst', 'Fasst Kontext zusammen', 'Zusammenfassung'],
  wait: ['Gewartet', 'Wartet', 'Warteschritt'],
  tool: ['Werkzeuge verwendet', 'Verwendet Werkzeuge', 'Werkzeugaufruf'],
};
export function activityKind(item) {
  let name = `${item.server || ''} ${item.toolName || ''} ${item.tool || ''} ${item.name || ''}`;
  // The adapter also supplies short wrapper names. Recognize only the leading
  // public invocation, never keywords in tool output or arbitrary shell text.
  if (['exec', 'functions.exec'].includes(item.toolName)) {
    const call = String(item.command || '').match(/^\s*(?:text\(|(?:const|let)\s+\w+\s*=\s*)?await\s+tools\.(\w+)\s*\(/);
    if (call) name += ' ' + call[1];
  }
  if (item.toolName === 'js') {
    try {
      const code = JSON.parse(item.command).code;
      if (/\bcua\.|\.getAXState\(|\.getScreenshot\(/.test(code)) return 'browser';
    } catch { /* Unknown wrappers keep the neutral label. */ }
  }
  if (item.type === 'reasoning') return 'reasoning';
  if (/cua|computer|browser/i.test(name)) return 'browser';
  if (item.type === 'webSearch' || /search|web__/i.test(name)) return 'web';
  if (item.type === 'fileChange' || /apply_patch|write_file|edit_file/i.test(name)) return 'edit';
  if (/read_file|list_dir/i.test(name)) return 'read';
  if (['imageGeneration', 'imageView'].includes(item.type)) return 'image';
  if (['collabAgentToolCall', 'subAgentActivity'].includes(item.type)) return 'agent';
  if (item.type === 'contextCompaction') return 'context';
  if (item.type === 'sleep') return 'wait';
  // A generic tool wrapper is not evidence that a shell command was executed.
  if (item.type === 'commandExecution' && (!item.toolName || /exec_command|write_stdin|bash|terminal/i.test(name))) return 'command';
  return 'tool';
}
export function activityLabel(item, live = false) {
  if (isComputerTool(item)) return item.status === 'failed' ? 'Computer Use fehlgeschlagen' : item.status === 'inProgress' && !live ? 'Computer Use ohne Abschluss' : live ? 'Computer Use · arbeitet am Bildschirm' : 'Computer Use';
  const [done, active, noun] = activityKinds[activityKind(item)];
  if (item.status === 'failed') return `${noun} fehlgeschlagen`;
  if (item.status === 'inProgress' && !live) return `${noun} ohne Abschluss`;
  return live ? active : done;
}
export function workingDurationLabel(ms) {
  return durationLabel(ms).replace(' h', ' Std.').replace(' min', ' Min.').replace(' s', ' Sek.');
}
export function groupItems(items = []) {
  const groups = [];
  for (const item of items) {
    if (['userMessage', 'agentMessage', 'plan'].includes(item.type)) groups.push({ type: 'message', id: item.id, item });
    else {
      const last = groups.at(-1);
      if (last?.type === 'activity') last.items.push(item);
      else groups.push({ type: 'activity', id: item.id, items: [item] });
    }
  }
  return groups;
}

export function activitySummary(items = []) {
  const meaningful = items.some(i => i.type !== 'reasoning') ? items.filter(i => i.type !== 'reasoning') : items;
  const labels = [...new Set(meaningful.map(item => activityLabel(item)))];
  if (labels.length < 2) return labels[0] || 'Überlegungen';
  return labels.slice(0, -1).join(', ') + ' und ' + labels.at(-1).replace(/^(Im|Mit) /, text => text.toLowerCase());
}

export function liveActivityLabel(items = [], waiting = false) {
  if (waiting) return 'Wartet auf deine Antwort';
  const active = items.filter(i => i.status === 'inProgress' && !['userMessage', 'agentMessage'].includes(i.type));
  if (active.length) return activityLabel(active.at(-1), true) + (active.length > 1 ? ` · ${active.length} Schritte aktiv` : '');
  if (items.at(-1)?.type === 'agentMessage') return 'Schreibt eine Antwort';
  return 'Denkt nach';
}

export function relativeTimeLabel(value, now = Date.now()) {
  const ms = timestamp(value);
  if (ms == null) return '';
  const minutes = Math.floor(Math.max(0, now - ms) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}
