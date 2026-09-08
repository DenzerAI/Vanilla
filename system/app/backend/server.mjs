import http from 'node:http';
import { requireBearer, requestBudget } from './security.mjs';
process.umask(0o077);
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArtifactStore, detectTailscaleBaseUrl, formatResultWithArtifacts } from './artifacts.mjs';
import { buildBootstrap } from './bootstrap.mjs';
import { companyRoot, readCompanyFile, ensureCompanyBase } from './company-base.mjs';
import { HeroApiError, HeroClient } from './hero-client.mjs';
import { Store } from './store.mjs';
import { WhatsAppBridge } from './whatsapp-bridge.mjs';
import {installationRoot,sourceRoot} from '../wrapper/layout.mjs';

const root = installationRoot;
await loadEnv(path.join(root, '.env'));
await ensureCompanyBase(root);

const port = Number(process.env.PORT || 8787);
const token = process.env.ORDER_SYSTEM_TOKEN || '';
const store = new Store(root);
const artifactBaseUrl = await detectTailscaleBaseUrl({ port });
const detectedArtifactUrl = artifactBaseUrl ? new URL(artifactBaseUrl) : null;
const host = process.env.HOST
  || (detectedArtifactUrl?.protocol === 'http:' ? detectedArtifactUrl.hostname : null)
  || '127.0.0.1';
const artifacts = new ArtifactStore(root, { baseUrl: artifactBaseUrl });
await Promise.all([store.init(), artifacts.init()]);
const whatsapp = new WhatsAppBridge({ root, store });
await whatsapp.init();
const hero = new HeroClient({
  apiKey: process.env.HERO_API_KEY,
  graphqlEndpoint: process.env.HERO_GRAPHQL_ENDPOINT,
  leadEndpoint: process.env.HERO_LEAD_ENDPOINT,
});

async function syncHeroContacts({ category = 'customer', offset = 0, all = false } = {}) {
  let nextOffset = Number(offset) || 0;
  let fetched = 0;
  let imported = 0;
  let skippedWithoutPhone = 0;
  let pages = 0;
  const seen = new Set();

  do {
    const contacts = await hero.listContacts({ category, offset: nextOffset });
    pages += 1;
    fetched += contacts.length;
    let newContacts = 0;

    for (const contact of contacts) {
      const externalId = String(contact.id);
      if (seen.has(externalId)) continue;
      seen.add(externalId);
      newContacts += 1;
      const phone = contact.phone_mobile || contact.phone_home;
      if (!phone) {
        skippedWithoutPhone += 1;
        continue;
      }
      const displayName = contact.company_name
        || [contact.first_name, contact.last_name].filter(Boolean).join(' ')
        || null;
      await store.mergeCrmContact({
        phone,
        displayName,
        provider: 'hero',
        externalId,
        profile: contact,
      });
      imported += 1;
    }

    nextOffset += contacts.length;
    if (!all || contacts.length === 0 || newContacts === 0) break;
  } while (pages < 100);

  return { fetched, imported, skippedWithoutPhone, nextOffset, pages, truncated: all && pages === 100 };
}

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 36_000_000) throw new Error('Request body zu groß.');
  }
  return raw ? JSON.parse(raw) : {};
}


