import { createHash } from 'node:crypto';

// Persist acceptance before dispatch. A lost worker acknowledgement is never retried blindly.
export class MessageDelivery {
  constructor({store, createChat, send, emit = () => {}, paused = () => false, locked = () => false}) {
    Object.assign(this, {store, createChat, send, emit, paused, locked});
    this.serial = Promise.resolve();
    this.inflight = new Set();
  }
  async init() {
    this.store.state.messageDelivery ||= {version:1, entries:[]};
    if (this.store.state.messageDelivery.version !== 1) throw Error('Unbekannte Postausgangsversion.');
    for (const entry of this.entries) {
      if (entry.status !== 'started' && (entry.phase === 'dispatching' || entry.phase === 'creating')) {
        entry.status = 'unknown';
        entry.error = 'Übergabe wurde unterbrochen. Bitte den Verlauf prüfen, bevor du erneut sendest.';
      }
    }
    await this.store.save();
    return this;
  }
  get entries() { return this.store.state.messageDelivery.entries; }
  transaction(fn) {
    const next = this.serial.catch(() => {}).then(fn);
    this.serial = next;
    return next;
  }
  receipt(entry) {
    const {clientMessageId, chatId, localId, status, turnId, itemId, createdAt, error, payload} = entry;
    return {clientMessageId, chatId, localId, status, turnId, itemId, createdAt, error,
      text:payload.text, attachments:payload.attachments || [], projectId:payload.chat?.projectId};
  }
  get(key) {
    const entry = this.entries.find(e => e.clientMessageId === key);
    if (!entry) throw Error('Nachricht nicht gefunden.');
    return this.receipt(entry);
  }
  list(id) { this.store.chat(id); return this.entries.filter(e => e.chatId === id).map(e => this.receipt(e)); }
  async accept(input) {
    const receipt = await this.transaction(async () => {
      if (!/^[a-zA-Z0-9-]{16,96}$/.test(input.clientMessageId || '')) throw Error('Ungültige Nachrichtenkennung.');
      const payload = structuredClone(input);
      delete payload.clientMessageId;
      const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const existing = this.entries.find(e => e.clientMessageId === input.clientMessageId);
      if (existing) {
        if (existing.digest !== digest) throw Error('Diese Nachrichtenkennung gehört zu einem anderen Inhalt.');
        return this.receipt(existing);
      }
      if (this.paused()) throw Error('Der Server startet neu. Die Nachricht bleibt im Postausgang.');
      if (typeof payload.text !== 'string' || (!payload.text.trim() && !payload.attachments?.length)) throw Error('Nachricht ist leer.');
      if (payload.text.length > 200000 || !Array.isArray(payload.attachments || [])) throw Error('Nachricht ist zu groß oder ungültig.');
      if (payload.id) this.store.chat(payload.id);
      else if (!payload.chat || typeof payload.chat.projectId !== 'string') throw Error('Arbeitsbereich fehlt.');
      const entry = {clientMessageId:input.clientMessageId, digest, payload, localId:payload.localId,
        chatId:payload.id || null, status:'accepted', phase:'queued', createdAt:Date.now()};
      this.entries.push(entry);
      try { await this.store.save(); }
      catch (error) { this.entries.splice(this.entries.indexOf(entry),1); throw error; }
      return this.receipt(entry);
    });
    this.kick();
    return receipt;
  }
  kick() {
    if (this.paused()) return;
    for (const entry of this.entries) {
      const key = entry.chatId || entry.localId;
      if (entry.status !== 'accepted' || this.inflight.has(entry.clientMessageId) || this.entries.some(e => this.inflight.has(e.clientMessageId) && (e.chatId || e.localId) === key) || this.locked(entry.chatId)) continue;
      this.inflight.add(entry.clientMessageId);
      void this.process(entry).catch(() => {}).finally(() => {this.inflight.delete(entry.clientMessageId);});
    }
  }
  async update(entry, values) {
    await this.transaction(async () => {
      Object.assign(entry, values);
      await this.store.save();
    });
    this.emit({method:'wrapper/delivery', params:{threadId:entry.chatId, clientMessageId:entry.clientMessageId}});
  }
  async observe(message) {
    const p=message.params || {}, item=p.item;
    if(message.method!=="item/completed" || item?.type!=="userMessage" || !p.turnId)return;
    const entry=this.entries.find(e=>e.chatId===p.threadId && e.phase==="dispatching" && this.inflight.has(e.clientMessageId));
    if(!entry)return;
    const content=item.content || [];
    if(entry.payload.text && content.find(c=>c.type==="text")?.text!==entry.payload.text)return;
    if(!(entry.payload.attachments || []).every(file=>content.some(c=>(c.path || c.text || "").includes(file.path))))return;
    await this.update(entry,{status:"started",turnId:p.turnId,itemId:item.id,error:""});
  }
  async process(entry) {
    try {
      if (!entry.chatId) {
        await this.update(entry,{phase:'creating'});
        const result = await this.createChat(entry.payload.chat);
        await this.update(entry,{chatId:result.thread.id, phase:'queued'});
      }
      await this.update(entry,{phase:'dispatching'});
      const result = await this.send(entry.chatId, entry.payload);
      await this.update(entry,{status:'started',phase:'done',turnId:result.turn?.id || result.turnId || entry.turnId});
    } catch (error) {
      // Even an exception can follow a successful native send; preserve the body and do not duplicate it.
      if(entry.status==='started')return;
      await this.update(entry,{status:'unknown', error:error.message || 'Übergabestatus unklar.'}).catch(() => {});
    }
  }
}
