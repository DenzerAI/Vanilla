let database;
export function db() {
  return database ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('agent-dictation-v1', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('recordings', { keyPath: 'id' }); r.result.createObjectStore('chunks', { keyPath: 'key' }); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => { database = null; reject(r.error); };
  });
}
export async function write(store, value) {
  const d = await db();
  return new Promise((resolve, reject) => {
    let tx;
    try { tx = d.transaction(store, 'readwrite', { durability: 'strict' }); }
    catch (e) { if (e.name !== 'TypeError') throw e; tx = d.transaction(store, 'readwrite'); }
    tx.objectStore(store).put(value); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export async function all(store) {
  const d = await db();
  return new Promise((resolve, reject) => { const r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export function base64(buffer) {
  const bytes = new Uint8Array(buffer); let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}
let syncing;
export function sync(api) {
  if (syncing) return syncing.then(() => sync(api));
  syncing = (async () => {
    const recordings = await all('recordings');
    for (const r of recordings) {
      if (!r.finishedSynced) await api('/dictation/create', { id: r.id });
    }
    const chunks = (await all('chunks')).filter(c => !c.synced).sort((a,b) => a.seq - b.seq);
    for (const c of chunks) {
      await api('/dictation/chunk', { id: c.id, seq: c.seq, audio: base64(c.pcm) });
      await write('chunks', { ...c, synced: true });
    }
    for (const r of recordings) if (r.finished && !r.finishedSynced) {
      await api('/dictation/finish', { id: r.id, count: r.count, trash: r.trash });
      await write('recordings', { ...r, finishedSynced: true });
    }
  })().finally(() => { syncing = null; });
  return syncing;
}
export async function downloadLocal(id, extra = []) {
  const saved = (await all('chunks')).filter(c => c.id === id);
  const bySeq = new Map(saved.map(c => [c.seq, c]));
  for (const c of extra) bySeq.set(c.seq, c);
  const chunks = [...bySeq.values()].sort((a,b) => a.seq - b.seq);
  if (!chunks.length) throw new Error('Keine Audioabschnitte im Browser vorhanden.');
  if (chunks.some((c,i) => c.seq !== i)) throw new Error('Browserkopie ist unvollständig. Bitte Serverkopie herunterladen.');
  const size = chunks.reduce((n,c) => n + c.pcm.byteLength, 0), h = new ArrayBuffer(44), v = new DataView(h);
  const str = (offset,s) => [...s].forEach((c,i) => v.setUint8(offset+i,c.charCodeAt(0)));
  str(0,'RIFF'); v.setUint32(4,size+36,true); str(8,'WAVEfmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,16000,true); v.setUint32(28,32000,true); v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,'data'); v.setUint32(40,size,true);
  const url = URL.createObjectURL(new Blob([h,...chunks.map(c=>c.pcm)], { type:'audio/wav' }));
  const a = document.createElement('a'); a.href = url; a.download = `Diktat-${id}.wav`; a.click(); setTimeout(() => URL.revokeObjectURL(url),60000);
}
