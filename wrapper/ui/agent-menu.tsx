import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatMenu } from "./chat-controls.jsx";
import { Avatar } from "./avatar.jsx";
import { Activity, RotateCcw, Settings } from "./icons.jsx";

import { IconButton } from "./icon-button";
import { ThemeToggle } from "./components/ui/theme-toggle";

type Props = {
  companionHidden?: boolean;
  onShowCompanion?: () => void;
  theme?: "dark" | "light";
  onThemeChange?: (theme: "dark" | "light") => void | Promise<void>;
  name: string;
  avatar?: string;
  avatarColor?: string;
  connectionState: string;
  restartBusy?: boolean;
  onNavigate: (tab: string) => void;
  onRestart: () => void;
  preview?: boolean;
};

/** Fit the real text before resorting to ellipsis, including after font loading. */
function AgentName({ name }: { name: string }) {
  const container = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = container.current;
    const label = text.current;
    if (!box || !label) return;
    let disposed = false;
    let lastWidth = -1;
    const fit = () => {
      if (disposed || !box.clientWidth) return;
      lastWidth = box.clientWidth;
      label.style.setProperty("--agent-name-scale", "1");
      const naturalWidth = label.getBoundingClientRect().width;
      const scale = naturalWidth ? Math.min(1, box.clientWidth / naturalWidth) : 1;
      label.style.setProperty("--agent-name-scale", String(scale));
    };
    fit();
    const observer = new ResizeObserver(() => {
      if (box.clientWidth !== lastWidth) fit();
    });
    observer.observe(box);
    // Covers theme/font-size preferences even when the sidebar width stays fixed.
    const appearance = new MutationObserver(fit);
    appearance.observe(document.documentElement, { attributes: true });
    document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      disposed = true;
      observer.disconnect();
      appearance.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [name]);
  return <span ref={container} className="agent-menu-name" title={name}>
    <span ref={text} className="agent-menu-name-text">{name}</span>
  </span>;
}

function timestamp(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Date(value).toLocaleString("de-DE", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
}

function ServerDetails({ connectionState, preview }: Pick<Props, "connectionState" | "preview">) {
  const [status, setStatus] = useState<{ online: boolean; latency?: number; engine?: { name?: string; connected?: boolean }; uptimeSeconds?: number; startedAt?: string; installation?: { version?: string; commit?: string; committedAt?: string; pushedAt?: string } } | null>(null);
  useEffect(() => {
    if (preview) return;
    let disposed = false;
    let controller: AbortController;
    const measure = async () => {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const start = performance.now();
      try {
        const response = await fetch("/api/status", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!disposed) setStatus({ ...data, online: true, latency: Math.round(performance.now() - start) });
      } catch {
        if (!disposed) setStatus({ online: false });
      } finally {
        clearTimeout(timeout);
      }
    };
    void measure();
    const interval = setInterval(measure, 30000);
    return () => { disposed = true; controller?.abort(); clearInterval(interval); };
  }, [preview]);
  const label = preview ? "Lokale Designvorschau" : status?.online === false ? "Server nicht erreichbar" : ["connecting", "reconnecting"].includes(connectionState) ? "Verbindung wird hergestellt …" : connectionState !== "online" ? "Verbindung unterbrochen" : status ? "Verbunden" : "Server wird geprüft …";
  return <div className="agent-server-details">
    <p className="agent-product"><span>Vanilla <span className="agent-product-version">{status?.installation?.version || "—"}</span></span><span className="agent-product-maker">Denzer AI</span></p>
    <p className="agent-connection" role="status">{label}{status?.online && <> · {status.engine?.name || "Engine unbekannt"}{status.engine?.connected === false ? " getrennt" : ""} · {status.latency} ms</>}</p>
    {!preview && <>
      <dl>
        <dt>Commit</dt><dd title={status?.installation?.committedAt ? new Date(status.installation.committedAt).toLocaleString("de-DE") : "Nicht erfasst"}><span className="agent-commit">{status?.installation?.commit || "—"}</span>{status?.installation?.committedAt && <> · {timestamp(status.installation.committedAt)}</>}</dd>
        <dt>Push</dt><dd title={status?.installation?.pushedAt ? `Letzter lokal belegter Git-Push: ${new Date(status.installation.pushedAt).toLocaleString("de-DE")}` : "Kein lokaler Push-Zeitpunkt erfasst"}>{timestamp(status?.installation?.pushedAt)}</dd>
        <dt>Neustart</dt><dd title={status?.startedAt ? new Date(status.startedAt).toLocaleString("de-DE") : "Nicht erfasst"}>{timestamp(status?.startedAt)}</dd>
        <dt>Laufzeit</dt><dd>{status?.uptimeSeconds == null ? "—" : [status.uptimeSeconds >= 86400 ? `${Math.floor(status.uptimeSeconds / 86400)} T` : "", status.uptimeSeconds >= 3600 ? `${Math.floor(status.uptimeSeconds / 3600) % 24} Std` : "", `${Math.floor(status.uptimeSeconds / 60) % 60} Min`].filter(Boolean).join(" ")}</dd>
      </dl>
      <p className="agent-server-host" title={window.location.host}>{window.location.host}</p>
    </>}
  </div>;
}

export function AgentMenu({ theme, onThemeChange, name, avatar, avatarColor, connectionState, restartBusy = false, onNavigate, onRestart, preview = false, companionHidden = false, onShowCompanion }: Props) {
  const state = restartBusy ? "Startet neu …" : connectionState === "online" ? "Verbunden" : ["connecting", "reconnecting"].includes(connectionState) ? "Verbindet …" : "Verbindung unterbrochen";
  return <ChatMenu
    label={`${name || "Vanilla"} · Agent-Menü · ${state}`}
    className="profile-button agent-menu-trigger"
    menuClassName="agent-menu"
    selected={undefined}
    footer={(close: () => void) => <span className="agent-theme-row"><IconButton role="menuitem" label={restartBusy ? "Server startet neu …" : "Server neu starten"} className="agent-restart-button" disabled={restartBusy} onClick={() => { close(); onRestart(); }}><RotateCcw size={18} strokeWidth={1.55}/></IconButton><ThemeToggle theme={theme} onThemeChange={onThemeChange} menuItem /></span>}
    header={<ServerDetails connectionState={connectionState} preview={preview} />}
    items={[
      ...(companionHidden && onShowCompanion ? [{ id: "companion", label: `${name || "Figur"} auf der Schreibzeile zeigen`, icon: React.createElement(Avatar as any, { avatar, color: avatarColor }), action: onShowCompanion }] : []),
      { id: "usage", label: "Nutzung", icon: <Activity size={18} strokeWidth={1.55} />, action: () => onNavigate("usage") },
      { id: "settings", label: "Einstellungen", icon: <Settings size={18} strokeWidth={1.55} />, action: () => onNavigate("general") },
    ]}
  >
    <AgentName name={name || "Vanilla"} />
  </ChatMenu>;
}
