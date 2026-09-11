import {useCallback,useLayoutEffect,useRef} from 'react';
export function useLiveAction<T extends (...args:any[])=>any>(action:T):T {
  const latest=useRef(action);
  useLayoutEffect(()=>{latest.current=action;});
  return useCallback(((...args:any[])=>latest.current(...args)) as T,[]);
}
