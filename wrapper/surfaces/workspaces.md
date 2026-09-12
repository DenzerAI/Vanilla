# Optionale Workspaces

Ein Workspace bündelt Gespräche, Dateien und besondere Arbeitsweisen für ein
Thema. Er bleibt freiwillig: Derselbe Assistent verwendet dieselbe persönliche
Identität und gemeinsame Firmenbasis. Auftragskategorien sind davon unabhängig.
Ein Organigramm und automatisch arbeitende Unteragenten gehören nicht zu diesem
Ausbau.

## Einrichtung

Das Plus neben „Workspace“ öffnet denselben kompakten Dialog wie „Workspace
bearbeiten …“. Nur der Name ist erforderlich. Erstellen legt sofort einen
nutzbaren Bereich an und öffnet einen leeren Chat, ohne Worker-Aufruf oder
Einrichtungsinterview. Die wiederholbare Erstellung verwendet `/projects/save`
mit einer stabilen requestId und dem vorhandenen WorkspaceDirectory.create.
Eine verlorene Antwort führt bei erneutem Speichern nicht zu einem zweiten Bereich.

Das Symbol neben dem Namen öffnet die visuellen Symbol- und Farbauswahlen.
„Weitere Angaben“ enthält die optionale Beschreibung „Was gehört hierher?“.
Für bestehende Workspaces bietet dieser Abschnitt „Arbeitsweise im Chat anpassen“.
Diese Aktion speichert zuerst und öffnet anschließend das bestehende
Einrichtungsgespräch; Fehler lassen den Entwurf und die neue Revision erhalten.
Der gleiche Einstieg bleibt im Workspace-Menü verfügbar. Die Überschrift
„Workspace“ erklärt weiterhin Zweck und Freiwilligkeit.

Das optionale Gespräch klärt besondere Vorgaben, benötigte Unterlagen/Skills und
wiederkehrende Abläufe. Bekannte Angaben werden nicht erneut abgefragt.
Arbeitsanweisungen und Skills gehören nicht in den normalen Bearbeitungsdialog.
Es entstehen keine automatischen Jobs oder Zeitpläne. Firmenwissen bleibt in
der gemeinsamen Firmenbasis, der Workspace organisiert die zugehörige Arbeit.

## Daten und Kontext

AGENTS.md erhält auf ausdrückliches Speichern einen YAML-Kopf mit
`schema_version: 1`, stabiler `id`, `name`, optionaler `description`, `status`
(`draft` oder `ready`) sowie optional `icon`/`color` aus dem vorhandenen Katalog.
Darunter steht normaler Markdowntext. Erweiterungsfelder und bestehende
Abschnitte bleiben beim Bearbeiten erhalten. Dateien ohne diesen Kopf behalten
zunächst ihre bisherige Bedeutung; fremde Frontmatter wird als vorhandener
Text erhalten. Ein Name ist eine Anzeige und verändert keinen Ordnerpfad.

Vor jedem neuen Turn liest der Server die aktive Beschreibung frisch, auch
bei einem Jobchat mit abweichendem Job-Arbeitsverzeichnis. Der Worker erhält
gemeinsame Identität/Firmenbasis und die aktive Spezialisierung. Das kompakte
Workspace-Verzeichnis enthält Zuordnungen, keine anderen Chatverläufe. Der
Firmenquellenkatalog liefert begrenzte, frische Markdownpfade; Inhalte und Skills
werden nach Bedarf gelesen. Steering während eines laufenden nativen Turns
bleibt unverändert. Native Systemprompts, Werkzeuge, Memory und
Kontextverwaltung werden durch diese Funktion nicht abgeschaltet oder ersetzt.

Die Liste wird beim Öffnen, vor Turns, nach Abschluss und alle fünf Sekunden
aktualisiert. Nur konfigurierte Ordner direkt unter `projects/` werden neu
entdeckt; Uploads sind kein Registrierungsweg. `WORKSPACES.md` ist ein erzeugtes
Verzeichnis. Eine eigene Datei oder Verknüpfung an dieser Stelle bleibt mit
Hinweis erhalten. Der bestehende Projektindex ist eine abgeleitete Anzeige;
Chats, Aufträge und Ergebnisse behalten ihre Kennungen und Ablagen.

## Bedienung und Fehler

