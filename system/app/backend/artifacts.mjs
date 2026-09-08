import { mkdir, writeFile, realpath, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
const SAFE_ID = /^[a-zA-Z0-9-]+$/;
const execFileAsync = promisify(execFile);
const TAILSCALE_COMMANDS = [
  'tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/tailscale',
];

function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function tailscaleBaseUrlFromStatus(status, port, serveEnabled = false) {
  const dnsName = String(status?.Self?.DNSName || '').replace(/\.$/, '');
  const ip = status?.Self?.TailscaleIPs?.find((value) => /^100\./.test(value));
  if (serveEnabled && dnsName) return `https://${dnsName}`;
  const host = ip || dnsName;
  return host ? `http://${host}:${port}` : null;
}

export async function detectTailscaleBaseUrl({
  env = process.env,
  port,
  execStatus = (command, args) => execFileAsync(command, args),
} = {}) {
  const configured = cleanBaseUrl(env.TAILSCALE_BASE_URL);
  if (configured) return configured;
  for (const command of TAILSCALE_COMMANDS) {
    try {
      const { stdout } = await execStatus(command, ['status', '--json']);
      let serveEnabled = false;
      try {
        const serve = await execStatus(command, ['serve', 'status', '--json']);
        serveEnabled = Object.keys(JSON.parse(serve.stdout)).length > 0;
      } catch {
        // Direct Tailscale-IP delivery remains available without Serve.
      }
      const detected = tailscaleBaseUrlFromStatus(JSON.parse(stdout), port, serveEnabled);
      if (detected) return detected;
    } catch {
      // Try the next known CLI location.
    }
  }
  return null;
}

function validateFilename(filename) {
  const value = String(filename || '').trim();
  if (!value || value.startsWith('.') || value.includes('\\') || path.basename(value) !== value || value.includes('\0')) {
    throw new Error('Artefakt-Dateiname ist ungültig.');
  }
  return value;
}

function decodeBase64(value) {
  const normalized = String(value || '').replace(/\s/g, '');
  if (!normalized || !/^[a-zA-Z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error('Artefakt-Inhalt ist kein gültiges Base64.');
  }
  const content = Buffer.from(normalized, 'base64');
  if (content.length > MAX_ARTIFACT_BYTES) throw new Error('Artefakt ist größer als 25 MB.');
  return content;
}

export function formatResultWithArtifacts(result, artifacts = []) {
  const text = String(result || '').trim();
  if (!artifacts.length) return text;
  const links = artifacts.map(({ filename, url }) => `[${filename}](${url})`).join(' · ');
  return `${text}${text ? '\n\n' : ''}**Download:** ${links}`;
}

export class ArtifactStore {
  constructor(root, { baseUrl } = {}) {
    this.directory = path.join(root, 'data', 'artifacts');
    this.baseUrl = cleanBaseUrl(baseUrl);
  }

  async init() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
  }

  async publish(runId, inputs = []) {
    if (!Array.isArray(inputs)) throw new Error('artifacts muss eine Liste sein.');
    if (!inputs.length) return [];
    if (!this.baseUrl) throw new Error('TAILSCALE_BASE_URL fehlt und Tailscale wurde nicht erkannt.');
    if (!SAFE_ID.test(String(runId || ''))) throw new Error('Run-ID ist ungültig.');
    if (inputs.length > 20) throw new Error('Pro Auftrag sind höchstens 20 Artefakte erlaubt.');

    const targetDirectory = path.join(this.directory, runId);
    await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
    if ((await lstat(targetDirectory)).isSymbolicLink()) throw new Error('Verknüpfung nicht erlaubt.');
    const canonicalBase = await realpath(this.directory);
    if (!(await realpath(targetDirectory)).startsWith(canonicalBase + path.sep)) throw new Error('Pfad außerhalb des Artefaktverzeichnisses.');
    const published = [];
    const seen = new Set();

    for (const input of inputs) {
      const filename = validateFilename(input?.filename);
      if (seen.has(filename)) throw new Error(`Artefakt-Dateiname ist doppelt: ${filename}`);
      seen.add(filename);
      const content = decodeBase64(input?.contentBase64);
      const target = path.join(targetDirectory, filename);
      await writeFile(target, content, { flag: 'wx', mode: 0o600 });
      published.push({
        filename,
        mediaType: String(input?.mediaType || 'application/octet-stream'),
        size: content.length,
        path: target,
        url: `${this.baseUrl}/artifacts/${encodeURIComponent(runId)}/${encodeURIComponent(filename)}`,
      });
    }
    return published;
  }

  async resolveSafe(runId, filename) {
    const target = this.resolve(runId, filename);
    if (!target) return null;
    try {
      const base = await realpath(this.directory);
      const parent = path.dirname(target);
      if ((await lstat(parent)).isSymbolicLink() || (await lstat(target)).isSymbolicLink()) return null;
      const resolved = await realpath(target);
      return resolved.startsWith(base + path.sep) ? resolved : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  resolve(runId, filename) {
    if (!SAFE_ID.test(String(runId || ''))) return null;
    try {
      return path.join(this.directory, runId, validateFilename(filename));
    } catch {
      return null;
    }
  }
}
