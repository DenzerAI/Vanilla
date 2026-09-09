# Heute und Kalender

## Zweck, Navigation und Bestand

Heute bleibt als bestehende Detailansicht über die Suche erreichbar. Ein frischer
Start ohne expliziten Chatlink öffnet den leeren Chat; eingebettete Chats und
Chatlinks öffnen weiterhin ihren Chat. `?view=today` und `?view=calendar` sind Direkteinstiege,
der bisherige Pipeline-Link öffnet Heute. Kalender bleibt eine zweite Sicht
innerhalb desselben Bereichs; kein zusätzlicher Hauptmenüpunkt. Globale Suche
findet beide. Laufende Chats bleiben gemountet.

Ein PageHeading mit Titel und unmittelbaren Aktionen, darunter Heute/Kalender
als gemeinsame Tabs. Horizontaler Touch-Wisch auf freier Fläche wechselt ebenfalls;
Buttons und Formulare bleiben davon ausgenommen. Tabs bleiben immer erreichbar.
Die gemeinsame Navigationsauswahl Heute bleibt im Kalender aktiv.

## Heute

Datum und ISO-Kalenderwoche, optional Wetter mit Ort, danach drei flache Bereiche:
Morgenbriefing, Dein Tag, Braucht dich. Keine Kennzahlenwand, dekorativen Karten
oder zweite Inbox. AgendaRow zeigt Zeit, Titel und Kontext und öffnet den Termin.
Dort führen Kontakt und Anlass zu ihren Details. Die fiktive Kontaktakte zeigt
Firma, Rolle, E-Mail, fehlende Telefonnummer/Adresse und Herkunft. Sie ist keine
zweite CRM-Datenbank.

Das Beispiel zeigt eine Nachricht mit Terminänderung: Rohsignal, vorgeschlagene
Uhrzeit, explizite Bestätigung. Nur die Bestätigung verschiebt den Beispieltermin
und entfernt dessen offenen Hinweis. Das datierte Morgenbriefing bleibt erhalten;
der aktuelle Tagesplan und der Änderungshinweis entwickeln sich weiter.

Echte fällige/überfällige CRM-Schritte und ungelesene Benachrichtigungen bleiben
auch im Beispielmodus ausdrücklich als echte Hinweise gekennzeichnet. Offene
Agentenfragen und Benachrichtigungen öffnen die vorhandenen Dialoge, mit deren
bisheriger Freigabe-/Lesestatuslogik. Öffnen von Heute markiert nichts als gelesen.

## Kalender

Tag, Woche, Monat als gemeinsame Tabs. Zeitraum rückwärts/vorwärts, Heute und
natives Datumsfeld. Woche beginnt Montag, KW nach ISO einschließlich Jahreswechsel.
Monat ist eine fortlaufende Liste mit KW-Gruppen und Tagen untereinander.
Nur Mo–Fr blendet Wochenenden in Woche/Monat aus, löscht aber keine Termine.
Ein explizit gewähltes Wochenende bleibt in Tag erreichbar. Ganztägige Termine
stehen zuerst; übrige Termine chronologisch. Monatswechsel klemmen den gewählten
Tag auf das Monatsende. Datumsrechnung erfolgt lokal ohne UTC-Tagesverschiebung.

Desktopwoche hat sieben/fünf Spalten; bei geringerer Breite werden die Tage
untereinander dargestellt. Monatsliste hat eine KW-Spalte und Tages-/Terminzeilen,
auf schmaler Breite ebenfalls vollständig untereinander. Kein horizontales
Pflichtscrollen. Lange Namen/Titel wachsen, native Steuerungen bleiben erreichbar.

## Beispiele, Einstellungen und echte Daten

Erster Einstieg zeigt den ausdrücklich beauftragten, klar markierten Entwurf.
Beispieldaten lassen sich im Verknüpfungsdialog abschalten. Die globale Beispielunterzeile und der bisherige Beispielansicht-Button entfallen. Einzelne fiktive Inhalte bleiben als Beispiel gekennzeichnet. Nur die UI-Präferenzen
Beispielmodus, Kalenderansicht und Mo–Fr werden im Browser gespeichert; keine
Termine, Personen, Quellen oder Nachrichten. Beispielbearbeitungen leben nur,
solange Heute/Kalender geöffnet sind. Beim Wechsel zwischen beiden bleiben sie,
beim Verlassen des Bereichs oder Reload werden sie verworfen. Keine Demo-Migration.

