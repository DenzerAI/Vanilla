# Bibliothek

Modus: Operate. Die bestehende Designsprache aus ../DESIGN.md ist verbindlich.

## Kompakter Dateibrowser

Die Bibliothek zeigt ausschließlich den Dateibrowser. Die Reiter „Dateien“ und
„Wissen und Notizen“ sowie „Notiz erstellen“ entfallen. Bestehende Wissensdateien
bleiben unverändert über die globale Suche und ihren vorhandenen Editor erreichbar.

PageHeading bleibt der einzige Seitentitel, mit Ansichtswechsel Liste/Bildraster
und Aktualisieren. Darunter stehen kompakte Suche und die gemeinsamen FilterPicker
für Dateityp/Favoriten und Arbeitsbereich. Der Trefferstatus steht unter der Liste.
Keine großen Symbolkacheln oder zusätzlichen Herkunftszeilen in der Listenansicht.

Die Standardansicht ist eine kompakte Liste mit Name, Art und Änderungsdatum,
abwechselnd dezenten Zeilenflächen und klarer neutraler Auswahl. Die alternative
Rasteransicht zeigt unverzerrte echte Bildvorschauen, für PDFs die erste gerenderte Seite, für Textdateien einen echten Ausschnitt, für Videos ein Standbild. Audio sowie nicht unterstützte, fehlende oder fehlerhafte Dateien erhalten ein Formatsymbol mit Endung. Der gewählte Modus bleibt lokal gespeichert.
Beide Ansichten zeigen dieselben gefilterten Dateien, nach Änderung absteigend,
mit Erstellung als Rückfall und Dateiname bei Gleichstand.

Ein Klick wählt aus und öffnet rechts die Workspace-Dateivorschau. Sie verwendet
workspace-panel und FileContent, denselben Werkstoff und dieselben Kopfaktionen
wie der Chat-Workspace. Es gibt keine zweite rechte Leiste neben dieser Vorschau.
Name, Typ und Größe stehen unter dem Inhalt; Herkunft, Datum und Pfad aufklappbar.
Auf schmaler Inhaltsbreite überlagert sie die Dateiliste und bleibt schließbar.
Eine neue Suche oder Filterwahl löscht die Auswahl. Die Liste navigiert mit
Pfeiltasten sowie Home/End; das Raster berücksichtigt seine tatsächliche Spaltenzahl.

Doppelklick, Leertaste oder Vergrößern öffnen LibraryPreview im gemeinsamen Modal.
Vor/Zurück wechseln durch die gefilterten Ergebnisse. Escape schließt den Modal
und gibt den Fokus zurück. Die große Ansicht ist ausschließlich zum Betrachten: Inhalt, Titel, Navigation und Schließen. Favorit, Download, Quellgespräch und Wiederverwendung liegen nur im rechten Workspace. Fehlende Dateien und Ladefehler
verwenden die bestehenden FileContent-Zustände und Wiederholen-Aktion.

Ergebnisse aus Chats, Kanalaufträgen, Jobs, Projekt-output/ und dem bestehenden Order-Artefaktordner teilen denselben Index. Die Bibliothek dupliziert Dateien erst bei ausdrücklicher Wiederverwendung. Favoriten und Quellen bleiben erhalten. Neue Ergebnisse aktualisieren die Ansicht über das bestehende Ereignissystem.

Die Bibliothek bietet keinen „Bild erstellen“-Button. Bilderzeugung bleibt im Chat beziehungsweise über vorhandene Anschlüsse verfügbar. Lade-, Fehler- und Leerzustände verwenden die vorhandenen Muster; keine neue globale Toolleiste.

## Ladeformen

Dateien sowie Wissen und Notizen zeigen List-Skeletons beim ersten Abruf.
Vorhandene Treffer bleiben während Aktualisierung sichtbar. Dokument-/
Media-Skeletons überbrücken Datei- und Notizvorschauen; vorhandene Fehler-
und Wiederholen-Aktionen bleiben erhalten. Keine leere Fundstellenanzeige
während des anfänglichen Such-Debounce.

## Feinschliff der Vorschau

Der Ansichtswechsel verwendet eine Pille mit runden Iconbuttons und betont das aktive Symbol über die Textfarbe, ohne separate Auswahlfläche. Markdown wird im Bibliotheks-Lesemodus von FileContent über den vorhandenen bereinigten Markdown-Renderer dargestellt. Andere Text-/Codedateien erscheinen als lesbarer schreibgeschützter Text, editierbare FileContent-Aufrufer behalten ihren Editor. Im Workspace scrollt der gesamte Inhalt, ohne verschachteltes Textfeld. Die große Vorschau nutzt die verfügbare Fensterhöhe; lange Dokumente scrollen, Bilder bleiben vollständig sichtbar.

