// Visibility and restored layout are not evidence that someone selected a chat.
export function canReadPaneReply({ foreground, visible, selected, engagedChatId, chatId, away, running, completed, unread }) {
  return !!(foreground && visible && selected && engagedChatId === chatId && chatId && !away && !running && completed && unread);
}
