import test from 'node:test';
import assert from 'node:assert/strict';
import {chatMarkup} from '../ui/chat-rich-content.mjs';
import {isComputerTool,toolImages,toolOutputText,computerToolStatus,publicToolContent} from '../ui/tool-content.mjs';
import {normalizeTool,mergeTools} from '../tool-events.mjs';
import {activityLabel} from '../ui/chat-presentation.mjs';
const image={type:'image',mimeType:'image/png',data:'aGVsbG8='};
test('formatted answers retain tables, nested lists, styles, links and copyable code',()=>{
 const html=chatMarkup('# Titel\n\n**Fett** *Kursiv* ~~Alt~~ [Link](https://example.com)\n\n- Eins\n  - Zwei\n\n| A | B |\n|--|--|\n| 1 | 2 |\n\n```js\nconst x = "<img>";\n```');
 for(const tag of ['h1','strong','em','del','a','ul','table','code'])assert.match(html,new RegExp('<'+tag+'[ >]'));
 assert.match(html,/role="region" aria-label="Tabelle" tabindex="0"/);assert.match(html,/data-copy-code/);assert.match(html,/&lt;img&gt;/);
});
test('image markdown serves only workspace images; remote pictures need an explicit click',()=>{
 assert.match(chatMarkup('![Test](/work/input/test.png)','/work'),/src="\/api\/file\/raw\?path=input%2Ftest.png"/);
 for(const href of ['https://example.com/tracker.png','//example.com/tracker.png','/outside/test.png','../secret.png','data:image/svg+xml,foo','javascript:alert(1)'])assert.doesNotMatch(chatMarkup(`![Test](${href})`,'/work'),/<img /);
 assert.doesNotMatch(chatMarkup('<img src="https://example.com/tracker.png"><script>x</script>'),/<img |<script>/);
});
test('Codex MCP and Claude content images render without exposing base64 as text',()=>{
 for(const item of [
  {server:'cua_repl',tool:'js',result:{content:[image]}},
  {toolName:'computer',output:[{type:'image',source:{type:'base64',media_type:'image/png',data:image.data}}]},
  {type:'computerUse',toolContent:[{type:'input_image',image_url:'data:image/png;base64,'+image.data}]}
 ]) {assert.equal(isComputerTool(item),true);assert.equal(toolImages(item).length,1);assert.doesNotMatch(toolOutputText(item),/aGVsbG8/);}
 assert.equal(toolImages({output:[{type:'input_image',image_url:'https://example.com/track.png'}]}).length,0);
 assert.equal(publicToolContent(Array(9).fill(image)).length,4);
 assert.equal(publicToolContent([{...image,mimeType:'image/svg+xml'}]).length,0);
});
test('computer activity is distinguishable from web search and preserves failure state',()=>{
 assert.equal(isComputerTool({toolName:'web__run'}),false);
 assert.match(activityLabel({server:'cua_repl',tool:'js',status:'inProgress'},true),/Computer Use/);
 assert.equal(activityLabel({server:'cua_repl',tool:'js',status:'failed'},false),'Computer Use fehlgeschlagen');
 assert.deepEqual(computerToolStatus([{name:'cua_repl',tools:{js:{}}}]),{state:'detected',tools:['cua_repl · js']});
 assert.equal(computerToolStatus([{name:'computer-use',tools:{}}]).state,'unavailable');
});
test('native MCP items supersede legacy raw duplicates without dropping screenshots or other tools',()=>{
 assert.equal(normalizeTool({type:'function_call',namespace:'mcp__cua_repl',name:'js',call_id:'one'}),null);
 const native={id:'one',type:'mcpToolCall',server:'cua_repl',tool:'js',result:{content:[image]}};
 const thread={turns:[{id:'turn',items:[{id:'user',type:'userMessage'},{id:'tool-one',type:'commandExecution'},native]}]};
 const result=mergeTools(thread,[{turnId:'turn',after:1,item:{id:'tool-one',type:'commandExecution'}}]);
 assert.deepEqual(result.turns[0].items.map(i=>i.id),['user','one']);assert.equal(toolImages(result.turns[0].items[1]).length,1);
});
test('Claude tool results retain typed pictures and failed tool status',()=>{
 const call=normalizeTool({type:'tool_use',id:'one',name:'computer',input:{action:'screenshot'}});
 const result=normalizeTool({type:'tool_result',tool_use_id:'one',is_error:true,content:[image,{type:'text',text:'abgebrochen'}]},call);
 assert.equal(result.type,'computerUse');assert.equal(result.status,'failed');assert.equal(toolImages(result).length,1);
});
