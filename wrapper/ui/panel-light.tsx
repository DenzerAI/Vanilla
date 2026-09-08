import { useEffect, useRef, useState } from 'react';
import './panel-light.css';

/** Decorative material, independently clipped so menus and resizers remain reachable. */
export function PanelLight({ mode = 'animated', active = true }: { mode?: string; active?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <span ref={ref} aria-hidden="true" className="panel-light" data-mode={mode} data-running={active && visible ? 'true' : 'false'} />;
}
