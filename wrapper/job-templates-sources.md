# Auftragsvorlagen · Herkunft

Stand: 7. September 2026. Der Katalog enthält alle 16 Einträge des geprüften
lokalen Hermes-Katalogs sowie ein verallgemeinertes Interviewbeispiel.

- [Offizieller Katalog](https://hermes-agent.nousresearch.com/docs/reference/automation-blueprints-catalog)
- [Geprüfter Quellstand](https://github.com/NousResearch/hermes-agent/blob/089bb32886c8c18f7fa20182c7bf8826d6935ac5/cron/blueprint_catalog.py)
- Lokale Quelle: `hermes-agent/cron/blueprint_catalog.py (Upstream, nicht lokal angebunden)`.
- Interview: aus `jobs/interview/gespraechsanweisung.md` dieses Projekts abgeleitet;
  ohne Personenidentität, Firmenannahmen, Telegram-Ziel oder Versandfreigaben.
- Lizenz: [MIT · Copyright (c) 2025 Nous Research](HERMES-LICENSE.txt).

Die Texte sind deutsche Adaptionen für den Ordnervertrag dieser Schaltzentrale,
keine identischen Hermes-Läufe. Hermes-Skills und Anschlüsse werden nicht als
vorhanden vorausgesetzt. Echte Aufträge liegen unter `workspaces/default/jobs/`
beziehungsweise im konfigurierten Workspace. Vorlagen liegen im Code und werden
erst beim Speichern zu einem Auftrag.

## Kategorien

| Kategorie | Vorlagen |
| --- | --- |
| Gespräche & Wissen | Interview · Betrieb kennenlernen (lokale Ergänzung) |
| Tagesplanung | Morgenbriefing; Arbeitsstart; Feierabend |
| Kommunikation | Wichtige E-Mails prüfen |
| Recherche & Markt | Themenbriefing; Wettbewerber beobachten; Preis & Verfügbarkeit |
| Organisation | Wochenrückblick & Planung; Eigene Erinnerung; Zahlungen & Verlängerungen; Wochenmenü & Einkaufsliste |
| Lernen & Wohlbefinden | Gewohnheit; Trinken & Bewegung; Täglicher Lernimpuls; Tagesreflexion; Wissenshäppchen |

## Anpassungen an die Laufzeit

Der Wrapper unterstützt manuell, täglich oder Montag bis Freitag mit einer
lokalen Uhrzeit. Hermes-Intervalle, einzelne Wochentage und Stundenfenster
werden ausdrücklich als manuelle Vorlagen übernommen. Alle ursprünglichen
Taktvorschläge bleiben lesbar. Es gibt weder automatische Aktivierung noch
externen Nachrichtenversand. Die Schweigemarke `[SILENT]` wird nicht als
Wrapper-Funktion behauptet; Prüfaufträge speichern einen kurzen lokalen Status.
Antworten für das Interview kommen in `input/antworten.md`; der Auftrag besitzt
keinen automatisch angehängten Telegram-Gesprächskontext.

Die Beispieldateien sind ausdrücklich fiktiv. Musterergebnisse stehen in input/
und sind keine ausgeführten Läufe. Die Anlage nutzt `Storage.saveJob`, überspringt
bestehende IDs und berührt keine Hermes-Cronkonfiguration.
