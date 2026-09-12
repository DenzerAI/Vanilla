# Heute: gemeinsamer Tageskontext

## Implementiert

Heute/Kalender ist eine integrierte bedienbare Oberfläche mit isolierten Beispielen.
Echte CRM-Folgeschritte kommen aus `/api/crm/query`, Detailaktualisierung aus
`/api/crm/entities/{entity_id}`. Bestehende Benachrichtigungen und Agentenfragen
werden eingebunden; deren APIs und Dialoge bleiben führend. Keine zweite
Benachrichtigungsablage. Das CRM bleibt führend; Kalenderfenster liegen als lokale Projektion in derselben SQLite-Datenbank. Der UI-Vertrag
steht unter `wrapper/surfaces/today.md`, Fähigkeiten unter `system/capabilities.mjs`.

Die Beispielansicht beschreibt Termin → Kontakt → Anlass und eine explizite
Terminänderung nach neuer Nachricht. Sie verwendet ausschließlich flüchtigen
React-Zustand; keine CRM-/Kalenderschreibanfrage, kein Import und keine Migration dieser Daten. Das ausdrückliche Öffnen eines Beispielbriefings speichert dessen gekennzeichneten Text in einem normalen Gespräch.
Nur Ansichtspräferenzen werden lokal im Browser gespeichert.

## Microsoft-Kalender: implementierter Leseweg

`GET /api/calendar/events` liefert Termine und Feedstatus für `projectId`, `start`
und `end` (exklusiv). `POST /api/calendar/sync` benötigt zusätzlich die ID eines
Microsoft-Serviceanschlusses im selben Projekt. MCP: `calendar_list`, `calendar_sync`.
Der bestehende Verbindungsdialog Kalender richtet diesen Anschluss ein; der
Mail-OAuth-Zugang erteilt keine Kalenderrechte.

Der Adapter liest `calendarView` mit expliziten Zeitzonen-Grenzen und vollständiger
Paginierung. Damit kommen auch Vorkommen und Ausnahmen von Wiederholungsserien an.
Folgeseiten müssen denselben Graph-Host und Postfachpfad behalten. 40 Seiten,
10.000 Vorkommen und 93 Tage sind feste Grenzen; ein unvollständiger Abruf ersetzt
keinen bisherigen Stand. Nach vollständigem Abruf wird das gesamte Fenster atomar
ausgetauscht. Dadurch verschwinden gelöschte, abgesagte oder aus dem Fenster
verschobene Termine. Pro Verbindung ist ein Fenster gespeichert. Mehrtägige
Termine werden pro sichtbarem Tag dargestellt, mit stabiler Anbieter-ID und Revision.

Der Kern aktualisiert konfigurierte Microsoft-Anschlüsse alle fünf Minuten.
Monatswahl fordert den sichtbaren Zeitraum samt Randtagen an. Fehlgeschlagene
Abrufe behalten alte Daten und melden Fehler; fehlende Abdeckung und über zehn
Minuten alter Stand werden in der vorhandenen Statuszeile benannt. Neue Kunden
sehen keine Beispiele, können die vorhandene Beispielansicht ausdrücklich wählen.

Zeitpunkte kommen in UTC und werden in der Systemzeitzone dargestellt. Ganztägige
Grenzen werden daraus als Kalendertage behandelt, Ende exklusiv. Bei Einrichtung
Systemzeitzone und gewünschte Postfachzeitzone abstimmen; abweichende mehrzonige
Ganztagskalender sind mit echten Anbieterereignissen gesondert abzunehmen.
Bearbeiten und Einladungen erfolgen im Anbieter-Kalender. Der vorhandene
Beispiel-Bearbeitungsbutton ist bei echten Terminen deaktiviert.

