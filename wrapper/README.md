# Agent · lokale Schaltzentrale

Firmenneutrale Oberfläche auf **http://127.0.0.1:1989**, angelehnt an die bereitgestellten Codex/macOS-Referenzen. Das bisherige Order-/Hermes-System auf Port 8787 bleibt unverändert.

## Python-Kern als Einstieg

`npm start` in diesem Ordner startet jetzt `../scripts/start-core.mjs` und damit
Python/FastAPI. Installation, SQLite-Ablage, lokale Suche und mobile Anmeldung
stehen in [../README.md](../README.md) und [../docs/CORE.md](../docs/CORE.md).
`server.mjs` bleibt der private Worker-/Connector-Adapter. Im normalen Betrieb
wird sein Scheduler durch die persistente Python-Warteschlange ersetzt und
seine strukturierte Ablage an SQLite weitergeleitet. Native Worker-Sessions,
Markdown-Dateien und Audioaufnahmen behalten ihre jeweiligen Dateiformate.

## Start

Python 3.12+, Node.js 22.12+ und ein eingerichteter Worker werden benötigt. Die Oberfläche startet auch ohne Codex. Codex ist der anfängliche Standard; Hermes Agent und OpenClaw können über ACP verbunden werden. Einrichtung und Grenzen: [WORKERS.md](WORKERS.md).

```sh
cd work/vanilla-agent/wrapper
npm ci
npm run build
npm start
```

Aus dem Agent-Hauptordner: `npm run control:build` und `npm run control`.

Optionale Umgebungsvariablen: `UWE_PORT` (Standard 1989), `UWE_WORKSPACE` (absoluter Pfad), `UWE_DATA_ROOT`, `UWE_CODEX_BINARY`. Standardmäßig wird die mit der installierten ChatGPT/Codex-App ausgelieferte CLI genutzt. Es wird kein API-Schlüssel in den Browser übertragen; Codex verwendet seine bestehende Anmeldung.

## Was funktioniert

- Echte Codex-Gespräche mit Live-Ausgaben, Anhängen, Modellwahl aus dem aktuellen Modellkatalog, Denkaufwand, Planmodus, Rückfragen, Berechtigungen, Unterbrechen und Ergänzen einer laufenden Aufgabe.
- Arbeitsbereiche als echte Ordner anlegen und umbenennen; neue Chats gehören zum gewählten Bereich. Gemeinsame Identität bleibt zentral.
- Persistente Chatliste, Suche, Umbenennen, Anheften, Verzweigen, Archivieren/Wiederherstellen und Markdown-Export.
- Dateien auflisten, ansehen, herunterladen und Textdateien bearbeiten. Terminalbefehle laufen über Codex im Arbeitsbereich.
- Lokale Jobordner erstellen und bearbeiten, manuell ausführen, täglich oder werktags planen. Ein Job verwendet die automatische Worker-Auswahl, einen fest zugewiesenen KI-Worker oder einen konfigurierten Workflow-Webhook.
- Konfigurierte MCP-Werkzeuge und Skills aus Firmenbasis, Workspace, Codex, Claude Code und Hermes anzeigen. Herkunft bleibt sichtbar; Verwendung, eigene Varianten und ein lokaler optionaler Hermes-Katalog liegen im Skills-Bereich.
- Bestehende Dienste als Links öffnen; n8n oder andere Workflow-Systeme über einen HTTP-Webhook aufrufen. OAuth und Dienst-spezifische Aktionen bleiben beim angeschlossenen System.
- Secrets im macOS-Schlüsselbund speichern, ersetzen, referenzieren und löschen. Schlüssel gehen über stdin an `security`, nicht über Kommandozeilenargumente oder Klartextdateien.
  Groq und ElevenLabs registrieren ihre Schlüssel automatisch in derselben Secrets-Liste; bestehende Sprachschlüssel werden anhand der Schlüsselbund-Metadaten übernommen. Workflow-Verbindungen können einen neuen Bearer-Token direkt speichern oder ein vorhandenes Secret referenzieren. Noch verwendete Schlüssel sind gegen Löschen geschützt. Anbieter-Schlüssel werden beim Ersetzen erneut über den Verbindungsdialog geprüft.
