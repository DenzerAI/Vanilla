// Presentation metadata only: installed skill paths and instructions stay intact.
export const skillCategories = [
  {
    id: "design",
    name: "Design & Oberflächen",
    skills: [
      "apple-design-review",
      "apple-hig-designer",
      "design-motion-principles",
      "impeccable",
      "make-interfaces-feel-better",
      "motion-design",
      "taste",
      "ui-ux-pro-max",
    ],
  },
  {
    id: "documents",
    name: "Dokumente & PDFs",
    skills: [
      "documents",
      "pdf",
      "artifact-template-design-report",
      "artifact-template-experiment-analysis",
      "artifact-template-investment-committee-memo",
      "artifact-template-legal-memorandum",
      "artifact-template-minimal-letterhead",
      "artifact-template-strategy-memorandum",
      "artifact-template-system-design",
    ],
  },
  {
    id: "spreadsheets",
    name: "Tabellen & Auswertungen",
    skills: [
      "spreadsheets",
      "excel-live-control",
      "artifact-template-analytics-dashboard",
      "artifact-template-financial-budget",
      "artifact-template-operating-calendar",
      "artifact-template-project-tracker",
      "artifact-template-sales-pipeline",
      "artifact-template-three-statement-forecast",
    ],
  },
  {
    id: "presentations",
    name: "Präsentationen",
    skills: [
      "presentations",
      "artifact-template-business-review",
      "artifact-template-market-trends-report",
      "artifact-template-operating-review",
      "artifact-template-project-kickoff",
      "artifact-template-simple-dark-mode",
      "artifact-template-simple-light-mode",
      "artifact-template-team-alignment",
    ],
  },
  {
    id: "images",
    name: "Bilder & Visualisierung",
    skills: ["imagegen", "visualize"],
  },
  {
    id: "research",
    name: "Recherche & Wissen",
    skills: ["deep-research", "openai-docs"],
  },
  {
    id: "development",
    name: "Websites & Code",
    skills: ["sites-building", "sites-hosting", "review-agent"],
  },
  {
    id: "extensions",
    name: "Skills & Erweiterungen",
    skills: [
      "plugin-management",
      "plugin-creator",
      "skill-creator",
      "skill-installer",
      "template-creator",
    ],
  },
  { id: "other", name: "Weitere Skills", skills: [] },
];

const byName = new Map(
  skillCategories.flatMap((category) =>
    category.skills.map((name) => [name, category.id]),
  ),
);
const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de");

export function skillCategory(skill) {
  const name = String(skill.name || "")
    .toLowerCase()
    .split(":")
    .at(-1);
  if (byName.has(name)) return byName.get(name);
  // New official artifact templates can follow their declared output format.
  if (name.startsWith("artifact-template-")) {
    const description = normalize(skill.description);
    if (/^create a spreadsheet\b/.test(description)) return "spreadsheets";
    if (/^create a presentation\b/.test(description)) return "presentations";
    if (/^create a document\b/.test(description)) return "documents";
  }
  return "other";
}

export function groupSkills(skills, { query = "", category = "all" } = {}) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const groups = skillCategories.map((definition) => ({
    id: definition.id,
    name: definition.name,
    skills: [],
  }));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  for (const skill of skills) {
    const group = groupsById.get(skillCategory(skill));
    if (category !== "all" && group.id !== category) continue;
    const haystack = normalize(
      [
        skill.name,
        skill.interface?.displayName,
        skill.description,
        skill.interface?.shortDescription,
        group.name,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (terms.every((term) => haystack.includes(term)))
      group.skills.push(skill);
  }
  for (const group of groups)
    group.skills.sort((a, b) =>
      (a.interface?.displayName || a.name).localeCompare(
        b.interface?.displayName || b.name,
        "de",
        { sensitivity: "base", numeric: true },
      ),
    );
  return groups.filter((group) => group.skills.length > 0);
}
