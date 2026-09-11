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
ACP-Block endet ausdrücklich mit `</vanilla_context>` und einer getrennten
Kennzeichnung der aktuellen Nutzernachricht. Das erhält die Grenze auch bei
nativen Adaptern, die mehrere Textblöcke ohne Trennzeichen zusammensetzen. Der
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

Native Befehle bleiben in ACP-Chats direkt als Texteingabe verfügbar. Erst Senden führt den Befehl aus. `configOptions`
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

Beim erneuten Versuch nach einer Anmeldung wartet die Sitzungsübernahme auch
bei einem zuvor abgemeldeten Status auf die neue native Rückmeldung (höchstens
5,5 Sekunden). Ein frisch gemeldetes „abgemeldet“ bleibt ein Fehler. Es werden
weder Zugangsdaten ausgelesen noch laufende Worker dafür neu gestartet.

Claude kann eine vor dem ersten Prompt geöffnete Modellauswahl nach einem
Neustart mit `Resource not found` ablehnen. Nur wenn der gespeicherte Chat
nachweislich noch keinen Turn enthält, wird dafür eine neue native Sitzung
unter derselben sichtbaren Chat-ID aufgebaut. Gespeicherte native Einstellungen
werden erneut validiert und bestätigt, das Modell vor dem Denkaufwand. Es wird
kein Prompt gesendet. Bereits angenommene Turns, auch fehlgeschlagene oder
unterbrochene, werden niemals auf diesem Weg wiederholt oder ersetzt. Andere
Ladefehler und nicht mehr verfügbare Einstellungen bleiben sichtbare Fehler.

Die native Claude-Verlaufsspeicherung verwendet wie Codex einen eigenen
Installationsordner: standardmäßig `UWE_DATA_ROOT/claude`, übergeben als
`CLAUDE_CONFIG_DIR`. Der Ordner gehört zur Installation und wird vor dem
Workerstart angelegt. Anmeldung und Schlüsselverwaltung bleiben nativ. Es werden
keine globalen Claude-Konfigurationen oder Zugangsdaten kopiert. Ohne Anmeldung
für diesen Ordner die CLI über `npm run worker:login -- claw-code` anmelden.

Ein bereits ausdrücklich eingerichteter Dienstzugang kann unter
`UWE_DATA_ROOT/worker-auth.json` gebunden werden:
`{"version":1,"environment":{"claw-code":"oauth"}}` übernimmt ausschließlich
`CLAUDE_CODE_OAUTH_TOKEN`; `api-key` wählt ausschließlich `ANTHROPIC_API_KEY`.
Die Datei enthält nur den Selektor, niemals den Schlüssel. Ohne diese lokale
Bindung werden keine Umgebungszugänge übernommen. Fehlender Dienstzugang oder
ungültige Bindungen verhindern den Start. Andere Worker erhalten diese Werte
nicht. Bestehende Installationen richten die Bindung ausdrücklich ein; neue
Clones bleiben unverbunden. Entfernen der Bindung stellt das Profilverhalten
wieder her, ohne Zugangsdaten oder Chats zu verändern.

ACP 0.75 kann tokenbasierte OAuth-Anmeldungen ohne Abonnementfelder als `none`
melden. Nur bei ausdrücklich gebundenem OAuth prüft der Wrapper dann dieselbe
CLI über den Adapter (`--cli auth status --json`). Erst `loggedIn: true` mit
`authMethod: oauth_token` bestätigt die Anmeldung. Späte Ergebnisse nach einer
neueren Identität oder Trennung werden verworfen. Ein vorhandener Token allein
bestätigt keine Anmeldung; eine echte Testantwort bestätigt die Nutzbarkeit.

Bestehende angenommene Sitzungen werden bei fehlendem nativen Verlauf
nicht automatisch neu ausgeführt.

