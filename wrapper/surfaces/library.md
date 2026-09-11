# Ergebnisse

Modus: Operate. Die bestehende Designsprache aus ../DESIGN.md ist verbindlich.

## Kompakter Dateibrowser

Die Ergebnisansicht zeigt ausschließlich den Dateibrowser. Die Reiter „Dateien“ und
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

Ergebnisse aus Chats, Kanalaufträgen, Jobs, Projekt-output/ und dem bestehenden Order-Artefaktordner teilen denselben Index. Die Ergebnisansicht dupliziert Dateien erst bei ausdrücklicher Wiederverwendung. Favoriten und Quellen bleiben erhalten. Neue Ergebnisse aktualisieren die Ansicht über das bestehende Ereignissystem.

Die Ergebnisansicht bietet keinen „Bild erstellen“-Button. Bilderzeugung bleibt im Chat beziehungsweise über vorhandene Anschlüsse verfügbar. Lade-, Fehler- und Leerzustände verwenden die vorhandenen Muster; keine neue globale Toolleiste.

## Ladeformen

Dateien sowie Wissen und Notizen zeigen List-Skeletons beim ersten Abruf.
Vorhandene Treffer bleiben während Aktualisierung sichtbar. Dokument-/
Media-Skeletons überbrücken Datei- und Notizvorschauen; vorhandene Fehler-
und Wiederholen-Aktionen bleiben erhalten. Keine leere Fundstellenanzeige
während des anfänglichen Such-Debounce.

## Feinschliff der Vorschau

Der Ansichtswechsel verwendet die gemeinsamen runden Iconbuttons: transparent im Ruhezustand, feiner Kreisrand und betontes Symbol bei Auswahl, einmalige Hoveranimation auf Desktop. Keine eigene Gruppenfüllung oder Auswahlkachel. Markdown wird im Ergebnis-Lesemodus von FileContent über den vorhandenen bereinigten Markdown-Renderer dargestellt. Andere Text-/Codedateien erscheinen als lesbarer schreibgeschützter Text, editierbare FileContent-Aufrufer behalten ihren Editor. Im Workspace scrollt der gesamte Inhalt, ohne verschachteltes Textfeld. Die große Vorschau nutzt die verfügbare Fensterhöhe; lange Dokumente scrollen, Bilder bleiben vollständig sichtbar.

## Vorschau nach Dateityp

LibraryThumbnail lädt nur sichtbare beziehungsweise unmittelbar benachbarte Einträge. Textminiaturen zeigen maximal 1.400 echte Zeichen, keine erfundenen Zeilen. Textdateien über 2 MB und PDFs über 24 MB erhalten Formatsymbole. PDF.js wird einschließlich Worker lokal ausgeliefert und erst bei Bedarf importiert; keine externen Dokumentdienste. PdfPreview rendert die erste Seite als Miniatur und stellt im Lesemodus eine Seitensteuerung bereit. Canvas bleibt außerhalb von Formular-/Editorlogik. Verschlüsselte, fehlerhafte oder nicht darstellbare PDFs behalten Wiederholen und Download. Audio wird nicht automatisch abgespielt; seine Kachel trägt ein Lautsprechersymbol statt einer erfundenen Wellenform.


Der Datei-Skeleton folgt der aktiven Listen-/Rasterwahl innerhalb des scrollenden Ergebnisbereichs. Die Liste besitzt dieselben Spalten Name/Art/Datum, 32-px-Zeilen und Touchhöhen. Das Raster verwendet dieselben 128-px-Mindestspalten und 112-px-Vorschauplätze. Mobile Spalten werden gemeinsam mit den echten Einträgen ausgeblendet.


## HTML-Dokumente im Workspace und in der Großansicht

HTML und HTM werden in FileContent standardmäßig als gerenderte Seite angezeigt.
HtmlPreview ist der gemeinsame iframe-Baustein; Unser Design beschreibt diesen gemeinsamen Baustein. Ergebnisansicht, Chat-Artefakte und Workspace verwenden denselben
Anzeigeweg. HTML erhält einen eigenen Dateitypfilter; Miniaturen zeigen ein
Formatsymbol und starten keine Dokumentskripte.

