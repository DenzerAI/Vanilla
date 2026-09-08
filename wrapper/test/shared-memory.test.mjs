import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedMemoryACPServers,sharedMemoryCodexConfig,configureGatewayMemory} from '../shared-memory.mjs';

test('MCP is injected per project for native ACP, and OpenClaw keeps its existing gateway configuration',async()=>{
 const prior={...process.env};
 Object.assign(process.env,{AGENT_CORE_URL:'http://127.0.0.1:1989',AGENT_PYTHON:'/test/python',UWE_DATA_ROOT:'/test/data'});
 try {
  assert.equal(sharedMemoryACPServers('hermes','project-a')[0].args.at(-1),'project-a');
  assert.equal(sharedMemoryACPServers('claw-code','default').length,1);
  assert.deepEqual(sharedMemoryACPServers('openclaw','default'),[]);
  assert.equal(sharedMemoryCodexConfig()['mcp_servers.shared_memory.command'],'/test/python');
  await assert.rejects(configureGatewayMemory('/test/openclaw'), /Globale Gateway-Konfiguration.*deaktiviert/);
 }finally{for(const key of ['AGENT_CORE_URL','AGENT_PYTHON','UWE_DATA_ROOT']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
