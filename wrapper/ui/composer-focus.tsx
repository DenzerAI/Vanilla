import {useEffect, useRef, useState, type HTMLAttributes} from 'react';
import './composer-focus.css';

/** Selection feedback stays on the input shell, including its multiline radius. */
export function ComposerFocus({ active, multiple, visible = true, onActivate, children, ...props }: HTMLAttributes<HTMLDivElement> & {
  active: boolean; multiple: boolean; visible?: boolean; onActivate: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [onscreen, setOnscreen] = useState(false);
  useEffect(() => {
    let intersecting = false;
    const update = () => setOnscreen(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    if (root.current) observer.observe(root.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <div {...props} ref={root} className="composer-entry composer-focus"
    data-active={multiple && active ? 'true' : 'false'}
    data-subdued={multiple && !active ? 'true' : 'false'}
    data-running={visible && onscreen ? 'true' : 'false'}
    onPointerDownCapture={onActivate} onFocusCapture={onActivate}>
    {children}
    <span className="composer-focus-trail" aria-hidden="true" />
  </div>;
}
