import test from 'node:test';
import assert from 'node:assert/strict';
import {monthGrid,timedLayout} from '../ui/planner-dates.mjs';

test('month cells remain aligned across leap days and year boundaries', () => {
  const february = monthGrid('2024-02-17');
  assert.equal(february[0][0], '2024-01-29');
  assert.equal(february.at(-1).at(-1), '2024-03-03');
  assert.ok(february.flat().includes('2024-02-29'));
  assert.ok(february.every(week => week.length === 7));
  assert.equal(monthGrid('2026-01-01')[0][0], '2025-12-29');
  assert.ok(monthGrid('2026-08-01',true).every(week => week.length === 5));
});
const event = (id,start,end,allDay=false) => ({id,start,end,allDay});
test('chained overlaps share columns, adjacent appointments reuse their space', () => {
  const result = timedLayout([event('a','09:00','10:00'),event('b','09:30','11:00'),event('c','10:30','12:00'),event('d','12:00','13:00')]);
  assert.deepEqual(result.map(x => [x.event.id,x.column,x.columns]), [['a',0,2],['b',1,2],['c',0,2],['d',0,1]]);
});
test('nested events remain individually reachable and all-day items stay outside timeline', () => {
  const result=timedLayout([event('a','09:00','13:00'),event('b','10:00','11:00'),event('c','10:15','10:30'),event('day','','',true)]);
  assert.equal(result.length,3);
  assert.deepEqual(result.map(x => x.columns),[3,3,3]);
  assert.equal(result[2].start,615);
  assert.equal(result[2].end,630);
});