Vorgemerkte Modellwahl: `/api/turn` akzeptiert `nextSelection: {model, effort}` für die nächste Antwort. Während eines aktiven Turns wird dieser Request abgewiesen, bevor `turn/steer` möglich ist. Im Leerlauf prüft Codex gegen den gemeldeten Katalog; ACP übernimmt Modell und Effort anhand aufeinanderfolgender nativer Antworten. Auswahl und Prompt bleiben unter derselben `turnLocks`-Sperre. Fehler verhindern die Promptübergabe.

Explizite Anbieterübernahme: `POST /api/chat/provider` akzeptiert `id`, `workerId`, `expectedWorker`, `expectedTurnId` und `stop`. Derselbe Turn-Lock schützt Vorprüfung, Zielanmeldung, bestätigten Abbruch und Übernahme. Sichtbare Chat-ID und Metadaten bleiben stabil; `workerThreadId` benennt die neue native Sitzung, `handoffSnapshot` den unveränderlichen bisherigen Verlauf. ACP speichert native Sitzungen separat im Arbeitsbereich unter `chats/<nativeId>/native-session.json`, zusammen mit dem bestehenden Workspace-Backup; alte Transkripte bleiben als Ladefallback unterstützt. `Workers.call` und Ereignisse übersetzen zwischen nativer und sichtbarer ID. Alte Sitzungen dürfen keine neuen Chatereignisse einspeisen. Der neue Worker erhält vor jedem Turn frische gemeinsame Regeln sowie den Verlaufsauszug und den vollständigen Exportpfad.

`POST /api/chat/speed` speichert eine native Codex-Service-Tier oder `null` als Standard pro Chat, auch während einer Antwort. `turn/start.serviceTierForTurn` übergibt die Auswahl ausschließlich für einen neuen Turn. Der Server validiert gegen die aktuell gemeldeten `serviceTiers`; andere Worker erhalten diesen Codex-Parameter nicht.

## Neutrale Kundenprofile

Ein neuer Clone aktiviert keinen Worker automatisch und übernimmt keine Hostprofile. Die vorhandenen Programme sind ausschließlich ausführbare Werkzeuge. `npm run worker:login -- codex` beziehungsweise `claw-code`, `hermes` oder `openclaw` startet die native Anmeldung mit Installationsprofilen unter data/control. Danach den Worker im vorhandenen Dialog verbinden und eine echte Testnachricht prüfen. Der Launcher vererbt nur Betriebssystem-Grundwerte; fremde Provider-/Proxyzugänge werden nicht vererbt. Eigene Profile mit externen Verknüpfungen werden zurückgewiesen. Ausgenommen sind ausschließlich die von Codex erzeugten ausführbaren Aliasse unter `codex/tmp/arg0/codex-arg*/` (`applypatch`, `apply_patch`, `codex-execve-wrapper`) auf eine ausführbare Codex-Datei; Konten, Plugins und Konfiguration bleiben geprüft. Dadurch funktioniert auch ein erneuter Start nach einer nativen Sitzung. Bestehende lokale Profildaten werden weder gelöscht noch automatisch migriert. Weitere Einrichtung: docs/CUSTOMER-SETUP.md#workers.

Der frühere Host-Import in `prepareCodexHome` ist entfernt. Auch ein neuer Aufrufer
kann über `sourceHome` keine persönlichen Konten, Plugins oder Gesprächsdateien
übernehmen; der alte Parameter führt zu einem konkreten Einrichtungsfehler.
Bereits eigene Dateien bleiben beim Start erhalten. Datenumzug erfolgt über die
vollständige Sicherung, die native Anbieteranmeldung am Ziel über den eigenen Login.

## Native Rückfragen · Version 1.0.0

Codex-Anfragen `item/tool/requestUserInput` werden über den bestehenden
Request-Stream weitergereicht und mit `{answers:{id:{answers:[text]}}}` an die
ursprüngliche native Anfrage beantwortet. ACP meldet zusätzlich
`clientCapabilities.elicitation.form = {}`. `elicitation/create` eines laufenden
Turns erscheint mit öffentlicher Thread-/Turn-ID als Formularanfrage; die
Antwort `{action,content}` geht an die originale ACP-RPC-ID zurück. Der
mitgelieferte Claude-Adapter übersetzt damit AskUserQuestion einschließlich
Mehrfachauswahl und `_askUserQuestionCustomAnswer` ohne neue Modellanweisungen.
URL-Elicitation wird nicht als neue Fähigkeit angemeldet.

