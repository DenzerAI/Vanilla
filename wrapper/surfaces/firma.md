# Firma

## Version 1 · Chat zuerst

Firma ist eine echte Arbeitsansicht für den betreuten Firmenaufbau. Ein gemeinsamer
PageHeading, rechts ein kleiner bestätigter Zähler, darunter acht flache Zeilen.
Kein eigenes Logo, Hero, Dashboard, Rollen-Dropdown oder zusätzliche Reiternavigation.
Die native Aufklappfunktion zeigt genau vier Arbeitspunkte je Phase; ein Punkt öffnet
seinen Arbeitschat. Auch am Handy bleibt der Einstieg eine einzige Spalte.

`FirmaList` ist der gemeinsame Baustein in Produktion und Unser Design. Zentrale
Tokens, bestehende Icons, 44-px-Touchziele, sichtbarer Fokus und reduzierte Bewegung
bleiben wirksam. Die Einrückung reduziert sich auf schmalen Flächen. Status braucht
Text, nicht allein eine Farbe. Aufklappen startet keine Arbeit; der Punktklick schon.
Laden verwendet Skeleton, Fehler erhalten Erneut laden. Während des Öffnens sind
weitere Punktaktionen gesperrt. Eine fehlgeschlagene Antwort erzeugt keine Duplikate.

## Ablauf

Die Katalogpunkte führen Kriterien statt starrer Fragen. Der erste Klick erstellt
für genau diesen Punkt einen benannten Chat im allgemeinen Arbeitsbereich und
startet das Interview mit dem vorhandenen Worker. Weitere Klicks öffnen denselben
Chat, auch nach einem Neustart. Archivierte zugehörige Chats werden wieder geöffnet.
Unbekannter Ausgang des ersten Starts wird nicht automatisch wiederholt. Verzweigte
Chats übernehmen weder die Punktzuordnung noch eine offene Bestätigungsberechtigung;
der ursprüngliche Arbeitschat bleibt der Einstieg aus Firma. Der Chat
führt seine üblichen Anhänge, Diktate, Entwürfe, Modellwahl und Unterbrechungen weiter.
Firma ersetzt keine dieser Funktionen. Der Rückweg steht als knapper Firma-Button
im vorhandenen Chatkopf. Im Seitenmenü und in der Suche gibt es denselben Einstieg.

Jeder reguläre neue Turn erhält den konkreten Punkt, seine Kriterien, die führende
Firmenbasis, den festen Ergebnisort, den aktuellen Stand und die Liste anderer
Ergebnisorte. Der Worker prüft vorhandene Antworten und Quellen vor Rückfragen.
Er fragt nach Lücken, Ausnahmen, Widersprüchen und Änderungen. Ein inhaltlich
vollständiges Ergebnis entsteht durch den Worker mit fachlicher Nutzerprüfung;
der technische Validator garantiert keine Wahrheit und verhindert nicht jede
inhaltliche Wiederholung. Keine Behauptung einer automatisch trainierten KI.

## Daten und Abschluss

`firma/<punkt-id>.json` im Arbeitsbereich enthält ausschließlich den versionierten
Arbeitsstand: summary, openQuestions, reviewReady und je Kriterium einen finding-
Vermerk mit relativer Markdown-/Textquelle in Firma oder Workspace. Bestehende
Firmenakten bleiben führend. Neue Entwürfe liegen zunächst im Workspace/firma;
fachlich bestätigtes gemeinsames Wissen kann der Worker im Auftrag an der passenden
Firmenquelle pflegen und in deren Landkarte referenzieren. Persönliche Lernstände
gehören nicht automatisch in allgemein zugängliche Akten.

Eine fertige Worker-Antwort mit strukturell gültigem Ergebnis bietet im Chat
„Ergebnis prüfen“ an. Aufklappen zeigt summary, Kriterien, findings und Quellen.
„Ergebnis bestätigen“ bezieht sich auf genau diese Proposal- und Quellversionen.
Der bestätigte Inhaltsfingerabdruck wird über die bestehende Storage-API unter
`control/firma.json` im SQLite-Kern gespeichert; ohne Kern gilt die entsprechende
lokale Adapterdatei. Chatzusammenhang und letzte Prüfversion liegen als additive
firmaItemId/firmaReview-Felder in den bestehenden Chatmetadaten. Der Agent schreibt
keine Bestätigungsbelege. Die alternative eindeutige Textbestätigung ist an den
Proposalcode gebunden; im normalen UI muss kein Code eingegeben werden.

