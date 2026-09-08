import React, {useEffect, useRef, useState} from 'react';
import {Search, MessageCircle, Folder, ArrowUpRight} from './icons.jsx';
import {searchScore} from './search-match.mjs';
import './system-search.css';

type Result = {kind: string; id: string; title: string; detail?: string; snippet?: string};
type Response = {results: Result[]; total: number; unavailable: number};
type Props = {api: (url: string) => Promise<Response>; pages: Result[]; onOpen: (result: Result) => Promise<void> | void};
export function SystemSearch({api, pages, onOpen}: Props) {
  const [query, setQuery] = useState(''), [response, setResponse] = useState<Response | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const list = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let disposed = false;
    setLoading(true); setError(''); setResponse(null);
    const timer = setTimeout(() => {
      api('/search?q=' + encodeURIComponent(query)).then(result => {
        if (!disposed) setResponse(result);
      }).catch((e: Error) => { if (!disposed) setError(e.message || 'Suche nicht erreichbar.'); })
        .finally(() => { if (!disposed) setLoading(false); });
    }, 180);
    return () => { disposed = true; clearTimeout(timer); };
  }, [query, api, retry]);
  const navigation = query.trim() ? pages.filter(page => searchScore(page.title, query)) : [];
  const results = [...navigation, ...(response?.results || [])];
  return <div className="system-search-content">
    <label className="system-search-input">
      <Search size={18} strokeWidth={1.55} aria-hidden="true"/>
      <input ref={input} autoFocus type="search" aria-label="System durchsuchen" placeholder="Chats, Gesprächsinhalte, Projekte …" value={query} maxLength={160}
        onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault(); list.current?.querySelector<HTMLButtonElement>('button')?.focus();
          }
        }}/>
    </label>
    <div className="system-search-status" role="status">
      {loading ? 'Suche läuft …' : error ? error : results.length ? query.trim() ? `${(response?.total || 0) + navigation.length} Treffer` : 'Letzte Gespräche' : 'Keine Treffer. Versuche ein anderes Stichwort.'}
      {error && <button onClick={() => setRetry(value => value + 1)}>Erneut versuchen</button>}
      {!!response?.unavailable && <span>Einige Gesprächsinhalte sind lokal noch nicht verfügbar; ihre Titel werden durchsucht.</span>}
    </div>
    <div ref={list} className="system-search-results" aria-label="Suchergebnisse" aria-busy={loading} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') || []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      if (event.key === 'ArrowUp' && index === 0) { input.current?.focus(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      buttons[next]?.focus();
    }}>
      {results.map(result => <button key={result.kind + result.id} onClick={() => void onOpen(result)}>
        {result.kind === 'chat' ? <MessageCircle size={18} strokeWidth={1.55}/> : result.kind === 'project' ? <Folder size={18} strokeWidth={1.55}/> : <Search size={18} strokeWidth={1.55}/>}
        <span><strong>{result.title}</strong>{result.detail && <small>{result.detail}</small>}{result.snippet && <span className="system-search-excerpt">{result.snippet}</span>}</span>
        <ArrowUpRight size={15} strokeWidth={1.55}/>
      </button>)}
    </div>
  </div>;
}
