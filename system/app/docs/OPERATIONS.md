> Vanilla-Abweichungen und Abnahmestand: siehe ../README.md. Globale Dienste, Schlüsselbund und Tailscale-Freigaben sind in dieser Distribution deaktiviert.

Programmquellen und technische Befehle in diesem Dokument beziehen sich auf
`system/app/`. Arbeitsdateien und gemeinsame Identität liegen an der
Installationswurzel; deren Pfadvertrag führt [WORKSPACES.md](WORKSPACES.md).

# Betrieb, Memory und Sicherungen

Der Ausbau führt einen gemeinsamen Python-Kern für Zustand, Wartung und Memory
weiter. Es gibt keine Redis-/Celery-Installation und keinen zusätzlichen
Vektorserver. Die vorhandenen Node-Adapter bleiben für ihre Anbieterprotokolle,
Sprachfunktionen und Verbindungen zuständig. Die Oberfläche übernimmt die
vorhandenen Design-Tokens, Settings-Zeilen und Dialoge.

## Einrichtung

Python 3.12+, Node 22.12+ und Git installieren. Im Projekt `npm run setup:system`
ausführen. Der Installer installiert die festgehaltenen Python-/Node-Abhängigkeiten,
den Claude-ACP-Anschluss, das mehrsprachige lokale Embedding-Modell, lokales
Diktat, Piper/Thorsten und restic. Er baut die Oberfläche; globale Dienste
werden dabei nicht aktiviert. Die Sprachpakete und Modellprüfsummen führen
`requirements-speech.lock` und `system/runtime-assets.mjs`.
Modelle und Laufzeiten werden einmal pro Installation gespeichert.

`npm start` öffnet den Kern auf Loopback-Port 1989. Unter **Zugang** einen
Anmeldeschlüssel setzen, anschließend unter **Verbindungen → Tailscale** Serve
aktivieren. Tailscale muss auf Mac und Mobilgerät im selben Tailnet angemeldet
sein. Die Freigabe ist privat; Funnel wird nicht eingerichtet. Vorhandene
Serve-Ziele werden nicht überschrieben. Falls das Konto noch keine HTTPS-Zertifikate
erlaubt, muss die HTTPS-Freigabe im Tailscale-Konto erfolgen.

Unter **Speicher & Sicherung** den Ordner verbinden und eine Sicherung starten.
Der Standard `system/data/backups` liegt außerhalb der laufenden Systemdaten. Ein
externes Laufwerk schützt zusätzlich vor Ausfall der internen Platte. Bestehende
restic-Archive benötigen ihren Schlüssel. Neue Archive erhalten einen zufälligen
Schlüssel im macOS-Schlüsselbund. Den Sicherungsschlüssel für Gerätewechsel
separat sicher verwahren; er wird nicht als Klartextdatei exportiert. In der
Schlüsselbundverwaltung liegt er unter `local.vanilla.control.system-backup`, Konto
`Agent`. Bei Schlüsselwechsel bleibt der bisherige Schlüssel mit einem
`system-backup-…`-Archivnamen erhalten.

## macOS-Dienste und Heartbeat

`core/service.py` ist die versionierte Dienstvorlage und der Installer. Es gibt
keine zweite statische Plist mit abweichenden Pfaden. Der Name
`local.vanilla.agent.<Datenpfad-Hash>` verhindert Kollisionen unterschiedlicher
Installationen. `…heartbeat` ruft `python -m core.heartbeat` alle 60 Sekunden auf.

```sh
.venv/bin/python -m core.service status
.venv/bin/python -m core.service install
# Nur bei bereits gestopptem manuellem Kern aktivieren:
.venv/bin/python -m core.service install --activate
.venv/bin/python -m core.service uninstall
```

