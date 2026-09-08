import React from "react";
// Shared Apple-style controls. Every visual value comes from design-tokens.css; see docs/DESIGN.md.

/**
 * On/off switch (macOS proportions). Native <button role="switch"> keeps keyboard,
 * focus and form semantics without an extra dependency.
 * @param {{checked: boolean, onChange: (next: boolean) => void, label: string, disabled?: boolean, title?: string}} props
 */
export function Switch({ checked, onChange, label, disabled = false, title }) {
  return (
    <button
      type="button"
      role="switch"
      className="apple-switch"
      aria-checked={!!checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

/** Round icon-only button; `label` is the accessible name. */
export function IconButton({ label, onClick, children, active, disabled, className = "", ...props }) {
  return (
    <button
      {...props}
      type="button"
      className={"icon-button " + (active ? "selected " : "") + className}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** Round icon well for settings rows: a glyph on a quiet circle, like macOS System Settings. */
export function SettingIcon({ icon: Icon, children }) {
  return (
    <span className="setting-icon" aria-hidden="true">
      {Icon ? <Icon size={16} /> : children}
    </span>
  );
}
