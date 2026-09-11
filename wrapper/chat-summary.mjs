// Only the browser sidebar opts into this projection. Native context is untouched.
export function browserChat(chat, compact) {
  if (!compact) return chat;
  const {tokenUsage, statisticsTurns, ...summary} = chat;
  return summary;
}
