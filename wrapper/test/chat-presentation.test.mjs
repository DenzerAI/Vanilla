import test from 'node:test';
import assert from 'node:assert/strict';
import { timestamp, dayLabel, durationLabel, groupItems, activityLabel } from '../ui/chat-presentation.mjs';
test('chat timestamps accept protocol seconds and never invent missing dates', () => {
  assert.equal(timestamp(1788700000), 1788700000000);
  assert.equal(timestamp(null), null);
  assert.equal(timestamp('invalid'), null);
  const now = new Date(2026, 8, 6, 12).getTime();
  assert.equal(dayLabel(new Date(2026, 8, 6, 1).toISOString(), now), 'Heute');
  assert.equal(dayLabel(new Date(2026, 8, 5, 23).toISOString(), now), 'Gestern');
  assert.equal(dayLabel(null, now), null);
  assert.equal(durationLabel(65000), '1 min 5 s');
  assert.equal(durationLabel(3661000), '1 h 1 min');
});
test('activity groups preserve commentary and the chronology of messages', () => {
  const items = ['userMessage', 'commandExecution', 'fileChange', 'agentMessage', 'webSearch', 'agentMessage'].map((type, n) => ({type, id: String(n)}));
  const groups = groupItems(items);
  assert.equal(groups.length, 5);
  assert.deepEqual(groups.flatMap(g => g.items || [g.item]), items);
  assert.equal(activityLabel({type: 'webSearch'}, true), 'Sucht im Web');
  assert.equal(activityLabel({type: 'commandExecution', toolName: 'apply_patch'}, true), 'Bearbeitet Dateien');
});

test('activity summaries stay factual and expose incomplete steps', async () => {
  const { activitySummary, liveActivityLabel } = await import('../ui/chat-presentation.mjs');
  assert.equal(activitySummary([{type:'webSearch'}, {type:'webSearch'}, {type:'fileChange'}]), 'Im Web gesucht und Dateien bearbeitet');
  assert.equal(activitySummary([{type:'commandExecution',status:'inProgress'}]), 'Befehl ohne Abschluss');
  assert.equal(liveActivityLabel([], true), 'Wartet auf deine Antwort');
  assert.equal(liveActivityLabel([]), 'Denkt nach');
  assert.equal(liveActivityLabel([{type:'agentMessage'}]), 'Schreibt eine Antwort');
  assert.equal(liveActivityLabel([{type:'webSearch',status:'inProgress'}, {type:'fileChange',status:'inProgress'}]), 'Bearbeitet Dateien · 2 Schritte aktiv');
});


test('activity wording distinguishes browser, generic wrappers, failure and reasoning', async () => {
  const {activityKind, activitySummary, workingDurationLabel} = await import('../ui/chat-presentation.mjs');
  assert.equal(activityKind({type:'commandExecution',toolName:'mcp__cua_repl__js'}), 'browser');
  assert.equal(activityKind({type:'commandExecution',toolName:'functions.exec'}), 'tool');
  assert.equal(activityLabel({type:'fileChange',status:'failed'}), 'Dateiänderung fehlgeschlagen');
  assert.equal(activityLabel({type:'commandExecution',status:'failed'}), 'Befehl fehlgeschlagen');
  assert.equal(activitySummary([{type:'reasoning'}, {type:'commandExecution'}, {type:'commandExecution'}, {type:'fileChange'}]), 'Befehle ausgeführt und Dateien bearbeitet');
  assert.equal(activitySummary([{type:'fileChange',status:'failed'}]), 'Dateiänderung fehlgeschlagen');
  assert.equal(workingDurationLabel(237000), '3 Min. 57 Sek.');
});

test('short adapter names retain public command and browser activities without inspecting output', async () => {
  const {activityKind} = await import('../ui/chat-presentation.mjs');
  assert.equal(activityKind({type:'commandExecution',toolName:'exec',command:'text(await tools.exec_command({cmd:"pwd"}));'}), 'command');
  assert.equal(activityKind({type:'mcpToolCall',server:'cua_repl',tool:'js'}), 'browser');
  assert.equal(activityKind({type:'commandExecution',toolName:'js',command:JSON.stringify({code:'await cua.getState();'})}), 'browser');
  assert.equal(activityKind({type:'commandExecution',toolName:'exec',aggregatedOutput:'tools.exec_command({cmd:"pwd"})'}), 'tool');
});
