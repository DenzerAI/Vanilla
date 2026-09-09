# Verbindliche Arbeit an der Schaltzentrale

Für jede neue oder geänderte Oberfläche gilt der
[verbindliche Designvertrag](DESIGN.md#verbindlicher-designvertrag-für-jede-erweiterung),
auch für importierte Komponenten und Motion-Effekte. Neue Muster werden in das
bestehende System aufgenommen; Dokumentation und Prüfung gehören zum Auftrag.

Vor jeder Änderung an einer Oberfläche:

1. `DESIGN.md` und `surfaces/README.md` lesen.
2. Den Vertrag des betroffenen Bereichs unter `surfaces/` lesen. Er ist die Bauanleitung für Aufbau, Bedienelemente und Erweiterungen. Bei bereichsübergreifenden Änderungen alle betroffenen Verträge lesen.
3. Die dort genannten vorhandenen Komponenten und den aktuellen Code prüfen. Bestehende Muster erweitern; keine parallelen Sonderlösungen hinzufügen.
4. Neue Funktionen an der vorgeschriebenen Stelle einfügen. Wenn der Nutzer einen Ablauf ändert, Vertrag und Umsetzung gemeinsam aktualisieren. Ungefragte neue Strukturen sind keine Erweiterung.
5. Gemeinsame Farben, Typografie und Abstände kommen aus `ui/design-system.mjs`. Gemeinsame Komponenten wiederverwenden. Dienste nutzen `ui/connection-catalog.mjs` und `BrandIcon`.
6. Vor jeder Übernahme `npm run design:verify` im Wrapper ausführen; bei Verstößen nicht übernehmen. Build führt den Scanner ebenfalls zwingend aus. Nach der Umsetzung Build und passende Funktionstests ausführen und die [visuelle Abnahme auf Desktop und Handy](DESIGN.md#fertig-bedeutet-ins-system-integriert-und-geprüft) durchführen. Keine Behauptung „funktioniert“, wenn nur ein Build geprüft wurde. Fehlende Schlüssel oder Hardwaretests konkret benennen.

Zusätzliche verbindliche Regeln:

- Neue externe Anbieter stehen ausschließlich in **Einstellungen → Verbindungen → Weitere Dienste einrichten**, mit Original-Markenasset und Plus. Dasselbe Dialogmuster für Hinzufügen/Bearbeiten; nach Einrichtung unter **Eingerichtet**. Keine eigenständigen Schlüsselblöcke oben auf Übersichtsseiten oder in anderen Einstellungsbereichen.
- Einstellungen bündeln Konfiguration, Skills und Verbindungen. Anbieterzugänge bleiben im Verbindungsbereich; private Schlüssel werden nie als normale Einstellungen gespeichert. Das Hauptmenü enthält Inbox, Aufträge und die verfügbare Bibliothek, gefolgt von Projekten und Chats. Der leere Chat ist der Standardstart; Heute und Kalender bleiben über die Suche erreichbar. Keine Platzhalter für künftige Module.
- Im Chat stehen unmittelbar benötigte Aktionen. Aufnahmearchiv, Anbieterwahl und ausführliche Erklärungen gehören in **Einstellungen → Stimme**.
- Audio darf weder durch Verwerfen noch durch einen Erkennungsfehler gelöscht werden. Die Wiederherstellung ist Teil jeder Änderung an Aufnahme/Speicherung.
- Mikrofon erst auf Benutzeraktion starten. Automodus läuft ausschließlich innerhalb eines vom Nutzer gestarteten Sprachchats. Kein automatischer Wechsel zu einem Cloudanbieter.
- Nutzeranweisungen haben Vorrang; Änderungen an bestehenden Nutzerdaten bleiben außerhalb einer UI-Überarbeitung.

Für wiederkehrende Designarbeit steht der projektbezogene Ablauf unter
`../workspaces/default/skills/ui-design/SKILL.md`. Er verweist auf die obigen
Designquellen und ergänzt keine zweite Palette oder Komponentenbibliothek.
