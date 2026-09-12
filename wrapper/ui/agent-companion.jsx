import React, { useEffect, useRef, useState } from "react";
import { Avatar } from "./avatar.jsx";
import { ChatMenu } from "./chat-controls.jsx";
import { X } from "./icons.jsx";
import { companionSet } from "./companion-state.mjs";
import { activeNotes, noteText } from "./companion-notes.mjs";

const CALL_FRESH_MS = 3000;
const quiet = new Set(["ruhe", "spielt", "isst", "tanzt", "nickt", "schlaeft", "laeuft"]);

/** Die Figur oben links auf der Schreibzeile. Sie hält ihre Uhr selbst,
 *  damit der Sekundentakt nicht das ganze Gespräch neu zeichnet. */
export function AgentCompanion({ avatar, color, name, chatId, running, waiting, busy, connection, activity, lastTurnStatus, hasTurns, hidden = false,
  notes = [], chatTitle = () => "", onOpenNote, onDismissNote, onPick, onHide }) {
  const [now, setNow] = useState(() => Date.now());
  const marks = useRef({ activity: Date.now(), waitingSince: null, completedAt: null, wasRunning: false });
  useEffect(() => {
    marks.current.activity = Date.now();
  }, [chatId, running, waiting, busy, activity, lastTurnStatus]);
  useEffect(() => {
    const m = marks.current;
    if (waiting) m.waitingSince ??= Date.now();
    else m.waitingSince = null;
  }, [waiting]);
  useEffect(() => {
    const m = marks.current;
    if (m.wasRunning && !running) m.completedAt = lastTurnStatus === "completed" ? Date.now() : null;
    m.wasRunning = running;
    setNow(Date.now());
  }, [running, lastTurnStatus]);
  useEffect(() => {
    marks.current = { activity: Date.now(), waitingSince: waiting ? Date.now() : null, completedAt: null, wasRunning: running };
    setNow(Date.now());
  }, [chatId]);
  useEffect(() => {
    const bump = () => { marks.current.activity = Date.now(); setNow(Date.now()); };
    document.addEventListener("keydown", bump, { passive: true });
    document.addEventListener("pointerdown", bump, { passive: true });
    return () => {
      document.removeEventListener("keydown", bump);
      document.removeEventListener("pointerdown", bump);
    };
  }, []);
  useEffect(() => {
    if (hidden) return;
    const timer = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => clearInterval(timer);
  }, [hidden]);
  if (hidden) return null;
  const live = activeNotes(notes, now);
  const note = live.at(-1);
  const fresh = note && now - note.at < CALL_FRESH_MS;
  let set = companionSet({
    connection, busy, running, activity, lastTurnStatus, hasTurns, now,
    waitingSince: marks.current.waitingSince,
    completedAt: marks.current.completedAt,
    idleMs: now - marks.current.activity,
  });
  if (fresh && quiet.has(set)) set = "ruft";
  const label = name?.trim() || "Figur";
  const items = [
    note && { id: "note", label: noteText(note, chatTitle(note)), action: () => onOpenNote?.(note) },
    { id: "pick", label: "Figur wechseln", action: () => onPick?.() },
    { id: "hide", label: "Figur ausblenden", action: () => onHide?.() },
  ].filter(Boolean);
  return (
    <span className="composer-companion" data-companion-set={set}>
      <ChatMenu label={`${label} · Figur`} className="composer-companion-trigger" menuClassName="composer-companion-menu" placement="above" items={items}>
        <Avatar avatar={avatar} color={color} set={set} stage />
      </ChatMenu>
      {note && (
        <span className="companion-bubble" role="status">
          <button type="button" className="companion-bubble-open" onClick={() => onOpenNote?.(note)}>
            {noteText(note, chatTitle(note))}
            {live.length > 1 && <small> und {live.length - 1} weitere</small>}
          </button>
          <button type="button" className="companion-bubble-close" aria-label="Meldung schließen" onClick={() => onDismissNote?.(note.id)}>
            <X size={14} strokeWidth={1.8} />
          </button>
        </span>
      )}
    </span>
  );
}
