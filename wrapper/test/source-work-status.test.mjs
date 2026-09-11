import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSourceWork, shortCommit} from '../ui/source-work-status.mjs';

const status = {enabled: true, entries: [
  {id: 'a1', name: 'chat-scroll', status: 'integrated', commit: '1111111aaaa', candidateCommit: '2222222bbbb', reason: 'Zusammengeführt und automatisch geprüft; Live-Aktivierung separat erforderlich.', updatedAt: 100},
  {id: 'b2', name: 'firma-menu', status: 'blocked', reason: 'Nach der Bereitmeldung wurde weitergearbeitet. Erneut bereitmelden.', updatedAt: 300},
  {id: 'c3', name: 'delivery-checks', status: 'checking', updatedAt: 200},
  {id: 'd4', name: 'skeleton', status: 'working', updatedAt: 50},
], release: {error: null, releases: [
  {target: '3333333cccc', phase: 'superseded'},
  {target: '2222222bbbb', phase: 'live', activationPhase: 'live', publishedAt: 90},
  {target: '5555555eeee', phase: 'checks-failed', publishedAt: 350},
  {target: '4444444dddd', phase: 'activating', activationPhase: 'waiting-for-sessions', publishedAt: 400},
]}};

test('source work status becomes readable rows without hiding blockers', () => {
  const view = describeSourceWork(status);
  assert.equal(view.live.short, '2222222');
  assert.deepEqual(view.entries.map(entry => entry.name), ['firma-menu', 'delivery-checks', 'chat-scroll', 'skeleton']);
  assert.equal(view.entries[0].label, 'Blockiert');
  assert.equal(view.entries[0].tone, 'error');
  assert.match(view.entries[0].detail, /weitergearbeitet/);
  assert.equal(view.entries[2].label, 'Integriert');
  assert.match(view.entries[2].detail, /Noch nicht live/);
  assert.equal(view.entries[2].commit, '2222222');
  assert.deepEqual(view.releases.map(release => release.phase), ['activating', 'checks-failed']);
  assert.equal(view.releases[0].detail, 'Wartet auf ruhende Chats');
  assert.equal(view.releases[1].tone, 'error');
  assert.equal(view.error, '');
  for (const part of ['Live 2222222', '1 in Arbeit', '1 in Prüfung', '1 integriert', '1 blockiert', '2 auf dem Weg zur Aktivierung']) assert.match(view.summary, new RegExp(part));
});

test('disabled queues render nothing and unknown states stay visible', () => {
  assert.equal(describeSourceWork(null), null);
  assert.equal(describeSourceWork({enabled: false, entries: []}), null);
  const view = describeSourceWork({enabled: true, entries: [{id: 'x', name: 'n', status: 'mystery', updatedAt: 1}],
    release: {error: 'Gepushter Stand konnte nicht bestätigt werden.', releases: [{target: '6666666ffff', phase: 'odd-phase'}]}});
  assert.equal(view.live, null);
  assert.equal(view.entries[0].label, 'mystery');
  assert.equal(view.releases[0].label, 'odd-phase');
  assert.match(view.error, /bestätigt/);
  assert.match(view.summary, /Kein Stand über diesen Weg aktiviert/);
  assert.equal(shortCommit(undefined), '');
});