- **Einstellungen → Worker → Lokal:** Geräteprüfung, offizielle Installationswege für Ollama und LM Studio, Erkennung laufender Server und lokaler Installationen, Modelldownload mit Fortschritt/Abbruch und ein Text-Testchat. Weitere Rechner lassen sich über ihre Serveradresse prüfen und speichern.
- Deutsches Diktat mit lokal installiertem Whisper, optionalem Groq-Zugang unter Verbindungen, Mikrofonpegel, Pause/Fortsetzen und wiederherstellbarem Aufnahmeverlauf. Audio wird laufend im Browser und auf dem Mac gesichert. Konzept, Installation und Grenzen: [DICTATION.md](DICTATION.md).

Neue Chats starten in **Ausführen** mit Vollzugriff. **Planen** verwendet Codex-Planmodus, eine schreibgeschützte Dateisandbox und verweigert zusätzliche Berechtigungen. Externe MCP-Werkzeuge liegen außerhalb dieser Dateisandbox; deren verändernde Aktionen werden per Arbeitsanweisung untersagt. Das ersetzt kein Datenschutzmodul. Der separate manuelle Terminalbereich behält seine eigene Sandbox.

Die Pfade werden vom Installationsordner abgeleitet. Nach einem Umzug den laufenden Server beenden und aus dem neuen Ordner starten; bestehende Chat-Arbeitsverzeichnisse werden über ihre Arbeitsbereichsreferenz neu aufgelöst.

## Bewusste Grenzen

Dies ist keine vollständige Kopie sämtlicher Funktionen der Codex-Desktop-App. Insbesondere Desktop-Plugins/Connector-OAuth, Computersteuerung, native Browsersteuerung, Git-Worktree-Verwaltung und vollständige Review-Oberflächen haben eigene Integrationsanforderungen. Die Browseransicht öffnet Websites in einem separaten Tab. Das Terminal führt einzelne Befehle aus und ist kein dauerhaftes interaktives PTY.

Hermes Agent kann zusätzlich zu seinem bisherigen System als eigener Worker dieser Schaltzentrale verbunden werden. OpenClaw verwendet denselben ACP-Adapter. Claw Code hat einen getrennten, noch zu konkretisierenden Anschluss. Fähigkeiten werden nicht von Codex auf andere Worker übertragen. Gmail und bestehende Workflow-Verbindungen bleiben externe Einrichtungswege. Die zusätzlichen Telegram-, WhatsApp-, A2A- und Outlook-Anschlüsse haben eigene Adapter; Zugangsdaten und Berechtigungen müssen eingerichtet werden. Umfang und Grenzen stehen in [CHANNELS.md](CHANNELS.md).

Der Datenschutzmodus ist ausdrücklich **Prototyp**. Die Prüfstelle erfasst Übergabemetadaten für Chat-Eingaben, Voice-Starts und Workflow-Aufrufe. Sie anonymisiert oder blockiert noch keine Nutzdaten und überwacht keine direkten Tool-/Netzwerkzugriffe der Agenten. Nur Dummy-Daten verwenden, bis diese Grenze umgesetzt ist. Der lokale HTTP-Server prüft Host, Origin und ein sitzungsgebundenes Token für Schreibzugriffe. Der Dateibrowser begrenzt Pfade auf den Workspace und verweigert versteckte Dateien sowie ausbrechende Symlinks. Das ist keine vollständige Agenten-Datenschutzisolation.

## Ablage und Erweiterung

### Lokale Modelle

`local-workers.mjs` ist der separate Adapter für Ollama und LM Studio. Die vorhandenen Einstellungszeilen und CI-Tokens gestalten seine Oberfläche. `local-device.mjs` prüft OS, CPU, RAM, verfügbaren Speicherplatz sowie Apple-Grafik beziehungsweise NVIDIA-Grafikspeicher, soweit erkannt. Nicht erkannte Hardware bleibt unbekannt. Modellvorschläge sind konservative Schätzungen für Qwen3 mit 4.096 Tokens Kontext und Betriebssystemreserve; die tatsächliche Geschwindigkeit hängt vom Gerät ab. Andere Modelle bleiben über die installierte Laufzeit auswählbar. RAM und Speicherplatz fremder Rechner werden nicht aus den Daten dieses Rechners abgeleitet.

Programme werden über die offiziellen Installationsseiten eingerichtet. Vorhandenes Ollama beziehungsweise LM Studio kann gestartet werden; neue Server bindet der Adapter ausschließlich an Loopback. Ollama-Modelle werden erst mit „Laden“ heruntergeladen. LM-Studio-Modelle werden in LM Studio verwaltet. Ein erkannter Modellserver wird damit noch nicht zum ausführenden Agenten für Aufträge: Der Testchat sendet nur den eingegebenen Text und führt keine Werkzeuge aus.

