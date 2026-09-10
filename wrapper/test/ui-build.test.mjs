import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {recordUiBuild,verifyUiBuild} from '../../scripts/ui-build.mjs';

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'vanilla-ui-build-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const directory of ['wrapper/ui','wrapper/public','wrapper/dist/assets','system','scripts']) await mkdir(path.join(root,directory),{recursive:true});
  const put=(file,text)=>writeFile(path.join(root,file),text);
  for(const file of ['wrapper/ui/start.tsx','wrapper/public/login.css','wrapper/build.mjs','wrapper/vite.config.ts','wrapper/package-lock.json','scripts/ui-build.mjs','system/shared.mjs'])await put(file,'initial');
  for(const file of ['index.html','app.js','app.css','blueprint.html','blueprint.js','assets/shared.js'])await put('wrapper/dist/'+file,'built '+file);
  return {root,put};
}
test('UI verification requires a build tied to current sources and all shipped files',async t=>{
  const {root,put}=await fixture(t);
  await assert.rejects(verifyUiBuild(root),/Build fehlt/);
  const manifest=await recordUiBuild(root);
  assert.equal((await verifyUiBuild(root)).uiVersion,manifest.uiVersion);
  await put('wrapper/dist/assets/shared.js','changed');
  await assert.rejects(verifyUiBuild(root),/wurde verändert/);
  await put('wrapper/dist/assets/shared.js','built assets/shared.js');
  await rm(path.join(root,'wrapper/dist/blueprint.html'));
  await assert.rejects(verifyUiBuild(root),/Builddatei fehlt/);
});
test('source, shared modules and build configuration changes invalidate old output',async t=>{
  const {root,put}=await fixture(t);
  await recordUiBuild(root);
  for(const file of ['wrapper/ui/start.tsx','system/shared.mjs','wrapper/build.mjs','wrapper/vite.config.ts','wrapper/package-lock.json','scripts/ui-build.mjs']) {
    await put(file,'changed');
    await assert.rejects(verifyUiBuild(root),/passt nicht zum aktuellen Quellcode/,file);
    await put(file,'initial');
    assert.equal((await verifyUiBuild(root)).ok,true);
  }
});
test('legacy metadata and manifests with missing entrypoints or escaping paths cannot pass',async t=>{
  const {root,put}=await fixture(t);
  const manifest=await recordUiBuild(root);
  await put('wrapper/dist/version.json',JSON.stringify({uiVersion:manifest.uiVersion}));
  await assert.rejects(verifyUiBuild(root),/passt nicht/);
  const missing={...manifest,files:{...manifest.files}};delete missing.files['blueprint.js'];
  await put('wrapper/dist/version.json',JSON.stringify(missing));
  await assert.rejects(verifyUiBuild(root),/unvollständig/);
  await put('wrapper/dist/version.json',JSON.stringify({...manifest,files:{...manifest.files,'../outside':'invalid'}}));
  await assert.rejects(verifyUiBuild(root),/Ungültiger Dateipfad/);
});
test('the built reference and application share a verified production build',async()=>{
  const root=path.resolve(import.meta.dirname,'../..');
  const manifest=JSON.parse(await readFile(path.join(root,'wrapper/dist/version.json'),'utf8'));
  const bundle=await readFile(path.join(root,'wrapper/dist/blueprint.js'),'utf8');
  assert.ok(bundle.includes(manifest.uiVersion));
  const html=await readFile(path.join(root,'wrapper/dist/blueprint.html'),'utf8');
  assert.match(html,/blueprint\.js/);
  assert.doesNotMatch(html,/main\.tsx|app\.js/);
});
