import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Store } from '../backend/store.mjs';

test('WhatsApp history and CRM data are joined by phone number', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'order-context-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new Store(root);
  await store.init();

  const first = await store.recordWhatsAppMessage({
    platformMessageId: 'wa-1',
    conversationId: '4912345@s.whatsapp.net',
    whatsappJid: '4912345@s.whatsapp.net',
    phone: '+49 12345',
    displayName: 'Ada',
    direction: 'inbound',
    text: 'Guten Morgen',
    timestamp: '2026-09-03T08:00:00.000Z',
  });
  const duplicate = await store.recordWhatsAppMessage({
    platformMessageId: 'wa-1',
    conversationId: '4912345@s.whatsapp.net',
    whatsappJid: '4912345@s.whatsapp.net',
    phone: '4912345',
    direction: 'inbound',
    text: 'Guten Morgen',
    timestamp: '2026-09-03T08:00:00.000Z',
  });
  const enriched = await store.mergeCrmContact({
    phone: '4912345',
    provider: 'example-crm',
    externalId: 'contact-7',
    profile: { customerStatus: 'active' },
  });

  assert.equal(duplicate.created, false);
  assert.equal(enriched.id, first.person.id);
  const context = await store.getPersonContext(first.person.id);
  assert.equal(context.person.displayName, 'Ada');
  assert.equal(context.person.crm.profile.customerStatus, 'active');
  assert.equal(context.messages.length, 1);
  assert.equal(context.messages[0].text, 'Guten Morgen');
});
