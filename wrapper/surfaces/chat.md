# Chat und Projekte

## Automatische Chat-Titel

Der zuständige Worker erzeugt den Titel mit dem gewählten Modell in einer separaten Hintergrundanfrage anhand der ersten Nutzernachricht. Beide Anschlusswege verwenden die zentrale Regel und Prüfung in `chat-title.mjs`: möglichst 2–3 Wörter, höchstens 4 Wörter und 28 Zeichen einschließlich Leerzeichen. Das Hauptthema steht zuerst; bei Überlänge wird neu formuliert, niemals abgeschnitten. Ein ungültiges Ergebnis wird einmal neu angefragt, danach gilt „Neues Anliegen“. Manuelle Benennungen bleiben geschützt; bestehende Titel werden nur auf ausdrücklichen Auftrag überarbeitet.

## Aufbau und Erweiterungen

Die bisherige Projektgruppe heißt in der Seitenleiste „Workspace“. Hinzufügen und Bearbeiten verwenden dieselbe Bezeichnung im bestehenden Dialog. Projekt-IDs, Daten und Ordner bleiben erhalten.

Die Agentenidentität oben links öffnet als ganzer Avatar-/Namensbutton das Agent-Menü. AgentMenu verwendet Avatar und das gemeinsame ChatMenu; der Verbindungspunkt ist Teil des Buttons, sein zugänglicher Name nennt den Zustand. Der konfigurierte Name wird nicht durch einen festen Produktnamen ersetzt. ServerDetails zeigt im geöffneten Menü Verbindung, Serveradresse, tatsächlich gemeldete Engine und gemessene HTTP-Antwortzeit. Fehler und fehlende Werte bleiben ausdrücklich sichtbar. Danach folgen Nutzung, Einstellungen, Archivierte Chats und Server neu starten. Kein separater Statusbutton und keine Agentenzeile am Fuß. Auch in Einstellungen und Inbox bleibt der Kopf erreichbar.

Die Projekt-/Chatnavigation liegt in der Seitenleiste. Ein unbenannter neuer Chat zeigt oben keinen Titel und keinen separaten Einstieg „Bestehenden Chat öffnen“. Benannte Entwürfe und bestehende Chats behalten ihr kompaktes Chatmenü. Bei mehreren Panels gehört jedes Drei-Punkte-Menü zum jeweiligen Panel. Die globale Chatleiste enthält die Ansichts- und Workspace-Aktionen ohne untere Trennlinie. Chatfläche zeigt Nutzereingaben, Antworten und kompakte Werkzeugaktivität. Der Composer besteht aus einer pillenförmigen Schreibzeile: Anhängen, Eingabe, genau ein Mikrofon für Diktat, Senden/Stoppen. Unter der Pille steht nur die Modellwahl, links ausgerichtet in der kompakten Schriftrolle caption und mit je 2 px Abstand oben und unten. Arbeitsmodus und Fast liegen im geöffneten Modellfenster: links der Fast-Blitz, rechts Wrench oder SquarePen mit Chevron. Das gemeinsame ChatMenu bietet Umsetzen und Planen ausgeschrieben mit Auswahlhaken. Tooltip und zugänglicher Name nennen den aktiven Modus. Planen bleibt ohne wirksamen Schreibschutz deaktiviert; während laufender Arbeit ist die Moduswahl gesperrt. Fokus, Escape und Klicks im Untermenü erhalten das übergeordnete Modellfenster. Im geschlossenen Modelltrigger kennzeichnet ein kleines Planicon den Planmodus. Fast verwendet aktiv Terrakotta (brand-accent), eine stärkere Kontur und den gemeinsamen Auswahlring. Touchziele bleiben mindestens 44 px hoch. Modellname und Denkaufwand bleiben gemeinsam auswählbar. Keine separate Worker-Beschriftung oder Computer-Use-Schaltfläche im Composer. Bei mehrzeiligen Entwürfen wächst die Schreibfläche; ihre Rundung bleibt erhalten. Zusätzliche direkt benötigte Aktionen sind knappe Iconbuttons mit Tooltip und zugänglichem Namen. Keine Konfiguration oder Verlaufsverwaltung im Composer.

Projekte werden über das Plus an „Workspace“ ergänzt; Chats über das Plus am Projekt. Kontextmenüs und bestehende Dialoge für Bearbeiten verwenden. „Workspace bearbeiten …“ öffnet den gemeinsamen Projektdialog. Unter dem Projektsymbol folgt eine vordefinierte Farbauswahl mit Farbnamen, Auswahlhaken und Tastaturfokus. Die Farbe gilt für das Projektsymbol in Seitenleiste und Chatkopf; „Standard“ verwendet die bisherige neutrale Darstellung. Neue Projekte nutzen denselben Dialog, bestehende Projekte ohne Farbwert bleiben neutral. Der kompakte Projektdialog zeigt eine gemeinsame Vorschau von Symbol und Farbe neben dem Namen, darunter rahmenlos gruppierte Radioauswahlen und eine flache, stets erreichbare Aktionsleiste. Der Dialog nutzt die zentrale transparente Glasfläche mit Hintergrundunschärfe. Nur der Inhalt scrollt, ohne sichtbare Scrollleiste; Kopf und Aktionen bleiben stehen. Bei reduzierter Transparenz oder fehlender Blur-Unterstützung ist die Fläche deckend. Speichern überträgt Name, Symbol und Farbe gemeinsam; erneutes Öffnen und Neuladen erhalten die Auswahl. Mehrfachansichten behalten unabhängige Entwürfe und die gemeinsame Eventverbindung.

## Streaming und Scrollposition

Verlauf und Composer teilen dieselbe zentrierte Inhaltsspalte und dieselben horizontalen Kanten. Die Sprungmarken für bisherige Eingaben bleiben in einem reservierten linken Rand außerhalb der Inhalte, auch beim Streaming und in schmalen Chatpanels. Scrollleisten verändern die Ausrichtung der Inhaltsspalte nicht. Die maximale Inhaltsbreite beträgt 760 px und wächst auf großen Bildschirmen nicht weiter. Panels bis 620 px Breite behalten beidseitig 32 px Rand, größere mindestens 64 px. Die aufgeklappte Eingabevorschau bleibt ein vorübergehendes Overlay und reserviert keine dauerhafte zusätzliche Spalte.

Jedes Chatpanel folgt neuen Inhalten am unteren Rand, solange der Nutzer nicht nach oben scrollt. Text, Werkzeugwechsel, nachgeladene Vorschauen und Größenänderungen werden vor der Darstellung am tatsächlichen unteren Rand ausgerichtet. Automatisches Scrollen bewegt ausschließlich den Verlauf des jeweiligen Panels. Hochscrollen pausiert das Mitlaufen sofort; unten angekommen oder über „Zur neuesten Nachricht“ wird es wieder aktiviert. Layoutänderungen dürfen diese Entscheidung nicht umschalten. Beim Chatwechsel werden Leseposition und Mitlaufzustand gemeinsam erhalten.

## Sprache

Im normalen Composer gibt es genau ein Sprachsymbol: Mikrofon = Diktat in den Entwurf. Keine zusätzlichen Einstiege für Sprachchat oder Vorlesen. Bestehende Ausgabe-Einstellungen und gesicherte Aufnahmen bleiben unter Stimme; die vereinfachte Chatbedienung startet keinen Sprachchat. Während Diktat ersetzt eine einzeilige Pegelleiste Textfeld, Anhang-Plus und normale Sendeaktionen innerhalb derselben Composer-Pille. Ihre Höhe bleibt wie im Ruhezustand; vorhandene Entwürfe und Anhänge bleiben erhalten. Die Leiste zeigt tatsächlichen Pegel, Laufzeit, Pause/Fortsetzen, Papierkorb, Haken und rechts das gemeinsame Senden-Pfeilicon. Der Haken erkennt und ergänzt nur den Entwurf. „Diktat direkt senden“ beendet die Aufnahme, sichert sie, erkennt den Text und sendet ihn einmal gemeinsam mit bestehendem Entwurf und Anhängen. Kein zusätzlicher Modusschalter und kein X während der Aufnahme. Beim Sichern/Erkennen bleiben ein kurzer Status und Schließen zum Abbrechen der Textübernahme bzw. Direktübertragung. Fehler und leere Erkennung senden nichts; Audio bleibt wiederherstellbar, nach Sendefehlern bleibt der Text im Entwurf. Chatwechsel bricht eine ausstehende Direktübertragung ab. Touchziele bleiben mindestens 44 px; die Pegelbreite passt sich an schmale Panels an. Keine Schaltfläche „Aufnahmen“ und keine erklärende Textkarte im normalen Chat. Fehlermeldungen nur bei tatsächlichen Fehlern und mit einem Wiederherstellungsweg.

