// Deduplicate concurrent requests for the same native writer. Failures may retry;
// a disconnected generation must never mark a replacement connection as loaded.
export class ThreadLoading {
  loaded = new Set();
  pending = new Map();
  generation = 0;
  clear() {
    this.generation++;
    this.loaded.clear();
    this.pending.clear();
  }
  add(id) {
    this.loaded.add(id);
  }
  delete(id) {
    this.loaded.delete(id);
  }
  async ensure(id, load) {
    if (this.loaded.has(id)) return;
    if (this.pending.has(id)) return this.pending.get(id);
    const generation = this.generation;
    const promise = Promise.resolve()
      .then(load)
      .then(() => {
        if (generation === this.generation) this.loaded.add(id);
      })
      .finally(() => {
        if (this.pending.get(id) === promise) this.pending.delete(id);
      });
    this.pending.set(id, promise);
    return promise;
  }
}

export function readableCodexError(error) {
  return /already has an active writer/i.test(error.message)
    ? "Dieser Chat ist gerade in einer anderen Codex-Verbindung geöffnet. Beende dort die Schreibverbindung und versuche es erneut. Dein Entwurf bleibt erhalten."
    : error.message;
}
