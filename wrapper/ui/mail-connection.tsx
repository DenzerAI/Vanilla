import React, { useEffect, useRef, useState } from "react";
import { BrandIcon } from "./brand-icon.jsx";

type Props = {
  connection: any;
  api: any;
  projectId: string;
  onSaved: () => void;
  onHelp: (text: string) => void;
};
export function MailConnectionForm({
  connection,
  api,
  projectId,
  onSaved,
  onHelp,
}: Props) {
  const provider = connection.provider === "gmail" ? "gmail" : "outlook",
    name = provider === "gmail" ? "Gmail" : "Outlook";
  const [setup, setSetup] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState(
      connection.mode === "admin" ? "admin" : "personal",
    );
  const [waiting, setWaiting] = useState("");
  const [reconnecting, setReconnecting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const help = `Hilf mir, ${name} für diese Vanilla-Installation einzurichten. Prüfe GET /api/mail/setup und docs/MAIL.md im Quellprojekt. Verwende nur ausdrücklich für diese Installation bereitgestellte Daten, keine vorhandenen persönlichen Konten. Erkläre nur den nächsten nötigen Schritt. Anmeldung und Administratorfreigabe erfolgen beim Anbieter. Keine E-Mails senden.`;
  useEffect(() => {
    mounted.current = true;
    api("/mail/setup")
      .then((s: any) =>
        setSetup(s.providers.find((p: any) => p.provider === provider)),
      )
      .catch((e: Error) => setError(e.message));
    return () => {
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [provider]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function connect() {
    // Open synchronously to retain browser popup permission; a blocked popup has an explicit link.
    const popup = window.open(
      "about:blank",
      "vanilla-mail-login",
      "popup,width=620,height=740",
    );
    if (popup) popup.opener = null;
    await run(async () => {
      try {
        const result = await api("/mail/oauth/start", { provider, projectId });
        if (popup) popup.location.href = result.url;
        setWaiting(result.url);
        if (timer.current) clearInterval(timer.current);
        let polling = false,
          count = 0;
        timer.current = setInterval(async () => {
          if (polling) return;
          polling = true;
          try {
            const state = await api(
              "/mail/oauth/status?poll=" + encodeURIComponent(result.poll),
            );
            if (state.status === "connected") {
              if (timer.current) clearInterval(timer.current);
              if (mounted.current) onSaved();
            } else if (state.status === "error" || ++count > 300) {
              if (timer.current) clearInterval(timer.current);
              if (mounted.current) {
                setWaiting("");
                setError(
                  state.error ||
                    "Anmeldung abgelaufen. Bitte erneut versuchen.",
                );
              }
            }
          } catch (e: any) {
            if (timer.current) clearInterval(timer.current);
            if (mounted.current) {
              setWaiting("");
              setError(e.message);
            }
          } finally {
            polling = false;
          }
        }, 2000);
      } catch (e) {
        popup?.close();
        throw e;
      }
    });
  }
  return (
    <div className="mail-setup">
      <div className="row">
        <BrandIcon name={name} />
        <strong>{connection.address || name}</strong>
      </div>
      {connection.id && !reconnecting ? (
        <>
          <p className="page-note">
            {connection.enabled
              ? "Dieses Postfach wird mit deiner Inbox abgeglichen."
              : "Dieses Postfach ist getrennt. Bereits geladene Nachrichten bleiben erhalten."}
          </p>
          {connection.error && <p role="alert">{connection.error}</p>}
          <div className="row">
            <button disabled={busy} onClick={() => setReconnecting(true)}>
              Erneut verbinden
            </button>
            <button
              disabled={busy || !connection.enabled}
              onClick={() =>
                run(async () => {
                  await api("/mail/sync", { id: connection.id, projectId });
                  onSaved();
                })
              }
            >
              Jetzt abgleichen
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/mail/disconnect", {
                    id: connection.id,
                    projectId,
                  });
                  onSaved();
                })
              }
            >
              Verbindung trennen
            </button>
          </div>
          <p className="page-note">
            Die Freigabe beim Anbieter kannst du zusätzlich in deinem Google-
            oder Microsoft-Konto widerrufen.
          </p>
        </>
      ) : (
        <>
          <p className="page-note">
            Anmelden, Zugriff bestätigen, Nachrichten in deiner Inbox lesen.
            Antworten werden erst mit „Senden“ verschickt. Der erste Abruf
            umfasst die letzten 30 Tage.
          </p>
          {provider === "outlook" && (
            <label>
              Was möchtest du verbinden?
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="personal">Mein Postfach</option>
                <option value="admin">Firmenpostfach mit Admin-Zugang</option>
              </select>
            </label>
          )}
          {mode === "admin" ? (
            <>
              <p className="page-note">
                Ein Administrator bereitet den Zugriff einmal vor. Danach läuft
                das Postfach ohne angemeldeten Administrator.
              </p>
              <details>
                <summary>Microsoft einmal vorbereiten</summary>
                <ol>
                  <li>
                    In{" "}
                    <a
                      href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Microsoft Entra
                    </a>{" "}
                    eine Anwendung für diese Organisation registrieren.
                  </li>
                  <li>
                    In Exchange die Anwendung mit Mail.Read und bei gewünschtem
                    Versand Mail.Send auf die erlaubten Postfächer begrenzen.
                    Zusätzlich vergebene globale App-Rechte mitprüfen.
                  </li>
                  <li>
                    Ein Anwendungsgeheimnis erstellen und dessen Wert unten
                    sicher hinterlegen. Das Ablaufdatum im Adminbetrieb
                    überwachen.
                  </li>
                </ol>
                <p>
                  <a
                    href="https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Microsoft-Anleitung für begrenzte Postfachrechte
                  </a>
                </p>
              </details>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  void run(async () => {
                    await api("/mail/admin", { ...data, projectId });
                    onSaved();
                  });
                }}
              >
                <fieldset disabled={busy} className="connection-fields">
                  <label>
                    Postfachadresse
                    <input
                      name="mailbox"
                      type="email"
                      required
                      autoComplete="off"
                    />
                  </label>
                  <details open>
                    <summary>Vorbereitete App-Daten</summary>
                    <label>
                      Mandanten-ID
                      <input name="tenantId" required />
                    </label>
                    <label>
                      Anwendungs-ID
                      <input name="clientId" required />
                    </label>
                    <label>
                      Anwendungsgeheimnis
                      <input
                        name="clientSecret"
                        type="password"
                        required
                        autoComplete="new-password"
                      />
                    </label>
                  </details>
                  <button className="primary">
                    {busy
                      ? "Postfach wird geprüft …"
                      : "Prüfen und mit Inbox verbinden"}
                  </button>
                </fieldset>
              </form>
            </>
          ) : (
            <>
              {!setup && !error && (
                <p role="status">Einrichtung wird geprüft …</p>
              )}
              {setup && !setup.ready && (
                <p className="page-note">
                  Diese Installation braucht einmalig eine{" "}
                  {provider === "gmail" ? "Google" : "Microsoft"}-App. Lass dir
                  dabei helfen oder hinterlege die vorbereiteten Daten.
                </p>
              )}
              {setup && (
                <details open={!setup.ready}>
                  <summary>
                    {setup.ready
                      ? "App-Einrichtung bearbeiten"
                      : "Einmalige Vorbereitung"}
                  </summary>
                  <ol>
                    <li>
                      <a href={setup.help} target="_blank" rel="noreferrer">
                        Anwendung beim Anbieter anlegen
                      </a>
                      .{" "}
                      {provider === "gmail"
                        ? "Gmail API aktivieren und einen OAuth-Client vom Typ Webanwendung erstellen."
                        : "Eine App registrieren und die Plattform Web hinzufügen. Für private und Firmenkonten die passenden unterstützten Kontotypen wählen."}
                    </li>
                    <li>
                      Diese Rücksprungadresse hinterlegen:
                      <input
                        readOnly
                        aria-label="Rücksprungadresse"
                        value={setup.redirectUri}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          run(async () => {
                            await navigator.clipboard.writeText(
                              setup.redirectUri,
                            );
                          })
                        }
                      >
                        Adresse kopieren
                      </button>
                    </li>
                    <li>
                      {provider === "gmail"
                        ? "Zielgruppe und Freigabe für Gmail-Lesen und -Senden einrichten. Für öffentliche Apps Googles Verifizierung abschließen; Testzugänge sind kein dauerhafter Produktionsbetrieb."
                        : "Delegierte Rechte User.Read, Mail.Read, Mail.Send und offline_access vorsehen. Falls die Organisation es verlangt, lässt ein Administrator die Anwendung zu."}
                    </li>
                  </ol>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      void run(async () => {
                        const s = await api("/mail/setup", {
                          provider,
                          ...data,
                        });
                        setSetup(
                          s.providers.find((p: any) => p.provider === provider),
                        );
                      });
                    }}
                  >
                    <fieldset disabled={busy} className="connection-fields">
                      <label>
                        Anwendungs-ID
                        <input
                          name="clientId"
                          required
                          autoComplete="off"
                          defaultValue={setup.clientId}
                        />
                      </label>
                      <label>
                        Anwendungsgeheimnis
                        <input
                          name="clientSecret"
                          type="password"
                          required={!setup.ready}
                          autoComplete="new-password"
                          placeholder={
                            setup.ready ? "Leer lassen zum Beibehalten" : ""
                          }
                        />
                      </label>
                      <button>App sicher speichern</button>
                    </fieldset>
                  </form>
                </details>
              )}
              {waiting ? (
                <p role="status">
                  Bestätige den Zugriff im Anmeldefenster.{" "}
                  <a href={waiting} target="_blank" rel="noreferrer">
                    Anmeldung öffnen
                  </a>
                </p>
              ) : (
                <button
                  className="primary"
                  disabled={busy || !setup?.ready}
                  onClick={connect}
                >
                  Mit {provider === "gmail" ? "Google" : "Microsoft"} verbinden
                </button>
              )}
            </>
          )}
        </>
      )}
      <button type="button" disabled={busy} onClick={() => onHelp(help)}>
        Mit Agent einrichten
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
