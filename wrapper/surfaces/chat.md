# Chat und Projekte

## Automatische Chat-Titel

Der zuständige Worker erzeugt den Titel mit dem gewählten Modell in einer separaten Hintergrundanfrage anhand der ersten Nutzernachricht. Beide Anschlusswege verwenden die zentrale Regel und Prüfung in `chat-title.mjs`: möglichst 2–3 Wörter, höchstens 4 Wörter und 28 Zeichen einschließlich Leerzeichen. Das Hauptthema steht zuerst; bei Überlänge wird neu formuliert, niemals abgeschnitten. Ein ungültiges Ergebnis wird einmal neu angefragt, danach gilt „Neues Anliegen“. Manuelle Benennungen bleiben geschützt; bestehende Titel werden nur auf ausdrücklichen Auftrag überarbeitet.

## Aufbau und Erweiterungen

Die Agent-Zeile unten links öffnet als ganze Schaltfläche das Agent-Menü. Sie zeigt den unter „Dein Agent“ gewählten Bot-Avatar und Namen ohne zusätzliches Zahnrad; der separate Verbindungsstatus bleibt erhalten.

Die Projekt-/Chatnavigation liegt in der Seitenleiste. Ein unbenannter neuer Chat zeigt oben keinen Titel und keinen separaten Einstieg „Bestehenden Chat öffnen“. Benannte Entwürfe und bestehende Chats behalten ihr kompaktes Chatmenü. Bei mehreren Panels gehört jedes Drei-Punkte-Menü zum jeweiligen Panel. Die globale Chatleiste enthält die Ansichts- und Workspace-Aktionen ohne untere Trennlinie. Chatfläche zeigt Nutzereingaben, Antworten und kompakte Werkzeugaktivität. Der Composer besteht aus einer pillenförmigen Schreibzeile: Anhängen, Eingabe, genau ein Mikrofon für Diktat, Senden/Stoppen. Arbeitsmodus und Modellwahl stehen direkt nebeneinander, links ausgerichtet auf einer gemeinsamen horizontalen Linie außerhalb der Pille darunter. Beide Menüs verwenden dieselbe Höhe, Schriftrolle und Chevron-Darstellung. Modellname und Denkaufwand bleiben gemeinsam auswählbar. Keine separate Worker-Beschriftung oder Computer-Use-Schaltfläche im Composer. Bei mehrzeiligen Entwürfen wächst die Schreibfläche; ihre Rundung bleibt erhalten. Zusätzliche direkt benötigte Aktionen sind knappe Iconbuttons mit Tooltip und zugänglichem Namen. Keine Konfiguration oder Verlaufsverwaltung im Composer.

Projekte werden über das Plus an „Projekte“ ergänzt; Chats über das Plus am Projekt. Kontextmenüs und bestehende Dialoge für Bearbeiten verwenden. „Projekt bearbeiten …“ öffnet den gemeinsamen Projektdialog. Unter dem Projektsymbol folgt eine vordefinierte Farbauswahl mit Farbnamen, Auswahlhaken und Tastaturfokus. Die Farbe gilt für das Projektsymbol in Seitenleiste und Chatkopf; „Standard“ verwendet die bisherige neutrale Darstellung. Neue Projekte nutzen denselben Dialog, bestehende Projekte ohne Farbwert bleiben neutral. Der kompakte Projektdialog zeigt eine gemeinsame Vorschau von Symbol und Farbe neben dem Namen, darunter rahmenlos gruppierte Radioauswahlen und eine flache, stets erreichbare Aktionsleiste. Der Dialog nutzt die zentrale transparente Glasfläche mit Hintergrundunschärfe. Nur der Inhalt scrollt, ohne sichtbare Scrollleiste; Kopf und Aktionen bleiben stehen. Bei reduzierter Transparenz oder fehlender Blur-Unterstützung ist die Fläche deckend. Speichern überträgt Name, Symbol und Farbe gemeinsam; erneutes Öffnen und Neuladen erhalten die Auswahl. Mehrfachansichten behalten unabhängige Entwürfe und die gemeinsame Eventverbindung.

## Streaming und Scrollposition