Request-IDs, Frage-IDs und primitive Antworttypen bleiben erhalten. Ein
beendeter oder getrennter Aufruf kann nicht erneut beantwortet werden. Antworten
werden weder als neue Nutzernachricht noch als Turn-Steuerung gesendet.
Anbieter dürfen weiterhin selbst entscheiden, wann eine Rückfrage nötig ist.
Native Wartezeiten und Abbruch gehören zum jeweiligen Anbieterprotokoll.
Keine Konto-, Paket- oder Datenmigration; ergänzende Fragequittungen verwenden
bestehende Werkzeugaufzeichnungen. Vor Rückkehr auf einen alten Adapterstand
laufende Rückfragen beantworten oder regulär stoppen.


### Native Verbrauchsdaten

Codex-Tokens bleiben im bestehenden thread/tokenUsage/updated-Ereignis; die
Statistik bewahrt belegte Turn-Differenzen. Claude-ACP 0.75.1 liefert usage_update
für Kontext/Kostenschätzung sowie _meta.quota in der Promptantwort mit Tokens
und Modellwerten. Diese werden ohne Neuberechnung der Anbieterpreise übernommen.
@anthropic-ai/claude-agent-sdk 0.3.257 ist für den experimentellen get_usage-
Kontrollabruf direkt festgelegt. Der separate Nur-Lese-Prozess nutzt dieselbe
native Konfiguration, sendet keinen Prompt und beendet sich nach spätestens
15 Sekunden. Account-Limits sind getrennt von Workspace-/Sitzungs-Tokens.
Vertrag und Rückkehrgrenzen: surfaces/chat.md, Kontingente und Live-Verbrauch.

Codex aktiviert beim App-Server-Start `features.default_mode_request_user_input`
für native Rückfragen auch im normalen Arbeitsmodus. Die private oder globale
Nutzerkonfiguration bleibt unverändert; ein ausdrücklich übergebener Adapterwert
kann den Standard überschreiben. Nach dieser Anschlussänderung ist ein regulärer
Serverneustart erforderlich. Textfragen werden nicht in Formulare umgedeutet.

Die native Claude-Kontingentabfrage verwendet denselben installationsbezogenen
Profilweg wie der ACP-Anschluss über `installationEnvironment`. Fremde
Host-Anmeldungen, Provider-Schlüssel und Proxyzugänge werden auch bei diesem
separaten SDK-Kontrollprozess nicht vererbt. Vorhandene native Einstellungen und
Memory-Dateien innerhalb des eigenen Profils bleiben erhalten.

## Geprüfte Übergabe im gemeinsamen Stand
Der Workerstart bleibt an den bestehenden Turn-Lock gebunden. Die neue
Browser-Outbox und ältere gespeicherte Nachrichten verwenden denselben
Workeranschluss; unklare Annahmen werden nicht blind wiederholt.
Thread-Zusammenfassungen für den Browser kürzen keinen nativen Kontext.

## KI & Modelle und Hintergrundaktualisierung · Version 2

Der Einstellungsname lautet KI & Modelle. Gemini CLI (`gemini --acp`) und
Kimi Code CLI (`kimi acp`) verwenden den bestehenden ACP-Anschluss. Neue IDs
werden hinten angefügt, damit die automatische Reihenfolge bestehender Anschlüsse
unverändert bleibt. Installation und Anmeldung folgen den verlinkten offiziellen
Anbieterseiten im Katalog. Es werden keine neuen Konten automatisch verbunden.