Diktat übernimmt erkannten Text in den Entwurf. Sprachchat darf erkannte Äußerungen an den ausgewählten Chat senden und die fertige Antwort vorlesen. Automodus gilt nur innerhalb eines bewusst gestarteten Sprachchats. Chatwechsel/Schließen beendet die Sprachbedienung; bereits gesicherte Aufnahmen bleiben erhalten. Rückfragen und Werkzeugfreigaben bleiben im vorhandenen Chatfluss. Keine Erklärungen, Werkzeugausgaben oder Codeblöcke ungefragt vorlesen.

## Details und Einstellungen

Aufnahmearchiv, Anbieterwahl, Geräte und Stimmen gehören unter **Einstellungen → Stimme**. Verbinden externer Anbieter gehört unter **Verbindungen**. Keine neuen Aufnahme-Popovers mit eigenem Archiv oder Anbieterformular.

## Werkzeuge und Ergebnisse

Werkzeuggruppen bleiben kompakt und aufklappbar. Eine gedämpfte Tätigkeitszeile mit passendem Linienicon fasst zusammen, was passiert ist, etwa „Dateien gelesen und Befehle ausgeführt“. Überlegungen werden nicht zusätzlich in die Zusammenfassung aufgenommen, wenn konkrete Werkzeugaktivitäten vorliegen; sie bleiben in den Details zugänglich. Der Aufklapppfeil folgt unmittelbar dem Text. Die Zusammenfassung verwendet die kleine Beschriftungsrolle und einen engen Abstand zum Gespräch. Fehlgeschlagene Schritte stehen mit Anzahl in derselben gedämpften Textfarbe direkt im Lesefluss; rote Fehlerdetails erscheinen erst beim Öffnen des betroffenen Schritts. Ein fehlgeschlagener Gesamtauftrag bleibt als solcher sichtbar. Workername und technische Herkunft stehen ausschließlich in den geöffneten Schrittdetails, nie rechts in der Zusammenfassung. Auch die einzelnen Schrittzeilen bleiben einspaltig; ihr Chevron folgt dem Text. Unvollständige Schritte dürfen nicht als abgeschlossen erscheinen. Über der Antwort stehen Avatar, Name und relatives Alter ohne Trennlinie. Der kompakte Arbeitsstatus steht direkt unter dem neuesten Antworttext vor der einblendbaren Aktionszeile (Vorlesen, Kopieren, Verzweigen, Erneut ausführen). Die Reihenfolge ist Text → Schritte/Laufzeit → Nachrichtenaktionen → Dateiergebnisse und etwaige Fehler; ausgeblendete Aktionen erzeugen keine Lücke zwischen Text und Status. Er wandert während des Schreibens nach unten und bleibt beim automatischen Mitlaufen über dem Composer sichtbar; manuelles Hochscrollen bleibt möglich. Bei Werkzeugaktivität bildet die aufklappbare Zusammenfassung denselben Status samt Schrittanzahl, Zeit und gewähltem AppLoader während laufender Arbeit. Nach Abschluss bleibt die Zusammenfassung mit Dauer unten am Antwortblock; Fehler und Abbruch bleiben sichtbar. Der Sekundentakt aktualisiert nur diese Komponente, ohne wiederholte Screenreader-Ansage der Zeit. Vorliegende Diffs zeigen hinzugefügte und entfernte Zeilen mit Plus/Minus und semantischen Farben. Große Ausgaben werden begrenzt und auf Nachfrage erweitert. Fehlgeschlagene Schritte dürfen nicht als erfolgreiche Dateierstellung erscheinen.

Bestätigte Dateiergebnisse werden unter dem Turn in der gemeinsamen Komponente ChatArtifacts gesammelt, sofern dieselbe Datei nicht bereits im Antworttext verlinkt oder als Bild dargestellt ist. Der Vergleich nutzt normalisierte lokale Pfade unabhängig von der Reihenfolge der Werkzeug- und Antwortdaten. Sind alle Dateien bereits verlinkt, entfällt die zusätzliche Dateigruppe vollständig. Standardmäßig steht dort nur eine gedämpfte, aufklappbare Zeile „1 Datei“ beziehungsweise „N Dateien“ mit Dateisymbol und Chevron direkt am Text. Erst beim Öffnen erscheinen kompakte Dateizeilen in der kleinen Beschriftungsrolle mit Vorschau und Download. Sie zeigen nur den Dateinamen; der vollständige Pfad ist über den Tooltip erreichbar. Prüfberichte werden wie alle anderen Dateien erhalten und bleiben anklickbar; geschlossene Gruppen laden keine Vorschauen. Die Gruppe bleibt per Tastatur und auf Touch bedienbar, der Zustand ist über aria-expanded erkennbar. Dateilinks im Antworttext bleiben direkt erreichbar. Alle Links in Chatantworten folgen der ausgewählten Hervorhebungsfarbe `accent`, einschließlich Terrakotta; keine fest blaue Linkfarbe. Bilder bieten eine direkte Vorschau; Dokumente eine aufklappbare Vorschau oder einen Download. Externe Links werden nicht für Vorschauen abgerufen. Alle lokalen Pfade bleiben im freigegebenen Arbeitsbereich. Fehlende Dateien, nicht unterstützte Formate und Zeitüberschreitungen erhalten einen verständlichen Zustand und einen Wiederholungs- oder Downloadweg. Dateiwechsel brechen veraltete Ladevorgänge ab.

Die gemeinsame Darstellung verarbeitet normalisierte öffentliche Werkzeugdaten. Codex ist live geprüft; Claude-tool_use/tool_result einschließlich Bildausgaben ist als Datenformat im Adapter getestet, keine bestehende Claude-Code-Verbindung. Neue Engine-Anbindungen müssen denselben Vertrag erfüllen und ihren vollständigen Event-/Dateifluss gesondert prüfen.

## Austauschbare Worker

Der Composer zeigt die Modelle und unterstützten Funktionen des tatsächlichen Workers. Eine Übernahme wird innerhalb der Modellwahl mit dem tatsächlichen Worker und „Vertretung“ erklärt. Eine zusätzliche dauerhafte Worker-Beschriftung unter der Eingabe entfällt. Ein
Planmodus ohne wirksamen Schreibschutz wird nicht angeboten. Die gemeinsame Modellwahl bietet Codex und Claude Code immer als anklickbare Bereiche mit Original-Icons aus `BrandIcon`. Andere bestehende Worker erscheinen dort, wenn sie das aktuelle Gespräch führen. Standard und Vertretung bleiben unter Einstellungen → Worker. Ein ausdrücklicher Anbieterwechsel setzt denselben sichtbaren Chat fort. Chat-ID, Titel, Projekt, Entwurf, Anhänge und Verlauf bleiben erhalten. Im Leerlauf heißt die Aktion „Mit … fortsetzen“, während einer Antwort „Stoppen und wechseln“. Erst wird die Zielanmeldung geprüft, dann gegebenenfalls die bisherige Antwort gestoppt und deren Abschluss bestätigt. Der neue Worker erhält eine eigene native Sitzung und den bisherigen Gesprächskontext. Fehler vor der Übernahme verändern die bisherige Zuordnung nicht. Automatische Jobs und Kanalgespräche bleiben fest zugeordnet. Die Anbieterwahl im Chat verändert den globalen Standard nicht.


## Dateien anheften

Drag & Drop und Dateiauswahl nutzen denselben Uploadablauf. Das Ziel ist das konkrete Chatpanel einschließlich Verlauf und Eingabe. Während des Ziehens wird das Ablageziel sichtbar; nach Ablegen erscheinen Uploadstatus, danach Bildvorschauen oder Dateianhänge mit Name und Entfernen-Aktion. Eingabetext bleibt erhalten, Weiterschreiben ist sofort möglich, gesendet wird erst auf Nutzeraktion nach Abschluss der Uploads. Pro Datei gelten 24 MB. Ein Dateifehler verhindert nicht das Anheften weiterer Dateien. Ein Chat- oder Projektwechsel während des Uploads darf die Datei nicht dem neuen Chat zuordnen. Die ursprüngliche Session behält ihre Anhänge.

## Veränderbare Breiten und Workspace

