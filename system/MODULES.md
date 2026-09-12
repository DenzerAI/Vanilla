# Verbindlicher Modulvertrag

`modules.json` ist die gemeinsame, versionierte Landkarte für Anwender,
Codex CLI, Claude Code und alle weiteren Worker. `capabilities.mjs` ergänzt
die vorhandenen Oberflächenaktionen und Anbieter-Kataloge. Der Kern stellt die
Modulverträge über `GET /api/system/modules`, `GET /api/system/modules/{id}`
und die gemeinsamen MCP-Werkzeuge `system_modules`, `system_module` und `system_module_status` bereit. Letzteres liest die deklarierte Statusquelle ausschließlich aus dem eigenen laufenden Kern.
Ein frischer Worker benötigt dafür keine früheren Chats.

Vor einer Einrichtung: Modul suchen, dessen Bauplan lesen, Statusquelle prüfen,
fehlende Voraussetzungen benennen und den vorhandenen Anschluss verwenden.
Ausbaustand, gespeicherte Konfiguration und erfolgreiche Live-Verbindung sind
drei verschiedene Aussagen. Zugangsdaten werden im Einrichtungsdialog oder in
der eigenen CLI eingegeben, niemals im Katalog, Firmenwissen oder Chat gespeichert.

## Jede Erweiterung

1. Eine bestehende Modul-ID erweitern oder eine neue stabile ID registrieren.
2. Zweck, Ausbaustand, Modulversion, Migrationsregel, Quellen, Abhängigkeiten, Datenhaltung, Einrichtungsweg,
   Grenzen und aussagekräftige Prüfung zusammen mit dem Code pflegen.
3. Alle HTTP-Anschlüsse ausdrücklich eintragen. Einen lesenden Statusanschluss
   mit Bedeutung nennen. Reine Vorschauen ausdrücklich als `preview` führen.
   Für lokale Werkzeuge einen ausführbaren Einstieg angeben.
4. Im betroffenen Vertrag Voraussetzungen, Einrichtung, Bedienung, Fehler,
   Trennen und Daten-/Wiederherstellungsverhalten dokumentieren. Vorhandene
   Anbieter-, Worker-, Service- und UI-Verträge bleiben führend.
5. Daten unter eigenen Modulkennungen halten, Änderungen versionieren und
   Migrationen prüfen. Bestehende Tabellen, Ereignisse und APIs anderer Module
   über deren Schnittstelle nutzen. Keine globale Registrierung beim Import,
   fremden Profile oder undokumentierten Hintergrundprozesse.
6. `npm run modules:verify` und die im Modul genannten Funktionsprüfungen
   ausführen. UI-Änderungen unterliegen zusätzlich den Designregeln.

Der Prüfer kontrolliert Pflichtfelder, Dateien, konkrete Dokumentabschnitte, Verknüpfungen, zyklische
Abhängigkeiten und alle wörtlich deklarierten HTTP-Routen einschließlich
FastAPI-Routern. Neue Quelldateien und neue Routen ohne Modulzuordnung scheitern.
Commit und Quellübernahme prüfen den tatsächlichen Git-Baum. Bei Änderungen
an Modulquellen muss dessen Vertrag, Bauplan oder Moduleintrag im selben Commit
aktualisiert sein. CI wiederholt die Prüfung. Die Prüfung erkennt formale Lücken;
die fachliche Richtigkeit von Prosa und dynamischen externen Werkzeugen benötigt
weiterhin Review und Funktionstest. Ein leeres Gerüst darf nicht als fertig gelten.

## Daten und Installation

Für langfristige Updatefähigkeit und den privaten Code-Rückweg führt zusätzlich
[UPDATES.md](../docs/UPDATES.md) das beschlossene Konzept. Jedes neue Modul muss
mit stabiler ID, versionierter Schnittstelle, eigener Datenzuordnung und prüfbarer
Migration in den gemeinsamen Ablauf passen. Die geplanten Update-/GitHub-Module
erst mit realen Quellen und Prüfungen als verfügbare Fähigkeiten registrieren.

