import path from 'node:path';
import { mkdir, readdir, readFile, open, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { saveSecret, readSecret } from './integrations.mjs';
const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const validId = id => { if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Ungültige Aufnahme.'); return id; };
export function wav(pcm, rate = 16000) {
  const h = Buffer.alloc(44);
  h.write('RIFF'); h.writeUInt32LE(pcm.length + 36, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export async function durable(file, data) {
  const temp = file + '.tmp';
  const f = await open(temp, 'w', 0o600);
  try { await f.writeFile(data); await f.sync(); } finally { await f.close(); }
  await rename(temp, file);
  const dir = await open(path.dirname(file), 'r');
  try { await dir.sync(); } finally { await dir.close(); }
}
export class DictationStore {
  constructor(root) { this.root = root; this.locks = new Map(); }
  dir(id) { return path.join(this.root, validId(id)); }
  async serial(id, fn) {
    const prev = this.locks.get(id) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn); this.locks.set(id, next);
    try { return await next; } finally { if (this.locks.get(id) === next) this.locks.delete(id); }
  }
  async create(b) {
    return this.serial(b.id, async () => {
      const dir = this.dir(b.id); await mkdir(dir, { recursive: true, mode: 0o700 });
      try { return await this.meta(b.id); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      const m = { id: b.id, createdAt: new Date().toISOString(), rate: 16000, state: 'recording', text: '' };
      await durable(path.join(dir, 'meta.json'), JSON.stringify(m)); return m;
    });
  }
  async meta(id) { return JSON.parse(await readFile(path.join(this.dir(id), 'meta.json'), 'utf8')); }
  async update(id, changes) {
    return this.serial(id, async () => { const m = { ...await this.meta(id), ...changes }; await durable(path.join(this.dir(id), 'meta.json'), JSON.stringify(m)); return m; });
  }
  async chunks(id) { return (await readdir(this.dir(id))).filter(n => /^\d{8}\.pcm$/.test(n)).sort(); }
  async append(b) {
    return this.serial(b.id, async () => {
      await this.meta(b.id);
      if (!Number.isInteger(b.seq) || b.seq < 0 || b.seq > 99999999 || typeof b.audio !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(b.audio)) throw new Error('Ungültiger Audioabschnitt.');
      const pcm = Buffer.from(b.audio, 'base64');
      if (!pcm.length || pcm.length % 2 || pcm.length > 256000) throw new Error('Audioabschnitt zu groß oder ungültig.');
      const file = path.join(this.dir(b.id), String(b.seq).padStart(8, '0') + '.pcm');
      try { const old = await readFile(file); if (!old.equals(pcm)) throw new Error('Audioabschnitt kollidiert; Original bleibt erhalten.'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; await durable(file, pcm); }
      return { saved: b.seq, sha256: createHash('sha256').update(pcm).digest('hex') };
    });
  }
  async audio(id) {
    const files = await this.chunks(id);
    if (!files.length) throw new Error('Noch kein Audio gesichert.');
    if (files.some((n, i) => Number(n.slice(0, 8)) !== i)) throw new Error('Audioabschnitte fehlen. Browser erneut öffnen und Sicherung abwarten.');
    const buffers = [];
    for (const n of files) buffers.push(await readFile(path.join(this.dir(id), n)));
    return wav(Buffer.concat(buffers));
  }
  async list() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const list = [];
    for (const id of await readdir(this.root)) {
      if (!/^[a-f0-9-]{36}$/.test(id)) continue;
      const m = await this.meta(id); list.push({ ...m, chunks: (await this.chunks(id)).length });
    }
    return list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
}
export async function installDictationRoutes({ route, dataRoot, recordBoundary, fetcher = fetch, secrets = { save: saveSecret, read: readSecret } }) {
  const recordings = new DictationStore(path.join(dataRoot, 'dictations'));
  const jobs = new Map(); let busy = false;
  const settingsFile = path.join(dataRoot, 'dictation-settings.json');
  let writes = Promise.resolve();
  const serial = secrets.exclusive || (fn => { const run = writes.catch(()=>{}).then(fn); writes = run; return run; });
  const settings = async () => { try { return JSON.parse(await readFile(settingsFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; return { provider: 'local', groq: false }; } };
  route('GET', '/api/dictation/status', async () => {
    let localReady = true; try { await access(path.join(dataRoot, 'dictation-model/ready')); } catch { localReady = false; }
    return { ...await settings(), localReady, recordings: (await recordings.list()).map(m => ({ ...m, processing: jobs.has(m.id) })) };
  });
  route('POST', '/api/dictation/settings', b => serial(async () => {
    if (!['local', 'groq'].includes(b.provider)) throw new Error('Ungültiger Anbieter.');
    const s = await settings();
    if (b.key) {
      if (typeof b.key !== 'string' || /[\r\n\0]/.test(b.key) || b.key.length > 10000) throw new Error('Ungültiger API-Schlüssel.');
      const r = await fetcher('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${b.key}` }, redirect:'error', signal:AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`Groq meldet HTTP ${r.status}. API-Schlüssel prüfen.`);
      await secrets.save('dictation-groq', b.key); s.groq = true;
    }
    if (b.provider === 'groq' && !s.groq) throw new Error('Bitte zuerst den Groq-Schlüssel speichern.');
    s.provider = b.provider; await durable(settingsFile, JSON.stringify(s)); return s;
  }));
  route('POST', '/api/dictation/disconnect', () => serial(async () => { const s = { ...await settings(), groq:false, provider:'local' }; await durable(settingsFile, JSON.stringify(s)); return {ok:true}; }));
  route('POST', '/api/dictation/create', b => recordings.create(b));
  route('POST', '/api/dictation/chunk', b => recordings.append(b));
  route('POST', '/api/dictation/finish', async b => {
    const count = (await recordings.chunks(b.id)).length;
    if (count !== b.count) throw new Error('Sicherung noch unvollständig. Erneut versuchen.');
    await recordings.audio(b.id);
    return recordings.update(b.id, { state: b.trash ? 'trash' : 'saved', expectedChunks: count });
  });
  route('POST', '/api/dictation/trash', b => recordings.update(b.id, { state: b.restore ? 'saved' : 'trash' }));
  route('POST', '/api/dictation/transcribe', async b => {
    if (busy) throw new Error('Eine Aufnahme wird bereits verarbeitet. Bitte kurz warten.');
    busy = true;
    let m, provider;
    try {
    m = await recordings.meta(b.id);
    if (m.state === 'trash') throw new Error('Aufnahme zuerst wiederherstellen.');
    provider = b.provider || (await settings()).provider;
    if (!['local', 'groq'].includes(provider)) throw new Error('Ungültiger Anbieter.');
    if (provider === 'groq' && !(await settings()).groq) throw new Error('Groq zuerst unter Verbindungen einrichten.');
    } catch (e) { busy = false; throw e; }
    jobs.set(b.id, true);
    const run = async () => {
      try {
        await recordings.update(b.id, { error: null });
        const audio = await recordings.audio(b.id);
        const file = path.join(recordings.dir(b.id), 'audio.wav'); await durable(file, audio);
        let text;
        if (provider === 'groq') {
          if (audio.length > 24 * 1024 * 1024) throw new Error('Aufnahme überschreitet das Groq-Uploadlimit. Bitte lokal verarbeiten.');
          const key = await secrets.read('dictation-groq');
          await recordBoundary('dictation-groq', { recordingId: b.id, audioBytes: audio.length });
          const form = new FormData(); form.append('file', new Blob([audio], { type: 'audio/wav' }), 'dictation.wav');
          form.append('model', 'whisper-large-v3-turbo'); form.append('language', 'de'); form.append('response_format', 'json');
          const r = await fetcher('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, redirect: 'error', signal: AbortSignal.timeout(120000) });
          if (!r.ok) throw new Error(`Groq meldet HTTP ${r.status}. Aufnahme bleibt gesichert.`);
          text = (await r.json()).text;
        } else {
          const r = await exec(path.join(dataRoot, 'dictation-runtime/bin/python'), [path.join(here, 'scripts/dictation.py'), 'transcribe', path.join(dataRoot, 'dictation-model'), file], { timeout: 1800000, maxBuffer: 4000000, env: { ...process.env, HF_HUB_OFFLINE: '1' } });
          text = JSON.parse(r.stdout).text;
        }
        if (typeof text !== 'string') throw new Error('Keine gültige Textantwort erhalten.');
        await recordings.update(b.id, { text, provider, transcribedAt: new Date().toISOString(), error: null });
      } catch (e) {
        await recordings.update(b.id, { error: provider === 'local' ? 'Lokale Verarbeitung fehlgeschlagen. Einrichtung prüfen und erneut versuchen; Audio bleibt erhalten.' : e.message });
      } finally { jobs.delete(b.id); busy = false; }
    };
    void run().catch(() => { jobs.delete(b.id); busy = false; }); return { started: true };
  });
  return recordings;
}
