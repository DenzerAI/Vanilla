const readline=require('node:readline'),fs=require('node:fs'),crypto=require('node:crypto');
const send=m=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...m})+'\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line),p=m.params||{};if(!m.method)return;
 const reply=result=>send({id:m.id,result});
 if(m.method==='initialize')return reply({userAgent:'Core fixture',protocolVersion:1,agentCapabilities:{loadSession:true},agentInfo:{name:'fixture',version:'1'}});
 if(m.method==='model/list')return reply({data:[{model:'fixture',displayName:'Fixture',isDefault:true}]});
 if(m.method==='account/read')return reply({});
 if(m.method==='mcpServerStatus/list')return reply({data:[]});
 if(m.method==='session/new')return reply({sessionId:crypto.randomUUID(),models:{currentModelId:'fixture',availableModels:[{modelId:'fixture',name:'Fixture'}]}});
 if(m.method==='session/load')return reply({models:{currentModelId:'fixture',availableModels:[{modelId:'fixture',name:'Fixture'}]}});
 if(m.method==='session/set_model')return reply({});
 if(m.method==='session/prompt'){
  if(process.env.FIXTURE_PROMPT_FILE)fs.appendFileSync(process.env.FIXTURE_PROMPT_FILE,JSON.stringify(p)+'\n');
  send({method:'session/update',params:{sessionId:p.sessionId,update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Testantwort aus dem Worker'}}}});
  return reply({stopReason:'end_turn'});
 }
 reply({});
});