Der Katalog enthält ausschließlich neutrale Quellpfade und Routen. Er enthält
keine absoluten Entwicklerpfade, Zugangsdaten oder Live-Ergebnisse. Die Dateien
reisen mit Git, Kundenkonfiguration bleibt lokal. Ein gescheiterter optionaler
Anschluss lässt andere Module verfügbar. Ein fehlender Modulvertrag wird als
konkreter Fehler gemeldet und nicht aus altem Verlauf erraten.


## Gemeinsame Oberfläche

Die Plattform stellt den gemeinsamen `Skeleton` einschließlich des
Kartenplatzhalters `attention`, den Iconkatalog mit Wrench und die Modellwahl
bereit. Deren Verhalten und Gestaltungsregeln führen wrapper/DESIGN.md und
wrapper/surfaces/chat.md. Die Produktion und Unser Design verwenden dieselben
Bausteine. Die Orts- und Wetteranbindung ist dem eigenen Modul `weather`
zugeordnet; Profilwerte gehören zum Modul `settings`.


Der neutrale UI-Bauplan und die Buildprüfung sind als Modul `ui-blueprint`
registriert. Sie begleiten Designübernahmen in bestehende eigene Module;
Anwendung, UI-Referenz und Designquellen werden gemeinsam gebaut und geprüft.

Schnappschüsse des Verlaufs werden im Browser mit dem gestreamten Stand abgeglichen (`wrapper/ui/thread-update.mjs`): zuerst über die Kennung, dann über den Inhalt, weil gestreamte Elemente Anbieterkennungen tragen und der gespeicherte Verlauf sie umnummeriert. Der sichtbare Verlauf wird beim Senden nie geleert; nur ein vorläufiger Postausgangs-Chat wird gegen seine echte Kennung getauscht.

Aktionsleisten an Nachrichten erscheinen bei Zeigerkontakt oder sichtbarem Tastaturfokus (`:has(:focus-visible)`), nie durch einen bloßen Mausklick; der Kopierknopf gibt den Mausfokus nach dem Kopieren frei, damit die Leiste wieder verschwindet. Zeigerkontakt wird nicht über `:hover` gelesen, sondern von `wrapper/ui/message-hover.mjs` als `data-pointer-hover` an genau der Nachricht unter dem Zeiger gesetzt: Beim Scrollen verschwindet die Leiste sofort, nach dem Ausrollen wird die Nachricht unter dem ruhenden Zeiger neu bestimmt, weil Browser den `:hover`-Zustand beim Scrollen veralten lassen.

Eine Wartungspause (`data/control/updates/maintenance.json`) kann der zugehörige Operator über `POST /internal/maintenance/resume` (Kopfzeile `x-agent-update` mit der Nonce der Pause, Body mit derselben `id`) im laufenden Betrieb beenden: Wrapper-Pause aufheben, Auftragswarteschlange und Suchindex nachholen, Mail- und Kalenderschleifen starten. Damit braucht eine Live-Aktivierung nur einen Neustart. Ohne aktive Pause antwortet die Route mit `resumed: false`.

Der Kern beobachtet die Bau-Kette (`core/stall_watch.py`): Steht ein Bauauftrag oder eine Veröffentlichung länger als 15 Minuten in derselben Phase (Warteschlange, Prüfung, GitHub-Prüfungen, Vorbereitung, Installation), erscheint einmal die Benachrichtigung „Bauauftrag hängt“. Das Warten auf eine Pause des Nutzers vor der Aktivierung gilt nicht als Hänger. Ein begonnener Bauauftrag, der nach 30 Minuten noch nicht mit „ready“ übergeben ist, wird einmal als „Bauauftrag nicht bereitgemeldet“ gemeldet.

