export const chatGreetings = [
  "Womit legen wir los?",
  "Was liegt heute an?",
  "Wobei kann ich dir helfen?",
  "Was nehmen wir uns vor?",
  "Was möchtest du angehen?",
  "Wobei darf ich mitdenken?",
];
let fallbackIndex = -1;
export function nextChatGreeting() {
  let previous = fallbackIndex;
  try {
    previous = Number(sessionStorage.getItem("agent-chat-greeting") ?? -1);
  } catch {}
  const index =
    Number.isInteger(previous) && previous >= -1
      ? (previous + 1) % chatGreetings.length
      : 0;
  fallbackIndex = index;
  try {
    sessionStorage.setItem("agent-chat-greeting", String(index));
  } catch {}
  return chatGreetings[index];
}