`system/ai-catalog.mjs` führt die öffentlichen Anbieter und Programmquellen.
`wrapper/ai-maintenance.mjs` ist der langlebige, serialisierte Prüfer. Der vorhandene
Core-Wartungstakt stößt `/api/ai-maintenance/tick` an; kein Benutzerjob, kein
zusätzlicher Scheduler und keine Browserabhängigkeit. Prüfung beim ersten Takt,
danach alle sechs Stunden; bei Fehlern nach einer Stunde, bei wartender Aktivierung
nach einer Minute. Jetzt prüfen benutzt denselben Prüfer und bündelt Doppelklicks.

Programmversionen kommen aus dem offiziellen npm-Paket, PyPI oder GitHub Release.
Nur stabile numerische Versionen und passende Paketidentitäten werden akzeptiert.
ETag und Fristen begrenzen Abfragen. Ein Ausfall erhält Version und Datum der
letzten erfolgreichen Quellenprüfung. Models.dev liefert einen ausdrücklich
als öffentlichen, gemeinschaftlich gepflegten Katalog beschrifteten Modellüberblick
für OpenAI, Anthropic, Google, Moonshot, DeepSeek und Alibaba. Er ist kein Nachweis
für Kontozugang, Verfügbarkeit im Worker oder eine lokale Installation. Aus dem
Katalog werden ausschließlich begrenzte Namen, IDs, Datumswerte und der Hinweis
auf offene Gewichte übernommen, niemals Befehle, Preisversprechen oder Modellwahl.
Die tatsächlich gemeldete Modellauswahl stammt weiterhin vom verbundenen Worker.

Automatische Programmupdates sind abschaltbar und für bereits installierte Codex-
und Gemini-CLIs implementiert. Ein ausdrücklich gesetzter Programmpfad wird nicht
übernommen. Neue Anbieter werden nicht automatisch installiert. Native Apps,
Python-Programme und andere Adapter zeigen ihre Grenze und den Anbieterlink.
Downloads verwenden festgelegte Pakete und Registry, exakte Versionen, eigene
Ordner und ein bereinigtes Prozessumfeld ohne Kontoschlüssel. npm-Lifecycle-Skripte
sind deaktiviert. Paketmanifest, ausführbare Version und Protokollinitialisierung
werden vor dem Umschalten geprüft; Vorschauversionen und Downgrades entfallen.

Aktivierung wartet auf freie Chats, Übergaben, Sprachsessions, Kanalaufträge,
Updateprüfungen, Verbindungen und Worker-RPCs. Während der kurzen Umschaltung
warten neue Worker-Aufrufe. Der alte Prozess bleibt bis zur bestätigten neuen
Initialisierung und Speicherung erhalten. Fehler vor dem Umschalten erhalten
den aktiven Programmpfad. Sitzungen werden beim nächsten Aufruf erneut geladen;
Modellwahl, Routing, Konten und Gesprächszuordnung bleiben bestehen. Ein erfolgreicher
Handshake beweist noch keinen erfolgreichen Modellauftrag. Eine inkompatible
native Datenmigration ist nicht durch eine Binärkopie rückgängig zu machen;
dieser Ausbau bietet keine pauschale Rückkehrgarantie für Drittanbieterprofile.

### Daten und Rückkehr

`data/control/ai-maintenance.json`, Schema 1, enthält Auswahl, Prüfstände,
aktiven/vorherigen Programmkandidaten und deduplizierte Ereignisse. Schreiben ist
atomar, serialisiert und dauerhaft. Unbekanntes Schema stoppt; eine unterbrochene
Installation wird als Fehler wiederaufgenommen, niemals als Erfolg. Downloads
liegen ausschließlich unter `data/control/ai-programs`. Die aktive ausführbare
Datei wird aus validierten IDs rekonstruiert und gegen die echte Ordnergrenze
geprüft. Neue Daten werden additiv angelegt; workers.json, Konten und lokale
Modelldateien werden nicht migriert. Alter Vanilla-Code ignoriert die neuen
Dateien und verwendet wieder den bisherigen Programmsuchweg. Für eine komplette
Wiederherstellung müssen diese Ordner sowie die nativen Profile gesichert werden.
Verwaiste Kandidaten werden nicht während laufender Arbeit gelöscht.