Anbieterreferenzen: [calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0),
[Ereignis und Zeitzonen](https://learn.microsoft.com/en-us/graph/api/event-get?view=graph-rest-1.0).

## Anschlussvertrag für weitere Produktionsschritte

Die folgenden ergänzenden Felder und Schreibfähigkeiten sind Zielvertrag;
der oben beschriebene Leseweg ist implementiert. Bestehende CRM-, Routine- und Verbindungsquellen werden erweitert.
Jeder Feed meldet unabhängig: nicht eingerichtet, lädt, aktuell, veraltet, Fehler;
Quellzeit, Empfangszeit, letzte erfolgreiche Synchronisierung und Abdeckungszeitraum.
Ein eingerichteter Zugang beweist keinen Abgleich. Fehlende Daten sind nicht gleich
„keine Termine“ oder „alles erledigt“.

- Termin: interne ID, Verbindung/Kalender/externe Objekt-ID, Titel, Beginn/Ende
  als Zeitpunkte mit IANA-Zeitzone; ganztägig als lokale Datumsgrenzen mit exklusivem
  Ende; Status, Ort, Teilnehmer-Referenzen, Kontakt-/Projekt-/Vorgangsreferenzen,
  Quellsignal, Quellrevision, geänderte/empfangene Zeit. Wiederholungsserie und
  einzelne Ausnahme erhalten getrennte Identitäten. Keine Datumsberechnung durch
  feste 24-Stunden-Schritte. Änderungen mit Versionsprüfung und explizitem
  Schreibrecht, Versand/Teilnehmereinladung als eigene Wirkung.
- Kontakt: vorhandene CRM-ID; externe IDs bleiben am Verbindungsanschluss.
  Mailadresse/Telefon nur Kandidatenmerkmale, keine stillen Namenszusammenführungen.
- Inbox-Hinweis: Referenz auf Originalnachricht, betroffene Entität/Felder,
  vorgeschlagene Änderung, Status und Entscheidung. Erst danach Faktenänderung
  gemäß `docs/CRM.md`. Kalenderänderungen brauchen ihren eigenen validierten Weg.
- Briefing: bestehender Routinelauf und Ergebnisreferenz, fachlicher Typ
  `morning_briefing`, Datum/Zeitzone, Erstellungszeit und verwendete Quellrevisionen.
  Kein Erkennen durch bloßes Titelwort. Spätere Änderungen als neue Hinweise,
  nicht durch Umschreiben des alten Berichts.
- Wetter: ausdrücklich gewählter Ort oder freigegebener Standort, Quelle,
  Beobachtungs-/Vorhersagezeit, Abrufzeit und Ablaufzeit. Keine permanente
  Standorterfassung als Voraussetzung für Heute.
- Braucht dich: vorhandene Fragen/Benachrichtigungen, künftig Inbox-Triage und
  CRM-Änderungsprüfung, dedupliziert über stabile Quellreferenzen. Erledigen oder
  Lesen nutzt den jeweils zuständigen bestehenden Schreibweg.

Jede Verbindung deklariert unterstützte Objekte und Rechte: lesen, erstellen,
ändern, absagen, Wiederholungen, Delta/Webhook, Löschsignale und Zeitzonen.
Nicht unterstützte Fähigkeiten bleiben sichtbar nicht verfügbar. Anbieterzugänge
stehen ausschließlich unter Einstellungen → Verbindungen, Geheimnisse im Tresor.
Microsoft ist ein vorgesehener Anschluss; sein vorhandener CRM-Kontaktmapper ist
kein Kalender-Sync. Google und weitere Quellen folgen demselben internen Vertrag.

## Aktualität und Grenzen

Heute wird beim Öffnen und Aktualisieren aus aktuellen Quellen aufgebaut. Eine
später gelesene neue Nachricht macht relevante alte Aussagen prüfbedürftig.
Unverarbeitete Nachrichten, fehlende Delta-Seiten oder ein ausgefallener Feed
verhindern eine pauschale Zusicherung der Aktualität. Das Lesen eines CRM-Vorgangs
prüft dessen aktuellen Stand, ersetzt aber keine Versionskontrolle bei späteren
Aktionen. Bereits geladener Agentenkontext wird nicht rückwirkend entfernt.

Noch offen: Externe Kalender-Schreibaktionen und Einladungen, weitere Anbieter und Delta statt vollständigem Fensterabgleich, Wetterquelle/Ortswahl, fachlich typisierte
Briefing-Zuordnung (die Liste zeigt aktuell alle abgeschlossenen Routine-Ergebnisse), produktive Kontakte-/Entscheidungsmasken, vollständige
serverseitige Fälligkeitsabfrage statt begrenzter CRM-Leseseite. Die Inbox liefert echte Outlook-/Gmail-Nachrichten; ihre Quellenübergabe an CRM und Routinen führt MAIL.md.

## Berichtsliste und Fortsetzung

`GET /api/planner/results` liefert die letzten fünf abgeschlossenen Ergebnisse aus
der vorhandenen Benachrichtigungsablage. `POST /api/planner/chat` liest das Ergebnis
serverseitig anhand seiner ID und erstellt oder öffnet seinen Gesprächskontext.
Es akzeptiert keinen Berichtstext vom Browser. Beispiele werden aus dem gemeinsamen
fiktiven Katalog aufgelöst. Snapshot und Kontext verwenden `chat-handoff.mjs`;
Berichts-ID und Chatzuordnung liegen im bestehenden Chatbestand. Gleichzeitige
Öffnungen werden zusammengefasst. Die Berichtsliste ist keine zweite Ergebnisablage.

Beim Entfernen oder Umhängen des Serviceanschlusses bleiben bereits empfangene
Termine als historische Projektion erhalten und werden ausdrücklich als nicht mehr
verbunden gekennzeichnet. Führend ist die vorhandene gemeinsame Verbindungsablage
`control/state.json`; die Kalenderprojektion erzeugt keine zweite Kontoverwaltung.

## Eigener Kalender und gemeinsamer Tageschat

Version 2 erweitert den bestehenden Kalender um eigene Einzeltermine. Ohne einen
externen Anbieter ist der lokale Vanilla-Kalender nutzbar. Termin hinzufügen und
Termin bearbeiten verwenden denselben Dialog wie die markierte Beispielansicht;
Beispiele schreiben weiterhin nichts. Löschen verlangt einen bewussten Klick und
Bestätigung. Datums-/Zeitfehler, uneindeutige Zeitumstellung, Speicherfehler und
Versionskonflikte halten den Entwurf offen. Änderungen gelten nur im gewählten
Arbeitsbereich; UUID und Revision verhindern Fremdquellenänderungen und veraltetes
Überschreiben. Löschmarkierungen verhindern verspätete Neuerstellung durch Retries.
Ganztägige Termine bleiben Kalenderdaten, keine impliziten Arbeitsblockaden.

calendar_local wird additiv und idempotent in der vorhandenen Datenbank angelegt.
Die bestehende Datenbanksicherung umfasst eigene Termine, Revisionen und
Löschmarkierungen. Kein Import oder Zurücksetzen von Profilen/Verbindungen.
Zurückrollen auf Version 1 bewahrt diese Tabelle, blendet ihre Termine aber aus.
Externe calendar_windows und ihre Abgleichsregeln bleiben erhalten. Getrennte
Quellkennungen sind die Grundlage weiterer Anbieter; gleiche Titel werden nicht
blind zusammengeführt. Synchronisierte Termine bleiben beim Anbieter bearbeitbar.
Keine Synchronisierung in beide Richtungen, keine Einladungen und noch keine
lokalen Terminserien. Trennen externer Anschlüsse löscht keine Vanilla-Termine.

GET /api/calendar/day liefert heutigen Tag und Ortszeit der Installation samt
Quellenstatus. POST /api/calendar/local/save und /delete ändern ausschließlich
eigene Termine. Der interne Tagesleseanschluss dient POST /api/calendar/chat:
ein expliziter Klick erzeugt eine neue Berichtssession im aktuellen Workspace.
Wiederholungen derselben requestId öffnen denselben Bericht und senden die kurze
Einordnung höchstens einmal. Daten werden serverseitig gelesen; Browsertexte sind
keine Berichtsquelle. Fehler beim Lesen erzeugen keine leere Session. Bei einem
Fehler des Workers bleibt der gespeicherte Datenbericht erreichbar.

Ein Tagesbericht nennt Termine, Herkunft, Stand und Zeitzone. Verbleibende Lücken
werden innerhalb des ausgewiesenen Betrachtungsfensters 08–18 Uhr gezeigt, ab
jetzt und ab 15 Minuten. Überlappende Termine werden vor Berechnung vereinigt.
Das Fenster ist keine persönliche Arbeitszeit. Fehlerhafte, nicht abgeglichene,
veraltete oder unvollständige externe Quellen sowie ganztägige Einträge verhindern
pauschale Freizeitaussagen. Vorbereitung nutzt nur passende belegte Angaben; keine
erfundenen Wegezeiten, Aufgaben oder Teilnehmer. Kalender öffnen führt im gleichen
App-Bereich zur vorhandenen Übersicht; der aktuelle Entwurf bleibt erhalten.

Datum und Uhrzeiten der produktiven Kalenderansicht folgen der Installationszeitzone; die Zeitzone steht auch im lokalen Termindialog. Ein anderer Browserstandort ändert keine gespeicherten Terminzeiten.

Die Tageskachel zeigt nur den nächsten heutigen Termin; weitere Termine bleiben im
Tagesbericht. Bei terminfreien Tagen erscheint nur der Leerhinweis gedämpft;
Wochentag und Tageszahl behalten ihre Farben. Unvollständige
oder veraltete Quellen tragen den Hinweis „Termine möglicherweise nicht aktuell“
und werden nicht als terminfreier Tag dargestellt.


## Kalenderansichten, Version 3

Der vorhandene lokale und externe Terminbestand speist Monatsraster, Wochen- und
Tagesstundenraster über PlannerCalendar. Datumsnavigation, Ansichtspräferenzen,
Zeitzone und bestehende Schreibdialoge bleiben erhalten. Terminpositionierung
verwendet minutengenaue Ortszeiten und separate Spalten für Überschneidungen.
Freie Stunden öffnen einen Entwurf; gespeichert wird ausschließlich über den
bestehenden bestätigten Dialog. Es entstehen weder neue Tabellen noch neue
Kalender-Schreibrechte. Rückkehr zeigt denselben Bestand in der älteren Listenansicht.
Mobil: Monatsraster plus Tagesagenda, Wochenköpfe plus ausgewähltes Tagesraster.
Gestaltung und Bedienvertrag: wrapper/surfaces/today.md und wrapper/DESIGN.md.


## Kompakte Kalenderbedienung, Version 4

Der Kalender nutzt einen gemeinsamen Zeitraumkopf, links anklickbare ISO-KWs im
Monat, kleine Tageszahlen und kompakte einzeilige Termine. Neue Browser verwenden
Mo–Fr; bestehende bewusst gespeicherte Ansichtswünsche bleiben bestehen. Die
sichtbaren Terminzeilen werden anhand der verfügbaren Rasterhöhe berechnet.
Das 24-Stundenraster enthält 48 anklickbare Halbstundenabschnitte. Entwürfe übernehmen
Stunde und Minute; ab 23 Uhr wird das Ende auf 23:59 begrenzt. Der vorhandene
Speicherdialog, Zeitvalidierung, Datenbestand und externe Leserechte bleiben führend.
Normaler Quellenstand steht im Verknüpfungsdialog, Fehler bleiben in der Ansicht.
Keine Tabellenmigration; Rückkehr erhält Termine und Präferenzen.
