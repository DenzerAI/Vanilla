import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readHtmlPreview,htmlPreviewPolicy} from '../html-preview.mjs';
import {fileKind} from '../ui/artifact-content.mjs';

test('HTML is a rendered document; ordinary source files remain text',()=>{
  for(const name of ['report.html','report.HTM','Report.HTML'])assert.equal(fileKind(name),'html');
  assert.equal(fileKind('report.md'),'text');
  assert.notEqual(fileKind('report.html.js'),'html');
});

test('HTML preview accepts complete document bytes and rejects non-HTML, directories and oversized files',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'html-preview-'));
  try{
    const file=join(folder,'report.html');
    const html='<!doctype html><title>Übersicht</title><script>document.title="Fertig"</script>';
    await writeFile(file,html);assert.equal((await readHtmlPreview(file)).toString(),html);
    await assert.rejects(readHtmlPreview(join(folder,'report.txt')),/Nur HTML/);
    await mkdir(join(folder,'directory.html'));await assert.rejects(readHtmlPreview(join(folder,'directory.html')),/Keine Datei/);
    await writeFile(file,Buffer.alloc(2000001));await assert.rejects(readHtmlPreview(file),/zu groß/);
  }finally{await rm(folder,{recursive:true,force:true});}
});

test('preview allows embedded interactions while keeping app and network access isolated',()=>{
  assert.match(htmlPreviewPolicy,/script-src 'unsafe-inline'/);
  assert.match(htmlPreviewPolicy,/sandbox allow-scripts;/);
  assert.doesNotMatch(htmlPreviewPolicy,/allow-same-origin|allow-top-navigation|allow-popups/);
  for(const directive of ["connect-src 'none'","form-action 'none'","frame-src 'none'","base-uri 'none'","frame-ancestors 'self'"])assert.ok(htmlPreviewPolicy.includes(directive));
});
