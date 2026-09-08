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
    "--avatar-blink-cycle": `${22 + Math.random() * 8}s`,
    "--avatar-gaze-cycle": `${36 + Math.random() * 12}s`,
    "--avatar-blink-delay": `${1 + Math.random() * 3}s`,
    "--avatar-gaze-delay": `${2 + Math.random() * 4}s`,
  };
}