Ein HTML-Link im Chat öffnet zunächst die kompakte Workspace-Vorschau. HTML reagiert
auf die tatsächliche iframe-Breite wie auf einem schmalen Gerät. „Vergrößern“ erweitert
denselben Workspace; „Verkleinern“ stellt die vorherige Breite wieder her. „Vollbild“
nutzt die native Browserfunktion von HtmlPreview. Dabei bleiben iframe, Scrollposition
und Dokumentzustand erhalten. Die Ergebnisansicht behält Auswahlvorschau, Doppelklick und
Vergrößern in LibraryPreview. Kein automatischer Wechsel in die Ergebnisansicht oder ein Modal.
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


Der helle Workspace verwendet dieselbe dunkler abgesetzte Papierfläche wie im Chat, auch in Dateivorschau und Ergebnisansicht. Menüs und Dialoge folgen der hellen Materialhierarchie aus DESIGN.md; es gibt keine eigene Ergebnispalette.


Codeblöcke im gemeinsamen Markdown-Renderer verwenden ebenfalls CopyButton.
Die bereinigte Toolbar enthält nur den Portalplatz; React rendert darin dieselbe
zugängliche Kopieraktion mit Haken und Fehlerzustand. Kopiert wird ausschließlich
der Text des zugehörigen Codeblocks, ohne die letzte Formatierungszeile.


## Workspacebezogene Dateinavigation

AgentFiles verwendet die gewählte Projekt-ID und den Workspace-Namen. Die
Navigation endet an dessen Wurzel; ein Workspace-Wechsel verwirft die bisherige
Dateiauswahl. Während ein ausdrücklich verlinkter Unterordner geladen wird,
bleibt der Datei-Skeleton sichtbar. LibraryThumbnail bietet zusätzlich eine
Kartenvariante mit lesbarer Dokumentbreite; normale Ergebnisminiaturen
behalten ihren Aufbau und ihre bisherigen Ladegrenzen.


SVG verwendet dieselbe inaktive FileContent-Bildvorschau wie im Chat. Der
Quelltext bleibt separat lesbar beziehungsweise im schreibbaren Workspace
bearbeitbar. SVG-Dateien werden als Bilder klassifiziert und erhalten echte
Miniaturen. Die bestehenden Pfadprüfungen und Downloadheader bleiben erhalten.
Keine Datenmigration; ältere Oberflächen zeigen wieder den Quelltext.


### HTML-Präsentation · Version 1.1.0

HtmlPreview besitzt eine schlanke Leiste aus gemeinsamen IconButtons für
Präsentieren/Beenden und natives Vollbild/Verlassen. Im Vollbild erscheint der
Dateititel; die übrige App liegt außerhalb der Bühne. Kopf und Foliensteuerung
bleiben bei Touch, großer Schrift, Hell/Dunkel und Forced Colors erreichbar.
Keine automatische Wiedergabe oder Folienwechsel. Browserablehnung erhält die
Vorschau und zeigt einen kurzen Fehler. Vergrößern bleibt unabhängig verfügbar.

Eigenständige Präsentationen kennzeichnen ihre Folien mit
`data-presentation-slide`, beispielsweise `<section data-presentation-slide>`.
Die äußeren markierten Elemente bilden in Dokumentreihenfolge bis zu 500 Folien.
Sie werden beim Laden erfasst; größere Decks bleiben normale Dokumente.
Sie verwenden responsives HTML und sind ohne Vorschau als normales Dokument lesbar.
Erst „Präsentieren“ blendet andere Folien aus. Vor/Zurück, Pfeile links/rechts,
PageUp/PageDown und Home/End steuern innerhalb der Grenzen; im Dokument zusätzlich
Leertaste für Weiter. Eingabefelder, editierbare Inhalte und Modifikatortasten
bleiben unberührt. Der Zähler zeigt die bestätigte Folie. Beenden stellt die
ursprünglichen Hidden-Zustände und die Scrollposition vor Präsentationsbeginn
wieder her. Unmarkiertes HTML bleibt scrollbar und erhält keine erfundenen Folien.

