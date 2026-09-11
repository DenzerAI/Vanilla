import test from 'node:test';
import assert from 'node:assert/strict';
import {chatMarkup} from '../ui/chat-rich-content.mjs';
import {fileKind, collectChatArtifacts} from '../ui/artifact-content.mjs';
import {generatedImageItems} from '../ui/tool-content.mjs';
import {normalizeTool, mergeTools} from '../tool-events.mjs';

const image = {type:'input_image', image_url:'data:image/png;base64,aGVsbG8='};
test('exec imagegen receipts survive public normalization and replay as visible results', () => {
  const call = normalizeTool({type:'custom_tool_call', call_id:'generation', name:'exec', input:'generatedImage(result)'});
  const done = normalizeTool({type:'custom_tool_call_output', call_id:'generation', output:[image,{type:'input_text',text:'Generated images are saved to /provider/generated_images/example.png by default.'}]},call);
  const thread = mergeTools({turns:[{id:'turn',items:[]}]},[{turnId:'turn',after:0,item:done}]);
  assert.deepEqual(generatedImageItems(thread.turns[0].items),[done]);
  assert.deepEqual(collectChatArtifacts([done],'/workspace'),[],'provider paths never become unrestricted file access');
  for (const status of ['failed','inProgress','interrupted']) assert.deepEqual(generatedImageItems([{...done,status}]),[]);
  assert.deepEqual(generatedImageItems([{...done,toolContent:[image]}]),[],'inspection images stay in activity');
  assert.deepEqual(generatedImageItems([{...done,type:'computerUse'}]),[]);
});

test('native image tools publish typed media, never remote references or fabricated paths', () => {
  const item = {id:'media',type:'mcpToolCall',tool:'image_generate',status:'completed',result:{content:[image]}};
  assert.equal(generatedImageItems([item]).length,1);
  assert.equal(generatedImageItems([{...item,result:{content:[{type:'input_image',image_url:'https://example.com/tracker.png'}]}}]).length,0);
});

test('SVG and all supported raster formats share inline and artifact image classification', () => {
  for (const ext of ['svg','png','jpg','jpeg','webp','gif','avif','bmp']) {
    const path=`output/chart.${ext}`;
    assert.equal(fileKind(path),'image');
    assert.match(chatMarkup(`![Diagramm](${path})`,'/workspace'),/<img src="\/api\/file\/raw/);
    assert.deepEqual(collectChatArtifacts([{type:'agentMessage',text:`[Diagramm](${path})`}],'/workspace').map(f=>f.path),[path]);
    assert.equal(collectChatArtifacts([{type:'fileChange',status:'completed',changes:[{path}]},{type:'agentMessage',text:`![Diagramm](${path})`}],'/workspace').length,0);
  }
  assert.equal(collectChatArtifacts([{type:'fileChange',status:'completed',changes:[{path:'wrapper/ui/logo.svg'}]}],'/workspace').length,0);
  assert.doesNotMatch(chatMarkup('![Privat](/outside/chart.svg)','/workspace'),/<img/);
});

test('complete SVG fences render inert image documents and retain copyable source', () => {
  const svg='<svg viewBox="0 0 100 100"><text y="20">Organigramm</text><script>window.pwned=true</script><image href="https://example.com/tracker.png"/></svg>';
  const html=chatMarkup('```svg\n'+svg+'\n```');
  assert.match(html,/class="chat-svg-preview"/);
  assert.match(html,/<img src="data:image\/svg\+xml/);
  assert.match(html,/xmlns%3D%22http/);
  assert.match(html,/SVG-Quelltext/);
  assert.match(html,/data-copy-code/);
  assert.doesNotMatch(html,/<svg|<script|<image\b/,'untrusted SVG never enters the app DOM');
  for (const code of ['```svg\n<svg><rect','```html\n'+svg+'\n```','```svg\n<div>wrong root</div>\n```']) assert.doesNotMatch(chatMarkup(code),/class="chat-svg-preview"/);
});
