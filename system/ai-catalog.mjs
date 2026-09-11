// Public discovery data only. A catalogue entry never grants account access.
export const aiCatalog = [
  {id:'codex', name:'OpenAI · GPT', program:'Codex', worker:'codex', kind:'cloud', package:'@openai/codex', command:'codex', source:'https://developers.openai.com/codex/cli/'},
  {id:'claw-code', name:'Anthropic · Claude', program:'Claude-Code-Anschluss', note:'Angezeigt wird die ACP-Adapterversion. Die native Claude-Code-Version ist davon unabhängig.', worker:'claw-code', kind:'cloud', package:'@agentclientprotocol/claude-agent-acp', command:'claude-agent-acp', source:'https://code.claude.com/docs/en/overview'},
  {id:'gemini', name:'Google · Gemini', program:'Gemini CLI', worker:'gemini', kind:'cloud', package:'@google/gemini-cli', command:'gemini', source:'https://geminicli.com/docs/'},
  {id:'kimi', name:'Moonshot · Kimi', program:'Kimi Code CLI', worker:'kimi', kind:'cloud', pypi:'kimi-cli', command:'kimi', source:'https://moonshotai.github.io/kimi-cli/en/guides/getting-started.html'},
  {id:'deepseek', name:'DeepSeek', kind:'cloud', source:'https://api-docs.deepseek.com/api/list-models', note:'Modelle über einen passenden KI-Zugang verwenden. Kein eigener CLI-Anschluss eingerichtet.'},
  {id:'qwen', name:'Alibaba · Qwen', kind:'cloud', source:'https://qwenlm.github.io/', note:'Auch als lokale Modelle erhältlich. Verfügbarkeit im lokalen Modellkatalog prüfen.'},
  {id:'hermes', name:'Hermes Agent', program:'Hermes Agent', worker:'hermes', kind:'agent', source:'https://hermes-agent.nousresearch.com/docs/getting-started/quickstart'},
  {id:'openclaw', name:'OpenClaw', program:'OpenClaw', worker:'openclaw', kind:'agent', package:'openclaw', command:'openclaw', source:'https://docs.openclaw.ai/cli/acp'},
  {id:'ollama', name:'Ollama', kind:'local', release:'ollama/ollama', source:'https://ollama.com/download'},
  {id:'lmstudio', name:'LM Studio', kind:'local', source:'https://lmstudio.ai/download', note:'Lokale Modelle und Programmupdates über LM Studio verwalten.'},
];
