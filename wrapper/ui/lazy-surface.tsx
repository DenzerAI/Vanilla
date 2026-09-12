import React, {Component, lazy, Suspense, useState, type ReactNode} from 'react';
import {Skeleton} from './skeleton';

class SurfaceBoundary extends Component<{children:ReactNode; retry:()=>void}, {failed:boolean}> {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed
      ? <div role="alert"><p>Dieser Bereich konnte nicht geladen werden. Deine Eingabe bleibt erhalten.</p><button onClick={this.props.retry}>Erneut versuchen</button></div>
      : this.props.children;
  }
}

// Every boundary belongs to its content; a delayed panel never hides the composer.
export function lazySurface(load:()=>Promise<any>, name:string, placeholder:React.ComponentProps<typeof Skeleton>['variant'] | React.ComponentProps<typeof Skeleton> | null='list') {
  const InitialView = lazy(()=>load().then(module=>({default:module[name]})));
  return function LazySurface(props:any) {
    const [attempt,setAttempt] = useState(0);
    const [View,setView] = useState(()=>InitialView);
    const skeletonProps = typeof placeholder === 'string' ? {variant:placeholder} : placeholder;
    const fallback = skeletonProps === null ? null : skeletonProps.variant === 'attention'
      ? <div className="welcome agent-chat-welcome chat-start"><div className="chat-start-intro"><h1 className="chat-start-heading">{props.greeting}</h1></div><Skeleton variant="attention"/></div>
      : <Skeleton {...skeletonProps}/>;
    return <SurfaceBoundary key={attempt} retry={()=>{setView(()=>lazy(()=>load().then(module=>({default:module[name]}))));setAttempt(value=>value+1);}}>
      <Suspense fallback={fallback}>
        <View {...props}/>
      </Suspense>
    </SurfaceBoundary>;
  };
}
