import React, {useEffect, useRef, useState} from 'react';
import './skeleton.css';

type Variant = 'list' | 'settings' | 'chat' | 'document' | 'media' | 'shell';
type Props = {variant?: Variant; rows?: number; label?: string; announce?: boolean; compact?: boolean};

const Bar = ({short = false}: {short?: boolean}) => <span className={'skeleton-bar' + (short ? ' skeleton-short' : '')}/>;
const Lines = () => <div className="skeleton-lines"><Bar/><Bar short/></div>;

/** Only mount while content is missing. Refreshes retain the real content. */
export function Skeleton({variant = 'list', rows = 4, label = 'Inhalt wird geladen …', announce = true, compact = false}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [awake, setAwake] = useState(false);
  useEffect(() => {
    let visible = false;
    const sync = () => setAwake(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; sync();});
    if (ref.current) observer.observe(ref.current);
    document.addEventListener('visibilitychange', sync);
    return () => {observer.disconnect(); document.removeEventListener('visibilitychange', sync);};
  }, []);
  const count = Math.max(1, Math.min(8, Math.floor(rows) || 4));
  const content = variant === 'media' ? <div className="skeleton-media"/> :
    variant === 'chat' ? <><div className="skeleton-user"><Lines/></div><div className="skeleton-answer"><Lines/><Lines/><Bar short/></div></> :
    variant === 'shell' ? <><div className="skeleton-sidebar"><Bar short/>{Array.from({length:5}, (_, i)=><Lines key={i}/>)}</div><div className="skeleton-main"><Bar short/><div className="skeleton-shell-body"><Lines/><Lines/></div><div className="skeleton-composer"/></div></> :
    Array.from({length:count}, (_, i) => <div className="skeleton-row" key={i}>
      {variant === 'list' && <span className="skeleton-icon"/>}<Lines/>
      {variant === 'settings' && <span className="skeleton-control"/>}
    </div>);
  return <div ref={ref} className={'skeleton skeleton-' + variant + (compact ? ' skeleton-compact' : '')} data-awake={awake}>
    {announce && <span className="skeleton-status" role="status">{label}</span>}
    <div className="skeleton-shapes" aria-hidden="true">{content}</div>
  </div>;
}
