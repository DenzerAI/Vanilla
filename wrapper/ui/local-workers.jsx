import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw, X } from "./icons.jsx";
import "./local-workers.css";
import { BrandIcon } from "./brand-icon.jsx";
import { localModelCatalogDate } from "../local-model-catalog.mjs";

const gb = (bytes) =>
  bytes == null
    ? "Unbekannt"
    : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(bytes / 1024 ** 3)} GB`;
const providerName = (provider) =>
  provider === "ollama" ? "Ollama" : "LM Studio";

export function LocalWorkers({ api, SettingRow }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false);
  const mounted = useRef(true),
    loading = useRef(false);
  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const next = await api("/local-workers");
      if (mounted.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      loading.current = false;
    }
  }, [api]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(refresh, 6000);
    const focus = () => refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const running = data?.operations.some((o) => o.status === "running");
  useEffect(() => {
    if (!running) return;
    let disposed = false,
      timer;
    const poll = async () => {
      try {
        const { operations } = await api("/local-workers/operations");
        if (!disposed) {
          setData((previous) => previous && { ...previous, operations });
          if (!operations.some((o) => o.status === "running")) refresh();
        }
      } catch (e) {
        if (!disposed) setError(e.message);
      }
      if (!disposed) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [running, api, refresh]);
  async function action(path, body) {
    const result = await api("/local-workers/" + path, body);
    if (result.status && result.machineId)
      setData((previous) => ({
        ...previous,
        operations: [
          ...previous.operations.filter((o) => o.id !== result.id),
          result,
        ],
      }));
    else await refresh();
    return result;
  }
  const device = data?.device,
    connected = data?.machines.filter((m) => m.connected).length || 0;
  return (
    <div className="settings-group local-workers">
      <SettingRow
        title="Dieser Rechner"
        description={
          device
            ? `${device.chip} · ${gb(device.memoryBytes)} RAM${connected ? ` · ${connected} verbunden` : ""}`
            : error
              ? "Geräteprüfung nicht verfügbar"
              : "Rechner wird geprüft …"
        }

      />
      <div id="local-worker-options">
          {device && (
            <details className="local-device">
              <summary>Gerätedetails</summary>
              <dl>
                <div>
                  <dt>System</dt>
                  <dd>
                    {{ darwin: "macOS", linux: "Linux", win32: "Windows" }[
                      device.platform
                    ] || device.platform}{" "}
                    · {device.arch}
                  </dd>
                </div>
                <div>
                  <dt>Grafik</dt>
                  <dd>
                    {device.gpu?.name || "Nicht erkannt"}
                    {device.unified
                      ? " · Gemeinsamer Speicher"
                      : device.gpu?.memoryBytes
                        ? ` · ${gb(device.gpu.memoryBytes)}`
                        : ""}
                  </dd>
                </div>
                <div>
                  <dt>RAM verfügbar, geschätzt</dt>
                  <dd>
                    {gb(device.availableMemoryBytes ?? device.freeMemoryBytes)}
                  </dd>
                </div>
                <div>
                  <dt>Speicherplatz frei</dt>
                  <dd>{gb(device.diskFreeBytes)}</dd>
                </div>
              </dl>
            </details>
          )}
          {data?.machines.map((machine) => (
            <RuntimeRow
              key={machine.id}
              machine={machine}
              device={device}
              operation={data.operations
                .filter((o) => o.machineId === machine.id)
                .at(-1)}
              action={action}
              SettingRow={SettingRow}
            />
          ))}
          {data && <ModelCatalog data={data} action={action} SettingRow={SettingRow} />}
          {adding ? (
            <MachineForm action={action} onClose={() => setAdding(false)} />
          ) : (
            <SettingRow
              title="Weiterer Rechner"
              action={
                <button onClick={() => setAdding(true)}>Hinzufügen</button>
              }
            />
          )}
          <div className="local-footer">
            <span>
              {running ? "Vorgang läuft" : "Modelle für lokale Testchats"}
            </span>
            <button
              className="quiet"
              disabled={busy}
              aria-label="Lokale Worker erneut prüfen"
              onClick={async () => {
                setBusy(true);
                await refresh();
                setBusy(false);
              }}
            >
              <RefreshCw size={14} />
              {busy ? "Prüft …" : "Erneut prüfen"}
            </button>
          </div>
      </div>
      {error && (
        <p className="local-error" role="alert">
          {error} <button onClick={refresh}>Erneut prüfen</button>
        </p>
      )}
    </div>
  );
}

function RuntimeRow({ machine, device, operation, action, SettingRow }) {
  const [expanded, setExpanded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [note, setNote] = useState("");
  const [model, setModel] = useState(""),
    [prompt, setPrompt] = useState("Antworte in einem Satz: Was kannst du?");
  const [installOpened, setInstallOpened] = useState(false);
  const active = operation?.status === "running";
  const installed = machine.models || [];
  const selected = installed.some((m) => m.id === model)
    ? model
    : installed[0]?.id || "";
  async function run(path, body) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = await action(path, body);
      if (result.message && !result.status) setNote(result.message);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const status = machine.connected
    ? installed.length
      ? `${installed.length} ${installed.length === 1 ? "Modell" : "Modelle"} · Verbunden`
      : "Verbunden · Kein Modell"
    : machine.unavailable ||
      (machine.installed
        ? "Installiert · Server aus"
        : machine.local
          ? "Nicht gefunden"
          : "Nicht erreichbar");
  return (
    <div className="local-runtime">
      <SettingRow
        icon={<BrandIcon name={machine.provider} />}
        title={machine.name}
        description={
          machine.local
            ? `${machine.provider === "ollama" ? "Empfohlen · " : ""}${status}`
            : `${providerName(machine.provider)} · ${status}`
        }
        action={
          machine.connected || !machine.local ? (
            <button
              aria-expanded={expanded}
              aria-controls={"runtime-" + machine.id}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Schließen" : "Verwalten"}
            </button>
          ) : machine.unavailable ? (
            <span className="badge">Nicht unterstützt</span>
          ) : machine.installed && machine.canStart ? (
            <button
              disabled={busy}
              onClick={() => run("start", { id: machine.id })}
            >
              {busy ? "Startet …" : "Starten"}
            </button>
          ) : (
            <a
              className="button"
              href={machine.downloadURL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setInstallOpened(true)}
            >
              Installieren
            </a>
          )
        }
      />
      {machine.connected && <ul className="local-installed-models" aria-label={`Verfügbare Modelle in ${machine.name}`}>
        {installed.length ? installed.map(m => <li key={m.id}><span>{m.id}</span><span>{m.bytes ? gb(m.bytes) : "Verfügbar"}</span></li>) : <li>Keine Modelle {machine.provider === "lmstudio" ? "geladen" : "installiert"}</li>}
      </ul>}
      {installOpened && !machine.connected && (
        <p className="local-hint">
          {machine.provider === "ollama"
            ? "Ollama installieren und öffnen. Die Verbindung wird automatisch erkannt."
            : "LM Studio installieren und unter Developer den Server starten."}
        </p>
      )}
      {note && !machine.connected && (
        <p className="local-hint" role="status">
          {note}
        </p>
      )}
      {expanded && (
        <div className="local-runtime-options" id={"runtime-" + machine.id}>
          {!machine.local && (
            <div className="local-endpoint">
              <span>{machine.url}</span>
              <button
                disabled={busy || active}
                aria-label={`${machine.name} entfernen`}
                onClick={() => run("machines/remove", { id: machine.id })}
              >
                <X size={14} />
                Entfernen
              </button>
            </div>
          )}
          {!machine.connected && <p className="local-hint">{machine.error}</p>}
          {machine.connected && installed.length > 0 && (
            <form
              className="local-test"
              onSubmit={(e) => {
                e.preventDefault();
                run("test", { id: machine.id, model: selected, text: prompt });
              }}
            >
              <label htmlFor={"model-" + machine.id}>Testchat</label>
              <select
                id={"model-" + machine.id}
                value={selected}
                disabled={busy || active}
                onChange={(e) => setModel(e.target.value)}
                aria-label={`Testmodell für ${machine.name}`}
              >
                {installed.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
              <div className="local-controls">
                <input
                  aria-label={`Testnachricht für ${machine.name}`}
                  value={prompt}
                  maxLength={2000}
                  disabled={busy || active}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={busy || active || !prompt.trim() || !selected}
                >
                  Testen
                </button>
              </div>
            </form>
          )}
          {machine.connected &&
            !installed.length &&
            machine.provider === "lmstudio" && (
              <p className="local-hint">In LM Studio ein Chatmodell laden.</p>
            )}
        </div>
      )}
      {operation && (
        <div className="local-operation" aria-live="polite">
          <div className="local-operation-status">
            <span
              className={operation.status === "failed" ? "local-error" : ""}
            >
              {operation.message}
              {active && operation.percent !== null
                ? ` ${operation.percent} %`
                : ""}
            </span>
            {active && (
              <button
                disabled={busy}
                onClick={() => run("cancel", { id: operation.id })}
              >
                Stoppen
              </button>
            )}
          </div>
          {active && operation.kind === "pull" && (
            <progress
              aria-label="Modelldownload"
              max="100"
              value={operation.percent ?? undefined}
            />
          )}
          {operation.status === "completed" && operation.answer && (
            <p className="local-test-answer">{operation.answer}</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="local-error">
          {error}
        </p>
      )}
    </div>
  );
}

function MachineForm({ action, onClose }) {
  const [name, setName] = useState(""),
    [provider, setProvider] = useState("ollama"),
    [url, setUrl] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="local-machine-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await action("machines/save", { name, provider, url });
          onClose();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Name
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Büro-Mac"
          disabled={busy}
        />
      </label>
      <label>
        Anwendung
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={busy}
        >
          <option value="ollama">Ollama</option>
          <option value="lmstudio">LM Studio</option>
        </select>
      </label>
      <label>
        Serveradresse
        <input
          required
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            provider === "ollama"
              ? "http://192.168.1.20:11434"
              : "http://192.168.1.20:1234"
          }
          disabled={busy}
        />
      </label>
      {error && (
        <p className="local-error" role="alert">
          {error}
        </p>
      )}
      <div className="local-controls local-form-actions">
        <button type="button" onClick={onClose} disabled={busy}>
          Abbrechen
        </button>
        <button type="submit" disabled={busy}>
          {busy ? "Prüft …" : "Prüfen & hinzufügen"}
        </button>
      </div>
    </form>
  );
}

function ModelCatalog({ data, action, SettingRow }) {
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("suitable"), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const machine = data.machines.find(m => m.id === "local-ollama");
  const options = data.device.options || [];
  const models = options.filter(m => (filter !== "suitable" || (m.fits && m.diskFits)) && `${m.id} ${m.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const operation = data.operations.filter(o => o.machineId === "local-ollama").at(-1);
  const running = operation?.status === "running";
  async function download(model) {
    setBusy(model.id); setError("");
    try { await action("pull", { id: "local-ollama", model: model.id }); }
    catch (e) { setError(e.message); }
    finally { setBusy(""); }
  }
  return <section className="local-model-catalog" aria-labelledby="local-catalog-title">
    <h4 id="local-catalog-title">Modelle entdecken</h4>
    <div className="local-controls local-catalog-filters">
      <input type="search" aria-label="Lokale Modelle suchen" placeholder="Qwen, Gemma, Llama …" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="Modelle filtern" value={filter} onChange={e => setFilter(e.target.value)}><option value="suitable">Für diesen Rechner</option><option value="all">Alle Größen</option></select>
    </div>
    {!machine?.connected && <p className="local-hint">Zum Herunterladen Ollama oben {machine?.installed ? "starten" : "installieren"}. Modelle für LM Studio findest du in dessen Modellsuche.</p>}
    {models.map(m => {
      const installed = machine?.models.some(item => item.id === m.id);
      return <SettingRow key={m.id} title={<a className="local-model-name" href={m.url || `https://ollama.com/library/${m.id}`} target="_blank" rel="noreferrer">{m.name}</a>}
        description={`${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(m.bytes / 1e9)} GB Download · ${gb(m.memory)} RAM geschätzt${m.id === data.device.recommended ? " · Empfohlen" : ""}${!m.fits ? " · Zu groß für diesen Rechner" : !m.diskFits ? " · Speicherplatz fehlt" : ""}`}
        action={installed ? <span className="local-model-state">Installiert</span> : <button aria-label={`${m.name} herunterladen`} disabled={!machine?.connected || !m.fits || !m.diskFits || running || !!busy} onClick={() => download(m)}>{busy === m.id || (running && operation.model === m.id) ? "Lädt …" : "Laden"}</button>} />;
    })}
    {!models.length && <p className="local-hint">Keine passenden Modelle gefunden. Suche ändern oder „Alle Größen“ wählen.</p>}
    {error && <p className="local-error" role="alert">{error}</p>}
    <div className="local-footer"><span>Auswahl · Stand {new Date(localModelCatalogDate).toLocaleDateString("de-DE")}</span><a href="https://ollama.com/library" target="_blank" rel="noreferrer">Gesamter Ollama-Katalog ↗</a></div>
  </section>;
}
