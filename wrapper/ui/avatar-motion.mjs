import { avatarMotion } from "./design-system.mjs";
// One visibility observer for all avatars, including long conversation histories.
const avatars = new Map();
let observer;
function updateVisibility() {
  for (const [element, visible] of avatars)
    element.dataset.avatarMotion = visible && !document.hidden ? "running" : "paused";
}
export function observeAvatarMotion(element) {
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries)
        if (avatars.has(entry.target)) avatars.set(entry.target, entry.isIntersecting);
      updateVisibility();
    });
    document.addEventListener("visibilitychange", updateVisibility);
  }
  avatars.set(element, false);
  element.dataset.avatarMotion = "paused";
  observer.observe(element);
  return () => {
    observer.unobserve(element);
    avatars.delete(element);
    if (!avatars.size) {
      observer.disconnect();
      observer = undefined;
      document.removeEventListener("visibilitychange", updateVisibility);
    }
  };
}

export function avatarMotionTiming() {
  return {
    "--avatar-blink-cycle": `${avatarMotion.blink + Math.random() * avatarMotion.blinkVariance}s`,
    "--avatar-gaze-cycle": `${avatarMotion.gaze + Math.random() * avatarMotion.gazeVariance}s`,
    "--avatar-expression-cycle": `${avatarMotion.expression + Math.random() * avatarMotion.expressionVariance}s`,
    "--avatar-delay": `${avatarMotion.delay + Math.random() * avatarMotion.delayVariance}s`,
  };
}
