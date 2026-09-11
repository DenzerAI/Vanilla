// The settings list displays tool names/counts, never the native input schemas.
export function settingsIntegrations(value) {
  return {...value,mcp:(value.mcp || []).map(server=>({...server,
    tools:Object.fromEntries(Object.keys(server.tools || {}).map(name=>[name,{}]))}))};
}
