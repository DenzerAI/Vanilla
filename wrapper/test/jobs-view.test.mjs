import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {filterJobs, jobState} from '../ui/jobs-view.mjs';
import {Storage} from '../storage.mjs';

test('system routines stay separate and recurring success stays active', () => {
  const daily = {id:'daily',name:'Briefing',status:'active',schedule:{type:'daily'},lastRun:{status:'completed'}};
  const once = {...daily,id:'once',schedule:{type:'once'}};
  const system = {...daily,id:'system-memory',managed:true};
  assert.equal(jobState(daily),'active');
  assert.equal(jobState(once),'completed');
  assert.equal(jobState({...once,schedule:{type:'once',at:'2099-01-01T09:00:00Z'}}),'active');
  const jobs=[daily,once,system];
  assert.deepEqual(filterJobs(jobs,'active').map(j=>j.id),['daily']);
  assert.deepEqual(filterJobs(jobs,'completed').map(j=>j.id),['once']);
  assert.deepEqual(filterJobs(jobs,'system').map(j=>j.id),['system-memory']);
  assert.equal(filterJobs(jobs,'templates').length,0);
  assert.equal(filterJobs(jobs,'all').length,2);
  assert.equal(filterJobs(jobs,'all','BRIEF').length,2);
  assert.equal(filterJobs([{...daily,status:'paused'}],'paused').length,1);
  assert.equal(jobState({...daily,lastRun:{status:'failed'}}),'attention');
});

test('workspace, model and reasoning survive reload and execution updates', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'job-selection-'));
  try {
    const store=new Storage(root,path.join(root,'control'));
    await store.init();
    const project=await store.saveProject({name:'Example workspace'});
    const saved=await store.saveJob({name:'Example routine',instructions:'Prepare a local summary.',worker:'codex',projectId:project.id,model:'gpt-6-test',effort:'high',schedule:{type:'daily',time:'09:00'},status:'paused'});
    await store.saveJobRun(saved.id,{lastRun:{status:'completed',runId:'example-run'}});
    const reloaded=new Storage(root,path.join(root,'control'));
    await reloaded.init();
    const [job]=await reloaded.jobs();
    assert.equal(job.projectId,project.id);
    assert.equal(job.model,'gpt-6-test');
    assert.equal(job.effort,'high');
    assert.equal(job.status,'paused');
  } finally {await rm(root,{recursive:true,force:true});}
});
