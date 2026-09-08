import { timingSafeEqual } from 'node:crypto';

// No implicit development bypass. Static assets remain available for setup.
export function requireBearer(request, response, token) {
  const configured = typeof token === 'string' && token.trim().length >= 32;
  const supplied = Buffer.from(String(request.headers.authorization || ''));
  const expected = Buffer.from(`Bearer ${token}`);
  if (configured && supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  response.writeHead(configured ? 401 : 503, {
    'content-type': 'application/json', 'cache-control': 'no-store',
  });
  response.end(JSON.stringify({ error: configured ? 'Nicht autorisiert.' : 'Authentifizierung nicht sicher konfiguriert.' }));
  return false;
}

// One bounded process-wide budget; spoofable Forwarded headers never select a bucket.
export function requestBudget({ limit = 600, windowMs = 60000, now = Date.now } = {}) {
  let start = now(), used = 0;
  return () => {
    const time = now();
    if (time - start >= windowMs) { start = time; used = 0; }
    return ++used <= limit;
  };
}
