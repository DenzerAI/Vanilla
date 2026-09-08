import React, {useLayoutEffect, useRef} from 'react';
import './scroll-edge-fade.css';

export function ScrollEdgeFade({children, className = '', ...props}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node=ref.current;
    if (!node) return;
    const update=()=>{
      node.dataset.fadeTop=String(node.scrollTop>1);
      node.dataset.fadeBottom=String(node.scrollHeight-node.clientHeight-node.scrollTop>1);
    };
    const resize=new ResizeObserver(update);
    const observe=()=>{resize.disconnect();resize.observe(node);for(const child of node.children)resize.observe(child);update();};
    const mutation=new MutationObserver(observe);
    mutation.observe(node,{childList:true,subtree:true,characterData:true});
    node.addEventListener('scroll',update,{passive:true});observe();
    return ()=>{node.removeEventListener('scroll',update);resize.disconnect();mutation.disconnect();};
  },[]);
  return <div {...props} ref={ref} className={`scroll-edge-fade ${className}`}>{children}</div>;
}
