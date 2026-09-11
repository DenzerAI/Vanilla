// A pane owns one history request. Switching chats releases the old connection.
export function createLatestRead(load, timeout = 65000) {
  let controller, revision = 0;
  return {
    cancel() { revision++; controller?.abort(); controller = null; },
    read(url) {
      controller?.abort();
      const current = ++revision;
      const own = controller = new AbortController();
      const timer = setTimeout(()=>own.abort(), timeout);
      const result = (async()=>{
        try { return await load(url,own.signal); }
        finally { clearTimeout(timer); if(controller === own)controller=null; }
      })();
      result.isCurrent = ()=>revision === current;
      return result;
    },
  };
}
