import { ArrowUpRight, BrainCircuit, FileText, FolderOpen } from "./icons.jsx";

const suggestions = [
  {
    Icon: FileText,
    label: "Datei zusammenfassen",
    prompt: "Lies input/beispiel.md und fasse die nächsten Schritte kurz zusammen.",
  },
  {
    Icon: BrainCircuit,
    label: "Gemeinsam planen",
    prompt: "Lass uns einen Arbeitsablauf planen. Stelle mir zuerst eine gezielte Frage.",
  },
  {
    Icon: FolderOpen,
    label: "Projekt erkunden",
    prompt: "Zeige mir die Ordnerstruktur dieses Projekts und erkläre sie kurz.",
  },
];

export function WelcomeSuggestions({ onSelect, disabled = false }: {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="suggestions" role="group" aria-label="Vorschläge für einen neuen Chat">
      {suggestions.map(({ Icon, label, prompt }) => (
        <button className="suggestion" type="button" key={label} disabled={disabled} onClick={() => onSelect(prompt)}>
          <span className="suggestion-content">
            <Icon size={15} strokeWidth={undefined} aria-hidden="true" />
            <span className="suggestion-label">{label}</span>
            <ArrowUpRight className="suggestion-arrow" size={12} strokeWidth={undefined} aria-hidden="true" />
          </span>
        </button>
      ))}
    </div>
  );
}
