// Reading follows the selected, fully loaded conversation, independently of composer focus and scroll.
export function canReadPaneReply({ foreground, visible, selected, chatId, loadedChatId, loading, running, completed, unread }) {
  return !!(foreground && visible && selected && chatId && loadedChatId === chatId && !loading && !running && completed && unread);
}
