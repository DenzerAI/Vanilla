import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {auditSource,auditDesign} from '../scripts/design-audit.mjs';
import {renderDesignCSS} from '../ui/design-system.mjs';
const rules=(file,source)=>auditSource(file,source,new Set(['--text','--space-8','--radius-control'])).map(i=>i.rule);

test('finds hardcoded values across CSS syntax and inline JSX',()=>{
 for(const declaration of ['color: rebeccapurple','border:1px solid #fff','border:1px solid red','background:rgb(1 2 3)','background:linear-gradient(red,var(--text))','background-image:linear-gradient(papayawhip,blue)','color:var(--text, #fff)'])assert.ok(rules('nested/new.css',`.a{${declaration}}`).includes('color'),declaration);
 for(const declaration of ['font-size:14px','font-family:Arial','font-weight:600','line-height:1.4','letter-spacing:.1em'])assert.ok(rules('a.css',`.a{${declaration}}`).includes('typography'),declaration);
 for(const declaration of ['gap:12px','padding-inline:1rem','margin:-8px'])assert.ok(rules('a.css',`.a{${declaration}}`).includes('spacing'),declaration);
 assert.ok(rules('a.css','.a{border-top-left-radius:12px}').includes('radius'));
 assert.ok(rules('new.tsx','export const Demo=()=> <div style={{padding:12,color:"red",fontSize:"14px"}}/>').includes('spacing'));
 assert.ok(rules('new.mjs', 'const style={padding:12,color:"red"}').includes('spacing'));
 assert.ok(rules('new.jsx','const D=()=> <div style={{...styles}}/>').includes('dynamic-style'));
 assert.ok(rules('new.jsx','const D=()=> <div style={{gap}}/>').includes('dynamic-style'));
 assert.ok(rules('new.jsx','const Demo=()=> <div style={customStyles}/>').includes('dynamic-style'));
 assert.ok(rules('new.tsx','const Demo=()=> <div className="bg-red-500 sm:p-4 -m-2 text-sm"/>').includes('utility-token'));
 assert.ok(rules('new.tsx','const Demo=()=> <div style={{color:"var(--missing)"}}/>').includes('unknown-token'));
});

test('accepts semantic tokens and structural geometry',()=>{
 assert.deepEqual(rules('a.css','button:focus:not(:focus-visible){outline:none}'),[]);
 assert.deepEqual(rules('a.css','.a{color:var(--text);gap:var(--space-8);padding:0;border-radius:var(--radius-control);width:320px;font-variant-numeric:tabular-nums}'),[]);
 assert.deepEqual(rules('a.tsx','const Demo=()=> <button aria-label="Öffnen" className="icon-button" style={{width:32}}>+</button>'),[]);
});

test('rejects alternate shared components and inaccessible interaction patterns',()=>{
 assert.ok(rules('other.jsx','function SettingRow(){return <div/>}').includes('shared-component'));
 assert.ok(rules('other.tsx','const D=()=> <dialog/>').includes('shared-component'));
 assert.ok(rules('a.jsx','const D=()=> <div className="setting-row"/>').includes('shared-component'));
 assert.ok(rules('a.jsx','const D=()=> <div onClick={run}/>').includes('keyboard'));
 assert.ok(rules('a.jsx','const D=()=> <button className="icon-button"/>').includes('accessible-name'));
 assert.ok(rules('a.jsx','const D=()=> <button role="switch"/>').includes('switch-state'));
 assert.ok(rules('a.css','button:focus-visible{outline:none}').includes('focus'));
 assert.deepEqual(rules('a.jsx','const D=()=> <button role="switch" className="apple-switch" aria-label="Aktiv" aria-checked={on}/>'),[]);
});

test('discovers new nested UI and public files, fails unknown assets and stale exemptions',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'design-audit-'));
 try{
  for(const d of ['ui/nested','public','scripts'])await mkdir(path.join(root,d),{recursive:true});
  await writeFile(path.join(root,'ui/design-tokens.css'),renderDesignCSS());
  await writeFile(path.join(root,'scripts/design-exceptions.json'),'{}');await writeFile(path.join(root,'scripts/design-assets.json'),'{}');
  await writeFile(path.join(root,'ui/nested/new.css'),'.a{color:#abcdef}');
  await writeFile(path.join(root,'public/new.css'),'.a{gap:11px}');
  await writeFile(path.join(root,'ui/nested/new.svg'),'<svg/>');
  let result=await auditDesign(root);
  assert.ok(result.issues.some(i=>i.file==='ui/nested/new.css'&&i.rule==='color'));
  assert.ok(result.issues.some(i=>i.file==='public/new.css'&&i.rule==='spacing'));
  assert.ok(result.issues.some(i=>i.rule==='asset-review'));
  assert.ok(result.issues.some(i=>i.rule==='interaction-contract'));
  await writeFile(path.join(root,'scripts/design-exceptions.json'),JSON.stringify({'missing|spacing|anything':'No longer needed'}));
  result=await auditDesign(root);assert.ok(result.issues.some(i=>i.rule==='stale-exception'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('the entire current surface tree passes the mandatory audit',async()=>{
 const result=await auditDesign();assert.deepEqual(result.issues,[]);assert.ok(result.checked>80);
});

test('a real production build refuses a new bad stylesheet before replacing dist',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {readFile}=await import('node:fs/promises');
 const {fileURLToPath}=await import('node:url');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const injected=path.join(root,'ui/design-audit-rejection-fixture.css');
 let before;try{before=await readFile(path.join(root,'dist/version.json'),'utf8');}catch{}
 try{
  await writeFile(injected,'.forbidden{color:#123456;padding:13px}',{flag:'wx'});
  const result=spawnSync(process.execPath,['build.mjs'],{cwd:root,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/design-audit-rejection-fixture.css/);
  if(before!==undefined)assert.equal(await readFile(path.join(root,'dist/version.json'),'utf8'),before);
 }finally{await rm(injected,{force:true});}
});

test('adoption gate rejects a different working copy instead of approving the staged UI',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 // A pre-commit hook exports its real worktree/index. The fixture must own its Git state.
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
 const root=await mkdtemp(path.join(os.tmpdir(),'design-adoption-'));
 try{
  await mkdir(path.join(root,'wrapper/ui'),{recursive:true});
  const initialized=spawnSync('git',['init','-q'],{cwd:root,env});
  assert.equal(initialized.status,0);
  const file=path.join(root,'wrapper/ui/new.css');await writeFile(file,'.a{padding:0}');
  assert.equal(spawnSync('git',['add','.'],{cwd:root,env}).status,0);
  await writeFile(file,'.a{padding:13px}');
  const script=fileURLToPath(new URL('../../scripts/verify-design-adoption.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,'commit'],{cwd:root,env,encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/staged and working UI differ/);
 }finally{await rm(root,{recursive:true,force:true});}
});
