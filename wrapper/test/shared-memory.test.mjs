import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedMemoryACPServers,sharedMemoryCodexConfig,configureGatewayMemory} from '../shared-memory.mjs';

test('MCP is injected per project for native ACP, and registered separately for OpenClaw',async()=>{
 const prior={...process.env};
 Object.assign(process.env,{AGENT_CORE_URL:'http://127.0.0.1:1989',AGENT_PYTHON:'/test/python',UWE_DATA_ROOT:'/test/data'});
 try {
  assert.equal(sharedMemoryACPServers('hermes','project-a')[0].args.at(-1),'project-a');
  assert.equal(sharedMemoryACPServers('claw-code','default').length,1);
  assert.deepEqual(sharedMemoryACPServers('openclaw','default'),[]);
  assert.equal(sharedMemoryCodexConfig()['mcp_servers.shared_memory.command'],'/test/python');
  const calls=[];
  await configureGatewayMemory('/test/openclaw',async(command,args)=>{calls.push(args);if(args[1]==='show')throw Object.assign(Error('missing'),{code:1});return {stdout:'{}'};});
  assert.deepEqual(calls.map(c=>c[1]),['show','set','probe']);
  assert.equal(JSON.parse(calls[1][3]).command,'/test/python');
  await assert.rejects(()=>configureGatewayMemory('/test/openclaw',async()=>({stdout:'{"command":"foreign"}'})),/Vorhandene Konfiguration/);
 }finally{for(const key of ['AGENT_CORE_URL','AGENT_PYTHON','UWE_DATA_ROOT']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
