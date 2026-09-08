import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,symlink,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {gitReview} from '../git-review.mjs';
import {agentFiles,agentFilePath} from '../agent-files.mjs';
async function fixture(t) {const root=await mkdtemp(path.join(os.tmpdir(),'workspace-tools-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('file browser lists actual entries while protecting secrets and escaped symlinks',async t=>{
 const root=await fixture(t);await mkdir(path.join(root,'folder'));await mkdir(path.join(root,'data'));await writeFile(path.join(root,'.env'),'test');await writeFile(path.join(root,'readme.md'),'test');await symlink(os.tmpdir(),path.join(root,'outside'));await symlink(path.join(root,'data'),path.join(root,'alias')); 
 const result=await agentFiles(root);assert.deepEqual(result.files.map(f=>f.name).sort(),(await readdir(root)).sort());assert.ok(result.files.find(f=>f.name==='readme.md').accessible);
 for(const name of ['.env','data','outside','alias']) {assert.equal(result.files.find(f=>f.name===name).accessible,false);await assert.rejects(agentFilePath(root,name));}
 await assert.rejects(agentFilePath(root,'../'));assert.deepEqual((await agentFiles(root,'folder')).files,[]);
});
test('review distinguishes staged, unstaged and new files, scopes subdirectories and handles renames',async t=>{
 const root=await fixture(t);const git=(...args)=>execFileSync('/usr/bin/git',args,{cwd:root});git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test');
 await mkdir(path.join(root,'nested'));await writeFile(path.join(root,'nested/a.txt'),'old\n');await writeFile(path.join(root,'other.txt'),'old\n');git('add','.');git('commit','-qm','initial');
 await writeFile(path.join(root,'nested/a.txt'),'staged\n');git('add','.');await writeFile(path.join(root,'nested/a.txt'),'unstaged\n');await writeFile(path.join(root,'nested/new.txt'),'new');await writeFile(path.join(root,'other.txt'),'outside\n');
 const result=await gitReview(path.join(root,'nested'));assert.equal(result.repository,true);assert.equal(result.files.length,2);const a=result.files.find(f=>f.path==='nested/a.txt');assert.match(a.staged,/\+staged/);assert.match(a.unstaged,/\+unstaged/);assert.equal(result.files.find(f=>f.path==='nested/new.txt').status,'??');
 git('mv','other.txt','renamed.txt');const renamed=(await gitReview(root)).files.find(f=>f.path==='renamed.txt');assert.ok(renamed);assert.match(renamed.status,/R/);
});
test('non-repository is an explicit empty state',async t=>{assert.equal((await gitReview(await fixture(t))).repository,false)});
