import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, SquarePen, Wrench, Zap } from "./icons.jsx";
import { ChatMenu } from "./chat-controls.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { AppLoader } from "./app-loader";
import { ReasoningSlider, reasoningLabel } from "./components/ui/amount-slider";
import { workerName } from "../../system/worker-catalog.mjs";
import { supportedEffort, visibleModels, selectedVisibleModel, fastTier, sessionFast } from "../worker-models.mjs";
import "./model-picker.css";

const modelName = model => (model?.displayName || model?.model || "Modell auswählen")
  .replace(/^(GPT-\d+(?:\.\d+)?)-/, "$1 ").replace(/(?<=\w)-(?=[A-Za-z])/g, " ");

export function ModelPicker({ workerSession, onSessionChange, models = [], model, effort, onChange, context, workerId = "codex", workers = [], onProviderChange, onRefresh, hasConversation = false, disabled = false, providerDisabled = false, running = false, serviceTier = null, onSpeedChange, reduceMotion = false, mode = "default", onModeChange, modeDisabled = false, planAvailable = true }) {
  const [details, setDetails] = useState(false);
  const content = useRef(null);
  const [open, setOpen] = useState(false), [position, setPosition] = useState({});
  const [provider, setProvider] = useState(workerId), [pending, setPending] = useState(false), [error, setError] = useState("");
  const trigger = useRef(null), popup = useRef(null), modeMenu = useRef(null), operation = useRef(false);
  const id = useId();
  const choices = visibleModels(models, workerId);
  const selected = selectedVisibleModel(models, workerId, model);
  const selectedId = selected?.model;
  const optionName = item => {
    const name = modelName(item);
    return choices.some(other => other.model !== item.model && modelName(other) === name) ? `${name} · ${item.model}` : name;
  };
  const speed = workerId === "codex" ? fastTier(selected) : null;
  const nativeFast = sessionFast(workerSession);
  const fastAvailable = speed && onSpeedChange || nativeFast && onSessionChange;
  const fastActive = speed ? serviceTier === speed.id : nativeFast?.enabled;
  const toggleFast = () => speed ? onSpeedChange(fastActive ? null : speed.id)
    : onSessionChange({configId:nativeFast.id, value:fastActive ? nativeFast.off : nativeFast.on});
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
  const modeLabel = mode === "plan" ? "Planen" : "Umsetzen";
  const ModeIcon = mode === "plan" ? SquarePen : Wrench;
  const heading = ({ current } = {}) => <div className="model-compact-heading">
    <div className="model-header-side">{fastAvailable && <button type="button" className="icon-button model-fast"
      disabled={disabled || pending || !!nativeFast && running} aria-label="Fast" aria-pressed={!!fastActive}
      title="Fast · höherer Verbrauch. Gilt ab der nächsten Nachricht."
      onClick={() => void act(toggleFast)}><Zap size={18}/></button>}</div>
    <button type="button" className="model-summary" aria-label="Modell und Anbieter auswählen" aria-expanded={false}
      onClick={() => setDetails(true)}>
      {current && <output aria-live="off" title={current.description}><span key={current.value}>{reasoningLabel(current.label)}</span><ChevronDown size={12}/></output>}
      <span className={current ? "model-summary-name" : ""}>{modelName(selected)}{!current && <ChevronDown size={12}/>}</span>
    </button>
    <div className="model-header-side">{pending ? <span className="model-loading" role="status" aria-label="Auswahl wird geladen"><AppLoader size={14}/></span> : onModeChange && <ChatMenu
      label={`Arbeitsmodus: ${modeLabel}`} className="icon-button model-mode" menuRef={modeMenu} placement="above"
      disabled={disabled || pending || modeDisabled} selected={mode}
      items={[
        { id: "default", label: "Umsetzen", icon: <Wrench size={16}/>, action: () => void act(() => onModeChange("default")) },
        { id: "plan", label: "Planen", icon: <SquarePen size={16}/>, disabled: !planAvailable, action: () => void act(() => onModeChange("plan")) },
      ]}>
      <ModeIcon size={16}/><ChevronDown size={10}/>
    </ChatMenu>}</div>

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
    const outside = e => { if (!popup.current?.contains(e.target) && !modeMenu.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false); };
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
      aria-label={`Modell und Denkaufwand: ${workerName(workerId)}, ${modelName(selected)}${efforts.length ? `, ${effortLabel}` : ""}, Arbeitsmodus: ${modeLabel}`}
      aria-haspopup="dialog" disabled={disabled} aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { setProvider(workerId); setDetails(false); setPosition({}); setError(""); setOpen(!open); if (!open) onRefresh?.(); }}>
      <span className="model-name">{selected ? modelName(selected) : workerName(workerId)}</span>
      {!!efforts.length && <span className="model-effort">{effortLabel}</span>}{fastActive && <Zap className="model-fast-indicator" size={12}/>}{mode === "plan" && <SquarePen size={12}/>}<ChevronDown size={14}/>
    </button>
    {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label="Modell und Denkaufwand" aria-busy={pending}
      className="model-popover glass" data-reduce-motion={reduceMotion} data-view={expanded ? "models" : "compact"} style={position}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (expanded && choices.length) showCompact(); else close(); } }}
      onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && !modeMenu.current?.contains(e.relatedTarget) && e.relatedTarget !== trigger.current) setOpen(false); }}>
      <div ref={content} className="model-picker-content" key={expanded ? "models" : "compact"}>
      {expanded ? <>
        {!!choices.length && <button type="button" className="model-back" aria-label="Zurück zum Regler" onClick={showCompact}><ArrowLeft size={14}/><span>{modelName(selected)}</span></button>}
      <div className="model-providers" role="group" aria-label="KI-Anbieter">
        {providers.map(value => <button key={value} type="button" aria-pressed={provider === value} disabled={pending || disabled || providerDisabled}
          onClick={() => { setProvider(value); setError(""); if (value !== workerId && (!hasConversation || !running)) void act(async () => { await onProviderChange?.(value); setDetails(false); }); }}>
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
          {choices.map(m => <label className="model-option" key={m.model} data-selected={selectedId === m.model}>
            <input type="radio" name={id + "-model"} value={m.model} checked={selectedId === m.model}
              onClick={() => { if (selectedId === m.model) setDetails(false); }}
              onChange={() => void act(async () => { await onChange(m.model, supportedEffort(m, effort)); setDetails(false); })}/>
            <span>{optionName(m)}</span><Check size={14}/>
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
