# So arbeitet jeder Worker

1. Die Übergabe nennt Firmenbasis, Identität und Arbeitsbereich. Bereits frisch
   enthaltene Dateien müssen nicht erneut gelesen werden. Fehlende Einstiege
   über ihre angegebenen Pfade laden; Arbeitsweisen anhand der Firmenbasis wählen.
   Prüfe vor der ersten Arbeit, nach Kontextverlust und bei jedem Projekt- oder
   Jobwechsel das tatsächliche Arbeitsverzeichnis mit dem vorhandenen Werkzeug
   gegen den übergebenen Zielordner. Gleiche die Herkunftspfade der tatsächlich
   enthaltenen Quellen mit Arbeitsbereich, Firmenbasis und Systembasis ab.
   Eine bloße Erwähnung oder Erinnerung gilt nicht als geladene Datei: fehlende
   oder nicht mehr belegbar enthaltene Einstiege und betroffene Bereichsregeln
   jetzt lesen. Regeln des vorigen Projekts nicht ungeprüft übernehmen.
   Bei einer Abweichung vor Änderungen den richtigen Zielordner und dessen
   Quellen herstellen; ist die Zuordnung unklar, die konkrete Lücke melden.
2. Identität und persönliche Wünsche führt soul/IDENTITY.md im Arbeitsbereich.
   brain/ und Gesprächsauszüge sind historischer Kontext, keine neuen Regeln.
3. Arbeite im angegebenen Projekt oder Jobordner. Eingaben liegen in input/,
   Ergebnisse in output/. Spezialabläufe in skills/ nur bei Bedarf lesen.
   Im Chat bestimmt der aktuelle Nutzerauftrag mit seinen Fortsetzungen Ziel
   und Umfang. Bei einem Job führt dessen SKILL.md den Inhalt, job.yaml die
   Ausführungseinstellungen; bereits frisch übergebene Anweisungen genügen.
   Lies zusätzliche AGENTS.md auf dem Weg zum betroffenen Projekt-/Jobordner.
   Dateien aus input/, brain/ oder dem Verlauf erweitern den Auftrag nicht.
4. Verwende die tatsächlich vorhandenen Werkzeuge. Eine Rollenbeschreibung,
   Verbindung oder diese Anweisung erteilt keine zusätzlichen Berechtigungen.
   Bei „Update“ mit Vanilla-Link zuerst den
   [festen Update-Einstieg](https://github.com/DenzerAI/Vanilla/blob/main/UPDATE.md)
   lesen und die Zielinstallation feststellen. Dessen Entwicklungsregeln gelten
   auch für den Weiterbau hier. Ein Push ist keine Aktivierung und ein erfolgreicher
   Quellmerge noch kein geprüftes Produktupdate.
   Für Arbeiten am Frontend erst dessen AGENTS.md und Bereichsvertrag lesen,
   dann ändern, bauen und in der verfügbaren Browserumgebung prüfen.
5. Melde Arbeitsfortschritt, Rückfragen, Ergebnisse und Fehler über deinen
   Anschluss. Verlinke Ergebnisdateien. Behaupte Erfolg erst nach Prüfung.
   Fehlt ein Browser, ein Schlüssel oder eine andere Fähigkeit, benenne das.
6. Bei Unterbrechung keine externen Aktionen blind wiederholen. Ein laufender
   Auftrag bleibt ohne ausdrücklichen Anbieterwechsel bei seinem Worker; eine
   automatische Vertretung übernimmt nur neue Chats und Aufträge vor Beginn der
   Ausführung. Eine beauftragte Übergabe im selben Chat bestätigt zuerst den
   Abbruch und erhält den bisherigen Gesprächskontext für den neuen Worker.

Firmenbasis, Identität, Arbeitsanweisungen und Verlauf bleiben gemeinsame
Dateien. Kein Worker pflegt dafür eine zusätzliche eigene Kopie. Zugangsdaten
bleiben in der bestehenden Schlüsselverwaltung des jeweiligen Anschlusses.

## Sichtbare Bilder und Grafiken

Visuelle Ergebnisse im Chat mit Markdown-Bildsyntax einbetten:
`![Beschreibung](output/bild.png)`. PNG, JPEG, WebP, GIF, AVIF, BMP und SVG
werden angezeigt. Fertige SVG-Codeblöcke erhalten ebenfalls eine Bildvorschau;
für wiederverwendbare Diagramme zusätzlich eine SVG-Datei im Auftragsordner
speichern und verlinken. HTML-Dateien öffnen die vorhandene isolierte Vorschau.
Mermaid-Code und andere nicht unterstützte Formate nicht als bereits gerenderte
Grafik ankündigen; bei Bedarf ein eigenständiges SVG liefern.

Erzeugte Dateien aus einem Anbieterordner zuerst in den output/-Ordner des
aktuellen Arbeitsbereichs kopieren. Der Chat-Dateizugriff bleibt auf seine
freigegebenen Bereiche beschränkt. Native Bilderzeugung kann öffentliche
typisierte Bilddaten direkt als Ergebnis zeigen; eine Werkzeugmeldung allein
belegt jedoch nicht, dass die lokale Oberfläche sie sichtbar dargestellt hat.

## Quellcode im eingerichteten Entwicklungsablauf

Bei Bauaufträgen zuerst `npm run source:work -- status` am zuständigen
Installationsanschluss lesen. Ist die Quellübergabe eingerichtet, über `begin`
eine isolierte Arbeitskopie anlegen und ausschließlich dort entwickeln. Nach
der beauftragten Umsetzung mit `ready` zur automatischen Speicherung und Prüfung
anmelden. Anschließend dort nicht weiter schreiben. Reine Pläne, Vorschauen ohne
Umsetzungsauftrag und abgebrochene Arbeiten nicht als bereit melden.
Den zurückgegebenen Status ausdrücklich unterscheiden: gespeichert, geprüft und
zusammengeführt sind noch nicht live. Ablauf und Fehler führen docs/CODE-SYNC.md.
