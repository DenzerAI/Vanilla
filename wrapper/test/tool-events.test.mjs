import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTool, mergeTools } from "../tool-events.mjs";
test("only tool activity is normalized; prompts and encrypted reasoning stay out", () => {
  for (const raw of [
    { type: "message", role: "developer", content: [{ text: "private" }] },
    { type: "reasoning", encrypted_content: "private" },
    {
      type: "function_call",
      name: "request_user_input",
      arguments: "private",
      call_id: "1",
    },
  ])
    assert.equal(normalizeTool(raw), null);
  const call = normalizeTool({
    type: "custom_tool_call",
    name: "exec",
    call_id: "1",
    input: "pwd",
  });
  assert.equal(call.status, "inProgress");
  const done = normalizeTool(
    {
      type: "custom_tool_call_output",
      call_id: "1",
      output: [{ type: "input_text", text: "/workspace" }],
    },
    call,
  );
  assert.equal(done.aggregatedOutput, "/workspace");
  assert.equal(done.status, "completed");
});
test("portable history retains tool output at its conversational position", () => {
  const thread = {
    turns: [
      {
        id: "t",
        items: [
          { type: "userMessage", id: "u" },
          { type: "agentMessage", id: "a", text: "Checking" },
          { type: "agentMessage", id: "b", text: "Done" },
        ],
      },
    ],
  };
  const record = {
    turnId: "t",
    after: 2,
    item: {
      id: "tool-1",
      type: "commandExecution",
      command: "pwd",
      status: "completed",
    },
  };
  const result = mergeTools(thread, [record]);
  assert.deepEqual(
    result.turns[0].items.map((i) => i.id),
    ["u", "a", "tool-1", "b"],
  );
  assert.equal(thread.turns[0].items.length, 3);
  assert.deepEqual(mergeTools(result, [record]), result);
});
