import { LayoutGlyph } from './icon-variants.jsx';
export { LayoutGlyph } from './icon-variants.jsx';
import React, {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MoreHorizontal } from "./icons.jsx";

export function ChatMenu({
  label,
  children,
  items,
  className = "",
  selected,
  footer,
  header = /** @type {React.ReactNode} */ (null),
  menuClassName = "",
  disabled = false,
  placement = "auto",
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({});
  const trigger = useRef(null),
    popup = useRef(null),
    id = useId();
  const close = (focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current.getBoundingClientRect(),
        width = Math.min(Math.max(placement === "above" ? 200 : 292, popup.current?.scrollWidth || 0), window.innerWidth - 24);
      const below = window.innerHeight - r.bottom - 18, above = r.top - 18;
      const height = Math.min(popup.current?.scrollHeight || 0, Math.max(below, above));
      const openAbove = placement === "above" ? above >= height || above > below : height > below && above > below;
      setPosition({
        width,
        left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)),
        top: openAbove ? Math.max(12, r.top - height - 6) : r.bottom + 6,
        maxHeight: Math.max(0, openAbove ? above : below),
      });
    };
    place();
    popup.current
      ?.querySelector('[aria-checked="true"], button:not(:disabled)')
      ?.focus();
    const outside = (e) => {
      if (
        !popup.current?.contains(e.target) &&
        !trigger.current?.contains(e.target)
      )
        close(false);
    };
    const shortcut = (e) => {
      if ((e.metaKey || e.ctrlKey) && ["k", "n", ","].includes(e.key.toLowerCase())) close(false);
    };
    const observer = new ResizeObserver(place);
    observer.observe(popup.current);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", shortcut);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", shortcut);
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={className}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="menu"
            aria-label={label}
            className={`chat-dropdown ${menuClassName}`}
            style={position}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
              if (e.key === "Tab") close(false);
              const buttons = [
                  ...popup.current.querySelectorAll("button:not(:disabled)"),
                ],
                index = buttons.indexOf(document.activeElement);
              const next =
                e.key === "ArrowDown"
                  ? (index + 1) % buttons.length
                  : e.key === "ArrowUp"
                    ? (index - 1 + buttons.length) % buttons.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? buttons.length - 1
                        : null;
              if (next != null) {
                e.preventDefault();
                buttons[next]?.focus();
              }
            }}
          >
            {header}
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                role={selected !== undefined ? "menuitemradio" : "menuitem"}
                aria-checked={
                  selected !== undefined ? selected === item.id : undefined
                }
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.action();
                }}
              >
                {item.icon}
                <span>
                  {item.label}
                  {item.detail && <small>{item.detail}</small>}
                </span>
                {selected === item.id && <Check size={16} />}
              </button>
            ))}
            {footer && <p className="dropdown-note">{footer}</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
export function LayoutPicker({ count, onChange }) {
  return (
    <ChatMenu
      label="Chat-Ansicht"
      className={"icon-button layout-trigger " + (count > 1 ? "selected" : "")}
      selected={count}
      items={[1, 2, 3, 4].map((n) => ({
        id: n,
        label: n === 1 ? "1 Chat" : `${n} Chats`,
        icon: <LayoutGlyph count={n} />,
        action: () => onChange(n),
      }))}
    >
      <LayoutGlyph count={count} />
    </ChatMenu>
  );
}
export function ChatTitle({ session, compact = false, extraItems = [] }) {
  if (!session) return <span className="title-text">Neuer Chat</span>;
  return (
    <ChatMenu
      label={`Chat-Menü: ${session.title}`}
      className={compact ? "icon-button" : "chat-title-button"}
      items={[...extraItems, ...session.items]}
    >
      {compact ? <MoreHorizontal size={20} /> : <><span title={session.projectName} className="chat-project-icon">
        {session.projectIcon}
      </span>
      <span className="title-text">{session.title}</span>
      <ChevronDown size={14} /></>}
    </ChatMenu>
  );
}
export function PaneDivider({ onResize, value = 50, label = "Chat-Breite ändern", min = 0, max = 100, onReset }) {
  const drag = useRef(null);
  return (
    <div
      className="pane-divider"
      role="separator"
      aria-label={label}
      title={onReset ? "Ziehen oder Pfeiltasten · Doppelklick für automatische Breite" : label}
      onDoubleClick={onReset}
      aria-orientation="vertical"
      tabIndex={0}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (drag.current != null) {
          onResize(e.clientX - drag.current);
          drag.current = e.clientX;
        }
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => { drag.current = null; }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          onResize(e.key === "ArrowLeft" ? -24 : 24);
        }
      }}
    />
  );
}
