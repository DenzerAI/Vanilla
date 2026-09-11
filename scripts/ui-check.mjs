#!/usr/bin/env node
// Kopflose Sichtprüfung der laufenden Oberfläche über Chrome und das DevTools-Protokoll.
// Keine Abhängigkeiten: Node 22+ (globales WebSocket) und ein installierter Chrome.
//
//   node scripts/ui-check.mjs [--base http://127.0.0.1:21989] [--path /] [--viewport desktop|mobile|WxH]
//                             [--theme dark|light] [--out output/ui-check] [--timeout 15000] [--launch-timeout 60000]
//                             Schritte in Reihenfolge, beliebig oft:
//                             --wait "text=System" | --wait "css=.chat-turn" | --wait "label=Nachricht senden"
//                             --click <ziel> | --type "Text" | --press Enter | --sleep 800
//                             --eval "document.title" | --text | --shot name
//
// Ziele: text=… (sichtbarer Text, exakt oder enthalten), css=… (Selektor), label=… (aria-label).
// Ergebnis ist eine JSON-Zeile mit Screenshots, Konsolenfehlern und Auswertungen. Exit 2, wenn ein
// Schritt scheitert; ein Konsolenfehler allein bricht nicht ab, er steht im Bericht.
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const STEP_FLAGS = new Set(["--wait", "--click", "--type", "--press", "--sleep", "--eval", "--text", "--shot"]);
const OPTION_FLAGS = new Set(["--base", "--path", "--viewport", "--theme", "--out", "--timeout", "--launch-timeout", "--chrome"]);

export function parseArgs(argv) {
  const options = { base: "http://127.0.0.1:" + (process.env.UWE_PORT || "21989"), path: "/", viewport: "desktop", theme: "", out: "output/ui-check", timeout: 15000,
    "launch-timeout": process.env.UI_CHECK_LAUNCH_TIMEOUT || 60000, chrome: "" };
  const steps = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (OPTION_FLAGS.has(flag)) { options[flag.slice(2)] = argv[++i] ?? ""; continue; }
    if (flag === "--text") { steps.push({ kind: "text" }); continue; }
    if (STEP_FLAGS.has(flag)) { steps.push({ kind: flag.slice(2), value: argv[++i] ?? "" }); continue; }
    throw new Error("Unbekanntes Argument: " + flag);
  }
  options.timeout = Number(options.timeout) || 15000;
  options.launchTimeout = Number(options["launch-timeout"]) || 60000;
  delete options["launch-timeout"];
  return { options, steps };
}

export function viewportFor(name) {
  if (name === "desktop") return { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false };
  if (name === "mobile") return { width: 390, height: 844, deviceScaleFactor: 3, mobile: true };
  const match = /^(\d+)x(\d+)$/.exec(name || "");
  if (!match) throw new Error("Viewport unbekannt: " + name);
  return { width: Number(match[1]), height: Number(match[2]), deviceScaleFactor: 2, mobile: Number(match[1]) < 768 };
}

export function parseTarget(target) {
  const match = /^(text|css|label)=([\s\S]+)$/.exec(target || "");
  if (!match) throw new Error("Ziel braucht text=, css= oder label=: " + target);
  return { kind: match[1], value: match[2] };
}

// Runs inside the page: returns the centre of the first matching visible element, or null.
const LOCATE = `(kind, value) => {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  let candidates = [];
  if (kind === 'css') candidates = [...document.querySelectorAll(value)];
  else if (kind === 'label') candidates = [...document.querySelectorAll('[aria-label]')].filter(el => (el.getAttribute('aria-label') || '').includes(value));
  else {
    const all = [...document.querySelectorAll('button, a, [role=button], [role=tab], [role=menuitem], label, summary, h1, h2, h3, h4, p, span, div, li, td, th')];
    candidates = all.filter(el => (el.textContent || '').trim() === value);
    if (!candidates.length) candidates = all.filter(el => el.children.length === 0 && (el.textContent || '').includes(value));
  }
  const el = candidates.find(visible);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 80) };
}`;

function chromePath(explicit) {
  const candidates = [explicit, process.env.UI_CHECK_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  const found = candidates.find(p => existsSync(p));
  if (!found) throw new Error("Kein Chrome gefunden. Pfad mit --chrome oder UI_CHECK_CHROME angeben.");
  return found;
}

class Session {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.console = []; this.errors = [];
    ws.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id); this.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type))
        this.console.push({ level: message.params.type, text: message.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300) });
      if (message.method === "Runtime.exceptionThrown")
        this.errors.push((message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text || "").slice(0, 300));
    });
  }
  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const result = await this.call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error("JS fehlgeschlagen: " + (result.exceptionDetails.exception?.description || result.exceptionDetails.text || "").slice(0, 300));
    return result.result?.value;
  }
}

// Like Puppeteer's defaults: no keychain, no background services, no crash reporter. Without these, Chrome
// started from a worker process sometimes needs minutes before DevTools answers; with them it takes seconds.
export const LAUNCH_FLAGS = ["--headless=new", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--disable-gpu",
  "--use-mock-keychain", "--password-store=basic", "--disable-background-networking", "--disable-component-update", "--disable-sync",
  "--disable-extensions", "--disable-default-apps", "--metrics-recording-only", "--mute-audio", "--no-service-autorun",
  "--disable-breakpad", "--disable-crash-reporter", "--disable-features=Translate,OptimizationHints,MediaRouter"];