Beispieltermine lassen sich im gemeinsamen Modal anlegen/bearbeiten: Titel, Datum,
ganztägig oder Beginn/Ende, Ort, optionale Kontaktzuordnung. Leerer Titel und Ende
vor/gleich Beginn werden abgewiesen. „Im Beispiel übernehmen“ bezeichnet die
begrenzte Wirkung. Kein Versand, keine stillen CRM- oder Kalender-Schreibaktionen.

Ohne Beispiele zeigt der Kalender einen ehrlichen leeren Anschlusszustand.
„Kalender verbinden“ öffnet den vorhandenen Verbindungsbereich. Standort/Wetter
öffnet den Konzeptstand, fordert keine Berechtigung an und verspricht keine
aktive Wetterquelle. Die Liste „Briefings & Ergebnisse“ liest die letzten fünf abgeschlossenen Routine-Ergebnisse aus der bestehenden Benachrichtigungsablage, unabhängig vom Lesestatus. Es wird kein Berichtstyp aus Titeln geraten. Ohne echte Ergebnisse erscheinen im Beispielmodus vier datierte Beispielbriefings. Der Routinen-Button öffnet die bestehenden Aufträge.

CRM-Schritte werden anhand der vorhandenen Workflowdefinitionen auf offene Zustände
gefiltert und über die bestehenden validierten Lesewege geladen, beim Fokus,
sichtbaren Polling alle 30 Sekunden und bei CRM-Ereignissen aktualisiert. Maximal
100 Vorgänge; weitere werden als Einschränkung benannt. Ungeprüfte Datensätze und
fehlgeschlagene Aktualisierungen tragen „Stand prüfen“. Öffnen liest den Vorgang
neu. Kein Akzeptieren von Fakten in dieser Ansicht. Loader nur beim initialen
Abruf, vorhandene Daten bleiben beim Aktualisieren sichtbar, Fehler mit Wiederholen.
Fehlgeschlagene Einzelfeeds blockieren die übrige Seite nicht.

## Gemeinsame Bausteine und Abnahme

PageHeading, Modal, SettingRow, Skeleton, gemeinsame Tabs, Apple-Schalter und Icons.
AgendaRow wird in der Designreferenz wiederverwendet. Farben, Typografie, Fokus,
Abstände und Radien aus design-system.mjs. Keine zusätzliche Motion oder Palette.

Prüfen: Datumsarithmetik (KW-Jahresgrenzen, Schaltjahr, Sommerzeit), Navigation,
Wochentagsfilter, Ansichtpräferenzen nach Reload, Demo-Bestätigung und Terminänderung,
keine CRM-/Kalenderschreibanfrage aus Beispielen, echte Hinweise, Fehler, Tastatur, Desktop,
schmale Breite und große Schrift in Hell/Dunkel. Build ersetzt keine Sichtprüfung.
Den späteren Anschlussvertrag führt [docs/PLANNER.md](../../docs/PLANNER.md).

## Berichte im Gespräch

BriefingRow zeigt Datum, Zeit, Titel, zweizeilige Vorschau und Chevron. Mobil
steht das Datum über dem Text. Der ganze Eintrag öffnet den Bericht im normalen
Chat mit Composer. Ein gespeicherter unveränderlicher Gesprächsausschnitt setzt
den Bericht als erste Assistentennachricht und liefert seinen Inhalt bei jeder
Fortsetzung als historischen Kontext. Kein Worker-Turn beim bloßen Öffnen.
Pro Berichts-ID entsteht höchstens ein Gespräch; weitere Klicks öffnen es wieder,
auch nach Reload. Laufende Öffnung sperrt die Liste; Fehler bleiben mit erneutem
Klick wiederholbar. Das Öffnen markiert die Quellbenachrichtigung nicht als gelesen.
Beispielberichte erzeugen ausschließlich auf Klick einen als Beispiel benannten
Gesprächsinhalt, niemals CRM-/Kalenderdaten. Der Tagesplan kann sich unabhängig
vom datierten Bericht ändern.

Verknüpfungen behält das bestehende Modal. Seine native Scrollleiste ist visuell
verborgen; Scrollen und Tastaturbedienung bleiben erhalten. Tagesplan und Braucht
dich stehen auf breiten Ansichten nebeneinander, auf schmalen untereinander.


Der Standardstart ist jetzt der leere Chat mit kontextabhängiger Begrüßung und
AttentionFan. Heute entfällt im Hauptmenü; Kalender und bestehende Direktlinks
bleiben über die Suche nutzbar. Aufbau und Verhalten führt [chat.md](chat.md).
