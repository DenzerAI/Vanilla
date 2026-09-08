import path from "node:path";

export const coreEnabled = Boolean(process.env.AGENT_CORE_URL);
const controlFiles = new Set(["state.json", "workers.json", "library.json", "channels.json", "local-workers.json", "speech-settings.json", "dictation-settings.json"]);

export function recordKey(file) {
  if (!coreEnabled) return null;
  const data = path.resolve(process.env.UWE_DATA_ROOT);
  const workspace = path.resolve(process.env.UWE_WORKSPACE);
  const control = path.relative(data, file);
  if (controlFiles.has(control)) return "control/" + control;
  const relative = path.relative(workspace, file).split(path.sep).join("/");
  if (/^(chats\/[a-zA-Z0-9_-]+\/(transcript|tools)\.json|projects\/[a-zA-Z0-9_-]+\/project\.json|jobs\/[a-zA-Z0-9_-]+\/runs\/[a-zA-Z0-9_-]+\/(request|result)\.json)$/.test(relative)) return "workspace/" + relative;
  return null;
}

export async function coreRequest(endpoint, body) {
  if (!coreEnabled) return null;
  const response = await fetch(process.env.AGENT_CORE_URL + "/internal/" + endpoint, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-agent-internal": process.env.AGENT_INTERNAL_TOKEN },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Python-Kern nicht erreichbar.");
  return result;
}

export async function routedContext({query,projectId,chatId}) {
  if (!coreEnabled || !query?.trim()) return "";
  const result = await coreRequest("context", {query:query.slice(0,20000),projectId,chatId});
  if (!result.sources.length) return "";
  // Retrieved documents are untrusted data, separated from actual worker rules.
  return "\n\n" + result.instructions + "\nKontextauswahl: " + result.id + "\n" + JSON.stringify(result.sources);
}
