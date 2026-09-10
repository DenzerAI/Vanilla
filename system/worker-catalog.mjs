// Adapter names describe protocols. Adding another ACP worker needs only a catalog entry.
export const workerCatalog = [
  {id:"gemini", name:"Gemini CLI", adapter:"acp", command:"gemini", args:["--acp"], env:"UWE_GEMINI_BINARY", description:"Google Gemini · Aufgaben und Werkzeuge", installURL:"https://geminicli.com/docs/"},
  {id:"kimi", name:"Kimi Code CLI", adapter:"acp", command:"kimi", args:["acp"], env:"UWE_KIMI_BINARY", description:"Moonshot Kimi · Aufgaben und Werkzeuge", installURL:"https://moonshotai.github.io/kimi-cli/en/guides/getting-started.html"},
  { id: "codex", name: "Codex", adapter: "codex", command: "codex", args: [], env: "UWE_CODEX_BINARY", description: "Aufgaben, Dateien und Werkzeuge", installURL: "https://developers.openai.com/codex/cli/" },
  { id: "hermes", name: "Hermes Agent", adapter: "acp", command: "hermes", args: ["acp"], env: "UWE_HERMES_BINARY", description: "Aufgaben, Dateien und Werkzeuge", installURL: "https://hermes-agent.nousresearch.com/docs/getting-started/quickstart" },
  { id: "openclaw", name: "OpenClaw", adapter: "acp", command: "openclaw", args: ["acp"], env: "UWE_OPENCLAW_BINARY", description: "Aufgaben über den eigenen Gateway", installURL: "https://docs.openclaw.ai/cli/acp" },
  { id: "claw-code", name: "Claude Code", adapter: "acp", command: "claude-agent-acp", args: [], env: "UWE_CLAW_CODE_BINARY", description: "Claude Code von Anthropic · mitgelieferter ACP-Adapter", installURL: "https://code.claude.com/docs/en/overview" },
];
workerCatalog.push(...workerCatalog.splice(0, 2));
export const workerName = id => id === "auto" ? "Automatisch" : id === "python" ? "Python" : id === "n8n" ? "n8n" : workerCatalog.find(w => w.id === id)?.name || id;
export const validJobWorker = id => ["auto", "n8n", "python"].includes(id) || workerCatalog.some(w => w.id === id);
