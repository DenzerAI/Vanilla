import test from "node:test";
import assert from "node:assert/strict";
import { runMode } from "../run-mode.mjs";

test("planning disallows filesystem writes and escalation; execution gets full access", () => {
  const plan = runMode("plan");
  assert.equal(plan.sandbox, "read-only");
  assert.deepEqual(plan.sandboxPolicy, { type: "readOnly" });
  assert.equal(plan.approvalPolicy, "never");
  assert.equal(plan.permission, "read");
  assert.deepEqual(runMode().sandboxPolicy, { type: "dangerFullAccess" });
  assert.equal(runMode().permission, "full");
  assert.equal(runMode().approvalPolicy, "never");
  assert.throws(() => runMode("workspace"));
});

test("plan cannot gain write permissions through a later approval request", async () => {
  const { planApprovalReply } = await import("../run-mode.mjs");
  assert.deepEqual(planApprovalReply("item/permissions/requestApproval"), {
    permissions: {},
    scope: "turn",
  });
  assert.deepEqual(planApprovalReply("item/fileChange/requestApproval"), {
    decision: "decline",
  });
  assert.deepEqual(planApprovalReply("item/commandExecution/requestApproval"), {
    decision: "decline",
  });
  assert.equal(planApprovalReply("item/tool/requestUserInput"), null);
});
