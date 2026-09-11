// Translates the shared source completion status into readable rows for Einstellungen → System.
// Contract: surfaces/settings.md, section Bauaufträge. Data: GET /api/system/status → sourceWork.
const ENTRY = {
  working: ['In Arbeit', 'Der Chat schreibt noch in seiner Arbeitskopie.', 'pending'],
  queued: ['Wartet auf Prüfung', 'Bereitgemeldet; die Warteschlange prüft als Nächstes.', 'pending'],
  checking: ['Wird geprüft', 'Commit, Zusammenführung und Tests laufen.', 'pending'],
  integrated: ['Integriert', 'Geprüft und im gemeinsamen Entwicklungsstand. Noch nicht live.', 'ok'],
  blocked: ['Blockiert', 'Grund im Protokoll der Quellübergabe.', 'error'],
};
const RELEASE = {
  published: ['Veröffentlicht', 'Auf GitHub; die Prüfungen starten.', 'pending'],
  'waiting-for-checks': ['GitHub prüft', 'Wartet auf die Prüfungen für genau diesen Stand.', 'pending'],
  'checks-failed': ['Prüfung fehlgeschlagen', 'Dieser Stand wird nicht aktiviert; ein neuerer geprüfter Stand ersetzt ihn.', 'error'],
  checked: ['Geprüft', 'Alle Prüfungen bestanden; die Aktivierung folgt.', 'pending'],
  activating: ['Wird aktiviert', 'Der Operator arbeitet.', 'pending'],
  live: ['Live', 'Läuft in dieser Installation.', 'ok'],
  superseded: ['Ersetzt', 'Ein neuerer geprüfter Stand hat diesen übernommen.', 'muted'],
  'activation-blocked': ['Aktivierung blockiert', 'Rückkehrjournal prüfen.', 'error'],
};
const ACTIVATION = {
  preparing: 'Vorbereitung', prepared: 'Vorbereitet', 'waiting-for-sessions': 'Wartet auf ruhende Chats',
  'backing-up': 'Sicherung läuft', 'backup-complete': 'Sicherung abgeschlossen', installing: 'Installation',
  'verifying-paused': 'Prüfung der neuen Version', verifying: 'Prüfung der neuen Version', committing: 'Übernahme', live: 'Live',
};

export const shortCommit = value => typeof value === 'string' ? value.slice(0, 7) : '';

function count(items, predicate) { return items.filter(predicate).length; }

export function describeSourceWork(status) {
  if (!status || !status.enabled) return null;
  const entries = [...(status.entries || [])]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(entry => {
      const [label, detail, tone] = ENTRY[entry.status] || [entry.status || 'Unbekannt', '', 'muted'];
      const reason = entry.status === 'blocked' && entry.reason ? entry.reason : detail;
      return {id: entry.id, name: entry.name, status: entry.status, label, detail: reason, tone,
        updatedAt: entry.updatedAt || 0, commit: shortCommit(entry.candidateCommit || entry.commit)};
    });
  const releases = (status.release?.releases || []).map(release => {
    const [label, detail, tone] = RELEASE[release.phase] || [release.phase || 'Unbekannt', '', 'muted'];
    let text = detail;
    if (release.phase === 'activating') text = ACTIVATION[release.activationPhase] || detail;
    if (release.phase === 'activation-blocked' && release.reason) text = release.reason;
    if (['published', 'waiting-for-checks', 'checks-failed'].includes(release.phase) && release.reason) text = release.reason;
    return {target: release.target, short: shortCommit(release.target), phase: release.phase, label, detail: text, tone,
      publishedAt: release.publishedAt || 0};
  });
  const live = releases.find(release => release.phase === 'live') || null;
  const open = releases.filter(release => !['live', 'superseded'].includes(release.phase)).reverse();
  const parts = [live ? 'Live ' + live.short : 'Kein Stand über diesen Weg aktiviert'];
  const working = count(entries, entry => entry.status === 'working');
  const pending = count(entries, entry => entry.status === 'queued' || entry.status === 'checking');
  const integrated = count(entries, entry => entry.status === 'integrated');
  const blocked = count(entries, entry => entry.status === 'blocked');
  if (working) parts.push(working + ' in Arbeit');
  if (pending) parts.push(pending + ' in Prüfung');
  if (integrated) parts.push(integrated + ' integriert');
  if (blocked) parts.push(blocked + ' blockiert');
  if (open.length) parts.push(open.length + ' auf dem Weg zur Aktivierung');
  return {live, releases: open, entries, summary: parts.join(' · '), error: status.release?.error || ''};
}
