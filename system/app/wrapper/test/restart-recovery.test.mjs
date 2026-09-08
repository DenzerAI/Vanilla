import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestartRecovery} from '../ui/restart-recovery.mjs';

test('requested restart waits through shutdown and refreshes once when the new server responds', () => {
  let reloads = 0;
  const recovery = createRestartRecovery({reload: () => reloads++});
  recovery.start('old');
  for (const status of [{instanceId:'old', restartRequired:false}, null, {}, {instanceId:''}]) {
    assert.equal(recovery.check(status), 'waiting');
    assert.equal(reloads, 0);
  }
  assert.equal(recovery.check({instanceId:'new'}), 'reloading');
  assert.equal(recovery.pending, false);
  recovery.check({instanceId:'new'});
  recovery.check({instanceId:'another'});
  assert.equal(reloads, 1);
});

test('an external restart or an unconfirmed restart does not refresh local drafts', () => {
  const recovery = createRestartRecovery({reload: () => assert.fail('unexpected reload')});
  assert.equal(recovery.check({instanceId:'new'}), 'idle');
  assert.throws(() => recovery.start(null), /unvollständig/);
  assert.equal(recovery.pending, false);
});

test('a stalled restart times out without refresh and a later retry can complete', () => {
  let time = 0, reloads = 0;
  const recovery = createRestartRecovery({reload: () => reloads++, now: () => time});
  recovery.start('old');
  time = 59999;
  assert.equal(recovery.check(null), 'waiting');
  time = 60000;
  assert.equal(recovery.check(null), 'timeout');
  assert.equal(recovery.pending, false);
  assert.equal(reloads, 0);
  recovery.start('old');
  time += 1000;
  assert.equal(recovery.check({instanceId:'new'}), 'reloading');
  assert.equal(reloads, 1);
});