Fehlende Quellen, offene Fragen, ungültige Formate, aktive Arbeit und zwischenzeitlich
geänderte Ergebnisse können nicht bestätigt werden. Vorherige Phasen müssen für den
Abschluss späterer Phasen vollständig sein. Vorbereitung ist jederzeit möglich.
Eine Änderung am Ergebnis oder an einer Quelle nimmt den Fortschritt zurück; spätere
abhängige Phasen stehen ebenfalls wieder auf Prüfung. Es gibt keinen manuellen
Erledigt-Schalter und keinen Fortschritt durch bloßes Öffnen oder durch reviewReady.

Die acht Phasen umfassen Start, Betrieb, QM, Wissen, KI-Regeln, Einweisung,
Fähigkeiten und Übergabe. Die 32 Punkte sind ein Grundaufbau, keine Messung von
Intelligenz, vollständigem Firmenwissen oder rechtlicher Konformität. Einweisungs-
Nachweise sind keine automatisch erteilten externen Zertifikate. Fachliche Freigabe
eines Punktes vergibt keine technischen Anbieter-, Nutzer- oder Versandrechte.

## Grenzen und Betrieb

Diese erste Fassung verwendet den bestehenden authentifizierten gemeinsamen
Arbeitsbereich und dessen Zugriffsmodell. Sie führt keine gesonderten Kunden- oder
Betreuerrollen und keine Mehrfirmenverwaltung ein. Ein menschlicher App-Zugriff
bestätigt das Ergebnis; eine Identitäts- oder Vertretungsprüfung je Mitarbeiter ist
nicht zugesagt. Die Daten liegen getrennt je Installation. Ein Worker mit vollem
Shellzugriff bleibt kooperativer Teilnehmer; JSON-Schemata sind keine Sandbox.

Bestätigungsmetadaten werden im SQLite-Backup mitgesichert; Workspace-Ergebnisse
und Firmenbasis benötigen den bestehenden Dateisnapshot. Ohne gemeinsamen
Wiederherstellungsstand bleiben fehlende oder veränderte Quellen offen. Fehlerhafte
Modulmetadaten blockieren Firma, nicht den übrigen Adapter. Keine Hintergrundjobs,
externen Nachrichten, neuen Anbieter oder automatische Rechtevergabe.

Migration: additive Formatversion 1. Fehlende Daten ergeben 0/32, ohne Beispiele
oder Änderungen an vorhandenen Firmeninhalten. Älterer Code ignoriert den neuen
Datensatz und die zusätzlichen Chatfelder; Quelldokumente und Chats bleiben lesbar.
Vor erneutem Einsatz Quellen neu prüfen. Unbekannte Metadatenversionen bleiben
unverändert und machen das Modul nicht verfügbar. Nicht einfach zurücksetzen.

Prüfung: Modul-/Designprüfung, Daten- und Abschlussfälle in firma.test.mjs,
Storage-Import und Wiederherstellung, echte Chat-/Anhängewege plus Sichtprüfung
auf Desktop und Handy. Ein Build allein bestätigt weder ein Live-Interview noch
mobile Darstellung.

Der Einstieg Firma steht in der Seitenleiste unter Wissen und Abläufe. Die
globale Suche findet denselben Einstieg. Es gibt keinen zusätzlichen
Navigationspunkt Firma oberhalb von Inbox und Aufträgen.

Firma-Arbeitschats bleiben gemeinschaftliche Aufbaugespräche. Die vorhandene
PIN-Sperre kann für sie nicht neu eingerichtet werden, weil Ergebnisse bewusst
in die gemeinsame Firmenablage fließen. Persönliche Inhalte gehören in separate
private Chats. Die Prüfung erfolgt im vorhandenen Core-Anschluss für PIN-Einrichtung.
