import React, { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, SlidersHorizontal } from "./icons.jsx";

export function FilterPicker({ label, options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null),
    menu = useRef(null),
    initialFocus = useRef("selected");
  const typeahead = useRef({ text: "", at: 0 });
  const id = useId();
  const selected =
    options.find((option) => option.value === value) || options[0];
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  const show = (focus = "selected") => {
    initialFocus.current = focus;
    typeahead.current = { text: "", at: 0 };
    setPosition(null);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 20;
      const above = rect.top - 20;
      const height = menu.current.scrollHeight;
      const down = below >= Math.min(height, 240) || below >= above;
      const maxHeight = Math.max(0, down ? below : above);
      setPosition({
        width,
        maxHeight,
        left: Math.max(
          12,
          Math.min(rect.right - width, window.innerWidth - width - 12),
        ),
        top: down
          ? rect.bottom + 8
          : Math.max(12, rect.top - 8 - Math.min(height, maxHeight)),
      });
    };
    place();
    const items = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
    const target =
      initialFocus.current === "last"
        ? items.at(-1)
        : items.find((item) => item.getAttribute("aria-checked") === "true") ||
          items[0];
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
    const outside = (event) => {
      if (
        !menu.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open, options.length]);

  function navigate(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    const items = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
    const current = items.indexOf(document.activeElement);
    let next;
    if (event.key === "ArrowDown") next = items[(current + 1) % items.length];
    if (event.key === "ArrowUp")
      next = items[(current - 1 + items.length) % items.length];
    if (event.key === "Home") next = items[0];
    if (event.key === "End") next = items.at(-1);
    if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const now = Date.now();
      const text =
        (now - typeahead.current.at < 700 ? typeahead.current.text : "") +
        event.key.toLocaleLowerCase("de");
      typeahead.current = { text, at: now };
      next = items.find((item) =>
        item.textContent.trim().toLocaleLowerCase("de").startsWith(text),
      );
    }
    if (next) {
      event.preventDefault();
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: "nearest" });
    }
  }

  return (
    <div className="filter-picker">
      <button
        ref={trigger}
        type="button"
        className="filter-trigger"
        aria-label={`${label}: ${selected?.label || ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show(event.key === "ArrowUp" ? "last" : "selected");
          }
        }}
      >
        <SlidersHorizontal size={19} />
        <span>{selected?.label}</span>
        <ChevronDown size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={label}
            className="filter-popover glass"
            style={position || { opacity: 0, pointerEvents: "none" }}
            onKeyDown={navigate}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget) &&
                event.relatedTarget !== trigger.current
              )
                close(false);
            }}
          >
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                role="menuitemradio"
                aria-checked={option.value === value}
                tabIndex={-1}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <span>{option.label}</span>
                <Check size={17} />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
