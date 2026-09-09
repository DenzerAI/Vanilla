import {test} from 'node:test';
import assert from 'node:assert/strict';
import {microphone, microphoneError} from '../ui/dictation-audio.mjs';

test('capture works after playback and returns session control to the browser', async () => {
  const session = {type: 'playback'}, stream = {active: true};
  const media = {async getUserMedia() {
    if (!['auto', 'play-and-record'].includes(session.type))
      throw new DOMException('AudioSession category is not compatible with audio capture.', 'InvalidStateError');
    await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(session.type, 'play-and-record');
    return stream;
  }};
  assert.equal(await microphone(media, '', session), stream);
  assert.equal(session.type, 'auto');
});

test('device fallback keeps capture enabled until the second request settles', async () => {
  const session = {type: 'playback'}, calls = [], stream = {};
  const media = {async getUserMedia(constraints) {
    assert.equal(session.type, 'play-and-record');
    calls.push(constraints);
    if (calls.length === 1) throw new DOMException('Device unavailable', 'OverconstrainedError');
    await Promise.resolve();
    assert.equal(session.type, 'play-and-record');
    return stream;
  }};
  assert.equal(await microphone(media, 'selected-device', session), stream);
  assert.deepEqual(calls, [{audio: {deviceId: {ideal: 'selected-device'}}}, {audio: true}]);
  assert.equal(session.type, 'auto');
});

test('denied permission is never retried and releases the session override', async () => {
  const session = {type: 'playback'};
  const denied = new DOMException('Permission denied', 'NotAllowedError');
  let calls = 0;
  await assert.rejects(microphone({async getUserMedia() { calls++; throw denied; }}, 'selected-device', session), error => error === denied);
  assert.equal(calls, 1);
  assert.equal(session.type, 'auto');
  assert.match(microphoneError(denied), /Mikrofonzugriff.*erlauben/);
});

test('browsers without a writable AudioSession API still request the microphone', async () => {
  const stream = {};
  for (const session of [null, {set type(value) {throw new Error('Unsupported');}}]) {
    assert.equal(await microphone({async getUserMedia(c) {assert.deepEqual(c, {audio:true}); return stream;}}, '', session), stream);
  }
});

test('remaining WebKit capture errors have an actionable German message', () => {
  assert.match(microphoneError(new DOMException('AudioSession category is not compatible with audio capture.', 'InvalidStateError')), /Seite neu laden/);
});
