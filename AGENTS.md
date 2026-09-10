# Einstieg für Worker dieses Projekts

Relative Pfade in dieser Datei beziehen sich auf diesen Projektordner, nicht
auf das aktuelle Arbeitsverzeichnis. Verwende den übergebenen Arbeitsbereich
beziehungsweise `UWE_WORKSPACE`; ohne Angabe gilt
[workspaces/default/AGENTS.md](workspaces/default/AGENTS.md). Lies dessen
`AGENTS.md` und `soul/IDENTITY.md` vor Arbeitsbeginn, sofern nicht frisch übergeben.
Ein konfigurierter, aber fehlender Einstieg ist eine konkret zu meldende Lücke;
nicht still auf einen anderen Arbeitsbereich oder eine andere Basis ausweichen.

Die gemeinsame fachliche Basis liegt in firmenbasis/. Lies bei jedem Auftrag
firmenbasis/AGENTS.md, dann firmenbasis/FIRMA.md, sofern nicht bereits frisch
übergeben, und wähle anhand der Landkarte
die passende Arbeitsweise. Lies ihre vollständige SKILL.md nur bei Verwendung.
Bei gesetztem COMPANY_BASE verwende stattdessen diesen ausdrücklich
konfigurierten Ordner. Ausgabedateien bleiben im Arbeitsbereich des Auftrags.
Bestehende Identitäts- und technische Projektregeln bleiben gültig.

`firmenbasis/` ist lokaler Inhalt und wird niemals versioniert. Die neutralen
Einrichtungsvorlagen liegen unter `templates/firmenbasis/`; sie sind keine
aktive Firmenbasis. Ein neuer Clone richtet seine lokale Basis mit
`npm run source:setup` ein. Vor Übernahme fremden Codes gilt
[docs/CODE-SYNC.md](docs/CODE-SYNC.md). Firmenwissen, Arbeitsweisen, Chats,
Identität und Zugänge niemals in Code, Dokumentation oder Beispiele kopieren.

Der gemeinsame technische Einstieg liegt in system/AGENTS.md und
system/WORKER.md. Bei gesetztem SYSTEM_BASE gilt dieser konfigurierte Ordner.
Er beschreibt Arbeitsbereiche und Rückmeldungen unabhängig vom Worker.
Die Startprüfung in `system/WORKER.md` gilt auch nach Kontextverlust und beim
Projektwechsel: tatsächlichen Zielordner und geladene Herkunftsdateien prüfen.

## Zuständige Quellen bei Bedarf

- [UPDATE.md](UPDATE.md): führender Einstieg bei „Update“ mit Repository-Link,
  auch für ältere Installationen und eigene Firmenrepositories. Vor der Übernahme
  vollständig lesen. Der Abschnitt zur Weiterentwicklung gilt bei jeder Änderung
  und Veröffentlichung: Modul-/Migrationsverträge pflegen und einen gepushten Stand
  erst nach erfolgreichen Prüfungen als updatebereit melden. Den festen Link erhalten.

- [docs/CONTEXT.md](docs/CONTEXT.md): führende Dateien, Kontextübergabe,
  Jobdefinitionen und Abgrenzung von Verlauf und verbindlichen Quellen.
- [README.md](README.md): lokale Distribution, Abweichungen und Abnahmestand;
  vor Aussagen über verfügbare Infrastruktur lesen.
- [docs/CORE.md](docs/CORE.md) und [docs/OPERATIONS.md](docs/OPERATIONS.md):
  Architektur, Betrieb und Prüfwege; lokale Abweichungen aus README.md beachten.

Diese Übersicht verweist auf die führenden Quellen; Regeln und Betriebsdaten
werden dort gepflegt, nicht hier ein zweites Mal.

## Design der Schaltzentrale

Bei jeder neuen oder geänderten App-Oberfläche zuerst [wrapper/AGENTS.md](wrapper/AGENTS.md),
[wrapper/DESIGN.md](wrapper/DESIGN.md) und den passenden Bereichsvertrag lesen.
Das gilt auch für neue Komponenten, importierte Vorlagen und Animationen.
Bestehende Bausteine und Tokens verwenden; neue Muster mit Umsetzung und
Prüfung in die führenden Designregeln aufnehmen.


Bei Updates zwischen Installationen gilt zusätzlich [docs/UI-UPDATES.md](docs/UI-UPDATES.md).
Der UI-Bauplan ist Teil des Updates. Neue gemeinsame Gestaltung und Bedienung
in vorhandene Module integrieren; eigene Funktionen und Daten erhalten.
Quellstand, gebauter UI-Stand und tatsächlich geladene Oberfläche getrennt prüfen.