Die gemeinsame Bausteinreferenz zeigt Nachrichtenbestätigungen direkt hinter der
Uhrzeit als nicht umbrechende, vertikal zentrierte Gruppe mit 4 px Abstand.
DeliveryChecks verwendet 10 × 10 px für einzelne und 15 × 10 px für doppelte
Haken mit feiner gerundeter Kontur. Keine Datenmigration; Statusbedeutung und
Fehleraktionen bleiben erhalten. Führend: wrapper/surfaces/chat.md.

## Gemeinsamer Entwicklungsstand

Die Chat-Erweiterungen verwenden weiterhin dieselben Kernspeicher, nativen
Worker-Anschlüsse und Nachrichtenübergaben. `firma`, `chat-privacy` und
`statistics` sind mit eigenen Datenverträgen registriert. Rückfragen und
Kontingente ergänzen `workers`, Tastenkürzel `dictation` und `settings`,
Wetterberichte den vorhandenen `weather`-Anschluss. Gemeinsame Darstellung,
Markenassets und Pixeltextur bleiben Plattformbausteine.

Bestehende IDs, Workspace-/Jobordner, Firmenquellen, Anbieterprofile und
Memory-Ablagen werden durch diese Integration nicht umbenannt oder verschoben.
Die einzelnen Module dokumentieren additive Felder und Rückkehrgrenzen.
Insbesondere setzt alter Code die neue Privatsperre nicht durch; eine Rückkehr
darf den Schutz nicht unbemerkt aufheben. Native Rückfragen sind vor einem
Adapterwechsel zu beantworten oder zu stoppen. Der zusätzliche Claude-
Kontrollabruf verwendet dieselbe Installation wie der reguläre Worker.

Das Modul `workspaces` ergänzt die bestehenden Projektkennungen um freiwillige
Spezialisierungen. AGENTS.md führt den Steckbrief und die Arbeitsweise; die
Assistentenidentität und die Firmenbasis bleiben gemeinsam. Der bestehende
Jobpfad erhält unabhängig davon optionale Kategorien. Einrichtung und
Rückkehrregeln stehen im [Workspace-Vertrag](../wrapper/surfaces/workspaces.md).

## Updates, GitHub und Beiträge

Die Produktversion wird zentral in `version.json` gepflegt, aktuell 0.1.0.
Sie ist unabhängig von den ganzzahligen Modul- und Datenformatversionen. Der
Build bindet diese Angabe; der Kern meldet den bei seinem Start geladenen Stand.

Die Module github, updates und contributions erweitern die vorhandenen Anschlüsse. Der Kern hält Zustände und Freigaben dauerhaft; technische Prüfungen und ein separat eingerichteter Operator sichern die Übernahme. Modulstatus nennt konkrete Einrichtungsgrenzen. Führend: ../docs/UPDATES.md und ../docs/GITHUB.md.


Die lokale Ladeprüfung ergänzt den vorhandenen Wartungshandler `frontend` und
den additiven Schalter `system.frontend_check`. Sie wartet auf ruhende Arbeit,
liest ausschließlich lokale Auslieferung und verwendet keine Modellaufrufe.
Backup- und Updatepausen behalten ihre unabhängigen Sperren. Die Prüfung wählt
den App-Einstieg index.html ausdrücklich, auch bei zusätzlichem Design-Build.
Bestehende Nutzerdaten und Aufträge bleiben erhalten; vor Rückkehr zu einem
älteren Handlerbestand die Ladeprüfung deaktivieren. Ablauf: docs/OPERATIONS.md.

Die gemeinsame Bausteinreferenz ergänzt VoiceProfilesPreview aus dem Sprachmodul. Plus, Eingabe, Auswahl und Bearbeiten verwenden denselben Produktionsbaustein mit ausschließlich lokalen Beispieldaten; echte Stimmenprofile und Schlüssel werden dadurch nicht verändert. Bedienvertrag: wrapper/surfaces/settings.md, Datenvertrag: wrapper/VOICE.md.

