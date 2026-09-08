// UI modes map to actual Codex policies, independently of older client permission fields.
export function runMode(mode = "default") {
  if (!["default", "plan"].includes(mode))
    throw new Error("Unbekannter Arbeitsmodus.");
  const planning = mode === "plan";
  return {
    mode,
    permission: planning ? "read" : "full",
    approvalPolicy: "never",
    sandbox: planning ? "read-only" : "danger-full-access",
    sandboxPolicy: planning
      ? { type: "readOnly" }
      : { type: "dangerFullAccess" },
  };
}
export const PLAN_INSTRUCTIONS =
  "Planungsmodus: Analysiere, lies und stelle Rückfragen. Erstelle oder ändere keine Dateien und führe keine schreibenden Befehle, externen Aktionen oder verändernden MCP-/Konnektor-Werkzeuge aus. Führe den Plan erst aus, nachdem der Benutzer explizit in den Ausführen-Modus wechselt. Erfrage keine zusätzlichen Schreibberechtigungen.";

export function planApprovalReply(method) {
  if (method === "item/permissions/requestApproval")
    return { permissions: {}, scope: "turn" };
  if (
    [
      "item/commandExecution/requestApproval",
      "item/fileChange/requestApproval",
    ].includes(method)
  )
    return { decision: "decline" };
  return null;
}
