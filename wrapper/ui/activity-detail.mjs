import {activityLabel} from './chat-presentation.mjs';
import {diffLines} from './artifact-content.mjs';

const basename = path => String(path || '').split(/[\\/]/).at(-1).replace(/[\x00-\x1f]/g, '').slice(0, 80);
// Read only literal public arguments. Never evaluate wrappers or inspect output for intent.
function shellCommand(item) {
  let command = item.command;
  if (typeof command !== 'string') return '';
  try { const args = JSON.parse(command); command = args.cmd ?? args.command ?? ''; } catch {}
  if (typeof command !== 'string') return '';
  if (['exec', 'functions.exec'].includes(item.toolName)) {
    const match = command.match(/^\s*(?:\/\/ @exec:[^\n]*\n\s*)?(?:text\(|(?:const|let)\s+\w+\s*=\s*)?await\s+tools\.exec_command\(\s*\{\s*cmd\s*:\s*("(?:\\.|[^"\\])*")/);
    if (!match) return '';
    try { return JSON.parse(match[1]); } catch { return ''; }
  }
  if (item.type !== 'commandExecution' || (item.toolName && !/^(?:exec_command|bash|Bash|terminal|functions\.exec_command)$/.test(item.toolName))) return '';
  return command;
}
export function activityDetailLabel(item, live = false) {
  if (item.status === 'failed' || (item.status === 'inProgress' && !live)) return activityLabel(item, live);
  const changes = Array.isArray(item.changes) ? item.changes.filter(c => c?.path) : [];
  if (changes.length) {
    const name = changes.length === 1 ? basename(changes[0].path) : `${changes.length} Dateien`;
    return `${name} · ${live ? 'wird bearbeitet' : 'bearbeitet'}`;
  }
  const reads = Array.isArray(item.commandActions) ? item.commandActions : [];
  if (reads.length && reads.every(action => action.type === 'read' && (action.path || action.name))) {
    const name = reads.length === 1 ? basename(reads[0].path || reads[0].name) : 'Dateiinhalte';
    return `${name} · ${live ? 'wird gelesen' : 'gelesen'}`;
  }
  const command = shellCommand(item).trim();
  // Compound scripts cannot be truthfully summarized by their first command.
  if (/[\n;]|&&|\|\|/.test(command)) return activityLabel(item, live);
  const script = command.match(/^(?:npm|pnpm|yarn)(?:\s+--(?:prefix|dir|cwd)\s+\S+)?\s+(?:run\s+)?(design:verify|design:check|test|typecheck|build)\b/)?.[1];
  let words;
  if (['design:verify','design:check'].includes(script)) words = ['UI-Prüfungen ausgeführt', 'Prüft die UI-Regeln'];
  else if (script === 'test' || /^(?:node\s+--test\b|(?:python[\d.]*\s+-m\s+)?pytest\b)/.test(command)) words = ['Tests ausgeführt', 'Führt Tests aus'];
  else if (script === 'typecheck' || /^tsc\b/.test(command)) words = ['Typprüfung ausgeführt', 'Prüft Typen'];
  else if (script === 'build') words = ['Build ausgeführt', 'Erstellt den Build'];
  else if (/^(?:rg|grep)\s/.test(command)) words = ['Code durchsucht', 'Durchsucht Code'];
  else if (/^(?:cat|head|tail|sed)\s/.test(command)) words = ['Dateiinhalt gelesen', 'Liest Dateiinhalt'];
  else if (/^git\s+(?:-[^\s]+\s+[^\s]+\s+)*(?:diff|status|log|show)\b/.test(command)) words = ['Änderungsstand geprüft', 'Prüft den Änderungsstand'];
  else if (/^pwd\s*$/.test(command)) words = ['Arbeitsordner geprüft', 'Prüft den Arbeitsordner'];
  else if (/^python[\d.]*\s/.test(command)) words = ['Python-Skript ausgeführt', 'Führt Python aus'];
  return words ? words[live ? 1 : 0] : activityLabel(item, live);
}

export function changeStats(changes = []) {
  let added = 0, removed = 0, known = 0;
  for (const change of changes) {
    if (typeof change?.diff !== 'string' || !change.diff.trim()) continue;
    known++;
    for (const line of diffLines(change.diff, Number.MAX_SAFE_INTEGER).lines) {
      if (line.kind === 'added') added++;
      else if (line.kind === 'removed') removed++;
    }
  }
  return known ? {added, removed, partial:known < changes.length} : null;
}
