import { AppLoader } from './app-loader';
import {StepCount} from './step-count';
import './activity-motion.css';
import {DiffStats, DiffView} from './chat-artifacts.jsx';
import {activityDetailLabel} from './activity-detail.mjs';
import {motion} from './design-system.mjs';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { timestamp, workingDurationLabel, activityKind } from './chat-presentation.mjs';

import {Terminal, Globe, SquarePen, FileText, BrainCircuit, Image, GitBranch, Clock, Activity, ChevronRight} from './icons.jsx';

const activityIcons = {command: Terminal, web: Globe, browser: Globe, edit: SquarePen, read: FileText, reasoning: BrainCircuit, image: Image, agent: GitBranch, context: FileText, wait: Clock, tool: Activity};

const exampleChanges = [{path:'beispiel.txt',diff:'--- a/beispiel.txt\n+++ b/beispiel.txt\n@@ -1 +1,2 @@\n-Alte Beschreibung\n+Neue Beschreibung\n+Ein zusätzlicher Hinweis'}];
export function ActivityPreview() {
  const [running, setRunning] = useState(true), [open, setOpen] = useState(false), [detail, setDetail] = useState(false), [extra, setExtra] = useState(0);
  const items = [{id:'edit',type:'fileChange',status:'completed',changes:exampleChanges}, ...Array.from({length:extra},(_,n)=>({id:`test-${n}`,type:'commandExecution',status:'completed',command:'npm test'}))];
  const progressText = 'Ich passe die Abstände an und prüfe anschließend die Darstellung.';
  return <div>
    <div className="design-segments" role="group" aria-label="Arbeitsverlauf ausprobieren">
      <button type="button" disabled={!running} onClick={()=>setExtra(n=>n+1)}>Schritt hinzufügen</button>
      <button type="button" disabled={!running} onClick={()=>setRunning(false)}>Abschließen</button>
      <button type="button" onClick={()=>{setExtra(0);setRunning(true);setOpen(false);setDetail(false);}}>Zurücksetzen</button>
    </div>
    <p className={running ? 'muted' : undefined}>{running ? progressText : 'Die Abstände sind angepasst. Dies ist eine Beispielantwort.'}</p>
    <ActivityGroup items={items} running={running} visible turn={{status:running?'inProgress':'completed',durationMs:12000}} open={open} onOpenChange={setOpen}>
      {!running && <p className="muted" key="commentary">{progressText}</p>}
      {items.map(item=><details key={item.id} className="tool-item" open={item.id==='edit' ? detail : undefined} onToggle={event=>{if(item.id==='edit' && event.target===event.currentTarget)setDetail(event.currentTarget.open);}}>
        <summary><ActivityIcon item={item}/><span>{activityDetailLabel(item)}</span><DiffStats changes={item.changes || []} status={item.status}/><ChevronRight size={14}/></summary>
        {item.changes ? <DiffView diff={item.changes[0].diff}/> : <p className="muted">Beispiel eines abgeschlossenen Testaufrufs.</p>}
      </details>)}
    </ActivityGroup>
    <p className="page-note">Lokales Beispiel ohne Werkzeugausführung. Öffne den Verlauf und die Dateiänderung, dann schließe den Lauf ab: Deine geöffneten Details bleiben erhalten.</p>
  </div>;
}
export function ActivityIcon({item}) {
  const Icon = activityIcons[activityKind(item)] || Activity;
  return <Icon size={18} aria-hidden="true"/>;
}
function ActivityStep({id, seen, live, children}) {
  const [fresh, setFresh] = useState(() => live && !seen.has(id));
  useLayoutEffect(() => { seen.add(id); }, [id, seen]);
  useEffect(() => { if (!live) setFresh(false); }, [live]);
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(false), parseFloat(motion['activity-step-duration']));
    return () => clearTimeout(timer);
  }, [fresh]);
  return <div className="activity-step" data-new={fresh && live ? 'true' : 'false'} onAnimationEnd={event=>{if(event.target===event.currentTarget)setFresh(false);}}>{children}</div>;
}
export function ActivityGroup({items, running, children, turn, waiting, visible, open = false, onOpenChange, seenSteps}) {
  const localSeen = useRef(new Set());
  const tools = items.filter(item => item.type !== 'reasoning');
  const failed = items.filter(item => item.status === 'failed').length;
  const incomplete = !running && items.filter(item => item.status === 'inProgress').length;
  const count = tools.length || items.length;
  const lead = tools[0] || items[0];
  return <details className="activity-group" open={open} onToggle={event => {if (event.target === event.currentTarget) onOpenChange?.(event.currentTarget.open);}}>
    <summary>
      {!running && (lead ? <ActivityIcon item={lead}/> : <Clock size={14} aria-hidden="true"/>)}
      <TurnStatus turn={turn || {}} running={running} waiting={waiting} visible={visible} compact count={count}/>
      {!!failed && <span className="activity-failure-note"> · {failed} fehlgeschlagen</span>}
      {!!incomplete && <span className="activity-failure-note"> · {incomplete} ohne Abschluss</span>}
      <span className="activity-chevron"><ChevronRight size={14} aria-hidden="true"/></span>
    </summary>
    {open && <div className="activity-steps">{React.Children.toArray(children).map(child => <ActivityStep key={child.key} id={child.key} seen={seenSteps || localSeen.current} live={running && visible}>{child}</ActivityStep>)}</div>}
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
    {compact && <span>{count ? <><StepCount value={count} animate={awake}/> {count === 1 ? 'Schritt' : 'Schritte'}</> : 'Verlauf'}</span>}
    {elapsed != null && <span className="turn-duration">{compact ? '·' : running ? 'seit' : 'in'} {workingDurationLabel(elapsed)}</span>}
  </Tag>;
}