async function launch(chrome, viewport, launchTimeout) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = path.join(os.tmpdir(), "vanilla-ui-check-" + port);
  const child = spawn(chrome, [...LAUNCH_FLAGS, "--remote-debugging-port=" + port, "--window-size=" + viewport.width + "," + viewport.height,
    "--user-data-dir=" + profile, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "", exited = null;
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-2000); });
  child.on("exit", (code, signal) => { exited = { code, signal }; });
  const started = Date.now();
  let targets = [];
  while (Date.now() - started < launchTimeout && !exited) {
    try { targets = await (await fetch("http://127.0.0.1:" + port + "/json")).json(); if (targets.some(t => t.type === "page")) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  const page = targets.find(t => t.type === "page");
  if (!page) {
    child.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    const seconds = Math.round((Date.now() - started) / 1000);
    const said = stderr.trim().split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 600);
    throw new Error("Chrome hat nach " + seconds + " s kein Fenster geöffnet" + (exited ? " (beendet: " + (exited.code ?? exited.signal) + ")" : "") + (said ? ". Chrome meldet: " + said : "."));
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", () => reject(new Error("DevTools-Verbindung fehlgeschlagen.")), { once: true }); });
  return { child, session: new Session(ws), profile, launchMs: Date.now() - started };
}

async function waitFor(session, target, timeout) {
  const { kind, value } = parseTarget(target);
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = await session.evaluate(`(${LOCATE})(${JSON.stringify(kind)}, ${JSON.stringify(value)})`);
    if (found) return found;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("Nicht gefunden: " + target);
}

async function click(session, target, timeout) {
  const point = await waitFor(session, target, timeout);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await session.call("Input.dispatchMouseEvent", { type, x: point.x, y: point.y, button: "left", clickCount: 1 });
  return point;
}

async function press(session, key) {
  const codes = { Enter: 13, Escape: 27, Tab: 9, Backspace: 8, ArrowDown: 40, ArrowUp: 38 };
  const code = codes[key];
  if (!code) throw new Error("Taste unbekannt: " + key);
  await session.call("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, text: key === "Enter" ? "\r" : undefined });
  await session.call("Input.dispatchKeyEvent", { type: "keyUp", key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
}

export async function run(argv) {
  const { options, steps } = parseArgs(argv);
  const viewport = viewportFor(options.viewport);
  const report = { base: options.base, path: options.path, viewport: options.viewport, launchMs: 0, shots: [], evals: [], texts: [], steps: [], console: [], errors: [], ok: true };
  const { child, session, profile, launchMs } = await launch(chromePath(options.chrome), viewport, options.launchTimeout);
  report.launchMs = launchMs;
  try {
    await session.call("Runtime.enable"); await session.call("Page.enable");
    await session.call("Emulation.setDeviceMetricsOverride", viewport);
    if (viewport.mobile) await session.call("Emulation.setTouchEmulationEnabled", { enabled: true });
    if (options.theme) await session.call("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: options.theme }] });
    await session.call("Page.navigate", { url: options.base.replace(/\/$/, "") + options.path });
    await session.evaluate("new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, {once:true}))");
    await mkdir(options.out, { recursive: true });
    for (const step of steps) {
      const started = Date.now();
      try {
        if (step.kind === "wait") await waitFor(session, step.value, options.timeout);
        else if (step.kind === "click") await click(session, step.value, options.timeout);
        else if (step.kind === "type") await session.call("Input.insertText", { text: step.value });
        else if (step.kind === "press") await press(session, step.value);
        else if (step.kind === "sleep") await new Promise(r => setTimeout(r, Number(step.value) || 0));
        else if (step.kind === "eval") report.evals.push(await session.evaluate(step.value));
        else if (step.kind === "text") report.texts.push(await session.evaluate("(document.querySelector('main') || document.body).innerText.slice(0, 20000)"));
        else if (step.kind === "shot") {
          await new Promise(r => setTimeout(r, 300));
          const shot = await session.call("Page.captureScreenshot", { format: "png" });
          const file = path.join(options.out, (step.value || "shot").replace(/[^\w.-]+/g, "-") + "-" + options.viewport + ".png");
          await writeFile(file, Buffer.from(shot.data, "base64"));
          report.shots.push(file);
        }
        report.steps.push({ step: step.kind, value: step.value, ms: Date.now() - started, ok: true });
      } catch (error) {
        report.steps.push({ step: step.kind, value: step.value, ms: Date.now() - started, ok: false, error: error.message });
        report.ok = false;
        break;
      }
    }
  } finally {
    report.console = session.console; report.errors = session.errors;
    try { session.ws.close(); } catch {}
    child.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  return report;
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  run(process.argv.slice(2)).then(report => {
    console.log(JSON.stringify(report));
    process.exit(report.ok ? 0 : 2);
  }).catch(error => { console.log(JSON.stringify({ ok: false, error: error.message })); process.exit(2); });
}
