import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "./icons.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { AppLoader } from "./app-loader";
import { ReasoningSlider } from "./components/ui/amount-slider";
import { workerName } from "../../system/worker-catalog.mjs";
import { supportedEffort, visibleModels } from "../worker-models.mjs";
import "./model-picker.css";

const modelName = model => (model?.displayName || model?.model || "Modell auswählen")
  .replace(/^(GPT-\d+(?:\.\d+)?)-/, "$1 ").replace(/(?<=\w)-(?=[A-Za-z])/g, " ");

export function ModelPicker({ models = [], model, effort, onChange, context, workerId = "codex", workers = [], onProviderChange, onRefresh, hasConversation = false, disabled = false, providerDisabled = false, reduceMotion = false }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState({});
  const [provider, setProvider] = useState(workerId), [pending, setPending] = useState(false), [error, setError] = useState("");
  const trigger = useRef(null), popup = useRef(null), operation = useRef(false);
  const id = useId();
  const choices = visibleModels(models, workerId);
  const selected = models.find(m => m.model === model);
  const efforts = selected?.supportedReasoningEfforts || [];
  const effortLabel = efforts.find(e => e.reasoningEffort === effort)?.displayName || effort;
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
        if (popup.current?.contains(focused) && document.activeElement === document.body) focused.focus();
      });
    }
  };
  useEffect(() => { setProvider(workerId); setError(""); }, [workerId]);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top = viewport?.offsetTop || 0;
      const width = Math.min(300, (viewport?.width || window.innerWidth) - 24);
      setPosition({ width, left: Math.max(left + 12, Math.min(rect.right - width, left + (viewport?.width || window.innerWidth) - width - 12)),
        bottom: window.innerHeight - rect.top + 8, maxHeight: Math.max(80, rect.top - top - 20) });
    };
    place();
    popup.current?.querySelector("[aria-pressed=true], input:checked, button")?.focus();
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
      onClick={() => { setProvider(workerId); setError(""); setOpen(!open); if (!open) onRefresh?.(); }}>
      <BrandIcon name={workerId}/><span className="model-name">{selected ? modelName(selected) : workerName(workerId)}</span>
      {!!efforts.length && <span className="model-effort">{effortLabel}</span>}<ChevronDown size={14}/>
    </button>
    {open && createPortal(<div ref={popup} id={id} role="dialog" aria-label="Modell und Denkaufwand" aria-busy={pending}
      className="model-popover glass" style={position}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }}
      onBlur={e => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget) && e.relatedTarget !== trigger.current) setOpen(false); }}>
      <div className="model-providers" role="group" aria-label="KI-Anbieter">
        {providers.map(value => <button key={value} type="button" aria-pressed={provider === value} disabled={pending || disabled || providerDisabled}
          onClick={() => { setProvider(value); setError(""); if (value !== workerId && !hasConversation) void act(() => onProviderChange?.(value)); }}>
          <BrandIcon name={value}/><span>{workerName(value)}</span>
        </button>)}
      </div>
      {pending && <p className="model-status" role="status"><AppLoader size={14}/> Auswahl wird geladen …</p>}
      {error && <p className="model-status" role="alert">{error}</p>}
      {sameProvider && <>
        {context && <p className="model-context">{context}</p>}
        {!!choices.length && <fieldset className="model-options" disabled={disabled || pending}>
          <legend>Modell</legend>
          {choices.map(m => <label className="model-option" key={m.model} data-selected={model === m.model}>
            <input type="radio" name={id + "-model"} value={m.model} checked={model === m.model}
              onChange={() => void act(() => onChange(m.model, supportedEffort(m, effort)))}/>
            <span>{modelName(m)}</span><Check size={14}/>
          </label>)}
        </fieldset>}
        {!!efforts.length && <div className="effort-options">
          <ReasoningSlider key={`${workerId}:${model}:${efforts.map(e => e.reasoningEffort).join(",")}`}
            options={efforts.map(e => ({value:e.reasoningEffort,label:e.displayName || e.reasoningEffort,description:e.description}))}
            value={effort} disabled={disabled || pending} reduceMotion={reduceMotion} onChange={next => act(() => onChange(model, next))}/>
        </div>}
      </>}
      {!pending && (!sameProvider || !choices.length) && <div className="model-provider-state">
        <p>{!sameProvider && hasConversation ? "Der Anbieterwechsel öffnet einen neuen Chat." : providerInfo?.installed === false ? `${workerName(provider)} ist noch nicht installiert.` : "Modelle aus der angemeldeten CLI laden."}</p>
        <button type="button" disabled={disabled || providerInfo?.installed === false} onClick={() => void act(() => onProviderChange?.(provider))}>
          {error ? "Erneut versuchen" : hasConversation && !sameProvider ? `Neuer Chat mit ${workerName(provider)}` : "Modelle laden"}
        </button>
        {providerInfo?.installURL && <a href={providerInfo.installURL} target="_blank" rel="noreferrer">{workerName(provider)} einrichten ↗</a>}
      </div>}
    </div>, document.body)}
  </div>;
}
