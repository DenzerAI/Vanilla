import {useEffect, useLayoutEffect, useState} from 'react';
import {motion} from './design-system.mjs';

/** One brief vertical transition per actual count change; elapsed time stays still. */
export function StepCount({value, animate}: {value: number; animate: boolean}) {
  const [frame, setFrame] = useState({value, previous: null as number | null});
  useLayoutEffect(() => {
    setFrame(old => old.value === value ? old : {value, previous:animate ? old.value : null});
  }, [value, animate]);
  useEffect(() => {
    if (frame.previous == null) return;
    const timer = setTimeout(() => setFrame(old => ({...old, previous:null})), parseFloat(motion['activity-count-duration']));
    return () => clearTimeout(timer);
  }, [frame.value, frame.previous]);
  return <span className="step-count">
    <span className="sr-only">{value}</span>
    <span key={frame.value} aria-hidden="true" className="step-count-window" data-animate={animate && frame.previous != null ? 'true' : 'false'}>
      {frame.previous != null && <span className="step-count-old">{frame.previous}</span>}
      <span className="step-count-current">{frame.value}</span>
    </span>
  </span>;
}
