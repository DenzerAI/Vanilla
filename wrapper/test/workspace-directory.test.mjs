import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir,cp,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Storage} from '../storage.mjs';
import {readWorkspaceDefinition,workspaceDefinitionText,workspaceInstructions} from '../workspace-directory.mjs';
import {workspaceOnboardingOpener} from '../workspace-onboarding.mjs';
async function fixture(t){
  const dir=await mkdtemp(path.join(os.tmpdir(),'vanilla-workspaces-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const root=path.join(dir,'workspace'),data=path.join(dir,'control');
  const store=new Storage(root,data);await store.init();
  return {root,store,restart:async()=>{const next=new Storage(root,data);await next.init();return next;}};
}
test('opt-in definitions retain old instructions, identity, paths and unknown metadata',async t=>{
  const {store,root,restart}=await fixture(t);
  const identity=await readFile(path.join(root,'soul/IDENTITY.md'),'utf8');
  const original=await readFile(path.join(root,'AGENTS.md'),'utf8');
  const project=await store.saveProject({name:'Original'}),stablePath=project.path;
  const file=path.join(root,project.path,'AGENTS.md');
  await writeFile(file,'---\ncustom: keep\n---\n\n# Existing working instructions\nNever discard this.\n');
  await store.workspaces.refresh();
  const legacy=await store.workspaces.read(project);
  assert.equal(legacy.configured,false);
  await store.workspaces.update({id:project.id,revision:legacy.revision,name:'Revised',description:'Special purpose'});
  assert.equal(project.path,stablePath);assert.equal(project.name,'Revised');
  assert.match((await store.workspaces.read(project)).body,/custom: keep/);
  const current=await store.workspaces.read(project);
  await writeFile(file,workspaceDefinitionText({...current.metadata,extension:{keep:true}},current.body));
  await store.workspaces.update({id:project.id,revision:(await store.workspaces.read(project)).revision,name:'Again'});
  assert.deepEqual((await store.workspaces.read(project)).metadata.extension,{keep:true});
  assert.equal(await readFile(path.join(root,'AGENTS.md'),'utf8'),original);
  assert.equal(await readFile(path.join(root,'soul/IDENTITY.md'),'utf8'),identity);
  const again=await restart();assert.equal(again.project(project.id).name,'Again');assert.equal(again.project(project.id).path,stablePath);
  const defaultSource=await again.workspaces.read(again.project('default'));
  await again.workspaces.update({id:'default',revision:defaultSource.revision,name:'General'});
  assert.equal(again.state.settings.workspaceName,'General');
  assert.equal(await readFile(path.join(root,'soul/IDENTITY.md'),'utf8'),identity);
});
test('creation is repeatable and restart discovery reads only designated project folders',async t=>{
  const {store,root,restart}=await fixture(t);
  const [one,two]=await Promise.all([store.workspaces.create({requestId:'same-request'}),store.workspaces.create({requestId:'same-request'})]);
  assert.equal(one.id,two.id);assert.equal(store.state.projects.length,2);
  await mkdir(path.join(root,'projects/imported'));await mkdir(path.join(root,'input/foreign'));
  const source=workspaceDefinitionText({schema_version:1,id:'imported',name:'Imported'},'# Workflow\nExisting skills only.');
  await writeFile(path.join(root,'projects/imported/AGENTS.md'),source);
  await writeFile(path.join(root,'input/foreign/AGENTS.md'),workspaceDefinitionText({schema_version:1,id:'foreign',name:'Foreign'},''));
  const again=await restart();assert.equal(again.project('imported').name,'Imported');
  assert.equal(again.state.projects.some(p=>p.id==='foreign'),false);
  const context=workspaceInstructions(await again.workspaces.context('imported'));
  assert.match(context,/Workflow/);assert.match(context,/derselbe persönliche Assistent/);assert.match(context,/keine technischen Zugriffsrechte/);
  assert.match(await readFile(path.join(root,'WORKSPACES.md'),'utf8'),/Imported/);
});
test('conflicts, unknown schemas, duplicate IDs and symlinks do not overwrite data',async t=>{
  const {store,root}=await fixture(t);
  const p=await store.workspaces.create({requestId:'conflict-request'}),file=path.join(root,p.path,'AGENTS.md');
  const before=await store.workspaces.read(p);
  await writeFile(file,before.source+'\nAnother editor wrote here.\n');
  await assert.rejects(store.workspaces.update({id:p.id,revision:before.revision,name:'Overwrite'}),/inzwischen/);
  assert.match(await readFile(file,'utf8'),/Another editor/);
  await mkdir(path.join(root,'projects/duplicate'));await cp(file,path.join(root,'projects/duplicate/AGENTS.md'));
  await assert.rejects(store.workspaces.context(p.id),/mehreren Ordnern/);
  await assert.rejects(store.workspaces.update({id:p.id,revision:(await store.workspaces.read(p)).revision,name:'Ambiguous'}),/mehreren Ordnern/);
  await rm(path.join(root,'projects/duplicate'),{recursive:true});
  await writeFile(file,before.source.replace('schema_version: 1','schema_version: 99'));
  await assert.rejects(store.workspaces.context(p.id),/Unbekanntes Workspace/);
  await writeFile(file,before.source);await store.workspaces.refresh();
  const preserved=await readFile(path.join(root,'AGENTS.md'),'utf8');
  await rm(file);await symlink(path.join(root,'AGENTS.md'),file);
  await assert.rejects(store.workspaces.update({id:p.id,revision:before.revision,name:'Bad'}),/Verknüpfung/);
  assert.equal(await readFile(path.join(root,'AGENTS.md'),'utf8'),preserved);
  assert.equal((await store.workspaces.context('default')).active.id,'default');
});
test('a user-owned or linked directory index is preserved and does not block other chats',async t=>{
  const {store,root}=await fixture(t);
  await writeFile(path.join(root,'WORKSPACES.md'),'# My own directory\n');
  await store.workspaces.create({requestId:'keep-index'});
  assert.equal(await readFile(path.join(root,'WORKSPACES.md'),'utf8'),'# My own directory\n');
  assert.equal(store.workspaces.warnings.length,1);
  await rm(path.join(root,'WORKSPACES.md'));await symlink(path.join(root,'AGENTS.md'),path.join(root,'WORKSPACES.md'));
  assert.equal((await store.workspaces.context('default')).active.id,'default');assert.equal(store.workspaces.warnings.length,1);
});
test('onboarding survives concurrent requests, failures and restart without replaying a turn',async t=>{
  const {store,restart}=await fixture(t);let turns=0,chats=0;
  const deps=current=>({store:current,newChat:async props=>{const chat={id:'setup-'+(++chats),...props};current.state.chats.push(chat);return {thread:{id:chat.id}};},sendTurn:async()=>{turns++;throw Error('uncertain delivery');},emit:()=>{},updateChat:async(id,patch)=>{Object.assign(current.chat(id),patch);await current.save();}});
  const open=workspaceOnboardingOpener(deps(store));
  const [a,b]=await Promise.all([open({requestId:'onboard-request'}),open({requestId:'onboard-request'})]);
  assert.equal(a.thread.id,b.thread.id);assert.ok(a.startError);assert.equal(turns,1);assert.equal(chats,1);
  const again=await restart();again.chat(a.thread.id).archived=true;
  const resumed=await workspaceOnboardingOpener(deps(again))({projectId:a.project.id});
  assert.equal(resumed.thread.id,a.thread.id);assert.equal(resumed.resumed,true);assert.equal(again.chat(a.thread.id).archived,false);assert.equal(turns,1);
  const privateOpen=workspaceOnboardingOpener({...deps(again),canUseChat:async()=>false});
  await assert.rejects(privateOpen({projectId:a.project.id}),/privat/);assert.equal(turns,1);
});

test('legacy instructions are preserved even when longer than a new workspace profile',()=>{
  const source='# Existing instructions\n'+'A'.repeat(65000);
  assert.equal(readWorkspaceDefinition(source).body,source);
  assert.throws(()=>workspaceDefinitionText({schema_version:1,id:'new',name:'New'},source),/zu lang/);
});

test('creation and continuation requested through different entry points still share one chat',async t=>{
  const {store}=await fixture(t);let release,entered;
  const started=new Promise(resolve=>{entered=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  let created=0,sent=0;
  const open=workspaceOnboardingOpener({store,emit:()=>{},updateChat:async()=>{},sendTurn:async()=>{sent++;},newChat:async props=>{
    created++;entered();await gate;store.state.chats.push({id:'shared-setup',...props});return {thread:{id:'shared-setup'}};
  }});
  const first=open({requestId:'different-entry'});await started;
  const project=store.state.projects.find(p=>p.id!=='default');
  const second=open({projectId:project.id});release();
  assert.equal((await first).thread.id,(await second).thread.id);assert.equal(created,1);assert.equal(sent,1);
});

test('the general workspace reuses the already supplied root instructions instead of duplicating them',async t=>{
  const {store}=await fixture(t);
  const context=await store.workspaces.context('default');
  const block=workspaceInstructions(context);
  assert.ok(!block.includes(context.definition.source));assert.match(block,/oben frisch geladene lokale Einstieg/);
});
