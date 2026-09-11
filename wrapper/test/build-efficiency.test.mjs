import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';

test('mobile entry excludes optional pages, has immutable names and bounded compressed size',async()=>{
  const directory=new URL('../dist/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('.vite/manifest.json',directory),'utf8'));
  const initial=new Set();
  function visit(key) {
    const chunk=manifest[key];if(initial.has(chunk.file))return;
    initial.add(chunk.file);
    for(const css of chunk.css || [])initial.add(css);
    for(const dependency of chunk.imports || [])visit(dependency);
  }
  visit('index.html');
  for(const key of ['planner.tsx','system-settings.tsx','design-reference.jsx','voice-settings.jsx','library.jsx']) {
    const chunk = manifest[key] || Object.values(manifest).find(c => c.name === key.replace(/\.[^.]+$/, ''));
    assert.ok(chunk?.isDynamicEntry,key);
    assert.ok(!initial.has(chunk.file),key+' must load only on demand');
  }
  let bytes=0;
  for(const file of initial) {
    assert.match(file,/^assets\/.+-[\w-]{8,}\.(?:js|css)$/);
    const raw=await readFile(new URL(file,directory));
    const brotli=await readFile(new URL(file+'.br',directory));
    const gzip=await readFile(new URL(file+'.gz',directory));
    assert.deepEqual(brotliDecompressSync(brotli),raw);
    assert.deepEqual(gunzipSync(gzip),raw);
    bytes+=brotli.length;
  }
  assert.ok(bytes<320*1024,'Initial compressed code must stay below 320 KiB, got '+bytes);
  const entry=manifest['index.html'];
  const css=(await Promise.all([...initial].filter(file=>file.endsWith('.css')).map(file=>readFile(new URL(file,directory),'utf8')))).join('');
  assert.match(css,/skeleton-attention/,'Initial placeholder geometry must not depend on deferred CSS');
});
