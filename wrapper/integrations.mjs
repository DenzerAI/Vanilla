import { connectionCatalog, connectionCategories } from './ui/connection-catalog.mjs';
import { safeRequest } from "./safe-request.mjs";
import { CrmConnections } from "./crm-connections.mjs";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { safeName, jsonFile } from "./storage.mjs";
import path from "node:path";
const exec = promisify(execFile);
const unavailable = () => {throw new Error("System-Schlüsselbund ist in der isolierten Vanilla-Basis deaktiviert.");};
export async function saveSecret(id, value) { unavailable(); }
export async function readSecret(id) { unavailable(); }
export async function hasSecret(id) { return false; }
export async function deleteSecret(id) { unavailable(); }
const providerSecrets = [
  { id: "dictation-groq", name: "Groq", file: "dictation-settings.json", flag: "groq" },
  { id: "speech-elevenlabs", name: "ElevenLabs", file: "speech-settings.json", flag: "elevenlabs" },
];
const providerSecret = id => providerSecrets.find(s => s.id === id);
const systemSecrets = [{id:'system-access',name:'System · Anmeldung'}, {id:'system-api',name:'System · Lokale Werkzeuge'}, {id:'system-backup',name:'System · Sicherung'}];
const systemSecret = id => systemSecrets.some(s=>s.id===id) || /^system-backup-[a-f0-9]{12}$/.test(id);

