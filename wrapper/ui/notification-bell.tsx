import { useEffect, useRef } from 'react';
import { Bell } from './icons.jsx';
import { animateIcon } from './icon-motion';

export function NotificationBell({ signal, size = 17, preview = false }: { signal: number; size?: number; preview?: boolean }) {
  const root = useRef<HTMLSpanElement>(null);
  const previous = useRef(signal);
  useEffect(() => {
    const first = [...document.querySelectorAll('[data-notification-bell="global"]')].find(node => node.getClientRects().length);
    if (signal !== previous.current && (preview || first === root.current)) animateIcon(root.current?.querySelector('svg') || null, 'bell');
    previous.current = signal;
  }, [signal, preview]);
  return <span ref={root} className="copy-feedback" data-notification-bell={preview ? "preview" : "global"} aria-hidden="true"><Bell size={size} /></span>;
}
