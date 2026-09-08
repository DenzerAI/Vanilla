import {
  readPreferences,
  writePreferences,
  DEFAULT_AGENT_PREFERENCES,
} from "./identity-preferences.mjs";
import {
  DEFAULT_AGENT_AVATAR,
  validAgentAvatar,
  avatarColor,
  validAvatarColor,
} from "./ui/agent-avatars.mjs";

export function readAgentProfile(source) {
  const avatar = source.match(/^Avatar:[ \t]*(.*)$/m)?.[1]?.trim();
  return {
    name:
      source
        .match(/^Anzeigename:[ \t]*(.*)$/m)?.[1]
        ?.trim()
        .slice(0, 100) || "Agent",
    avatar: validAgentAvatar(avatar) ? avatar : DEFAULT_AGENT_AVATAR,
    avatarConfigured: validAgentAvatar(avatar),
    avatarColor: avatarColor(
      source.match(/^Avatarfarbe:[ \t]*(.*)$/m)?.[1]?.trim(),
    ),
    preferences: readPreferences(source) || DEFAULT_AGENT_PREFERENCES,
    source,
  };
}

export function updateAgentProfile(source, input) {
  if (source !== input.source)
    throw new Error(
      "Die Identität wurde inzwischen geändert. Bitte den Bereich neu öffnen.",
    );
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100 ||
    /[\r\n\x00-\x1f]/.test(input.name)
  )
    throw new Error(
      "Bitte einen Namen mit 1 bis 100 Zeichen in einer Zeile eingeben.",
    );
  const avatar = input.avatar ?? readAgentProfile(source).avatar;
  if (!validAgentAvatar(avatar))
    throw new Error("Bitte eines der sechs Profilbilder auswählen.");
  const color = input.avatarColor ?? readAgentProfile(source).avatarColor;
  if (!validAvatarColor(color))
    throw new Error("Bitte eine der vorhandenen Hintergrundfarben auswählen.");
  let next = writePreferences(source, input.preferences);
  for (const [field, value] of [
    ["Anzeigename", input.name.trim()],
    ["Avatar", avatar],
    ["Avatarfarbe", color],
  ]) {
    const pattern = new RegExp(`^${field}:.*$`, "m");
    next = pattern.test(next)
      ? next.replace(pattern, () => `${field}: ${value}`)
      : `${next.trimEnd()}\n\n${field}: ${value}\n`;
  }
  return next;
}
