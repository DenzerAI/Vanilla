import test from 'node:test';
import assert from 'node:assert/strict';
import {demoSessions,selectSessions,sessionTotals,durationLabel} from '../ui/work-evidence.mjs';
test('September isolates operator time from overlapping agent runtime',()=>{
 const rows=selectSessions(demoSessions,'2026-09-01','2026-09-30');
 assert.equal(rows.length,4);assert.deepEqual(sessionTotals(rows),{human:75,agent:20});
 assert.equal(rows[0].id,'demo-2');
});
test('inclusive day boundaries and empty range',()=>{
 assert.equal(selectSessions(demoSessions,'2026-09-09','2026-09-09').length,2);
 assert.deepEqual(sessionTotals(selectSessions(demoSessions,'2026-10-01','2026-10-31')),{human:0,agent:0});
 assert.equal(durationLabel(75),'1 Std. 15 Min.');assert.equal(durationLabel(0),'0 Min.');
});
test('filter never mutates fixtures and invalid durations cannot inflate totals',()=>{
 const original=JSON.stringify(demoSessions);selectSessions(demoSessions,'','');assert.equal(JSON.stringify(demoSessions),original);
 assert.deepEqual(sessionTotals([{kind:'human',minutes:-8},{kind:'agent',minutes:NaN},{kind:'unknown',minutes:5}]),{human:0,agent:0});
});
