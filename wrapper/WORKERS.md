# Worker verbinden

Unter **Einstellungen → Worker** den gewünschten Worker verbinden, dann bei
Bedarf als **Standard** oder **Vertretung** wählen. Neue Chats und Aufträge mit
„Automatisch“ verwenden diese Auswahl. Bestehende Chats und fest zugewiesene
Aufträge behalten ihren Worker. n8n bleibt ein separat eingerichteter Workflow.
Ollama und LM Studio bleiben lokale Modell-Testchats.

## Installation und Anmeldung

| Worker | Anschluss | Voraussetzung |
| --- | --- | --- |
| Codex | nativer App-Server | `codex login` auf dem Rechner ausführen |
| Hermes Agent | `hermes acp` | Hermes mit ACP installieren und dort Modell/Konto einrichten |
| OpenClaw | `openclaw acp` | OpenClaw installieren und den eigenen Gateway einrichten |
| Claude Code | mitgelieferter ACP-Adapter `claude-agent-acp` | `claude login` auf dem Rechner ausführen |

Claude Code bezeichnet den Worker von Anthropic und ist unabhängig von OpenClaw.
Der gespeicherte Schlüssel `claw-code` und `UWE_CLAW_CODE_BINARY` bleiben aus
Kompatibilitätsgründen erhalten. Der Adapter `@agentclientprotocol/claude-agent-acp`
kommt mit dem Wrapper; er nutzt die Anmeldung des angemeldeten Benutzers
(macOS-Schlüsselbund bzw. `~/.claude`) oder alternativ `CLAUDE_CODE_OAUTH_TOKEN`
oder `ANTHROPIC_API_KEY` in der Umgebung des Wrappers. Die Modellliste kommt aus
der ACP-Sitzung des Adapters; beim Verbinden wird sie über eine kurz geöffnete
Probesitzung ermittelt, damit sie schon vor dem ersten Chat im Composer steht.

Im Composer lässt sich pro neuem Chat der Worker und dessen Modell wählen;
voreingestellt ist der gespeicherte Standard. Ein bestehender Chat bleibt bei
seinem Worker.

Programme werden im PATH, in `~/.local/bin` und in `/opt/homebrew/bin` gesucht.
Codex kann zusätzlich aus der installierten ChatGPT-App stammen. Bei abweichender
Installation setzt die betreibende Person `UWE_CODEX_BINARY`, `UWE_HERMES_BINARY`,
`UWE_OPENCLAW_BINARY` oder `UWE_CLAW_CODE_BINARY` auf einen absoluten Programmpfad.
Es wird ohne Shell gestartet. Die Argumente kommen aus dem zentralen Katalog;
für eigene Argumente kann ein lokal verwalteter Startpunkt verwendet werden.
Keine Zugangsdaten in Argumente, Einstellungsdateien oder Browser schreiben.
Danach den Wrapper neu starten und **Verbinden** wählen.

**Verbunden** bedeutet, dass die native Schnittstelle geantwortet hat und die
Anmeldung funktioniert. Fehlt sie, zeigt der Worker **Anmeldung fehlt** mit dem
passenden Terminalbefehl; Codex prüft dafür `account/read`, der Claude-Adapter
meldet seinen Login-Status selbst. Verfügbare Modelle, Werkzeuge und
Browserzugriff hängen weiterhin von der jeweiligen Installation ab. Ein Fehler
beim ersten Auftrag wird als Fehler angezeigt. Die Schaltzentrale installiert und authentisiert keine
Drittanbieter stillschweigend.

## Gemeinsame Ordner

- `firmenbasis/` bzw. `COMPANY_BASE`: fachliche Regeln, Firmenwissen, Arbeitsweisen.
- `system/` bzw. `SYSTEM_BASE`: technischer Einstieg für alle Worker.
- Arbeitsbereich bzw. `UWE_WORKSPACE`: `soul/`, `brain/`, `skills/`, Projekte,
  Aufträge und deren `input/` und `output/`.
- `UWE_DATA_ROOT/workers.json`: eingerichtete Worker, Standard, Vertretung;
  keine Schlüssel. Chats tragen ihre Worker-ID. Ältere Chats ohne ID gehören
  weiterhin zu Codex; das ist eine Kompatibilitätsregel, keine Ausweichwahl.

Der gemeinsame Kontext wird vor jedem neuen Turn frisch gelesen. Codex erhält
ihn als Entwickleranweisung, ACP-Worker als vorangestellten Kontextblock. Der
sichtbare und exportierte Nutzertext bleibt unverändert. Die Worker-Prozesse
kennen die gemeinsamen Pfade auch als Umgebungsvariablen. Die zentrale Basis
wird nicht in engine-eigene Wissensdateien kopiert. Der Order-Bootstrap liefert
zusätzlich `systemBase` mit denselben technischen Anweisungen.

