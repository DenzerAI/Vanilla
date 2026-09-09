# Arbeitsnachweis

Stand: 09.09.2026. Beauftragte erste Konzeptfassung im Vanilla Agent.

## Zweck

Der Kunde sieht Betreuung an seinem System: wer, wann, über welchen Weg und mit welchem Ergebnis. Der Menüpunkt heißt Arbeitsnachweis. Eine eigene fachliche Ansicht zeigt Menschzeit, Agentlaufzeit, Einsätze und eine kleine modulbezogene Meldungsliste.

## Diese Fassung

Fiktive, ausdrücklich markierte Beispiele, Zeitraumwahl, letzter beispielhafter Zugriff, aufklappbare Einsatzdetails, offene und erledigte Meldungen. Der Schalter für Beispieldaten zeigt auch den leeren Zustand. Meldungen können im Beispiel erledigt und wieder geöffnet werden. Diese Änderungen bleiben nur bis zum Verlassen der Ansicht erhalten. Es wird keine echte Arbeitszeit erfasst, keine Kundendatenbank verändert und keine Nachricht gesendet.

## Messung später

Menschzeit und Agentlaufzeit getrennt zeigen. Sie können sich überschneiden und ergeben keine addierbare Gesamtarbeitszeit. Ein Zugriff, eine offene Verbindung, ein Kalendertermin oder eine Schreibaktion belegt keine geleistete Menschzeit. Automatische Erfassung benötigt später belegte Beginn-/Ende- und Pausenereignisse; bloße Lücken im Ereignisstrom werden nicht zu Arbeitszeit. Unbelegte Dauer bleibt unbekannt. Nachträge und Korrekturen müssen als solche mit Herkunft erkennbar sein. Akteur und Zugangsweg sind verschiedene Angaben. Keine Überwachung der Kundenmitarbeiter, keine Lohnzeiterfassung.

## A2A später

Wir können Einsätze mit Klartext melden und modulbezogene Meldungen abfragen/beantworten. Das Kundensystem kann begrenzte Nachweise für einen Zeitraum anfordern und bei Problemen eine Meldung eröffnen. Diese Befugnisse gelten ausschließlich für das Modul, ohne allgemeinen Zugriff auf unser System. Authentifizierung, Freigaben, Wiederholungen und Aufbewahrung werden erst bei der echten Anbindung konkretisiert. In dieser Fassung bleibt A2A eine klar benannte Planung.

## Replizierbarkeit

Bausteine: wrapper/ui/work-evidence.tsx (Ansicht), work-evidence.css (lokale Struktur über vorhandene Design-Tokens), work-evidence.mjs (isolierte Beispieldaten und Summen/Filter), wrapper/test/work-evidence.test.mjs (Fachprüfungen). Einbau in wrapper/ui/app.jsx über einen Import, Navigationseintrag und Renderzweig. Gemeinsamer PageHeading und native Bedienelemente nutzen das vorhandene UI. Entfernen benötigt diese drei Shell-Anschlüsse und die Moduldateien. Für ein fremdes System müssen Navigation, Design und später Speicher/Authentifizierung angebunden werden; vollständige Abhängigkeitfreiheit wird nicht behauptet. Kein neues Plugin-Framework.

## Gestaltung und Kontrolle

Die verbindliche Vanilla-CI und Bereichsverträge gelten. Eine Überschrift, flache Listen, gemeinsame Schrift-/Farb-/Abstandstokens, umbrechende Bedienelemente, tastaturbedienbare Details und stabile Zahlen. Vorhandenes React und Intl genügen für diese Konzeptfassung; keine zusätzliche Zeiterfassungsbibliothek notwendig.
