import test from 'node:test';
import assert from 'node:assert/strict';
import {activityDetailLabel, changeStats} from '../ui/activity-detail.mjs';

const command = text => ({type:'commandExecution', status:'completed', command:text});
test('specific labels come from public invocations, including literal shell wrappers', () => {
  assert.equal(activityDetailLabel(command('npm --prefix wrapper run build')), 'Build ausgeführt');
  assert.equal(activityDetailLabel(command('npm --prefix wrapper run design:verify')), 'UI-Prüfungen ausgeführt');
  assert.equal(activityDetailLabel(command('node --test test/*.mjs')), 'Tests ausgeführt');
  assert.equal(activityDetailLabel({...command(''),command:JSON.stringify({cmd:'rg -n composer ui'})}), 'Code durchsucht');
  const wrapped = {...command('text(await tools.exec_command({cmd:"npm test"}));'),toolName:'exec'};
  assert.equal(activityDetailLabel(wrapped), 'Tests ausgeführt');
  assert.equal(activityDetailLabel({...wrapped,status:'inProgress'},true), 'Führt Tests aus');
  assert.equal(activityDetailLabel({...command(''),commandActions:[{type:'read',path:'/project/ui/styles.css'}]}), 'styles.css · gelesen');
});
test('labels never infer successful work or purpose from output, keywords or dynamic code', () => {
  for (const cmd of ['echo npm test','npm install test','npm exec echo build','pwd; npm test','pwd\nnpm test']) {
    assert.equal(activityDetailLabel(command(cmd)), 'Befehle ausgeführt');
  }
  assert.equal(activityDetailLabel({...command(''),aggregatedOutput:'npm test succeeded'}), 'Befehle ausgeführt');
  assert.equal(activityDetailLabel({...command('npm test'),status:'failed'}), 'Befehl fehlgeschlagen');
  assert.equal(activityDetailLabel({...command('npm test'),status:'inProgress'}), 'Befehl ohne Abschluss');
  assert.equal(activityDetailLabel({...command('text(await tools.exec_command({cmd: userInput}));'),toolName:'exec'}), 'Befehle ausgeführt');
  assert.doesNotThrow(()=>activityDetailLabel(command('{"cmd":42}')));
});
test('file labels and diff counts use supplied changes without inventing missing diffs', () => {
  const changes = [{path:'/project/ui/chat.css',diff:'--- a/chat.css\n+++ b/chat.css\n@@ -1,2 +1,3 @@\n-old\n+new\n+++ actual added content\n context'}];
  assert.equal(activityDetailLabel({type:'fileChange',status:'completed',changes}), 'chat.css · bearbeitet');
  assert.deepEqual(changeStats(changes), {added:2,removed:1,partial:false});
  assert.deepEqual(changeStats([...changes,{path:'missing.css'}]), {added:2,removed:1,partial:true});
  assert.equal(changeStats([{path:'missing.css'}]), null);
  assert.deepEqual(changeStats([{diff:'-before\n+after'}]), {added:1,removed:1,partial:false});
  assert.equal(changeStats([]), null);
});