Der Dienst startet nach der Benutzeranmeldung, nicht vor FileVault-Entsperrung.
Der Mac muss eingeschaltet und wach sein. Der Installer ändert weder
Bildschirmsperre noch automatische Anmeldung. Das frühere Uptime-Skript verweist
jetzt auf diesen sicheren Installer. Der Kern beaufsichtigt den Adapter; launchd
startet einen beendeten Kern erneut. Bei einer unklaren oder veralteten Meldung
über laufende Arbeit erzwingt der Watchdog keinen Neustart.

Die Minutenprüfung liest den kleinen öffentlichen `/healthz`-Endpunkt und freien
Speicher. Scheduler, Index, Adapter, Lauf-Leases, lokale Suchberechnung,
Backup-Alter und eingerichteter HTTPS-Zugang erscheinen in den Einstellungen.
`system/data/control/heartbeat.json` bleibt auch bei ausgefallener SQLite lesbar.
Zustandswechsel erzeugen Ereignisse; erfolgreiche unveränderte Prüfungen bleiben
still. Hinweise lassen sich ausschalten oder mit Ruhezeiten versehen. Bei
Unterbrechungen muss der Stream zunächst wieder den Adapter erreichen; Browser
synchronisieren Chat und Queue nach einer Wiederverbindung neu.

## Deterministische Aufträge

Alle Aufträge verwenden SQLite-Ausführungs-IDs. Manuell, täglich, werktäglich,
Minutenintervall und Ereignis verwenden denselben Scheduler. Pro Job bleibt
höchstens ein Lauf aktiv. Ereignisse werden bei einem laufenden Job zu einem
noch ausstehenden Auslöser zusammengefasst. `job.finished` ignoriert den eigenen
Abschluss. Zeitpläne verwenden die eingestellte Zeitzone und holen keine lange
Historie nach. Für Ereignisketten fachliche Rückkopplungen vermeiden.

**Python** im bestehenden Auftragsformular auswählen. Die .py-Datei liegt im
Auftragsordner; `examples/python-job.py` zeigt das vollständige Ein-/Ausgabeformat.
JSON kommt über stdin, ein kleines JSON-Ergebnis über stdout. Größere Dateien
gehören in den übergebenen `output`-Ordner. Zeitlimit: 1–3600 Sekunden, je
Ausgabekanal höchstens 1 MiB, gespeichertes Gesamtprotokoll höchstens 1 MiB.
Skripte laufen als eigene Prozessgruppe ohne geerbte API-Schlüssel. Das ist
Prozessisolation, keine Betriebssystem-Sandbox: eigener Python-Code hat die
Dateirechte des angemeldeten Benutzers.

Wiederholungen nach Fehler oder Neustart müssen ausdrücklich als idempotent
markiert sein und sind auf drei Wiederholungen mit Abstand begrenzt. Externe
Worker-Aufträge werden standardmäßig als unterbrochen sichtbar. Ein Queue-Slot
verspricht keine einmalige externe Wirkung. Memory-Pflege, Backup, Index und
Bereinigung sind gemeinsame Systemaufträge; ihre Zeitpläne kommen aus den
versionierten Systemeinstellungen. Ein Backup wartet auf ruhende Aufträge.

## Gemeinsames Memory und Streaming

`core/streaming.py` hält einen Upstream zum Adapter, begrenzte Browser-Puffer und
SQLite-Ereigniscursor. Ein Browserabbruch stoppt weder den Auftrag noch die
Memory-Aufnahme. Fertige öffentliche Gesprächsbeiträge werden über persistierte
Aufnahmemarker nach `memory/daily/<Datum>/<Chat>.md` übernommen. Private
Modellüberlegungen und Tool-Ausgaben werden nicht als Memory aufgenommen.
Erkennbare Zugangsdaten werden entfernt; dies ist keine vollständige
Anonymisierung beliebiger personenbezogener Daten.

