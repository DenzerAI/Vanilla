import { activityKind } from "./chat-presentation.mjs";

// Zustände der Figur auf der Schreibzeile. Ruhe läuft immer; alle anderen
// zeigen den echten Sitzungsstand und fallen danach in Ruhe zurück.
export const companionSets = [
  ["ruhe", "Ruhe"],
  ["denkt", "Denkt"],
  ["arbeitet", "Arbeitet"],
  ["liest", "Liest"],
  ["jongliert", "Jongliert"],
  ["fegt", "Fegt"],
  ["fertig", "Fertig"],
  ["tanzt", "Tanzt"],
  ["ruft", "Ruft"],
  ["wartet", "Wartet auf dich"],
  ["spielt", "Spielt"],
  ["isst", "Isst"],
  ["fehler", "Fehler"],
  ["krank", "Krank"],
  ["nickt", "Nickt ein"],
  ["schlaeft", "Schläft"],
  ["laeuft", "Läuft"],
];
export const companionSetLabel = (id) => companionSets.find(([key]) => key === id)?.[1] || "Ruhe";

export const DONE_MS = 2500;
export const CALL_MS = 60_000;
export const NOD_MS = 5 * 60_000;
export const SLEEP_MS = 10 * 60_000;

const working = { reasoning: "denkt", wait: "denkt", read: "liest", web: "liest", context: "fegt", agent: "jongliert" };

// Welche Tätigkeit der laufende Turn gerade zeigt: das jüngste Element zählt.
export function latestActivity(thread, turnId) {
  const turn = thread?.turns?.find((t) => t.id === turnId);
  const item = turn?.items?.at(-1);
  if (!item) return null;
  if (item.type === "agentMessage" || item.type === "plan") return "message";
  return activityKind(item);
}

export function companionSet({ connection, waitingSince, busy, running, activity, completedAt, lastTurnStatus, hasTurns, idleMs, now = Date.now() }) {
  if (connection === "offline") return "krank";
  if (waitingSince != null) return now - waitingSince >= CALL_MS ? "wartet" : "ruft";
  if (busy && !running) return "denkt";
  if (running) return working[activity] || "arbeitet";
  if (completedAt != null && now - completedAt < DONE_MS) return "fertig";
  if (lastTurnStatus === "failed") return "fehler";
  if (idleMs >= SLEEP_MS) return "schlaeft";
  if (idleMs >= NOD_MS) return "nickt";
  // Brief idle interludes, separated by rest; never mask a session state.
  const phase = Math.floor(Math.max(0, idleMs) / 1000) % 120;
  if (!hasTurns && idleMs < 4000) return "laeuft";
  if (phase >= 40 && phase < 48) return "spielt";
  if (phase >= 80 && phase < 88) return "isst";
  if (phase >= 112) return "tanzt";
  return "ruhe";
}
