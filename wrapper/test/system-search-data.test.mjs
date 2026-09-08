import test from 'node:test';
import assert from 'node:assert/strict';
import {createSystemSearch,orderSearchResults} from '../ui/system-search-data.mjs';

test('global search covers all catalogs, preserves targets, and prioritizes chats', async()=>{
 const calls=[];
 const data={
  '/library':{entries:[{id:'file',name:'Rechnung.pdf',path:'output/Rechnung.pdf',scope:'workspace',origin:'Chat'}]},
  '/jobs':[{id:'job',name:'Monatsprüfung',instructions:'Rechnung prüfen'}],
  '/skills':{data:[{skills:[{id:'skill',name:'Buchhaltung',description:'Rechnung prüfen'}]}]},
 };
 const search=createSystemSearch(async url=>{calls.push(url);return url.startsWith('/search?')?{results:[{kind:'project',id:'p',title:'Rechnung',score:100},{kind:'chat',id:'chat',title:'Rechnung',score:1}],total:2,unavailable:0}:url.startsWith('/knowledge/search?')?{results:[{path:'notes/rechnung.md',title:'Rechnung',excerpt:'Rechnung geprüft',projectId:'default'}]}:data[url];});
 const updates=[];let result=await search('Rechnung',r=>updates.push(r));
 assert.deepEqual(result.results.map(r=>r.kind),['chat','file','knowledge','job','skill','project']);
 assert.equal(result.results[1].entry.path,'output/Rechnung.pdf');
 assert.equal(result.results[2].entry.projectId,'default');
 assert.equal(result.total,6);assert.equal(updates.length,5);
 await search('Prüfung');assert.equal(calls.filter(c=>c==='/library').length,1);
 assert.equal(calls.filter(c=>c==='/skills').length,1);
});
test('empty query only loads recent chats; failing catalogs can retry without losing other hits',async()=>{
 let fail=true;const calls=[];
 const search=createSystemSearch(async url=>{
  calls.push(url);
  if(url.startsWith('/search?'))return {results:[{kind:'chat',id:'chat',title:'Rechnung'}],total:1};
  if(url==='/library'){if(fail)throw Error('offline');return {entries:[{id:'f',name:'Rechnung.pdf',path:'Rechnung.pdf'}]};}
  if(url==='/jobs')return [];
  if(url==='/skills')return {data:[]};
  return {results:[]};
 });
 await search('');assert.equal(calls.length,1);
 let result=await search('Rechnung');assert.equal(result.results[0].kind,'chat');assert.match(result.warnings.join(),/Bibliothek/);
 fail=false;result=await search('Rechnung');assert.equal(result.warnings.length,0);assert.equal(result.results.length,2);
 assert.deepEqual(orderSearchResults([{kind:'page',id:'a'},{kind:'chat',id:'b'}]).map(r=>r.id),['b','a']);
});
