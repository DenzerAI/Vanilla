import {workerEnvironment} from './worker-environment.mjs';
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { EventEmitter } from "node:events";

export class Codex extends EventEmitter {
  constructor({
    cwd,
    home,
    config = {},
    contextEnv = {},
    binary = process.env.UWE_CODEX_BINARY ||
      "/Applications/ChatGPT.app/Contents/Resources/codex",
  }) {
    super();
    this.cwd = cwd;
    this.home = home;
    this.config = config;
    this.contextEnv = contextEnv;
    this.binary = binary;
    this.nextId = 0;
    this.pending = new Map();
    this.requests = new Map();
    this.connected = false;
  }
  async start() {
    if (this.starting) return this.starting;
    this.starting = this.connect().catch((error) => {
      this.starting = null;
      throw error;
    });
    return this.starting;
  }
  async connect() {
    const proc = this.proc = spawn(
      this.binary,
      [
        "app-server",
        "--stdio",
        ...(this.home
          ? ["-c", `sqlite_home=${JSON.stringify(this.home)}`]
          : []),
        ...Object.entries(this.config).flatMap(([key, value]) => [
          "-c",
          `${key}=${JSON.stringify(value)}`,
        ]),
      ],
      {
        cwd: this.cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...workerEnvironment(),
          ...this.contextEnv,
          NO_COLOR: "1",
          ...(this.home ? { CODEX_HOME: this.home } : {}),
        },
      },
    );
    proc.on("error", (e) => { if (this.proc === proc) this.disconnected(e); });
    proc.on("exit", (code) => {
      if (this.proc === proc) this.disconnected(new Error(`Codex wurde beendet (${code}).`));
    });
    proc.stdin.on("error", () => {});
    this.proc.stderr.on("data", () => {}); // Provider diagnostics can contain private information.
    createInterface({ input: this.proc.stdout }).on("line", (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      if (msg.method) {
        if (msg.id !== undefined) {
          this.requests.set(String(msg.id), msg);
          this.emit("request", msg);
        } else this.emit("notification", msg);
      } else if (this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    });
    const result = await this.call("initialize", {
      clientInfo: { name: "uwe_control", title: "Agent", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.proc.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
    this.info = result;
    this.connected = true;
    this.emit("connected", result);
    return result;
  }
  disconnected(error) {
    this.proc = null;
    this.connected = false;
    this.starting = null;
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
    this.requests.clear();
    this.emit("disconnected", { message: error.message });
  }
  call(method, params = {}, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex antwortet nicht: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      if (!this.proc?.stdin?.writable) {
        clearTimeout(timer);
        this.pending.delete(id);
        return reject(new Error("Codex ist nicht verbunden."));
      }
      this.proc.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  respond(id, result) {
    const request = this.requests.get(String(id));
    if (!request) throw new Error("Diese Rückfrage ist nicht mehr offen.");
    this.proc.stdin.write(JSON.stringify({ id: request.id, result }) + "\n");
    this.requests.delete(String(id));
  }
  stop() {
    const proc = this.proc;
    if (proc) { this.disconnected(new Error("Codex getrennt.")); proc.kill(); }
  }
}
