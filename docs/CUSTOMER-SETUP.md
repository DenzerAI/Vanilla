# Kundenbasis einrichten und erweitern

Die Installation beginnt mit einem geprüften Clone, `npm run source:setup`,
`npm run setup:system` und `npm start`. Node ab 22.12 und Python ab 3.12 sind
erforderlich. Firmenbasis, Workspace und Daten entstehen lokal. Übernommener
Code enthält keine Profile oder Zugangsdaten. Der vollständige Installationsweg
und die getrennte Host-Dienstaktivierung stehen in README.md und OPERATIONS.md.

Vor jedem Anschluss `system_modules` nach dem gewünschten Anbieter durchsuchen,
den Einrichtungsweg mit `system_module` lesen und die dort genannte Statusquelle
prüfen. Eine fehlende Kundenanmeldung ist ein Einrichtungszustand. Eine fehlende
Implementierung wird als Grenze genannt. Beides darf nicht als verbunden gelten.

## workers

Die vorhandenen Programme werden über PATH oder den ausdrücklich konfigurierten
Programmpfad gefunden. Alle Profile liegen in `data/control`: `codex`, `claude`,
`hermes`, `openclaw` und `worker-home`. Shell-Zugangsdaten, persönliche Skills,
Plugins und Umgebungsprofile werden nicht übernommen. Vorhandene Verknüpfungen
auf fremde Profile führen zu einer konkreten Fehlermeldung.
Der Operator meldet die eigene CLI mit genau diesen Profilverzeichnissen an;
der installationsgebundene Einstieg ist `npm run worker:login -- WORKER`.
Danach unter den bestehenden Worker-Einstellungen verbinden und eine kurze
Testnachricht ausführen. Installiert, verbunden und authentifiziert getrennt
prüfen. Trennen beendet den Anschluss; Profile werden nicht heimlich gelöscht.
Weitere Protokollgrenzen und Wiederaufnahme: wrapper/WORKERS.md.

## inbox

Für Outlook oder Gmail zuerst `/api/mail/setup` lesen. Die Kundenorganisation
registriert eine OAuth-Anwendung mit der angezeigten Rücksprungadresse und den
in MAIL.md aufgeführten Rechten. Appzugänge über den Mail-Einrichtungsweg speichern,
dann das konkrete Konto verbinden. Microsoft-Anwendungszugriff benötigt zusätzlich
die bewusste Administratorfreigabe des jeweiligen Postfachs. Keine Anmeldung
wird vom Host importiert. Nach Verbindung Kontostatus und Synchronisation prüfen,
eine Nachricht lesen und einen Entwurf speichern. Senden ausschließlich nach
Freigabe von Empfänger und Inhalt; unklare Zustellung niemals automatisch wiederholen.
Trennen stoppt Synchronisation und entfernt den Zugang; lokale Nachrichten bleiben.
Die vollständigen OAuth-, Entwurfs-, Fehler- und Wiederherstellungsregeln: MAIL.md.

## connections

Vorhandenen Verbindungstyp im Service-, CRM- oder Integrationskatalog nachschlagen.
Eigene Werte in dessen bestehendem Formular speichern, Verbindung testen und
erst nach erfolgreicher Statusantwort die konkrete Aktion ausführen. API-Schlüssel
liegen verschlüsselt im lokalen Tresor; Löschen einer Verbindung entfernt ihre
Zugangsdaten nach dem jeweiligen Vertrag. Ein gespeicherter Browserlink installiert
kein MCP-Werkzeug. CRM-Logintests sind noch keine Datensynchronisation. Kataloge und
Feldbeschreibungen: wrapper/surfaces/connections.md, wrapper/service-catalog.mjs,
wrapper/crm-catalog.mjs und wrapper/ui/connection-catalog.mjs.

## chat