Die Seitenleiste lässt sich an der rechten Trennkante zwischen 220 und 400 px ziehen; ihre Breite bleibt lokal gespeichert. Pfeiltasten bewegen Trennkanten, Doppelklick setzt die automatische Breite zurück. Der Workspace erhält dieselbe Bedienung an der linken Kante, eine Vergrößerungsaktion und eine Rückkehr zur kompakten Breite. Jeder neue Öffnungsvorgang startet mit 280 px; Dateien, Vorschauen, Befehle und Änderungen verbreitern ihn nicht automatisch. Manuelles Ziehen bleibt bis zum Schließen erhalten. Die Chatfläche behält nach Möglichkeit 400 px; bei knappem Platz erscheint der Workspace darüber, auf Mobilgeräten in voller Breite.

Bei geöffnetem Workspace reserviert die globale Chatleiste eine eigene Zeile oberhalb der Inhalte; sie überlagert keine Workspace-Aktionen. Genau ein Sidebar-Symbol rechts in dieser Leiste öffnet oder schließt den Workspace und benennt den aktuellen Zustand. Im Workspace-Kopf wechselt eine kompakte native Auswahl zwischen Dateien, Änderungen und Befehle. Der Workspace öffnet direkt Dateien, eine vorgeschaltete Kachelübersicht entfällt. Der eigene Schließen-Button bleibt für überlagernde mobile Ansichten erreichbar. Daneben schaltet ein diagonales Größen-Symbol zwischen Vergrößern und automatischer Breite um. Auf Mobilgeräten mit voller Workspace-Breite entfällt diese Größenaktion. Die Trennkante behält Doppelklick und Tastaturbedienung.

Der Workspace enthält Dateien, Terminal und Git Review. Eine Browser-Kachel entfällt. Dateien zeigt unabhängig vom Chat den echten Agent-Projektordner des Servers mit allen unmittelbar vorhandenen Einträgen. Geschützte Einträge (versteckte Dateien, Daten-/Schlüsselablage, Abhängigkeiten und ausbrechende Verknüpfungen) sind gesperrt und über „geschützte einblenden“ sichtbar. Ordner werden direkt gelesen, Vorschau und Download sind schreibgeschützt. Explizite Chat-Artefakte verwenden weiterhin ihre bisherigen Workspace-Pfade.

Git Review bezieht sich auf das aktive Projekt. Es zeigt den Branch, neue und geänderte Dateien sowie aufklappbare farbige Diffs für Index und Arbeitskopie. Aktualisieren, Laden, Fehler, kein Repository, keine Änderungen und Ausgabebegrenzung sind eigene Zustände. Es führt keine Git-Schreibaktionen aus und hängt nicht von der Worker-Terminalfähigkeit ab.

Die Nebenfunktion „Befehle“ nutzt den vorhandenen Worker-Anschluss für einzelne Befehle im aktiven Projekt. Jeder Befehl erhält eine neue Shell, maximal 30 Sekunden und begrenzte Ausgabe. Es ist keine persistente interaktive PTY-Sitzung. Laufende, leere oder vom Worker nicht unterstützte Eingaben können nicht abgeschickt werden; Ausgaben, Exit-Code und Fehler bleiben sichtbar.


## Formatierte Antworten und Computer Use

Antworten unterstützen Überschriften, Fett/Kursiv/Durchgestrichen, Zitate, Listen, Links, Tabellen und Codeblöcke. Tabellen erhalten einen fokussierbaren horizontalen Scrollbereich; Codeblöcke eine Kopieraktion. Lokale Markdown-Bilder erscheinen direkt im Text und öffnen die vorhandene Dateivorschau. Externe Bilder werden als Links angeboten. Rohes HTML wird als Text angezeigt; aktive Inhalte gehören nicht in den Chat. Mathematischer Formelsatz, Mermaid und interaktive Artefakte sind damit nicht zugesagt.

Bilder aus der Zwischenablage nutzen denselben Uploadablauf wie Dateiauswahl und Drag & Drop. Anhängen erhält den Entwurf und sendet nicht selbstständig.

Computer-Use-Schritte gehören in die bestehende Werkzeuggruppe. Sie zeigen den tatsächlichen Worker, einen vorhandenen Aktionstitel, Status und gelieferte Bildschirmaufnahmen. Aufnahmen lassen sich herunterladen. Die Darstellung akzeptiert begrenzte typisierte Rasterbilder aus Codex/MCP- und Claude-Ausgaben; fehlende oder ungültige Bilder werden nicht als erfolgreicher Screenshot ausgegeben. Native MCP-Schritte ersetzen gleichnamige Rohereignisse ohne doppelte Anzeige. Der Stoppen-Button des Chats bleibt der gemeinsame Abbruchweg.

Unter der Eingabe gibt es keinen Computer-Use-Einstieg und keine Werkzeugkatalog-Prüfung. Tatsächliche Computer-Use-Aktivität bleibt in den Werkzeuggruppen sichtbar. Bildschirm-/App-Freigaben bleiben beim ausführenden Worker und dessen Computer-Use-Anschluss.

Das Hauptmenü zeigt Inbox, Aufträge und die verfügbare Bibliothek; darunter bleiben Projekte und Chats. Verbindungen und Skills werden über die Einstellungen im Agentenmenü erreicht. Modul-Platzhalter und reservierte Leerzeilen entfallen. Symbole, Textkanten, Abstände und Flächengestaltung bleiben erhalten.

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

## Startvorschläge

Die drei Startvorschläge stehen als `WelcomeSuggestions` unter der Begrüßung.
Ihre sichtbare Glasfläche ist mindestens 32 px hoch, vollständig abgerundet,
stark transparent und mit 40 px Blur, ohne Rahmen oder Schatten. Abstände,
Schrift und transparente Farbrollen kommen aus der zentralen Designquelle.
Bis 620 px Gruppenbreite verwenden sie caption statt small und verzichten auf
die dekorativen Pfeile. Die vollständigen Beschriftungen bleiben erhalten;
Pillen umbrechen nach verfügbarem Platz und werden nicht auf gleiche Breite
gestreckt. Touchziele sind unabhängig von der sichtbaren Fläche mindestens
44 px hoch. Große Schrift und lange Texte dürfen die Pillen vergrößern.
Hover, Fokus, deaktivierter Zustand und deckende Ersatzflächen bei reduzierter
Transparenz beziehungsweise fehlendem Blur bleiben unterstützt. Eine Auswahl
füllt wie bisher nur den Entwurf und fokussiert die Eingabe; sie sendet nichts.

## Reiseeffekt im Chat

Neue Chats ohne Gespräch zeigen standardmäßig dezente Lichtpunkte in drei Tiefenebenen, die langsam aus der Mitte nach außen wandern und sanft pulsieren. Inhalt und Layout bleiben unverändert. Unter Aussehen → Visuell → Reiseeffekt stehen „Aus“, „Nur neue Chats“ (Standard) und „Alle Chats“ dauerhaft zur Auswahl. „Alle Chats“ zeigt den Effekt auch hinter bestehenden Gesprächen in jedem sichtbaren Panel. Reduzierte Bewegung in App oder System zeigt ruhende Punkte; unsichtbare Ansichten pausieren.

## Schwebende Flächen

Die Seitenleiste liegt mit Abstand zum Fensterrand und großen abgerundeten Ecken auf der Grundfläche; ihre Farben und Navigation bleiben erhalten. Die Größenänderung bleibt an ihrer rechten Kante erreichbar. Der Composer liegt rahmenlos und ohne Schatten als flache, in der bisherigen Composerfarbe getönte Blur-Fläche über dem Verlauf. Nachrichten scrollen sichtbar dahinter weiter. Dynamischer Endabstand berücksichtigt Eingabehöhe und Anhänge, damit die letzte Nachricht vollständig oberhalb der Eingabe erreichbar bleibt. Modus und Modell bleiben darunter lesbar. Tastaturfokus bleibt sichtbar.

In der Einzelansicht entfällt der ausgeschriebene Chattitel oben. Ein kompaktes Chatmenü erhält sämtliche Aktionen; die Kopfaktionen schweben über dem nach oben ausblendenden Verlauf. Mehrfachansichten verwenden dasselbe kompakte Drei-Punkte-Menü oben rechts pro Panel; der Titel bleibt im Tooltip und zugänglichen Namen erhalten. Maximieren und Panel schließen stehen im jeweiligen Menü. Unter dem Composer stehen Modus und Modell als freier Text ohne eigene gefüllte Fläche. Der Verlauf blendet über die unteren 192 px weich bis zum Bildschirm- beziehungsweise Panelrand aus. Vollständige Transparenz wird erst am unteren Rand erreicht, nicht bereits an der Optionszeile. Diktat verwendet dieselbe kreisrunde Trefferfläche wie Senden mit größerem Mikrofonmotiv. Die Ziehkante der Seitenleiste erscheint nur bei Hover/Fokus; lange Chatnamen laufen ohne Ellipse weich aus. Projektnamen verwenden keinen Fade, sondern nur bei tatsächlichem Platzmangel eine Ellipse.