Dreaming arbeitet in dieser Ausbaustufe **lokal und extraktiv**: Quellen ordnen,
identische Auszüge zusammenführen, die neuesten Ergebnisse verlinken und einen
Pflegebeleg schreiben. Es entstehen `memory/MEMORY.md`,
`memory/memory/Ergebnisse.md` und `memory/dreams/<Datum>.md` im jeweiligen Projekt.
Widersprechende Quellen bleiben als getrennte Auszüge erhalten. Ein Auszug wird
nicht als geprüfte Tatsache oder als Unternehmensregel ausgegeben. Automatische
Pflege überschreibt keine manuelle Bearbeitung; Konflikte sind im Ereignisprotokoll
sichtbar. Das ist keine freie semantische Reflexion durch ein generatives Modell.
Ein vorhandener Worker kann dieselben Notizen später über den gemeinsamen
Anschluss kuratieren.

Das Chatmenü erstellt auf Wunsch eine kompakte **Fortsetzungsnotiz** aus den
letzten abgeschlossenen Beiträgen unter `memory/continuations`. Das Original und
die native Worker-Sitzung bleiben erhalten. Ein Wechsel des Anbieters kann diese
Notiz verwenden, übernimmt jedoch keine fremde native Sitzung.

Der Router verwendet die tatsächlich gefundene Passage, aktuelle Dateiversion,
Projektgrenzen und ein einstellbares Zeichenbudget. `knowledge/shared` aus Allgemein
wird nur nach ausdrücklicher Freigabe in andere Projekte einbezogen. Volltext,
RapidFuzz und lokale Vektoren ergänzen sich; Vektoren werden platzsparend als
Float32 gespeichert. Exakte SQL-Abfragen bleiben davon unabhängig.

Codex, Hermes und Claude Code erhalten dieselben vier MCP-Werkzeuge:
`memory_search`, `memory_context`, `memory_read`, `memory_write`.
OpenClaw lehnt laut eigener ACP-Dokumentation MCP-Server pro Sitzung ab. Beim
Verbinden wird deshalb sein eigener MCP-Eintrag `agent_shared_memory` über die
OpenClaw-CLI eingerichtet und geprüft. Eine fremde Konfiguration unter diesem
Namen wird nicht überschrieben. Die gemeinsame Kontextaufbereitung bleibt für
alle Worker identisch.
Der neue Claude-Code-Anschluss nutzt den fest installierten offiziellen
`@agentclientprotocol/claude-agent-acp`-Adapter. Eine funktionierende ACP-Verbindung
ersetzt keine Anmeldung beim jeweiligen Modellanbieter. Extern gestartete Worker
bekommen die Konfiguration über **Memory → Konfiguration kopieren**. Geheimnisse
stehen nicht in dieser Konfiguration; der lokale Prozess verwendet den bestehenden
Schlüsselbund bzw. das interne Dienstgeheimnis. Projekt-ID und Versionshash sind
Teil der Werkzeugaufrufe. Gefundene Inhalte bleiben untrusted data.

„Aus Memory entfernen“ löscht aktive Ableitungen und sperrt die erneute Aufnahme.
Manuell geänderte betroffene Ableitungen bleiben als Dateien erhalten und werden
aus dem Suchindex ausgeblendet. Der Originalchat und frühere lokale Git-/Backup-
Versionen bleiben verfügbar; das UI benennt diese Grenze vor der Aktion.

## Versionierung, Sicherung und Restore

| Ablage | Inhalt / Lebenszyklus |
| --- | --- |
| `core/settings.py` | Einzige öffentliche Standards und validiertes Konfigurationsschema |
| SQLite `records`, Schlüssel `system/settings` | Versionierte Einstellungen mit Konfliktprüfung |
| Workspace `knowledge/`, `memory/` | Menschenlesbare Quellen, Auszüge, Pflegebelege |
| `system/data/control/vault.git` | Eigene lokale Notizversionen; kein automatischer GitHub-Push |
| `system/data/control/agent.sqlite3` | Schema 2, Chats, Queue, Memory-Quellen, Suchindex |
| `system/data/control/models/`, `bin/` | Einmalige Modelle und geprüftes Backup-Programm |
| `system/data/control/logs/`, `job-logs/` | Begrenzte bzw. zeitlich aufbewahrte Protokolle |
| `system/data/control/restores/` | Geprüfte Restore-Vorbereitung; alte Staging-Kopien werden bereinigt |
| Konfigurierter Backup-Ordner | Verschlüsselte, deduplizierte restic-Snapshots |