Die gemeinsame Zugangsverwaltung speichert Werte in der lokalen .env und SQLite-Referenzen. Neue Installationen benötigen keinen OS-Schlüsselbund. .env bleibt außerhalb von Quellupdates; Betriebs- und Migrationsvertrag: docs/VAULT.md. Gemeinsame Einstellungsdialoge nennen die tatsächliche lokale Ablage.

Die gemeinsame Bausteinreferenz zeigt Nachrichtenbestätigungen direkt hinter der
Uhrzeit als nicht umbrechende, vertikal zentrierte Gruppe mit 4 px Abstand.
DeliveryChecks verwendet 10 × 10 px für einzelne und 15 × 10 px für doppelte
Haken mit feiner gerundeter Kontur. Keine Datenmigration; Statusbedeutung und
Fehleraktionen bleiben erhalten. Führend: wrapper/surfaces/chat.md.

Die gemeinsame Modellwahl zeigt Engine, Modell und Denkaufwand sofort als
Vormerkung für die nächste Nachricht. Präferenzspeicherung sperrt den Composer
nicht und startet keine Sitzung. Der vorhandene Postausgang übernimmt die
Auswahl nach Abschluss der laufenden Antwort. Daten- und Rückkehrvertrag:
wrapper/surfaces/chat.md, Auswahl für die nächste Nachricht.


Das bestehende library-Modul heißt in der Oberfläche Ergebnisse. Navigation und
Suche behalten ihre technischen IDs. Der Index übernimmt Auftragskategorien und
speichert optional eigene Kategoriezuordnungen; Aufträge und Ergebnisse verwenden
dieselbe Validierung und gegenseitige Detailverweise. Daten-/Rückkehrvertrag:
wrapper/surfaces/library.md. Keine Migration von Dateien, Chats oder Jobmanifesten.


Die gemeinsame Chat-Feinausrichtung verwendet ComposerHeading aus chat-controls.jsx:
ModelPicker rechts oberhalb der unten bündigen Schreibpille, eingerückt auf die
Achse des Sendepfeils. Die Identität bleibt ausschließlich im Seitenleistenkopf.
Antworten verzichten auf wiederholte Autorenzeilen. Der obere Fade ist um 20 %
verkürzt, Sprungmarken stehen mittig am linken Panelrand, Nachrichtenaktionen
bleiben auch unter der globalen Hoverregel ungefüllt und kompakt. Skeleton und
Bausteinreferenz folgen derselben Anordnung. Keine Datenmigration; native
Rückfragen und Antwortwege bleiben unverändert. Vertrag: wrapper/surfaces/chat.md.


Das Agentenmenü liest additive Installationsdaten über /api/status: laufende Produktversion, Startzeit und Laufzeit des Wrappers sowie aktuellen lokalen Commit mit Commitzeit. Die Pushzeit ist ausschließlich der letzte lokal belegte Remote-Reflog-Eintrag „update by push“; fehlende oder abgelaufene Belege bleiben null. Kein Netzwerkabruf, keine Git-Mutation und keine Datenmigration. Ältere Server werden mit fehlenden Statuswerten dargestellt. Neustart und ThemeToggle teilen die kompakte Abschlusszeile; Archiv bleibt in Einstellungen. Vertrag: wrapper/surfaces/chat.md.


Die Chat-Ablage leitet Uploads, Ergebnisse, Links und neu angelegte Jobs aus dem
aktiven Verlauf ab. BrowserThread erhält für aufgeschobene große Werkzeugbelege
das additive Feld shelfJobs (jobId/name), ausschließlich aus erfolgreichen
strukturierten Erstellbelegen. Keine neue Speicherung, alte Leser ignorieren das
Feld. Aufbau und Grenzen: wrapper/surfaces/chat.md, Veränderbare Breiten und Ablage.
