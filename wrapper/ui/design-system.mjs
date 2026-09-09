/** AGENT CI v1.1 — the single source for CSS and the Appearance reference. */
export const identity = {
  name: "AGENT",
  version: "1.1",
  description:
    "Ruhig, klar und persönlich. Abgestimmte Flächen, präzise Typografie und neutrale Bedienelemente nach macOS-Vorbild.",
};
export const fonts = [
  {
    name: "Systemschrift für Gespräche",
    role: "Antworten des Agenten",
    token: "font-conversation",
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
    id: "conversation",
    label: "Gesprächsantwort",
    size: 15,
    line: 1.5,
    weight: 400,
    use: "Gut lesbare Agentenantworten im Gespräch",
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
export const radii = { small: 4, control: 8, button: 6, panel: 12, large: 24, pill: 999 };
export const amountSliderGeometry = { cell: 6, gap: 1, thumb: 24 };
export const amountSliderMotion = { magnet: .08, minDensity: .2, minSpread: .3, baseSpeed: .3, extraSpeed: 3.2, tail: .6, hint: .15, ultraSpeed: 3.5, ultraTail: .35, ultraIntensity: .6, ultraFalloff: .7 };
// Visual intensity only: native capabilities still determine the available stops.
export const reasoningAnimationLevels = { low: .03, medium: .35, high: .6, xhigh: .82, max: 1, ultra: 1 };
export const controls = { "slider-thumb-width": `${amountSliderGeometry.thumb}px`, "turn-loader-slot": "19.2px", "composer-fallback":"112px", "nav-text-inset":"38px", "nav-group-inset":"46px", height: "32px", target: "40px", touch: "44px", "heading-height": "52px", "app-heading-height": "84px", "row-height": "48px", "switch-width": "36px", "switch-height": "20px", "switch-thumb": "16px", "switch-travel": "16px" };
export const typeMetrics = { "font-root-size": "16px", "tracking-title": "-0.65px", "tracking-heading": "-0.35px", "tracking-welcome": "-0.7px" };
export const weights = { regular: 400, medium: 500, semibold: 600, bold: 700 };
export const leading = { tight: 1.2, compact: 1.4, normal: 1.5, reading: 1.6 };
export const themes = {
  dark: {
    "particle-opacity": "0.27",
    "particle-layer-opacity": "0.10",
    'brand-asset-bg': '#ffffff',
    bg: "#1b1a19",
    "workspace-backdrop": "#151413",
    "sidebar-sheen": "radial-gradient(ellipse at 90% 10%, #ffffff06, #ffffff00 65%), radial-gradient(ellipse at 10% 90%, #ffffff03, #ffffff00 60%)",
    "sidebar-material-shadow": "inset 0 0 0 1px #ffffff0a, inset 0 1px 0 #ffffff05, 0 4px 16px #0000000a",
    "workspace-panel-bg": "#000000",
    "workspace-panel-glass": "#000000f0",
    "workspace-panel-sheen": "radial-gradient(ellipse at 100% 0%, #ffffff0b, #ffffff00 65%), radial-gradient(ellipse at 0% 100%, #ffffff05, #ffffff00 55%)",
    "workspace-panel-shadow": "inset 0 0 0 1px #ffffff14, inset 0 1px 0 #ffffff0a, 0 12px 32px #00000040",
    sidebar: "#282725",
    surface: "#252422",
    raised: "#302e2b",
    selected: "#ffffff12",
    border: "#ffffff14",
    text: "#f3f1ed",
    muted: "#b5b0a8",
    faint: "#a39e96",
    accent: "#da977e",
    "brand-accent": "#da977e",
    blue: "#91baff",
    input: "#2c2a27",
    glass: "#302e2b",
    "sheet-glass": "#302e2bb8",
    "popover-glass": "#302e2b66",
    "popover-glass-sheen": "linear-gradient(135deg, #ffffff12, #ffffff00 45%, #ffffff06)",
    "popover-glass-shadow": "inset 0 0 0 1px #ffffff14, inset 0 1px 0 #ffffff26, 0 8px 24px #00000024",
    "slider-glass": "#dedbd47a",
    "slider-ultra-accent": "#ed986f",
    "slider-glass-shadow": "inset 0 0 0 1px #ffffff66, inset 0 1px 0 #ffffffa3, 0 2px 6px #00000033",
    "notice-glass": "#302e2b66",
    "glass-button-blur": "24px",
    "glass-button-tint": "#28272526",
    "glass-button-edge": "inset 0 0 0 1px #ffffff0a",
    "suggestion-glass": "#302e2b52",
    "suggestion-glass-hover": "#302e2ba3",
    "glass-highlight": "#ffffff26",
    hover: "#ffffff09",
    composer: "#282725",
    "composer-blur": "#28272599",
    "composer-glass-shadow": "inset 0 0 0 1px #ffffff12, inset 0 1px 0 #ffffff14, 0 4px 16px #00000018",
    success: "#8dceb0",
    "switch-thumb": "#ffffff",
    "switch-on": "#858585",
    "switch-off": "#454545",
    "chat-complete": "#25d366",
    "project-red": "#f2a898",
    "project-orange": "#da977e",
    "project-yellow": "#e7c678",
    "project-green": "#8dceb0",
    "project-blue": "#91baff",
    "project-purple": "#c3a4eb",
    "project-pink": "#e9a1c5",
    "avatar-sand": "#514737",
    "avatar-clay": "#593f35",
    "avatar-sage": "#374b40",
    "avatar-sky": "#354857",
    "avatar-lavender": "#48405a",

    warning: "#e7b678",
    danger: "#f2a898",
    "success-bg": "#253a30",
    "warning-bg": "#3a3024",
    "danger-bg": "#402d29",
    "info-bg": "#293344",
    "border-strong": "#716b63",
    "on-primary": "#24221f",
    primary: "#f3f1ed",
    "primary-hover": "#d8d3cb",
    "disabled-bg": "#47433d",
    "selection-color": "#494744",
    "focus-ring": "#a8a6a2",
    scrollbar: "#77716a",
    overlay: "#00000066",
    shadow: "0 12px 38px #0003, 0 2px 8px #0002",
    "shadow-small": "0 2px 10px #0000000a",
    "shadow-panel-left": "-10px 0 30px #0003",
    "shadow-panel-right": "10px 0 45px #0007",
    "shadow-control": "0 1px 2px #0002",
  },
  light: {
    "particle-opacity": "0.48",
    "particle-layer-opacity": "0.12",
    "workspace-backdrop": "#f2f0e9",
    "sidebar-sheen": "radial-gradient(ellipse at 90% 10%, #ffffff40, #ffffff00 65%), radial-gradient(ellipse at 10% 90%, #00000003, #00000000 60%)",
    "sidebar-material-shadow": "inset 0 0 0 1px #39352e20, inset 0 1px 0 #ffffff40, 0 4px 16px #39352e0a",
    "workspace-panel-bg": "#e6e3da",
    "workspace-panel-glass": "#e6e3da",
    "workspace-panel-sheen": "none",
    "workspace-panel-shadow": "inset 0 0 0 1px #39352e24, 0 4px 16px #39352e10",
    'brand-asset-bg': '#ffffff',
    bg: "#f2f0e9",
    sidebar: "#e5e2d8",
    surface: "#eae7df",
    raised: "#ddd9cf",
    selected: "#39352e14",
    border: "#39352e29",
    text: "#292720",
    muted: "#57534c",
    faint: "#605b53",
    accent: "#90452f",
    "brand-accent": "#90452f",
    blue: "#225499",
    input: "#e4e0d6",
    glass: "#faf8f2",
    "sheet-glass": "#faf8f2eb",
    "popover-glass": "#faf8f2e6",
    "popover-glass-sheen": "linear-gradient(135deg, #ffffff4d, #ffffff00 45%, #ffffff26)",
    "popover-glass-shadow": "inset 0 0 0 1px #0000000f, inset 0 1px 0 #ffffffb3, 0 8px 24px #00000014",
    "slider-glass": "#ffffffd1",
    "slider-ultra-accent": "#b34f2b",
    "slider-glass-shadow": "inset 0 0 0 1px #00000026, inset 0 1px 0 #ffffffcc, 0 2px 6px #0000001f",
    "notice-glass": "#f5f3ee80",
    "glass-button-blur": "24px",
    "glass-button-tint": "#f0eee926",
    "glass-button-edge": "inset 0 0 0 1px #00000008",
    "suggestion-glass": "#f5f3ee66",
    "suggestion-glass-hover": "#f5f3eeb8",
    "glass-highlight": "#ffffffb3",
    hover: "#39352e0c",
    composer: "#faf8f2",
    "composer-blur": "#faf8f2eb",
    "composer-glass-shadow": "inset 0 0 0 1px #39352e2e, 0 3px 12px #39352e0f",
    success: "#226644",
    "switch-thumb": "#ffffff",
    "switch-on": "#686868",
    "switch-off": "#c4c4c4",
    "chat-complete": "#128c45",
    "project-red": "#a13e2c",
    "project-orange": "#90452f",
    "project-yellow": "#80601c",
    "project-green": "#226644",
    "project-blue": "#225499",
    "project-purple": "#7950a0",
    "project-pink": "#9a416b",
    "avatar-sand": "#e9dac1",
    "avatar-clay": "#edcbbb",
    "avatar-sage": "#d0decc",
    "avatar-sky": "#cbdfe9",
    "avatar-lavender": "#dcd3ea",

    warning: "#815315",
    danger: "#a13e2c",
    "success-bg": "#e4efe7",
    "warning-bg": "#f5ebd8",
    "danger-bg": "#f7e6e1",
    "info-bg": "#e7edf6",
    "border-strong": "#928a80",
    "on-primary": "#fcfbf8",
    primary: "#292723",
    "primary-hover": "#45413b",
    "disabled-bg": "#e5e1d9",
    "selection-color": "#dedcd8",
    "focus-ring": "#706e69",
    scrollbar: "#938b7f",
    overlay: "#00000066",
    shadow: "0 12px 38px #39352e24, 0 2px 8px #39352e14",
    "shadow-small": "0 2px 10px #39352e18",
    "shadow-panel-left": "-10px 0 30px #00000014",
    "shadow-panel-right": "10px 0 45px #00000018",
    "shadow-control": "0 1px 2px #0002",
  },
};
// Product-owned palettes inspired by warm editorial and neutral desktop surfaces.
// These are our values, not claimed vendor app tokens. See DESIGN.md for sources.
export const designTones = [
  {id: 'balanced', label: 'Ausgewogen', description: 'Sanfte Wärme, klare Kontraste'},
  {id: 'warm', label: 'Warm', description: 'Papier und weiche Sandtöne'},
  {id: 'neutral', label: 'Neutral', description: 'Klare Grautöne ohne Blaustich'},
];
export const designAccents = [
  {id: 'terracotta', label: 'Terrakotta', dark: '#da977e', light: '#90452f'},
  {id: 'graphite', label: 'Graphit', dark: '#b7b7b7', light: '#575757'},
  {id: 'sage', label: 'Salbei', dark: '#aac3a3', light: '#435d3c'},
];
const toneSurfaces = {
  warm: {
    light: {faint:'#5b554b', muted:'#554f45', bg:'#f2ede3', sidebar:'#e3dbce', surface:'#e9e2d6', raised:'#dcd3c4', input:'#e3dbce', composer:'#faf6ed', glass:'#faf6ed', 'workspace-backdrop':'#f2ede3', 'workspace-panel-bg':'#e4dccf', 'workspace-panel-glass':'#e4dccf'},
    dark: {bg:'#201d19', sidebar:'#29251f', surface:'#28241f', raised:'#332e27', input:'#2c2721', composer:'#29251f', glass:'#332e27', 'workspace-backdrop':'#181511'},
  },
  neutral: {
    light: {bg:'#f0f0ee', sidebar:'#dfdfdc', surface:'#e7e7e4', raised:'#d9d9d5', input:'#e0e0dc', composer:'#fafaf8', glass:'#fafaf8', text:'#262626', muted:'#50504e', faint:'#595956', 'workspace-backdrop':'#f0f0ee', 'workspace-panel-bg':'#e1e1de', 'workspace-panel-glass':'#e1e1de'},
    dark: {bg:'#1b1b1b', sidebar:'#272727', surface:'#242424', raised:'#2e2e2e', input:'#292929', composer:'#272727', glass:'#2e2e2e', text:'#f1f1f1', muted:'#b2b2b2', faint:'#a0a0a0', 'workspace-backdrop':'#151515'},
  },
};
export function resolveDesign(theme = 'dark', tone = 'balanced', accent = 'terracotta') {
  const mode = theme === 'light' ? 'light' : 'dark';
  const palette = {...themes[mode], ...(toneSurfaces[tone]?.[mode] || {})};
  const selectedAccent = designAccents.find(item => item.id === accent) || designAccents[0];
  return {...palette, accent: selectedAccent[mode], highlight: selectedAccent[mode],
    'glass-button-tint': palette.composer + '26',
    'composer-blur': palette.composer + (mode === 'light' ? 'eb' : '99'),
    'suggestion-glass': palette.glass + (mode === 'light' ? '66' : '52'),
    'suggestion-glass-hover': palette.glass + (mode === 'light' ? 'b8' : 'a3'),
    'popover-glass': palette.glass + (mode === 'light' ? 'e6' : '66'),
    'sheet-glass': palette.glass + (mode === 'light' ? 'eb' : 'b8')};
}
export function designVariables(theme, tone, accent) {
  return Object.fromEntries(Object.entries(resolveDesign(theme, tone, accent)).map(([key,value])=>['--'+key,value]));
}
export const colorRoles = {
  bg: "Hintergrund",
  sidebar: "Seitenleiste",
  "workspace-panel-bg": "Workspace · dunkle Tiefenfläche",
  surface: "Gruppenfläche",
  raised: "Erhöhte Fläche",
  "suggestion-glass": "Startvorschläge · transparente Pille",
  "suggestion-glass-hover": "Startvorschläge · Hover und Fokus",
  text: "Haupttext",
  muted: "Sekundärtext",
  faint: "Zusatztext",
  accent: "Hervorhebung",
  "brand-accent": "Markenakzent · Terrakotta",
  blue: "Links & Fokus",
  success: "Erfolg",
  warning: "Hinweis",
  danger: "Fehler",
};
export const avatarMotion = { blink: 26, blinkVariance: 6, gaze: 38, gazeVariance: 8, expression: 32, expressionVariance: 8, gesture: 29, delay: 2, delayVariance: 4 };
export const voiceWaveGeometry = {width:240, samples:60, spacing:4, height:7, rest:0.5, stroke:1.25, gain:36};
export const motion = { 'avatar-blink-duration': `${avatarMotion.blink}s`, 'avatar-gaze-duration': `${avatarMotion.gaze}s`, 'avatar-expression-duration': `${avatarMotion.expression}s`, 'avatar-gesture-duration': `${avatarMotion.gesture}s`, 'avatar-easing': 'cubic-bezier(.4, 0, .2, 1)', 'picker-duration': '280ms', 'picker-easing': 'cubic-bezier(.16, 1, .3, 1)', 'panel-light-duration': '48s', 'panel-light-easing': 'ease-in-out', 'feedback-duration': '160ms', 'progress-duration': '1000ms', 'skeleton-duration': '1600ms' };
export function renderDesignCSS() {
  const shared = Object.fromEntries([
    ...Object.entries(typeMetrics),
    ...fonts.map((f) => [f.token, f.value]),
    ...typography.map((t) => [`text-${t.id}`, `${t.size / 16}rem`]),
    ...spacing.map((n) => [`space-${n}`, `${n / 16}rem`]),
    ...Object.entries(radii).map(([k, v]) => [`radius-${k}`, `${v}px`]),
    ...Object.entries(controls).map(([k, v]) => [`control-${k}`, v]),
    ...Object.entries(weights).map(([k, v]) => [`weight-${k}`, v]),
    ...Object.entries(motion).map(([k, v]) => [`motion-${k}`, v]),
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

export const scrubberSprings = { pointer: { stiffness: 700, damping: 52, mass: .5 }, strength: { stiffness: 260, damping: 30, mass: .6 } };

export const attentionFanMotion = {hoverLift: -10, hoverScale: 1.02, rotation: 12, compactRotation: 6, depth: 18, scale: 0.94, spring: {stiffness: 180, damping: 25, mass: 0.8}};

export const chatHeadingMotion = {character: 90, punctuation: 360, hold: 20000, fade: 900};
