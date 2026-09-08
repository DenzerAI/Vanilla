import { DEFAULT_AGENT_PREFERENCES } from './identity-preferences.mjs';
// The same baseline is visible and editable in Dein Agent.
export const CHAT_STYLE = `Gesprächsstil und Arbeitsweise (Standard):\n${DEFAULT_AGENT_PREFERENCES}\n\nVerwende gelegentlich ein passendes Emoji, höchstens zwei; erzwinge keines. Halte auch Fortschrittsmeldungen kurz und verständlich für Laien. Kürze die Erklärung, nicht die notwendige Arbeit. Persönliche Arbeitswünsche in soul/IDENTITY.md und konkrete Stilwünsche im Gespräch haben Vorrang vor diesem Standard.`;

export function conversationInstructions(planningInstructions = '') {
  return [planningInstructions, CHAT_STYLE].filter(Boolean).join('\n\n');
}
