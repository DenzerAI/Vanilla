import {Skeleton} from './skeleton.tsx';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Search, MessageCircle, Folder, ArrowUpRight, FileText} from './icons.jsx';
import {searchScore} from './search-match.mjs';
import './system-search.css';
import {createSystemSearch, orderSearchResults} from './system-search-data.mjs';
import {ScrollEdgeFade} from './scroll-edge-fade.tsx';

type Result = {kind: string; id: string; title: string; detail?: string; snippet?: string; entry?: any};
type Response = {results: Result[]; total: number; unavailable: number; warnings?: string[]};
type Props = {api: (url: string) => Promise<Response>; pages: Result[]; onOpen: (result: Result) => Promise<void> | void};
export function SystemSearch({api, pages, onOpen}: Props) {
  const [query, setQuery] = useState(''), [response, setResponse] = useState<Response | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const search = useMemo(()=>createSystemSearch(api),[api]);
  const labels: Record<string,string> = {chat:'Chats',file:'Bibliothek',knowledge:'Wissen und Notizen',job:'Aufträge',skill:'Skills',project:'Projekte',page:'Bereiche',setting:'Einstellungen'};
  const list = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let disposed = false;
    setLoading(true); setError(''); setResponse(null);
    const timer = setTimeout(() => {
      search(query, (result: Response)=>{if(!disposed)setResponse(result);}).then(result => {
        if (!disposed) setResponse(result);
      }).catch((e: Error) => { if (!disposed) setError(e.message || 'Suche nicht erreichbar.'); })
        .finally(() => { if (!disposed) setLoading(false); });
    }, 180);
    return () => { disposed = true; clearTimeout(timer); };
  }, [query, search, retry]);
  const navigation = query.trim() ? pages.filter(page => searchScore(page.title, query)) : [];
  const results: Result[] = orderSearchResults([...(response?.results || []), ...navigation]);
  return <div className="system-search-content">
    <label className="system-search-input">
      <Search size={18} strokeWidth={1.55} aria-hidden="true"/>
      <input ref={input} autoFocus type="search" aria-label="System durchsuchen" placeholder="Chats, Dateien, Aufträge, Skills …" value={query} maxLength={160}
        onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault();
            if(event.key === 'Enter' && results[0]) void onOpen(results[0]);
            else list.current?.querySelector<HTMLButtonElement>('button')?.focus();
          }
        }}/>
    </label>
    <div className="system-search-status" role="status">
      {loading ? 'Suche läuft …' : error ? error : results.length ? query.trim() ? `${(response?.total || 0) + navigation.length} Treffer` : 'Letzte Gespräche' : response?.warnings?.length ? 'Suche eingeschränkt' : 'Keine Treffer. Versuche ein anderes Stichwort.'}
      {error && <button onClick={() => setRetry(value => value + 1)}>Erneut versuchen</button>}
      {response?.warnings?.map(warning=><span key={warning}>{warning}</span>)}
      {!!response?.warnings?.length && !loading && <button onClick={()=>setRetry(value=>value+1)}>Erneut versuchen</button>}
      {!!response?.unavailable && <span>Einige Gesprächsinhalte sind lokal noch nicht verfügbar; ihre Titel werden durchsucht.</span>}
    </div>
    <div ref={list} className="system-search-list"><ScrollEdgeFade className="system-search-results" aria-label="Suchergebnisse" aria-busy={loading} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') || []);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      if (event.key === 'ArrowUp' && index === 0) { input.current?.focus(); return; }
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      buttons[next]?.focus();
    }}>
      {loading&&!results.length&&!error&&<Skeleton rows={3} announce={false}/>}
      {results.map((result,index) => <React.Fragment key={result.kind + result.id}>{query.trim() && (index === 0 || results[index-1].kind !== result.kind) && <h3 className="system-search-group">{labels[result.kind] || result.kind}</h3>}<button key={result.kind + result.id} onClick={() => void onOpen(result)}>
        {result.kind === 'chat' ? <MessageCircle size={18} strokeWidth={1.55}/> : ['file','knowledge','job'].includes(result.kind) ? <FileText size={18} strokeWidth={1.55}/> : result.kind === 'project' ? <Folder size={18} strokeWidth={1.55}/> : <Search size={18} strokeWidth={1.55}/>}
        <span><strong>{result.title}</strong>{result.detail && <small>{result.detail}</small>}{result.snippet && <span className="system-search-excerpt">{result.snippet}</span>}</span>
        <ArrowUpRight size={15} strokeWidth={1.55}/>
      </button></React.Fragment>)}
    </ScrollEdgeFade></div>
  </div>;
}
