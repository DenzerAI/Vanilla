// Stable keys shared by the interface and identity storage.
// Sechs Pixelfiguren auf einem 16er-Raster; Lumi ist der Maßstab, die anderen
// fünf sind nach Tamagotchi-Klassikern gezeichnete Entwürfe.
export const agentAvatars = [
  { id: "lumi", name: "Lumi", description: "Ein Ei mit Spross" },
  { id: "nori", name: "Nori", description: "Bohne mit Ohren und großen Augen" },
  { id: "miko", name: "Miko", description: "Mit langen Hasenohren" },
  { id: "orbit", name: "Orbit", description: "Breit, mit Schnabelkante" },
  { id: "pixel", name: "Pixel", description: "Ein hohes, schmales Ei" },
  { id: "kibo", name: "Kibo", description: "Kleine Kugel mit Krempe" },
];
export const DEFAULT_AGENT_AVATAR = "lumi";
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
// Augen sind Ausschnitte: sie tragen die Farbe der Fläche hinter der Figur.
export const avatarCutout = (value) =>
  avatarColor(value) === "neutral" ? "var(--surface)" : `var(--avatar-${value})`;
