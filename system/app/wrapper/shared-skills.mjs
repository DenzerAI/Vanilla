import path from "node:path";
import { parse } from "yaml";
import { loadCompanyBase, readCompanyFile } from "../backend/company-base.mjs";

// The shared map remains usable even if no native worker is running.
export async function sharedSkills(base) {
  const company = await loadCompanyBase(base);
  return Promise.all(company.workflows.map(async workflow => {
    const { content } = await readCompanyFile(base, workflow.path);
    const header = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const meta = header ? parse(header) : {};
    return { name: typeof meta?.name === "string" ? meta.name : workflow.path.split("/")[0],
      description: typeof meta?.description === "string" ? meta.description : "Gemeinsame Arbeitsweise aus der Firmenbasis.",
      path: path.join(base, workflow.path), enabled: true, scope: "company" };
  }));
}
