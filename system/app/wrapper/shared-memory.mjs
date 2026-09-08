import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function sharedMemoryServer(projectId) {
  if(!process.env.AGENT_CORE_URL || !process.env.AGENT_PYTHON) return null;
  const port=new URL(process.env.AGENT_CORE_URL).port;
  return {name:'shared_memory',command:process.env.AGENT_PYTHON,args:[path.join(root,'core/mcp.py'),'--port',port,'--data',process.env.UWE_DATA_ROOT,...(projectId?['--project',projectId]:[])],env:[]};
}
export function sharedMemoryCodexConfig() {
  const server=sharedMemoryServer();
  return server?{'mcp_servers.shared_memory.command':server.command,'mcp_servers.shared_memory.args':server.args,'mcp_servers.shared_memory.env_vars':['AGENT_INTERNAL_TOKEN']}:{};
}

export function sharedMemoryACPServers(workerId, projectId) {
  if(workerId==='openclaw') return []; // OpenClaw explicitly rejects per-session MCP.
  const server=sharedMemoryServer(projectId);return server?[server]:[];
}

export async function configureGatewayMemory() {
  throw new Error("Globale Gateway-Konfiguration ist in Vanilla deaktiviert.");
}