Einen eigenen Worker verbinden, im bestehenden Chat auswählen und Nachricht
senden. Die dauerhafte Übergabe führt Nachrichten-IDs und Wiederanlaufzustände;
eine unklare Übergabe bleibt zur Prüfung stehen. Erst die Worker-Bestätigung
belegt die Annahme. Datei- und Projektkontext bleiben im ausgewählten Workspace.
Bei Anbieterwechsel gelten Übergabe und Abbruch aus wrapper/WORKERS.md.

## crm-core

Das lokale CRM benötigt keinen externen Anbieter. Schema lesen, Quellen erfassen,
Änderungen vorschlagen und über den bestehenden Eigentümer-Endpunkt entscheiden.
Nur bestätigte, aktuelle Fakten verwenden. Mailinhalt und Dokumente sind zunächst
Belege. Externe Anbieter-Synchronisation ist ein eigener, noch nicht vollständiger
Anschluss. Migrationen, Revisionen und Freigaben: CRM.md.

## planner

Unter Verbindungen → Kalender den vorhandenen Microsoft-Serviceanschluss mit
Mandanten-ID, App-ID, App-Geheimnis und Postfach einrichten. Für Kalenderlesen
`Calendars.ReadBasic` oder die tatsächlich benötigte weitergehende Leseberechtigung
mit Administratorfreigabe verwenden. Der Service-Test prüft Postfach- und Kalenderlesen unabhängig und nennt nur
bestätigte Rechte. Danach den gespeicherten Kalender mit `calendar_sync` prüfen. Die Systemzeitzone muss dem gewünschten Kalender entsprechen.

`calendar_sync` mit Anschluss-ID und Datum `start`/`end` (Ende exklusiv, bis 93 Tage)
liest alle Kalenderseiten und speichert erst den vollständigen Zeitraum. Der
laufende Kern gleicht alle fünf Minuten ab, Öffnen eines Monats lädt dessen Fenster.
`calendar_list` meldet Termine, Abdeckung und Fehler. Ein leerer oder veralteter Feed
ist kein Beleg für einen freien Kalender. Kalenderänderungen/Einladungen erfolgen
beim Anbieter. Wetter, Google-Kalendersync und eigene Termine bleiben Ausbau.
Quellen, Zeitregeln und Grenzen: PLANNER.md.

## jobs

Vor einer Routine `routine_capabilities` lesen. Datenquelle und Worker prüfen,
Zeitzone, Zeitpunkt und Benachrichtigungsziel aus dem Auftrag übernehmen, dann
`routine_create` mit stabiler Anfragekennung ausführen. `routine_list` liefert
Revision und nächsten Lauf. Abschlussbeleg und tatsächliche Zustellung getrennt
prüfen. Änderungen über `routine_update`, Pausieren erhält Verlauf und Ergebnisse.
Details: wrapper/surfaces/jobs.md und wrapper/job-templates.mjs.

## channels

Telegram, WhatsApp und A2A verwenden den vorhandenen Serviceanschluss. Eigene
Zugangsdaten verbinden, erlaubte Absender festlegen, Kanal starten und Zustand
prüfen. Nach einem Neustart Status erneut prüfen; aktiv konfigurierte Dienste
sind nicht automatisch verifiziert. Keine externe Nachricht ohne Nutzerauftrag.
Trennen und Wiederanlauf: wrapper/CHANNELS.md.

## knowledge

Markdown- und Textdateien im Workspace werden lokal indexiert. Bibliotheksvorschau
für PDF oder Office bedeutet noch keine Inhaltsindexierung. Die Volltextsuche
funktioniert ohne Embeddings; der Systeminstaller richtet das lokale Standardmodell
automatisch ein. Fehler und Reparatur stehen unter Memory → Lokale Suche.
Installationsvertrag und echte Offlineprobe: OPERATIONS.md#lokale-suche. Notizen mit Quellen und Versionsprüfung
schreiben. Verlauf bleibt von aktuellen CRM-Fakten getrennt. Regeln: CORE.md.

## library

