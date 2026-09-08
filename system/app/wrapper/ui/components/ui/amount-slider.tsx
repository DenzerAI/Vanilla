"use client";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "../../lib/utils";
import { amountSliderGeometry, amountSliderMotion } from "../../design-system.mjs";
import "./amount-slider.css";

const { cell: CELL, gap: GAP, thumb: THUMB } = amountSliderGeometry;
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Adapted from the supplied AmountSlider: one native option per magnetic stop.
// No monetary readout. Keyboard, touch and pointer share Radix's commit path.
export function AmountSlider({ value, onValueChange, onValueCommit, min = 0, max = 100,
  stops, className, label, valueText, reduceMotion = false, disabled = false, unset = false, boost = 0,
}: {
  value: number; onValueChange: (value: number) => void; onValueCommit: (value: number) => void;
  min?: number; max?: number; stops?: number[]; className?: string;
  label: string; valueText: string; reduceMotion?: boolean; disabled?: boolean; unset?: boolean; boost?: number;
}) {
  const [dragging, setDragging] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null), trackRef = React.useRef<HTMLSpanElement>(null);
  const repaint = React.useRef<(() => void) | null>(null);
  const fraction = Math.min(Math.max((value - min) / (max - min || 1), 0), 1);
  const boostRef = React.useRef(boost); boostRef.current = boost;
  const fractionRef = React.useRef(fraction); fractionRef.current = fraction;
  const [systemReduce, setSystemReduce] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setSystemReduce(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const reduce = systemReduce || reduceMotion;
  const sorted = React.useMemo(() => [...new Set(stops?.filter(s => Number.isFinite(s) && s >= min && s <= max) || [])].sort((a, b) => a - b), [stops, min, max]);
  const snap = (n: number) => sorted.reduce((best, s) => Math.abs(s - n) < Math.abs(best - n) ? s : best, sorted[0] ?? n);

  React.useEffect(() => {
    const canvas = canvasRef.current, track = trackRef.current, ctx = canvas?.getContext("2d");
    if (!canvas || !track || !ctx) return;
    let raf = 0, visible = false, running = false, width = 0, height = 0;
    let last = performance.now(), phase = 0, hintPhase = 0;
    let accent = getComputedStyle(track).color;
    const paint = (now: number) => {
      const dt = running ? Math.min((now - last) / 1000, .05) : 0; last = now;
      const fill = fractionRef.current, emphasis = boostRef.current;
      phase += dt * (amountSliderMotion.baseSpeed + fill * amountSliderMotion.extraSpeed + emphasis * amountSliderMotion.ultraSpeed);
      hintPhase += dt;
      ctx.clearRect(0, 0, width, height);
      const fillPx = THUMB / 2 + fill * (width - THUMB);
      const bandPx = fill * (amountSliderMotion.tail + emphasis * amountSliderMotion.ultraTail) * width;
      const hintStrength = amountSliderMotion.hint * (1 - fill);
      ctx.fillStyle = accent;
      for (let x = 0; x < Math.ceil(width / CELL); x++) {
        const px = x * CELL + CELL / 2, tail = px <= fillPx;
        let base: number;
        if (tail) {
          if (bandPx <= .5) continue;
          const band = 1 - (fillPx - px) / bandPx;
          if (band <= 0) continue;
          base = Math.pow(band, 2 - emphasis * amountSliderMotion.ultraFalloff) * (1 + emphasis * amountSliderMotion.ultraIntensity);
        } else {
          const along = (px - fillPx) / Math.max(1, width - fillPx);
          base = hintStrength * Math.sin(along * Math.PI) * (.5 + .5 * Math.sin(px / width * 5 - hintPhase * 4.5));
        }
        for (let y = 0; y < Math.ceil(height / CELL); y++) {
          const ph = hash(x, y) * Math.PI * 2, stat = .6 + .4 * hash(x + 7.3, y - 3.1);
          const anim = reduce ? 1 : tail
            ? .35 + .325 * (1 + Math.sin(phase * 2.4 + x * .9 + y * .4 + ph))
            : .6 + .4 * (.5 + .5 * Math.sin(phase * 1.7 + ph));
          const alpha = Math.min(1, Math.max(0, base * stat * anim));
          if (alpha < .015) continue;
          ctx.globalAlpha = alpha; ctx.fillRect(x * CELL, y * CELL, CELL - GAP, CELL - GAP);
        }
      }
      ctx.globalAlpha = 1;
    };
    const frame = (now: number) => { paint(now); if (running) raf = requestAnimationFrame(frame); };
    const sync = () => {
      cancelAnimationFrame(raf);
      running = visible && !document.hidden && !reduce && !disabled && !unset;
      last = performance.now(); paint(last);
      if (running) raf = requestAnimationFrame(frame);
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = track.clientWidth; height = track.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint(performance.now());
    };
    repaint.current = () => paint(performance.now());
    resize();
    const ro = new ResizeObserver(resize); ro.observe(track);
    const io = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; sync(); }); io.observe(track);
    const theme = new MutationObserver(() => { accent = getComputedStyle(track).color; paint(performance.now()); });
    theme.observe(document.documentElement, {attributes: true, attributeFilter: ["class", "style", "data-theme"]});
    theme.observe(track, {attributes:true, attributeFilter:["style"]});
    document.addEventListener("visibilitychange", sync);
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); theme.disconnect(); document.removeEventListener("visibilitychange", sync); repaint.current = null; };
  }, [reduce, disabled, unset]);
  React.useEffect(() => { repaint.current?.(); }, [fraction]);

  return <SliderPrimitive.Root className={cn("amount-slider", className)} value={[value]} min={min} max={max} step={.001} disabled={disabled} data-dragging={dragging} data-unset={unset} data-reduce-motion={reduce}
    onPointerDownCapture={() => setDragging(true)} onPointerUpCapture={() => { setDragging(false); if (unset) onValueCommit(snap(value)); }} onPointerCancel={() => setDragging(false)}
    onValueChange={([raw]) => {
      // Radix maps pointer positions over the whole root; align them with the
      // inset thumb travel and visible dots before applying the magnetic zone.
      const width = trackRef.current?.clientWidth || THUMB;
      const next = width > THUMB ? Math.max(min, Math.min(max, min + ((raw - min) * width - (max - min) * THUMB / 2) / (width - THUMB))) : raw;
      onValueChange(Math.abs(snap(next) - next) < amountSliderMotion.magnet ? snap(next) : next);
    }} onValueCommit={([next]) => onValueCommit(snap(next))}
    onKeyDownCapture={event => {
      if (!sorted.length || disabled) return;
      const delta = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
      if (!delta && !["Home", "End", "PageUp", "PageDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const i = sorted.indexOf(snap(value));
      const next = sorted[event.key === "Home" ? 0 : event.key === "End" ? sorted.length - 1 : Math.max(0, Math.min(sorted.length - 1, i + (delta || (event.key === "PageUp" ? 1 : -1))))];
      onValueChange(next); onValueCommit(next);
    }}>
    <SliderPrimitive.Track ref={trackRef} className="amount-slider-track" style={{color:`color-mix(in srgb, var(--brand-accent), var(--slider-ultra-accent) ${boost * 100}%)`}}>
      <canvas ref={canvasRef} aria-hidden="true"/>
      {sorted.map(stop => <span className="amount-slider-tick" key={stop} aria-hidden="true" data-passed={!unset && stop <= value}
        style={{left: `calc(${(stop - min) / (max - min || 1)} * (100% - ${THUMB}px) + ${THUMB / 2}px)`}}/>)}
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="amount-slider-thumb" aria-label={label} aria-valuetext={valueText}/>
  </SliderPrimitive.Root>;
}

export type ReasoningOption = { value: string; label: string; description?: string };
export function ReasoningSlider({ options, value, onChange, disabled = false, reduceMotion = false }: {
  options: ReasoningOption[]; value: string; onChange: (value: string) => Promise<unknown> | unknown; disabled?: boolean; reduceMotion?: boolean;
}) {
  const [preview, setPreview] = React.useState<number | null>(null), saving = React.useRef(false);
  const reset = options.find(option => option.value === "default" || option.value === "auto");
  const levels = options.filter(option => option !== reset);
  const automatic = preview === null && value === reset?.value;
  const index = preview ?? Math.max(0, levels.findIndex(option => option.value === value));
  const current = automatic ? reset : levels[Math.round(index)];
  if (!current) return null;
  const commit = async (next: number) => {
    if (saving.current || disabled) return;
    if (!levels[next] || levels[next].value === value) { setPreview(null); return; }
    setPreview(next);
    saving.current = true;
    try { await onChange(levels[next].value); } finally { saving.current = false; setPreview(null); }
  };
  return <div className="reasoning-slider" onPointerCancel={() => setPreview(null)} onKeyDown={event => { if (event.key === "Escape") setPreview(null); }}>
    <div className="reasoning-slider-heading"><span>Denkaufwand</span>{reset && !automatic && <button className="reasoning-reset" type="button" disabled={disabled} title="Auf native Voreinstellung zurücksetzen" onClick={() => void onChange(reset.value)}>{reset.label}</button>}<output aria-live="off" title={current.description}><span key={current.value}>{current.label}</span></output></div>
    {levels.length > 1 && <>
      <AmountSlider min={0} max={levels.length - 1} stops={levels.map((_, i) => i)} value={index} unset={automatic} boost={!automatic && levels.some(option => option.value === "ultra") ? Math.max(0, Math.min(1, index - levels.findIndex(option => option.value === "ultra") + 1)) : 0} label="Denkaufwand" valueText={current.label}
        disabled={disabled} reduceMotion={reduceMotion} onValueChange={setPreview} onValueCommit={next => void commit(next)}/>
    </>}
  </div>;
}
