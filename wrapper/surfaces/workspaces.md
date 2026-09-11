# Optionale Workspaces

Ein Workspace bündelt Gespräche, Dateien und besondere Arbeitsweisen für ein
Thema. Er bleibt freiwillig: Derselbe Assistent verwendet dieselbe persönliche
Identität und gemeinsame Firmenbasis. Auftragskategorien sind davon unabhängig.
Ein Organigramm und automatisch arbeitende Unteragenten gehören nicht zu diesem
Ausbau.

## Einrichtung

Voraussetzung ist die vorhandene Arbeitsbereichsstruktur und für das Gespräch
ein ausführbarer nativer Worker. Das Plus neben „Workspace“ legt einen Entwurf
im bestehenden `projects/` an und öffnet einen normalen Einrichtungschat.
Die anklickbare Überschrift erklärt Zweck und Freiwilligkeit auch auf dem Handy.
Ein vorhandener Workspace bietet im Menü „Im Chat einrichten …“ und
„Workspace bearbeiten …“. Beides arbeitet an derselben Beschreibung.

Das kurze Gespräch klärt fehlende Angaben in vier Schritten: Zweck, besondere
Vorgaben, benötigte Unterlagen/Skills, wiederkehrende Abläufe und Ergebnisse.
Bekannte Firmenangaben werden nicht erneut abgefragt. Grundlegende
Spezialisierung steht in AGENTS.md. Vorhandene Skills werden verlinkt; nur ein
wirklich beauftragter wiederverwendbarer Ablauf erhält eine eigene
`skills/<name>/SKILL.md`. Die Einrichtung erzeugt keinen Job oder Zeitplan.

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

Das gemeinsame Modal verwendet SettingRow, native Eingaben/Selects, bestehende
Symbole, Farben und Abstände. Laden zeigt den Settings-Skeleton. Fehler bleiben
im Formular; ein Revisionskonflikt überschreibt keinen anderen Bearbeitungsstand
und erhält den lokalen Entwurf. „Speichern und im Chat weiter einrichten“
speichert zuerst. Auf schmalen Fenstern umbrechen Zeilen und Aktionen;
Beschriftungen, Tastaturfokus und Touchziele bleiben zugänglich. Unser Design
zeigt dieselben Komponenten mit ausdrücklich lokalen Beispieldaten.

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

Zum Aufheben einer Spezialisierung die Besonderheiten im Bearbeitungsdialog
entfernen oder anpassen. Automatisches Löschen von Workspace/Chats ist nicht
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