## Vorschau nach Dateityp

LibraryThumbnail lädt nur sichtbare beziehungsweise unmittelbar benachbarte Einträge. Textminiaturen zeigen maximal 1.400 echte Zeichen, keine erfundenen Zeilen. Textdateien über 2 MB und PDFs über 24 MB erhalten Formatsymbole. PDF.js wird einschließlich Worker lokal ausgeliefert und erst bei Bedarf importiert; keine externen Dokumentdienste. PdfPreview rendert die erste Seite als Miniatur und stellt im Lesemodus eine Seitensteuerung bereit. Canvas bleibt außerhalb von Formular-/Editorlogik. Verschlüsselte, fehlerhafte oder nicht darstellbare PDFs behalten Wiederholen und Download. Audio wird nicht automatisch abgespielt; seine Kachel trägt ein Lautsprechersymbol statt einer erfundenen Wellenform.


Der Datei-Skeleton folgt der aktiven Listen-/Rasterwahl innerhalb des scrollenden Ergebnisbereichs. Die Liste besitzt dieselben Spalten Name/Art/Datum, 32-px-Zeilen und Touchhöhen. Das Raster verwendet dieselben 128-px-Mindestspalten und 112-px-Vorschauplätze. Mobile Spalten werden gemeinsam mit den echten Einträgen ausgeblendet.


## HTML-Dokumente im Workspace und in der Großansicht

HTML und HTM werden in FileContent standardmäßig als gerenderte Seite angezeigt.
HtmlPreview ist der gemeinsame iframe-Baustein; Unser Design beschreibt diesen gemeinsamen Baustein. Bibliothek, Chat-Artefakte und Workspace verwenden denselben
Anzeigeweg. HTML erhält einen eigenen Dateitypfilter; Miniaturen zeigen ein
Formatsymbol und starten keine Dokumentskripte.

Ein HTML-Link im Chat öffnet zunächst die kompakte Workspace-Vorschau. HTML reagiert
auf die tatsächliche iframe-Breite wie auf einem schmalen Gerät. „Vollbild“ erweitert
denselben Workspace; die Kopfaktion führt zurück. Dabei bleiben iframe, Scrollposition
und Dokumentzustand erhalten. Die Bibliothek behält Auswahlvorschau, Doppelklick und
Vergrößern in LibraryPreview. Kein automatischer Wechsel in die Bibliothek oder ein Modal.
Die Großansicht nutzt bei HTML fast die gesamte Fensterbreite und -höhe; auf dem
Handy bleiben Kopf und Schließen erreichbar. Der Inhalt scrollt im Dokument.

„Bearbeiten“ öffnet im schreibbaren Workspace den Quelltext mit separatem Speichern.
Schreibgeschützte Ansichten bieten „Quelltext“ zum Nachsehen. Wechseln zwischen
Vorschau und Bearbeiten erhält ungespeicherte Änderungen; die Vorschau bezeichnet
ausdrücklich den gespeicherten Stand. Aktualisieren ist bei ungespeicherten
Änderungen deaktiviert. Erfolgreiches Speichern aktualisiert die Vorschau.
Ladefehler bleiben sichtbar und erneut versuchbar. Der bestehende Download bleibt erhalten.

Der dedizierte GET-Endpunkt `/api/file/preview` verwendet dieselbe Pfad- und
Bereichsprüfung wie die Dateiansicht und begrenzt HTML auf 2 MB. HTML läuft mit
`sandbox="allow-scripts"` ohne same-origin-Recht. Eine eigene CSP erlaubt eingebettete
Skripte, CSS, Bilder und Fonts, sperrt aber API-Zugriff, externe Ressourcen,
Formularversand und eingebettete Unterseiten. Die CSP der App und der geschützte
Raw-/Download-Weg bleiben unverändert. Diese erste Vorschau ist für eigenständige
HTML-Dateien gedacht; sie synchronisiert noch keine externen Dateiänderungen live.


Der helle Workspace verwendet dieselbe dunkler abgesetzte Papierfläche wie im Chat, auch in Dateivorschau und Bibliothek. Menüs und Dialoge folgen der hellen Materialhierarchie aus DESIGN.md; es gibt keine eigene Bibliothekspalette.
