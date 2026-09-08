import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";

// Newline-delimited JSON-RPC. No shell, no credentials in diagnostics.
export class WorkerRPC extends EventEmitter {
  constructor({ command, args = [], cwd, env = {} }) {
    super(); Object.assign(this, { command, args, cwd, env });
    this.pending = new Map(); this.nextId = 0;
  }
  start() {
    if (this.proc) return;
    const proc = spawn(this.command, this.args, { cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...this.env, NO_COLOR: "1" } });
    this.proc = proc;
    let buffer = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.on("data", () => {});
    proc.stdin.on("error", () => {});
    proc.stdout.on("data", chunk => {
      if (this.proc !== proc) return;
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 8 * 1024 * 1024) { this.stop("Die Worker-Antwort ist zu groß."); return; }
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let message; try { message = JSON.parse(line); } catch { continue; }
        if (!message || typeof message !== "object") continue;
        if (message.method) this.emit("message", message);
        else if (this.pending.has(message.id)) {
          const p = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(p.timer);
          if (message.error) p.reject(Object.assign(new Error(message.error.message || "Worker-Anfrage fehlgeschlagen."), { data: message.error.data }));
          else p.resolve(message.result);
        }
      }
    });
    const ended = () => { if (this.proc === proc) this.stop("Worker-Verbindung beendet. Bitte neu verbinden."); };
    proc.once("error", ended); proc.once("exit", ended);
  }
  write(message) {
    if (!this.proc?.stdin?.writable) throw new Error("Worker ist nicht verbunden.");
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
  }
  call(method, params, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Worker antwortet nicht. Bitte Verbindung prüfen."));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.write({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  stop(message = "Worker getrennt.") {
    const proc = this.proc; this.proc = null;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(message)); }
    this.pending.clear();
    if (proc) { proc.kill(); this.emit("disconnected", { message }); }
  }
}
