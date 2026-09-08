import {isComputerTool} from './tool-content.mjs';
import {workerName} from '../../system/worker-catalog.mjs';
import React, { useEffect, useRef, useState } from 'react';
import { timestamp, workingDurationLabel, activityKind, activityLabel } from './chat-presentation.mjs';

import {Terminal, Globe, SquarePen, FileText, BrainCircuit, Image, GitBranch, Clock, Activity, ChevronRight} from './icons.jsx';

const activityIcons = {command: Terminal, web: Globe, browser: Globe, edit: SquarePen, read: FileText, reasoning: BrainCircuit, image: Image, agent: GitBranch, context: FileText, wait: Clock, tool: Activity};
export function ActivityIcon({item}) {
  const Icon = activityIcons[activityKind(item)] || Activity;
  return <Icon size={18} aria-hidden="true"/>;
}
export function ActivityGroup({items, running, children, workerId, turn}) {
  const [open, setOpen] = useState(false);
  const tools = items.filter(i => i.type !== 'reasoning');
  const active = running && [...items].reverse().find(i => i.status === 'inProgress' && (i.type !== 'reasoning' || !tools.length));
  const failed = items.filter(i => i.status === 'failed').length;
  const incomplete = !running && items.filter(i => i.status === 'inProgress').length;
  const count = tools.length || items.length;
  const start = timestamp(turn?.startedAt), end = timestamp(turn?.completedAt);
  const elapsed = !running ? turn?.durationMs ?? (start != null && end != null ? end - start : null) : null;
  const lead = active || tools[0] || items[0];
  return <details className="activity-group" onToggle={event => {if (event.target === event.currentTarget) setOpen(event.currentTarget.open);}}>
    <summary>
      <ActivityIcon item={lead}/>
      <span className="activity-summary">
        {count} {count === 1 ? 'Schritt' : 'Schritte'}
        {active && ` · ${activityLabel(active, true)}`}
        {elapsed != null && ` · ${workingDurationLabel(elapsed)}`}
        {!!failed && <span className="activity-failure-note"> · {failed} fehlgeschlagen</span>}
        {!!incomplete && <span className="activity-failure-note"> · {incomplete} ohne Abschluss</span>}
      </span>
      {items.some(isComputerTool) && <span className="tool-provenance">{workerName(workerId || "codex")}</span>}
      <span className="activity-chevron"><ChevronRight size={14} aria-hidden="true"/></span>
    </summary>
    {open && <div className="activity-steps">{children}</div>}
  </details>;
}

// Keep the clock local: long transcripts must not rerender every second.
export function TurnStatus({ turn, running, waiting, visible = true, hasAnswer = false }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [running]);
  const awake = running && visible && inView;
  useEffect(() => {
    if (!awake) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [awake]);
  const start = timestamp(turn.startedAt), end = timestamp(turn.completedAt);
  const elapsed = running && start != null ? now - start : turn.durationMs ?? (start != null && end != null ? end - start : null);
  const label = running ? (waiting ? 'Wartet auf deine Antwort' : 'In Bearbeitung') : turn.status === 'failed' ? 'Bearbeitung fehlgeschlagen' : turn.status === 'interrupted' ? 'Bearbeitung gestoppt' : 'Bearbeitet';
  if (!running && turn.status === 'completed') return null;
  return <div ref={ref} className={`turn-meta turn-progress${running ? ' working' : ''}`}>
    <span className="turn-status-label" role="status" aria-live="polite" aria-atomic="true">{label}</span>
    {elapsed != null && <span className="turn-duration">{running ? 'seit' : 'in'} {workingDurationLabel(elapsed)}</span>}
  </div>;
}
