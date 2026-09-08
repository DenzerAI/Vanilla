// A single raster family. Choose a task metaphor, never the position in a list.
export function skillArt(skill) {
  const name = skill.name.toLowerCase();
  const rules = [
    [/imagegen|image-gen/, "framed-picture"],
    [/openai-docs/, "books"],
    [/skill-installer|plugin-management/, "package"],
    [/skill-creator|plugin-creator|template-creator/, "pencil"],
    [/review-agent|research/, "magnifying-glass-tilted-left"],
    [/motion|animate/, "clapper-board"],
    [/apple|design-report|impeccable|taste|interface|ui-ux/, "artist-palette"],
    [/calendar/, "calendar"],
    [/legal|investment-committee/, "balance-scale"],
    [/experiment/, "test-tube"],
    [/spreadsheet|excel|budget|financial|forecast|analytics|pipeline|market-trends/, "bar-chart"],
    [/presentation|slide|business-review|operating-review|kickoff|team-alignment|simple-dark|simple-light/, "desktop-computer"],
    [/documents|pdf|letterhead|memorandum/, "page-facing-up"],
    [/site|hosting/, "globe-with-meridians"],
    [/visualize/, "bar-chart"],
    [/project-tracker/, "calendar"],
    [/system-design/, "gear"],
    [/security|privacy/, "locked"],
    [/agent/, "robot"],
  ];
  return "/skill-icons/" + (rules.find(([pattern]) => pattern.test(name))?.[1] || "toolbox") + ".png";
}
