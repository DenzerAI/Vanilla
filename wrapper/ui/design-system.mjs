/** AGENT CI v2.0 — the single source for CSS tokens and the Appearance reference. */
export const identity = {
  name: "AGENT",
  version: "2.0",
  description:
    "Ruhig, klar und brandfähig. Neutrale Flächen im Stil der macOS-Systemeinstellungen, flaches Glas und ein austauschbarer Akzent.",
};
export const fonts = [
  {
    name: "System-Serif",
    role: "Antworten des Agenten",
    token: "font-conversation",
    value: 'Charter, "Bitstream Charter", "Sitka Text", Georgia, serif',
    system: true,
    specimen: "Lass uns das gemeinsam anschauen.",
  },
  {
    name: "Inter",
    role: "Oberfläche & Lesetext",
    token: "font-ui",
    value: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    source: "https://github.com/rsms/inter/tree/v4.1",
    license: "Inter-LICENSE.txt",
    specimen: "Ein klarer Gedanke. Ein guter nächster Schritt.",
  },
  {
    name: "IBM Plex Mono",
    role: "Code & technische Werte",
    token: "font-mono",
    value: '"IBM Plex Mono", ui-monospace, monospace',
    source: "https://github.com/IBM/plex",
    license: "IBMPlexMono-LICENSE.txt",
    specimen: "const auftrag = { status: 'bereit' };",
  },
];
export const typography = [
  {
    id: "caption",
    label: "Zusatzinformation",
    size: 12,
    line: 1.5,
    weight: 400,
    use: "Zeitstempel, Zähler, Tastenkürzel",
  },
  {
    id: "small",
    label: "Hilfstext",
    size: 13,
    line: 1.5,
    weight: 400,
    use: "Beschreibungen, Code, Statusdetails",
  },
  {
    id: "control",
    label: "Bedienelement",
    size: 14,
    line: 1.5,
    weight: 500,
    use: "Navigation, Buttons, Formularbeschriftungen",
  },
  {
    id: "body",
    label: "Standardtext",
    size: 15,
    line: 1.5,
    weight: 400,
    use: "Listen und kurze Inhalte",
  },
  {
    id: "reading",
    label: "Lesetext",
    size: 16,
    line: 1.6,
    weight: 400,
    use: "Chat, Antworten, längere Inhalte",
  },
  {
    id: "heading",
    label: "Gruppenüberschrift",
    size: 18,
    line: 1.4,
    weight: 600,
    use: "Zusammengehörige Inhalte",
  },
  {
    id: "subheading",
    label: "Zwischenüberschrift",
    size: 20,
    line: 1.4,
    weight: 600,
    use: "Unterabschnitte in Antworten und Details",
  },
  {
    id: "section",
    label: "Abschnittstitel",
    size: 22,
    line: 1.4,
    weight: 600,
    use: "Hauptabschnitte einer Seite",
  },
  {
    id: "title",
    label: "Seitentitel",
    size: 28,
    line: 1.2,
    weight: 500,
    use: "Eine klare Überschrift pro Seite",
  },
  {
    id: "welcome",
    label: "Begrüßung",
    size: 36,
    line: 1.2,
    weight: 500,
    use: "Persönlicher Einstieg in einen neuen Chat",
  },
  {
    id: "display",
    label: "Große Anzeige",
    size: 48,
    line: 1.2,
    weight: 500,
    use: "Nur für die bestehende Sprachansicht",
  },
];
export const spacing = [2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64];
export const radii = { small: 4, control: 8, button: 999, panel: 12, large: 20, pill: 999 };
export const controls = { height: "32px", target: "40px", touch: "44px" };
/** Apple switch proportions (51×31 scaled): track, thumb and travel share one source. */
export const switchMetrics = { width: "40px", height: "24px", "thumb-size": "20px", travel: "16px", inset: "2px" };
/** Flat liquid glass: one blur, one saturation, applied through the glass color roles. */
export const glass = { blur: "24px", saturate: "160%" };
export const motion = {
  fast: "160ms",
  normal: "240ms",
  spring: "cubic-bezier(.34, 1.45, .64, 1)",
  ease: "cubic-bezier(.2, 0, 0, 1)",
};
export const weights = { regular: 400, medium: 500, semibold: 600, bold: 700 };
export const leading = { tight: 1.2, compact: 1.4, normal: 1.5, reading: 1.6 };
/** Default brand accent (Apple blue). A customer accent overrides `--accent` at runtime. */
export const defaultAccent = { dark: "#0a84ff", light: "#007aff" };
export const themes = {
  dark: {
    "brand-asset-bg": "#ffffff",
    bg: "#1c1c1e",
    sidebar: "#232326",
    surface: "#2a2a2d",
    raised: "#343437",
    selected: "#ffffff14",
    border: "#ffffff14",
    text: "#f5f5f7",
    muted: "#aeaeb2",
    faint: "#a2a2a7",
    accent: defaultAccent.dark,
    "on-accent": "#ffffff",
    blue: "#5ea8ff",
    input: "#2c2c2e",
    glass: "#2c2c2ee6",
    "glass-panel": "#1c1c1eb8",
    "glass-card": "#ffffff0d",
    hover: "#ffffff0a",
    composer: "#2a2a2d",
    success: "#30d158",
    "switch-thumb": "#ffffff",
    "switch-off": "#4a4a4d",
    "chat-complete": "#30d158",
    "project-red": "#ff453a",
    "project-orange": "#ff9f0a",
    "project-yellow": "#ffd60a",
    "project-green": "#30d158",
    "project-blue": "#0a84ff",
    "project-purple": "#bf5af2",
    "project-pink": "#ff375f",
    "avatar-sand": "#514737",
    "avatar-clay": "#593f35",
    "avatar-sage": "#374b40",
    "avatar-sky": "#354857",
    "avatar-lavender": "#48405a",

    warning: "#ffd60a",
    danger: "#ff6961",
    "success-bg": "#1c3a28",
    "warning-bg": "#3d3418",
    "danger-bg": "#43221f",
    "info-bg": "#1f2f47",
    "border-strong": "#636366",
    "on-primary": "#1c1c1e",
    primary: "#f5f5f7",
    "primary-hover": "#d8d8dc",
    "disabled-bg": "#3a3a3d",
    "selection-color": "#2f4f7a",
    scrollbar: "#6b6b70",
    overlay: "#00000080",
    shadow: "0 12px 38px #00000059, 0 2px 8px #0000004d",
    "shadow-small": "0 2px 10px #0000001f",
    "shadow-panel-left": "-10px 0 30px #0000004d",
    "shadow-panel-right": "10px 0 45px #000000b3",
    "shadow-control": "0 1px 2px #00000033",
    "shadow-switch": "0 2px 5px #00000059, 0 0 1px #00000040",
  },
  light: {
    "brand-asset-bg": "#ffffff",
    bg: "#f2f2f5",
    sidebar: "#e9e9ee",
    surface: "#ffffff",
    raised: "#e5e5ea",
    selected: "#00000014",
    border: "#00000014",
    text: "#1d1d1f",
    muted: "#5f5f66",
    faint: "#66666d",
    accent: defaultAccent.light,
    "on-accent": "#ffffff",
    blue: "#0a5fc2",
    input: "#ebebf0",
    glass: "#fbfbfce6",
    "glass-panel": "#f2f2f5b8",
    "glass-card": "#ffffffc7",
    hover: "#00000008",
    composer: "#ffffff",
    success: "#1f7a38",
    "switch-thumb": "#ffffff",
    "switch-off": "#d1d1d6",
    "chat-complete": "#1f7a38",
    "project-red": "#d70015",
    "project-orange": "#c93400",
    "project-yellow": "#9a6300",
    "project-green": "#248a3d",
    "project-blue": "#0071e3",
    "project-purple": "#8944ab",
    "project-pink": "#c7245d",
    "avatar-sand": "#e9dac1",
    "avatar-clay": "#edcbbb",
    "avatar-sage": "#d0decc",
    "avatar-sky": "#cbdfe9",
    "avatar-lavender": "#dcd3ea",

    warning: "#8a5a00",
    danger: "#c42b1c",
    "success-bg": "#e3f4e8",
    "warning-bg": "#fbf0d9",
    "danger-bg": "#fbe5e2",
    "info-bg": "#e4eefb",
    "border-strong": "#c7c7cc",
    "on-primary": "#ffffff",
    primary: "#1d1d1f",
    "primary-hover": "#3a3a3e",
    "disabled-bg": "#e0e0e5",
    "selection-color": "#c2dcfb",
    scrollbar: "#aeaeb2",
    overlay: "#00000059",
    shadow: "0 12px 38px #00000014, 0 2px 8px #0000000f",
    "shadow-small": "0 2px 10px #0000000a",
    "shadow-panel-left": "-10px 0 30px #00000014",
    "shadow-panel-right": "10px 0 45px #00000018",
    "shadow-control": "0 1px 2px #00000026",
    "shadow-switch": "0 2px 4px #00000033, 0 0 1px #0000001f",
  },
};
export const colorRoles = {
  bg: "Hintergrund",
  sidebar: "Seitenleiste",
  surface: "Gruppenfläche",
  raised: "Erhöhte Fläche",
  text: "Haupttext",
  muted: "Sekundärtext",
  faint: "Zusatztext",
  accent: "Markenakzent",
  blue: "Links",
  success: "Erfolg",
  warning: "Hinweis",
  danger: "Fehler",
};
export function renderDesignCSS() {
  const shared = Object.fromEntries([
    ...fonts.map((f) => [f.token, f.value]),
    ...typography.map((t) => [`text-${t.id}`, `${t.size / 16}rem`]),
    ...spacing.map((n) => [`space-${n}`, `${n / 16}rem`]),
    ...Object.entries(radii).map(([k, v]) => [`radius-${k}`, `${v}px`]),
    ...Object.entries(controls).map(([k, v]) => [`control-${k}`, v]),
    ...Object.entries(switchMetrics).map(([k, v]) => [`switch-${k}`, v]),
    ...Object.entries(glass).map(([k, v]) => [`glass-${k}`, v]),
    ...Object.entries(motion).map(([k, v]) => [`motion-${k}`, v]),
    ...Object.entries(weights).map(([k, v]) => [`weight-${k}`, v]),
    ...Object.entries(leading).map(([k, v]) => [`leading-${k}`, v]),
  ]);
  const rule = (selector, values, mode) =>
    `${selector} {\n${mode ? `  color-scheme: ${mode};\n` : ""}${Object.entries(
      values,
    ).concat(values.muted ? [["select-arrow", `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='${values.muted.replace('#', '%23')}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`]] : [])
      .map(([k, v]) => `  --${k}: ${v};`)
      .join("\n")}\n}\n`;
  return (
    "/* Generated by build.mjs from design-system.mjs. Do not edit. */\n" +
    rule(":root", { ...shared, ...themes.dark }, "dark") +
    rule(':root[data-theme="light"]', themes.light, "light") +
    Object.entries(themes)
      .map(([mode, values]) => rule(`.theme-choice.${mode}`, values, mode))
      .join("")
  );
}