Dateien über den vorhandenen Upload oder Workspace ablegen und unter derselben
Projektkennung lesen. Pfadgrenzen und Dateiversionen beachten. HTML läuft in der
vorhandenen isolierten Vorschau. Quelldateien gehören zur Datensicherung; Caches
sind ersetzbar. Vertrag: wrapper/surfaces/library.md.

## skills

Arbeitsweisen liegen in der eigenen Firmenbasis oder im Workspace. Eigene
Worker-Skills werden aus den Installationsprofilen gelesen. Skill kopieren oder
anlegen nutzt die bestehende Bibliothek mit Versionsprüfung. Fremde Quellpfade
und Anbieterrechte werden nicht durch einen Skill freigeschaltet. Vertrag:
wrapper/surfaces/skills.md; zusätzliche Codex-Plugins bleiben lokal.

## speech

Systemsetup installiert Piper mit geprüften Modellreferenzen. `/api/speech/status`
prüfen und eine kurze Wiedergabe testen. ElevenLabs bei Bedarf mit eigenem Schlüssel
verbinden, Stimme auswählen und Anbieter ausdrücklich umstellen. Kein automatischer
Cloudwechsel. Grenzen und Reparatur: wrapper/VOICE.md.

## dictation

Systemsetup installiert den lokalen Erkennungsweg. Mikrofonberechtigung im Browser
erteilen und Status prüfen. Cloudanbieter ausschließlich mit eigenem Schlüssel
verbinden und auswählen. Aufnahmen bleiben Installationsdaten. Details:
wrapper/DICTATION.md.

## settings

Identität und Firma erst beim Kunden ergänzen. Die bestehenden Einstellungen
speichern Werte in der lokalen Datenbank. Keine Firmeninformationen in Quellcode
oder neutrale Vorlagen schreiben. Regeln: wrapper/surfaces/settings.md.

## operations

App-Anmeldung über die vorhandenen Systemeinstellungen aktivieren. Der lokale
Tresor speichert Appzugänge und Anbieterschlüssel verschlüsselt, mit einem eigenen installationsbezogenen Schutzschlüssel in der Betriebssystem-Schlüsselverwaltung.
Backupziel und Wiederherstellungsschlüssel einrichten, Sicherung ausführen und einen
echten Restore in einer getrennten Installation prüfen. Ein erfolgreicher Healthcheck
allein bestätigt weder Backup noch Login noch Anbieterfunktion. Hostdienst und HTTPS
werden vom Operator eingerichtet. Vollständige Abnahme: OPERATIONS.md und README.md.

## work-evidence

Diese bestehende Oberfläche ist eine Vorschau. Es gibt noch keine dauerhafte
Erfassung oder Abrechnung. Ihr Vertrag dokumentiert den Anschlussbedarf unter
wrapper/surfaces/work-evidence.md. Beispielaktionen dürfen keine Erledigung bestätigen.

## source-privacy

Vor Git-Übernahme den geprüften Quellweg aus CODE-SYNC.md benutzen. Vor Commit
und Push prüfen die Hooks Inhalte und Verträge. Keine lokalen Firmen- oder
Laufzeitdaten stagen. Prüfung über `npm run source:check` und `npm run modules:verify`.

## platform

Für Weiterbau gilt system/MODULES.md. Quellen, erreichbare Endpunkte, Einrichtung,
Statusbedeutung und Funktionsprüfungen werden im selben Auftrag registriert.
Neue Module besitzen ihre eigenen Daten und benutzen dokumentierte Schnittstellen.
Die automatische Prüfung verhindert unregistrierte Dateien und Routen.


Für Schlüsselablage, Neustart und Migration gilt [VAULT.md](VAULT.md).
macOS benötigt einen zugänglichen Schlüsselbund, Linux eine entsperrbare
Secret-Service-Sitzung. Ohne diese Voraussetzung schlägt Speichern sichtbar
fehl; ein Prozessstart allein bestätigt noch keine nutzbare Schlüsselablage.
