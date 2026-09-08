# Pipeline

## Zweck und Stand

Die Pipeline ist die kundenorientierte Arbeitsansicht. Einstieg im Hauptmenü zwischen Inbox und Aufträge, Direktlink `?view=pipeline`. Data bleibt die gemeinsame Datenbasis im Hintergrund, ohne eigenen Hauptmenüpunkt. Die aktuelle Umsetzung ist eine bedienbare Designstudie mit eindeutig bezeichneten fiktiven Beispielen. Keine API, Persistenz, externen Schreibaktionen oder automatisch erzeugten Kundenakten. Beim Verlassen oder Neuladen werden lokale Änderungen verworfen; der Konzeptdialog erklärt diese Grenze.

## Aufbau

Bestehende App-Seitenleiste bleibt erhalten. Gemeinsamer PageHeading „Pipeline“, Konzeptdialog und „Vorgang anlegen“. Darunter gemeinsame Suchfeldgestaltung und sichtbare Kennzeichnung „Beispieldaten · Entwurf“. Vier Spalten: Lead, Angebot, Laufend, Abgeschlossen. Die Suchabfrage filtert Kunde und Vorgang gemeinsam. Spaltenzähler beziehen sich auf sichtbare Treffer.

PipelineCard ist der gemeinsame neue Baustein: Kunde, Vorgang, optionaler Wert, nächster Schritt und Datum. Eine Karte ist ein tastaturbedienbarer Button und öffnet den gemeinsamen Modal. Keine farbigen Kennzahlenkarten, kein Drag-and-drop als einziger Bedienweg. Abgeschlossene Vorgänge zeigen keine aktive Folgeaufgabe. Leere Spalten unterscheiden keine Treffer von fehlenden Einträgen.

Bearbeitungsformular: Vorgang, Kunde/Firma, Phase, optionaler Euro-Wert, bei offenen Phasen nächster Schritt und Fälligkeitsdatum. Offene Phasen dürfen ohne beide Pflichtwerte nicht übernommen werden, auch beim Wiederöffnen. Konzeptänderungen werden ausdrücklich „Im Entwurf übernehmen“ genannt. Abbrechen verändert keinen Vorgang. Phasen sind in der Studie frei wählbar; die späteren serverseitigen Übergangsregeln werden mit realen Abläufen festgelegt. Ein Abschluss ist zunächst ein Arbeitsstatus, keine Buchungs- oder Zahlungsbestätigung. Verloren/abgesagt wird später als Abschlussgrund modelliert, nicht still als Erfolg gezählt.

## Responsive und gemeinsame Bausteine

Vier Spalten bei ausreichender Breite, zwei bis 1100 px und eine bis 650 px. Keine horizontale Pflichtnavigation am Handy. Lange Titel und Namen brechen um; Karten wachsen. Gemeinsame Farben, Abstände und Schriftrollen aus design-system.mjs; PageHeading, Modal, SettingRow und Icons wiederverwenden. PipelineCard steht ebenfalls unter Aussehen → Unser Design. Keine Animation. Fokus und Dialog-Rückkehr stammen aus bestehenden Bausteinen.

## Nächster Ausbau

Data normalisiert Personen, Firmen, Vorgänge und externe IDs in der vorhandenen Datenbank; Chats/Projekte bleiben ihre bestehenden Entitäten. Jede Verbindung deklariert lesbare/schreibbare Objekte und Feldzuordnung. Einrichtung bleibt in Einstellungen → Verbindungen. Ein gespeicherter Zugang bedeutet keinen aktiven Abgleich.

Rohsignal → Behauptung mit Quelle → Fakt nach Entscheidung oder eindeutiger Regel. Herkunft liegt an Feldwerten; Notizen ersetzen keine abfragbaren Felder. Ein neuer relevanter Widerspruch markiert den betroffenen Fakt als zu prüfen. Abgelöste Fakten bleiben Historie. Zusammenfassungen hängen an Quellversionen und werden vor erneuter Verwendung aktualisiert. Verarbeitungslücken und ausgefallene Verbindungen dürfen keine aktuelle Akte vortäuschen.

Vor produktiver Anbindung: validierende Fachaktionen, Rechteprüfung, Versionskonflikte, zulässige Übergänge, Dublettenprüfung, Ereignis-Deduplizierung, echte Lade-/Leer-/Fehlerzustände und Abgleich-Wasserstand implementieren. Fiktive Karten werden nicht migriert. Änderungen externer Systeme brauchen separat konfigurierte Schreibwege. Ein Mail-Eingang erzeugt niemals allein einen Deal.
