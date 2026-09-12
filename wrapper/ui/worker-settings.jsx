import {AIMaintenanceSettings} from "./ai-maintenance.tsx";
import {Skeleton} from './skeleton.tsx';
import React, { useEffect, useState } from "react";
import { SettingRow } from "./settings-row.jsx";
import "./worker-settings.css";
import { ChevronDown } from "./icons.jsx";
import { BrandIcon } from "./brand-icon.jsx";
import { workerName } from "../../system/worker-catalog.mjs";

export function WorkerSettings({ api, onChange, onConnections }) {
  const [data, setData] = useState(null), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    let alive = true;
    api("/workers").then(r => { if (alive) setData({ ...r, workers: r.workers.map(w => ({ ...w, name: workerName(w.id) })) }); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api]);
  async function act(key, route, body) {
    setBusy(key); setError("");
    try { const r = await api(route, body); setData({ ...r, workers: r.workers.map(w => ({ ...w, name: workerName(w.id) })) }); await onChange(); }
    catch(e) { setError(e.message); }
    finally { setBusy(""); }
  }
  if (!data && !error) return <Skeleton variant="settings" label="Anschlüsse werden geprüft …"/>;
  if (!data) return <div className="settings-group"><SettingRow title="Worker" description={error || "Anschlüsse werden geprüft …"} action={error && <button onClick={() => act("reload", "/workers")}>Erneut prüfen</button>} /></div>;
  const choices = data.workers.filter(w => w.configured);
  const present = data.workers.filter(w => w.connected || w.installed);
  const available = data.workers.filter(w => !w.connected && !w.installed);
  const row = w => <React.Fragment key={w.id}>
    <SettingRow icon={<BrandIcon name={w.id}/>} title={w.name}
      description={w.error ? w.status : !w.installed && !w.connected ? (w.configured ? "Nicht installiert · Einrichtung gespeichert" : "Nicht installiert") : w.connected ? w.status : w.configured ? "Eingerichtet · Bei Bedarf verbunden" : "Installiert"}
      action={<button className="worker-disclosure" aria-label={`Details: ${w.name}`} aria-expanded={expanded === w.id} aria-controls={`worker-${w.id}`} onClick={() => setExpanded(expanded === w.id ? null : w.id)}><ChevronDown size={18}/></button>}/>
    {expanded === w.id && <div className="worker-detail" id={`worker-${w.id}`}>
      <p>{w.error || (w.connected ? "Konto und Modelle werden im jeweiligen Programm verwaltet." : w.configured && w.installed ? "Die Einrichtung ist gespeichert. Das Programm startet bei der nächsten Aufgabe." : "Programm installieren, dort anmelden und anschließend hier verbinden.")}</p>
      <div className="worker-actions">
        {w.installed && <button disabled={!!busy} onClick={() => act(w.id, "/workers/connect", {id:w.id})}>{busy === w.id ? "Verbinde …" : w.connected ? "Neu verbinden" : w.configured ? "Verbindung prüfen" : "Verbinden"}</button>}
        {!w.installed && <button disabled={!!busy} onClick={() => act(w.id, "/workers")}>Installation prüfen</button>}
        {w.installURL && <a className="button" href={w.installURL} target="_blank" rel="noreferrer">Einrichtung öffnen ↗</a>}
        {w.configured && ![data.settings.defaultWorker,data.settings.fallbackWorker].includes(w.id) && <button disabled={!!busy} onClick={() => act(w.id, "/workers/disconnect", {id:w.id})}>Trennen</button>}
      </div>
      <details><summary>Technische Details</summary><p>{w.description}. {w.version && `Version: ${w.version}`}</p><p>Eigener Programmpfad: <code>{w.env}</code></p></details>
    </div>}
  </React.Fragment>;
  return <div className="worker-settings">
    {error && <p className="worker-error" role="alert">{error}</p>}
    <div className="settings-group">
      <SettingRow title="Standard" action={
        <select aria-label="Standard-Worker" value={data.settings.defaultWorker} disabled={!!busy} onChange={e => act("preferences", "/workers/preferences", { ...data.settings, defaultWorker: e.target.value, fallbackWorker: e.target.value === data.settings.fallbackWorker ? null : data.settings.fallbackWorker })}>
          <option value="auto">Auto</option>
          {choices.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      } />
      <SettingRow title="Vertretung" action={
        <select aria-label="Vertretung" value={data.settings.fallbackWorker || ""} disabled={!!busy} onChange={e => act("preferences", "/workers/preferences", { ...data.settings, fallbackWorker: e.target.value || null })}>
          <option value="">{data.settings.defaultWorker === "auto" ? "Automatisch" : "Keine"}</option>
          {choices.filter(w => w.id !== data.settings.defaultWorker).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      } />
    </div>
    {data.settings.defaultWorker === "auto" && <p className="worker-routing" role="status">{(data.routingOrder || choices.map(w => w.id)).map(workerName).join(" → ") || "Noch kein Worker eingerichtet"}{choices.length === 1 ? " · Weitere Worker zuerst verbinden" : " · Wechsel nur vor Aufgabenbeginn"}</p>}
    <h3>Deine KI</h3>
    <div className="settings-group">
      {present.length ? present.map(row) : <SettingRow title="Noch kein KI-Programm installiert"/>}
    </div>
    <details className="settings-group ai-disclosure">
      <summary>KI entdecken</summary>
      {available.map(row)}
      <AIMaintenanceSettings api={api} section="catalog"/>
    </details>
    <AIMaintenanceSettings api={api} section="updates"/>
    <div className="settings-group"><SettingRow title="Eingerichtete Verbindungen" action={<button onClick={onConnections}>Öffnen</button>}/></div>
  </div>;
}
