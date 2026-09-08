import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "./icons.jsx";

const effortNames = {
  none: "Ohne",
  minimal: "Minimal",
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  xhigh: "Sehr hoch",
  max: "Max",
  ultra: "Ultra",
};
const modelName = (model) =>
  (model?.displayName || model?.model || "Modell des Workers")
    .replace(/^(GPT-\d+(?:\.\d+)?)-/, "$1 ")
    .replace(/(?<=\w)-(?=[A-Za-z])/g, " ");

export function ModelPicker({ models, model, effort, onChange, context }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({});
  const trigger = useRef(null),
    popup = useRef(null);
  const id = useId();
  const choices = models.filter((m) => !m.hidden);
  const selected = choices.find((m) => m.model === model);
  const efforts = selected?.supportedReasoningEfforts || [];
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(324, window.innerWidth - 24);
      setPosition({
        width,
        left: Math.max(
          12,
          Math.min(rect.right - width, window.innerWidth - width - 12),
        ),
        bottom: window.innerHeight - rect.top + 8,
        maxHeight: Math.max(140, rect.top - 24),
      });
    };
    place();
    popup.current?.querySelector("input:checked, button")?.focus();
    const outside = (e) => {
      if (
        !popup.current?.contains(e.target) &&
        !trigger.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <div className="model-picker">
      <button
        type="button"
        ref={trigger}
        className={"model-trigger " + (open ? "selected" : "")}
        title={`${modelName(selected)}${efforts.length ? ` · ${effortNames[effort] || effort}` : ""}`}
        aria-label={`Modell und Denkaufwand: ${modelName(selected)}, ${effortNames[effort] || effort}`}
        aria-haspopup="dialog"
        disabled={!choices.length}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <span className="model-name">{modelName(selected)}</span>
        {efforts.length > 0 && <span className="model-effort">{effortNames[effort] || effort}</span>}
        <ChevronDown size={14} />
      </button>
      {open && createPortal(
        <div
          ref={popup}
          id={id}
          role="dialog"
          aria-label="Modell und Denkaufwand"
          className="model-popover glass"
          style={position}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          onBlur={(e) => {
            if (
              e.relatedTarget &&
              !e.currentTarget.contains(e.relatedTarget) &&
              e.relatedTarget !== trigger.current
            )
              setOpen(false);
          }}
        >
          {context && <p className="model-context">{context}</p>}
          <fieldset className="model-options">
            <legend>Modell</legend>
            {choices.map((m) => (
              <label className="model-option" key={m.model}>
                <input
                  type="radio"
                  name={id + "-model"}
                  value={m.model}
                  checked={model === m.model}
                  onChange={() =>
                    onChange(
                      m.model,
                      m.supportedReasoningEfforts.some(
                        (e) => e.reasoningEffort === effort,
                      )
                        ? effort
                        : m.defaultReasoningEffort,
                    )
                  }
                />
                <span>{modelName(m)}</span>
                <Check size={16} />
              </label>
            ))}
          </fieldset>
          {efforts.length > 0 && (
            <fieldset className="effort-options">
              <legend>Denkaufwand</legend>
              <div className="effort-grid">
                {efforts.map(({ reasoningEffort: e }) => (
                  <label className="effort-option" key={e}>
                    <input
                      type="radio"
                      name={id + "-effort"}
                      value={e}
                      checked={effort === e}
                      onChange={() => onChange(model, e)}
                    />
                    <span>{effortNames[e] || e}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="model-popover-footer">
            <button type="button" onClick={close}>
              Fertig <Check size={14} />
            </button>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