Spinner, Ungelesen-, Fehler- und Stoppstatus stehen links vor dem Chatnamen. Bei Hover/Fokus übernimmt dort das Chatmenü den Platz. Rechts entfällt der reservierte Aktionsbereich; Chatnamen reichen bis auf 12 px an die Seitenleistenfläche und blenden über die letzten 12 px aus. Das relative Alter erscheint bei Hover/Fokus rechts im Zeilenlayout ohne eigene Hintergrundfläche. Der Titel nutzt die verbleibende Breite und läuft weich aus; das Alter bleibt zusätzlich im Tooltip. Die ausgewählte Zeile behält auch bei Hover/Fokus ihre einheitliche Auswahlfläche.

Der Agentenbutton im Kopf besitzt den vorhandenen abgerundeten Hover-/Auswahlzustand. Das gemeinsame Menü öffnet unter dem Button, wird als Portal innerhalb des Viewports positioniert und scrollt bei knapper Höhe. Pfeiltasten, Home/End, Escape, Tab und Außenklick verwenden die bestehende ChatMenu-Bedienung. Lange Agentennamen bleiben im Tooltip und zugänglichen Namen vollständig erhalten.

Projektnamen nutzen die flexible Breite bis zur Plus-Aktion. Auf Geräten mit präzisem Hover reservieren ausgeblendetes Projektmenü und Einklapppfeil im Ruhezustand keinen Platz; bei Hover oder Tastaturfokus sowie auf Touchgeräten bleiben die Aktionen erreichbar. Der vollständige Projektname steht auch im Tooltip.

Anhänge im Composer sind kompakte, rahmenlose Chips mit getöntem Blur-Hintergrund und 32-px-Bildvorschau. Vorschau und Dateiname öffnen per Klick oder Tastatur die vorhandene größere Dateiansicht; Entfernen bleibt eine separate Aktion. Der Entwurf bleibt dabei erhalten. Lange Namen werden innerhalb der maximal 260 px breiten Chips gekürzt, der vollständige Name bleibt im Tooltip und zugänglichen Aktionsnamen erhalten.

Die globale Chatkopfzeile richtet ihre Bedienelemente auf derselben Höhe wie die Agent-Überschrift der eingerückten Seitenleiste aus. Rechts stehen in der Einzelansicht Chatmenü, Ansichtsaufteilung und Workspace zusammen; links bleibt nur bei geschlossener Seitenleiste deren Öffnen-Button. Einzelansicht, Mehrfachansicht und geöffneter Workspace teilen diese Höhe. In der schwebenden Einzelansicht blendet der Verlauf über die oberen 192 px weich aus und wird erst unmittelbar am oberen Bildschirmrand vollständig transparent. Es gibt keine vorzeitig unsichtbare Zone hinter der Kopfzeile.

Chat und Workspace besitzen eigene Kopfbereiche. Der Workspace reicht mit 8 px Außenabstand von der oberen bis zur unteren Fensterkante und übernimmt Rundung und Innenabstand der Seitenleiste. Seine Fläche verwendet `workspace-panel-bg`, in allen dunklen Farbwelten Schwarz als Basis zur sichtbaren Trennung vom Chat. Die zentrale fast deckende Glasfläche, diffuse dezente Verläufe, feine innere Lichtkante und weicher Schatten geben dezente Tiefe. Die 32-px-Hintergrundunschärfe erhält bei fehlender Unterstützung und reduzierter Transparenz eine deckende Ersatzfläche. App-Grundfläche und Suchfeld behalten `workspace-backdrop`; im hellen Erscheinungsbild bleibt die bisherige Workspace-Farbe erhalten. Die linke Navigation behält ihre hellere `sidebar`-Fläche; die Workspace-Aktionen heben sich mit `raised` ab. Diese Zuordnung gilt auch bei schmalem und vergrößertem Workspace. Die Einzelansicht behält beim Öffnen und Schließen ihren schwebenden Chatkopf und dieselbe obere Verlaufskante. Mehrfachansichten reichen ebenfalls bis zur oberen Kante. Panelmenüs und globale Ansichts-/Workspace-Aktionen teilen eine schwebende Kopfzeile ohne Überschneidung. Bei Platzmangel liegen die Paneltabs darunter über dem Verlauf; Workspace-Köpfe erhalten keinen Tabversatz. Auf schmalen Fenstern überlagert der Workspace den Chat und bleibt über seinen eigenen Schließen-Button erreichbar. Vergrößern zeigt den Workspace über die gesamte Chatfläche; erneutes Betätigen kehrt zur automatischen Breite zurück.

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

Die Überschrift „Workspace“ und die Projektzeilen bleiben beim Scrollen fest stehen. Nur die Chatliste des aufgeklappten Projekts scrollt im verbleibenden Platz. Die Chatliste verwendet den gemeinsamen ScrollEdgeFade: oben über 8 px und unten über 32 px bis zur tatsächlichen Unterkante der Seitenleiste, ausschließlich wenn in dieser Richtung weiterer Inhalt außerhalb des sichtbaren Bereichs liegt. Am Listenanfang und -ende entfällt der jeweilige Fade. Auswahlflächen bleiben außerhalb dieses schmalen Randes deckend; 32 px Endabstand halten den letzten Eintrag vollständig erreichbar. Im erzwungenen Kontrastmodus entfällt die Maske. Die Agentenzeile bleibt außerhalb des Scrollbereichs.

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

Neben dem Agentenbutton öffnet die Lupe als kreisrunder IconButton denselben fokussierten Dialog wie Cmd/Ctrl+K. Der Suchtext und seine gefüllte Pille entfallen; Tooltip und aria-keyshortcuts nennen das Tastenkürzel. Auch bei geschlossener Seitenleiste bleibt das Kürzel wirksam. Sie findet Gesprächstitel und lokal gespeicherte Gesprächstexte aller Projekte, auch archivierte Chats, sowie Projekte und Bereiche/Einstellungen. Mehrere Suchwörter müssen vorkommen; Akzente, ß und einzelne Tippfehler in längeren Wörtern werden toleriert. Treffer zeigen Projekt, Archivstatus und Textausschnitt; Öffnen verwendet die bestehende Panel-/Entwurfslogik. Keine Werkzeugausgaben, internen Überlegungen oder reinen Kanalgespräche durchsuchen. Lade-, Leer-, Fehler- und Teilverfügbarkeitszustände sind sichtbar; veraltete Suchantworten werden verworfen.

Navigation und Projektgruppen sind kompakter, sodass die vollständige Chatliste den verbleibenden Raum nutzt. Projektköpfe bleiben außerhalb ihres Scrollbereichs. Der Agentenbutton im Kopf zentriert einen 32-px-Avatar in derselben 18-px-Symbolspalte wie die Navigation. Der Name beginnt auf derselben Textkante, mit reading (16 px) und semibold in der vorhandenen UI-Schrift. Kompakte Innenabstände bleiben erhalten; Touchziele bleiben mindestens 44 px. Das Plus im Composer teilt die kreisrunde Grundform aller Iconbuttons, auch beim Hover.

## Direkte Nachrichtenaktionen

Bearbeiten und Verzweigen bleibt erhalten. Löschen steht als eigener
Papierkorb-Iconbutton neben den übrigen Nutzeraktionen; das zusätzliche
Drei-Punkte-Menü entfällt. Der bestehende Löschdialog bleibt erhalten.
Nachrichtenaktionen erscheinen bei Hover oder Tastaturfokus; auf Touch bleiben sie sichtbar und umbrechbar. Der aktive Vorlesen-Stoppen-Button bleibt immer sichtbar.
Fertige Agentenantworten erhalten den gemeinsamen Vorlesen-/Stoppen-Button
`MessageSpeech` (bestehender IconButton, Volume2/Square/LoaderCircle).
Während einer laufenden Antwort ist Vorlesen deaktiviert. Kommentare,
Werkzeugtexte und Planblöcke erhalten keinen Vorlesen-Button. Fehler stehen
zugänglich direkt bei der Antwort. Vorbereiten kann bereits gestoppt werden.
Die Anbieterwahl bleibt unter Stimme; der Composer behält genau ein Mikrofon.
Die Anschlussbeschreibung führt `system/capabilities.mjs` unter
`chat.message.read-aloud`.