Verlauf und Composer teilen dieselbe zentrierte Inhaltsspalte und dieselben horizontalen Kanten. Die Sprungmarken für bisherige Eingaben bleiben in einem reservierten linken Rand außerhalb der Inhalte, auch beim Streaming und in schmalen Chatpanels. Scrollleisten verändern die Ausrichtung der Inhaltsspalte nicht. Die maximale Inhaltsbreite beträgt 760 px und wächst auf großen Bildschirmen nicht weiter. Panels bis 620 px Breite behalten beidseitig 32 px Rand, größere mindestens 64 px. Die aufgeklappte Eingabevorschau bleibt ein vorübergehendes Overlay und reserviert keine dauerhafte zusätzliche Spalte.

Jedes Chatpanel folgt neuen Inhalten am unteren Rand, solange der Nutzer nicht nach oben scrollt. Text, Werkzeugwechsel, nachgeladene Vorschauen und Größenänderungen werden vor der Darstellung am tatsächlichen unteren Rand ausgerichtet. Automatisches Scrollen bewegt ausschließlich den Verlauf des jeweiligen Panels. Hochscrollen pausiert das Mitlaufen sofort; unten angekommen oder über „Zur neuesten Nachricht“ wird es wieder aktiviert. Layoutänderungen dürfen diese Entscheidung nicht umschalten. Beim Chatwechsel werden Leseposition und Mitlaufzustand gemeinsam erhalten.

## Sprache

Im normalen Composer gibt es genau ein Sprachsymbol: Mikrofon = Diktat in den Entwurf. Keine zusätzlichen Einstiege für Sprachchat oder Vorlesen. Bestehende Ausgabe-Einstellungen und gesicherte Aufnahmen bleiben unter Stimme; die vereinfachte Chatbedienung startet keinen Sprachchat. Im aktiven Zustand eine kompakte Leiste mit Status, tatsächlichem Pegel, Laufzeit und Iconaktionen für Pause, Verwerfen, Übernehmen/Senden und Schließen. Keine Schaltfläche „Aufnahmen“ und keine erklärende Textkarte im normalen Chat. Fehlermeldungen nur bei tatsächlichen Fehlern und mit einem Wiederherstellungsweg.

Diktat übernimmt erkannten Text in den Entwurf. Sprachchat darf erkannte Äußerungen an den ausgewählten Chat senden und die fertige Antwort vorlesen. Automodus gilt nur innerhalb eines bewusst gestarteten Sprachchats. Chatwechsel/Schließen beendet die Sprachbedienung; bereits gesicherte Aufnahmen bleiben erhalten. Rückfragen und Werkzeugfreigaben bleiben im vorhandenen Chatfluss. Keine Erklärungen, Werkzeugausgaben oder Codeblöcke ungefragt vorlesen.

## Details und Einstellungen

Aufnahmearchiv, Anbieterwahl, Geräte und Stimmen gehören unter **Einstellungen → Stimme**. Verbinden externer Anbieter gehört unter **Verbindungen**. Keine neuen Aufnahme-Popovers mit eigenem Archiv oder Anbieterformular.

## Werkzeuge und Ergebnisse

Werkzeuggruppen bleiben kompakt und aufklappbar. Eine gedämpfte Tätigkeitszeile mit passendem Linienicon fasst zusammen, was passiert ist, etwa „Dateien gelesen und Befehle ausgeführt“. Überlegungen werden nicht zusätzlich in die Zusammenfassung aufgenommen, wenn konkrete Werkzeugaktivitäten vorliegen; sie bleiben in den Details zugänglich. Der Aufklapppfeil folgt unmittelbar dem Text. Fehlgeschlagene Schritte stehen mit Anzahl direkt in derselben Zeile; ein Fehlerlabel am rechten Rand entfällt. Unvollständige Schritte dürfen nicht als abgeschlossen erscheinen. Oberhalb der Agentenaktivität steht eine ruhige Zeitzeile „In Bearbeitung seit …“ mit feiner horizontaler Trennlinie; nach Abschluss bleibt die tatsächliche Dauer sichtbar. Der Sekundentakt aktualisiert nur diese Komponente, ohne wiederholte Screenreader-Ansage der Zeit. Vorliegende Diffs zeigen hinzugefügte und entfernte Zeilen mit Plus/Minus und semantischen Farben. Große Ausgaben werden begrenzt und auf Nachfrage erweitert. Fehlgeschlagene Schritte dürfen nicht als erfolgreiche Dateierstellung erscheinen.

