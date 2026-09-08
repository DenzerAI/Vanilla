import path from "node:path";
import { identityInstructions } from "../wrapper/identity-preferences.mjs";
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
  return `Die folgenden Quellen wurden für diese Nachricht frisch geladen. Nur die unten vollständig enthaltenen Dateien gelten als geladen; Verweise auf weitere Dateien erfüllen deren Leseaufforderung nicht. Prüfe Zielordner und Herkunftspfade nach der Startprüfung in WORKER.md, auch nach Kontextverlust oder Projektwechsel; lies fehlende, für den Auftrag benötigte Quellen. Bei Änderungen ist die aktuelle Quelldatei maßgeblich.
${company}\n\nGemeinsames System: ${system.root}\nAGENTS.md:\n${system.rules.content}\nWORKER.md:\n${system.worker.content}
Arbeitsbereich: ${workspace}\nAktueller Projekt-/Jobordner: ${cwd}
Identität (${path.join(workspace, "soul/IDENTITY.md")}):\n${identityInstructions(identity)}
Lokaler Einstieg (${path.join(workspace, "AGENTS.md")}):\n${local}
${path.resolve(cwd) !== path.resolve(workspace) ? "Lies zusätzlich die AGENTS.md im aktuellen Projekt-/Jobordner, falls vorhanden. " : ""}Lies Bereichsregeln nur für den betroffenen Bereich. Ergebnisordner: ${path.join(cwd, "output")}.`;
}
