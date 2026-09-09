import { iconMotion } from "./design-system.mjs";
import { iconByName } from "./icon-catalog.mjs";
import { createIcon } from "./icon-animation.mjs";

type Motion = {
  frame: (time: number) => void;
  reset: () => void;
  name: string;
};
const registered = new WeakMap<Element, Motion>();
const active = new Map<
  Element,
  { motion: Motion; start: number; duration: number }
>();
const controls = 'button, summary, [role="button"], [role="menuitem"], a[href]';
let animationFrame = 0;

/** Own only SVG descendants. React retains the SVG's size, class, ARIA and state transforms. */
export function mountIcon(node: SVGSVGElement, name: string) {
  const item = iconByName[name];
  if (!item) throw new Error(`Unknown system icon: ${name}`);
  const instance = createIcon(item, {
    confirmation: !!node.closest("[data-icon-preview]"),
  });
  node.replaceChildren(...instance.svg.childNodes);
  const motion = { frame: instance.frame, reset: instance.reset, name };
  registered.set(node, motion);
  return () => {
    stopIcon(node);
    registered.delete(node);
  };
}

function stopIcon(node: Element) {
  const entry = active.get(node);
  if (entry) {
    entry.motion.reset();
    active.delete(node);
  }
}
export function cancelIconMotion() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  for (const node of active.keys()) stopIcon(node);
}
function motionAllowed() {
  return (
    !document.hidden &&
    document.documentElement.dataset.iconAnimation !== "off" &&
    document.documentElement.dataset.reduceMotion !== "on" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
function visible(node: Element) {
  if (
    !node.isConnected ||
    !node.getClientRects().length ||
    node.closest('[hidden], [inert], [data-icon-motion="off"]')
  )
    return false;
  const rect = node.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}
function tick(now: number) {
  animationFrame = 0;
  if (!motionAllowed()) {
    cancelIconMotion();
    return;
  }
  for (const [node, entry] of active) {
    if (!visible(node)) {
      stopIcon(node);
      continue;
    }
    const progress = Math.min(
      1,
      Math.max(0, (now - entry.start) / entry.duration),
    );
    entry.motion.frame(progress);
    if (progress === 1) stopIcon(node);
  }
  if (active.size) animationFrame = requestAnimationFrame(tick);
}

/** Repeated hover/click never interrupts a running gesture or its native action. */
export function animateIcon(
  node: Element | null,
  effect: "action" | "bell" | "success" | "preview" = "action",
) {
  if (
    !node ||
    !motionAllowed() ||
    !visible(node) ||
    active.has(node) ||
    node.closest('button:disabled, [aria-disabled="true"]')
  )
    return;
  const motion = registered.get(node);
  if (
    !motion ||
    (node.classList.contains("ui-icon-spinner") && effect !== "preview")
  )
    return;
  const duration =
    motion.name === "Copy" && !node.closest("[data-icon-preview]")
      ? iconMotion.copyHoverDuration
      : iconMotion.durations[motion.name as keyof typeof iconMotion.durations];
  active.set(node, { motion, start: performance.now(), duration });
  if (!animationFrame) animationFrame = requestAnimationFrame(tick);
}

/** One delegated listener also covers menus, links, labelled actions and portals. */
export function installIconMotion() {
  const lastHover = new WeakMap<Element, number>();
  const desktop = window.matchMedia("(hover: hover) and (pointer: fine)");
  const activate = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(controls);
    if (
      !button ||
      button.matches(':disabled, [aria-disabled="true"]') ||
      button.closest(
        '[inert], [data-icon-motion="off"], [aria-busy="true"], [data-icon-feedback="copied"]',
      )
    )
      return;
    if (
      event instanceof KeyboardEvent &&
      (event.repeat ||
        !["ArrowDown", "ArrowUp"].includes(event.key) ||
        button.getAttribute("aria-haspopup") !== "menu")
    )
      return;
    if (event.type === "pointerover") {
      const pointer = event as PointerEvent;
      if (
        document.documentElement.dataset.iconAnimation === "press" ||
        !desktop.matches ||
        pointer.pointerType !== "mouse" ||
        (pointer.relatedTarget instanceof Node &&
          button.contains(pointer.relatedTarget))
      )
        return;
      const now = performance.now();
      if (now - (lastHover.get(button) ?? -Infinity) < iconMotion.hoverCooldown)
        return;
      lastHover.set(button, now);
    }
    const glyph = [
      ...button.querySelectorAll<SVGElement>("svg[data-icon-name]"),
    ].find((svg) => {
      if (
        svg.closest(controls) !== button ||
        svg.classList.contains("ui-icon-spinner")
      )
        return false;
      // The existing disclosure transform already communicates expanded/collapsed state.
      return !(
        svg.dataset.iconName?.startsWith("Chevron") &&
        (button.hasAttribute("aria-expanded") || button.tagName === "SUMMARY")
      );
    });
    animateIcon(
      glyph || null,
      button.closest("[data-icon-preview]") ? "preview" : "action",
    );
  };
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const preference = () => {
    if (!motionAllowed()) cancelIconMotion();
  };
  const observer = new MutationObserver(preference);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-reduce-motion", "data-icon-animation"],
  });
  document.addEventListener("click", activate, true);
  document.addEventListener("pointerover", activate, true);
  document.addEventListener("keydown", activate, true);
  document.addEventListener("visibilitychange", preference);
  media.addEventListener("change", preference);
  return () => {
    document.removeEventListener("click", activate, true);
    document.removeEventListener("pointerover", activate, true);
    document.removeEventListener("keydown", activate, true);
    document.removeEventListener("visibilitychange", preference);
    media.removeEventListener("change", preference);
    observer.disconnect();
    cancelIconMotion();
  };
}