Explizite lokale Dateilinks und bestätigte Dateiergebnisse werden als klickbare Dateizeilen unter dem Turn gesammelt. Bilder bieten eine direkte Vorschau; Dokumente eine aufklappbare Vorschau oder einen Download. Externe Links werden nicht für Vorschauen abgerufen. Alle lokalen Pfade bleiben im freigegebenen Arbeitsbereich. Fehlende Dateien, nicht unterstützte Formate und Zeitüberschreitungen erhalten einen verständlichen Zustand und einen Wiederholungs- oder Downloadweg. Dateiwechsel brechen veraltete Ladevorgänge ab.

Die gemeinsame Darstellung verarbeitet normalisierte öffentliche Werkzeugdaten. Codex ist live geprüft; Claude-tool_use/tool_result einschließlich Bildausgaben ist als Datenformat im Adapter getestet, keine bestehende Claude-Code-Verbindung. Neue Engine-Anbindungen müssen denselben Vertrag erfüllen und ihren vollständigen Event-/Dateifluss gesondert prüfen.

## Austauschbare Worker

Der Composer zeigt die Modelle und unterstützten Funktionen des tatsächlichen Workers. Eine Übernahme wird innerhalb der Modellwahl mit dem tatsächlichen Worker und „Vertretung“ erklärt. Eine zusätzliche dauerhafte Worker-Beschriftung unter der Eingabe entfällt. Ein
Planmodus ohne wirksamen Schreibschutz wird nicht angeboten. Workerwahl und
Verbindung liegen ausschließlich unter Einstellungen → Worker. Chats bleiben
beim ursprünglichen Worker; ein Wechsel des Standards betrifft neue Chats.


## Dateien anheften

Drag & Drop und Dateiauswahl nutzen denselben Uploadablauf. Das Ziel ist das konkrete Chatpanel einschließlich Verlauf und Eingabe. Während des Ziehens wird das Ablageziel sichtbar; nach Ablegen erscheinen Uploadstatus, danach Bildvorschauen oder Dateianhänge mit Name und Entfernen-Aktion. Eingabetext bleibt erhalten, Weiterschreiben ist sofort möglich, gesendet wird erst auf Nutzeraktion nach Abschluss der Uploads. Pro Datei gelten 24 MB. Ein Dateifehler verhindert nicht das Anheften weiterer Dateien. Ein Chat- oder Projektwechsel während des Uploads darf die Datei nicht dem neuen Chat zuordnen. Die ursprüngliche Session behält ihre Anhänge.

## Veränderbare Breiten und Workspace

Die Seitenleiste lässt sich an der rechten Trennkante zwischen 220 und 400 px ziehen; ihre Breite bleibt lokal gespeichert. Pfeiltasten bewegen Trennkanten, Doppelklick setzt die automatische Breite zurück. Der Workspace erhält dieselbe Bedienung an der linken Kante, eine Vergrößerungsaktion und eine Rückkehr zur inhaltsabhängigen Breite. Dateilisten starten kompakt, Vorschauen, Terminal und Git-Diffs breiter. Die Chatfläche behält nach Möglichkeit 400 px; bei knappem Platz erscheint der Workspace darüber, auf Mobilgeräten in voller Breite.

Bei geöffnetem Workspace reserviert die globale Chatleiste eine eigene Zeile oberhalb der Inhalte; sie überlagert keine Workspace-Aktionen. Genau ein Sidebar-Symbol rechts in dieser Leiste öffnet oder schließt den Workspace und benennt den aktuellen Zustand. Im Workspace-Kopf wechselt eine beschriftete native Auswahl zwischen Übersicht, Dateien, Terminal und Änderungen; eine zweite Icon-Tabzeile und ein zusätzlicher Schließen-Button entfallen. Daneben schaltet ein diagonales Größen-Symbol zwischen Vergrößern und automatischer Breite um. Auf Mobilgeräten mit voller Workspace-Breite entfällt diese Größenaktion. Die Trennkante behält Doppelklick und Tastaturbedienung.

