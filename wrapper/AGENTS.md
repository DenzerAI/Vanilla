# Verbindliche Arbeit an der Schaltzentrale

Vor jeder Änderung an einer Oberfläche:

1. `DESIGN.md` und `surfaces/README.md` lesen.
2. Den Vertrag des betroffenen Bereichs unter `surfaces/` lesen. Er ist die Bauanleitung für Aufbau, Bedienelemente und Erweiterungen. Bei bereichsübergreifenden Änderungen alle betroffenen Verträge lesen.
3. Die dort genannten vorhandenen Komponenten und den aktuellen Code prüfen. Bestehende Muster erweitern; keine parallelen Sonderlösungen hinzufügen.
4. Neue Funktionen an der vorgeschriebenen Stelle einfügen. Wenn der Nutzer einen Ablauf ändert, Vertrag und Umsetzung gemeinsam aktualisieren. Ungefragte neue Strukturen sind keine Erweiterung.
5. Gemeinsame Farben, Typografie und Abstände kommen aus `ui/design-system.mjs`. Gemeinsame Komponenten wiederverwenden. Dienste nutzen `ui/connection-catalog.mjs` und `BrandIcon`.
6. Nach der Umsetzung Build und passende Funktionstests ausführen; betroffene Oberfläche bei Desktop- und schmaler Breite prüfen. Keine Behauptung „funktioniert“, wenn nur ein Build geprüft wurde. Fehlende Schlüssel oder Hardwaretests konkret benennen.

Zusätzliche verbindliche Regeln:

- Neue externe Anbieter stehen ausschließlich in **Verbindungen → Weitere Dienste einrichten**, mit Original-Markenasset und Plus. Dasselbe Dialogmuster für Hinzufügen/Bearbeiten; nach Einrichtung unter **Eingerichtet**. Keine eigenständigen Schlüsselblöcke oben auf Übersichtsseiten oder in Einstellungen.
- Einstellungen konfigurieren bereits verfügbare Funktionen. Anbieterzugänge gehören in Verbindungen; private Schlüssel werden nie als normale Einstellungen gespeichert.
- Im Chat stehen unmittelbar benötigte Aktionen. Aufnahmearchiv, Anbieterwahl und ausführliche Erklärungen gehören in **Einstellungen → Stimme**.
- Audio darf weder durch Verwerfen noch durch einen Erkennungsfehler gelöscht werden. Die Wiederherstellung ist Teil jeder Änderung an Aufnahme/Speicherung.
- Mikrofon erst auf Benutzeraktion starten. Automodus läuft ausschließlich innerhalb eines vom Nutzer gestarteten Sprachchats. Kein automatischer Wechsel zu einem Cloudanbieter.
- Nutzeranweisungen haben Vorrang; Änderungen an bestehenden Nutzerdaten bleiben außerhalb einer UI-Überarbeitung.
