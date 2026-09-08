// Local connections must never wait for a remote worker's tool discovery.
export function createMcpSnapshot({load, now=Date.now, ttl=60000}) {
  const workers = new Map();
  return function snapshot(workerId) {
    let state = workers.get(workerId);
    if (!state) { state={data:[], attemptedAt:null, pending:null, error:null}; workers.set(workerId,state); }
    if (!state.pending && (state.attemptedAt===null || now()-state.attemptedAt>=ttl)) {
      state.attemptedAt=now();
      state.pending=Promise.resolve().then(()=>load(workerId)).then(data=>{
        state.data=data; state.error=null;
      },()=>{ state.error='Werkzeuge konnten nicht aktualisiert werden.'; }).finally(()=>{state.pending=null;});
    }
    return {mcp:state.data, mcpLoading:!!state.pending, mcpError:state.error};
  };
}
