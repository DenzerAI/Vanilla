import path from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";

// Only load an icon advertised by an installed skill, inside that skill's package.
// Inline images avoid exposing a general local-file endpoint or remote tracking URLs.
export async function withSkillIcon(skill) {
  const candidate = skill.interface?.iconLarge || skill.interface?.iconSmall;
  if (!candidate || !skill.path) return skill;
  try {
    const marker = skill.path.lastIndexOf(`${path.sep}skills${path.sep}`);
    const packageRoot = await realpath(
      marker >= 0 && skill.pluginId
        ? skill.path.slice(0, marker)
        : path.dirname(skill.path),
    );
    const file = await realpath(candidate);
    const relative = path.relative(packageRoot, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return skill;
    const mime = {
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[path.extname(file).toLowerCase()];
    const info = await stat(file);
    if (!mime || !info.isFile() || info.size > 256 * 1024) return skill;
    const bytes = await readFile(file);
    return {
      ...skill,
      iconData: `data:${mime};base64,${bytes.toString("base64")}`,
    };
  } catch {
    return skill;
  }
}
