export function hasUnreadReply(chat) {
  return chat?.lastTurnStatus === 'completed' && (!chat.lastCompletedTurnId || chat.readTurnId !== chat.lastCompletedTurnId);
}
export function markReplyRead(chat, turnId) {
  if (!turnId || chat.lastCompletedTurnId !== turnId || chat.readTurnId === turnId) return false;
  chat.readTurnId = turnId;
  return true;
}
