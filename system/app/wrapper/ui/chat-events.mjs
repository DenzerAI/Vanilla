// One transport per browser tab; every pane keeps its own conversation state.
let source;
const subscribers = new Set();
export function reconnectEventStream() {
  source?.close();
  source = null;
  if (!subscribers.size) return;
  source = new EventSource("/api/events");
  for (const name of ["open", "error", "message"]) {
    source.addEventListener(name, (event) => {
      for (const target of subscribers) target[`on${name}`]?.(event);
    });
  }
}
export function createEventSubscription() {
  const subscriber = {
    close() {
      subscribers.delete(subscriber);
      if (!subscribers.size) {
        source?.close();
        source = null;
      }
    },
  };
  subscribers.add(subscriber);
  if (!source || source.readyState === 2) {
    reconnectEventStream();
  } else if (source.readyState === 1) {
    queueMicrotask(() => {
      if (subscribers.has(subscriber)) subscriber.onopen?.();
    });
  }
  return subscriber;
}
