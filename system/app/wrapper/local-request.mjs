import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function localAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c, d] = address.split(".").map(Number);
    return (
      (a === 127 && d !== 255) ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  return (
    isIP(address) === 6 &&
    (address === "::1" || /^f[cd][0-9a-f]{2}:/i.test(address))
  );
}

export function localURL(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Serveradresse mit http:// oder https:// eingeben.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !["/", "/v1", "/v1/", "/api", "/api/"].includes(url.pathname)
  )
    throw new Error(
      "Nur die Serveradresse ohne Zugangsdaten oder zusätzlichen Pfad eingeben.",
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !localAddress(host))
    throw new Error("Eine Adresse im lokalen Netzwerk verwenden.");
  return url.origin;
}

// Separate from connector networking: only explicit private endpoints, fixed API
// paths, no redirects, DNS pinned to a checked address, bounded bodies and timeouts.
export async function localRequest(
  base,
  endpoint,
  {
    body,
    signal,
    timeoutMs = 2500,
    onLine,
    resolve = lookup,
    maxBytes = 2 * 1024 * 1024,
  } = {},
) {
  const origin = localURL(base);
  if (
    ![
      "/api/tags",
      "/api/show",
      "/api/pull",
      "/api/chat",
      "/v1/models",
      "/v1/chat/completions",
    ].includes(endpoint)
  )
    throw new Error("Unbekannte lokale Schnittstelle.");
  const url = new URL(endpoint, origin);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let timer;
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await Promise.race([
        resolve(host, { all: true, verbatim: true }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Rechner nicht erreichbar.")),
            2000,
          );
        }),
      ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((a) => !localAddress(a.address)))
    throw new Error(
      "Die Adresse muss auf einen Rechner im lokalen Netzwerk zeigen.",
    );
  const pinned = addresses[0];
  return new Promise((resolveResponse, reject) => {
    let size = 0,
      pending = "",
      chunks = [];
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: body === undefined ? "GET" : "POST",
        signal,
        headers: {
          accept: "application/json",
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        lookup: (_host, options, cb) =>
          options.all
            ? cb(null, [pinned])
            : cb(null, pinned.address, pinned.family),
      },
      (res) => {
        res.on("error", reject);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message =
            res.statusCode === 401 || res.statusCode === 403
              ? "Der Server benötigt einen Zugangsschlüssel. Dieser Anschluss unterstützt noch keine Anmeldung."
              : `Lokaler Server meldet HTTP ${res.statusCode}.`;
          reject(new Error(message));
          res.destroy();
          req.destroy();
          return;
        }
        const consume = (line) => {
          if (!line.trim()) return;
          const data = JSON.parse(line);
          if (data.error) throw new Error(String(data.error).slice(0, 240));
          onLine(data);
        };
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          size += Buffer.byteLength(chunk);
          if (size > maxBytes) {
            reject(new Error("Antwort des lokalen Servers ist zu groß."));
            res.destroy();
            req.destroy();
            return;
          }
          if (!onLine) {
            chunks.push(chunk);
            return;
          }
          try {
            pending += chunk;
            let index;
            while ((index = pending.indexOf("\n")) >= 0) {
              consume(pending.slice(0, index));
              pending = pending.slice(index + 1);
            }
          } catch (e) {
            reject(e);
            res.destroy();
            req.destroy();
          }
        });
        res.on("aborted", () =>
          reject(new Error("Verbindung zum lokalen Server abgebrochen.")),
        );
        res.on("end", () => {
          try {
            if (onLine) {
              consume(pending);
              resolveResponse({ ok: true });
            } else {
              const data = JSON.parse(chunks.join(""));
              if (data.error) throw new Error(String(data.error).slice(0, 240));
              resolveResponse(data);
            }
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    const deadline = setTimeout(
      () =>
        req.destroy(new Error("Zeitlimit erreicht. Server und Modell prüfen.")),
      timeoutMs,
    );
    req.on("error", (e) =>
      reject(
        e.code === "ECONNREFUSED" || e.code === "ENOTFOUND"
          ? new Error(
              "Server nicht erreichbar. Anwendung starten und erneut prüfen.",
            )
          : e,
      ),
    );
    req.on("close", () => clearTimeout(deadline));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
