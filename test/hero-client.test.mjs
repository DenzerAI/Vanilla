import assert from 'node:assert/strict';
import test from 'node:test';
import { HeroApiError, HeroClient } from '../backend/hero-client.mjs';
import { diagnoseHeroKeys, heroKeyCandidates } from '../backend/hero-key-diagnostics.mjs';

function response(status, value) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(value); },
  };
}

test('HERO connection check sends bearer token without mutating data', async () => {
  const requests = [];
  const client = new HeroClient({
    apiKey: 'secret-token',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return response(200, { data: { __typename: 'Query' } });
    },
  });

  const result = await client.testConnection();
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.authorization, 'Bearer secret-token');
  assert.match(JSON.parse(requests[0].options.body).query, /__typename/);
});

test('HERO client fails clearly when the API key is missing', async () => {
  const client = new HeroClient();
  await assert.rejects(() => client.testConnection(), (error) => {
    assert.ok(error instanceof HeroApiError);
    assert.equal(error.status, 503);
    assert.match(error.message, /HERO_API_KEY/);
    return true;
  });
});

test('HERO GraphQL errors become safe client errors', async () => {
  const client = new HeroClient({
    apiKey: 'secret-token',
    fetchImpl: async () => response(200, { errors: [{ message: 'Unknown field', path: ['contacts'] }] }),
  });
  await assert.rejects(() => client.listContacts(), (error) => {
    assert.ok(error instanceof HeroApiError);
    assert.equal(error.message, 'Unknown field');
    return true;
  });
});

test('HERO contacts fall back when a schema has no mobile phone field', async () => {
  let requestCount = 0;
  const client = new HeroClient({
    apiKey: 'secret-token',
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return response(200, { errors: [{ message: 'Cannot query field "phone_mobile".' }] });
      return response(200, { data: { contacts: [{ id: 7, phone_home: '+49123' }] } });
    },
  });
  const contacts = await client.listContacts();
  assert.equal(requestCount, 2);
  assert.equal(contacts[0].id, 7);
});

test('HERO project creation validates required fields locally', async () => {
  const client = new HeroClient({ apiKey: 'secret-token', fetchImpl: async () => response(200, {}) });
  await assert.rejects(() => client.createProject({ customer: {} }), /customer.email/);
});

test('HERO project creation returns the external project id', async () => {
  const client = new HeroClient({
    apiKey: 'secret-token',
    fetchImpl: async () => response(200, { status: 'success', id: 12345 }),
  });
  const result = await client.createProject({
    customer: { email: 'kunde@example.com' },
    address: { zipcode: '10115' },
  });
  assert.equal(result.id, 12345);
});

test('HERO key diagnostics find candidates without returning secret values', async () => {
  const candidates = heroKeyCandidates([
    '    HERO_API_KEY=first-secret',
    'HERO_API_KEY_CANDIDATE_2=second-secret',
    'UNRELATED=value',
  ].join('\n'));
  const results = await diagnoseHeroKeys(candidates, {
    fetchImpl: async (url, options) => {
      assert.match(options.headers.authorization, /^Bearer (first|second)-secret$/);
      return response(url.includes('/graphql') ? 200 : 422, url.includes('/graphql')
        ? { data: { __typename: 'Query' } }
        : { status: 'error', message: 'Pflichtfelder fehlen' });
    },
  });
  assert.deepEqual(results.map((item) => item.slot), ['HERO_API_KEY', 'HERO_API_KEY_CANDIDATE_2']);
  assert.ok(results.every((item) => item.graphql.authenticated && item.lead.authenticated));
  assert.doesNotMatch(JSON.stringify(results), /first-secret|second-secret/);
});