// One keychain and one metadata index for connections and Settings → Secrets.
export function createSecretStore(store, keychain = { save: saveSecret, read: readSecret, has: hasSecret, remove: deleteSecret }) {
  let writes = Promise.resolve();
  const exclusive = fn => {
    const run = writes.catch(() => {}).then(fn);
    writes = run;
    return run;
  };
  return {
    exclusive,
    read: id => keychain.read(safeName(id)),
    async save(id, value, name, {format} = {}) {
      safeName(id);
      if(systemSecret(id)) throw new Error('Systemschlüssel über Zugang oder Speicher & Sicherung verwalten.');
      if (format !== undefined && format !== 'crm-credentials') throw new Error('Unbekanntes Secret-Format.');
      await keychain.save(id, value);
      const entry = { id, name: providerSecret(id)?.name || String(name || id).slice(0, 100), updatedAt: new Date().toISOString(), ...(format ? {format} : {}) };
      const previous = store.state.secrets;
      store.state.secrets = previous.filter(s => s.id !== id).concat(entry);
      try { await store.save(); } catch (error) { store.state.secrets = previous; throw error; }
      return entry;
    },
    list: () => exclusive(async () => {
      if(process.env.AGENT_CORE_URL) {
        const latest=await jsonFile(path.join(store.dataRoot,'state.json'),{secrets:[]});
        const protectedEntries=latest.secrets.filter(s=>s.system);
        store.state.secrets=store.state.secrets.filter(s=>!protectedEntries.some(p=>p.id===s.id)).concat(protectedEntries);
      }
      // Adopt keys saved by older voice integrations, including disconnected ones.
      const missing = [];
      for (const provider of [...providerSecrets,...systemSecrets]) {
        if (!store.state.secrets.some(s => s.id === provider.id) && await keychain.has(provider.id))
          missing.push({ id: provider.id, name: provider.name, ...(systemSecret(provider.id)?{system:true}:{}) });
      }
      if (missing.length) {
        const previous = store.state.secrets;
        store.state.secrets = previous.concat(missing);
        try { await store.save(); } catch (error) { store.state.secrets = previous; throw error; }
      }
      return store.state.secrets.map(s => ({ ...s, provider: providerSecret(s.id)?.name || null }));
    }),
    async remove(id) {
      safeName(id);
      if(systemSecret(id)) throw new Error('Dieser Schlüssel schützt Anmeldung oder Sicherungen und bleibt im Systemtresor.');
      if (store.state.connections.some(c => c.secretId === id))
        throw new Error("Der Schlüssel wird noch von einer Verbindung verwendet.");
      const provider = providerSecret(id);
      if (provider && (await jsonFile(path.join(store.dataRoot, provider.file), {}))[provider.flag])
        throw new Error(`Bitte zuerst die ${provider.name}-Verbindung entfernen.`);
      await keychain.remove(id);
      store.state.secrets = store.state.secrets.filter(s => s.id !== id);
      await store.save();
      return { ok: true };
    },
  };
}
export async function invokeConnection(store, id, payload, recordBoundary, networkPolicy = {}) {
  const c = store.state.connections.find((c) => c.id === id);
  if (!c) throw new Error("Verbindung nicht gefunden.");
  if (c.kind !== "webhook")
    throw new Error("Diese Verbindung unterstützt keine Workflow-Ausführung.");
  const headers = { "content-type": "application/json" };
  if (c.secretId)
    headers.authorization = "Bearer " + (await readSecret(c.secretId));
  await recordBoundary("connector", {
    connectionId: id,
    payloadBytes: JSON.stringify(payload).length,
  }, {text: JSON.stringify(payload)});
  const response = await safeRequest(c.url, {
    internalUrls: String(process.env.UWE_INTERNAL_URLS || "").split("\n").filter(Boolean),
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    timeoutMs: 60000,
    ...networkPolicy,
  });
  if (!response.ok) throw new Error(`Workflow meldet HTTP ${response.status}.`);
  const text = await response.text();
  return { status: response.status, output: text.slice(0, 100000) };
}
export async function installIntegrationRoutes({
  route,
  store,
  recordBoundary,
  secrets = createSecretStore(store),
  request = safeRequest,
}) {
  const crm = new CrmConnections({store, secrets, request});
  route("POST", "/api/secrets/save", b => secrets.exclusive(async () => {
    const id = b.id ? safeName(b.id) : "secret-" + randomUUID().slice(0, 8);
    if (providerSecret(id) || store.state.connections.some(c=>['service','crm'].includes(c.kind)&&c.secretId===id)) throw new Error("Diesen API-Schlüssel bitte über die zugehörige Verbindung prüfen und ersetzen.");
    return secrets.save(id, b.value, b.name);
  }));
  route("POST", "/api/secrets/delete", b => secrets.exclusive(() => secrets.remove(b.id)));
  route("POST", "/api/connections/save", b => secrets.exclusive(async () => {
    if (b.kind === 'crm') return crm.save(b);
    if (store.state.connections.some(c => c.id === b.id && c.kind === 'crm')) throw Error('Den CRM-Anschluss über seinen Verbindungsdialog bearbeiten.');
    if(store.state.connections.some(c=>c.id===b.id&&c.kind==='service'))throw Error('Diesen Anschluss über seinen Verbindungsdialog bearbeiten.');
    const url = new URL(b.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("HTTP(S)-Adresse ohne Zugangsdaten erforderlich.");
    if (!b.secretValue && b.secretId && !store.state.secrets.some((s) => s.id === b.secretId))
      throw new Error("Secret nicht gefunden.");
    if (!b.secretValue && store.state.secrets.some(s => s.id === b.secretId && s.format === 'crm-credentials'))
      throw new Error('CRM-Zugangsdaten können nicht als Bearer-Token verwendet werden.');
    const existing = store.state.connections.find(c=>c.id===b.id);
    const provider = b.provider || existing?.provider || connectionCatalog.find(c=>['webhook','link'].includes(c.kind)&&c.name===existing?.name)?.provider;
    if (provider && !connectionCatalog.some(c=>['webhook','link'].includes(c.kind)&&c.provider===provider)) throw Error('Unbekannter Dienst.');
    const category = b.category || existing?.category || connectionCatalog.find(c=>c.provider===provider)?.category || 'automation';
    if (!connectionCategories.some(c=>c.id===category)) throw Error('Unbekannte Verbindungskategorie.');
    const entry = {
      provider, category,
      id: b.id ? safeName(b.id) : "connection-" + randomUUID().slice(0, 8),
      name: String(b.name || "Verbindung").slice(0, 100),
      kind: b.kind === "webhook" ? "webhook" : "link",
      url: url.href,
      secretId: b.secretId || null,
      updatedAt: new Date().toISOString(),
    };
    if (b.secretValue) {
      // New tokens get their own reference; never overwrite a shared secret.
      const secret = await secrets.save("secret-" + randomUUID().slice(0, 8), b.secretValue, entry.name + " · Bearer-Token");
      entry.secretId = secret.id;
    }
    const previous = store.state.connections;
    store.state.connections = store.state.connections
      .filter((c) => c.id !== entry.id)
      .concat(entry);
    try { await store.save(); } catch (error) { store.state.connections = previous; throw error; }
    return entry;
  }));
  route("POST", "/api/connections/delete", b => secrets.exclusive(async () => {
    if(store.state.connections.some(c=>c.id===b.id&&c.kind==='service'))throw Error('Diesen Anschluss über seinen Verbindungsdialog entfernen.');
    if ((await store.jobs()).some((j) => j.connectionId === b.id))
      throw new Error("Diese Verbindung wird von einem Job verwendet.");
    store.state.connections = store.state.connections.filter(
      (c) => c.id !== b.id,
    );
    await store.save();
    return { ok: true };
  }));
  route("POST", "/api/connections/test", async (b) => {
    const c = store.state.connections.find((c) => c.id === b.id);
    if (!c) throw new Error("Verbindung nicht gefunden.");
    if (c.kind === 'crm') return crm.check(c.id);
    const r = await safeRequest(c.url, {
    internalUrls: String(process.env.UWE_INTERNAL_URLS || "").split("\n").filter(Boolean),
      method: "HEAD",
      timeoutMs: 10000,
    });
    return {
      status: r.status,
      message: `Server antwortet mit HTTP ${r.status}. Es wurde kein Workflow gestartet.`,
    };
  });
}