## Inhalte nachladen

Beim Öffnen eines gespeicherten Gesprächs steht der gemeinsame Chat-Skeleton
im Verlauf mit denselben Inhaltskanten. Er endet mit der Verlaufsantwort oder
dem Fehler; laufende Antworten behalten ihre echte Aktivitätsanzeige. Datei-
und Git-Vorschauen nutzen Document-/Media-Skeletons. Medien bleiben zum Laden
gemountet; Fehler und Zeitlimit ersetzen den Platzhalter.

Die Ordnernavigation nutzt kompakte List-Skeletons in der bestehenden Dateiliste.

## Ruhiger Gesprächsfluss

Ab Beginn steht über der Agentenantwort eine eigene Autorenzeile: ausgewählter Avatar, tatsächlicher Agentenname und relatives Nachrichtenalter (zum Beispiel „vor 2 Min.“). Der exakte Zeitstempel bleibt im Tooltip und time-Element zugänglich. Direkt darunter steht die zweite Zeile: ausgewählter AppLoader, Live-Status, Schrittanzahl und tatsächliche Bearbeitungszeit. Diese zweite Zeile ist die aufklappbare ActivityGroup und bleibt nach Abschluss als kompakter Verlauf erhalten. Ohne Werkzeuge bleibt der kompakte Arbeitsstatus an derselben Stelle. Der Spinner endet mit der Arbeit und behauptet keinen weiteren Fortschritt.

Zwischenmeldungen bleiben während der Arbeit im Gespräch sichtbar. Sobald eine abschließende Antwort vorliegt und die Arbeit beendet ist, werden Zwischenmeldungen und Werkzeugschritte in ihrer ursprünglichen Reihenfolge in die automatisch geschlossene Gruppe aufgenommen. Aufklappen zeigt den vollständigen Ablauf. Laufende oder fehlgeschlagene Turns ohne Abschlussantwort verlieren ihre sichtbaren Zwischenmeldungen nicht. Nutzernachrichten und Antworten behalten ihre Reihenfolge; Nachträge werden nicht vor die erste Nutzernachricht verschoben.

Antworten nutzen die zentrale 15-px-Rolle conversation und die native Systemschrift (auf macOS San Francisco). Nutzernachrichten und Desktop-Eingabe nutzen control (14 px); Touch-Eingabe bleibt in reading. Links verwenden blue und Unterstreichung. Routinemäßige Prüfberichte werden nicht als Abschlussanhang erzeugt oder verlinkt. Dateien gehören in die Antwort, wenn sie ein angefragtes oder direkt nützliches Ergebnis liefern, etwa eine HTML-Visualisierung.

Bei Nutzernachrichten bleibt die Uhrzeit eng unter dem Text; bei Agentenantworten ersetzt das relative Alter in der Autorenzeile die zusätzliche Uhrzeit am Fuß. Nachrichtenaktionen erscheinen auf Desktop bei Hover oder Tastaturfokus ohne Layoutsprung; auf Touch bleiben sie mit mindestens 44 px Bedienfläche sichtbar. Der aktive Vorlesen-Stoppen-Button bleibt erreichbar.

## Dezentes Flächenlicht

Seitenleiste und Workspace verwenden den gemeinsamen dekorativen Baustein `PanelLight`. Die Seitenleiste behält ihre hellere Grundfläche `sidebar` und erhält über `sidebar-material-shadow` eine sehr feine innere Kante; `sidebar-sheen` zeigt zwei diffuse, schwache radiale Verläufe. Der Workspace nutzt seine bestehende schwarze Materialfläche und `workspace-panel-sheen`. Nur die Lichtschicht bewegt sich, um jeweils wenige Prozent, mit 48 Sekunden je Richtung, sanften Wendepunkten und gegenläufiger Phase links/rechts. Dauer und Easing liegen in der zentralen Designquelle. Keine zufälligen Sprünge, kein Pulsieren von Text oder Kante.

Aussehen → Visuell → Flächenlicht bietet Aus, Ruhend und Sanft bewegt (Standard). Die Auswahl wird gemeinsam mit den bestehenden Darstellungseinstellungen validiert und gespeichert. App- und Systemvorgaben für reduzierte Bewegung zeigen statische Verläufe. Versteckte Tabs, eingeklappte Seitenleisten und nicht sichtbare Flächen pausieren. Nur die Dekoration wird an den Rundungen beschnitten; Menüs, Tastaturfokus und Ziehkanten bleiben erreichbar. Erzwungener Kontrast blendet die Dekoration aus. Unser Design zeigt denselben Baustein.


Das Terminal im Workspace verwendet einen transparenten Inhaltsuntergrund, damit die gemeinsame dunkle Materialfläche mit Lichtverlauf bis zur Eingabe durchgeht. Es legt keine eckige deckende Fläche über die abgerundete Workspace-Hülle. Ausgabe, Eingabe und deren Fokus bleiben unverändert bedienbar.

Die Gesprächsschrift ist bewusst zurückhaltend: Antworten 15 px bei normalem Gewicht und 1,5-fachem Zeilenabstand, Nutzernachrichten, Zwischenmeldungen und Desktop-Eingabe 14 px in derselben Systemschrift. Absätze trennen 12 px, der letzte Absatz hat keinen Endabstand. Markdown-Hervorhebungen nutzen semibold; Überschriften bleiben mit reading (16 px) kompakt. Browserzoom und gespeicherte Schriftgrößenskalierung bleiben wirksam; Touch-Eingabe behält mindestens die bestehende reading-Rolle.


## Kompakter Workspace als Arbeitsbegleiter

Der Workspace dient dem Nachsehen und Prüfen neben dem Gespräch: Dateien sind der direkte Einstieg, Änderungen eine weitere Ansicht, Befehle ein manuelles Zusatzwerkzeug. Er startet bei jedem Öffnen mit 280 px; Vergrößern und Ziehen bleiben explizite Aktionen. Es gibt keine drei großen Startbuttons und keine automatische Breitenänderung beim Ansichtswechsel.

Kopf und Bereichsauswahl nutzen control (14 px), Dateizeilen und Begleittexte small (13 px), Pfad-/Statusangaben und Befehlsausgaben caption (12 px). Die gewählte Textskalierung bleibt wirksam; Touch-Eingaben verwenden reading, Touchziele mindestens 44 px. Ordner stehen vor Dateien, beide natürlich nach Namen sortiert. Der Ordnername und eine kompakte relative Pfadzeile ersetzen den ausgeschriebenen absoluten Systempfad; dieser bleibt im Tooltip. Kopf und Eintragsstatus bleiben stehen, nur die Dateiliste scrollt. Geschützte Einträge sind standardmäßig ausgeblendet und über einen beschrifteten Button einblendbar; Zugriffsrechte bleiben erhalten.

„Befehle“ verwendet normale UI-Schrift im Leerzustand, Monospace nur für Eingabe und tatsächliche Ausgabe. Der kurze Hinweis benennt Einzelaufrufe und das 30-Sekunden-Limit. Die Eingabe bleibt unten als kompakte getönte Zeile. Die gemeinsame schwarze Materialfläche, feine Kante und Lichtbewegung bleiben in allen Ansichten sichtbar. Der Bereich ist kein persistentes Terminal und bietet keine neu erfundene native Finder-/Terminal-Anbindung.


Avatar und Bearbeitungssymbol teilen eine feste senkrechte Mittelachse: Die Signatur reserviert `control-turn-loader-slot` (19,2 px, entsprechend dem 16-px-AppLoader mit Faktor 1,2) und zentriert darin den 24-px-Avatar per Flexbox. Eine spezifische Autorenregel verhindert, dass allgemeine Avatarregeln diese Größe überschreiben. Keine nachträgliche Transform-Verschiebung. Der bisherige Abstand zum Namen bleibt erhalten. Auch das statische Aktivitätssymbol nach Abschluss nutzt denselben Symbolplatz; der laufende Loader und sein Statustext bleiben unverändert. Name und relative Zeit stehen in einer eigenen, an der Textgrundlinie ausgerichteten Flexgruppe und dürfen bei Platzmangel umbrechen.


