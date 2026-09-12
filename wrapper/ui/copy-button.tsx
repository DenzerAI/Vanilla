import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from './icons.jsx';
import { IconButton } from './icon-button';
import { animateIcon } from './icon-motion';
import { iconMotion } from './design-system.mjs';

export function CopyButton({ text, label = 'Kopieren', size = 15, disabled = false }:
  { text: string; label?: string; size?: number; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle');
  const [success, setSuccess] = useState(0);
  const root = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    revision.current++;
    busy.current = false;
    setState('idle');
    return () => { revision.current++; clearTimeout(timer.current); };
  }, [text]);
  useEffect(() => {
    if (state === 'copied') animateIcon(root.current?.querySelector('svg') || null, 'success');
  }, [state, success]);
  async function copy() {
    if (busy.current || disabled) return;
    busy.current = true;
    const current = revision.current;
    clearTimeout(timer.current);
    setState('pending');
    try {
      await navigator.clipboard.writeText(text);
      if (current !== revision.current) return;
      setState('copied');
      setSuccess(value => value + 1);
      // Release mouse focus so the action row hides again once the pointer leaves.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && root.current?.contains(focused) && !focused.matches(':focus-visible')) focused.blur();
      timer.current = setTimeout(() => setState('idle'), iconMotion.successHold);
    } catch {
      if (current === revision.current) setState('error');
    } finally {
      if (current === revision.current) busy.current = false;
    }
  }
  return <>
    <IconButton ref={root} className="copy-feedback" data-icon-feedback={state} label={state === 'copied' ? 'Kopiert' : label} onClick={copy} disabled={disabled || state === 'pending'} aria-busy={state === 'pending'}>
      {state === 'copied' ? <Check size={size} /> : <Copy size={size} />}
    </IconButton>
    <span className={state === 'error' ? 'copy-notice' : 'sr-only'} role="status">
      {state === 'copied' ? 'Kopiert.' : state === 'error' ? 'Kopieren nicht möglich. Bitte erneut versuchen.' : ''}
    </span>
  </>;
}
