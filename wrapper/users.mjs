// Benutzer im Adapter: Der Kern prüft Anmeldung und Rollen, der Adapter bekommt nur Kennung und Rolle.
import { AsyncLocalStorage } from 'node:async_hooks';

export const OWNER = { id: 'owner', role: 'owner' };
const scope = new AsyncLocalStorage();

/** Benutzer aus den Kopfzeilen des Kerns. Ohne Kern gilt der lokale Betrieb als Eigentümer. */
export function requestUser(headers = {}, coreEnabled = true) {
  const id = String(headers['x-agent-user-id'] || '').trim();
  if (!coreEnabled || !id) return OWNER;
  // Fail-closed: nur eine ausdrückliche Eigentümer-Rolle darf mehr sehen.
  return { id, role: headers['x-agent-user-role'] === 'owner' ? 'owner' : 'member' };
}

export const runAs = (user, fn) => scope.run({ user }, fn);
export const currentUser = () => scope.getStore()?.user || OWNER;

/** Eigentümer sehen alles; Mitglieder nur Chats, die sie selbst begonnen haben. */
export function canSeeChat(chat, user = currentUser()) {
  return user.role === 'owner' || Boolean(chat && chat.ownerId === user.id);
}

export const visibleChats = (chats, user = currentUser()) => chats.filter(c => canSeeChat(c, user));

/** Besitzer für einen neuen Chat: die anfragende Person, sonst niemand (Kanäle, Aufträge). */
export const newChatOwner = () => {
  const user = scope.getStore()?.user;
  return user && user.role === 'member' ? user.id : (user?.id && user.id !== 'owner' ? user.id : null);
};
