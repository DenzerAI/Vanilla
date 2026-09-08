"use client";
import * as React from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { cn } from "../../lib/utils";
import { scrubberSprings } from "../../design-system.mjs";

export interface Chapter { id: string; title: string; description?: React.ReactNode; meta?: React.ReactNode }
export interface ChapterScrubberProps {
  chapters: Chapter[]; currentIndex?: number; onSelect?: (chapter: Chapter, index: number) => void;
  onActiveChange?: (chapter: Chapter | null, index: number) => void;
  side?: "left" | "right"; peakLength?: number; restLength?: number; rowHeight?: number; radius?: number;
  label?: string; className?: string; reduceMotion?: boolean;
}
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
function Tick({ index, pointer, strength, radius, rest, peak, current }: { index: number; pointer: MotionValue<number>; strength: MotionValue<number>; radius: number; rest: number; peak: number; current: boolean }) {
  const rise = () => strength.get() * .5 * (1 + Math.cos(Math.PI * Math.min(1, Math.abs(index - pointer.get()) / radius)));
  const scaleX = useTransform(() => 1 + rise() * (peak / rest - 1));
  const opacity = useTransform(() => (current ? .85 : .45) + rise() * (current ? .15 : .55));
  const scaleY = useTransform(() => 1 + rise() * .4);
  return <motion.span aria-hidden="true" className="chapter-tick" style={{ width: rest, scaleX, scaleY, opacity }} />;
}
export function ChapterScrubber({ chapters, currentIndex, onSelect, onActiveChange, side = "right", peakLength = 36, restLength = 9, rowHeight = 12, radius = 4, label = "Deine bisherigen Eingaben", className, reduceMotion = false }: ChapterScrubberProps) {
  const systemReduced = useReducedMotion();
  const raw = useMotionValue(0), rawStrength = useMotionValue(0);
  const sprung = useSpring(raw, scrubberSprings.pointer), sprungStrength = useSpring(rawStrength, scrubberSprings.strength);
  const pointer = reduceMotion || systemReduced ? raw : sprung;
  const strength = reduceMotion || systemReduced ? rawStrength : sprungStrength;
  const rail = React.useRef<HTMLElement>(null), card = React.useRef<HTMLDivElement>(null);
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  const focused = React.useRef<number | null>(null), hovering = React.useRef(false);
  const [active, setActive] = React.useState<number | null>(null);
  const [geometry, setGeometry] = React.useState({ row: rowHeight, height: 0, card: 0, width: 240, right: side === "right" });
  const last = chapters.length - 1;
  const selected = active === null || last < 0 ? null : clamp(active, 0, last);
  React.useLayoutEffect(() => {
    const el = rail.current; if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const bounds = el.closest('.chat-main')?.getBoundingClientRect() ?? el.parentElement!.getBoundingClientRect();
      const left = Math.max(8, bounds.left), right = Math.min(window.innerWidth - 8, bounds.right);
      const roomRight = right - rect.right - 12, roomLeft = rect.left - left - 12;
      const useRight = side === "right" ? roomRight >= 240 || roomRight >= roomLeft : !(roomLeft >= 240 || roomLeft >= roomRight);
      setGeometry({ row: rect.height / Math.max(1, chapters.length), height: rect.height, card: card.current?.offsetHeight ?? 0, width: Math.max(0, Math.min(240, useRight ? roomRight : roomLeft)), right: useRight });
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(el); if (el.parentElement) observer.observe(el.parentElement); if (card.current) observer.observe(card.current);
    window.addEventListener('resize', measure); return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [chapters.length, selected, side, rowHeight]);
  React.useEffect(() => { onActiveChange?.(selected === null ? null : chapters[selected], selected ?? -1); }, [selected, chapters, onActiveChange]);
  React.useEffect(() => { focused.current = null; hovering.current = false; setActive(null); rawStrength.set(0); }, [chapters.map(c => c.id).join('\0')]);
  const top = useTransform(pointer, p => clamp((p + .5) * geometry.row - geometry.card / 2, 0, Math.max(0, geometry.height - geometry.card)));
  const x = useTransform(strength, [0, 1], [geometry.right ? -6 : 6, 0]);
  const scale = useTransform(strength, [0, 1], [.97, 1]);
  function engage(row: number, index: number) { raw.set(row); rawStrength.set(1); setActive(clamp(index, 0, last)); }
  function settle() { rawStrength.set(0); setActive(null); }
  if (!chapters.length) return null;
  const preview = chapters[selected ?? clamp(currentIndex ?? 0, 0, last)];
  return <nav ref={rail} aria-label={label} className={cn("chapter-scrubber", className)} style={{ width: peakLength + 8 }}
    onPointerMove={event => { if (event.pointerType === 'touch') return; hovering.current = true; const rect = rail.current!.getBoundingClientRect(); const row = clamp((event.clientY - rect.top) / geometry.row - .5, 0, last); engage(row, Math.round(row)); }}
    onPointerLeave={() => { hovering.current = false; if (focused.current !== null) engage(focused.current, focused.current); else settle(); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { focused.current = null; if (!hovering.current) settle(); } }}
    onKeyDown={event => { const index = focused.current ?? selected ?? currentIndex ?? 0; const next = ({ ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: last } as Record<string, number>)[event.key]; if (next !== undefined) { event.preventDefault(); buttons.current[clamp(next, 0, last)]?.focus(); } if (event.key === 'Escape') { hovering.current = false; settle(); } }}>
    {chapters.map((chapter, index) => <button key={chapter.id} ref={el => { buttons.current[index] = el; }} type="button" aria-label={`${chapter.title}${typeof chapter.description === 'string' ? ': ' + chapter.description : ''}`} aria-current={index === currentIndex ? "location" : undefined}
      tabIndex={index === (selected ?? clamp(currentIndex ?? 0, 0, last)) ? 0 : -1} style={{ height: rowHeight, flexBasis: rowHeight }}
      onFocus={() => { focused.current = index; engage(index, index); }} onClick={() => onSelect?.(chapter, index)}>
      <Tick index={index} pointer={pointer} strength={strength} radius={Math.max(1, radius)} rest={Math.max(1, restLength)} peak={peakLength} current={index === currentIndex} />
    </button>)}
    <motion.div ref={card} aria-hidden="true" className="chapter-preview" style={{ top, x, scale, opacity: strength, width: geometry.width, left: geometry.right ? 'calc(100% + 12px)' : undefined, right: geometry.right ? undefined : 'calc(100% + 12px)' }}>
      <div className="chapter-meta">{preview.meta}</div><strong>{preview.title}</strong>{preview.description && <div className="chapter-description">{preview.description}</div>}
    </motion.div>
  </nav>;
}
export default ChapterScrubber;
