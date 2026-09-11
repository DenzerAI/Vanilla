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

Die Module github, updates und contributions erweitern die vorhandenen Anschlüsse. Der Kern hält Zustände und Freigaben dauerhaft; technische Prüfungen und ein separat eingerichteter Operator sichern die Übernahme. Modulstatus nennt konkrete Einrichtungsgrenzen. Führend: ../docs/UPDATES.md und ../docs/GITHUB.md.


Die lokale Ladeprüfung ergänzt den vorhandenen Wartungshandler `frontend` und
den additiven Schalter `system.frontend_check`. Sie wartet auf ruhende Arbeit,
liest ausschließlich lokale Auslieferung und verwendet keine Modellaufrufe.
Backup- und Updatepausen behalten ihre unabhängigen Sperren. Die Prüfung wählt
den App-Einstieg index.html ausdrücklich, auch bei zusätzlichem Design-Build.
Bestehende Nutzerdaten und Aufträge bleiben erhalten; vor Rückkehr zu einem
älteren Handlerbestand die Ladeprüfung deaktivieren. Ablauf: docs/OPERATIONS.md.

Die Plattform wartet für ausdrücklich fertige Quellübergaben nicht auf fremde
laufende Chats. Nur Betriebspausen sperren diese Wartung. Live-Aktivierungen
behalten ihr eigenes Neustarttor. Der Quellstatus enthält optional den
Veröffentlichungsstatus; Fehler und bestätigte Live-Stände erscheinen über
die vorhandenen Systemmitteilungen. Einstellungen → System zeigt Arbeitsstände,
Veröffentlichungen und den zuletzt aktivierten Stand als Gruppe Bauaufträge
(wrapper/surfaces/settings.md). Vertrag: docs/CODE-SYNC.md.
