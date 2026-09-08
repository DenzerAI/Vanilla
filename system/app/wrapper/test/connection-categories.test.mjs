import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionCategories,connectionCatalog,connectionCategory,connectionBrand,matchesConnection,groupConnections,catalogForFeatures} from '../ui/connection-catalog.mjs';
import {createMcpSnapshot} from '../integration-snapshot.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('every available service is grouped once; searches include categories and renamed providers',()=>{
 const entries=catalogForFeatures({crmConnections:true,serviceConnections:true});
 const grouped=groupConnections(entries).flatMap(g=>g.entries);
 assert.equal(grouped.length,entries.length);
 assert.equal(new Set(grouped).size,entries.length);
 for(const e of entries)assert.ok(connectionCategories.some(c=>c.id===connectionCategory(e)));
 assert.equal(connectionCategory({name:'Marketing',provider:'higgsfield',kind:'link'}),'design');
 assert.equal(connectionBrand({name:'Marketing',provider:'higgsfield',kind:'link'}),'Higgsfield');
 assert.ok(matchesConnection({name:'Designstudio',provider:'higgsfield',kind:'link'},'Higgsfield'));
 assert.ok(matchesConnection({name:'Büro',provider:'microsoft-graph',kind:'service'},'Outlook'));
 assert.ok(matchesConnection(connectionCatalog.find(e=>e.name==='Telegram'),'Messaging'));
 assert.equal(connectionCategory({name:'Custom tool',kind:'mcp'}),'automation');
 assert.deepEqual(groupConnections([]),[]);
});
test('slow MCP discovery never blocks local snapshot; concurrent reads share work',async()=>{
 let resolve,calls=0;
 const snapshot=createMcpSnapshot({load:()=>{calls++;return new Promise(r=>resolve=r);}});
 assert.deepEqual(snapshot('worker'),{mcp:[],mcpLoading:true,mcpError:null});
 snapshot('worker'); await settle(); assert.equal(calls,1);
 resolve([{name:'one'}]);await settle();
 assert.deepEqual(snapshot('worker'),{mcp:[{name:'one'}],mcpLoading:false,mcpError:null});
});
test('refresh failure retains tools; switching workers never exposes another worker snapshot',async()=>{
 let time=0,fail=false;
 const snapshot=createMcpSnapshot({now:()=>time,ttl:10,load:async id=>{if(fail)throw Error('private vendor message');return [{name:id}];}});
 snapshot('a');await settle();
 assert.equal(snapshot('a').mcp[0].name,'a');
 assert.deepEqual(snapshot('b').mcp,[]);await settle();
 time=11;fail=true;
 assert.equal(snapshot('a').mcp[0].name,'a');await settle();
 const result=snapshot('a');assert.equal(result.mcp[0].name,'a');assert.ok(result.mcpError);assert.ok(!result.mcpError.includes('private'));assert.equal(result.mcpLoading,false);
});
