// Stable keys shared by the interface and identity storage.
export const agentAvatars = [
  { id: "nori", name: "Nori", description: "Rund mit kleiner Antenne" },
  { id: "orbit", name: "Orbit", description: "Mit weitem Visier" },
  { id: "miko", name: "Miko", description: "Mit neugierigen Ohren" },
  { id: "pixel", name: "Pixel", description: "Ein Gesicht aus einem Pixelraster" },
  { id: "lumi", name: "Lumi", description: "Mit einem Blatt im Haar" },
  { id: "kibo", name: "Kibo", description: "Ein weiches, kompaktes Gesicht" },
  { id: "pebble", name: "Pebble", description: "Ein ruhiger, runder Kiesel" },
  { id: "pad", name: "Pad", description: "Ein breites Gesicht aus einem Pixelraster" },
];
export const DEFAULT_AGENT_AVATAR = "nori";
export const validAgentAvatar = (value) =>
  agentAvatars.some(({ id }) => id === value);
export const agentAvatar = (value) =>
  agentAvatars.find(({ id }) => id === value) || agentAvatars[0];
export const agentAvatarColors = [
  { id: "neutral", name: "Ohne Farbe" },
  { id: "sand", name: "Sand" },
  { id: "clay", name: "Terrakotta" },
  { id: "sage", name: "Salbei" },
  { id: "sky", name: "Himmel" },
  { id: "lavender", name: "Lavendel" },
];
export const validAvatarColor = (value) =>
  agentAvatarColors.some(({ id }) => id === value);
export const avatarColor = (value) =>
  validAvatarColor(value) ? value : "neutral";
export const avatarBackground = (value) =>
  avatarColor(value) === "neutral" ? "transparent" : `var(--avatar-${value})`;
