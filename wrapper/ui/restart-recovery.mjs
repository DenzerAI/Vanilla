// A requested restart completes only when a different server instance answers.
export function createRestartRecovery({reload, now = Date.now, timeout = 60000}) {
  let pending = null;
  return {
    get pending() { return !!pending; },
    start(instanceId) {
      if (!instanceId) throw new Error('Der Serverstatus ist unvollständig. Bitte erneut versuchen.');
      pending = {instanceId, deadline: now() + timeout};
    },
    check(status) {
      if (!pending) return 'idle';
      if (status?.instanceId && status.instanceId !== pending.instanceId) {
        pending = null;
        reload();
        return 'reloading';
      }
      if (now() >= pending.deadline) {
        pending = null;
        return 'timeout';
      }
      return 'waiting';
    },
  };
}
