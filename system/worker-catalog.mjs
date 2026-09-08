// Adapter names describe protocols. Adding another ACP worker needs only a catalog entry.
// `login` names the host-side command that creates the account the worker reuses.
export const workerCatalog = [
  { id: "codex", name: "Codex", adapter: "codex", command: "codex", args: [], env: "UWE_CODEX_BINARY", login: "codex login", description: "Aufgaben, Dateien und Werkzeuge", installURL: "https://developers.openai.com/codex/cli/" },
  { id: "hermes", name: "Hermes Agent", adapter: "acp", command: "hermes", args: ["acp"], env: "UWE_HERMES_BINARY", description: "Aufgaben, Dateien und Werkzeuge", installURL: "https://hermes-agent.nousresearch.com/docs/getting-started/quickstart" },
  { id: "openclaw", name: "OpenClaw", adapter: "acp", command: "openclaw", args: ["acp"], env: "UWE_OPENCLAW_BINARY", description: "Aufgaben über den eigenen Gateway", installURL: "https://docs.openclaw.ai/cli/acp" },
  { id: "claw-code", name: "Claude Code", adapter: "acp", command: "claude-agent-acp", args: [], env: "UWE_CLAW_CODE_BINARY", login: "claude login", description: "Claude Code von Anthropic · mitgelieferter ACP-Adapter", installURL: "https://code.claude.com/docs/en/overview" },
];
export const workerName = id => id === "auto" ? "Automatisch" : id === "python" ? "Python" : id === "n8n" ? "n8n" : workerCatalog.find(w => w.id === id)?.name || id;
export const validJobWorker = id => ["auto", "n8n", "python"].includes(id) || workerCatalog.some(w => w.id === id);
export const loginHint = ({ name = "Worker", login = null } = {}) => login
  ? `${name} ist auf diesem Rechner nicht angemeldet. Im Terminal „${login}“ ausführen und danach unter Einstellungen → Worker neu verbinden.`
  : `${name} meldet keine gültige Anmeldung. Konto im Worker einrichten und danach neu verbinden.`;
