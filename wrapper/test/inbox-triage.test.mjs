import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxSections} from '../ui/inbox-triage.mjs';
const rows=[
 {id:'1',sender:'Kontakt',provider:'WhatsApp',done:false,unread:true},
 {id:'2',sender:'Shop',subject:'Rabatt',provider:'Gmail',accountId:'business',done:false,triage:{category:'promotion'}},
 {id:'3',sender:'Shop',subject:'Rechnung',provider:'Gmail',accountId:'personal',done:false,triage:{category:'receipts'}},
 {id:'4',sender:'Archiv',provider:'Gmail',accountId:'business',done:true,triage:{category:'promotion'}},
];
test('focus bundles mail and leaves messenger visible; all and search expose matching bundles',()=>{
 const focus=inboxSections(rows);
 assert.deepEqual(focus.main.map(r=>r.id),['1']);assert.equal(focus.bundles.length,2);
 assert.equal(inboxSections(rows,{view:'all'}).main.length,3);
 assert.deepEqual(inboxSections(rows,{query:'Rabatt'}).main.map(r=>r.id),['2']);
 assert.equal(inboxSections(rows,{category:'receipts'}).main[0].id,'3');
});
test('account, channel and status filters intersect and never silently include another mailbox',()=>{
 const result=inboxSections(rows,{view:'all',account:'business',provider:'Gmail'});
 assert.deepEqual(result.main.map(r=>r.id),['2']);
 assert.equal(inboxSections(rows,{account:'business',provider:'WhatsApp'}).main.length,0);
 assert.equal(inboxSections(rows,{view:'all',status:'done'}).main[0].id,'4');
 assert.equal(inboxSections(rows,{view:'all',status:'all'}).main.length,4);
});
