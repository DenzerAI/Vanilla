import {AIMaintenanceSettings} from "./ai-maintenance.tsx";
import {Skeleton} from './skeleton.tsx';
import React, { useEffect, useState } from "react";
import { SettingRow } from "./settings-row.jsx";
import "./worker-settings.css";
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
    <h3>Deine KI-Programme</h3>
    <div className="settings-group">
      {data.workers.map(w => <React.Fragment key={w.id}>
        <SettingRow icon={<BrandIcon name={w.id} />} title={w.name} description={w.status} action={<div className="worker-actions">
          {w.installed && !w.connected && <button disabled={!!busy} onClick={() => act(w.id, "/workers/connect", { id: w.id })}>{busy === w.id ? "Verbinde …" : "Verbinden"}</button>}
          <button aria-label={`${w.connected ? "Verwalten" : "Einrichten"}: ${w.name}`} aria-expanded={expanded === w.id} aria-controls={`worker-${w.id}`} disabled={!!busy} onClick={() => setExpanded(expanded === w.id ? null : w.id)}>{expanded === w.id ? "Schließen" : w.connected ? "Verwalten" : w.installed ? "Details" : "Einrichten"}</button>
        </div>} />
        {expanded === w.id && <div className="worker-detail" id={`worker-${w.id}`}>
          <p>{w.error || (w.connected ? "Die Schnittstelle antwortet. Konto, Modelle und Werkzeuge werden im jeweiligen Worker eingerichtet." : "Installiere den Worker und richte dort dein Konto ein. Danach hier verbinden.")}</p>
          <div className="worker-actions">
            {!w.connected && <button disabled={!!busy} onClick={() => act(w.id, "/workers")}>Installation prüfen</button>}
            {w.installURL && <a className="button" href={w.installURL} target="_blank" rel="noreferrer">Einrichtung öffnen ↗</a>}
            {w.connected && <button disabled={!!busy} onClick={() => act(w.id, "/workers/connect", { id: w.id })}>{busy === w.id ? "Verbinde …" : "Neu verbinden"}</button>}
            {w.configured && ![data.settings.defaultWorker, data.settings.fallbackWorker].includes(w.id) && <button disabled={!!busy} onClick={() => act(w.id, "/workers/disconnect", { id: w.id })}>Trennen</button>}
          </div>
          <details><summary>Technische Details</summary><p>{w.description}. {w.capabilities.plan ? "Geschützter Planmodus verfügbar." : "Geschützter Planmodus hier nicht verfügbar."} Browserzugriff hängt von den Werkzeugen des Workers ab.</p><p>Eigener Programmpfad: <code>{w.env}</code>. {w.version && `Version: ${w.version}`}</p>{!w.command && <p>Für Claude Code wird ein separater ACP-Adapter benötigt.</p>}</details>
        </div>}
      </React.Fragment>)}
    </div>
    <AIMaintenanceSettings api={api}/>
    <h3>Feste Abläufe</h3>
    <div className="settings-group"><SettingRow icon={<BrandIcon name="n8n" />} title="n8n" action={<button onClick={onConnections}>Verbindungen öffnen</button>} /></div>
  </div>;
}
