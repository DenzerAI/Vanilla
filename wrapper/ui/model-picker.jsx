import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, RotateCcw, Zap } from "./icons.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { AppLoader } from "./app-loader";
import { ReasoningSlider, reasoningLabel } from "./components/ui/amount-slider";
import { workerName } from "../../system/worker-catalog.mjs";
import { supportedEffort, visibleModels, fastTier } from "../worker-models.mjs";
import "./model-picker.css";

const modelName = model => (model?.displayName || model?.model || "Modell auswählen")
  .replace(/^(GPT-\d+(?:\.\d+)?)-/, "$1 ").replace(/(?<=\w)-(?=[A-Za-z])/g, " ");

export function ModelPicker({ models = [], model, effort, onChange, context, workerId = "codex", workers = [], onProviderChange, onRefresh, hasConversation = false, disabled = false, providerDisabled = false, running = false, serviceTier = null, onSpeedChange, reduceMotion = false }) {
  const [details, setDetails] = useState(false);
  const content = useRef(null);
  const [open, setOpen] = useState(false), [position, setPosition] = useState({});
  const [provider, setProvider] = useState(workerId), [pending, setPending] = useState(false), [error, setError] = useState("");
  const trigger = useRef(null), popup = useRef(null), operation = useRef(false);
  const id = useId();
  const choices = visibleModels(models, workerId);
  const selected = models.find(m => m.model === model);
  const speed = workerId === "codex" ? fastTier(selected) : null;
  const efforts = selected?.supportedReasoningEfforts || [];
  const effortLabel = reasoningLabel(efforts.find(e => e.reasoningEffort === effort)?.displayName || effort || "");
  const expanded = details || !choices.length || provider !== workerId;
  const providers = ["codex", "claw-code", workerId]
    .filter((value, index, all) => all.indexOf(value) === index);
  const providerInfo = workers.find(w => w.id === provider);
  const sameProvider = provider === workerId;
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const act = async action => {
    if (operation.current || disabled) return;
    const focused = document.activeElement;
    operation.current = true; setPending(true); setError("");
    try { await action(); }
    catch (e) { setError(e.message || "Die Auswahl konnte nicht geladen werden."); }
    finally {
      operation.current = false; setPending(false);
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) {
          if (popup.current?.contains(focused)) focused.focus();
          else popup.current?.querySelector("[aria-pressed=true], input:checked, button")?.focus();
        }
      });
    }
  };
  useLayoutEffect(() => {
    if (!open || !content.current) return;
    const measure = () => {
      const style = getComputedStyle(popup.current);
      const height = content.current.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setPosition(current => current.height === height ? current : {...current, height});
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(content.current);
    return () => observer.disconnect();
  }, [open, expanded]);
  useLayoutEffect(() => {
    if (!open) return;
    popup.current?.querySelector(expanded ? ".model-back" : ".model-summary")?.focus();
  }, [open, expanded]);
  const showCompact = () => { setProvider(workerId); setDetails(false); setError(""); };
  const heading = ({ current, reset, automatic, onReset } = {}) => <div className="model-compact-heading">
    <div className="model-header-side">{speed && onSpeedChange && <button type="button" className="model-fast"
      disabled={disabled || pending} aria-label="Fast" aria-pressed={serviceTier === speed.id}
      title="Fast · höherer Verbrauch. Gilt ab der nächsten Nachricht."
      onClick={() => void act(() => onSpeedChange(serviceTier === speed.id ? null : speed.id))}><Zap size={16}/></button>}</div>
    <button type="button" className="model-summary" aria-label="Modell und Anbieter auswählen" aria-expanded={false}
      onClick={() => setDetails(true)}>
      {current && <output aria-live="off" title={current.description}><span key={current.value}>{reasoningLabel(current.label)}</span><ChevronDown size={12}/></output>}
      <span className={current ? "model-summary-name" : ""}>{modelName(selected)}{!current && <ChevronDown size={12}/>}</span>
    </button>
    <div className="model-header-side">{pending ? <span className="model-loading" role="status" aria-label="Auswahl wird geladen"><AppLoader size={14}/></span> : reset && <button type="button" className="model-reset" disabled={disabled || pending || automatic}
      aria-label={reasoningLabel(reset.label) + " wiederherstellen"} title="Auf native Voreinstellung zurücksetzen" onClick={onReset}><RotateCcw size={14}/></button>}</div>
  </div>;
  useEffect(() => { setProvider(workerId); setError(""); }, [workerId]);
  useEffect(() => {
    if (!open) return;
    // Keep the opening alignment while labels change; still follow layout and viewport changes.
    const anchorWidth = trigger.current?.getBoundingClientRect().width || 0;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = Math.min(300, (viewport?.width || window.innerWidth) - 24);
      setPosition(current => ({ height: current.height, width, left: Math.max(left + 12, Math.min(rect.left + anchorWidth - width, left + (viewport?.width || window.innerWidth) - width - 12)),
        bottom: window.innerHeight - rect.top + 8, maxHeight: Math.max(80, rect.top - top - 20) }));
    };
    place();
    popup.current?.querySelector(".model-summary, .model-back, [aria-pressed=true], button")?.focus();
    const outside = e => { if (!popup.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    const observer = new ResizeObserver(place); observer.observe(trigger.current);
    return () => {
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place); window.visualViewport?.removeEventListener("scroll", place); observer.disconnect();
    };
  }, [open]);
  return <div className="model-picker">
    <button type="button" ref={trigger} className={"model-trigger " + (open ? "selected" : "")}
      title={`${workerName(workerId)} · ${modelName(selected)}${efforts.length ? ` · ${effortLabel}` : ""}`}
      aria-label={`Modell und Denkaufwand: ${workerName(workerId)}, ${modelName(selected)}${efforts.length ? `, ${effortLabel}` : ""}`}
      aria-haspopup="dialog" disabled={disabled} aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { setProvider(workerId); setDetails(false); setPosition({}); setError(""); setOpen(!open); if (!open) onRefresh?.(); }}>
      <span className="model-name">{selected ? modelName(selected) : workerName(workerId)}</span>
      {!!efforts.length && <span className="model-effort">{effortLabel}</span>}{speed && serviceTier === speed.id && <Zap size={12}/>}<ChevronDown size={14}/>
    </button>
    {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label="Modell und Denkaufwand" aria-busy={pending}
      className="model-popover glass" data-reduce-motion={reduceMotion} data-view={expanded ? "models" : "compact"} style={position}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (expanded && choices.length) showCompact(); else close(); } }}
      onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && e.relatedTarget !== trigger.current) setOpen(false); }}>
      <div ref={content} className="model-picker-content" key={expanded ? "models" : "compact"}>
      {expanded ? <>
        {!!choices.length && <button type="button" className="model-back" aria-label="Zurück zum Regler" onClick={showCompact}><ArrowLeft size={14}/><span>{modelName(selected)}</span></button>}
      <div className="model-providers" role="group" aria-label="KI-Anbieter">
        {providers.map(value => <button key={value} type="button" aria-pressed={provider === value} disabled={pending || disabled || providerDisabled}
          onClick={() => { setProvider(value); setError(""); if (value !== workerId && !hasConversation) void act(async () => { await onProviderChange?.(value); setDetails(false); }); }}>
          <BrandIcon name={value}/><span>{workerName(value)}</span>
        </button>)}
      </div>
      </> : <div className="model-compact">
        {efforts.length ? <ReasoningSlider key={`${workerId}:${model}:${efforts.map(e => e.reasoningEffort).join(",")}`}
          options={efforts.map(e => ({value:e.reasoningEffort,label:e.displayName || e.reasoningEffort,description:e.description}))}
          value={effort} disabled={disabled || pending} reduceMotion={reduceMotion} renderHeading={heading}
          onChange={next => act(() => onChange(model, next))}/> : heading()}
      </div>}
      {context && sameProvider && <p className="model-context">{context}</p>}
      {pending && expanded && <p className="model-status" role="status"><AppLoader size={14}/> Auswahl wird geladen …</p>}
      {error && <p className="model-status" role="alert">{error}</p>}
      {expanded && sameProvider && <>
        {!!choices.length && <fieldset className="model-options" aria-label="Modell" disabled={disabled || pending}>
          {choices.map(m => <label className="model-option" key={m.model} data-selected={model === m.model}>
            <input type="radio" name={id + "-model"} value={m.model} checked={model === m.model}
              onClick={() => { if (model === m.model) setDetails(false); }}
              onChange={() => void act(async () => { await onChange(m.model, supportedEffort(m, effort)); setDetails(false); })}/>
            <span>{modelName(m)}</span><Check size={14}/>
          </label>)}
        </fieldset>}
      </>}
      {!pending && (!sameProvider || !choices.length) && <div className="model-provider-state">
        <p>{!sameProvider && hasConversation ? running ? "Die laufende Antwort wird gestoppt. Dein Verlauf bleibt erhalten." : "Im selben Chat mit dem bisherigen Kontext weiterarbeiten." : providerInfo?.installed === false ? `${workerName(provider)} ist noch nicht installiert.` : "Modelle aus der angemeldeten CLI laden."}</p>
        <button type="button" disabled={disabled || providerInfo?.installed === false} onClick={() => void act(async () => { await onProviderChange?.(provider); setDetails(false); })}>
          {error ? "Erneut versuchen" : hasConversation && !sameProvider ? running ? "Stoppen und wechseln" : `Mit ${workerName(provider)} fortsetzen` : "Modelle laden"}
        </button>
        {providerInfo?.installURL && <a href={providerInfo.installURL} target="_blank" rel="noreferrer">{workerName(provider)} einrichten ↗</a>}
      </div>}
      </div>
    </div>, document.body)}
  </div>;
}
