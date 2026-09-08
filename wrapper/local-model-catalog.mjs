// Tags and download sizes checked against the linked Ollama catalog on 2026-09-07.
// RAM estimates reserve room for a 4K text context; they are not speed guarantees.
const GiB = 1024 ** 3;
export const localModelCatalogDate = "2026-09-07";
export const localModels = [
  { id: "qwen3.5:0.8b", name: "Qwen 3.5 · 0,8B", bytes: 1e9, memory: 2.5 * GiB },
  { id: "qwen3.5:2b", name: "Qwen 3.5 · 2B", bytes: 2.7e9, memory: 4.5 * GiB },
  { id: "qwen3.5:4b", name: "Qwen 3.5 · 4B", bytes: 3.4e9, memory: 6 * GiB },
  { id: "qwen3.5:9b", name: "Qwen 3.5 · 9B", bytes: 6.6e9, memory: 11 * GiB },
  { id: "gemma4:e2b-it-qat", name: "Gemma 4 · E2B QAT", bytes: 4.3e9, memory: 7 * GiB },
  { id: "gemma4:e4b", name: "Gemma 4 · E4B", bytes: 9.6e9, memory: 14 * GiB },
  { id: "llama3.2:1b", name: "Llama 3.2 · 1B", bytes: 1.3e9, memory: 2.5 * GiB },
  { id: "llama3.2:3b", name: "Llama 3.2 · 3B", bytes: 2e9, memory: 4 * GiB },
  { id: "qwen3:0.6b", name: "Qwen 3 · 0,6B", bytes: 523e6, memory: 1.5 * GiB },
  { id: "qwen3:1.7b", name: "Qwen 3 · 1,7B", bytes: 1.4e9, memory: 3 * GiB },
  { id: "qwen3:4b", name: "Qwen 3 · 4B", bytes: 2.5e9, memory: 5 * GiB },
  { id: "qwen3:8b", name: "Qwen 3 · 8B", bytes: 5.2e9, memory: 9 * GiB },
].map(m => ({ ...m, url: `https://ollama.com/library/${m.id}` }));
