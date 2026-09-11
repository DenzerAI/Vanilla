import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSourceWork, shortCommit} from '../ui/source-work-status.mjs';

const status = {enabled: true, entries: [
  {id: 'a1', name: 'chat-scroll', status: 'integrated', commit: '1111111aaaa', candidateCommit: '2222222bbbb', reason: 'Zusammengeführt und automatisch geprüft; Live-Aktivierung separat erforderlich.', updatedAt: 100},
  {id: 'b2', name: 'firma-menu', status: 'blocked', reason: 'Nach der Bereitmeldung wurde weitergearbeitet. Erneut bereitmelden.', updatedAt: 300},
  {id: 'c3', name: 'delivery-checks', status: 'checking', updatedAt: 200},
  {id: 'd4', name: 'skeleton', status: 'working', updatedAt: 50},
  {id: 'e5', name: 'later-work', status: 'integrated', candidateCommit: '7777777gggg', updatedAt: 500},
], release: {error: null, releases: [
  {target: '3333333cccc', phase: 'superseded'},
  {target: '0000000zzzz', phase: 'live', activationPhase: 'live', publishedAt: 40},
  {target: '5555555eeee', phase: 'checks-failed', publishedAt: 60},
  {target: '2222222bbbb', phase: 'live', activationPhase: 'live', publishedAt: 120},
  {target: '4444444dddd', phase: 'activating', activationPhase: 'waiting-for-sessions', publishedAt: 400},
  {target: '8888888hhhh', phase: 'checks-failed', publishedAt: 450},
]}};

test('the newest live stand wins and earlier integrations count as contained', () => {
  const view = describeSourceWork(status);
  assert.equal(view.live.short, '2222222');
  assert.deepEqual(view.entries.map(entry => entry.name), ['later-work', 'firma-menu', 'delivery-checks', 'chat-scroll', 'skeleton']);
  assert.equal(view.entries[0].label, 'Integriert');
  assert.equal(view.entries[0].live, false);
  assert.equal(view.entries[1].label, 'Blockiert');
  assert.equal(view.entries[1].tone, 'error');
  assert.match(view.entries[1].detail, /weitergearbeitet/);
  assert.equal(view.entries[3].label, 'Live');
  assert.equal(view.entries[3].live, true);
  assert.match(view.entries[3].detail, /Enthalten/);
  assert.equal(view.entries[3].commit, '2222222');
  assert.deepEqual(view.releases.map(release => release.short), ['8888888', '4444444']);
  assert.equal(view.releases[1].detail, 'Wartet auf ruhende Chats');
  assert.equal(view.releases[0].tone, 'error');
  assert.equal(view.error, '');
  for (const part of ['Live 2222222', '1 in Arbeit', '1 in Prüfung', '1 integriert, noch nicht live', '1 auf dem Weg zur Aktivierung', '1 blockiert', '1 Aktivierung gescheitert', '1 im Live-Stand']) {
    assert.match(view.summary, new RegExp(part));
  }
});

test('disabled queues render nothing and unknown states stay visible', () => {
  assert.equal(describeSourceWork(null), null);
  assert.equal(describeSourceWork({enabled: false, entries: []}), null);
  const view = describeSourceWork({enabled: true, entries: [{id: 'x', name: 'n', status: 'mystery', updatedAt: 1}, {id: 'y', name: 'done', status: 'integrated', updatedAt: 2}],
    release: {error: 'Gepushter Stand konnte nicht bestätigt werden.', releases: [{target: '6666666ffff', phase: 'odd-phase'}]}});
  assert.equal(view.live, null);
  assert.equal(view.entries[0].label, 'Integriert');
  assert.equal(view.entries[0].live, false);
  assert.equal(view.entries[1].label, 'mystery');
  assert.equal(view.releases[0].label, 'odd-phase');
  assert.match(view.error, /bestätigt/);
  assert.match(view.summary, /Kein Stand über diesen Weg aktiviert/);
  assert.equal(shortCommit(undefined), '');
});
