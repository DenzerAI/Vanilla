import React, { useEffect, useRef, useState } from "react";
import { Avatar } from "./avatar.jsx";
import { companionSet } from "./companion-state.mjs";

/** Die Figur oben links auf der Schreibzeile. Sie hält ihre Uhr selbst,
 *  damit der Sekundentakt nicht das ganze Gespräch neu zeichnet. */
export function AgentCompanion({ avatar, color, chatId, running, waiting, busy, connection, activity, lastTurnStatus, hasTurns, hidden = false }) {
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
    marks.current.completedAt = null;
  }, [chatId]);
  useEffect(() => {
    const bump = () => { marks.current.activity = Date.now(); };
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
  const set = companionSet({
    connection, busy, running, activity, lastTurnStatus, hasTurns, now,
    waitingSince: marks.current.waitingSince,
    completedAt: marks.current.completedAt,
    idleMs: now - marks.current.activity,
  });
  return (
    <span className="composer-companion" data-companion-set={set}>
      <Avatar avatar={avatar} color={color} set={set} stage />
    </span>
  );
}
