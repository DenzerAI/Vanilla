// Keep the pinned native adapter's protocol and CLI, adding only model identity metadata.
import { runAcp } from '@agentclientprotocol/claude-agent-acp/dist/acp-agent.js';
import { decorateClaudeModelMetadata } from './worker-models.mjs';

if (process.argv.some(arg => ['--cli', '--version', '-v'].includes(arg))) {
  await import('@agentclientprotocol/claude-agent-acp/dist/index.js');
} else {
  const {connection, agent} = runAcp();
  decorateClaudeModelMetadata(agent);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await agent.dispose().catch(error => console.error(error));
    process.exit(0);
  };
  connection.closed.then(shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.stdin.resume();
}
