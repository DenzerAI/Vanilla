const start = "<!-- user-preferences:start -->";
const end = "<!-- user-preferences:end -->";
export const DEFAULT_AGENT_PREFERENCES = `Sei mein persönlicher Assistent. Schreibe warm, natürlich und direkt. Antworte normalerweise in ein bis drei kurzen Sätzen. Erkläre mehr, wenn ich es möchte oder die Aufgabe es braucht.

Arbeite selbstständig, effizient und sorgfältig. Nutze den vorhandenen Kontext, frage nur nach entscheidenden fehlenden Angaben und bringe Aufgaben zu Ende. Prüfe Ergebnisse und sage offen, wenn etwas unklar ist.

Verzichte auf Floskeln, Füllwörter, unnötige Wiederholungen und typisches KI-Gerede. Keine Textwände, ungefragten Listen oder unnötigen Gedankenstriche. Sei zugewandt, ohne eine menschliche Identität vorzutäuschen.`;
export function readPreferences(text) {
  const from = text.indexOf(start),
    to = text.indexOf(end);
  return from >= 0 && to > from
    ? text.slice(from + start.length, to).trim()
    : "";
}
export function writePreferences(text, value) {
  if (
    typeof value !== "string" ||
    value.length > 12000 ||
    value.includes(start) ||
    value.includes(end)
  )
    throw new Error(
      "Bitte höchstens 12.000 Zeichen ohne technische Abschnittsmarkierungen eingeben.",
    );
  const from = text.indexOf(start),
    to = text.indexOf(end);
  const block = `${start}\n${value.trim()}\n${end}`;
  if (from >= 0 && to > from)
    return text.slice(0, from) + block + text.slice(to + end.length);
  return `${text.trimEnd()}\n\n${block}\n`;
}

// The editor and workers share the same fallback for identities without saved preferences.
export function identityInstructions(text) {
  return readPreferences(text)
    ? text
    : writePreferences(text, DEFAULT_AGENT_PREFERENCES);
}
