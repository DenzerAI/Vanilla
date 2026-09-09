import React, { useEffect, useState } from "react";
import { ChatMenu } from "./chat-controls.jsx";
import { Avatar } from "./avatar.jsx";
import { Activity, Archive, RotateCcw, Settings } from "./icons.jsx";

import { ThemeToggle } from "./components/ui/theme-toggle";

type Props = {
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

function ServerDetails({ connectionState, preview }: Pick<Props, "connectionState" | "preview">) {
  const [status, setStatus] = useState<{ online: boolean; latency?: number; engine?: { name?: string; connected?: boolean } } | null>(null);
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
        if (!disposed) setStatus({ online: true, engine: data.engine, latency: Math.round(performance.now() - start) });
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
  const label = preview ? "Lokale Designvorschau" : status?.online === false ? "Server nicht erreichbar" : ["connecting", "reconnecting"].includes(connectionState) ? "Verbindung wird hergestellt …" : connectionState !== "online" ? "Verbindung unterbrochen" : status ? "Server verbunden" : "Server wird geprüft …";
  return <div className="agent-server-details">
    <p role="status">{label}</p>
    {!preview && <dl>
      <dt>Server</dt><dd>{window.location.host}</dd>
      <dt>Engine</dt><dd>{status?.engine?.name || "Nicht verfügbar"}{status?.engine?.connected === false ? " · getrennt" : ""}</dd>
      <dt>Antwortzeit</dt><dd>{status?.online ? `${status.latency} ms` : "Nicht verfügbar"}</dd>
    </dl>}
  </div>;
}

export function AgentMenu({ theme, onThemeChange, name, avatar, avatarColor, connectionState, restartBusy = false, onNavigate, onRestart, preview = false }: Props) {
  const state = restartBusy ? "Startet neu …" : connectionState === "online" ? "Verbunden" : ["connecting", "reconnecting"].includes(connectionState) ? "Verbindet …" : "Verbindung unterbrochen";
  return <ChatMenu
    label={`${name || "Agent"} · Agent-Menü · ${state}`}
    className="profile-button agent-menu-trigger"
    menuClassName="agent-menu"
    selected={undefined}
    footer={<span className="agent-theme-row"><span>Erscheinungsbild</span><ThemeToggle theme={theme} onThemeChange={onThemeChange} menuItem /></span>}
    header={<ServerDetails connectionState={connectionState} preview={preview} />}
    items={[
      { id: "usage", label: "Nutzung", icon: <Activity size={18} strokeWidth={1.55} />, action: () => onNavigate("usage") },
      { id: "settings", label: "Einstellungen", icon: <Settings size={18} strokeWidth={1.55} />, action: () => onNavigate("general") },
      { id: "archive", label: "Archivierte Chats", icon: <Archive size={18} strokeWidth={1.55} />, action: () => onNavigate("archive") },
      { id: "restart", label: restartBusy ? "Startet neu …" : "Server neu starten", icon: <RotateCcw size={18} strokeWidth={1.55} />, disabled: restartBusy, action: onRestart },
    ]}
  >
    <span className="agent-menu-avatar"><Avatar avatar={avatar} color={avatarColor} /><span aria-hidden="true" className={`status-dot ${connectionState === "online" && !restartBusy ? "online" : "offline"}`} /></span>
    <span className="agent-menu-name">{name || "Agent"}</span>
  </ChatMenu>;
}
