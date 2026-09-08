import { randomUUID } from 'node:crypto';
import { crmDefinition, crmDefaultMethod, crmFields } from './crm-catalog.mjs';
import { safeRequest } from './safe-request.mjs';

const clean = value => String(value ?? '').trim();
function address(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('Eine gültige HTTPS-Adresse eingeben.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw Error('HTTPS-Adresse ohne Zugangsdaten, Suchparameter oder Fragment erforderlich.');
  return url.href.replace(/\/$/, '');
}

// Uses the existing connection index and macOS keychain. No credential-read route.
export class CrmConnections {
  constructor({store, secrets, request = safeRequest}) { Object.assign(this, {store, secrets, request}); }

  // Called inside the shared secrets.exclusive transaction by /connections/save.
  async save(input) {
    const previous = input.id ? this.store.state.connections.find(c => c.id === input.id) : null;
    if (input.id && !previous) throw Error('Verbindung nicht gefunden.');
    if (previous && (previous.kind !== 'crm' || previous.provider !== input.provider)) throw Error('Der Anbieter einer bestehenden Verbindung kann nicht gewechselt werden.');
    if (previous && input.revision !== previous.revision) throw Error('Die Verbindung wurde zwischenzeitlich geändert. Bitte erneut öffnen.');
    const provider = crmDefinition(input.provider);
    if (!provider) throw Error('Unbekannter CRM-Anbieter.');
    const method = input.config?.method ?? crmDefaultMethod(provider);
    if (!['api','login'].includes(method) || (method === 'api' && !provider.api.auth)) throw Error('Diese Zugangsmethode ist für den Anbieter nicht verfügbar.');
    const fields = crmFields(provider, method), config = {method};
    for (const field of fields.filter(f => !f.secret)) {
      let value = clean(input.config?.[field.key] ?? field.default);
      if (value.length > 2000) throw Error(`${field.label} ist zu lang.`);
      if (field.required && !value) throw Error(`${field.label} fehlt.`);
      if (field.type === 'url' && value) value = address(value);
      config[field.key] = value;
    }
    if (method === 'api' && provider.api.fixed) config.url = provider.api.url;
    if (method === 'api' && provider.id === 'weclapp') {
      const url = new URL(config.url);
      if (!/^[a-z0-9-]+\.weclapp\.com$/i.test(url.hostname) || url.port || !['/','/webapp','/webapp/'].includes(url.pathname))
        throw Error('Die HTTPS-Adresse deines weclapp-Mandanten verwenden (https://betrieb.weclapp.com).');
      config.url = url.origin;
    }
    const name = clean(input.name || provider.name).slice(0,100);
    const sameMethod = previous?.config.method === method;
    const oldCredentials = sameMethod && previous.secretId ? JSON.parse(await this.secrets.read(previous.secretId)) : {};
    const credentials = {};
    for (const field of fields.filter(f => f.secret)) {
      const incoming = input.credentials?.[field.key];
      if (incoming != null && typeof incoming !== 'string') throw Error(`${field.label} ist ungültig.`);
      // Preserve passwords byte-for-byte, including intentional whitespace.
      const value = incoming === '' || incoming == null ? oldCredentials[field.key] : incoming;
      if (field.required && !value) throw Error(`${field.label} fehlt.`);
      if (value && (value.length > 8000 || /[\r\n\0]/.test(value))) throw Error(`${field.label} ist ungültig oder zu lang.`);
      if (value) credentials[field.key] = value;
    }
    const serialized = JSON.stringify(credentials);
    if (serialized.length > 10000) throw Error('Die Zugangsdaten sind zu lang (max. 10.000 Zeichen).');
    const unchangedCredentials = sameMethod && JSON.stringify(oldCredentials) === serialized;
    const entry = {id:previous?.id || 'connection-'+randomUUID().slice(0,12), kind:'crm', provider:provider.id, name,
      config, secretId:previous?.secretId || null, revision:randomUUID(), updatedAt:new Date().toISOString()};
    if (!unchangedCredentials) {
      entry.secretId = (await this.secrets.save('secret-'+randomUUID().slice(0,12), serialized,
        `${provider.name} · ${method === 'login' ? 'Login' : 'API-Zugang'}`, {format:'crm-credentials'})).id;
    }
    if (previous && unchangedCredentials && JSON.stringify(previous.config) === JSON.stringify(config)) entry.check = previous.check;
    const before = this.store.state.connections;
    this.store.state.connections = before.filter(c => c.id !== entry.id).concat(entry);
    try { await this.store.save(); } catch (error) { this.store.state.connections = before; throw error; }
    return entry;
  }

  async check(id) {
    const connection = this.store.state.connections.find(c => c.id === id && c.kind === 'crm');
    if (!connection) throw Error('Verbindung nicht gefunden.');
    const provider = crmDefinition(connection.provider);
    if (connection.config.method !== 'api' || !provider?.api.check)
      throw Error('Zugangsdaten sind hinterlegt. Für diesen Anschluss ist noch keine automatische Zugangsprüfung verfügbar.');
    const revision = connection.revision;
    let result;
    try {
      const {token} = JSON.parse(await this.secrets.read(connection.secretId));
      if (!token || /[\r\n\0]/.test(token)) throw Error('invalid');
      let url, options = {method:'GET', maxBytes:100000, timeoutMs:10000, headers:{accept:'application/json'}};
      if (provider.id === 'hero') {
        url = provider.api.url;
        options = {...options, method:'POST', headers:{...options.headers, authorization:'Bearer '+token, 'content-type':'application/json'}, body:JSON.stringify({query:'query ConnectionCheck { __typename }'})};
      } else if (provider.id === 'weclapp') {
        url = connection.config.url + '/webapp/api/v2/user/currentUser';
        options.headers.AuthenticationToken = token;
      } else {
        url = provider.api.url + '/api/check_connection';
        options.headers['X-apikey'] = token;
      }
      const response = await this.request(url, options);
      if (!response.ok) throw Error('http:'+response.status);
      if (!(provider.id === 'centralstationcrm' && response.status === 204)) {
        const data = JSON.parse(await response.text());
        if (provider.id === 'hero' && (data.errors?.length || !data.data?.__typename)) throw Error('invalid');
        if (provider.id === 'weclapp' && !data.result?.id) throw Error('invalid');
      }
      result = {ok:true, at:new Date().toISOString(), message:'API-Zugang geprüft. Es ist keine Synchronisierung aktiv.'};
    } catch {
      // Vendor bodies, URLs and error strings can echo credentials: never return them.
      result = {ok:false, at:new Date().toISOString(), message:'API-Zugang konnte nicht geprüft werden. Schlüssel, Leserechte und Erreichbarkeit prüfen.'};
    }
    await this.secrets.exclusive(async () => {
      const current = this.store.state.connections.find(c => c.id === id && c.kind === 'crm');
      if (!current || current.revision !== revision) throw Error('Die Verbindung wurde während der Prüfung geändert. Bitte erneut öffnen und prüfen.');
      const before = current.check;
      current.check = result;
      try { await this.store.save(); } catch (error) { current.check = before; throw error; }
    });
    return result;
  }
}
