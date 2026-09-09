import test from 'node:test';
import assert from 'node:assert/strict';
import {readUserProfile,writeUserProfile,saveUserProfile,emptyUserProfile} from '../ui/user-profile.mjs';
test('profile edits preserve other Markdown and keep the user separate from the agent',()=>{
 const source=emptyUserProfile+'\n## Ziele\nDokumente ordnen.\n';
 const result=writeUserProfile(source,{name:'Testperson',location:'Beispielstadt'});
 assert.deepEqual(readUserProfile(result),{name:'Testperson',location:'Beispielstadt'});
 assert.ok(result.endsWith('## Ziele\nDokumente ordnen.\n'));
 assert.throws(()=>writeUserProfile(source,{name:'Name\nAvatar: x',location:''}));
});
test('profile save rejects a changed file and does not write stale data',async()=>{
 const calls=[];const api=async(path,data)=>{calls.push({path,data});return {text:'newer'};};
 await assert.rejects(saveUserProfile(api,emptyUserProfile,{name:'Testperson',location:''}),/inzwischen geändert/);
 assert.equal(calls.length,1);
});
test('profile uses the existing workspace file API and returns only after successful save',async()=>{
 let stored=emptyUserProfile;
 const api=async(path,data)=>{if(data){assert.equal(data.path,'soul/USER.md');stored=data.text;return {ok:true};}return {text:stored};};
 const text=await saveUserProfile(api,stored,{name:'Testperson',location:'Beispielstadt'});
 assert.equal(text,stored);assert.equal(readUserProfile(stored).location,'Beispielstadt');
 await assert.rejects(saveUserProfile(async(path,data)=>{if(data)throw Error('Speichern fehlgeschlagen');return {text:stored};},stored,{name:'Neu',location:''}),/Speichern fehlgeschlagen/);
});
