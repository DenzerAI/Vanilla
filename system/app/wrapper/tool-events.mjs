// Normalize only public tool execution payloads. Raw model/developer messages and
// encrypted reasoning are never forwarded to the UI or stored in the transcript.
import {isComputerTool, publicToolContent} from './ui/tool-content.mjs';
import {patchChanges} from './ui/artifact-content.mjs';
const asText = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
export function normalizeTool(raw, previous) {
  if (!raw || typeof raw !== 'object') return null;
  if (["custom_tool_call", "function_call", "tool_use"].includes(raw.type)) {
    // MCP has a richer native item with the same call id; don't display it twice.
    if (/^mcp__/.test(raw.namespace || '')) return null;
    if (/request_user_input|requestUserInput|auth|secret/i.test(raw.name || "")) return null;
    const id = raw.call_id || raw.id;
    if (!id) return null;
    let args = raw.input ?? raw.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch {} }
    const name = raw.name || 'Werkzeug';
    let changes = patchChanges(typeof args === 'string' ? args : args?.patch);
    if (/^(Write|Edit|write_file|edit_file)$/i.test(name) && (args?.file_path || args?.path)) {
      const before = args.old_string, after = args.new_string ?? args.content;
      const diff = [typeof before === 'string' ? before.split('\n').map(l=>'-'+l).join('\n') : '', typeof after === 'string' ? after.split('\n').map(l=>'+'+l).join('\n') : ''].filter(Boolean).join('\n');
      changes = [{path:args.file_path || args.path, kind:before == null?'write':'update', diff}];
    }
    return {
      id: 'tool-' + id,
      type: changes.length ? 'fileChange' : isComputerTool({name}) ? 'computerUse' : 'commandExecution',
      command: asText(args?.command ?? args ?? name).slice(0,250000),
      toolName: name,
      status: 'inProgress',
      commandActions: [],
      aggregatedOutput: null,
      ...(changes.length ? {changes} : {}),
    };
  }
  if (["custom_tool_call_output", "function_call_output", "tool_result"].includes(raw.type) && previous) {
    const resultId = raw.call_id || raw.tool_use_id;
    if (resultId && previous.id !== 'tool-' + resultId) return null;
    const result = raw.output ?? raw.content;
    const output = Array.isArray(result) ? result.filter(x=>typeof x.text === 'string').map(x=>x.text).join('\n') : asText(result);
    const failed = raw.is_error === true || raw.isError === true || result?.isError === true || (typeof result?.exit_code === 'number' && result.exit_code !== 0);
    return {...previous, status:failed?'failed':'completed', aggregatedOutput:output.slice(0,250000), toolContent:publicToolContent(result)};
  }
  return null;
}
export function mergeTools(thread, records = []) {
  const copy = structuredClone(thread);
  for (const turn of copy.turns || []) {
    const nativeIds = new Set((turn.items || []).filter(i => !i.id?.startsWith('tool-')).map(i => i.id));
    const tools = records.filter((r) => r.turnId === turn.id && !nativeIds.has(r.item.id.replace(/^tool-/,'')));
    if (!records.some(r => r.turnId === turn.id)) continue;
    let count = 0;
    const items = [];
    const added = new Set();
    const append = () => {
      for (const tool of tools) {
        if (!added.has(tool.item.id) && tool.after <= count) {
          items.push(tool.item);
          added.add(tool.item.id);
        }
      }
    };
    append();
    for (const item of turn.items || []) {
      if (item.id?.startsWith("tool-")) continue;
      items.push(item);
      if (["userMessage", "agentMessage", "plan"].includes(item.type)) {
        count++;
        append();
      }
    }
    for (const tool of tools)
      if (!added.has(tool.item.id)) items.push(tool.item);
    turn.items = items;
  }
  return copy;
}
