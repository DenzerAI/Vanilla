import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Storage } from '../storage.mjs';
import { validateAppearance, projectChatList, relativeTime } from '../ui/appearance.mjs';
test('sidebar limits recent chats per project and keeps pinned chats available', () => {
  const chats = Array.from({length: 9}, (_,i) => ({id: String(i), projectId:'a', updatedAt:i, pinned:i===0}));
  chats.push({id:'other',projectId:'b',updatedAt:999}, {id:'archive',projectId:'a',archived:true});
  assert.deepEqual(projectChatList(chats,'a',false).visible.map(c=>c.id), ['0','8','7','6','5','4']);
  assert.equal(projectChatList(chats,'a',true).visible.length,9);
  assert.equal(projectChatList(chats,'a',false).more,true);
  assert.equal(relativeTime(0,180000),'vor 3 Min.');
  assert.throws(()=>validateAppearance({textSize:'huge'}));
  assert.deepEqual(validateAppearance({uiFont:'system',unknown:true}),{uiFont:'system'});
});
test('project symbols persist and invalid icons cannot change the project', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'sidebar-project-'));
  try {
    const store=new Storage(path.join(dir,'workspace'),path.join(dir,'data'));
    await store.init();
    const project=await store.saveProject({name:'Web',icon:'globe'});
    await store.saveProject({id:project.id,name:'Web',icon:'code'});
    await assert.rejects(store.saveProject({id:project.id,name:'Bad',icon:'invalid'}));
    const restored=new Storage(path.join(dir,'workspace'),path.join(dir,'data'));await restored.init();
    assert.equal(restored.project(project.id).icon,'code');
    assert.equal(restored.project(project.id).name,'Web');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('project colors persist in state and metadata, survive renaming, and validate before mutation', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'project-colors-'));
  try {
    const workspace = path.join(dir, 'workspace'), data = path.join(dir, 'data');
    const store = new Storage(workspace, data);
    await store.init();
    const project = await store.saveProject({name:'Farben', icon:'globe', color:'blue'});
    await store.saveProject({id:project.id, name:'Farben', color:'purple'});
    await store.saveProject({id:project.id, name:'Umbenannt'});
    await assert.rejects(store.saveProject({id:project.id, name:'Ungültig', color:'#ff0000'}));
    const restored = new Storage(workspace, data); await restored.init();
    assert.equal(restored.project(project.id).color, 'purple');
    assert.equal(restored.project(project.id).name, 'Umbenannt');
    assert.equal(restored.project(project.id).icon, 'globe');
    const metadata = JSON.parse(await readFile(path.join(workspace, project.path, 'project.json'), 'utf8'));
    assert.equal(metadata.color, 'purple');
    await restored.saveProject({id:project.id, name:'Umbenannt', color:'default'});
    assert.equal(restored.project(project.id).color, 'default');
    await restored.saveProject({id:'default', name:'Allgemein', color:'green'});
    const again = new Storage(workspace, data); await again.init();
    assert.equal(again.project('default').color, 'green');
    assert.equal((await again.saveProject({name:'Neutral'})).color, 'default');
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('chat date groups use calendar boundaries and keep pinned chats separate', async () => {
  const { chatDateGroup } = await import('../ui/appearance.mjs');
  const now = new Date(2026, 8, 7, 0, 5).getTime();
  const group = (day, hour = 12) => chatDateGroup({ updatedAt: new Date(2026, 8, day, hour).getTime() }, now);
  assert.equal(group(7, 0), 'Heute');
  assert.equal(group(6, 23), 'Gestern');
  assert.equal(group(1), 'Letzte 7 Tage');
  assert.equal(group(0), 'Letzte 30 Tage');
  assert.equal(chatDateGroup({updatedAt: new Date(2026, 7, 1).getTime()}, now), 'Älter');
  assert.equal(chatDateGroup({pinned: true, updatedAt: now}, now), 'Angeheftet');
  assert.equal(chatDateGroup({updatedAt: 'invalid'}, now), 'Älter');
  const afterDST = new Date(2026, 2, 30, 0, 5).getTime();
  assert.equal(chatDateGroup({updatedAt: new Date(2026, 2, 29, 0, 1).getTime()}, afterDST), 'Gestern');
});

test('welcome effect accepts off, new chats and all chats and persists across storage reloads', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'welcome-effect-'));
  try {
    const store = new Storage(path.join(dir, 'workspace'), path.join(dir, 'data'));
    await store.init();
    for (const value of ['off', 'on', 'all']) {
      Object.assign(store.state.settings, validateAppearance({welcomeParticles: value}));
      await store.save();
      const restored = new Storage(path.join(dir, 'workspace'), path.join(dir, 'data'));
      await restored.init();
      assert.equal(restored.state.settings.welcomeParticles, value);
    }
    for (const value of [true, false, 'invalid', null]) assert.throws(() => validateAppearance({welcomeParticles: value}));
  } finally { await rm(dir, {recursive:true, force:true}); }
});

test('color world and highlight persist and reject unknown choices', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'appearance-palette-'));
  try {
    const store=new Storage(path.join(dir,'workspace'),path.join(dir,'data'));await store.init();
    Object.assign(store.state.settings,validateAppearance({designTone:'neutral',highlightColor:'sage'}));await store.save();
    const restored=new Storage(path.join(dir,'workspace'),path.join(dir,'data'));await restored.init();
    assert.equal(restored.state.settings.designTone,'neutral');assert.equal(restored.state.settings.highlightColor,'sage');
    assert.throws(()=>validateAppearance({designTone:'blueish'}));assert.throws(()=>validateAppearance({highlightColor:'#123456'}));
  } finally {await rm(dir,{recursive:true,force:true});}
});
