import {searchScore} from './search-match.mjs';

const order = {chat:0, file:1, knowledge:2, job:3, skill:4, project:5, page:6, setting:7};
export function orderSearchResults(results) {
  return [...results].sort((a,b) => (order[a.kind] ?? 8) - (order[b.kind] ?? 8) || (b.score || 0) - (a.score || 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
}

// Catalogs are shared only for the lifetime of this search dialog; failed loads can be retried.
export function createSystemSearch(api) {
  const cache = new Map();
  function catalog(url) {
    if (!cache.has(url)) cache.set(url, api(url).catch(error => {cache.delete(url); throw error;}));
    return cache.get(url);
  }
  return async function search(query, onUpdate = (_result) => {}) {
    query = String(query).trim().slice(0,160);
    const collected = [], warnings = [];
    let unavailable = 0, total = 0;
    const snapshot = () => ({results:orderSearchResults(collected).slice(0,80),total,unavailable,warnings:[...warnings]});
    const sources = [{label:'Chats',load:async()=>{
      const response=await api('/search?q='+encodeURIComponent(query));
      unavailable=response.unavailable || 0;
      return response;
    }}];
    const match = (items, kind, title, detail, body) => items.flatMap(item => {
      const name=title(item), text=body(item), score=searchScore(name,query)*3+searchScore(`${name} ${text}`,query);
      return score ? [{kind,id:item.id,title:name,detail:detail(item),score,entry:item}] : [];
    });
    if (query) sources.push(
      {label:'Bibliothek',load:async()=>{
        const data=await catalog('/library');
        if(data.truncated) warnings.push('Bibliothek: Die Erfassung ist auf 5.000 Dateien begrenzt.');
        if(data.warnings?.length) warnings.push('Bibliothek: Einige Dateien konnten nicht erfasst werden.');
        return {results:match(data.entries || [],'file',e=>e.name,e=>['Bibliothek',e.origin,e.missing?'Datei fehlt':''].filter(Boolean).join(' · '),e=>`${e.path} ${e.origin || ''} ${e.worker || ''}`)};
      }},
      {label:'Aufträge',load:async()=>({results:match(await catalog('/jobs'),'job',j=>j.name,()=> 'Auftrag',j=>`${j.instructions || ''} ${j.description || ''}`)})},
      {label:'Skills',load:async()=>{
        const data=await catalog('/skills');
        if(data.warning) warnings.push('Skills: Ein Teil des Katalogs ist nicht verfügbar.');
        return {results:match((data.data || []).flatMap(group=>group.skills || []),'skill',s=>s.name,s=>`Skill · ${s.source || 'Installiert'}`,s=>s.description || '')};
      }},
      {label:'Wissen und Notizen',load:async()=>{
        const data=await api('/knowledge/search?q='+encodeURIComponent(query)+'&projectId=all&limit=50');
        return {results:(data.results || []).map(hit=>({kind:'knowledge',id:hit.path,title:hit.title,detail:'Wissen und Notizen',snippet:hit.excerpt,entry:hit}))};
      }},
    );
    await Promise.all(sources.map(async source=>{
      try {const data=await source.load();collected.push(...data.results);total+=data.total ?? data.results.length;}
      catch {warnings.push(`${source.label} ist derzeit nicht erreichbar.`);}
      onUpdate(snapshot());
    }));
    return snapshot();
  };
}
