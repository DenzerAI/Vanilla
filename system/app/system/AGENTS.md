# Gemeinsamer technischer Einstieg

Lies [WORKER.md](WORKER.md). Dieser Ordner beschreibt die Zusammenarbeit mit
der Schaltzentrale, unabhängig vom verwendeten Worker. Firmenwissen und
fachliche Arbeitsweisen stehen ausschließlich in der freigegebenen Wissensbereichen unter knowledge/.
Die konkreten Pfade und Fähigkeiten werden bei jedem Auftrag frisch übergeben.

Bei neuen Funktionen oder Anbieteranbindungen zuerst die zentrale
[Funktions- und Anschlusslandkarte](CAPABILITIES.md) verwenden. Ihre ausführbare
Quelle [capabilities.mjs](capabilities.mjs) listet Bereiche, Kataloge,
UI-Anschlüsse und API-Endpunkte. Vorhandene Anschlüsse wiederverwenden und neue
Funktionen dort im selben Auftrag eintragen; Live-Verfügbarkeit separat prüfen.