Eine Sicherung erzeugt über die SQLite-Backup-API eine abgeschlossene DB-Datei
und erfasst dazu Dateien mit Schreibkoordination und Prüfsummen. Modelle,
virtuelle Umgebungen, Node-Pakete, Vektoren und Cache werden nicht pro Snapshot
mitgesichert. Workspace, Notiz-Git und lokale Codex-Sitzungen werden mitgesichert.
Native Zustände anderer Anbieter außerhalb dieser Installation bleiben beim
Anbieter. Schlüsselbund-Geheimnisse sind ausdrücklich nicht im Datenbackup.

Aufbewahrung: zunächst sieben tägliche, vier wöchentliche und drei monatliche
Stände. Restic prüft nach dem Backup Struktur und einen Datenanteil. Die
Wiederherstellungsprüfung entpackt einen konkreten Stand und prüft alle
Manifest-Dateien sowie SQLite. Erst „Stand übernehmen“ ersetzt bei gestoppten
Diensten Datenbank und Workspace. Ein dauerhaftes Journal ermöglicht Rollback
nach einem Abbruch. Der vorherige Stand bleibt in `.agent-restore-…`-Ordnern neben
den ersetzten Ablagen erhalten; ihre Pfade stehen in `restore-last.json`.
Diese Sicherheitskopien werden nicht automatisch gelöscht.

Technische Logs, abgelaufene Browser-Sitzungen und alte Ereignis-/Ausführungsdetails
werden nach einstellbarer Frist bereinigt. Slot-Belege bleiben erhalten, damit
Bereinigung keine erneute Ausführung alter Zeitpunkte verursacht. Dauerhafte
Notizen und ihre Git-Historie werden nicht allein wegen ihres Alters gelöscht.
Bei großem Bestand bleibt eine bewusste Archivierung sinnvoll.

## Quellen und bewusste Grenzen

- [OpenClaw Memory](https://docs.openclaw.ai/concepts/memory) und
  [Heartbeat](https://docs.openclaw.ai/gateway/heartbeat): lesbare Quellen,
  geregelte Pflege und stille Zustandsprüfung. Kein kopierter OpenClaw-Gateway.
- [Claude ACP](https://github.com/agentclientprotocol/claude-agent-acp): vorhandenes
  Anbieterprotokoll statt eines zweiten selbst geschriebenen Claude-Clients.
- [MCP stdio](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports):
  ein lokaler Standardanschluss für sämtliche Memory-Werkzeuge.
- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) und
  [restic Aufbewahrung](https://restic.readthedocs.io/en/stable/060_forget.html).
- Die oft als „Karpathy CLAUDE.md“ bezeichnete
  [Vorlage von Forrest Chang](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md)
  ist eine Community-Vorlage, nicht als Originaldatei von Karpathy belegt.
  Übernommen wird das gewünschte Prinzip: klare Verantwortlichkeiten, vorhandene
  Protokolle weiterverwenden, kleine Module und überprüfbare Ergebnisse.

Mobile Nutzung bleibt eine responsive Web-App mit privatem HTTPS; der Mac führt
Jobs und Modelle aus. Offline-Synchronisation, Mehrbenutzerrechte, ein generativer
lokaler Agent und Start vor FileVault-Anmeldung sind kein Teil dieser Stufe.
WebSockets sind für das bestehende Server-Streaming nicht erforderlich. Für eine
vollständig netzfreie Neuinstallation müssen Modell- und Laufzeitarchive separat
bereitgehalten werden; das bereinigte Git-Repository enthält keine Modellgewichte.
