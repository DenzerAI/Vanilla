import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { companyRoot, companyInstructions, readCompanyFile } from "./company-base.mjs";

import {localPath} from '../wrapper/isolation.mjs';
const defaultSystem = fileURLToPath(new URL("../system/", import.meta.url));
export const systemRoot = () => localPath(process.env.SYSTEM_BASE || defaultSystem);
export async function loadSystemBase() {
  const root = systemRoot();
  const [rules, worker] = await Promise.all([readCompanyFile(root, "AGENTS.md"), readCompanyFile(root, "WORKER.md")]);
  return { root, rules, worker };
}
export async function workerInstructions({ root, workspace, cwd = workspace }) {
  const [company, system, identity, local] = await Promise.all([
    companyInstructions(companyRoot(root)), loadSystemBase(),
    readFile(path.join(workspace, "soul/IDENTITY.md"), "utf8"),
    readFile(path.join(workspace, "AGENTS.md"), "utf8"),
  ]);
  return `${company}\n\nGemeinsames System: ${system.root}\n${system.rules.content}\n${system.worker.content}
Arbeitsbereich: ${workspace}\nAktueller Projekt-/Jobordner: ${cwd}
Identität (${path.join(workspace, "soul/IDENTITY.md")}):\n${identity}
Lokaler Einstieg (${path.join(workspace, "AGENTS.md")}):\n${local}
Lies zusätzlich die AGENTS.md im aktuellen Projekt und die Regeln des betroffenen Bereichs. Ergebnisordner: ${path.join(cwd, "output")}.`;
}