## Grenzen und Vertretung

Die Vertretung wird ausschließlich bei der Verbindungsprüfung **vor** dem
Anlegen eines neuen Chats gewählt. Nach Annahme eines Auftrags, bei Modellfehlern,
Zeitüberschreitungen oder Unterbrechungen findet keine automatische Wiederholung
statt. So werden z. B. versendete Nachrichten oder Dateiveränderungen nicht
ungeprüft doppelt ausgeführt. Die tatsächliche Worker-ID und Vertretung stehen
im Chat und in den Laufbelegen.

ACP 1 unterstützt hier neue Chats, Texte/Bilder entsprechend der gemeldeten
Fähigkeiten, Streaming, Werkzeugaktivität, einmalige Freigaben, Stoppen,
Archivierung im Wrapper und Wiederherstellung über `session/load`. Ergebnisse
liegen im gemeinsamen Chatformat. Nicht unterstützte Methoden erzeugen einen
verständlichen Fehler. Planmodus, Steuern während eines laufenden Turns,
Fork/Rollback und das separate Terminal sind für ACP noch nicht freigeschaltet.
Ein Prompt ist kein verlässlicher Schreibschutz. ACP verwendet die nativen
Werkzeuge des Workers, keine im Client nachgebauten Dateisystem- oder
Terminalwerkzeuge. Browsersteuerung muss im Worker selbst vorhanden sein.

## Erweiterung und Prüfung

Weitere ACP-Worker erhalten einen Eintrag in `system/worker-catalog.mjs`.
Ein neues Protokoll bekommt einen Adapter mit `start`, `call`, `respond`, `stop`,
Fähigkeiten und normalisierten Ereignissen. Routing, Firmenkontext, Aufträge
und Oberfläche bleiben gemeinsam. `workers.mjs` führt keine Aufgaben direkt
in einem anbieterspezifischen CLI aus; die Adapter übersetzen den Vertrag.

Tests: `npm test`, `npm --prefix wrapper test`, `npm --prefix wrapper run build`.
Die Worker-Tests prüfen echte lokale JSON-RPC-Prozesse mit fiktiven Inhalten,
Fortsetzen, Abbruch, Ausfall, Modelle, frischen Kontext und Ausweichregeln.
Live-Modelltests sind davon getrennt zu dokumentieren.

Offizielle Schnittstellen: [ACP 1](https://agentclientprotocol.com/protocol/v1/initialization),
[Hermes](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration),
[OpenClaw](https://docs.openclaw.ai/cli/acp).

## Geprüfter Stand vom 7. September 2026

109 automatisierte Tests erfolgreich; Produktionsbuild, Syntaxprüfung und
Diffprüfung ohne Fehler. Browserprüfung bei Desktopbreite, 390 und 320 Pixeln
zeigte keinen horizontalen Überlauf. Verbinden von Hermes und Speichern einer
Vertretung wurden in der Oberfläche einer isolierten Instanz geprüft.

Zwei echte Aufträge über den Wrapper nutzten ausschließlich fiktive Daten:
Codex und Hermes lasen denselben Firmennamen aus der übergebenen Firmenbasis,
schrieben je eine Datei und lasen sie zur Kontrolle erneut. Hermes wurde danach
neu verbunden und setzte denselben Chat mit einem bestätigten Dateizugriff fort.
Die native einmalige Hermes-Dateifreigabe wurde über den Wrapper beantwortet.
OpenClaw ist auf diesem Rechner nicht installiert und wurde nicht live geprüft.
Für Claude Code ist weiterhin kein ACP-Adapter eingerichtet. Browser-/Desktopwerkzeuge
anderer Worker wurden nicht als gleichwertig zu Codex bestätigt.

## Auto und lokale Modellauswahl

„Auto“ probiert nur eingerichtete Worker in der stabilen Katalogreihenfolge.
Eine ausdrücklich ausgewählte Vertretung wird zuletzt geprüft. Ohne feste
Vertretung werden alle eingerichteten Worker vor Aufgabenbeginn berücksichtigt.
Ein Worker wird niemals nach Annahme einer Aufgabe automatisch ersetzt.

Lokale Laufzeiten und erkannte Modellnamen sind in den Einstellungen direkt
sichtbar. Der Katalog in `local-model-catalog.mjs` enthält eine datierte Auswahl
mit Originalquellen und Downloadgrößen. Hardware-Eignung beruht auf geschätztem
RAM-Bedarf bei 4K Kontext; tatsächliche Laufzeit und Geschwindigkeit bleiben
modell- und hardwareabhängig. „Alle Größen“ zeigt auch unpassende Varianten.
