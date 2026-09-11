import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectionCatalog, catalogForFeatures, matchesConnection, groupConnections} from '../ui/connection-catalog.mjs';
import {sharedMemoryACPServers,sharedMemoryCodexConfig} from '../shared-memory.mjs';

test('device transports share the connections category and stay hidden on older servers',()=>{
  assert.equal(catalogForFeatures({operations:true}).some(c=>c.kind==='device'),false);
  const devices=catalogForFeatures({deviceConnections:true,operations:true}).filter(c=>c.category==='devices');
  assert.equal(devices.length,3);
  assert.equal(groupConnections(devices)[0].name,'Geräte & Netzwerk');
  assert.ok(matchesConnection(devices.find(d=>d.provider==='android-adb'),'USB'));
  assert.ok(matchesConnection(devices.find(d=>d.provider==='samsung-tv'),'Tizen'));
  assert.ok(matchesConnection(devices.find(d=>d.provider==='tailscale'),'Serve'));
});

test('the shared MCP bridge binds worker identity outside model arguments',()=>{
  const old={...process.env};
  try {
    process.env.AGENT_CORE_URL='http://127.0.0.1:1989';process.env.AGENT_PYTHON='python3';process.env.UWE_DATA_ROOT='data/control';
    const server=sharedMemoryACPServers('claude-code','example')[0];
    assert.equal(server.args[server.args.indexOf('--worker')+1],'claude-code');
    assert.equal(server.args[server.args.indexOf('--project')+1],'example');
    const config=sharedMemoryCodexConfig();
    assert.equal(config['mcp_servers.shared_memory.args'][config['mcp_servers.shared_memory.args'].indexOf('--worker')+1],'codex');
    assert.deepEqual(sharedMemoryACPServers('openclaw','example'),[]);
  }finally {for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old);}
});
