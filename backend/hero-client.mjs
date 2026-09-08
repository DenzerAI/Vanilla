const DEFAULT_GRAPHQL_ENDPOINT = 'https://login.hero-software.de/api/external/v7/graphql';
const DEFAULT_LEAD_ENDPOINT = 'https://login.hero-software.de/api/v1/Projects/create';

export class HeroApiError extends Error {
  constructor(message, { status = null, details = null } = {}) {
    super(message);
    this.name = 'HeroApiError';
    this.status = status;
    this.details = details;
  }
}

export class HeroClient {
  constructor({ apiKey, graphqlEndpoint, leadEndpoint, fetchImpl = fetch, timeoutMs = 15_000 } = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.graphqlEndpoint = graphqlEndpoint || DEFAULT_GRAPHQL_ENDPOINT;
    this.leadEndpoint = leadEndpoint || DEFAULT_LEAD_ENDPOINT;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.lastCheck = null;
  }

  configured() {
    return Boolean(this.apiKey);
  }

  status() {
    return {
      configured: this.configured(),
      graphqlEndpoint: this.graphqlEndpoint,
      leadEndpoint: this.leadEndpoint,
      lastCheck: this.lastCheck,
    };
  }

  headers() {
    if (!this.configured()) {
      throw new HeroApiError('HERO_API_KEY ist nicht konfiguriert.', { status: 503 });
    }
    return {
      accept: 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
    };
  }

  async request(url, body) {
    const headers = this.headers();
    let response;
    try {
      response = await this.fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new HeroApiError('Zeitüberschreitung bei der HERO API.');
      }
      throw new HeroApiError(`HERO API nicht erreichbar: ${error.message}`);
    }

    const raw = await response.text();
    let result = null;
    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      throw new HeroApiError(`HERO API antwortete mit ungültigem JSON (HTTP ${response.status}).`, {
        status: response.status,
      });
    }

    if (!response.ok) {
      const message = result.message || result.error || `HERO API Fehler (HTTP ${response.status}).`;
      throw new HeroApiError(message, { status: response.status, details: result.validationErrors || null });
    }
    return result;
  }

  async graphql(query, variables = {}) {
    const result = await this.request(this.graphqlEndpoint, { query, variables });
    if (Array.isArray(result.errors) && result.errors.length) {
      throw new HeroApiError(result.errors.map((error) => error.message).join('; '), {
        details: result.errors.map(({ message, path }) => ({ message, path })),
      });
    }
    if (!result.data) throw new HeroApiError('HERO GraphQL lieferte keine Daten.');
    return result.data;
  }

  async testConnection() {
    try {
      await this.graphql('query HeroConnectionCheck { __typename }');
      this.lastCheck = { ok: true, checkedAt: new Date().toISOString(), error: null };
      return this.lastCheck;
    } catch (error) {
      this.lastCheck = { ok: false, checkedAt: new Date().toISOString(), error: error.message };
      throw error;
    }
  }

  async listContacts({ category = 'customer', offset = 0 } = {}) {
    const query = (includeMobile) => `
      query HeroContacts($category: CustomerCategoryEnum, $offset: Int) {
        contacts(category: $category, orderBy: "id", offset: $offset) {
          id
          nr
          first_name
          last_name
          company_name
          email
          phone_home
          ${includeMobile ? 'phone_mobile' : ''}
          modified
          address {
            street
            city
            zipcode
          }
        }
      }
    `;
    const variables = { category, offset: Number(offset) || 0 };
    let data;
    try {
      data = await this.graphql(query(true), variables);
    } catch (error) {
      if (!(error instanceof HeroApiError) || !error.message.includes('phone_mobile')) throw error;
      data = await this.graphql(query(false), variables);
    }
    return Array.isArray(data.contacts) ? data.contacts : [];
  }

  async createProject(payload) {
    if (!payload?.customer?.email || !payload?.address?.zipcode) {
      throw new HeroApiError('Für ein HERO-Projekt sind customer.email und address.zipcode erforderlich.');
    }
    const result = await this.request(this.leadEndpoint, payload);
    if (result.status !== 'success') {
      throw new HeroApiError(result.message || 'HERO konnte das Projekt nicht anlegen.', {
        details: result.validationErrors || null,
      });
    }
    return result;
  }
}

export const HERO_ENDPOINTS = {
  graphql: DEFAULT_GRAPHQL_ENDPOINT,
  lead: DEFAULT_LEAD_ENDPOINT,
};
