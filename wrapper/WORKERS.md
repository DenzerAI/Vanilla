# Worker verbinden

Unter **Einstellungen → Worker** den gewünschten Worker verbinden, dann bei
Bedarf als **Standard** oder **Vertretung** wählen. Neue Chats und Aufträge mit
„Automatisch“ verwenden diese Auswahl. Bestehende Chats und fest zugewiesene
Aufträge behalten ihren Worker. n8n bleibt ein separat eingerichteter Workflow.
Ollama und LM Studio bleiben lokale Modell-Testchats.

## Installation und Anmeldung

| Worker | Anschluss | Voraussetzung |
| --- | --- | --- |
| Codex | nativer App-Server | Codex installieren und anmelden |
| Hermes Agent | `hermes acp` | Hermes mit ACP installieren und dort Modell/Konto einrichten |
| OpenClaw | `openclaw acp` | OpenClaw installieren und den eigenen Gateway einrichten |
| Claude Code | mitgelieferter Claude-Agent-ACP-Adapter | Nativen Claude-Zugang gemäß Adapter einrichten; abweichenden Adapter optional hinterlegen |

Claude Code bezeichnet den Worker von Anthropic und ist unabhängig von OpenClaw.
Der gespeicherte Schlüssel `claw-code` und `UWE_CLAW_CODE_BINARY` bleiben aus
Kompatibilitätsgründen erhalten. Der Anschluss verwendet `@agentclientprotocol/claude-agent-acp` (derzeit im Paket auf 0.75.1 festgelegt). Diese Adapterversion ist nicht die Claude-Code-Version.

Programme werden zuerst in `wrapper/node_modules/.bin`, dann im PATH, in `~/.local/bin` und in `/opt/homebrew/bin` gesucht. Ein explizit gesetzter Programmpfad hat Vorrang und wird nicht still ersetzt.
Codex kann zusätzlich aus der installierten ChatGPT-App stammen. Bei abweichender
Installation setzt die betreibende Person `UWE_CODEX_BINARY`, `UWE_HERMES_BINARY`,
`UWE_OPENCLAW_BINARY` oder `UWE_CLAW_CODE_BINARY` auf einen absoluten Programmpfad.
Es wird ohne Shell gestartet. Die Argumente kommen aus dem zentralen Katalog;
für eigene Argumente kann ein lokal verwalteter Startpunkt verwendet werden.
Keine Zugangsdaten in Argumente, Einstellungsdateien oder Browser schreiben.
Danach den Wrapper neu starten und **Verbinden** wählen.

**Verbunden** bedeutet, dass die native Schnittstelle erfolgreich geantwortet
hat. Konto, verfügbare Modelle, Werkzeuge und Browserzugriff hängen weiterhin
von der jeweiligen Installation ab. Ein Fehler beim ersten Auftrag wird als
Fehler angezeigt. Die Schaltzentrale installiert und authentisiert keine
Drittanbieter stillschweigend.

## Gemeinsame Ordner

- `firmenbasis/` bzw. `COMPANY_BASE`: fachliche Regeln, Firmenwissen, Arbeitsweisen.
- `system/` bzw. `SYSTEM_BASE`: technischer Einstieg für alle Worker.
- Arbeitsbereich bzw. `UWE_WORKSPACE`: `soul/`, `brain/`, `skills/`, Projekte,
  Aufträge und deren `input/` und `output/`.
- `UWE_DATA_ROOT/workers.json`: eingerichtete Worker, Standard, Vertretung;
  keine Schlüssel. Chats tragen ihre Worker-ID. Ältere Chats ohne ID gehören
  weiterhin zu Codex; das ist eine Kompatibilitätsregel, keine Ausweichwahl.

Der gemeinsame Kontext wird vor jedem neuen Turn frisch gelesen. Bei normalen Nachrichten erhält Codex
ihn als Entwickleranweisung, ACP-Worker als vorangestellten Kontextblock. Der
sichtbare und exportierte Nutzertext bleibt unverändert. ACP-Slash-Eingaben werden ohne zusätzlichen Kontextblock gesendet: Manche nativen Befehle erwarten genau einen Textblock; Firmenkontext darf nicht zu Befehlsargumenten werden. Die gemeinsamen Pfade bleiben im Prozesskontext vorhanden. Die Worker-Prozesse
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

## Historischer Prüfvermerk vor der Durchlässigkeitsprüfung

Die folgenden Angaben stammen aus der früheren Einführung und sind kein aktueller Gesamtprüfbeleg:

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

## Durchlässigkeitsprüfung vom 7. September 2026

OpenClaw wird ohne den gesperrten globalen Gateway-Konfigurationsaufruf verbunden.
Es erhält weiterhin keine sitzungsbezogene MCP-Injektion. Das gemeinsame Gedächtnis
ist dort daher nicht automatisch angeschlossen. Gateway-Konfiguration, Anmeldung
und native Werkzeuge bleiben beim Betreiber. OpenClaw ist aktuell lokal nicht
gefunden; ein echter Gateway-Lauf wurde nicht geprüft.

