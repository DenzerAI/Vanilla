import React, {useEffect, useRef, useState} from 'react';
import './skeleton.css';
import './components/ui/attention-fan.css';
import {SettingRow} from './settings-row.jsx';

type Variant = 'list' | 'settings' | 'chat' | 'document' | 'media' | 'shell' | 'attention';
type Layout = 'rows' | 'connections' | 'skills' | 'jobs' | 'search' | 'library-list' | 'library-grid';
type Props = {variant?: Variant; rows?: number; label?: string; announce?: boolean; compact?: boolean; layout?: Layout};

const Bar = ({short = false}: {short?: boolean}) => <span className={'skeleton-bar' + (short ? ' skeleton-short' : '')}/>;
const Lines = ({source = false}: {source?: boolean}) => <div className="skeleton-lines"><strong><Bar short/></strong><p><Bar/></p>{source&&<p><Bar short/></p>}</div>;
const Mark = ({className = ''}: {className?: string}) => <span className={'skeleton-mark '+className}/>;

/** Only mount while content is missing. Refreshes retain the real content. */
export function Skeleton({variant = 'list', rows = 4, label = 'Inhalt wird geladen …', announce = true, compact = false, layout = 'rows'}: Props) {
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
  const content = variant === 'attention' ? <div className="attention-fan"><div className="attention-fan-track">{[-1,1,0].map(side=><div key={side} className={'attention-fan-card'+(side===0?' is-active':'')} data-side={side}><div className="attention-fan-kind"><Mark/><Bar short/></div><Lines/><span className="attention-fan-action"><Bar short/></span></div>)}</div><div className="attention-fan-navigation"><Bar short/></div></div> :
    variant === 'media' ? <div className="skeleton-media"/> :
    variant === 'chat' ? <div className="chat-turn"><div className="user-message-row"><div className="user-message skeleton-user"><Bar/><Bar short/></div><div className="user-actions"><Bar short/></div></div><div className="turn-author"><span className="agent-signature"><Mark className="avatar"/></span><div className="turn-author-meta"><span className="turn-author-name skeleton-author-name"><Bar/></span><span className="skeleton-author-time"><Bar/></span></div></div><div className="agent-message"><div className="markdown"><p><Bar/><Bar/><Bar short/></p><p><Bar/><Bar short/></p></div></div></div> :
    variant === 'shell' ? <><div className="skeleton-sidebar"><Bar short/>{Array.from({length:5}, (_, i)=><Lines key={i}/>)}</div><div className="skeleton-main chat-main pane-slot"><div className="conversation"><div className="message-column"><Skeleton variant="chat" announce={false}/></div></div><div className="composer-area"><div className="skeleton-composer"/><div className="composer-options"><Bar short/></div></div></div></> :
    Array.from({length:count}, (_, i) => {
      if (variant === 'settings') return <SettingRow key={i} title={<Bar short/>} description={<Bar/>}><span className="skeleton-control"/></SettingRow>;
      if (layout.startsWith('library-')) return <div className="library-entry skeleton-row" key={i}><span className="library-entry-name"><span className="library-thumbnail skeleton-mark"/><span className="skeleton-filename"><Bar/></span></span><span className="library-entry-kind"><Bar short/></span><span className="library-entry-date"><Bar/></span></div>;
      if (layout === 'jobs') return <div className="job-row skeleton-row" key={i}><Mark className="skeleton-job-icon"/><div className="job-info"><Lines/></div><Mark className="skeleton-job-action"/><span className="skeleton-control skeleton-switch"/></div>;
      if (layout === 'search') return <div className="system-search-placeholder skeleton-row" key={i}><Mark/><Lines/><Mark className="skeleton-end"/></div>;
      if (layout === 'connections' || layout === 'skills') return <div className="integration-item skeleton-row" key={i}><div className="app-icon skeleton-mark"/><Lines source={layout === 'skills'}/><Mark className="skeleton-end"/></div>;
      return <div className={'skeleton-row' + (compact ? ' file-row' : '')} key={i}>{variant === 'list'&&<Mark className="skeleton-icon"/>}{variant === 'document'?<div className="skeleton-paragraph"><Bar/><Bar/><Bar short/></div>:compact?<Bar/>:<Lines/>}</div>;
    });
  const shapeLayout = variant === 'settings' ? ' settings-group' : layout.startsWith('library-') ? ' library-entries library-entries-'+layout.slice(8) : ['connections','skills'].includes(layout) ? ' integration-grid' : '';
  return <div ref={ref} className={'skeleton skeleton-' + variant + (compact ? ' skeleton-compact' : '')} data-awake={awake} data-layout={layout}>
    {announce && <span className="skeleton-status" role="status">{label}</span>}
    <div className={"skeleton-shapes"+shapeLayout} aria-hidden="true">{content}</div>
  </div>;
}