Ereignisse für neue Programme, neu entdeckte Modelle, Erfolg oder Fehler laufen
über die bestehende Notifications-Tabelle mit `kind=ai-update`. Stabile IDs erhalten
Lesestatus über Neustarts. Der Startfächer zeigt den neuesten Hinweis pro Anbieter;
Klick öffnet KI & Modelle. Erfolgreiche Routineprüfungen erzeugen keine Meldung.

Prüfung: `wrapper/test/ai-maintenance.test.mjs`, `wrapper/test/workers.test.mjs`,
`core/tests/test_ai_notifications.py`, gemeinsame Typ-, Modul- und Designprüfungen.
Authentifizierte echte Modellaufträge und eine native Profilmigration benötigen
zusätzlich eine eigene Abnahme je unterstützter Programmversion.

Anmeldung für Gemini oder Kimi: `npm run worker:login -- gemini` beziehungsweise
`npm run worker:login -- kimi` öffnet die jeweilige interaktive CLI mit dem eigenen
Vanilla-Profil. Dort den nativen Anmeldedialog verwenden. Der Anmeldeeinstieg
beachtet auch verwaltete Codex/Gemini-Versionen; keine Hostprofile werden importiert.


## Einheitlicher Chatanschluss · Version 2

ModelPicker ist der einzige Einstieg unter dem Composer für beide Anbieter.
Claude-Fast verwendet die nativ gemeldete Select-Option fast mit on/off;
Anbieterwechsel im ruhenden Chat benötigen keinen zusätzlichen Bestätigungsschritt.
Der vorhandene Übergabeanschluss erhält den vollständigen Verlauf und liefert
bei langen Chats den Anfang samt jüngstem Stand als begrenzten Kontextblock.
Es entsteht kein weiterer Modellaufruf für die Zusammenfassung.

ACP-Sitzungsaufbau und Wiederherstellung erhalten 60 Sekunden statt des kurzen
allgemeinen RPC-Limits. Ein Timeout nennt die Sitzungsöffnung, wiederholt sie
nicht automatisch und bleibt ein Fehler. Nicht angemeldete native Anschlüsse
melden auch beim Wiederöffnen und vor einer Nachricht konkret die fehlende
Anmeldung, bevor Nutzerarbeit angenommen wird; Handshake ist kein Modelltest.

Anbieterbezogene Prozessstarts, Claude-Verbrauchsabfrage und CLI-Anmeldung
validieren ihr eigenes Profil und die gemeinsamen Home-/Temp-Verzeichnisse.
Andere Anbieterprofile werden weder geprüft noch als Umgebungsvariable übergeben.
Fremde Verknüpfungen im tatsächlich verwendeten Profil bleiben abgewiesen.
Der Aufruf ohne Anbieter behält die vollständige Installationsprüfung.
Keine Profile, Zugangsdaten oder gespeicherten Berechtigungen werden verändert.
Datenmigration: keine; bestehende native Sitzungen und Übergabedateien bleiben
kompatibel. Rückkehr stellt die frühere gemeinsame Profilprüfung wieder her.
Prüfung: worker-environment, worker-models, chat-handoff, acp-session und workers.

Eine ausdrücklich konfigurierte lokale `worker-auth.json` mit Format 1 kann
`environment["claw-code"]` auf `oauth` oder `api-key` setzen. Nur dann übernimmt
der Claude-Prozess genau die benannte Dienstvariable; andere Anbieter erhalten
sie nicht. Die Datei enthält ausschließlich die Auswahl, keine Zugangswerte.
Fehlende Dienstvariable, unbekanntes Format oder Auswahl stoppen die Anmeldung.
Ohne lokale Auswahl werden keine geerbten Anbieterzugänge übernommen.