Zusätzliche Anschlüsse stehen in `data/control/local-workers.json`. Es gibt keine automatische Netzwerksuche. `local-request.mjs` erlaubt ausschließlich ausdrücklich angegebene lokale/private Ziele, prüft DNS und hält die geprüfte IP fest, sperrt Redirects und begrenzt Laufzeiten und Antwortgrößen. Server mit verpflichtender API-Anmeldung werden derzeit als nicht verbunden mit entsprechendem Hinweis angezeigt; Zugangsschlüssel können hier noch nicht hinterlegt werden. Bei abgebrochenen Downloads bleiben gegebenenfalls von Ollama verwaltete Teildateien für die Wiederaufnahme bestehen. Download-/Teststatus liegt im Arbeitsspeicher; ein Wrapper-Neustart beendet laufende Vorgänge. Testtexte und Antworten werden nicht als Chatverlauf gespeichert. Die Übergabeprüfung protokolliert nur Metadaten.

API-Grundlagen und Modellgrößen: [Ollama](https://docs.ollama.com/api), [Qwen3](https://ollama.com/library/qwen3), [LM Studio](https://lmstudio.ai/docs/developer/openai-compat/chat-completions). Die Protokolle inklusive erfolgreicher Antworten, Abbruch, Downloadfehlern und Netzwerkschranken werden gegen lokale HTTP-Testserver geprüft. Das ersetzt keinen Leistungstest mit einem tatsächlich installierten Modell.

```text
agent/
  wrapper/                       Oberfläche + Schnittstellen
    workers.mjs                  Auswahl, Verbindungen, Vertretung
    acp-worker.mjs                Gemeinsamer ACP-Adapter
    codex.mjs                    Nativer Codex-App-Server-Adapter
    server.mjs                   Lokale API, Eventstream, Jobausführung
    storage.mjs                  Portabler Ordnervertrag
    integrations.mjs             Workflow-Verbindungen + Schlüsselbund
    ui/                          React-Oberfläche
  workspaces/default/
    AGENTS.md                    Gemeinsame Arbeitsregeln
    soul/IDENTITY.md              Identität
    brain/                       Historischer Kontext (noch leer)
    skills/                      Gemeinsame Arbeitsanweisungen
    input/                       Importierte Dateien
    output/                      Ergebnisse
    projects/<id>/               Benannte Arbeitsbereiche (project.json, AGENTS.md, input/, output/)
    chats/<id>/                  transcript.json + transcript.md
    jobs/<job-id>/
      SKILL.md                   Menschenlesbare Arbeitsanweisung
      job.yaml                   Zeitplan, Worker, Status und Referenzen
      input/
      output/
      runs/<timestamp>/          request.json + result.json
  data/control/                  UI-Zustand und Übergabemetadaten
```

Der Wrapper verwaltet native Codex-Sessions unter `data/control/codex/`. SQLite-Datenbanken, Gesprächsdateien und Schreibsperren sind damit von der Codex-Desktop-App getrennt. Anmeldung, Konfiguration, Skills und Plugin-Pakete sind mit der bestehenden Codex-Installation verknüpft. Der Wrapper verwendet weiterhin deren aktuelle CLI; diese Trennung ist keine Datenschutz-Sandbox.

Beim ersten Start werden ausschließlich die in der Wrapper-Chatliste registrierten alten Sessions übernommen. Die Originaldateien bleiben erhalten. Vorhandene Wrapper-Verläufe werden nicht überschrieben; Archivzustände bleiben erhalten. Ab der Übernahme werden die Gespräche im Wrapper fortgesetzt — spätere Änderungen an einer alten Desktop-Kopie werden nicht automatisch zusammengeführt. Portierbare JSON-/Markdown-Exporte liegen weiterhin unter `workspaces/default/chats/`.

Das Anzeigen eines Gesprächs nutzt `thread/read` ohne Schreibverbindung. Erst eine Aktion, die eine geladene Sitzung braucht, ruft `thread/resume` auf; gleichzeitige Ladeversuche desselben Chats werden zusammengefasst. Eine echte Schreibsperre wird niemals gelöscht oder umgangen. Nach dem Löschen einer nativen Codex-Session bleibt ein vorhandener Export lesbar, ist aber nicht automatisch eine native Session eines anderen Anbieters.

`job.yaml` ist gewöhnliches YAML. Ein Beispiel:

```yaml
version: 1
id: bericht
name: Tagesbericht
worker: codex
schedule:
  type: weekdays
  time: '09:00'
status: paused
connectionId: null
```

Zeitpläne verwenden die lokale Zeitzone des Macs und laufen nur, während der Server läuft. Ausgeschaltete Zeiten werden nicht nachgeholt. Ein Job wird innerhalb desselben Zeitfensters nicht doppelt ausgelöst. Bei Workflow-Webhooks bedeutet „abgeschlossen“, dass die HTTP-Antwort eingetroffen ist; asynchrone n8n-Ausführungen müssen ihre endgültigen Ergebnisse separat zurückliefern.

Ein zusätzlicher Worker bekommt einen separaten Adapter. Neue Modelle werden aus der installierten Codex-Version geladen. Updates von Codex werden nach einem Neustart verwendet; neue Protokoll-/UI-Funktionen müssen im Wrapper überprüft und gegebenenfalls ergänzt werden. Es findet kein unkontrolliertes automatisches CLI-Update statt.

Die Oberfläche registriert optional `agent_list_jobs` und `agent_stage_message` für Browser mit WebMCP. Letzteres bereitet nur einen Entwurf vor. Diese Registrierung wurde mangels aktivem WebMCP-Prüfkontext nicht live verifiziert.

## Prüfung

```sh
npm run build
npm test
```

Tests prüfen Ordnervertrag, YAML-Bearbeitung, Pfad-/Symlink-Grenzen, konkurrierende Speichervorgänge, Exporte und Workflow-Weiterleitung einschließlich Redirect-Sperre. Zusätzlich wurden echte Codex-Dateioperationen, Neustart/Fortsetzen, Fork/Archiv und macOS-Schlüsselbund geprüft. Die Kanal-/Bibliotheks-Erweiterung wurde zusätzlich im Browser bei 1280, 390 und 320 Pixeln geprüft: Dialoge, Herkunftsfilter, Vorschau, Favoriten und Wiederverwendung. Provider-Protokolle werden mit Testservern und simulierten Adaptern geprüft; echte Telegram-/Meta-/Microsoft-Konten wurden dabei nicht verwendet.

Offizielle Schnittstelle: https://learn.chatgpt.com/docs/app-server

## Gemeinsame fachliche Basis

Der Wrapper nutzt jetzt dieselbe `../firmenbasis/` wie der Order-Server.
`COMPANY_BASE` überschreibt diesen Pfad. AGENTS.md und FIRMA.md werden bei
jeder Nachricht frisch übergeben; die passende SKILL.md wird gezielt gelesen.
Die vorhandenen Workspace-Dateien und Identitätsanpassungen bleiben erhalten.
Die zentrale Quelle für neue Firmenangaben ist FIRMA.md. Details zur
Einbindung, Erweiterung und Prüfung stehen im Haupt-README.

## Stimme und verbindliche Oberflächenverträge

Diktat, Sprachchat mit lokaler Thorsten/Piper-Ausgabe, optionale Groq-/ElevenLabs-Verbindungen und Automodus: [VOICE.md](VOICE.md). Aufnahmeverwaltung liegt unter Einstellungen → Stimme. Neue Dienste werden über die normale Plus-Kachel unter Verbindungen eingerichtet.

Vor UI-Erweiterungen gelten [AGENTS.md](AGENTS.md), [DESIGN.md](DESIGN.md) und die [Aufbauverträge je Bereich](surfaces/README.md).

## Austauschbare Worker

Die Vorbereitung und Einrichtung von Codex, Hermes Agent, OpenClaw und dem
getrennten Claw-Code-Anschluss stehen in [WORKERS.md](WORKERS.md). Standard und
Vertretung werden unter Einstellungen → Worker gewählt. Firmenbasis und
technischer Einstieg sind gemeinsame Quellen; bestehende Chats behalten ihren
Worker. Diese Erweiterung ersetzt die frühere Beschränkung auf Codex-Aufträge.

## Kanäle, Skills und Ergebnisse

Einrichtung, Laufzeitvertrag, Ablage und verbleibende Grenzen: [CHANNELS.md](CHANNELS.md). Die neue [Bibliothek](surfaces/library.md) ist der gemeinsame Einstieg zu erzeugten Dateien. „Verbindungen“ bleibt der Name des Anschlussbereichs. Kanalgespräche sind dort einsehbar und werden bis zur gesonderten UI-Entscheidung nicht in die normale Chatliste aufgenommen.
