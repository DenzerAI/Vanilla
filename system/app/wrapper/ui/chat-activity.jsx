import { AppLoader } from './app-loader';
import React, { useEffect, useRef, useState } from 'react';
import { timestamp, workingDurationLabel, activityKind } from './chat-presentation.mjs';

import {Terminal, Globe, SquarePen, FileText, BrainCircuit, Image, GitBranch, Clock, Activity, ChevronRight} from './icons.jsx';

const activityIcons = {command: Terminal, web: Globe, browser: Globe, edit: SquarePen, read: FileText, reasoning: BrainCircuit, image: Image, agent: GitBranch, context: FileText, wait: Clock, tool: Activity};
export function ActivityIcon({item}) {
  const Icon = activityIcons[activityKind(item)] || Activity;
  return <Icon size={18} aria-hidden="true"/>;
}
export function ActivityGroup({items, running, children, turn, waiting, visible}) {
  const [open, setOpen] = useState(false);
  // A finished response leaves a single quiet disclosure, even if it was open live.
  useEffect(() => { if (!running) setOpen(false); }, [running]);
  const tools = items.filter(item => item.type !== 'reasoning');
  const failed = items.filter(item => item.status === 'failed').length;
  const incomplete = !running && items.filter(item => item.status === 'inProgress').length;
  const count = tools.length || items.length;
  const lead = tools[0] || items[0];
  return <details className="activity-group" open={open} onToggle={event => {if (event.target === event.currentTarget) setOpen(event.currentTarget.open);}}>
    <summary>
      {!running && (lead ? <ActivityIcon item={lead}/> : <Clock size={14} aria-hidden="true"/>)}
      <TurnStatus turn={turn || {}} running={running} waiting={waiting} visible={visible} compact count={count}/>
      {!!failed && <span className="activity-failure-note"> · {failed} fehlgeschlagen</span>}
      {!!incomplete && <span className="activity-failure-note"> · {incomplete} ohne Abschluss</span>}
      <span className="activity-chevron"><ChevronRight size={14} aria-hidden="true"/></span>
    </summary>
    {open && <div className="activity-steps">{children}</div>}
  </details>;
}

// Keep the clock local: long transcripts must not rerender every second.
export function TurnStatus({ turn, running, waiting, visible = true, compact = false, count = 0 }) {
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
  if (!running && turn.status === 'completed' && !compact) return null;
  const Tag = compact ? 'span' : 'div';
  return <Tag ref={ref} className={compact ? "turn-activity-status" : `turn-meta turn-progress${running ? ' working' : ''}`}>
    {running && !waiting && <AppLoader size={16} preview />}
    {(running || !compact || ['failed', 'interrupted'].includes(turn.status)) && <span className="turn-status-label" role="status" aria-live="polite" aria-atomic="true">{label}</span>}
    {compact && <span>{count ? `${count} ${count === 1 ? 'Schritt' : 'Schritte'}` : 'Verlauf'}</span>}
    {elapsed != null && <span className="turn-duration">{compact ? '·' : running ? 'seit' : 'in'} {workingDurationLabel(elapsed)}</span>}
  </Tag>;
}
