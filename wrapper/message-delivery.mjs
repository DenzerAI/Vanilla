import { createHash } from 'node:crypto';

const terminal = new Set(['completed', 'failed', 'interrupted']);
const copy = value => structuredClone(value);
const fail = message => { throw Object.assign(new Error(message), { status: 409 }); };

// One adapter owns dispatch. Every claim is durably written before a worker call.
// Neither a transport error nor a restart is proof that the worker rejected input.
export class MessageDelivery {
  constructor({ read, write, active, canSteer, send, emit = () => {}, onError = () => {} }) {
    Object.assign(this, { read, write, active, canSteer, send, emit, onError });
    this.state = { version: 1, messages: [], gates: {} };
    this.serial = Promise.resolve();
    this.pumps = new Map();
    this.completed = new Map();
  }
  async init() {
    this.state = await this.read() || this.state;
    if (this.state.version !== 1) throw new Error('Unbekannte Nachrichtenablage.');
    await this.change(s => {
      for (const m of s.messages) if (m.status === 'dispatching') {
        m.status = 'unknown'; m.detail = 'Übergabe durch Neustart unterbrochen. Keine automatische Wiederholung.'; m.revision++;
      }
      for (const m of s.messages) if (m.status === 'waiting' && !s.gates[m.chatId]) s.gates[m.chatId] = { blocked: true };
      for (const gate of Object.values(s.gates)) gate.blocked = true;
    });
    return this;
  }
  change(fn) {
    const operation = this.serial.then(async () => {
      const next = copy(this.state), result = fn(next);
      await this.write(next);
      this.state = next;
      try { this.emit(); } catch {}
      return copy(result);
    });
    this.serial = operation.catch(() => {});
    return operation;
  }
  pauseToken(chatId) {
    return createHash('sha256').update(JSON.stringify({gate:this.state.gates[chatId], unknown:this.state.messages.filter(m => m.chatId === chatId && m.status === 'unknown').map(m => [m.id,m.revision,m.reviewedAt])})).digest('hex');
  }
  async resume(chatId, token) {
    await this.change(s => {
      if (token !== this.pauseToken(chatId) || this.active(chatId) || s.messages.some(m => m.chatId === chatId && m.status === 'dispatching')) fail('Der Zustand hat sich geändert. Bitte erneut prüfen.');
      delete s.gates[chatId];
      for (const m of s.messages) if (m.chatId === chatId && m.status === 'unknown') {
        m.reviewedAt = Date.now(); m.revision++;
        m.detail = 'Zustellung bleibt unklar. Aufgabenfolge ausdrücklich ohne Wiederholung fortgesetzt.';
      }
    });
    this.kick(chatId);
  }
  async list(chatId) {
    await this.serial;
    return { messages: copy(this.state.messages.filter(m => m.chatId === chatId)), pauseToken: this.pauseToken(chatId), blocked: !!this.state.gates[chatId]?.blocked || this.state.messages.some(m => m.chatId === chatId && m.status === 'unknown' && !m.reviewedAt) };
  }
  async enqueue(chatId, body) {
    if (!/^[a-zA-Z0-9_-]{8,96}$/.test(body.messageId || '')) throw new Error('Nachrichten-ID fehlt.');
    if (!['send', 'after'].includes(body.intent || 'send')) throw new Error('Ungültige Sendeart.');
    if (typeof body.text !== 'string' || body.text.length > 100000 || (!body.text.trim() && !body.attachments?.length)) throw new Error('Nachricht ist leer oder zu lang.');
    if (body.attachments !== undefined && (!Array.isArray(body.attachments) || body.attachments.length > 50 || body.attachments.some(a => typeof a.path !== 'string'))) throw new Error('Ungültige Anhänge.');
    const payload = { text: body.text, attachments: body.attachments || [], model: body.model || null, effort: body.effort || null, mode: body.mode || 'default', ...(body.nextSelection ? {nextSelection:body.nextSelection} : {}) };
    const intent = body.nextSelection ? 'after' : body.intent || 'send';
    const fingerprint = createHash('sha256').update(JSON.stringify({ chatId, intent, payload })).digest('hex');
    const result = await this.change(s => {
      const existing = s.messages.find(m => m.id === body.messageId);
      if (existing) {
        if (existing.fingerprint !== fingerprint) fail('Nachrichten-ID wurde bereits mit anderem Inhalt verwendet.');
        return existing;
      }
      const turnId = this.active(chatId) || s.gates[chatId]?.turnId || null;
      const dispatch = s.messages.find(m => m.chatId === chatId && m.status === 'dispatching');
      if (turnId && !s.gates[chatId]) s.gates[chatId] = { turnId, blocked: false };
      const message = { id: body.messageId, chatId, intent, payload, fingerprint, status: 'waiting', revision: 1, createdAt: Date.now(), targetDispatchId: intent === 'send' && !turnId ? dispatch?.id : null, targetTurnId: intent === 'send' ? turnId : null };
      if (turnId && intent === 'send' && !this.canSteer(chatId)) message.detail = 'Dieser Worker übernimmt Ergänzungen nach dem laufenden Turn.';
      s.messages.push(message);
      return message;
    });
    this.kick(chatId);
    return result;
  }
  async edit(chatId, id, revision, text, remove = false) {
    const result = await this.change(s => {
      const m = s.messages.find(m => m.chatId === chatId && m.id === id);
      if (!m || m.status !== 'waiting' || m.revision !== revision) fail('Nachricht wurde inzwischen geändert oder bereits übergeben. Bitte Liste aktualisieren.');
      if (remove) m.status = 'cancelled';
      else {
        if (typeof text !== 'string' || text.length > 100000 || (!text.trim() && !m.payload.attachments.length)) throw new Error('Nachricht ist leer oder zu lang.');
        m.payload.text = text;
      }
      m.revision++;
      return m;
    });
    this.kick(chatId);
    return result;
  }
  kick(chatId) {
    if (this.pumps.has(chatId)) { this.pumps.get(chatId).again = true; return; }
    const runner = { again: false };
    this.pumps.set(chatId, runner);
    runner.promise = (async () => {
      do { runner.again = false; await this.pump(chatId); } while (runner.again);
    })().catch(this.onError).finally(() => this.pumps.delete(chatId));
  }
  async settle(chatId) { while (this.pumps.has(chatId)) await this.pumps.get(chatId).promise; await this.serial; }
  async pump(chatId) {
    while (true) {
      const m = await this.change(s => {
        if (s.gates[chatId]?.blocked || s.messages.some(m => m.chatId === chatId && (m.status === 'dispatching' || (m.status === 'unknown' && !m.reviewedAt)))) return null;
        const current = this.active(chatId);
        // A persisted predecessor must reach a terminal state, even across restart.
        if (!current && s.gates[chatId]) return null;
        const waiting = s.messages.filter(m => m.chatId === chatId && m.status === 'waiting');
        const next = current
          ? waiting.find(m => m.intent === 'send' && m.targetTurnId === current && this.canSteer(chatId))
          : waiting.find(m => m.intent === 'send' && m.targetTurnId) || waiting[0];
        if (!next) return null;
        next.status = 'dispatching'; next.revision++; next.deliveryTurnId = current || null;
        return next;
      });
      if (!m) return;
      let called = false;
      try {
        const result = await this.send(chatId, m.payload, {
          targetTurnId: m.deliveryTurnId,
          continuation: !!m.targetTurnId && !m.deliveryTurnId,
          beforeCall: () => { called = true; },
        });
        const turnId = result?.turn?.id || result?.turnId || m.deliveryTurnId;
        if (!turnId) throw new Error('Worker lieferte keine Zustellbestätigung.');
        await this.change(s => {
          const item = s.messages.find(x => x.id === m.id);
          for (const waiting of s.messages) if (waiting.targetDispatchId === m.id) waiting.targetTurnId = turnId;
          delete item.detail;
          item.status = 'delivered'; item.turnId = turnId; item.confirmedAt = Date.now(); item.revision++;
          const finished = this.completed.get(chatId + ':' + turnId);
          if (finished) { item.outcome = finished; if (finished !== 'completed') s.gates[chatId] = { turnId, blocked: true }; }
          else s.gates[chatId] = { turnId, blocked: !!s.gates[chatId]?.blocked };
        });
      } catch (error) {
        await this.change(s => {
          const item = s.messages.find(x => x.id === m.id);
          item.status = called ? 'unknown' : (error.deliveryRace || error.deliveryPaused) ? 'waiting' : 'failed';
          item.detail = called ? 'Zustellung unklar. Keine automatische Wiederholung.' : error.message;
          item.revision++;
        });
        if (called || !error.deliveryRace) return;
      }
    }
  }
  async finished(chatId, turn) {
    if (!terminal.has(turn.status)) return;
    this.completed.set(chatId + ':' + turn.id, turn.status);
    await this.change(s => {
      for (const m of s.messages) if (m.chatId === chatId && m.turnId === turn.id) m.outcome = turn.status;
      if (s.gates[chatId]?.turnId === turn.id) {
        if (turn.status === 'completed') delete s.gates[chatId];
        else s.gates[chatId].blocked = true;
      }
    });
    this.kick(chatId);
  }
  async disconnected(chatId) {
    await this.change(s => {
      s.gates[chatId] = { ...s.gates[chatId], blocked: true };
      for (const m of s.messages) if (m.chatId === chatId && m.status === 'dispatching') {
        m.status = 'unknown'; m.detail = 'Worker-Verbindung unterbrochen. Keine automatische Wiederholung.'; m.revision++;
      }
    });
  }
  async reconcile(chatId, thread) {
    const gate = this.state.gates[chatId];
    const turn = thread.turns?.find(t => t.id === gate?.turnId);
    if (turn?.status === 'completed') await this.finished(chatId, turn);
    else if (turn?.status === 'inProgress') await this.change(s => { if (s.gates[chatId]?.turnId === turn.id) s.gates[chatId].blocked = false; });
    else if (gate && !gate.turnId && !thread.turns?.some(t => t.status === 'inProgress'))
      await this.change(s => { if (!s.gates[chatId]?.turnId) delete s.gates[chatId]; });
    this.kick(chatId);
  }
}