Der leere Composer zeigt auf Desktop und Handy nur „Nachricht“ in der zurückhaltenden Rolle `faint`, vertikal zentriert mit 2 px optischer Absenkung. Die leere Schreibzeile bleibt eine volle Pille; ausschließlich tatsächlicher mehrzeiliger Text oder die aktive Aufnahme erweitern die Rundung. Die Höhenmessung berücksichtigt den Textinnenabstand und ignoriert Platzhalterumbrüche für den Mehrzeilenzustand.


Erneut ausführen sendet die ursprüngliche Nachricht samt Anhängen als neuen Turn in derselben Session. Chat-ID, Titel, bisheriger Verlauf und Composer-Entwurf bleiben erhalten; es entsteht kein Seitenleistenduplikat. Während Übertragung und laufender Antwort ist die Aktion gesperrt. Kopieren schreibt ausschließlich in die Zwischenablage. Verzweigen ist eine separate Aktion an der Antwort und übernimmt den Verlauf bis einschließlich des gewählten Turns. Bearbeiten und Verzweigen bleibt ausdrücklich beschriftet.


Gesprächs-Skeletons verwenden user-message-row/user-message und agent-message/markdown. Blasenrundung, Absatzabstand und Schriftzeilenhöhe folgen damit den echten Nachrichten; die Signatur reserviert einen kleinen runden Avatarplatz.

## Kompakte Modellwahl

`ModelPicker` nutzt die gemeinsame `popover-glass`-Fläche mit 28 px Blur, stärkerer Transparenz, feinen Lichtkanten und flachen 32-px-Zeilen. Die Standardansicht zeigt `ReasoningSlider` direkt unter dem kompakten Kopf: Stufe mittig, Modell klein darunter, nativer Fast-Blitz links und gegebenenfalls native Rücksetzaktion rechts. Sichtbare Überschriften entfallen. Die Namen beginnen groß, `xhigh` erscheint als `X-High`; native Werte und Anzahl bleiben unverändert. Klick auf die Mitte öffnet im selben Glas mit 24-px-Außenrundung die Anbieter- und Modellwahl mit Original-Icons. Erfolg kehrt zum Regler zurück, Fehler bleiben sichtbar. Zurück und Escape gehen vom Modellmenü zum Regler, ein weiteres Escape schließt. Ohne geladene Modelle steht direkt der bestehende Einrichtungszustand. Die Höhe passt sich sanft an, ohne Inhalte zu skalieren oder unsichtbare Bedienelemente zu duplizieren. Low bis Max unterscheiden sich zusätzlich durch Dichte und Ausdehnung des Quadratfelds; Ultra behält seinen verstärkten Abschluss. Auf Touch sind Ziele mindestens 44 px hoch. Kein Fertig-Button und keine dauerhaften Effort-Kacheln. Escape, Außenklick und Verlassen schließen; Tastaturfokus bleibt sichtbar. Fenster, Bildschirmtastatur und vergrößerte Schrift begrenzen Position und Scrollhöhe. Ohne Transparenz oder Blur wird die Fläche deckend. Animationen folgen der App-/Systemvorgabe für reduzierte Bewegung und pausieren außerhalb der sichtbaren Fläche.

Während einer laufenden Antwort bleiben Modell und Denkaufwand auswählbar. Die Wahl wird pro Chat für die nächste Nachricht vorgemerkt; der Hinweis im geöffneten Menü benennt dies. Die laufende Antwort bleibt unverändert, ein Anbieterwechsel verwendet die ausdrücklich beschriftete Stoppen-und-Wechseln-Aktion. Die Vormerkung bleibt beim Wechsel zwischen Chats in der geöffneten App erhalten. Erst das nächste Senden übergibt sie unter derselben serverseitigen Turnsperre wie den Prompt. Eine noch laufende Antwort nimmt die Vormerkung nicht als Steuerungsnachricht entgegen. ACP bestätigt Modell und anschließend die zugehörigen Denkstufen nativ; unbekannte Werte stoppen das Senden und erhalten den Entwurf. Bei einem vorgemerkten anderen ACP-Modell erscheinen dessen noch nicht gemeldete Denkstufen nicht vorab.

Codex zeigt ausschließlich gemeldete, sichtbare Modelle der GPT-5.6- und GPT-6-Serie. Bereits vorhandene Gespräche mit älteren Modellen behalten ihren tatsächlichen Modellnamen. Die Stufen kommen exakt aus `supportedReasoningEfforts`, mit unveränderten nativen Werten und lediglich großgeschriebenen Anzeigenamen. Beim Modellwechsel bleibt eine Stufe nur erhalten, wenn das neue Modell sie anbietet.

Claude Code lädt seine echten Modelle beim Öffnen einer leeren nativen Sitzung. Vorhandene CLI-/OAuth-Anmeldung wird durch den bestehenden ACP-Anschluss verwendet. Ein erfolgreicher Handshake alleine gilt nicht als Modellzugang. Ohne Anmeldung bleiben verständlicher Fehler, erneuter Versuch und der Original-Einrichtungslink erreichbar. Es wird keine Nachricht gesendet und kein Modellkatalog erfunden. Native `configOptions` sind führend: Modell- und Effort-Auswahl stehen gemeinsam im Picker und erscheinen nicht nochmals neben dem Composer. Ein Modellwechsel übernimmt erst die vollständige Antwort mit den zu diesem Modell passenden Stufen; abgewiesene Werte bleiben unverändert. Übrige Sitzungseinstellungen und Befehle behalten ihre bisherigen Plätze.


Die Eingabenavigation verwendet `ChapterScrubber` unter `ui/components/ui`. Position links bei 20 % und maximale Höhe 45 % bleiben erhalten. Eine gemeinsame Federbewegung erzeugt eine Kosinuswelle über benachbarte Striche; die einzelne Glasvorschau folgt innerhalb des Panels. Die Werte stehen in `scrubberSprings`. Klick und Enter springen weiterhin zur Nutzernachricht; Pfeiltasten, Home und End steuern den einzigen Tabstopp. App- und Systemvorgaben für reduzierte Bewegung zeigen die Welle ohne zeitliche Animation. Keine dauerhafte Dekoration.

## Routinen beauftragen

