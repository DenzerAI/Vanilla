const GRAPHQL_ENDPOINT = 'https://login.hero-software.de/api/external/v7/graphql';
const LEAD_ENDPOINT = 'https://login.hero-software.de/api/v1/Projects/create';

export function heroKeyCandidates(raw) {
  const candidates = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const match = line.match(/^\s*(HERO_API_KEY(?:_CANDIDATE_[1-9][0-9]*)?)\s*=(.+)$/);
    if (match) candidates.push({ slot: match[1], value: match[2] });
  }
  return candidates;
}

async function safeRequest(fetchImpl, url, key, body) {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    let payload = {};
    try { payload = JSON.parse(await response.text()); } catch {}
    const authRejected = [401, 403].includes(response.status)
      || payload.error === 'invalid_token'
      || /invalid or missing auth token/i.test(payload.message || '');
    return {
      reachable: true,
      authenticated: !authRejected,
      httpStatus: response.status,
      errorCode: authRejected ? (payload.error || 'auth_rejected') : null,
    };
  } catch (error) {
    return {
      reachable: false,
      authenticated: false,
      httpStatus: null,
      errorCode: error.name === 'TimeoutError' ? 'timeout' : 'network_error',
    };
  }
}

export async function diagnoseHeroKeys(candidates, { fetchImpl = fetch } = {}) {
  const results = [];
  for (const candidate of candidates) {
    const [graphql, lead] = await Promise.all([
      safeRequest(fetchImpl, GRAPHQL_ENDPOINT, candidate.value, {
        query: 'query HeroAuthenticationCheck { __typename }',
      }),
      // Ein leerer Lead ist laut HERO-Schema nicht anlegbar; die Antwort prüft nur,
      // ob die Anfrage die Authentifizierung passiert.
      safeRequest(fetchImpl, LEAD_ENDPOINT, candidate.value, {}),
    ]);
    results.push({ slot: candidate.slot, graphql, lead });
  }
  return results;
}
