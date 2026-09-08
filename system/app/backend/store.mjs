import {orderDataRoot,orderMemoryRoot} from '../wrapper/layout.mjs';
import { appendFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const now = () => new Date().toISOString();

export class Store {
  constructor(root) {
    this.root = root;
    this.ordersDir = path.join(orderDataRoot(root), 'orders');
    this.runsDir = path.join(orderDataRoot(root), 'runs');
    this.peopleDir = path.join(orderDataRoot(root), 'people');
    this.messagesDir = path.join(orderDataRoot(root), 'messages');
    this.learningFile = path.join(orderMemoryRoot(root), 'learnings.ndjson');
    this.mutation = Promise.resolve();
  }

  async init() {
    await Promise.all([
      mkdir(this.ordersDir, { recursive: true, mode: 0o700 }),
      mkdir(this.runsDir, { recursive: true, mode: 0o700 }),
      mkdir(this.peopleDir, { recursive: true, mode: 0o700 }),
      mkdir(this.messagesDir, { recursive: true, mode: 0o700 }),
      mkdir(path.dirname(this.learningFile), { recursive: true, mode: 0o700 }),
    ]);
  }

  locked(operation) {
    const next = this.mutation.then(operation, operation);
    this.mutation = next.catch(() => {});
    return next;
  }

  async writeJson(directory, value) {
    const target = path.join(directory, `${value.id}.json`);
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
    return value;
  }

  async readJson(directory, id) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
    try {
      return JSON.parse(await readFile(path.join(directory, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async listJson(directory) {
    const names = (await readdir(directory)).filter((name) => name.endsWith('.json'));
    const values = await Promise.all(names.map((name) =>
      readFile(path.join(directory, name), 'utf8').then(JSON.parse)
    ));
    return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listOrders() {
    return this.listJson(this.ordersDir);
  }

  getOrder(id) {
    return this.readJson(this.ordersDir, id);
  }

  getRun(id) {
    return this.readJson(this.runsDir, id);
  }

  async hasSourceMessage(type, messageId) {
    if (!type || !messageId) return false;
    const orders = await this.listOrders();
    return orders.some((order) => order.source?.type === type && order.source?.messageId === messageId);
  }

  identityId({ phone, whatsappJid }) {
    const normalizedPhone = String(phone || '').replace(/\D/g, '');
    const identity = normalizedPhone ? `phone:${normalizedPhone}` : `whatsapp:${whatsappJid}`;
    return createHash('sha256').update(identity).digest('hex').slice(0, 24);
  }

  async upsertPersonUnlocked(input) {
    const phone = String(input.phone || '').replace(/\D/g, '') || null;
    const id = this.identityId({ phone, whatsappJid: input.whatsappJid });
    const existing = await this.readJson(this.peopleDir, id);
    const timestamp = input.interactedAt || now();
    const person = existing || {
      id,
      displayName: null,
      primaryPhone: phone,
      whatsappJid: input.whatsappJid || null,
      crm: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastInteractionAt: null,
    };
    if (input.displayName) person.displayName = String(input.displayName).trim() || person.displayName;
    if (phone) person.primaryPhone = phone;
    if (input.whatsappJid) person.whatsappJid = input.whatsappJid;
    if (input.interactedAt) person.lastInteractionAt = input.interactedAt;
    person.updatedAt = now();
    await this.writeJson(this.peopleDir, person);
    return person;
  }

  upsertPerson(input) {
    return this.locked(() => this.upsertPersonUnlocked(input));
  }

  listPeople() {
    return this.listJson(this.peopleDir);
  }

  getPerson(id) {
    return this.readJson(this.peopleDir, id);
  }

  recordWhatsAppMessage(input) {
    return this.locked(async () => {
      const person = await this.upsertPersonUnlocked({
        phone: input.phone,
        whatsappJid: input.whatsappJid,
        displayName: input.displayName,
        interactedAt: input.timestamp || now(),
      });
      const platformMessageId = input.platformMessageId || randomUUID();
      const id = createHash('sha256')
        .update(`whatsapp:${input.conversationId}:${platformMessageId}`)
        .digest('hex').slice(0, 32);
      const existing = await this.readJson(this.messagesDir, id);
      if (existing) return { person, message: existing, created: false };
      const message = {
        id,
        platform: 'whatsapp',
        platformMessageId,
        personId: person.id,
        conversationId: input.conversationId,
        direction: input.direction,
        sender: input.sender || null,
        text: String(input.text || ''),
        timestamp: input.timestamp || now(),
        createdAt: now(),
      };
      await this.writeJson(this.messagesDir, message);
      return { person, message, created: true };
    });
  }

  async getPersonContext(id, limit = 50) {
    const person = await this.getPerson(id);
    if (!person) return null;
    const messages = (await this.listJson(this.messagesDir))
      .filter((message) => message.personId === id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, Math.max(1, Math.min(Number(limit) || 50, 200)))
      .reverse();
    return { person, messages };
  }

  mergeCrmContact(input) {
    return this.locked(async () => {
      const person = await this.upsertPersonUnlocked({
        phone: input.phone,
        displayName: input.displayName,
      });
      person.crm = {
        provider: String(input.provider).trim(),
        externalId: String(input.externalId).trim(),
        profile: input.profile && typeof input.profile === 'object' ? input.profile : {},
        syncedAt: now(),
      };
      person.updatedAt = now();
      await this.writeJson(this.peopleDir, person);
      return person;
    });
  }

  createOrder(input) {
    return this.locked(async () => {
      const order = {
        id: randomUUID(),
        title: input.title.trim(),
        instructions: input.instructions.trim(),
        engine: (input.engine || 'any').trim().toLowerCase(),
        status: 'queued',
        createdAt: now(),
        updatedAt: now(),
        runId: null,
        result: null,
        artifacts: [],
        error: null,
        source: input.source || null,
      };
      return this.writeJson(this.ordersDir, order);
    });
  }

  claimNext(engine) {
    return this.locked(async () => {
      const orders = (await this.listOrders())
        .filter((order) => order.status === 'queued' && (order.engine === 'any' || order.engine === engine))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const order = orders[0];
      if (!order) return null;

      const run = {
        id: randomUUID(),
        orderId: order.id,
        engine,
        status: 'running',
        createdAt: now(),
        completedAt: null,
      };
      order.status = 'running';
      order.runId = run.id;
      order.updatedAt = now();
      await this.writeJson(this.runsDir, run);
      await this.writeJson(this.ordersDir, order);
      return { order, run };
    });
  }

  finishRun(runId, input, failed = false) {
    return this.locked(async () => {
      const run = await this.getRun(runId);
      if (!run) return null;
      if (run.status !== 'running') throw new Error('Run ist bereits abgeschlossen.');

      const order = await this.getOrder(run.orderId);
      if (!order) throw new Error('Auftrag zum Run fehlt.');

      run.status = failed ? 'failed' : 'completed';
      run.completedAt = now();
      order.status = run.status;
      order.result = failed ? null : input.result?.trim() || '';
      order.artifacts = failed || !Array.isArray(input.artifacts)
        ? []
        : input.artifacts.map((artifact) => ({
          filename: String(artifact.filename),
          mediaType: String(artifact.mediaType || 'application/octet-stream'),
          size: Number(artifact.size) || 0,
          url: String(artifact.url),
        }));
      order.error = failed ? input.error?.trim() || 'Unbekannter Fehler' : null;
      order.updatedAt = now();

      await this.writeJson(this.runsDir, run);
      await this.writeJson(this.ordersDir, order);

      const learnings = Array.isArray(input.learnings) ? input.learnings : [];
      for (const content of learnings.map(String).map((item) => item.trim()).filter(Boolean)) {
        await appendFile(this.learningFile, `${JSON.stringify({
          id: randomUUID(), orderId: order.id, runId, engine: run.engine, content, createdAt: now(),
        })}\n`, { encoding: 'utf8', mode: 0o600 });
      }
      return { order, run };
    });
  }
}
