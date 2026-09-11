import React, { useEffect, useRef, useState } from "react";
import { SettingRow } from "./settings-row.jsx";
import { SettingsNavigationRow } from "./settings-patterns.jsx";
import { Skeleton } from "./skeleton";
import { Modal } from "./modal.jsx";

const when = (n: number) =>
  n ? new Date(n * 1000).toLocaleString("de-DE") : "Noch nicht geprüft";
const states: Record<string, string> = {
  preparing: "In Vorbereitung",
  "needs-review": "Klärung nötig",
  ready: "Bereit",
  installing: "Wird installiert",
  installed: "Aktualisiert",
  restored: "Wiederhergestellt",
  cancelled: "Abgebrochen",
  "recovery-required": "Wiederherstellung nötig",
};
const contributions: Record<string, string> = {
  prepared: "Vorbereitet",
  "ref-pending": "Bestätigung ausstehend",
  unknown: "Übermittlung unbestätigt",
  sent: "Geteilt",
  received: "Neu",
  deferred: "Zurückgestellt",
  declined: "Abgelehnt",
  reviewing: "Agent prüft",
  reviewed: "Bewertet",
  "needs-review": "Klärung nötig",
  adopted: "Im Entwicklungszweig",
};

export function ProductUpdates({
  api,
  initialTab = "version",
  onGitHub,
}: {
  api: any;
  initialTab?: string;
  onGitHub: () => void;
}) {
  const [tab, setTab] = useState(initialTab),
    [data, setData] = useState<any>(null),
    [items, setItems] = useState<any>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<any>(null);
  const [setup, setSetup] = useState(false),
    [role, setRole] = useState("customer"),
    [agreed, setAgreed] = useState(false);
  const [publication, setPublication] = useState(false),
    [version, setVersion] = useState(""),
    [summary, setSummary] = useState(""),
    [changeText, setChangeText] = useState(""),
    [fromVersions, setFromVersions] = useState(""),
    [compatible, setCompatible] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const alive = useRef(true),
    running = useRef(false),
    loading = useRef(false),
    reload = useRef(false);
  const requestKey = useRef<string | null>(null);
  async function load() {
    if (loading.current) {
      reload.current = true;
      return;
    }
    loading.current = true;
    try {
      const [s, c] = await Promise.all([
        api("/system/updates"),
        api("/system/contributions"),
      ]);
      if (alive.current) {
        setData(s);
        setItems(c);
      }
    } finally {
      loading.current = false;
      if (reload.current && alive.current) {
        reload.current = false;
        await load();
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    load().catch((e) => setError(e.message));
    api("/system/update-review/models")
      .then((r: any) => {
        if (alive.current) setModels(r.models || []);
      })
      .catch(() => {});
    const receive = (e: any) => {
      if (/^(update|contribution|github)\./.test(e.detail?.kind || ""))
        load().catch((e) => setError(e.message));
    };
    const focus = () => load().catch((e) => setError(e.message));
    window.addEventListener("core/event", receive);
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      window.removeEventListener("core/event", receive);
      window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => setTab(initialTab), [initialTab]);
  async function act(fn: () => Promise<any>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e: any) {
      if (alive.current) setError(e.message);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const preference = (change: any) =>
    act(() => api("/system/updates/settings", { ...data.settings, ...change }));
  const run = data?.run,
    release = data?.release?.manifest;
  return (
    <>
      <div className="tabs" aria-label="Updatebereich">
        {[
          ["version", "Version"],
          ["contributions", "Beiträge"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {!data && !error && (
        <Skeleton
          variant="settings"
          label="Updatebereich wird geladen …"
          rows={4}
        />
      )}
      {data && tab === "version" && (
        <>
          <div className="settings-group">
            <SettingRow
              title={
                data.installed
                  ? `Installiert · ${data.installed.version}`
                  : "Installiert · Entwicklungsstand"
              }
              description={`Letzte Prüfung: ${when(data.checkedAt)}`}
            >
              <button
                disabled={busy || data.checking}
                onClick={() => act(() => api("/system/updates/check", {}))}
              >
                {data.checking ? "Prüft …" : "Jetzt prüfen"}
              </button>
            </SettingRow>
            {data.error && (
              <SettingRow
                title="Prüfung nicht abgeschlossen"
                description={data.error}
              />
            )}
            {!release && !data.error && (
              <SettingRow
                title={
                  data.checkedAt
                    ? "Noch keine freigegebene Version"
                    : "Freigegebene Versionen prüfen"
                }
                description="Neue Funktionen erscheinen hier, sobald eine geprüfte Version veröffentlicht ist."
              />
            )}
            {release && (
              <SettingRow
                title={
                  data.available
                    ? `Verfügbar · ${release.version}`
                    : `Freigegeben · ${release.version}`
                }
                description={release.summary}
              >
                {data.available &&
                  !["preparing", "ready", "installing"].includes(
                    run?.state,
                  ) && (
                    <button
                      disabled={busy || !!data.error}
                      onClick={() =>
                        act(async () => {
                          requestKey.current ||= crypto.randomUUID();
                          await api("/system/updates/prepare", {
                            releaseId: release.releaseId,
                            requestKey: requestKey.current,
                          });
                          requestKey.current = null;
                        })
                      }
                    >
                      Vorbereiten
                    </button>
                  )}
              </SettingRow>
            )}
          </div>
          {run && (
            <>
              <h3>Updateauftrag</h3>
              <div className="settings-group">
                <SettingRow
                  title={states[run.state] || "Prüfbedarf"}
                  description={run.error || run.phase}
                >
                  {run.state === "ready" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          api("/system/updates/install", {
                            id: run.id,
                            revision: run.revision,
                          }),
                        )
                      }
                    >
                      Jetzt installieren
                    </button>
                  )}
                  {run.state === "preparing" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          api("/system/updates/cancel", {
                            id: run.id,
                            revision: run.revision,
                          }),
                        )
                      }
                    >
                      Abbrechen
                    </button>
                  )}
                </SettingRow>
                <SettingsNavigationRow
                  title="Details"
                  description="Änderungen, eigene Erweiterungen und Prüfnachweise"
                  onClick={() => setDetail({ kind: "run", run })}
                />
              </div>
            </>
          )}
          {!data.github.connected && (
            <div className="settings-group">
              <SettingsNavigationRow
                title="GitHub verbinden"
                description="Für die vorbereitete Übernahme und den privaten Codeaustausch"
                onClick={onGitHub}
              />
            </div>
          )}
          {data.role === "origin" && data.github.connected && (
            <div className="settings-group">
              <SettingsNavigationRow
                title="Version freigeben"
                description="Geprüften Vanilla-Stand veröffentlichen"
                onClick={() => {
                  setFromVersions(
                    data.release?.manifest.version || "development",
                  );
                  setPublication(true);
                }}
              />
            </div>
          )}
          <h3>Automatisch prüfen</h3>
          <div className="settings-group">
            <SettingRow
              title="Nach Updates suchen"
              description="Täglich im Hintergrund. Installiert wird erst nach deiner Freigabe."
            >
              <button
                className="apple-switch"
                role="switch"
                aria-label="Automatisch nach Updates suchen"
                aria-checked={data.settings.automatic}
                disabled={busy}
                onClick={() =>
                  preference({ automatic: !data.settings.automatic })
                }
              >
                <span />
              </button>
            </SettingRow>
            <SettingRow
              title="Benachrichtigen"
              description="Neue Versionen, Beiträge und Prüfbedarf in der Glocke anzeigen."
            >
              <button
                className="apple-switch"
                role="switch"
                aria-label="Updatehinweise anzeigen"
                aria-checked={data.settings.notifications}
                disabled={busy}
                onClick={() =>
                  preference({ notifications: !data.settings.notifications })
                }
              >
                <span />
              </button>
            </SettingRow>
            <SettingRow
              title="Agentenprüfung"
              description="Das gewählte Modell prüft mit seiner höchsten unterstützten Denkstufe. Code kann dabei an seinen Anbieter gehen."
            >
              <select
                aria-label="Modell für Updates"
                disabled={busy}
                value={data.settings.worker + "/" + data.settings.model}
                onChange={(e) => {
                  const m = models.find(
                    (m) => m.worker + "/" + m.model === e.target.value,
                  );
                  if (m) preference({ worker: m.worker, model: m.model });
                }}
              >
                <option value="/">Modell auswählen</option>
                {models.map((m) => (
                  <option
                    key={m.worker + "/" + m.model}
                    value={m.worker + "/" + m.model}
                  >
                    {m.displayName}
                  </option>
                ))}
                {data.settings.model &&
                  !models.some(
                    (m) =>
                      m.worker === data.settings.worker &&
                      m.model === data.settings.model,
                  ) && (
                    <option
                      disabled
                      value={data.settings.worker + "/" + data.settings.model}
                    >
                      Gewähltes Modell nicht verfügbar
                    </option>
                  )}
              </select>
            </SettingRow>
          </div>
        </>
      )}
      {data && items && tab === "contributions" && (
        <>
          <div className="settings-group">
            <SettingRow
              title={
                items.settings.role === "origin" ? "Eingang" : "Eigener Code"
              }
              description={
                items.settings.role === "origin"
                  ? "Beiträge aus freigegebenen privaten Firmenrepositories"
                  : "Geprüften Anwendungscode im vereinbarten privaten Repository bereitstellen."
              }
            >
              <button
                disabled={busy || !data.github.connected}
                onClick={() =>
                  act(() =>
                    api(
                      items.settings.role === "origin"
                        ? "/system/contributions/check"
                        : "/system/contributions/share",
                      {},
                    ),
                  )
                }
              >
                {items.settings.role === "origin" ? "Jetzt prüfen" : "Teilen"}
              </button>
            </SettingRow>
            <SettingsNavigationRow
              title="Codeaustausch"
              value={
                items.settings.role === "origin"
                  ? "Ursprung"
                  : items.settings.agreement
                    ? "Eingerichtet"
                    : "Einrichten"
              }
              onClick={() => {
                setRole(items.settings.role);
                setAgreed(!!items.settings.agreement);
                setSetup(true);
              }}
            />
          </div>
          {!data.github.connected && (
            <div className="settings-group">
              <SettingsNavigationRow
                title="GitHub verbinden"
                onClick={onGitHub}
              />
            </div>
          )}
          {!items.items.length && (
            <p className="form-help">Noch keine Beiträge vorhanden.</p>
          )}
          <div className="settings-group">
            {items.items.map((item: any) => (
              <SettingsNavigationRow
                key={item.id}
                title={item.repository.name}
                description={`${contributions[item.state] || item.state} · ${when(item.createdAt)}`}
                value={item.kind === "incoming" ? "Vergleichen" : "Details"}
                onClick={() =>
                  item.kind === "incoming"
                    ? act(async () =>
                        setDetail({
                          kind: "contribution",
                          ...(await api(
                            "/system/contributions/preview?id=" + item.id,
                          )),
                        }),
                      )
                    : setDetail({ kind: "outgoing", item })
                }
              />
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button disabled={busy} onClick={() => act(load)}>
            Erneut laden
          </button>
        </p>
      )}
      {publication && (
        <Modal title="Version freigeben" onClose={() => setPublication(false)}>
          <label>
            Version
            <input
              value={version}
              placeholder="1.0.0"
              maxLength={60}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
          <label>
            Kurzbeschreibung
            <input
              value={summary}
              maxLength={500}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>
          <label>
            Neuerungen
            <textarea
              value={changeText}
              maxLength={10000}
              onChange={(e) => setChangeText(e.target.value)}
            />
          </label>
          <label>
            Unterstützte Ausgangsversionen
            <input
              value={fromVersions}
              maxLength={1000}
              onChange={(e) => setFromVersions(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={compatible}
              onChange={(e) => setCompatible(e.target.checked)}
            />
            Die Datenformate bleiben kompatibel; für diese Ausgangsversionen ist
            keine Datenmigration erforderlich.
          </label>
          <p className="form-help">
            Veröffentlicht im öffentlichen Vanilla-Repository. Neue Zeile je
            Neuerung; Ausgangsversionen durch Komma trennen. Alle
            GitHub-Pflichtprüfungen müssen für diesen Stand erfolgreich sein.
          </p>
          <button
            disabled={
              busy ||
              !compatible ||
              !version ||
              !summary.trim() ||
              !changeText.trim()
            }
            onClick={() =>
              act(async () => {
                await api("/system/updates/publish", {
                  version,
                  summary: summary.trim(),
                  changes: changeText
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  fromVersions: fromVersions
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                  compatibleData: true,
                });
                setPublication(false);
              })
            }
          >
            Freigeben
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {setup && (
        <Modal title="Codeaustausch" onClose={() => setSetup(false)}>
          <div className="settings-group">
            <SettingRow title="Installation">
              <select
                aria-label="Installationsrolle"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="customer">Firmeninstallation</option>
                <option value="origin">Ursprung</option>
              </select>
            </SettingRow>
          </div>
          {role === "customer" && (
            <label>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              Der betreute Codeaustausch ist vereinbart: neutraler Anwendungs-
              und Modulcode wird vor Updates im ausgewählten privaten Repository
              bereitgestellt. DenzerAI hat Lesezugriff. Firmendaten, Zugänge,
              private Arbeitsanweisungen und die übrige Historie sind
              ausgeschlossen. Eine öffentliche Veröffentlichung benötigt eine
              gesonderte Freigabe.
            </label>
          )}
          <p className="form-help">
            {role === "origin"
              ? "Ursprung benötigt bestätigte Schreibrechte auf DenzerAI/Vanilla."
              : "Repository und Konto werden unter Verbindungen eingerichtet. Ausschalten beendet weitere Übermittlungen."}
          </p>
          <button
            disabled={busy || !data?.github.repository}
            onClick={() =>
              act(async () => {
                await api("/system/contributions/settings", {
                  role,
                  agreed,
                  revision: items.settings.revision,
                });
                setSetup(false);
              })
            }
          >
            Speichern
          </button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {detail && (
        <Modal
          title={
            detail.kind === "run" ? "Update · Details" : "Beitrag · Details"
          }
          onClose={() => setDetail(null)}
        >
          {detail.kind === "run" ? (
            <>
              <p>{detail.run.release.manifest.summary}</p>
              <ul>
                {detail.run.release.manifest.changes.map((c: string) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="settings-group">
                <SettingRow
                  title="Aufträge erfasst"
                  description={String(
                    detail.run.inventory?.jobs ?? "Noch nicht erfasst",
                  )}
                />
                <SettingRow
                  title="Prüfung"
                  description={detail.run.error || detail.run.phase}
                />
              </div>
              {detail.run.review && (
                <>
                  <p>{detail.run.review.summary}</p>
                  <ul>
                    {[
                      ...detail.run.review.preserved,
                      ...detail.run.review.issues,
                    ].map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              <details>
                <summary>Technischer Stand</summary>
                <pre>
                  {JSON.stringify(
                    {
                      source: detail.run.sourceCommit,
                      target: detail.run.release.manifest.commit,
                      candidate: detail.run.candidate,
                      checks: detail.run.checks,
                      worker: detail.run.worker,
                      model: detail.run.model,
                      effort: detail.run.effort,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          ) : detail.kind === "contribution" ? (
            <>
              <p>
                {detail.files.length} geänderte Dateien. Dieser Vergleich
                installiert keinen Code.
              </p>
              {detail.truncated && (
                <p className="form-help">
                  Der angezeigte Vergleich ist gekürzt. Eine vollständige
                  Prüfung ist vor Übernahme erforderlich.
                </p>
              )}
              {detail.item.review && (
                <>
                  <p>{detail.item.review.summary}</p>
                  <ul>
                    {detail.item.review.issues.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {detail.item.note && (
                <p className="form-help">{detail.item.note}</p>
              )}
              <div className="row">
                <button
                  disabled={busy || detail.truncated}
                  onClick={() =>
                    act(async () => {
                      const item = await api("/system/contributions/review", {
                        id: detail.item.id,
                        revision: detail.item.revision,
                      });
                      setDetail({ ...detail, item });
                    })
                  }
                >
                  Prüfen
                </button>
                <button
                  disabled={
                    busy ||
                    !detail.base ||
                    !detail.moduleCheck ||
                    !!detail.item.candidate
                  }
                  onClick={() =>
                    act(async () => {
                      const item = await api("/system/contributions/adopt", {
                        id: detail.item.id,
                        revision: detail.item.revision,
                      });
                      setDetail({ ...detail, item });
                    })
                  }
                >
                  Übernehmen
                </button>
              </div>
              <p className="form-help">
                Übernehmen bereitet einen eigenen Entwicklungszweig vor. Es
                veröffentlicht und installiert nichts.
              </p>
              <pre>{detail.diff || "Keine inhaltlichen Unterschiede."}</pre>
              <div className="row">
                {[
                  ["deferred", "Zurückstellen"],
                  ["declined", "Ablehnen"],
                ].map(([state, label]) => (
                  <button
                    key={state}
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await api("/system/contributions/decide", {
                          id: detail.item.id,
                          revision: detail.item.revision,
                          state,
                        });
                        setDetail(null);
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="settings-group">
              <SettingRow
                title={contributions[detail.item.state]}
                description={detail.item.error || detail.item.repository.name}
              />
              <SettingRow
                title="Stand"
                description={detail.item.commit || "Noch nicht bestätigt"}
              />
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
