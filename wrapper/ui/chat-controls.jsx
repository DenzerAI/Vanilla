import React, {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "./icons.jsx";

export function ChatMenu({
  label,
  children,
  items,
  className = "",
  selected,
  footer,
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
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
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
            className="chat-dropdown"
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
export function LayoutGlyph({ count = 2 }) {
  return (
    <svg
      width="20"
      height="18"
      viewBox="0 0 24 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="16" rx="2" />
      {Array.from({ length: count - 1 }, (_, i) => (
        <path key={i} d={`M${2 + (20 * (i + 1)) / count} 2v16`} />
      ))}
    </svg>
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
export function ChatTitle({ session }) {
  if (!session) return <span className="title-text">Neuer Chat</span>;
  return (
    <ChatMenu
      label={`Chat-Menü: ${session.title}`}
      className="chat-title-button"
      items={session.items}
    >
      <span title={session.projectName} className="chat-project-icon">
        {session.projectIcon}
      </span>
      <span className="title-text">{session.title}</span>
      <ChevronDown size={14} />
    </ChatMenu>
  );
}
export function ConnectionStatus({ connectionState }) {
  const [status, setStatus] = useState(null),
    [open, setOpen] = useState(false);
  const id = useId(),
    trigger = useRef(null),
    popup = useRef(null);
  useEffect(() => {
    let disposed = false,
      controller;
    const measure = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000),
        start = performance.now();
      try {
        const response = await fetch("/api/status", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!disposed)
          setStatus({
            ...data,
            latency: Math.round(performance.now() - start),
            online: true,
          });
      } catch {
        if (!disposed) setStatus({ online: false });
      } finally {
        clearTimeout(timeout);
      }
    };
    measure();
    const interval = setInterval(measure, 30000);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (
        !trigger.current?.contains(e.target) &&
        !popup.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const online = connectionState === "online" && status?.online !== false;
  const rect = open ? trigger.current?.getBoundingClientRect() : null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="connection-status-button"
        aria-label={`Serverstatus: ${online ? "verbunden" : "Verbindung unterbrochen"}`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <span className={`status-dot ${online ? "online" : "offline"}`} />
      </button>
      {open &&
        rect &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="connection-tooltip"
            style={{
              left: Math.max(
                12,
                Math.min(rect.right - 280, window.innerWidth - 292),
              ),
              bottom: window.innerHeight - rect.top + 8,
            }}
          >
            <strong>
              {status?.online === false
                ? "Server nicht erreichbar"
                : status
                  ? "Server aktiv"
                  : "Server wird geprüft …"}
            </strong>
            <dl>
              <dt>Server</dt>
              <dd>{window.location.host}</dd>
              <dt>Engine</dt>
              <dd>
                {status?.engine?.name || "Codex"} ·{" "}
                {online && status?.engine?.connected !== false
                  ? "verbunden"
                  : connectionState === "reconnecting"
                    ? "verbindet …"
                    : "offline"}
              </dd>
              <dt>Server-Antwortzeit</dt>
              <dd>
                {status?.online ? `${status.latency} ms` : "Nicht verfügbar"}
              </dd>
            </dl>
          </div>,
          document.body,
        )}
    </>
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