async function loadEnv(file) {
  try {
    const raw = await readFile(file, 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function serveFrontend(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'app.js', 'styles.css'].includes(relative)) return false;
  const content = await readFile(path.join(sourceRoot, 'frontend', relative));
  response.writeHead(200, { 'content-type': mime[path.extname(relative)] || 'application/octet-stream' });
  response.end(content);
  return true;
}

const withinBudget = requestBudget();
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const parts = url.pathname.split('/').filter(Boolean);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    if (parts[0] === 'api' || parts[0] === 'artifacts') {
      if (!withinBudget()) return json(response, 429, { error: 'Zu viele Anfragen.' });
      if (!requireBearer(request, response, token)) return;
    }

    if (request.method === 'GET' && parts[0] === 'artifacts' && parts.length === 3) {
      const filename = decodeURIComponent(parts[2]);
      const target = await artifacts.resolveSafe(parts[1], filename);
      if (!target) return json(response, 404, { error: 'Artefakt nicht gefunden.' });
      try {
        const content = await readFile(target);
        response.writeHead(200, {
          'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'content-type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        });
        response.end(content);
      } catch (error) {
        if (error.code === 'ENOENT') return json(response, 404, { error: 'Artefakt nicht gefunden.' });
        throw error;
      }
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      if (await serveFrontend(response, url.pathname)) return;
      return json(response, 404, { error: 'Nicht gefunden.' });
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(response, 200, { ok: true, time: new Date().toISOString(), artifactBaseUrl });
    }
    if (request.method === 'GET' && url.pathname === '/api/orders') {
      return json(response, 200, { orders: await store.listOrders() });
    }
    if (request.method === 'GET' && url.pathname === '/api/whatsapp/status') {
      return json(response, 200, whatsapp.status());
    }
    if (request.method === 'GET' && url.pathname === '/api/hero/status') {
      return json(response, 200, hero.status());
    }
    if (request.method === 'GET' && url.pathname === '/api/people') {
      return json(response, 200, { people: await store.listPeople() });
    }
    if (request.method === 'GET' && parts[1] === 'people' && parts[2] && parts[3] === 'context') {
      const context = await store.getPersonContext(parts[2], url.searchParams.get('limit'));
      return context ? json(response, 200, context) : json(response, 404, { error: 'Person nicht gefunden.' });
    }
    if (request.method === 'POST' && url.pathname === '/api/crm/contacts/upsert') {
      const input = await body(request);
      if (!input.phone || !input.provider || !input.externalId) {
        return json(response, 400, { error: 'phone, provider und externalId sind erforderlich.' });
      }
      return json(response, 200, { person: await store.mergeCrmContact(input) });
    }
    if (request.method === 'POST' && url.pathname === '/api/whatsapp/connect') {
      await whatsapp.connect();
      return json(response, 202, whatsapp.status());
    }
    if (request.method === 'POST' && url.pathname === '/api/hero/test') {
      return json(response, 200, { ...hero.status(), check: await hero.testConnection() });
    }
    if (request.method === 'POST' && url.pathname === '/api/hero/sync/contacts') {
      const input = await body(request);
      return json(response, 200, await syncHeroContacts(input));
    }
    if (request.method === 'POST' && url.pathname === '/api/hero/projects') {
      return json(response, 201, { project: await hero.createProject(await body(request)) });
    }
    if (request.method === 'POST' && url.pathname === '/api/orders') {
      const input = await body(request);
      if (typeof input.title !== 'string' || typeof input.instructions !== 'string' || !input.title.trim() || !input.instructions.trim()) {
        return json(response, 400, { error: 'title und instructions sind erforderlich.' });
      }
      if (input.engine !== undefined && typeof input.engine !== 'string') {
        return json(response, 400, { error: 'engine muss Text sein.' });
      }
      return json(response, 201, { order: await store.createOrder({ ...input, source: null }) });
    }
    if (request.method === 'GET' && parts[1] === 'orders' && parts[2]) {
      const order = await store.getOrder(parts[2]);
      return order ? json(response, 200, { order }) : json(response, 404, { error: 'Auftrag nicht gefunden.' });
    }
    if (request.method === 'GET' && url.pathname === '/api/company-base') {
      try {
        return json(response, 200, await readCompanyFile(companyRoot(root), url.searchParams.get('file')));
      } catch {
        return json(response, 404, { error: 'Firmenbasis-Datei nicht verfügbar.' });
      }
    }
    if (request.method === 'GET' && parts[1] === 'bootstrap' && parts[2]) {
      return json(response, 200, { bootstrap: await buildBootstrap(root, parts[2].toLowerCase(), { store }) });
    }
    if (request.method === 'POST' && parts[1] === 'engines' && parts[2] && parts[3] === 'pull') {
      const engine = parts[2].toLowerCase();
      const claimed = await store.claimNext(engine);
      if (!claimed) return json(response, 200, { order: null });
      return json(response, 200, { ...claimed, bootstrap: await buildBootstrap(root, engine, { store, order: claimed.order }) });
    }
    if (request.method === 'POST' && parts[1] === 'runs' && parts[2] && ['complete', 'fail'].includes(parts[3])) {
      const input = await body(request);
      const failed = parts[3] === 'fail';
      if (!failed && typeof input.result !== 'string') return json(response, 400, { error: 'result ist erforderlich.' });
      const existingRun = await store.getRun(parts[2]);
      if (!existingRun) return json(response, 404, { error: 'Run nicht gefunden.' });
      if (existingRun.status !== 'running') return json(response, 409, { error: 'Run bereits abgeschlossen.' });
      const published = failed ? [] : await artifacts.publish(parts[2], input.artifacts || []);
      const finished = await store.finishRun(parts[2], {
        ...input,
        artifacts: published,
        result: failed ? input.result : formatResultWithArtifacts(input.result, published),
      }, failed);
      if (!finished) return json(response, 404, { error: 'Run nicht gefunden.' });
      whatsapp.deliverRunResult(finished).catch((error) => console.error('WhatsApp-Zustellung fehlgeschlagen.'));
      return json(response, 200, finished);
    }
    return json(response, 404, { error: 'Nicht gefunden.' });
  } catch (error) {
    const status = error instanceof SyntaxError ? 400
      : error instanceof HeroApiError ? (error.status === 401 || error.status === 403 ? 502 : error.status || 502)
      : 500;
    json(response, status, { error: status === 400 ? 'Ungültige Anfrage.' : 'Anfrage fehlgeschlagen.' });
  }
});

server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(port, host, () => {
  console.log(`Order-System läuft auf http://${host}:${server.address().port}`);
  if (artifactBaseUrl) console.log(`Artefakte: ${artifactBaseUrl}/artifacts/...`);
  else console.warn('Tailscale nicht erkannt: Artefakte werden ohne TAILSCALE_BASE_URL abgewiesen.');
});
