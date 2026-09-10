import React, { useEffect, useId, useRef } from "react";
import { X } from "./icons.jsx";

export function Modal({ title, children, onClose, wide = false, className = "" }) {
  const ref = useRef();
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    dialog
      .querySelector(
        '[data-autofocus], input:checked, input:not([type="hidden"]):not([type="radio"]), textarea',
      )
      ?.focus();
    return () => {
      dialog.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={"modal " + (wide ? "wide " : "") + className}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          title="Schließen"
          aria-label="Schließen"
          onClick={onClose}
        >
          <X size={18} strokeWidth={1.55} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
