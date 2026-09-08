import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {searchConversations} from '../search.mjs';
import {searchScore} from '../ui/search-match.mjs';

test('search accepts accents, spelling errors and transpositions but requires all words', () => {
  assert.ok(searchScore('Die größere Rechnung', 'grossere rechnnug'));
  assert.ok(searchScore('Workspace durchsuchen', 'workspce'));
  assert.equal(searchScore('Dateien lesen', 'Dateien Rechnung'), 0);
  assert.equal(searchScore('Rot', 'Rat'), 0);
});
test('local search finds content across projects, prioritizes titles and excludes internal tools and channels', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'vanilla-search-'));
  const chats = [
    {id:'title',title:'Rechnung prüfen',projectId:'a',updatedAt:1},
    {id:'content',title:'Abstimmung',projectId:'b',updatedAt:5,archived:true},
    {id:'private',title:'Kontakt',channelOnly:true},
    {id:'missing',title:'Rechnung fehlt',updatedAt:2},
  ];
  const transcript = {turns:[{items:[
    {type:'userMessage',content:[{type:'text',text:'Bitte die Rechnung für Oktober prüfen.'}]},
    {type:'agentMessage',text:'Der Betrag beträgt 200 Euro.'},
    {type:'reasoning',text:'PrivatesStichwort'},
    {type:'commandExecution',aggregatedOutput:'GeheimesWerkzeug'},
  ]}]};
  try {
    for (const id of ['title','content','private']) {
      await mkdir(path.join(workspace,'chats',id),{recursive:true});
      await writeFile(path.join(workspace,'chats',id,'transcript.json'), JSON.stringify(id === 'title' ? {turns:[]} : transcript));
    }
    const args = {workspace,chats,projects:[{id:'a',name:'Büro'},{id:'b',name:'Bauprojekt'}]};
    let found = await searchConversations({...args,query:'rechnung'});
    assert.equal(found.results[0].id,'missing');
    assert.equal(found.results[1].id,'title');
    assert.equal(found.results[2].id,'content');
    assert.match(found.results[2].snippet,/Oktober/);
    assert.match(found.results[2].detail,/Bauprojekt · Archiviert/);
    assert.equal(found.unavailable,1);
    for (const query of ['PrivatesStichwort','GeheimesWerkzeug']) assert.equal((await searchConversations({...args,query})).total,0);
    assert.deepEqual((await searchConversations({...args,query:'Bauprojetk'})).results.map(r=>r.kind),['project','chat']);
    found = await searchConversations({...args,query:'200 Euro'});
    assert.deepEqual(found.results.map(r=>r.id),['content']);
    found = await searchConversations({...args,query:'Liveantwort',threadCache:new Map([['title',{turns:[{items:[{type:'agentMessage',text:'Liveantwort verfügbar'}]}]}]])});
    assert.equal(found.results[0].id,'title');
    found = await searchConversations({...args,query:''});
    assert.equal(found.results[0].id,'content');
    assert.equal(found.unavailable,0);
  } finally { await rm(workspace,{recursive:true,force:true}); }
});