Der Workspace enthält Dateien, Terminal und Git Review. Eine Browser-Kachel entfällt. Dateien zeigt unabhängig vom Chat den echten Agent-Projektordner des Servers mit allen unmittelbar vorhandenen Einträgen. Geschützte Einträge (versteckte Dateien, Daten-/Schlüsselablage, Abhängigkeiten und ausbrechende Verknüpfungen) sind sichtbar, aber gesperrt. Ordner werden direkt gelesen, Vorschau und Download sind schreibgeschützt. Explizite Chat-Artefakte verwenden weiterhin ihre bisherigen Workspace-Pfade.

Git Review bezieht sich auf das aktive Projekt. Es zeigt den Branch, neue und geänderte Dateien sowie aufklappbare farbige Diffs für Index und Arbeitskopie. Aktualisieren, Laden, Fehler, kein Repository, keine Änderungen und Ausgabebegrenzung sind eigene Zustände. Es führt keine Git-Schreibaktionen aus und hängt nicht von der Worker-Terminalfähigkeit ab.

Das Terminal nutzt den vorhandenen Worker-Anschluss für einzelne Befehle im aktiven Projekt. Jeder Befehl erhält eine neue Shell, maximal 30 Sekunden und begrenzte Ausgabe. Es ist keine persistente interaktive PTY-Sitzung. Laufende, leere oder vom Worker nicht unterstützte Eingaben können nicht abgeschickt werden; Ausgaben, Exit-Code und Fehler bleiben sichtbar.


## Formatierte Antworten und Computer Use

Antworten unterstützen Überschriften, Fett/Kursiv/Durchgestrichen, Zitate, Listen, Links, Tabellen und Codeblöcke. Tabellen erhalten einen fokussierbaren horizontalen Scrollbereich; Codeblöcke eine Kopieraktion. Lokale Markdown-Bilder erscheinen direkt im Text und öffnen die vorhandene Dateivorschau. Externe Bilder werden als Links angeboten. Rohes HTML wird als Text angezeigt; aktive Inhalte gehören nicht in den Chat. Mathematischer Formelsatz, Mermaid und interaktive Artefakte sind damit nicht zugesagt.

Bilder aus der Zwischenablage nutzen denselben Uploadablauf wie Dateiauswahl und Drag & Drop. Anhängen erhält den Entwurf und sendet nicht selbstständig.

Computer-Use-Schritte gehören in die bestehende Werkzeuggruppe. Sie zeigen den tatsächlichen Worker, einen vorhandenen Aktionstitel, Status und gelieferte Bildschirmaufnahmen. Aufnahmen lassen sich herunterladen. Die Darstellung akzeptiert begrenzte typisierte Rasterbilder aus Codex/MCP- und Claude-Ausgaben; fehlende oder ungültige Bilder werden nicht als erfolgreicher Screenshot ausgegeben. Native MCP-Schritte ersetzen gleichnamige Rohereignisse ohne doppelte Anzeige. Der Stoppen-Button des Chats bleibt der gemeinsame Abbruchweg.

Unter der Eingabe gibt es keinen Computer-Use-Einstieg und keine Werkzeugkatalog-Prüfung. Tatsächliche Computer-Use-Aktivität bleibt in den Werkzeuggruppen sichtbar. Bildschirm-/App-Freigaben bleiben beim ausführenden Worker und dessen Computer-Use-Anschluss.

Die leere Navigation „Module“ entfällt. Chat, Aufträge, Verbindungen und Skills bleiben die funktionalen Einstiege.

Derselbe Avatar steht bei den Antwortsignaturen. Nach dem Speichern des Profils übernehmen alle offenen Panels Namen und Avatar über das gemeinsame Identitätsereignis.

Alle sechs Motive zeigen ausschließlich ruhige Augenbewegungen wie in der
Profilvorschau. SVG-Gruppen trennen Blickrichtung und Blinzeln vom stillen Kopf.
Ein gemeinsamer Sichtbarkeitsbeobachter pausiert Avatare außerhalb des sichtbaren
Bereichs. Reduzierte Bewegung in App oder Betriebssystem schaltet sie aus.

Neue, leere Chats zeigen den gewählten Agenten groß über einer kurzen Begrüßung.
Sechs Begrüßungen wechseln beim Anlegen eines neuen Chats; während des Schreibens
bleibt der Text stabil. Die Begrüßung verwendet die zentrale 36-px-Schriftrolle
und bricht bei schmalen Fenstern um. Avatar und optionaler farbiger Hintergrund
entsprechen dem gespeicherten Profil; keine Umrandung des Kreises.

