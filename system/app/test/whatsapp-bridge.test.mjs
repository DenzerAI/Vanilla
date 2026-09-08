import assert from 'node:assert/strict';
import test from 'node:test';
import { WhatsAppBridge, messageText, splitMessage } from '../backend/whatsapp-bridge.mjs';

test('messageText reads common and wrapped message types', () => {
  assert.equal(messageText({ conversation: 'Hallo' }), 'Hallo');
  assert.equal(messageText({ extendedTextMessage: { text: 'Text' } }), 'Text');
  assert.equal(messageText({ ephemeralMessage: { message: { imageMessage: { caption: 'Bild' } } } }), 'Bild');
});

test('splitMessage keeps every chunk within the limit', () => {
  const chunks = splitMessage('eins zwei drei vier fünf sechs', 10);
  assert.deepEqual(chunks, ['eins zwei', 'drei vier', 'fünf sechs']);
  assert.ok(chunks.every((chunk) => chunk.length <= 10));
});

test('incoming prefixed messages create one order and receive an acknowledgement', async () => {
  const orders = [];
  const sent = [];
  const store = {
    async hasSourceMessage() { return false; },
    async createOrder(input) {
      orders.push(input);
      return { id: 'order-1' };
    },
  };
  const bridge = new WhatsAppBridge({ root: '/tmp/bridge-test', store, env: {} });
  bridge.socket = { async sendMessage(...args) { sent.push(args); } };
  const incoming = {
    key: { id: 'message-1', remoteJid: '4912345@s.whatsapp.net', fromMe: false },
    message: { conversation: '!Prüfe die Bestellung' },
  };

  await bridge.handleMessages({ type: 'notify', messages: [incoming, incoming] });

  assert.equal(orders.length, 1);
  assert.equal(orders[0].instructions, 'Prüfe die Bestellung');
  assert.equal(orders[0].source.sender, '4912345');
  assert.equal(sent.length, 1);
});

test('groups and messages without prefix are ignored by default', async () => {
  let created = 0;
  const bridge = new WhatsAppBridge({
    root: '/tmp/bridge-test',
    store: { async createOrder() { created += 1; } },
    env: {},
  });
  await bridge.handleMessages({
    type: 'notify',
    messages: [
      { key: { id: '1', remoteJid: '1@s.whatsapp.net' }, message: { conversation: 'ohne Prefix' } },
      { key: { id: '2', remoteJid: 'group@g.us' }, message: { conversation: '!Gruppenauftrag' } },
    ],
  });
  assert.equal(created, 0);
});