Der optionale Queryparameter `presentation` am bestehenden Preview-Endpunkt
aktiviert ausschließlich in der ausgelieferten Vorschau eine kleine Steuerbrücke.
Die gespeicherte HTML-Datei und Downloads bleiben bytegleich. Der Kanal ist pro
Dokumentöffnung zufällig und auf 8–80 ASCII-Buchstaben, Ziffern, `_` und `-`
beschränkt. Das Protokoll `vanilla-presentation-v1` tauscht ausschließlich
Hello, Modus, Navigation, Status und Beenden aus. Der Viewer prüft Fensterquelle,
opaque Origin, Kanal, Nachrichtentyp und begrenzte Zähler. Die Brücke akzeptiert
nur das direkte Elternfenster. Status meldet keine Dateiinhalte und löst weder
Anbieteraufrufe noch beliebige App-Aktionen aus. Sandbox und CSP bleiben unverändert.

Migration/Rückkehr: keine neuen Speicherdaten und keine Änderung von HTML-Dateien.
Die Serverergänzung muss für Foliensteuerung aktiv sein; ältere Server liefern
weiter die normale Vorschau ohne Präsentationsbutton. Neues Vollbild funktioniert
auch ohne Steuerbrücke. Ältere Viewer verwenden den bestehenden Endpunkt ohne
Zusatzparameter. Ein Zurücksetzen verliert nur die neuen Anzeigeaktionen.


## Kategorien und Auftragsherkunft · Version 3

Die Oberfläche heißt Ergebnisse, die Navigation bleibt Inbox, Aufträge, Ergebnisse,
Firma und Workspaces. Bestehende library-Routen, Kennungen, Favoriten und Dateien
bleiben erhalten. Kategorie, Workspace und Dateityp sind unabhängige Filter.
Die Kategorie verwendet denselben kurzen freien Namen und dieselbe Validierung
wie Aufträge. Der Katalog enthält Auftrags- und Ergebniskategorien; Allgemein ist
weiterhin die leere Kategorie. Auch die globale Suche berücksichtigt Kategorien.

Ergebnisse aus Auftrags-output/ und registrierten Auftragschats erhalten jobId
und den Workspace des Auftrags. Bei jedem Abruf wird seine aktuelle Kategorie
übernommen. Die Vorschau verwendet ResultCategoryEditor mit nativer Input/Datalist,
vorhandenem Formular und explizitem Speichern. Fehler erhalten den Entwurf.
Eine eigene Zuordnung bleibt beim Neuladen erhalten; „Vom Auftrag übernehmen“
stellt die Vererbung wieder her. Unser Design zeigt denselben Baustein mit lokalen
Beispieldaten. Zum Auftrag öffnet vorhandene Auftragsdetails; Ergebnisse ansehen
am Auftrag öffnet die nach jobId gefilterte Ergebnisansicht, mit Alle Aufträge
als Rückweg. Ein gelöschter oder unlesbarer Auftrag bleibt als nicht verfügbar
gekennzeichnet; vorhandene Ergebnisse und letzte bekannte Kategorie bleiben erhalten.

Daten/Migration: library.json Version 1 bleibt kompatibel. Additive Felder
jobCategory, jobName und jobAvailable beschreiben den zuletzt gelesenen Auftrag.
categoryOverride ist null/fehlend für Vererbung, sonst ein validierter Name;
explizit leer bedeutet Allgemein. category ist die abgeleitete Anzeige.
POST /api/library/category schreibt ausschließlich Indexmetadaten über dieselbe
Warteschlange wie Refresh/Favoriten; keine Dateiverschiebung oder Manifeständerung.
Alte Leser ignorieren Zusatzfelder und erhalten Dateien/Favoriten. Nach Rückkehr
entfällt die Kategoriebedienung; erneutes Update übernimmt erhaltene Overrides.
Prüfung: wrapper/test/service-platform.test.mjs sowie Desktop-/Handyansicht.

Der Index erfasst auch lokale Dateilinks finaler Antworten einschließlich ihrer
Auftragsherkunft. Die Chatansicht behält ihre Duplikatfilter unverändert.
