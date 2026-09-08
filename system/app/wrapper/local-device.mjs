import os from "node:os";
import path from "node:path";
import { access, statfs, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export const GiB = 1024 ** 3;
import { localModels } from "./local-model-catalog.mjs";
export { localModels } from "./local-model-catalog.mjs";
async function firstPath(paths, executable = true) {
  for (const file of paths.filter(Boolean)) {
    try {
      await access(file, executable ? constants.X_OK : constants.F_OK);
      return file;
    } catch {}
  }
  return null;
}
export async function installation(provider) {
  const home = os.homedir(),
    mac = process.platform === "darwin";
  const app = mac
    ? await firstPath(
        [
          path.join(
            "/Applications",
            provider === "ollama" ? "Ollama.app" : "LM Studio.app",
          ),
          path.join(
            home,
            "Applications",
            provider === "ollama" ? "Ollama.app" : "LM Studio.app",
          ),
        ],
        false,
      )
    : null;
  const binaryName =
    (provider === "ollama" ? "ollama" : "lms") +
    (process.platform === "win32" ? ".exe" : "");
  const binary = await firstPath([
    ...(provider === "ollama"
      ? [
          app && path.join(app, "Contents/Resources/ollama"),
          process.env.LOCALAPPDATA &&
            path.join(process.env.LOCALAPPDATA, "Programs/Ollama/ollama.exe"),
        ]
      : [path.join(home, ".lmstudio/bin", binaryName)]),
    ...String(process.env.PATH || "")
      .split(path.delimiter)
      .filter((p) => path.isAbsolute(p))
      .map((p) => path.join(p, binaryName)),
    ...(mac
      ? ["/opt/homebrew/bin", "/usr/local/bin"].map((p) =>
          path.join(p, binaryName),
        )
      : []),
  ]);
  return { app, binary, installed: !!(app || binary) };
}
export async function diskSpace() {
  let target = path.resolve(
    process.env.OLLAMA_MODELS || path.join(os.homedir(), ".ollama/models"),
  );
  while (true) {
    try {
      const d = await statfs(target);
      return d.bavail * d.bsize;
    } catch {
      const parent = path.dirname(target);
      if (parent === target) return null;
      target = parent;
    }
  }
}
export function recommend(device) {
  const budget = Math.max(
    0,
    Math.min(
      device.memoryBytes - 4 * GiB,
      device.unified
        ? device.memoryBytes * 0.55
        : device.gpu?.memoryBytes
          ? Math.min(device.memoryBytes * 0.5, device.gpu.memoryBytes * 0.8)
          : Math.min(device.memoryBytes * 0.35, 4 * GiB),
    ),
  );
  const options = localModels.map((model) => ({
    ...model,
    fits: model.memory <= budget,
    diskFits:
      device.diskFreeBytes === null ||
      model.bytes + GiB <= device.diskFreeBytes,
  }));
  return {
    options,
    recommended: [...options].filter((m) => m.fits && m.diskFits).sort((a, b) => (b.id.startsWith("qwen3.5:") - a.id.startsWith("qwen3.5:")) || b.memory - a.memory)[0]?.id || null,
  };
}
export function compatibility(provider, device) {
  if (
    !["darwin", "linux", "win32"].includes(device.platform) ||
    !["arm64", "x64"].includes(device.arch)
  )
    return "Dieses System wird nicht unterstützt.";
  if (device.platform === "darwin" && Number(device.release.split(".")[0]) < 23)
    return "Benötigt macOS 14 oder neuer.";
  if (
    provider === "lmstudio" &&
    device.platform === "darwin" &&
    device.arch !== "arm64"
  )
    return "Benötigt Apple Silicon.";
  if (provider === "lmstudio" && device.arch === "x64" && device.avx2 === false)
    return "Benötigt eine CPU mit AVX2.";
  return null;
}
let hardware;
async function availableMemory() {
  try {
    if (os.platform() === "darwin") {
      const { stdout } = await exec("/usr/bin/vm_stat", [], { timeout: 2000 });
      const pageSize = Number(stdout.match(/page size of (\d+) bytes/)?.[1]);
      const pages = ["free", "inactive", "speculative"].reduce(
        (sum, kind) =>
          sum +
          Number(
            stdout.match(new RegExp(`Pages ${kind}:\\s+(\\d+)`))?.[1] || 0,
          ),
        0,
      );
      if (pageSize && pages) return Math.min(os.totalmem(), pageSize * pages);
    }
    if (os.platform() === "linux") {
      const info = await readFile("/proc/meminfo", "utf8");
      const available = Number(info.match(/^MemAvailable:\s+(\d+)/m)?.[1]);
      if (available) return available * 1024;
    }
  } catch {}
  return os.freemem();
}
export async function inspectDevice() {
  if (!hardware) {
    hardware = (async () => {
      const platform = os.platform(),
        arch = os.arch(),
        unified = platform === "darwin" && arch === "arm64";
      let gpu = null,
        avx2 = null;
      try {
        if (platform === "darwin") {
          const { stdout } = await exec(
            "/usr/sbin/system_profiler",
            ["SPDisplaysDataType", "-json"],
            { timeout: 5000, maxBuffer: 512000 },
          );
          const entry = JSON.parse(stdout).SPDisplaysDataType?.[0];
          if (entry)
            gpu = { name: entry.sppci_model || "Apple GPU", memoryBytes: null };
        } else {
          const { stdout } = await exec(
            "nvidia-smi",
            ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            { timeout: 2500 },
          );
          gpu =
            stdout
              .trim()
              .split("\n")
              .map((line) => {
                const [name, memory] = line.split(",");
                return {
                  name: name.trim(),
                  memoryBytes: Number(memory) * 1024 ** 2,
                };
              })
              .filter((g) => Number.isFinite(g.memoryBytes))
              .sort((a, b) => b.memoryBytes - a.memoryBytes)[0] || null;
        }
      } catch {}
      if (platform === "linux" && arch === "x64") {
        try {
          avx2 = /\bavx2\b/.test(await readFile("/proc/cpuinfo", "utf8"));
        } catch {}
      }
      return {
        platform,
        arch,
        release: os.release(),
        name: os.hostname(),
        chip: os.cpus()[0]?.model || arch,
        memoryBytes: os.totalmem(),
        unified,
        gpu,
        avx2,
      };
    })();
  }
  const [base, availableMemoryBytes, diskFreeBytes] = await Promise.all([
    hardware,
    availableMemory(),
    diskSpace(),
  ]);
  const device = {
    ...base,
    freeMemoryBytes: os.freemem(),
    availableMemoryBytes,
    diskFreeBytes,
  };
  return { ...device, ...recommend(device) };
}
