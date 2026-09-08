import test from 'node:test';
import assert from 'node:assert/strict';
import {readPreferences,writePreferences} from '../identity-preferences.mjs';
test('personalization preserves identity and replaces only its own section',()=>{
 const base='# Identity\nAnzeigename: Agent\nKeep original role.\n';
 const first=writePreferences(base,'Explain clearly.');
 assert.ok(first.startsWith(base));assert.equal(readPreferences(first),'Explain clearly.');
 const next=writePreferences(first,'Be concise.');assert.equal(readPreferences(next),'Be concise.');assert.ok(!next.includes('Explain clearly.'));assert.ok(next.includes('Keep original role.'));
 assert.throws(()=>writePreferences(base,'<!-- user-preferences:end -->'));
 assert.throws(()=>writePreferences(base,'x'.repeat(12001)));
});
