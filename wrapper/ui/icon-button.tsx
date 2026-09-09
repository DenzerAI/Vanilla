import type { ButtonHTMLAttributes } from 'react';

export function IconButton({ label, active, className = '', children, ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return <button {...props} type="button" className={`icon-button ${active ? 'selected' : ''} ${className}`}
    aria-pressed={props['aria-pressed'] ?? (props['aria-expanded'] === undefined ? active : undefined)}
    title={label} aria-label={label}>{children}</button>;
}
