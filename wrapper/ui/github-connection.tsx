import React, { useEffect, useRef, useState } from "react";
import { BrandIcon } from "./brand-icon.jsx";
import { SettingRow } from "./settings-row.jsx";
import { Skeleton } from "./skeleton";

export function GitHubConnectionForm({
  api,
  onSaved,
}: {
  api: any;
  onSaved: () => void;
}) {
  const [state, setState] = useState<any>(null),
    [repos, setRepos] = useState<any[]>([]);
  const [clientId, setClientId] = useState(""),
    [repository, setRepository] = useState("");
  const [device, setDevice] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    running = useRef(false);
  async function load() {
    const s = await api("/github/status");
    if (!alive.current) return;
    setState(s);
    setClientId(s.clientId);
    setRepository(String(s.repository?.id || ""));
    if (s.connected) {
      const r = await api("/github/repositories");
      if (alive.current) setRepos(r.repositories);
    }
  }
  useEffect(() => {
    alive.current = true;
    load().catch((e) => setError(e.message));
    return () => {
      alive.current = false;
    };
  }, []);
  async function act(fn: () => Promise<any>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!device) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api("/github/poll", { id: device.id });
        if (stopped) return;
        if (result.status === "connected") {
          setDevice(null);
          await load();
        } else timer = setTimeout(poll, result.interval * 1000);
      } catch (e: any) {
        if (!stopped) {
          setDevice(null);
          setError(e.message);
        }
      }
    };
    timer = setTimeout(poll, device.interval * 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [device]);
  return (
    <>
      <div className="settings-group">
        <SettingRow
          icon={<BrandIcon name="GitHub" />}
          title="GitHub"
          description={
            state?.account
              ? `${state.account.login} · ${state.connected ? "Angemeldet" : "Erneut anmelden"}`
              : "Dein Konto für Updates und privaten Codeaustausch"
          }
        />
      </div>
      {!state && !error && (
        <Skeleton
          variant="settings"
          label="GitHub-Verbindung wird geladen …"
          rows={3}
        />
      )}
      {state && (
        <>
          {!state.connected && (
            <>
              <details open={!state.configured}>
                <summary>GitHub App einrichten</summary>
                <p className="form-help">
                  Einmal die öffentliche Client-ID der Vanilla GitHub App
                  hinterlegen. Keine Schlüssel oder Passwörter eingeben.
                </p>
                <label>
                  Client-ID
                  <input
                    value={clientId}
                    maxLength={100}
                    autoComplete="off"
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </label>
                <div className="row">
                  <button
                    disabled={busy || !clientId.trim() || !!device}
                    onClick={() =>
                      act(async () => {
                        setState(
                          await api("/github/configure", {
                            clientId: clientId.trim(),
                            revision: state.revision,
                          }),
                        );
                      })
                    }
                  >
                    Speichern
                  </button>
                  <a
                    href="https://github.com/DenzerAI/Vanilla/blob/main/docs/GITHUB.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Einrichtung öffnen
                  </a>
                </div>
              </details>
              {device ? (
                <div className="settings-group">
                  <SettingRow
                    title="Bei GitHub bestätigen"
                    description="Diesen Code auf der GitHub-Seite eingeben. Die Verbindung wird anschließend hier angezeigt."
                  >
                    <code>{device.userCode}</code>
                  </SettingRow>
                  <SettingRow title="Anmeldung offen">
                    <a href={device.url} target="_blank" rel="noreferrer">
                      GitHub öffnen
                    </a>
                  </SettingRow>
                </div>
              ) : (
                <button
                  disabled={
                    busy || !state.configured || clientId !== state.clientId
                  }
                  onClick={() =>
                    act(async () => setDevice(await api("/github/connect", {})))
                  }
                >
                  Mit GitHub anmelden
                </button>
              )}
            </>
          )}
          {state.connected && (
            <div className="settings-group">
              <SettingRow
                title="Repository"
                description="Für Firmeninstallationen ein privates Repository auswählen."
              >
                <select
                  aria-label="GitHub-Repository"
                  value={repository}
                  disabled={busy}
                  onChange={(e) => setRepository(e.target.value)}
                >
                  <option value="">Repository auswählen</option>
                  {repos.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.private ? " · Privat" : " · Ursprung"}
                    </option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow
                title={
                  state.repository?.name || "Noch kein Repository zugeordnet"
                }
                description={
                  state.error ||
                  (state.repository
                    ? "Zugriff und Schreibrechte werden bei jeder Übernahme erneut geprüft."
                    : "GitHub App für das gewünschte Repository freigeben.")
                }
              >
                <button
                  disabled={busy || !repository}
                  onClick={() =>
                    act(async () => {
                      setState(
                        await api("/github/repository", {
                          repositoryId: Number(repository),
                          revision: state.revision,
                        }),
                      );
                      onSaved();
                    })
                  }
                >
                  Zuordnen
                </button>
              </SettingRow>
            </div>
          )}
          {state.account && (
            <div className="row">
              <button
                disabled={busy || !state.repository}
                onClick={() =>
                  act(async () => setState(await api("/github/check", {})))
                }
              >
                Verbindung prüfen
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setDevice(null);
                    setState(await api("/github/disconnect", {}));
                    setRepos([]);
                    onSaved();
                  })
                }
              >
                Trennen
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error} <button onClick={() => act(load)}>Erneut laden</button>
        </p>
      )}
    </>
  );
}
