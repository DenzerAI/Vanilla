import React, { useState } from "react";
import { ChatMenu } from "./chat-controls.jsx";
import { ChevronDown } from "./icons.jsx";
import "./worker-session-controls.css";

type Choice = { value: string; name: string; description?: string; options?: Choice[] };
type Config = { id: string; name: string; type: string; description?: string; currentValue: string; options?: Choice[] };
type Session = {
  availableCommands?: { name: string; description?: string; input?: { hint: string } }[];
  configOptions?: Config[];
  modes?: { currentModeId: string; availableModes?: { id: string; name: string; description?: string }[] };
  unsupportedUpdates?: string[];
};
export function WorkerSessionControls({ session, disabled, onCommand, onChange, onError }: {
  session: Session; disabled: boolean; onCommand: (text: string) => void;
  onChange: (change: { configId?: string; value?: string; modeId?: string }) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const change = async (value: { configId?: string; value?: string; modeId?: string }) => {
    setPending(true);
    try { await onChange(value); }
    catch (error) { onError(error instanceof Error ? error.message : "Sitzungseinstellung konnte nicht geändert werden."); }
    finally { setPending(false); }
  };
  const commands = session.availableCommands;
  const configs = session.configOptions;
  return <span className="worker-session-controls">
    <ChatMenu selected={undefined} label="Worker-Befehle" className="mode-trigger" placement="above" disabled={disabled || pending}
      items={(commands || []).map(c => ({ id: c.name, label: `/${c.name}`, detail: [c.description, c.input?.hint].filter(Boolean).join(" · "), action: () => onCommand(`/${c.name}${c.input ? " " : ""}`) }))}
      footer={commands === undefined ? "Der Worker hat noch keine Befehle gemeldet. Manuelle Eingabe bleibt möglich." : commands.length === 0 ? "Der Worker meldet aktuell keine Befehle." : "Auswahl übernimmt den Befehl in den Entwurf."}>
      <span>/</span><ChevronDown size={14} strokeWidth={undefined} />
    </ChatMenu>
    {configs?.map(option => <ChatMenu key={option.id} label={`Sitzung: ${option.name}`} className="mode-trigger" placement="above"
      disabled={disabled || pending} selected={option.currentValue}
      items={option.type === "select" ? (option.options || []).flatMap(group => group.options || [group]).map(value => ({
        id: value.value, label: value.name, detail: value.description, action: () => void change({ configId: option.id, value: value.value }),
      })) : []}
      footer={option.type === "select" ? option.description : `Optionstyp „${option.type}“ hier noch nicht bedienbar. Der native Wert bleibt erhalten.`}>
      <span>{option.name}: {option.options?.flatMap(group => group.options || [group]).find(value => value.value === option.currentValue)?.name || String(option.currentValue)}</span><ChevronDown size={14} strokeWidth={undefined} />
    </ChatMenu>)}
    {configs === undefined && session.modes?.availableModes?.length ? <ChatMenu label="Nativer Sitzungsmodus" className="mode-trigger" placement="above"
      disabled={disabled || pending} selected={session.modes.currentModeId}
      items={session.modes.availableModes.map(mode => ({ id: mode.id, label: mode.name, detail: mode.description, action: () => void change({modeId: mode.id}) }))}
      footer="Modus des Workers; kein zusätzlicher Schreibschutz durch Vanilla.">
      <span>Sitzungsmodus</span><ChevronDown size={14} strokeWidth={undefined} />
    </ChatMenu> : null}
    {!!session.unsupportedUpdates?.length && <ChatMenu selected={undefined} label="Nicht dargestellte Worker-Updates" className="mode-trigger" placement="above"
      items={session.unsupportedUpdates.map(type => ({id: type, label: type, disabled: true, action: () => {}}))}
      footer="Diese Updatearten werden hier noch nicht ausgewertet. Das Ergebnis kann zusätzliche native Inhalte enthalten.">
      <span>Worker-Hinweise</span><ChevronDown size={14} strokeWidth={undefined} />
    </ChatMenu>}
  </span>;
}
