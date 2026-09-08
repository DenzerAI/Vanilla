import test from 'node:test';
import assert from 'node:assert/strict';
import {localFilePath,collectArtifacts,fileKind,diffLines} from '../ui/artifact-content.mjs';
import {normalizeTool} from '../tool-events.mjs';

test('local artifact paths reject remote schemes, encoded traversal and other workspaces',()=>{
  for(const path of ['https://example.com/a.png','//example.com/a.png','data:image/png;base64,x','../x','%2e%2e/x','output/%2eenv','/other/a.png','output\\a.png','output/a%00.png']) assert.equal(localFilePath(path,'/workspace'),null,path);
  assert.equal(localFilePath('/workspace/output/My%20Report.pdf:12','/workspace'),'output/My Report.pdf');
  assert.equal(localFilePath('./output/chart.png','/workspace'),'output/chart.png');
});

test('artifacts deduplicate links and changes without inventing files from prose or failed writes',()=>{
 const items=[{type:'agentMessage',text:'[Report](output/report.pdf) ![Chart](output/chart.png) Plain output/no.txt [remote](https://example.com/a.png)'},{type:'fileChange',status:'completed',changes:[{path:'/workspace/output/report.pdf'},{path:'deleted.txt',kind:'delete'}]},{type:'fileChange',status:'failed',changes:[{path:'failed.txt'}]}];
 assert.deepEqual(collectArtifacts(items,'/workspace').map(f=>f.path),[]);
 assert.equal(fileKind('report.docx'),'download');assert.equal(fileKind('report.md'),'text');
});

test('Codex patches and Claude edits retain explicit diffs and error outcomes',()=>{
 const patch=normalizeTool({type:'custom_tool_call',call_id:'a',name:'apply_patch',input:'*** Begin Patch\n*** Update File: output/a.txt\n@@\n-before\n+after\n*** End Patch'});
 const edit=normalizeTool({type:'tool_use',id:'a',name:'Edit',input:{file_path:'output/a.txt',old_string:'before',new_string:'after'}});
 for(const call of [patch,edit]) {
  assert.equal(call.type,'fileChange');assert.equal(call.changes[0].path,'output/a.txt');assert.match(call.changes[0].diff,/-before\n\+after/);
  assert.equal(normalizeTool({type:'tool_result',tool_use_id:'a',is_error:true,content:'Permission denied'},call).status,'failed');
  assert.equal(normalizeTool({type:'tool_result',tool_use_id:'other',content:'OK'},call),null);
 }
 const lines=diffLines('@@ hunk\n--- a\n+++ b\n-old\n+new\n same',5);
 assert.deepEqual(lines.lines.map(l=>l.kind),['header','header','header','removed','added']);assert.equal(lines.total,6);
});

test('relative artifacts stay in the originating project rather than the workspace root',()=>{
 assert.equal(localFilePath('output/chart.png','/workspace','/workspace/projects/demo'),'projects/demo/output/chart.png');
 assert.equal(localFilePath('/workspace/output/chart.png','/workspace','/workspace/projects/demo'),'output/chart.png');
 assert.equal(localFilePath('output/chart.png','/workspace','/other'),null);
});


test('inline file links suppress matching artifacts regardless of order and path spelling',()=>{
 const tool={type:'fileChange',status:'completed',changes:[{path:'/workspace/projects/demo/output/My Report.md'},{path:'output/other.csv'}]};
 const answer={type:'agentMessage',text:'[Prüfdetails](<output/My%20Report.md#result>)'};
 for(const items of [[tool,answer],[answer,tool]]) assert.deepEqual(collectArtifacts(items,'/workspace','/workspace/projects/demo').map(f=>f.path),['projects/demo/output/other.csv']);
 assert.equal(collectArtifacts([tool,{...answer,phase:'commentary'}],'/workspace','/workspace/projects/demo').length,2);
 assert.equal(collectArtifacts([tool,{...answer,text:'`[example](output/My%20Report.md)`'}],'/workspace','/workspace/projects/demo').length,2);
});