WorkspaceDefinitionEditor verwendet für Erstellen und Bearbeiten den gemeinsamen
Modal mit project-dialog, Field-Muster und nativen Radio-Gruppen. Die randlose
sheet-glass-Fläche folgt dem bestehenden Liquid-Glass-Material samt Fallbacks.
Kopf und Aktionen bleiben fest sichtbar; nur project-editor-body scrollt.
Name, optionale Beschreibung und visuelle Auswahl sind auf schmalen Fenstern
und bei großer Schrift bedienbar. Speichern ist während der Anfrage gesperrt;
Fehler stehen am erreichbaren Fuß. Laden verwendet den Settings-Skeleton.
Unser Design zeigt denselben Produktionsdialog mit lokalen Beispieldaten.

Einrichtungsstatus und Rohtexteditor werden nicht angezeigt. Bearbeiten sendet
nur Name, Beschreibung, Symbol und Farbe mit der geladenen Revision. Bestehender
Status, Markdown und Erweiterungsfelder bleiben erhalten. Neue Bereiche sind
intern ready, ohne Einrichtungs-Platzhalter. Die Navigation zeigt keinen
Einrichtungsstatus. Revisionskonflikte erhalten den lokalen Entwurf und verhindern
das Überschreiben zwischenzeitlicher Änderungen.

Fehlerhafte YAML-Versionen, fehlende konfigurierte Beschreibungen, doppelte IDs
und verknüpfte AGENTS.md werden als konkrete Fehler gemeldet. Ein betroffener
Workspace startet keinen Turn mit veralteter Beschreibung. Andere gültige
Workspaces bleiben bedienbar. Die Startanfrage ist wiederholbar; bestehende
Einrichtungschats werden fortgesetzt und ein unklarer Nachrichtenversand wird
nicht automatisch wiederholt. Forks übernehmen die Einrichtungszuordnung nicht.
Ein gesperrter Einrichtungschat wird über den allgemeinen Einstieg nicht
geöffnet; seine Fortsetzung erfolgt im ursprünglichen geschützten Chat.

## Migration und Rückkehr

Installation liest bestehende Dateien; sie ergänzt keinen YAML-Kopf ohne
Speichern und verschiebt keine Firmen-, Memory-, Chat- oder Jobdaten.
Beschreibungen, eigene Skills, bestehender State und Chats verwenden die
vorhandenen Sicherungswege. Unterbrechung nach gespeicherter Beschreibung kann
beim nächsten Start über die Projektsuche wiedergefunden werden.

Zum Aufheben einer Spezialisierung die Besonderheiten über „Arbeitsweise im
Chat anpassen“ gezielt entfernen oder anpassen lassen. Automatisches Löschen von Workspace/Chats ist nicht
Teil dieses Moduls. Vor Rückkehr auf alten Code laufende Einrichtung beenden
und Dateien/State sichern. Alte Leser können den Markdowntext weiterhin lesen,
berücksichtigen jedoch keine neuen Revisions- und Einrichtungsregeln. Bereits
bestehende Privatsperren müssen bei einer Rückkehr gesondert erhalten bleiben.

Workspaces organisieren Themen innerhalb derselben Installation. Sie schaffen
keine Benutzerkonten, Verschlüsselung oder Betriebssystem-Sandbox. Die bestehenden
API-Pfadprüfungen und Privatsperren bleiben eigenständige Schutzmechanismen.

## Prüfung

`workspace-directory.test.mjs` prüft Bestand, Wiederanlauf, unveränderte Identität
und Pfade, Konflikte, Symlinks und wiederholbare Einrichtung.
`workspaces-http.test.mjs` prüft echte HTTP-Wege gegen einen simulierten nativen
Worker einschließlich frischer Folge-Turns und Neustart. Anbieter-Logins und
inhaltliche Interviewqualität werden dadurch nicht als live getestet erklärt.
Desktop-/Handybedienung benötigt zusätzlich die visuelle Prüfung des Builds.


## Gemeinsame Ordnung für Aufträge und Ergebnisse

Workspaces bündeln Gespräche, Aufträge und Ergebnisse. Ohne eigene Aufteilung
bleibt Allgemein der Einstieg. WorkspaceInfo erklärt diese gemeinsame Zuordnung;
Kategorien werden nicht mehr als zusätzliche Organisation empfohlen. Die
Referenz zeigt den produktiven FilterPicker mit „Alle Workspaces“. Bestehende
Dateipfade, Projektkennungen und Arbeitsweisen bleiben unverändert.

Dialogvereinfachung: keine Migration vorhandener Daten. Ältere Oberflächen zeigen
den weiterhin kompatiblen Status und Markdowntext wieder an. Bestehende IDs,
Dateipfade, Chats und Arbeitsanweisungen bleiben erhalten.
