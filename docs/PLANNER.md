# Heute: gemeinsamer Tageskontext

## Implementiert

Heute/Kalender ist eine integrierte bedienbare Oberfläche mit isolierten Beispielen.
Echte CRM-Folgeschritte kommen aus `/api/crm/query`, Detailaktualisierung aus
`/api/crm/entities/{entity_id}`. Bestehende Benachrichtigungen und Agentenfragen
werden eingebunden; deren APIs und Dialoge bleiben führend. Keine zweite
Benachrichtigungsablage. Keine neue CRM- oder Kalenderdatenbank. Der UI-Vertrag
steht unter `wrapper/surfaces/today.md`, Fähigkeiten unter `system/capabilities.mjs`.

Die Beispielansicht beschreibt Termin → Kontakt → Anlass und eine explizite
Terminänderung nach neuer Nachricht. Sie verwendet ausschließlich flüchtigen
React-Zustand; keine Schreibanfrage, kein Import und keine Migration dieser Daten.
Nur Ansichtspräferenzen werden lokal im Browser gespeichert.

## Anschlussvertrag für den nächsten Produktionsschritt

Die folgenden Felder und Fähigkeiten sind Zielvertrag, noch keine implementierte
Kalender-API. Bestehende CRM-, Routine- und Verbindungsquellen werden erweitert.
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

Noch offen: dauerhafte Kalendertermine/API, Anbieter-Sync mit Paging/Delta/Löschungen,
Wiederholungen und Einladungen, Wetterquelle/Ortswahl, fachlich typisierte
Briefing-Zuordnung, produktive Kontakte-/Entscheidungsmasken, vollständige
serverseitige Fälligkeitsabfrage statt begrenzter CRM-Leseseite. Die vorhandene
Inbox bleibt eine separate Designstudie und liefert noch keine echten Nachrichten.