Der Chat verwendet die gemeinsamen Routine-MCP-Werkzeuge. Die aktuelle Projekt-ID
wird frisch mitgegeben. Bei wiederkehrenden Aufgaben zuerst Fähigkeiten,
Datenquellen, Termin und Benachrichtigungsziel klären; nur entscheidende Lücken
nachfragen. Eine eindeutige Beauftragung genügt zum Aktivieren. Nach erfolgreichem
Speichern nennt die Antwort den nächsten Termin, Zeitzone und Zustellweg.
Eine spätere Änderung oder Pause liest erst den aktuellen Stand mit Revision.
Kein eigenes Cron-Skript und keine bloße Zusage bei fehlendem Werkzeug.
Benachrichtigung und Ergebnis öffnen den tatsächlichen Lauf beziehungsweise
seinen Chat; der Ursprungschat wird nicht mit künstlichen Turns beschrieben.
Der verbindliche Ablauf steht unter [Aufträge](jobs.md#routinen-aus-dem-chat-und-benachrichtigungen).

Der ReasoningSlider bewegt sich zwischen den Punkten frei, zieht nahe Punkte magnetisch an und übernimmt beim Loslassen genau eine native Stufe. Keine unteren Low-/Ultra-Labels und kein diagonaler Popover-Verlauf. Native Default-/Auto-Werte erscheinen separat als Rücksetzen, nicht als zusätzliche Denkstufe. Anzahl und Namen bleiben modellspezifisch.

Codex bietet einen flachen Blitz-Button „Fast“, sofern `model/list.serviceTiers` eine passende Option meldet. Native IDs werden unverändert verwendet. Die Wahl gilt erst für die nächste Nachricht, bleibt pro bestehendem Chat gespeichert und wird über `serviceTierForTurn` übertragen; Standard wird ausdrücklich mit `default` gesendet. Ein nicht mehr unterstützter Tier wird nicht an das neue Modell übertragen. Der Tooltip nennt den höheren Verbrauch. Claude behält seine nativ angebotenen übrigen Sitzungseinstellungen.

Anbieterübernahmen speichern einen unveränderlichen Verlaufsschnappschuss. Neue native Ereignisse werden auf die sichtbare Chat-ID zugeordnet; verspätete Ereignisse der alten Sitzung verändern den neuen Verlauf nicht. Die Kontextübergabe enthält einen begrenzten Gesprächsauszug und den vollständigen lesbaren Export, ohne private Reasoning-Inhalte. Neustart und erneutes Öffnen behalten Zuordnung und Verlauf. Verzweigen bleibt nach dem Übergabepunkt möglich; Löschen über die Anbietergrenze hinweg wird vor nativen Änderungen abgewiesen.

Die Modellwahl behält während einer Öffnung ihre horizontale Ausrichtung unabhängig von wechselnden Modell-, Denkaufwand- und Fast-Beschriftungen. Die beim Öffnen gemessene Triggerbreite bleibt der Anker; tatsächliche Layoutänderungen und Viewportgrenzen werden weiterhin berücksichtigt. Erneutes Öffnen richtet das Menü frisch aus.

Die Reasoning-Spur ist eine horizontale Pille, ihr stärker mattierter Glasgriff eine vertikale Pille mit 16 px Blur. Bereits erreichte Punkte verschwinden; nur die noch vorausliegenden Rastpunkte bleiben neutral sichtbar. Die native Stufe Ultra verstärkt Terrakotta-Sättigung, Schweiflänge und Tempo zusätzlich, mit weichem Übergang beim Ziehen. Andere höchste Stufen werden nicht als Ultra behandelt. Die Werte liegen in amountSliderMotion und den slider-Glas-/Akzentrollen; reduzierte Bewegung bleibt statisch.


## Adaptive HTML-Vorschau

HTML-Links öffnen FileContent im kompakten Workspace als gerenderte Seite.
Die verfügbare iframe-Breite bestimmt den responsiven Dokumentaufbau. „Vollbild“
vergrößert denselben Workspace, ohne den iframe neu zu laden. Die vorhandene
Kopfaktion führt zur kompakten Breite zurück. Bearbeiten ist eine getrennte Aktion.
Die Bibliothek nutzt denselben HtmlPreview-Baustein und ihre bestehende Großansicht.
Darstellung, Bearbeitung und Isolation führt [der Bibliotheksvertrag](library.md#html-dokumente-im-workspace-und-in-der-großansicht).

## Gespräch aus einem Bericht

Heute öffnet Routine-Ergebnisse und markierte Beispielbriefings im normalen Chat.
Der gespeicherte Bericht steht als erste Assistentennachricht vor den Rückfragen.
Der vorhandene Snapshot-/Kontextmechanismus erhält diesen Stand nach Reload und
Anbieterwechsel. Öffnen löst keine Agentenarbeit aus; pro Bericht wird derselbe Chat
wiederverwendet. Historische Berichte bleiben Daten, keine neuen Arbeitsregeln.


Die Sprachleiste verwendet VoiceWave und VoiceStatus aus voice-visual.tsx.
Der Pegel bleibt maximal 240 px breit, mit feinen, nicht mitskalierenden Strichen
und an die verfügbare Breite angepasster Anzahl. Höhe und Verstärkung liegen
in voiceWaveGeometry; die Übergänge verwenden motion-feedback-duration.
Es werden ausschließlich gemessene Pegel gezeigt, ohne künstliche Sprachbewegung.
Reduzierte Bewegung deaktiviert die Übergänge. Die Erkennung zeigt mittig
„Wird erkannt“ neben dem gewählten AppLoader; Schließen bleibt rechts erreichbar.
Die kompakte Höhe und alle Aufnahme-/Sendeaktionen bleiben erhalten.
Unser Design zeigt beide gemeinsamen Bausteine ohne echten Mikrofonzugriff.


Der gemeinsame `ThemeToggle` unter `ui/components/ui/theme-toggle.tsx` zeigt Mond
und Sonne in einer kompakten Pille mit gleitendem Auswahlkreis. Er ersetzt
Hell/Dunkel unter Aussehen und steht als eigene Abschlusszeile „Erscheinungsbild“
im Agent-Menü. Beide verwenden dieselbe bestätigte, serverseitig gespeicherte
Theme-Einstellung. Während der Speicherung ist der Schalter gesperrt; Fehler
lassen die bisherige Auswahl bestehen und werden direkt angezeigt. Native
Buttonbedienung, sichtbarer Fokus, 44-px-Treffhöhe und reduzierte Bewegung
sind berücksichtigt. Im Menü gilt menuitemcheckbox, sonst switch. Farben
und Bewegung folgen vorhandenen zentralen Tokens. Unser Design zeigt dieselbe
Komponente mit lokalem Vorschauzustand. Keine weiteren Kopf- oder Workspaceaktionen.


Im hellen Theme setzen sich Sidebar und Workspace dunkler von der Papierfläche ab. Menüs und Composer erhalten helle, klar konturierte Flächen. Die Sterne nutzen die zentralen Theme-Deckkraftrollen; Reduzierung und Abschalten des Reiseeffekts bleiben erhalten. Palette und Referenz stehen in DESIGN.md.


## Iconaktionen

Nachrichten verwenden CopyButton mit bestätigtem Erfolg und sichtbarem Fehler. Plus, Drei-Punkte-Menüs und weitere Iconaktionen folgen der gemeinsamen Iconrückmeldung in README.md; vorhandene Aufklappbewegungen bleiben erhalten.


Codeblöcke im gemeinsamen Markdown-Renderer verwenden ebenfalls CopyButton.
Die bereinigte Toolbar enthält nur den Portalplatz; React rendert darin dieselbe
zugängliche Kopieraktion mit Haken und Fehlerzustand. Kopiert wird ausschließlich
der Text des zugehörigen Codeblocks, ohne die letzte Formatierungszeile.


Einzelicons folgen der [gemeinsamen Auswahl- und Hoverregel](../DESIGN.md#gemeinsame-iconrückmeldung). Auswahl bleibt als dünner Kreisrand
erkennbar; Hover animiert einmal, Klick bestätigt die Bedienung. Textzeilen
und native Schalter werden nicht in Iconbuttons umgeformt.


## Archivierte Chats

Archivieren im Chatmenü und Wiederherstellen unter Einstellungen → Archivierte Chats
verwenden denselben gespeicherten Status. Auch leere Chats und gespeicherte
Berichte ohne native Sitzungsdatei können archiviert und wiederhergestellt werden;
Gesprächsexporte und Berichte bleiben erhalten. Andere Anbieter- und Speicherfehler
werden angezeigt und ändern den angezeigten Status nicht. Während einer Antwort,
Übergabe oder Sprachsession wird nicht archiviert; doppelte Aktionen sind gesperrt.
Erneutes Öffnen eines archivierten Berichts verwendet denselben Wiederherstellungsweg.
Die Archivliste bleibt projektübergreifend, neueste Gespräche zuerst. Suchfilter ohne
Treffer und ein vollständig leeres Archiv zeigen verschiedene vorhandene Empty-Zustände.
Der bestehende Aktionsbutton zeigt Wiederherstellen und während der Anfrage
Wiederherstellen …; erst bestätigter Erfolg entfernt die Zeile.


## Gespräch als Startpunkt

Der Standardstart und das Plus am Workspace öffnen den leeren Chat. Heute steht
nicht mehr im Hauptmenü. Vorhandene Heute-/Kalender-Direktlinks sowie die Suche
bleiben nutzbar; die bestehende Kalenderansicht wird nicht gelöscht.
ChatStart ersetzt die starren Startvorschläge: Avatar, kontextabhängige erste Zeile,
ein kleiner AttentionFan und die unveränderte Nachrichteneingabe. Rückfragen haben
Vorrang vor ungelesenen Hinweisen, aktuellen Routine-Ergebnissen und fertigen Chats.
Pro Routine erscheint höchstens das neueste Ergebnis, auch wenn ältere ungelesen
sind. Routine-Chats werden nicht zusätzlich angeboten. Ohne Anlass stehen drei
Gesprächsvorschläge bereit; sie füllen nur den Entwurf und senden nichts.

Maximal fünf Einträge, drei aufgefächerte Karten gleichzeitig. Seitliche Karten
wählen aus; Klick auf die vordere öffnet den bestehenden Chat oder Berichtschat.
Rückfragen ohne zugeordneten Chat und technische Hinweise verwenden ihre bisherigen
Dialoge und Freigaben. Kein Auftrag startet durch die Vorschau. Erst erfolgreiches
Öffnen eines Berichts markiert dessen Hinweis gelesen. Die gewählte ID bleibt bei
Feed-Updates erhalten. Pfeile, Tastatur und horizontaler Touch-Wisch wechseln;
vertikales Scrollen bleibt möglich. Keine automatische Rotation oder dauerhafte
Zusatzanimation. App-/Systemreduktion unterbindet den Federübergang. Karten wachsen
mit Text, Themefarben und Bewegung stammen aus design-system.mjs. Unser Design
zeigt denselben AttentionFan. Wetter ist eine Karte im gemeinsamen Fächer, kein zusätzlicher Bereich.

Alte Direkteinstiege mit ?view=today oder ?view=pipeline öffnen den neuen Chatstart.
?view=calendar öffnet weiterhin den Kalender.


Der leere Chat verwendet einen Composer im normalen Flexfluss unter dem separat
scrollbaren Einstieg. Keine Karte oder Navigation liegt hinter der Eingabe.
Der größere Avatar steht mittig über dem rahmenlosen Text. Zwei feste Textzeilen halten den Einstieg beim Schreiben und beim Satzwechsel stabil. AttentionFan nutzt
suggestion-glass, die gemeinsame Glaskante und 28 px Blur, mit deckenden Fallbacks.
Maus-Hover hebt eine Karte in ihrer bestehenden Position an und betont ihre Kontur;
kein Umsortieren unter dem Zeiger. Ein Klick öffnet die angehobene Karte, Touch
behält Auswahl/Öffnen. Tastaturfokus bietet dieselbe Hervorhebung.

ChatStartHeading ordnet den belegten Zustand der Karte kurz ein, ohne Titel als
Fragen zu wiederholen. Langsame Zeichenfolge, zwanzig Sekunden Lesezeit und
höchstens eine sachliche Vertiefung aus dem vorhandenen Inhalt. Danach steht der
Text still. Die Karten wechseln nie automatisch.
Der Textplatz bleibt auf zwei Zeilen begrenzt. Hover und Tastaturfokus pausieren nur den späteren Satzwechsel; die RPG-Schreibanimation läuft weiter. Ein Composer-Entwurf pausiert auch das Schreiben, ohne den Satz vorzeitig zu vervollständigen. Verborgene Ansichten stoppen Zeitgeber.
Screenreader erhalten die vollständige Zeile ohne laufende Wortansagen. Reduzierte
Bewegung zeigt einen statischen Satz. Aussehen → Visuell → Lebendiger Starttext
schaltet den Effekt für diesen Browser dauerhaft ab; kein zusätzlicher Server nötig.
Die Auswahl wird zwischen Tabs desselben Ursprungs synchronisiert und ein
Speicherfehler angezeigt. Gemeinsame Werte: chatHeadingMotion und attentionFanMotion.


Der Startfächer bietet konkrete Anschlussaktionen: offene Rückfragen und Probleme,
ungelesene Antworten, Routine-Ergebnisse, das letzte abgeschlossene Gespräch im
Workspace und den nächsten geplanten Auftrag. Jede Karte benennt ihre Aktion.
Beliebige zuletzt geänderte Dateien und nicht angebundenes Wetter werden nicht
als Arbeitsanlass angeboten. Gespräche führen in ihren Chat, Ergebnisse in den
Berichtschat, Aufträge in den bestehenden Dialog. Öffnen startet keine Arbeit.
Ohne Anschluss bleibt ein Vorschlag, der nur den Entwurf vorbereitet.

Der gemeinsame Skeleton mit Variante `attention` reserviert dieselbe Kartenhöhe,
Fächerbreite und Navigation wie AttentionFan. Der Einstieg bleibt oben verankert;
Laden, Satzwechsel und Composer-Anhänge zentrieren ihn nicht neu. Der leere
Startbildschirm folgt nicht der Scrollautomatik für neue Chatnachrichten.
Bei Platzmangel scrollt der Einstieg manuell, während der Composer erreichbar bleibt.
Unser Design zeigt den Karten-Ladezustand neben den gemeinsamen Skeletons.

Die rechte Seitenleiste öffnet manuell die zuletzt verwendete verfügbare Ansicht
(Dateien, Änderungen oder Befehle), auch nach erneutem Laden. Ohne gespeicherte
Auswahl beginnt sie mit Dateien; Ergebnisse öffnen direkt ihre Vorschau.
Die Dateiliste beginnt beim gewählten Workspace, zeigt dessen Namen einmal im
Kopf und navigiert höchstens bis zu dessen Wurzel zurück. Workspace-Wechsel
verwerfen vorherige Dateiauswahl und Ordnerziele. Ausdrückliche Auftragslinks
können weiterhin ihren zugehörigen Ordner öffnen. Technische Installationsnamen
sind keine Workspace-Titel. Geschützte Einträge sind zunächst ausgeblendet.


### Persönlicher Heute-Einstieg

Avatar, Text und Karten besitzen feste Plätze. Der größere gewählte Avatar steht mittig über zwei reservierten Textzeilen ohne Sprechblasenfläche oder Rahmen. Die vorhandene Schreibanimation bleibt; längere Texte ändern weder die Höhe des Einstiegs noch die Position der Karten. Kurze, belegte Anschlussfragen greifen die gewählte Karte auf. Dateinamen dienen nur als Thema; keine erfundene Erinnerung oder unbelegte Zeitangabe.

Alle Fächerkarten sind einschließlich Innenabständen 224 px hoch. Titel und
Beschreibung bleiben auf je zwei Zeilen begrenzt. Die Navigation reserviert auch
bei einer einzelnen Karte ihre Höhe. Die Startreferenz zeigt denselben Avatar,
Textbaustein und Fächer.


Die angeschlossene Wetterkarte bleibt im Startfächer reserviert. Open-Meteo liefert Temperatur und Wetterlage; Quelle und Datenstand sind sichtbar. Ortssuche und bestätigte Koordinaten stehen unter Dein Profil. Speichern, erneutes Öffnen, Fokus und zehn Minuten im sichtbaren Chatstart aktualisieren das Wetter. Eindeutig passende alte Ortsnamen werden aufgelöst; mehrdeutige Orte erfordern Auswahl. Lade- und Abruffehler ersetzen keine Wetterwerte durch Beispiele. Wetter & Ort öffnet das Profil mit Aktualisieren-Aktion.

## Gespeicherte Nachrichtenübergabe

Der vorhandene Composer und Diktatversand nutzen stabile Nachrichtenkennungen.
Der Kern speichert die Übergabe vor dem Worker-Aufruf. Nach verlorenem HTTP-Ergebnis
verwendet Wiederholen dieselbe Kennung; bestätigte Eingabe wird nicht noch einmal
übergeben. Der Browser speichert dafür nur die Kennung unter einem Inhalts-Hash,
keinen Nachrichtentext. Unklare Zustellung bleibt gesperrt und wird über vorhandenen
Verlauf und `/api/messages` geprüft. Explizite Fortsetzung nutzt `/api/messages/resume`
mit aktuellem Prüftoken und bestätigtem Worker-Ruhezustand; die unklare Nachricht
selbst wird dabei nicht wiederholt. Vorgemerkte Nachrichten erhalten die bestehende
Rückmeldung. Keine neue Sendeleiste oder zusätzliche Navigation.


ChatStartPreview dient als gemeinsamer neutraler Bauplan in Unser Design und
in blueprint.html. Er verwendet ChatStart und dessen Scrollsteuerung direkt.
Umschaltbare Lade- und Anhangszustände lassen Avatarposition und erreichbare
Eingabe vergleichen; Vorschauaktionen zeigen nur ihr Ziel. Die Anhangsfläche
ist ein Layoutbeispiel und führt keinen Upload aus.

## Kalenderkachel und Tageschat

Im AttentionFan bleibt neben Wetter eine Kalenderkarte reserviert; insgesamt
höchstens fünf Karten. CalendarCardContent zeigt Wochentag, große Tageszahl,
Monat und ISO-KW mit denselben Glasmaßen und zentraler Typografierolle calendar.
Der nächste laufende oder kommende heutige Termin erhält Titel und Countdown;
ein weiterer Termin folgt gedämpft. Ganztägig und Läuft gerade sind eigene Angaben.
Ohne weitere heutige Termine kein Countdown auf morgen. Datum und Countdown
aktualisieren sich; Projektwechsel, Mitternacht und Abruffehler zeigen keinen
vorherigen Tag als aktuellen. Fehlender Dienst ist kein terminfreier Tag.

Klick öffnet explizit einen neuen Tageschat mit Datenbericht und kurzer Einordnung.
Diese Aktion darf den Worker starten; bloßes Anzeigen der Kachel tut es nicht.
Kalender öffnen im Tageschat führt zur bestehenden Kalenderansicht ohne neuen
Hauptmenüpunkt. Eigene und angebundene Termine teilen dieselbe Projektion, bleiben
nach Herkunft unterscheidbar. Kalenderdaten und Migrationsvertrag: docs/PLANNER.md.
