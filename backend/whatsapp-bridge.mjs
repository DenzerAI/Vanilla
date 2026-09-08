import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

const MAX_WHATSAPP_TEXT_LENGTH = 3_500;
const noop = () => {};
const silentLogger = {
  trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop,
  child() { return this; },
};

function truthy(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeAllowlist(raw) {
  return new Set(String(raw || '')
    .split(',')
    .map((item) => item.replace(/\D/g, ''))
    .filter(Boolean));
}

function unwrapMessage(message) {
  let current = message;
  while (current?.ephemeralMessage?.message || current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message) {
    current = current.ephemeralMessage?.message
      || current.viewOnceMessage?.message
      || current.viewOnceMessageV2?.message;
  }
  return current;
}

export function messageText(message) {
  const content = unwrapMessage(message);
  return content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.videoMessage?.caption
    || content?.documentMessage?.caption
    || '';
}

export function splitMessage(text, maxLength = MAX_WHATSAPP_TEXT_LENGTH) {
  const chunks = [];
  let remaining = String(text || '').trim();
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf('\n', maxLength);
    if (cut < maxLength / 2) cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < maxLength / 2) cut = maxLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export class WhatsAppBridge {
  constructor({ root, store, env = process.env, logger = console }) {
    this.store = store;
    this.logger = logger;
    this.authDirectory = path.join(root, 'data', 'whatsapp-auth');
    this.prefix = env.WHATSAPP_COMMAND_PREFIX ?? '!';
    this.engine = (env.WHATSAPP_ENGINE || 'any').trim().toLowerCase();
    this.allowGroups = truthy(env.WHATSAPP_ALLOW_GROUPS);
    this.acknowledge = truthy(env.WHATSAPP_ACKNOWLEDGE, true);
    this.allowedNumbers = normalizeAllowlist(env.WHATSAPP_ALLOWED_NUMBERS);
    this.autoStart = truthy(env.WHATSAPP_AUTO_START);
    this.socket = null;
    this.seenMessageIds = new Set();
    this.connectPromise = null;
    this.reconnectTimer = null;
    this.state = {
      status: 'disconnected',
      qrDataUrl: null,
      account: null,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  }

  status() {
    return { ...this.state };
  }

  setState(change) {
    this.state = { ...this.state, ...change, updatedAt: new Date().toISOString() };
  }

  async init() {
    await mkdir(this.authDirectory, { recursive: true });
    if (this.autoStart) await this.connect();
  }

  async connect() {
    if (this.state.status === 'connected') return this.status();
    if (this.socket && ['connecting', 'qr'].includes(this.state.status)) return this.status();
    if (this.connectPromise) return this.connectPromise;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.connectPromise = this.openSocket().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  async openSocket() {
    this.setState({ status: 'connecting', qrDataUrl: null, error: null });
    const { state, saveCreds } = await useMultiFileAuthState(this.authDirectory);
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      logger: silentLogger,
    });
    this.socket = socket;

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('messages.upsert', (event) => {
      this.handleMessages(event).catch((error) => this.logger.error('WhatsApp-Nachricht fehlgeschlagen:', error));
    });
    socket.ev.on('connection.update', (update) => {
      this.handleConnectionUpdate(socket, update).catch((error) => {
        this.setState({ status: 'error', error: error.message, qrDataUrl: null });
        this.logger.error('WhatsApp-Verbindung fehlgeschlagen:', error);
      });
    });
    return this.status();
  }

  async handleConnectionUpdate(socket, { connection, lastDisconnect, qr }) {
    if (socket !== this.socket) return;
    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 360, margin: 2 });
      this.setState({ status: 'qr', qrDataUrl, error: null });
    }
    if (connection === 'open') {
      this.setState({
        status: 'connected',
        qrDataUrl: null,
        account: socket.user?.id?.split(':')[0] || null,
        error: null,
      });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
        || lastDisconnect?.error?.data?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      this.socket = null;
      this.setState({
        status: loggedOut ? 'logged_out' : 'disconnected',
        qrDataUrl: null,
        account: loggedOut ? null : this.state.account,
        error: lastDisconnect?.error?.message || null,
      });
      if (!loggedOut && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect().catch((error) => this.logger.error('WhatsApp-Reconnect fehlgeschlagen:', error));
        }, 3_000);
      }
    }
  }

  senderNumber(message) {
    const jid = message.key.participant || message.key.participantAlt
      || message.key.remoteJidAlt || message.key.remoteJid || '';
    return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
  }

  acceptsAsOrder(message, text) {
    const chatId = message.key.remoteJid || '';
    if (!chatId || chatId === 'status@broadcast' || message.key.fromMe) return false;
    if (chatId.endsWith('@g.us') && !this.allowGroups) return false;
    if (this.allowedNumbers.size && !this.allowedNumbers.has(this.senderNumber(message))) return false;
    return !this.prefix || text.startsWith(this.prefix);
  }

  async handleMessages({ type, messages = [] }) {
    if (type !== 'notify') return;
    for (const message of messages) {
      const messageId = message.key.id || null;
      if (messageId && this.seenMessageIds.has(messageId)) continue;
      const rawText = messageText(message.message).trim();
      const chatId = message.key.remoteJid || '';
      if (!rawText || !chatId || chatId === 'status@broadcast') continue;
      if (chatId.endsWith('@g.us') && !this.allowGroups) continue;

      const sender = this.senderNumber(message);
      const timestamp = message.messageTimestamp
        ? new Date(Number(message.messageTimestamp) * 1_000).toISOString()
        : new Date().toISOString();
      const recorded = await this.store.recordWhatsAppMessage?.({
        platformMessageId: messageId,
        conversationId: chatId,
        whatsappJid: chatId.endsWith('@g.us') ? (message.key.participant || null) : chatId,
        phone: sender,
        displayName: message.pushName || null,
        direction: message.key.fromMe ? 'outbound' : 'inbound',
        sender,
        text: rawText,
        timestamp,
      });

      if (!this.acceptsAsOrder(message, rawText)) continue;
      const instructions = this.prefix ? rawText.slice(this.prefix.length).trim() : rawText;
      if (!instructions) continue;

      if (messageId && await this.store.hasSourceMessage?.('whatsapp', messageId)) continue;
      if (messageId) this.seenMessageIds.add(messageId);

      const firstLine = instructions.split('\n')[0].slice(0, 80);
      const order = await this.store.createOrder({
        title: `WhatsApp: ${firstLine}`,
        instructions,
        engine: this.engine,
        source: {
          type: 'whatsapp',
          chatId: message.key.remoteJid,
          messageId,
          sender,
          personId: recorded?.person?.id || null,
          receivedAt: new Date().toISOString(),
        },
      });
      if (this.acknowledge && this.socket) {
        await this.socket.sendMessage(message.key.remoteJid, {
          text: `Auftrag angenommen: ${order.id}`,
        }, { quoted: message });
      }
    }
  }

  async deliverRunResult({ order }) {
    if (order?.source?.type !== 'whatsapp' || !order.source.chatId) return false;
    if (!this.socket || this.state.status !== 'connected') {
      throw new Error('WhatsApp ist nicht verbunden; Ergebnis konnte nicht zugestellt werden.');
    }
    const heading = order.status === 'failed' ? 'Auftrag fehlgeschlagen' : 'Auftrag erledigt';
    const content = order.status === 'failed' ? order.error : order.result;
    const chunks = splitMessage(`${heading}:\n${content || '(kein Inhalt)'}`);
    for (const text of chunks) {
      await this.socket.sendMessage(order.source.chatId, { text });
    }
    return true;
  }
}
