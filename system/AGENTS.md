# Gemeinsamer technischer Einstieg

Lies [WORKER.md](WORKER.md). Dieser Ordner beschreibt die Zusammenarbeit mit
der Schaltzentrale, unabhängig vom verwendeten Worker. Firmenwissen und
fachliche Arbeitsweisen stehen ausschließlich in der konfigurierten Firmenbasis.
Die konkreten Pfade und Fähigkeiten werden bei jedem Auftrag frisch übergeben.

Bei neuen Funktionen oder Anbieteranbindungen zuerst die zentrale
[Funktions- und Anschlusslandkarte](CAPABILITIES.md) verwenden. Ihre ausführbare
Quelle [capabilities.mjs](capabilities.mjs) listet Bereiche, Kataloge,
UI-Anschlüsse und API-Endpunkte. Vorhandene Anschlüsse wiederverwenden und neue
Funktionen dort im selben Auftrag eintragen; Live-Verfügbarkeit separat prüfen.

Die verbindliche Umsetzung steht in [MODULES.md](MODULES.md). Vor Einrichtung
oder Weiterbau mit `system_modules` suchen und mit `system_module` den Bauplan
laden; alternativ `node system/capabilities.mjs` und die dort genannten Dateien.
Neue Quellen und Anschlüsse ohne vollständigen Moduleintrag werden durch
`npm run modules:verify`, die Git-Hooks und CI abgewiesen. Bei Änderungen am
Modul seinen Vertrag im selben Auftrag pflegen. Keine privaten Hostprofile suchen.