## Kanalgespräche

Nachrichtenanschlüsse verwenden normale Worker-Sessions mit persistenter connectionId/channelOnly-Zuordnung. Solche Gespräche erscheinen vorerst ausschließlich in ihrer Verbindung. Bootstrap und Chatlisten-Endpunkt filtern sie aus der normalen Chatliste; Rückfragen öffnen den Verbindungsdialog. Die spätere gemeinsame Darstellung ist noch nicht beschlossen.

## Zeitgruppen in der Seitenleiste

Chats stehen je Projekt nach letzter Aktivität absteigend. Angeheftete Chats bilden eine eigene Gruppe; danach gliedern dezente beschriftete Linien die sichtbaren Chats in Heute, Gestern, Letzte 7 Tage, Letzte 30 Tage und Älter. Leere Gruppen entfallen. Es gelten lokale Kalendertage; standardmäßig sind alle Chats im Scrollbereich sichtbar. „Weniger anzeigen“ begrenzt bei Bedarf auf fünf aktuelle Chats plus angepinnte Gespräche. Chatzeilen sind am Desktop mindestens 32 px hoch, bei größerer Schrift dürfen sie wachsen; Touch-Zeilen bleiben mindestens 44 px hoch. Gruppentitel und Chatnamen teilen die Textkante der Navigation, Status und Chataktionen eine gemeinsame linke Symbolspalte vor dem Chatnamen.

## Reiseeffekt im Chat

Neue Chats ohne Gespräch zeigen standardmäßig dezente Lichtpunkte in drei Tiefenebenen, die langsam aus der Mitte nach außen wandern und sanft pulsieren. Inhalt und Layout bleiben unverändert. Unter Aussehen → Visuell → Reiseeffekt stehen „Aus“, „Nur neue Chats“ (Standard) und „Alle Chats“ dauerhaft zur Auswahl. „Alle Chats“ zeigt den Effekt auch hinter bestehenden Gesprächen in jedem sichtbaren Panel. Reduzierte Bewegung in App oder System zeigt ruhende Punkte; unsichtbare Ansichten pausieren.

## Schwebende Flächen

Die Seitenleiste liegt mit Abstand zum Fensterrand und großen abgerundeten Ecken auf der Grundfläche; ihre Farben und Navigation bleiben erhalten. Die Größenänderung bleibt an ihrer rechten Kante erreichbar. Der Composer liegt rahmenlos und ohne Schatten als flache, in der bisherigen Composerfarbe getönte Blur-Fläche über dem Verlauf. Nachrichten scrollen sichtbar dahinter weiter. Dynamischer Endabstand berücksichtigt Eingabehöhe und Anhänge, damit die letzte Nachricht vollständig oberhalb der Eingabe erreichbar bleibt. Modus und Modell bleiben darunter lesbar. Tastaturfokus bleibt sichtbar.

In der Einzelansicht entfällt der ausgeschriebene Chattitel oben. Ein kompaktes Chatmenü erhält sämtliche Aktionen; die Kopfaktionen schweben über dem nach oben ausblendenden Verlauf. Mehrfachansichten verwenden dasselbe kompakte Drei-Punkte-Menü oben rechts pro Panel; der Titel bleibt im Tooltip und zugänglichen Namen erhalten. Maximieren und Panel schließen stehen im jeweiligen Menü. Unter dem Composer stehen Modus und Modell als freier Text ohne eigene gefüllte Fläche. Der Verlauf blendet über die unteren 192 px weich bis zum Bildschirm- beziehungsweise Panelrand aus. Vollständige Transparenz wird erst am unteren Rand erreicht, nicht bereits an der Optionszeile. Diktat verwendet dieselbe kreisrunde Trefferfläche wie Senden mit größerem Mikrofonmotiv. Die Ziehkante der Seitenleiste erscheint nur bei Hover/Fokus; lange Chatnamen laufen ohne Ellipse weich aus. Projektnamen verwenden keinen Fade, sondern nur bei tatsächlichem Platzmangel eine Ellipse.

