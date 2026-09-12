import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  // Conservative IPv6 global-unicast policy; mapped IPv4 and transition ranges are denied.
  if (isIP(address) !== 6 || !/^[23][0-9a-f]{3}:/i.test(address)) return false;
  const [first, second] = address.split(':').slice(0, 2).map(part => parseInt(part || '0', 16));
  // IANA special-purpose blocks, not the entire public 2001::/16 allocation.
  // Keep protocol assignments conservatively denied, including Teredo/ORCHID.
  return first !== 0x2002 &&
    !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
    !(first === 0x3fff && second < 0x1000);
}

export async function safeRequest(value, {
  method = 'HEAD', headers = {}, body, timeoutMs = 10000, maxBytes = 100000,
  internalUrls = [], resolve = lookup,
} = {}) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('HTTP(S)-Adresse ohne Zugangsdaten erforderlich.');
  const internal = internalUrls.some(value => new URL(value).href === url.href);
  if (!internal && url.port && !['80', '443'].includes(url.port)) throw new Error('Port nicht freigegeben.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let dnsTimer;
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
    : await Promise.race([
      resolve(hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS-Zeitlimit überschritten.')), timeoutMs); }),
    ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || (!internal && addresses.some(a => !publicAddress(a.address))))
    throw new Error('Interne oder private URL nicht freigegeben.');
  const pinned = addresses[0];
  return new Promise((resolveResponse, reject) => {
    const timer = setTimeout(() => req.destroy(new Error('Zeitlimit überschritten.')), timeoutMs);
    const req = (url.protocol === 'https:' ? https : http).request(url, {
      method, headers,
      // Pin the validated address; retain original hostname for Host and TLS verification.
      lookup: (_hostname, options, callback) => options.all
        ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family),
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        reject(new Error('Redirect nicht erlaubt.')); res.destroy(); req.destroy(); return;
      }
      let size = 0; const chunks = [];
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) { reject(new Error('Antwort zu groß.')); res.destroy(); req.destroy(); }
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolveResponse({ status: res.statusCode,
        ok: res.statusCode >= 200 && res.statusCode < 300,
        text: async () => Buffer.concat(chunks).toString('utf8'),
        bytes: async () => Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.on('close', () => clearTimeout(timer));
    req.end(body);
  });
}
