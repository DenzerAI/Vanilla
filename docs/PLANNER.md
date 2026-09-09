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

Noch offen: Kalender-Schreibaktionen und Einladungen, weitere Anbieter und Delta statt vollständigem Fensterabgleich, Wetterquelle/Ortswahl, fachlich typisierte
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