Spinner, Ungelesen-, Fehler- und Stoppstatus stehen links vor dem Chatnamen. Bei Hover/Fokus übernimmt dort das Chatmenü den Platz. Rechts entfällt der reservierte Aktionsbereich; Chatnamen reichen bis auf 12 px an die Seitenleistenfläche und blenden über die letzten 12 px aus. Das relative Alter erscheint bei Hover/Fokus rechts im Zeilenlayout ohne eigene Hintergrundfläche. Der Titel nutzt die verbleibende Breite und läuft weich aus; das Alter bleibt zusätzlich im Tooltip. Die ausgewählte Zeile behält auch bei Hover/Fokus ihre einheitliche Auswahlfläche.

Die Agentenzeile unten besitzt einen nach innen versetzten, abgerundeten Hover-/Auswahlzustand ohne durchgehende Trennlinie. Das Agentenmenü öffnet mit 8 px Abstand oberhalb der tatsächlichen Zeilenhöhe und folgt deren seitlichen Kanten. Der Verbindungsstatus bleibt separat bedienbar und vertikal zentriert.

Projektnamen nutzen die flexible Breite bis zur Plus-Aktion. Auf Geräten mit präzisem Hover reservieren ausgeblendetes Projektmenü und Einklapppfeil im Ruhezustand keinen Platz; bei Hover oder Tastaturfokus sowie auf Touchgeräten bleiben die Aktionen erreichbar. Der vollständige Projektname steht auch im Tooltip.

Anhänge im Composer sind kompakte, rahmenlose Chips mit getöntem Blur-Hintergrund und 32-px-Bildvorschau. Vorschau und Dateiname öffnen per Klick oder Tastatur die vorhandene größere Dateiansicht; Entfernen bleibt eine separate Aktion. Der Entwurf bleibt dabei erhalten. Lange Namen werden innerhalb der maximal 260 px breiten Chips gekürzt, der vollständige Name bleibt im Tooltip und zugänglichen Aktionsnamen erhalten.

Die globale Chatkopfzeile richtet ihre Bedienelemente auf derselben Höhe wie die Agent-Überschrift der eingerückten Seitenleiste aus. Rechts stehen in der Einzelansicht Chatmenü, Ansichtsaufteilung und Workspace zusammen; links bleibt nur bei geschlossener Seitenleiste deren Öffnen-Button. Einzelansicht, Mehrfachansicht und geöffneter Workspace teilen diese Höhe. In der schwebenden Einzelansicht blendet der Verlauf über die oberen 192 px weich aus und wird erst unmittelbar am oberen Bildschirmrand vollständig transparent. Es gibt keine vorzeitig unsichtbare Zone hinter der Kopfzeile.

Chat und Workspace besitzen eigene Kopfbereiche. Der Workspace reicht mit 8 px Außenabstand von der oberen bis zur unteren Fensterkante und übernimmt Fläche, Rundung und Innenabstand der Seitenleiste. Beide liegen vor einem dunkleren ruhigen Hintergrund. Die Einzelansicht behält beim Öffnen und Schließen ihren schwebenden Chatkopf und dieselbe obere Verlaufskante. Mehrfachansichten reichen ebenfalls bis zur oberen Kante. Panelmenüs und globale Ansichts-/Workspace-Aktionen teilen eine schwebende Kopfzeile ohne Überschneidung. Bei Platzmangel liegen die Paneltabs darunter über dem Verlauf; Workspace-Köpfe erhalten keinen Tabversatz. Auf schmalen Fenstern überlagert der Workspace den Chat und bleibt über seinen eigenen Schließen-Button erreichbar. Vergrößern zeigt den Workspace über die gesamte Chatfläche; erneutes Betätigen kehrt zur automatischen Breite zurück.

Seitenleisten-Chatliste, Gesprächsverlauf und Composer behalten Scrollfunktion und Tastaturbedienung ohne sichtbare Scrollleisten. Code, Tabellen und Dateiansichten behalten ihre nativen Scrollleisten. Im erzwungenen Kontrastmodus bleiben native Scrollleisten auch in den drei genannten Bereichen sichtbar.


## Native Sitzungsauswahl

Bei ACP-Chats stehen gemeldete Slash-Befehle neben Modus und Modell in einem
kompakten Menü. Das Menü zeigt Beschreibung und Eingabehinweis. Die Auswahl setzt den Befehl in den Entwurf;
erst Senden führt ihn aus. Nicht gemeldete und ausdrücklich leere Listen sind
unterschiedlich beschriftet. Manuell eingegebene Befehle bleiben möglich.
Gemeldete Sitzungseinstellungen erscheinen in ihrer nativen Reihenfolge als
Auswahlmenüs an derselben Stelle. Native Modi sind keine Zusage eines
Wrapper-Schreibschutzes. Änderungen warten auf die Worker-Bestätigung und sind
während laufender Arbeit gesperrt. Unbekannte Optionstypen und Updatearten
erscheinen als nicht bedienbar beziehungsweise im Hinweismenü.

