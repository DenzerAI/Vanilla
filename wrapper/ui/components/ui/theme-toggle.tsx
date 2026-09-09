"use client"

import { useState } from "react"
import { LucideMoon as Moon, LucideSun as Sun } from "../../icon-variants.jsx"
import { cn } from "@/lib/utils"
import "./theme-toggle.css"

interface ThemeToggleProps {
  className?: string
  theme?: "dark" | "light"
  onThemeChange?: (theme: "dark" | "light") => void | Promise<void>
  disabled?: boolean
  menuItem?: boolean
}

export function ThemeToggle({ className, theme, onThemeChange, disabled, menuItem }: ThemeToggleProps) {
  const [localTheme, setLocalTheme] = useState<"dark" | "light">("dark")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const isDark = (theme ?? localTheme) === "dark"

  async function toggle() {
    if (busy || disabled) return
    const next = isDark ? "light" : "dark"
    setBusy(true)
    setError("")
    try {
      await onThemeChange?.(next)
      setLocalTheme(next)
    } catch {
      setError("Erscheinungsbild konnte nicht gespeichert werden. Bitte erneut versuchen.")
    } finally {
      setBusy(false)
    }
  }

  return <span className="theme-toggle-control" data-icon-motion="off">
    <button type="button" className={cn("theme-toggle", className)}
      role={menuItem ? "menuitemcheckbox" : "switch"} aria-label="Dunkles Erscheinungsbild"
      aria-checked={isDark} aria-busy={busy || undefined} disabled={disabled || busy}
      title={isDark ? "Zu Hell wechseln" : "Zu Dunkel wechseln"}
      data-theme-choice={isDark ? "dark" : "light"} onClick={toggle}>
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
        <Moon className="theme-toggle-moon" size={16} strokeWidth={1.5} />
        <Sun className="theme-toggle-sun" size={16} strokeWidth={1.5} />
      </span>
    </button>
    {error && <span className="theme-toggle-error" role="alert">{error}</span>}
  </span>
}