ACP übernimmt `available_commands_update`, `config_option_update` und
`current_mode_update` auch im Leerlauf und während des Sitzungsaufbaus. Beim
Laden werden Metadaten übernommen, ohne den gespeicherten Verlauf zu duplizieren.
Nicht erneut gemeldete Sitzungseinstellungen werden nach erfolgreichem Laden
nicht aus einem veralteten Snapshot weiter angeboten. Speichervorgänge sind
geordnet; die Oberfläche erhält Änderungen über den vorhandenen Ereignisstream.

Befehlsauswahl steht in ACP-Chats neben Modus und Modell; vorhandener Entwurfstext
bleibt als Argument erhalten. Erst Senden führt den Befehl aus. `configOptions`
haben Vorrang vor den älteren Modus-/Modellfeldern. Unterstützt sind native
Select-Optionen einschließlich gruppierter Werte und unbekannter Kategorien;
unbekannte Eingabetypen erscheinen mit einem Hinweis. Änderungen gehen an
`session/set_config_option`, ältere native Modi an `session/set_mode`. Nur
gemeldete Werte werden angenommen, Änderungen während laufender Arbeit gesperrt.
Ein bestätigtes `end_turn` gilt auch ohne Text als nativer Abschluss.

Die statischen Booleans beschreiben weiterhin Wrapper-Bedienfunktionen, keinen
vollständigen nativen Werkzeugkatalog. ACP-Bild-/Audio-Unterstützung folgt dem
Handshake; vor der Aushandlung wird sie nicht behauptet. `/api/workers` trennt
`nativeCapabilities`, `capabilitySource` und Wrapper-`capabilities`. Fehlende
Agentversionen werden nicht länger durch die Protokollversion ersetzt.
Unbekannte ACP-Updatearten und nicht dargestellte Diff-/Terminal-Inhalte werden
im Sitzungs-Hinweismenü kenntlich gemacht; es ist keine vollständige native
Darstellung zugesagt. Metadaten unbekannter Updatearten enthalten nur deren
Typnamen, keine beliebigen privaten Rohdaten.

Grenzen: Kein allgemeiner nativer Befehlseditor vor dem ersten Sitzungsaufbau;
kein nachgebauter Codex-TUI-Befehlskatalog; keine neuen ACP-Client-Datei- oder
Terminalwerkzeuge; keine automatische Installation, Anmeldung oder Aktualisierung.
Normale Nachrichten erhalten weiterhin den gemeinsamen Firmen-/Arbeitskontext
und Wrapper-Gesprächsstil. Ein nativer Modus ist nicht automatisch ein vom
Wrapper durchgesetzter Schreibschutz.

Prüfbelege und Detailbewertung liegen im Auftrags-Arbeitsbereich unter
`output/worker-durchlaessigkeit.md`. Produktionsbuild und TypeScript wurden
geprüft. Die Browserprüfung ist offen: Chrome und Chromium scheitern in dieser
Ausführungsumgebung beim macOS-Mach-Port-Aufbau mit „Permission denied“. Es gibt
keinen Live-Nachweis neuer Funktionen gegen angemeldete Anbieter.

## Anbieter direkt im Chat auswählen

Die Modellwahl aktiviert Codex oder Claude Code über `POST /api/workers/activate`. Dieser ausdrückliche Klick verwendet eine laufende Verbindung wieder, ohne laufende Chats zu unterbrechen, und nutzt die vorhandene native CLI-/OAuth-Anmeldung. Bei Claude Code lädt das anschließende Öffnen einer leeren Sitzung die tatsächlich angebotenen Modelle und Denkstufen, ohne einen Prompt zu senden. Ein fehlgeschlagener Sitzungsaufbau erzeugt keinen Chat in der Liste. Die globale Standard-/Vertretungswahl bleibt erhalten; ein bestehender Chat wechselt niemals still seinen Worker.

`worker-models.mjs` normalisiert native Modell-/Effort-Optionen. ACP-Konfigurationsoptionen haben Vorrang vor Legacy-Modellfeldern. Nach `session/set_config_option` werden die vollständig bestätigten Optionen verwendet und die Chatmetadaten aktualisiert. Ältere ACP-Worker verwenden validiertes `session/set_model`.

Quellen: [Codex App Server · model/list](https://learn.chatgpt.com/docs/app-server), [Claude Code · Modellkonfiguration](https://code.claude.com/docs/en/model-config), [Claude Code · Anmeldung](https://code.claude.com/docs/en/authentication). Verfügbarkeit und Stufen werden zur Laufzeit ermittelt; die Webdokumentation ist keine fest codierte Modellliste.

Wenn der ACP-Adapter die native Erweiterung `_auth/status_update` meldet, wird ihr Anmeldestatus vor der Übernahme einer neuen Sitzung geprüft. Ein ausdrücklich abgemeldeter Worker liefert einen erneuten Anmeldehinweis; die reine Modellliste beweist keinen Zugang. Es wird nur ein boolescher Status übernommen, keine Kontoidentität oder Zugangsdaten. Nicht gemeldeter Status bleibt unbekannt. Der installierte Claude-Adapter wurde am 08.09.2026 ohne Anmeldung geprüft: Handshake und Modellmetadaten vorhanden, Sitzungsübernahme mit korrektem Anmeldehinweis abgewiesen. Ein authentifizierter Modelllauf benötigt die eigene native Anmeldung.
