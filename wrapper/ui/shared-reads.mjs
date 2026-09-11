// Share concurrent reads only. Mutations invalidate the generation immediately.
// No persisted API cache, no stale privacy decisions and no replay of POSTs.
export function createSharedReads() {
  const pending = new Map();
  return {
    clear() { pending.clear(); },
    read(key, load) {
      if (pending.has(key)) return pending.get(key);
      const result = Promise.resolve().then(load).finally(()=>{
        if (pending.get(key) === result) pending.delete(key);
      });
      pending.set(key,result);
      return result;
    },
  };
}

export function createSharedApi(request) {
  const reads = createSharedReads();
  return function api(url, data, retry = true, signal) {
    if (data !== undefined) {
      reads.clear();
      return request(url, data, retry, signal);
    }
    // A caller's cancellation must never abort another pane's request.
    if (signal) return request(url, data, retry, signal);
    return reads.read(url, () => request(url, data, retry, signal));
  };
}