Die Überschrift „Projekte“ und die Projektzeilen bleiben beim Scrollen fest stehen. Nur die Chatliste des aufgeklappten Projekts scrollt im verbleibenden Platz. Die Chatliste verwendet den gemeinsamen ScrollEdgeFade: oben und unten jeweils nur 8 px, ausschließlich wenn in dieser Richtung weiterer Inhalt außerhalb des sichtbaren Bereichs liegt. Am Listenanfang und -ende entfällt der jeweilige Fade. Auswahlflächen bleiben außerhalb dieses schmalen Randes deckend; 32 px Endabstand halten den letzten Eintrag vollständig erreichbar. Im erzwungenen Kontrastmodus entfällt die Maske. Die Agentenzeile bleibt außerhalb des Scrollbereichs.

Im Agentenmenü folgt unter „Archivierte Chats“ die Aktion „Server neu starten“ mit dem vorhandenen RotateCcw-Symbol und derselben Menügestaltung. Text und Symbol verwenden die zurückhaltende Sekundärfarbe `muted`. Sie nutzt den gemeinsamen Neustartablauf von SystemNotice, auch ohne verfügbares Update. Während des Neustarts ist die Aktion deaktiviert; laufende Sessions verlangen die bestehende Bestätigung.

## Gemeinsame Ladeanzeige

Unter Aussehen → Ladeanzeige stehen alle 17 Loader-Varianten als kompakte
Radioauswahl mit gleich großen Vorschauplätzen. ASCII ist der Standard, Dither
steht direkt daneben. Größe und Tempo werden wie die übrigen Darstellungswerte
sofort serverseitig gespeichert. Seitenleiste, Paneltabs und Chatstatus verwenden
denselben AppLoader und übernehmen Änderungen auch in offenen Panels. Breite
Varianten werden innerhalb eines festen Platzes optisch verkleinert. Prozent
ist eine wiederholte Animation, kein gemessener Fortschritt; die Auswahl nennt
diesen Unterschied. App- und Systempräferenz für reduzierte Bewegung zeigen
einen statischen Zustand. Animierte Glyphen sind vor Screenreadern verborgen.

Einzel- und Mehrfachansicht verwenden schwebende Drei-Punkte-Chatmenüs auf derselben oberen Linie. Ausgeschriebene Paneltitel und eine zusätzliche Panelkopfzeile entfallen. Maximieren und Schließen sind im Panelmenü erreichbar. Alle Verläufe teilen den oberen Fade; die rechte Panelaktion reserviert Platz für die globalen Ansicht-/Workspace-Buttons.

## Suche und kompakte Seitenleiste

Die Suchpille ersetzt „AGENT“ oben links und öffnet denselben fokussierten Dialog wie Cmd/Ctrl+K. Sie findet Gesprächstitel und lokal gespeicherte Gesprächstexte aller Projekte, auch archivierte Chats, sowie Projekte und Bereiche/Einstellungen. Mehrere Suchwörter müssen vorkommen; Akzente, ß und einzelne Tippfehler in längeren Wörtern werden toleriert. Treffer zeigen Projekt, Archivstatus und Textausschnitt; Öffnen verwendet die bestehende Panel-/Entwurfslogik. Keine Werkzeugausgaben, internen Überlegungen oder reinen Kanalgespräche durchsuchen. Lade-, Leer-, Fehler- und Teilverfügbarkeitszustände sind sichtbar; veraltete Suchantworten werden verworfen.

Navigation und Projektgruppen sind kompakter, sodass die vollständige Chatliste den verbleibenden Raum nutzt. Projektköpfe bleiben außerhalb ihres Scrollbereichs. Die Agentenzeile erhält einen kleineren Avatar und weniger vertikalen Innenabstand. Touchziele bleiben mindestens 44 px. Das Plus im Composer teilt die kreisrunde Grundform aller Iconbuttons, auch beim Hover.
