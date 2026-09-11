# Chat und Projekte

## Automatische Chat-Titel

Der zuständige Worker erzeugt den Titel mit dem gewählten Modell in einer separaten Hintergrundanfrage anhand der ersten Nutzernachricht. Beide Anschlusswege verwenden die zentrale Regel und Prüfung in `chat-title.mjs`: möglichst 2–3 Wörter, höchstens 4 Wörter und 28 Zeichen einschließlich Leerzeichen. Das Hauptthema steht zuerst; bei Überlänge wird neu formuliert, niemals abgeschnitten. Ein ungültiges Ergebnis wird einmal neu angefragt, danach gilt „Neues Anliegen“. Manuelle Benennungen bleiben geschützt; bestehende Titel werden nur auf ausdrücklichen Auftrag überarbeitet.

## Aufbau und Erweiterungen

Die bisherige Projektgruppe heißt in der Seitenleiste „Workspace“. Hinzufügen und Bearbeiten verwenden dieselbe Bezeichnung im bestehenden Dialog. Projekt-IDs, Daten und Ordner bleiben erhalten.

Die Agentenidentität oben links öffnet als ganzer Avatar-/Namensbutton das Agent-Menü. AgentMenu verwendet Avatar und das gemeinsame ChatMenu; der Verbindungspunkt ist Teil des Buttons, sein zugänglicher Name nennt den Zustand. Der konfigurierte Name wird nicht durch einen festen Produktnamen ersetzt. ServerDetails zeigt im geöffneten Menü Verbindung, installierte Vanilla-Produktversion, kurzen Quellstand, Serveradresse, tatsächlich gemeldete Engine samt vorhandener CLI-Version und gemessene HTTP-Antwortzeit. Entwicklung wird ausdrücklich gekennzeichnet; fehlende Werte werden nicht erfunden. Danach folgen Updates, Nutzung, Einstellungen, Archivierte Chats und Server neu starten. Updates öffnet die Versionsseite; eine bekannte neue Freigabe heißt Update verfügbar. Das Menü liest nur den vorhandenen Prüfstand. Kein separater Statusbutton und keine Agentenzeile am Fuß. Auch in Einstellungen und Inbox bleibt der Kopf erreichbar.

Die Projekt-/Chatnavigation liegt in der Seitenleiste. Ein unbenannter neuer Chat zeigt oben keinen Titel und keinen separaten Einstieg „Bestehenden Chat öffnen“. Benannte Entwürfe und bestehende Chats behalten ihr kompaktes Chatmenü. Bei mehreren Panels gehört jedes Drei-Punkte-Menü zum jeweiligen Panel. Die globale Chatleiste enthält die Ansichts- und Workspace-Aktionen ohne untere Trennlinie. Chatfläche zeigt Nutzereingaben, Antworten und kompakte Werkzeugaktivität. Der Composer besteht aus einer pillenförmigen Schreibzeile: Anhängen, Eingabe, genau ein Mikrofon für Diktat, Senden/Stoppen. Unter der Pille steht nur die Modellwahl, links ausgerichtet in der kompakten Schriftrolle caption und mit je 2 px Abstand oben und unten. Arbeitsmodus und Fast liegen im geöffneten Modellfenster: links der Fast-Blitz, rechts Wrench oder SquarePen mit Chevron. Das gemeinsame ChatMenu bietet Umsetzen und Planen ausgeschrieben mit Auswahlhaken. Tooltip und zugänglicher Name nennen den aktiven Modus. Planen bleibt ohne wirksamen Schreibschutz deaktiviert; während laufender Arbeit ist die Moduswahl gesperrt. Fokus, Escape und Klicks im Untermenü erhalten das übergeordnete Modellfenster. Im geschlossenen Modelltrigger kennzeichnet ein kleines Planicon den Planmodus. Fast verwendet aktiv Terrakotta (brand-accent), eine stärkere Kontur und den gemeinsamen Auswahlring. Touchziele bleiben mindestens 44 px hoch. Modellname und Denkaufwand bleiben gemeinsam auswählbar. Keine separate Worker-Beschriftung oder Computer-Use-Schaltfläche im Composer. Bei mehrzeiligen Entwürfen wächst die Schreibfläche; ihre Rundung bleibt erhalten. Zusätzliche direkt benötigte Aktionen sind knappe Iconbuttons mit Tooltip und zugänglichem Namen. Keine Konfiguration oder Verlaufsverwaltung im Composer.

Projekte werden über das Plus an „Workspace“ ergänzt; Chats über das Plus am Projekt. Kontextmenüs und bestehende Dialoge für Bearbeiten verwenden. „Workspace bearbeiten …“ öffnet den gemeinsamen Projektdialog. Unter dem Projektsymbol folgt eine vordefinierte Farbauswahl mit Farbnamen, Auswahlhaken und Tastaturfokus. Die Farbe gilt für das Projektsymbol in Seitenleiste und Chatkopf; „Standard“ verwendet die bisherige neutrale Darstellung. Neue Projekte nutzen denselben Dialog, bestehende Projekte ohne Farbwert bleiben neutral. Der kompakte Projektdialog zeigt eine gemeinsame Vorschau von Symbol und Farbe neben dem Namen, darunter rahmenlos gruppierte Radioauswahlen und eine flache, stets erreichbare Aktionsleiste. Der Dialog nutzt die zentrale transparente Glasfläche mit Hintergrundunschärfe. Nur der Inhalt scrollt, ohne sichtbare Scrollleiste; Kopf und Aktionen bleiben stehen. Bei reduzierter Transparenz oder fehlender Blur-Unterstützung ist die Fläche deckend. Speichern überträgt Name, Symbol und Farbe gemeinsam; erneutes Öffnen und Neuladen erhalten die Auswahl. Mehrfachansichten behalten unabhängige Entwürfe und die gemeinsame Eventverbindung.

## Aufmerksamkeit in der Chatliste

Mehrere sichtbare Chatpanels gelten nicht automatisch als gelesen. Das ausgewählte
sichtbare Panel im Vordergrund bestätigt seine neueste abgeschlossene Antwort,
sobald der zugehörige Verlauf geladen und nach dem Skeleton gerendert ist.
Zwei abbrechbare Animationframes erlauben einen Browser-Paint; die bisherige
700-ms-Verzögerung, Composeraktivierung und Scrollposition entfallen als Bedingungen.
Chatwechsel, laufende Antwort, Skeleton, fremde Verlaufs-ID, Fensterhintergrund
und inaktive Panels verhindern die Bestätigung. Das wiederhergestellte aktive
Panel folgt derselben Regel. Der vorhandene `/chat/read`-Anschluss speichert weiterhin
nur die konkrete abgeschlossene Turn-ID. Nach Erfolg blendet `.chat-complete` über
`motion-feedback-duration` aus; reduzierte Bewegung entfernt den Haken direkt.
Keine neuen Datenfelder oder Migration; Rückkehr betrifft nur die Leselogik.
Klicks auf Nachrichten, Freiflächen und Bedienelemente aktivieren die zugehörige
Pane und deren Composer-Umrandung. Dabei wird das Eingabefeld nicht fokussiert
und keine Bildschirmtastatur geöffnet; dafür bleibt der direkte Eingabeklick.
Scrollen ohne Klick wechselt keine Pane. Explizite Tab-/Navigationsaktionen
bleiben für verborgene Panels und Chatwechsel verfügbar.

Die Markierung liegt ausschließlich auf `ComposerFocus`, nicht auf der Pane:
normale aktive Eingabe mit feiner ruhiger Kontur, andere Eingaben leicht gedämpft.
Ein breiter, schwächerer neutraler Randlichtbogen läuft während der Auswahl
gleichmäßig und nahtlos alle 18 Sekunden um die Kontur. Ein größerer dunkler Abschnitt (250 Grad) und die zurückgenommene Grundkontur machen die Bewegung erkennbar; der 110-Grad-Lichtbogen behält weiche Übergänge. Aussehen → Bewegung reduzieren lässt den Bogen weg; verborgene
Ansichten pausieren. Der Baustein folgt der vorhandenen mehrzeiligen Composerform.
Die bewusste Aufmerksamkeit wird nicht gespeichert, die Panelaufteilung weiterhin
schon. Keine Datenmigration; vorhandene Lesebestätigungen werden nicht zurückgesetzt.

Die Chatliste gewichtet Aufmerksamkeit über die Textfarbe: gelesene, ruhende
Chats in `muted`, laufende und ungelesene Chats sowie Fehler/Unterbrechungen
in `text`. Maßgeblich ist der vorhandene beschriftete `.chat-state`, auch wenn
sein Symbol bei Hover oder Touch dem Aktionsmenü weicht. Die Auswahlfläche
bleibt unabhängig vom Lesestatus; die Sortierung bleibt unverändert. Der grüne Ungelesen-Haken behält seine Form und Farbe, ergänzt
um 2 SVG-Einheiten Kontur. AppLoader und reduzierte Bewegung bleiben erhalten.
Keine neuen gespeicherten Zustände und keine Datenmigration.

## Streaming und Scrollposition

Verlauf und Composer teilen dieselbe zentrierte Inhaltsspalte und dieselben horizontalen Kanten. Die Sprungmarken für bisherige Eingaben bleiben in einem reservierten linken Rand außerhalb der Inhalte, auch beim Streaming und in schmalen Chatpanels. Scrollleisten verändern die Ausrichtung der Inhaltsspalte nicht. Die maximale Inhaltsbreite beträgt 760 px und wächst auf großen Bildschirmen nicht weiter. Panels bis 620 px Breite behalten beidseitig 32 px Rand, größere mindestens 64 px. Die aufgeklappte Eingabevorschau bleibt ein vorübergehendes Overlay und reserviert keine dauerhafte zusätzliche Spalte.

Jedes Chatpanel folgt neuen Inhalten am unteren Rand, solange der Nutzer nicht nach oben scrollt. Text, Werkzeugwechsel, nachgeladene Vorschauen und Größenänderungen werden vor der Darstellung am tatsächlichen unteren Rand ausgerichtet. Automatisches Scrollen bewegt ausschließlich den Verlauf des jeweiligen Panels. Hochscrollen pausiert das Mitlaufen sofort; unten angekommen oder über „Zur neuesten Nachricht“ wird es wieder aktiviert. Layoutänderungen dürfen diese Entscheidung nicht umschalten. Beim Chatwechsel werden Leseposition und Mitlaufzustand gemeinsam erhalten.

## Sprache

Im normalen Composer gibt es genau ein Sprachsymbol: Mikrofon = Diktat in den Entwurf. Keine zusätzlichen Einstiege für Sprachchat oder Vorlesen. Bestehende Ausgabe-Einstellungen und gesicherte Aufnahmen bleiben unter Stimme; die vereinfachte Chatbedienung startet keinen Sprachchat. Während Diktat ersetzt eine einzeilige Pegelleiste Textfeld, Anhang-Plus und normale Sendeaktionen innerhalb derselben Composer-Pille. Ihre Höhe bleibt wie im Ruhezustand; vorhandene Entwürfe und Anhänge bleiben erhalten. Die Leiste zeigt tatsächlichen Pegel, Laufzeit, Pause/Fortsetzen, Papierkorb, Haken und rechts das gemeinsame Senden-Pfeilicon. Der Haken erkennt und ergänzt nur den Entwurf. „Diktat direkt senden“ beendet die Aufnahme, sichert sie, erkennt den Text und sendet ihn einmal gemeinsam mit bestehendem Entwurf und Anhängen. Kein zusätzlicher Modusschalter und kein X während der Aufnahme. Beim Sichern/Erkennen bleiben ein kurzer Status und Schließen zum Abbrechen der Textübernahme bzw. Direktübertragung. Fehler und leere Erkennung senden nichts; Audio bleibt wiederherstellbar, nach Sendefehlern bleibt der Text im Entwurf. Chatwechsel bricht eine ausstehende Direktübertragung ab. Touchziele bleiben mindestens 44 px; die Pegelbreite passt sich an schmale Panels an. Keine Schaltfläche „Aufnahmen“ und keine erklärende Textkarte im normalen Chat. Fehlermeldungen nur bei tatsächlichen Fehlern und mit einem Wiederherstellungsweg.

Diktat übernimmt erkannten Text in den Entwurf. Sprachchat darf erkannte Äußerungen an den ausgewählten Chat senden und die fertige Antwort vorlesen. Automodus gilt nur innerhalb eines bewusst gestarteten Sprachchats. Chatwechsel/Schließen beendet die Sprachbedienung; bereits gesicherte Aufnahmen bleiben erhalten. Rückfragen und Werkzeugfreigaben bleiben im vorhandenen Chatfluss. Keine Erklärungen, Werkzeugausgaben oder Codeblöcke ungefragt vorlesen.

## Details und Einstellungen

Aufnahmearchiv, Anbieterwahl, Geräte und Stimmen gehören unter **Einstellungen → Stimme**. Verbinden externer Anbieter gehört unter **Verbindungen**. Keine neuen Aufnahme-Popovers mit eigenem Archiv oder Anbieterformular.

## Werkzeuge und Ergebnisse

Werkzeuggruppen bleiben kompakt und aufklappbar. Eine gedämpfte Tätigkeitszeile mit passendem Linienicon fasst zusammen, was passiert ist, etwa „Dateien gelesen und Befehle ausgeführt“. Überlegungen werden nicht zusätzlich in die Zusammenfassung aufgenommen, wenn konkrete Werkzeugaktivitäten vorliegen; sie bleiben in den Details zugänglich. Der Aufklapppfeil folgt unmittelbar dem Text. Die Zusammenfassung verwendet die kleine Beschriftungsrolle und einen engen Abstand zum Gespräch. Fehlgeschlagene Schritte stehen mit Anzahl in derselben gedämpften Textfarbe direkt im Lesefluss; rote Fehlerdetails erscheinen erst beim Öffnen des betroffenen Schritts. Ein fehlgeschlagener Gesamtauftrag bleibt als solcher sichtbar. Workername und technische Herkunft stehen ausschließlich in den geöffneten Schrittdetails, nie rechts in der Zusammenfassung. Auch die einzelnen Schrittzeilen bleiben einspaltig; ihr Chevron folgt dem Text. Unvollständige Schritte dürfen nicht als abgeschlossen erscheinen. Über der Antwort stehen Avatar, Name und relatives Alter ohne Trennlinie. Der kompakte Arbeitsstatus steht direkt unter dem neuesten Antworttext vor der einblendbaren Aktionszeile (Vorlesen, Kopieren, Verzweigen, Erneut ausführen). Die Reihenfolge ist Text → Schritte/Laufzeit → Ergebnisse → Nachrichtenaktionen und etwaige Fehler; ausgeblendete Aktionen erzeugen keine Lücke zwischen Text und Status. Er wandert während des Schreibens nach unten und bleibt beim automatischen Mitlaufen über dem Composer sichtbar; manuelles Hochscrollen bleibt möglich. Bei Werkzeugaktivität bildet die aufklappbare Zusammenfassung denselben Status samt Schrittanzahl, Zeit und gewähltem AppLoader während laufender Arbeit. Nach Abschluss bleibt die Zusammenfassung mit Dauer unten am Antwortblock; Fehler und Abbruch bleiben sichtbar. Der Sekundentakt aktualisiert nur diese Komponente, ohne wiederholte Screenreader-Ansage der Zeit. Vorliegende Diffs zeigen hinzugefügte und entfernte Zeilen mit Plus/Minus und semantischen Farben. Große Ausgaben werden begrenzt und auf Nachfrage erweitert. Fehlgeschlagene Schritte dürfen nicht als erfolgreiche Dateierstellung erscheinen.

Bestätigte Leserartefakte stehen unmittelbar unter dem Arbeitsverlauf und über den Nachrichtenaktionen in ChatArtifacts. Bilder sind direkt sichtbar, Dokumente hinter einer kompakten aufklappbaren Ergebnisse-Zeile. Quelldateien und technische Änderungen verbleiben in den Werkzeugdetails. Dateiname öffnet die gemeinsame Vorschau, Download bleibt erreichbar. Bereits inline sichtbare Bilder und ausdrücklich verlinkte Dokumente werden nicht verdoppelt. Umfang, Klassifikation und Zustände führt unten „Ergebnisse für den Leser“.

Die gemeinsame Darstellung verarbeitet normalisierte öffentliche Werkzeugdaten. Codex ist live geprüft; Claude-tool_use/tool_result einschließlich Bildausgaben ist als Datenformat im Adapter getestet, keine bestehende Claude-Code-Verbindung. Neue Engine-Anbindungen müssen denselben Vertrag erfüllen und ihren vollständigen Event-/Dateifluss gesondert prüfen.

## Austauschbare Worker

Der Composer zeigt die Modelle und unterstützten Funktionen des tatsächlichen Workers. Eine Übernahme wird innerhalb der Modellwahl mit dem tatsächlichen Worker und „Vertretung“ erklärt. Eine zusätzliche dauerhafte Worker-Beschriftung unter der Eingabe entfällt. Ein
Planmodus ohne wirksamen Schreibschutz wird nicht angeboten. Die gemeinsame Modellwahl bietet Codex und Claude Code immer als anklickbare Bereiche mit Original-Icons aus `BrandIcon`. Andere bestehende Worker erscheinen dort, wenn sie das aktuelle Gespräch führen. Standard und Vertretung bleiben unter Einstellungen → Worker. Ein ausdrücklicher Anbieterwechsel setzt denselben sichtbaren Chat fort. Chat-ID, Titel, Projekt, Entwurf, Anhänge und Verlauf bleiben erhalten. Im Leerlauf wechselt ein Klick auf den Anbieter direkt, ohne zusätzlichen Lade- oder Fortsetzen-Button; während einer Antwort bleibt „Stoppen und wechseln“ ausdrücklich beschriftet. Erst wird die Zielanmeldung geprüft, dann gegebenenfalls die bisherige Antwort gestoppt und deren Abschluss bestätigt. Der neue Worker erhält eine eigene native Sitzung und den bisherigen Gesprächskontext. Fehler vor der Übernahme verändern die bisherige Zuordnung nicht. Automatische Jobs und Kanalgespräche bleiben fest zugeordnet. Die Anbieterwahl im Chat verändert den globalen Standard nicht.


## Dateien anheften

Drag & Drop und Dateiauswahl nutzen denselben Uploadablauf. Das Ziel ist das konkrete Chatpanel einschließlich Verlauf und Eingabe. Während des Ziehens wird das Ablageziel sichtbar; nach Ablegen erscheinen Uploadstatus, danach Bildvorschauen oder Dateianhänge mit Name und Entfernen-Aktion. Eingabetext bleibt erhalten, Weiterschreiben ist sofort möglich, gesendet wird erst auf Nutzeraktion nach Abschluss der Uploads. Pro Datei gelten 24 MB. Ein Dateifehler verhindert nicht das Anheften weiterer Dateien. Ein Chat- oder Projektwechsel während des Uploads darf die Datei nicht dem neuen Chat zuordnen. Die ursprüngliche Session behält ihre Anhänge.

## Veränderbare Breiten und Workspace

Die Seitenleiste lässt sich an der rechten Trennkante zwischen 220 und 400 px ziehen; ihre Breite bleibt lokal gespeichert. Pfeiltasten bewegen Trennkanten, Doppelklick setzt die automatische Breite zurück. Der Workspace erhält dieselbe Bedienung an der linken Kante, eine Vergrößerungsaktion und eine Rückkehr zur kompakten Breite. Jeder neue Öffnungsvorgang startet mit 280 px; Dateien, Vorschauen, Befehle und Änderungen verbreitern ihn nicht automatisch. Manuelles Ziehen bleibt bis zum Schließen erhalten. Die Chatfläche behält nach Möglichkeit 400 px; bei knappem Platz erscheint der Workspace darüber, auf Mobilgeräten in voller Breite.

Bei geöffnetem Workspace reserviert die globale Chatleiste eine eigene Zeile oberhalb der Inhalte; sie überlagert keine Workspace-Aktionen. Genau ein Sidebar-Symbol rechts in dieser Leiste öffnet oder schließt den Workspace und benennt den aktuellen Zustand. Im Workspace-Kopf wechselt eine kompakte native Auswahl zwischen Dateien, Änderungen und Befehle. Der Workspace öffnet direkt Dateien, eine vorgeschaltete Kachelübersicht entfällt. Der eigene Schließen-Button bleibt für überlagernde mobile Ansichten erreichbar. Daneben schaltet ein diagonales Größen-Symbol zwischen Vergrößern und automatischer Breite um. Auf Mobilgeräten mit voller Workspace-Breite entfällt diese Größenaktion. Die Trennkante behält Doppelklick und Tastaturbedienung.

Der Workspace enthält Dateien, Terminal und Git Review. Eine Browser-Kachel entfällt. Dateien zeigt unabhängig vom Chat den echten Agent-Projektordner des Servers mit allen unmittelbar vorhandenen Einträgen. Geschützte Einträge (versteckte Dateien, Daten-/Schlüsselablage, Abhängigkeiten und ausbrechende Verknüpfungen) sind gesperrt und über „geschützte einblenden“ sichtbar. Ordner werden direkt gelesen, Vorschau und Download sind schreibgeschützt. Explizite Chat-Artefakte verwenden weiterhin ihre bisherigen Workspace-Pfade.

Git Review bezieht sich auf das aktive Projekt. Es zeigt den Branch, neue und geänderte Dateien sowie aufklappbare farbige Diffs für Index und Arbeitskopie. Aktualisieren, Laden, Fehler, kein Repository, keine Änderungen und Ausgabebegrenzung sind eigene Zustände. Es führt keine Git-Schreibaktionen aus und hängt nicht von der Worker-Terminalfähigkeit ab.

Die Nebenfunktion „Befehle“ nutzt den vorhandenen Worker-Anschluss für einzelne Befehle im aktiven Projekt. Jeder Befehl erhält eine neue Shell, maximal 30 Sekunden und begrenzte Ausgabe. Es ist keine persistente interaktive PTY-Sitzung. Laufende, leere oder vom Worker nicht unterstützte Eingaben können nicht abgeschickt werden; Ausgaben, Exit-Code und Fehler bleiben sichtbar.


## Formatierte Antworten und Computer Use

Antworten unterstützen Überschriften, Fett/Kursiv/Durchgestrichen, Zitate, Listen, Links, Tabellen und Codeblöcke. Tabellen erhalten einen fokussierbaren horizontalen Scrollbereich; Codeblöcke eine Kopieraktion. Lokale Markdown-Bilder erscheinen direkt im Text und öffnen die vorhandene Dateivorschau. Externe Bilder werden als Links angeboten. Rohes HTML wird als Text angezeigt; aktive Inhalte gehören nicht in den Chat. Mathematischer Formelsatz und Mermaid sind damit nicht zugesagt. Eigenständige HTML-Artefakte öffnen die vorhandene isolierte Dateivorschau; SVG-Bildvorschauen sind unten beschrieben.

Bilder aus der Zwischenablage nutzen denselben Uploadablauf wie Dateiauswahl und Drag & Drop. Anhängen erhält den Entwurf und sendet nicht selbstständig.

Computer-Use-Schritte gehören in die bestehende Werkzeuggruppe. Sie zeigen den tatsächlichen Worker, einen vorhandenen Aktionstitel, Status und gelieferte Bildschirmaufnahmen. Aufnahmen lassen sich herunterladen. Die Darstellung akzeptiert begrenzte typisierte Rasterbilder aus Codex/MCP- und Claude-Ausgaben; fehlende oder ungültige Bilder werden nicht als erfolgreicher Screenshot ausgegeben. Native MCP-Schritte ersetzen gleichnamige Rohereignisse ohne doppelte Anzeige. Der Stoppen-Button des Chats bleibt der gemeinsame Abbruchweg.

Unter der Eingabe gibt es keinen Computer-Use-Einstieg und keine Werkzeugkatalog-Prüfung. Tatsächliche Computer-Use-Aktivität bleibt in den Werkzeuggruppen sichtbar. Bildschirm-/App-Freigaben bleiben beim ausführenden Worker und dessen Computer-Use-Anschluss.

Das Hauptmenü zeigt Inbox, Aufträge, die verfügbare Bibliothek und Firma in dieser Reihenfolge; darunter bleiben Workspaces und Chats. Firma verwendet dieselbe nav-item-Zeile ohne eigene Abschnittsüberschrift. Verbindungen und Skills werden über die Einstellungen im Agentenmenü erreicht. Modul-Platzhalter und reservierte Leerzeilen entfallen. Symbole, Textkanten, Abstände und Flächengestaltung bleiben erhalten.

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

Neue Chats ohne Gespräch zeigen standardmäßig dezente Lichtpunkte in drei Tiefenebenen, die langsam aus der Mitte nach außen wandern und sanft pulsieren. Inhalt und Layout bleiben unverändert. Unter Aussehen → Visuell → Reiseeffekt stehen „Aus“, „Nur neue Chats“ (Standard) und „Alle Chats“ dauerhaft zur Auswahl. „Alle Chats“ zeigt ein gemeinsames Sternenfeld über die gesamte Chatfläche, auch hinter bestehenden Gesprächen. Reduzierte Bewegung in App oder System zeigt ruhende Punkte; unsichtbare Ansichten pausieren.

## Schwebende Flächen

Die Seitenleiste liegt mit Abstand zum Fensterrand und großen abgerundeten Ecken auf der Grundfläche; ihre Farben und Navigation bleiben erhalten. Die Größenänderung bleibt an ihrer rechten Kante erreichbar. Der Composer liegt rahmenlos und ohne Schatten als flache, in der bisherigen Composerfarbe getönte Blur-Fläche über dem Verlauf. Nachrichten scrollen sichtbar dahinter weiter. Dynamischer Endabstand berücksichtigt Eingabehöhe und Anhänge, damit die letzte Nachricht vollständig oberhalb der Eingabe erreichbar bleibt. Modus und Modell bleiben darunter lesbar. Tastaturfokus bleibt sichtbar.

In der Einzelansicht entfällt der ausgeschriebene Chattitel oben. Ein kompaktes Chatmenü erhält sämtliche Aktionen; die Kopfaktionen schweben über dem nach oben ausblendenden Verlauf. Mehrfachansichten verwenden dasselbe kompakte Drei-Punkte-Menü oben rechts pro Panel; der Titel bleibt im Tooltip und zugänglichen Namen erhalten. Maximieren und Panel schließen stehen im jeweiligen Menü. Unter dem Composer stehen Modus und Modell als freier Text ohne eigene gefüllte Fläche. Der Verlauf blendet über die unteren 192 px weich bis zum Bildschirm- beziehungsweise Panelrand aus. Vollständige Transparenz wird erst am unteren Rand erreicht, nicht bereits an der Optionszeile. Diktat verwendet dieselbe kreisrunde Trefferfläche wie Senden mit größerem Mikrofonmotiv. Die Ziehkante der Seitenleiste erscheint nur bei Hover/Fokus; lange Chatnamen laufen ohne Ellipse weich aus. Projektnamen verwenden keinen Fade, sondern nur bei tatsächlichem Platzmangel eine Ellipse.

Spinner, Ungelesen-, Fehler- und Stoppstatus stehen links vor dem Chatnamen. Bei Hover/Fokus übernimmt dort das Chatmenü den Platz. Rechts entfällt der reservierte Aktionsbereich außer bei angehefteten Chats: Deren animierte 16-px-Nadel sitzt mittig in derselben rechten Aktionsachse wie das Plus des Workspace und reserviert nur dort dessen kompakte Breite. Andere Chatnamen reichen bis auf 12 px an die Seitenleistenfläche und blenden über die letzten 12 px aus. Das relative Alter erscheint bei Hover/Fokus rechts im Zeilenlayout ohne eigene Hintergrundfläche. Der Titel nutzt die verbleibende Breite und läuft weich aus; das Alter bleibt zusätzlich im Tooltip. Die ausgewählte Zeile behält auch bei Hover/Fokus ihre einheitliche Auswahlfläche.

Der Agentenbutton im Kopf besitzt den vorhandenen abgerundeten Hover-/Auswahlzustand. Das gemeinsame Menü öffnet unter dem Button, wird als Portal innerhalb des Viewports positioniert und scrollt bei knapper Höhe. Pfeiltasten, Home/End, Escape, Tab und Außenklick verwenden die bestehende ChatMenu-Bedienung. Lange Agentennamen bleiben im Tooltip und zugänglichen Namen vollständig erhalten.

Projektnamen nutzen die flexible Breite bis zur Plus-Aktion. Auf Geräten mit präzisem Hover reservieren ausgeblendetes Projektmenü und Einklapppfeil im Ruhezustand keinen Platz; bei Hover oder Tastaturfokus sowie auf Touchgeräten bleiben die Aktionen erreichbar. Der vollständige Projektname steht auch im Tooltip.

Anhänge im Composer sind kompakte Bubbles mit 32-px-Bildvorschau und dem vorhandenen Liquid-Glass-Material: glass-button-tint, glass-button-blur und glass-button-edge. Die dezente Tönung lässt den dahinter scrollenden Inhalt weich durchscheinen; ohne Blur oder bei reduzierter Transparenz gilt die deckende Composerfläche. Vorschau und Dateiname öffnen per Klick oder Tastatur die vorhandene größere Dateiansicht; Entfernen bleibt eine separate Aktion. Der Entwurf bleibt dabei erhalten. Lange Namen werden innerhalb der maximal 260 px breiten Chips gekürzt, der vollständige Name bleibt im Tooltip und zugänglichen Aktionsnamen erhalten.

Die globale Chatkopfzeile richtet ihre Bedienelemente auf derselben Höhe wie die Agent-Überschrift der eingerückten Seitenleiste aus. Rechts stehen in der Einzelansicht Chatmenü, Ansichtsaufteilung und Workspace zusammen; links bleibt nur bei geschlossener Seitenleiste deren Öffnen-Button. Einzelansicht, Mehrfachansicht und geöffneter Workspace teilen diese Höhe. In der schwebenden Einzelansicht blendet der Verlauf über die oberen 192 px weich aus und wird erst unmittelbar am oberen Bildschirmrand vollständig transparent. Es gibt keine vorzeitig unsichtbare Zone hinter der Kopfzeile.

Chat und Workspace besitzen eigene Kopfbereiche. Der Workspace reicht mit 8 px Außenabstand von der oberen bis zur unteren Fensterkante und übernimmt Rundung und Innenabstand der Seitenleiste. Seine Fläche verwendet `workspace-panel-bg`, in allen dunklen Farbwelten Schwarz als Basis zur sichtbaren Trennung vom Chat. Die zentrale fast deckende Glasfläche, diffuse dezente Verläufe, feine innere Lichtkante und weicher Schatten geben dezente Tiefe. Die 32-px-Hintergrundunschärfe erhält bei fehlender Unterstützung und reduzierter Transparenz eine deckende Ersatzfläche. App-Grundfläche und Suchfeld behalten `workspace-backdrop`; im hellen Erscheinungsbild bleibt die bisherige Workspace-Farbe erhalten. Die linke Navigation behält ihre hellere `sidebar`-Fläche; die Workspace-Aktionen heben sich mit `raised` ab. Diese Zuordnung gilt auch bei schmalem und vergrößertem Workspace. Die Einzelansicht behält beim Öffnen und Schließen ihren schwebenden Chatkopf und dieselbe obere Verlaufskante. Mehrfachansichten reichen ebenfalls bis zur oberen Kante. Panelmenüs und globale Ansichts-/Workspace-Aktionen teilen eine schwebende Kopfzeile ohne Überschneidung. Bei Platzmangel liegen die Paneltabs darunter über dem Verlauf; Workspace-Köpfe erhalten keinen Tabversatz. Auf schmalen Fenstern überlagert der Workspace den Chat und bleibt über seinen eigenen Schließen-Button erreichbar. Vergrößern zeigt den Workspace über die gesamte Chatfläche; erneutes Betätigen kehrt zur automatischen Breite zurück.

Seitenleisten-Chatliste, Gesprächsverlauf und Composer behalten Scrollfunktion und Tastaturbedienung ohne sichtbare Scrollleisten. Code, Tabellen und Dateiansichten behalten ihre nativen Scrollleisten. Im erzwungenen Kontrastmodus bleiben native Scrollleisten auch in den drei genannten Bereichen sichtbar.


## Native Sitzungsauswahl

ACP und Codex verwenden dieselbe kompakte Composerzeile mit ausschließlich
ModelPicker. Native Slash-Befehle können direkt in die Eingabe geschrieben werden;
erst Senden führt sie aus. Separate Menüs für Befehle, Mode, Fast und interne
Updatehinweise entfallen. Modell und Denkaufwand verwenden die bestätigten
nativen Optionen. Der native Claude-Fast-Schalter sitzt wie Codex links im
Modellfenster; während einer laufenden Claude-Antwort ist er gesperrt.
Nicht eingeblendete native Einstellungen behalten ihren Wert; Berechtigungen
werden durch die vereinfachte Darstellung nicht geändert.

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

Zwischenmeldungen bleiben während der Arbeit im Gespräch sichtbar. Sobald eine abschließende Antwort vorliegt und die Arbeit beendet ist, werden Zwischenmeldungen und Werkzeugschritte in ihrer ursprünglichen Reihenfolge in die standardmäßig geschlossene Gruppe aufgenommen. Aufklappen zeigt den vollständigen Ablauf. Ein ausdrücklich geöffneter Arbeitsverlauf und seine geöffneten Werkzeugdetails bleiben beim Abschluss offen. Diese Entscheidungen liegen bei ChatTurn und überstehen das Umhängen der Statuszeile unter die finale Antwort. Laufende oder fehlgeschlagene Turns ohne Abschlussantwort verlieren ihre sichtbaren Zwischenmeldungen nicht. Nutzernachrichten und Antworten behalten ihre Reihenfolge; Nachträge werden nicht vor die erste Nutzernachricht verschoben.

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

`ModelPicker` nutzt die gemeinsame `popover-glass`-Fläche mit 28 px Blur, stärkerer Transparenz, feinen Lichtkanten und flachen 32-px-Zeilen. Die Standardansicht zeigt `ReasoningSlider` direkt unter dem kompakten Kopf: Stufe mittig, Modell klein darunter, nativer Fast-Blitz links und Arbeitsmodus rechts. Sichtbare Überschriften entfallen. Die Namen beginnen groß, `xhigh` erscheint als `X-High`; native Werte und Anzahl bleiben unverändert. Klick auf die Mitte öffnet im selben Glas mit 24-px-Außenrundung die Anbieter- und Modellwahl mit Original-Icons. Erfolg kehrt zum Regler zurück, Fehler bleiben sichtbar. Zurück und Escape gehen vom Modellmenü zum Regler, ein weiteres Escape schließt. Ohne geladene Modelle steht direkt der bestehende Einrichtungszustand. Die Höhe passt sich sanft an, ohne Inhalte zu skalieren oder unsichtbare Bedienelemente zu duplizieren. Low bis Max unterscheiden sich zusätzlich durch Dichte und Ausdehnung des Quadratfelds; Ultra behält seinen verstärkten Abschluss. Auf Touch sind Ziele mindestens 44 px hoch. Kein Fertig-Button und keine dauerhaften Effort-Kacheln. Escape, Außenklick und Verlassen schließen; Tastaturfokus bleibt sichtbar. Fenster, Bildschirmtastatur und vergrößerte Schrift begrenzen Position und Scrollhöhe. Ohne Transparenz oder Blur wird die Fläche deckend. Animationen folgen der App-/Systemvorgabe für reduzierte Bewegung und pausieren außerhalb der sichtbaren Fläche.

Während einer laufenden Antwort bleiben Modell und Denkaufwand auswählbar. Die Wahl wird pro Chat für die nächste Nachricht vorgemerkt; der Hinweis im geöffneten Menü benennt dies. Die laufende Antwort bleibt unverändert, ein Anbieterwechsel verwendet die ausdrücklich beschriftete Stoppen-und-Wechseln-Aktion. Die Vormerkung bleibt beim Wechsel zwischen Chats in der geöffneten App erhalten. Erst das nächste Senden übergibt sie unter derselben serverseitigen Turnsperre wie den Prompt. Eine noch laufende Antwort nimmt die Vormerkung nicht als Steuerungsnachricht entgegen. ACP bestätigt Modell und anschließend die zugehörigen Denkstufen nativ; unbekannte Werte stoppen das Senden und erhalten den Entwurf. Bei einem vorgemerkten anderen ACP-Modell erscheinen dessen noch nicht gemeldete Denkstufen nicht vorab.

Codex zeigt ausschließlich gemeldete, sichtbare Modelle der GPT-5.6- und GPT-6-Serie. Bereits vorhandene Gespräche mit älteren Modellen behalten ihren tatsächlichen Modellnamen. Die Stufen kommen exakt aus `supportedReasoningEfforts`, mit unveränderten nativen Werten und lediglich großgeschriebenen Anzeigenamen. Beim Modellwechsel bleibt eine Stufe nur erhalten, wenn das neue Modell sie anbietet.

Claude Code lädt seine echten Modelle beim Öffnen einer leeren nativen Sitzung. Vorhandene CLI-/OAuth-Anmeldung wird durch den bestehenden ACP-Anschluss verwendet. Ein erfolgreicher Handshake alleine gilt nicht als Modellzugang. Ohne Anmeldung bleiben verständlicher Fehler, erneuter Versuch und der Original-Einrichtungslink erreichbar. Es wird keine Nachricht gesendet und kein Modellkatalog erfunden. Native `configOptions` sind führend: Modell- und Effort-Auswahl stehen gemeinsam im Picker und erscheinen nicht nochmals neben dem Composer. Ein Modellwechsel übernimmt erst die vollständige Antwort mit den zu diesem Modell passenden Stufen; abgewiesene Werte bleiben unverändert. Separate Sitzungseinstellungen entfallen im Composer; native Befehle bleiben per Texteingabe verfügbar.


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

Der ReasoningSlider bewegt sich zwischen den Punkten frei, zieht nahe Punkte magnetisch an und übernimmt beim Loslassen genau eine native Stufe. Keine unteren Low-/Ultra-Labels und kein diagonaler Popover-Verlauf. Native Default-/Auto-Werte sind keine auswählbare Denkstufe und erhalten keine Rücksetzaktion. Solange ein solcher Wert aktiv ist, zeigt der Regler „Stufe wählen“, ohne eine konkrete Stufe vorzutäuschen. Anzahl und Namen bleiben modellspezifisch.

Codex bietet einen flachen Blitz-Button „Fast“, sofern `model/list.serviceTiers` eine passende Option meldet. Native IDs werden unverändert verwendet. Die Wahl gilt erst für die nächste Nachricht, bleibt pro bestehendem Chat gespeichert und wird über `serviceTierForTurn` übertragen; Standard wird ausdrücklich mit `default` gesendet. Ein nicht mehr unterstützter Tier wird nicht an das neue Modell übertragen. Der Tooltip nennt den höheren Verbrauch. Claude verwendet denselben Fast-Blitz für seine bestätigte native on/off-Option.

Anbieterübernahmen speichern einen unveränderlichen Verlaufsschnappschuss. Neue native Ereignisse werden auf die sichtbare Chat-ID zugeordnet; verspätete Ereignisse der alten Sitzung verändern den neuen Verlauf nicht. Die Kontextübergabe enthält einen begrenzten Gesprächsauszug und den vollständigen lesbaren Export, ohne private Reasoning-Inhalte. Neustart und erneutes Öffnen behalten Zuordnung und Verlauf. Verzweigen bleibt nach dem Übergabepunkt möglich; Löschen über die Anbietergrenze hinweg wird vor nativen Änderungen abgewiesen.

Die Modellwahl behält während einer Öffnung ihre horizontale Ausrichtung unabhängig von wechselnden Modell-, Denkaufwand- und Fast-Beschriftungen. Die beim Öffnen gemessene Triggerbreite bleibt der Anker; tatsächliche Layoutänderungen und Viewportgrenzen werden weiterhin berücksichtigt. Erneutes Öffnen richtet das Menü frisch aus.

Die Reasoning-Spur ist eine horizontale Pille, ihr stärker mattierter Glasgriff eine vertikale Pille mit 16 px Blur. Bereits erreichte Punkte verschwinden; nur die noch vorausliegenden Rastpunkte bleiben neutral sichtbar. Die native Stufe Ultra verstärkt Terrakotta-Sättigung, Schweiflänge und Tempo zusätzlich, mit weichem Übergang beim Ziehen. Andere höchste Stufen werden nicht als Ultra behandelt. Die Werte liegen in amountSliderMotion und den slider-Glas-/Akzentrollen; reduzierte Bewegung bleibt statisch.


## Adaptive HTML-Vorschau · Version 1.1.0

HTML-Links öffnen FileContent im kompakten Workspace als gerenderte Seite.
Die verfügbare iframe-Breite bestimmt den responsiven Dokumentaufbau. „Vergrößern“
erweitert denselben Workspace und „Verkleinern“ stellt dessen vorherige Breite
wieder her. „Vollbild“ verwendet separat die native Browserfunktion auf demselben
HtmlPreview-Element, ohne den iframe zu versetzen oder neu zu laden. Escape und
„Vollbild verlassen“ führen zurück. Fehlende Browserunterstützung wird angezeigt.
„Präsentieren“ aktiviert die Foliensteuerung für markierte Dokumente; ohne Folien
bleibt HTML frei scrollbar. Dateititel, gemeinsame IconButtons und ein kompakter
Folienzähler sind die einzigen zusätzlichen Elemente. Im Vollbild bleiben die
Steuerelemente erreichbar; andere Workspace-Aktionen liegen außerhalb der Bühne.
Bearbeiten bleibt getrennt. Das vollständige Dokumentprotokoll steht im
Bibliotheksvertrag.
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

Keine feste Eintragsgrenze, fünf aufgefächerte Karten auf breiten Flächen, drei auf schmalen. Seitliche Karten
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


Der leere Chat verwendet denselben schwebenden Composer wie der Gesprächsverlauf.
Der scrollbare Einstieg reicht bis zum unteren Panelrand: Karten und Text laufen
hinter Eingabe und Anhängen weiter, ohne harte Schnittkante an deren Oberseite.
Der gemeinsame untere Fade und der dynamische Composer-Endabstand halten die
letzten Inhalte und die Kartennavigation vollständig erreichbar.
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
Berichtschat, Aufträge in den bestehenden Dialog. Diese Aktionen starten keine Arbeit; die eingerichtete Wetterkarte startet auf ausdrücklichen Klick ihren Bericht mit kurzer Einordnung.
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

Alle Fächerkarten sind einschließlich Innenabständen 14 rem hoch (224 px bei normaler Schriftgröße); vergrößerte Schrift skaliert auch die Kartenhöhe. Titel und
Beschreibung bleiben auf je zwei Zeilen begrenzt. Die Navigation reserviert auch
bei einer einzelnen Karte ihre Höhe. Die Startreferenz zeigt denselben Avatar,
Textbaustein und Fächer.


Die angeschlossene Wetterkarte bleibt im Startfächer reserviert. Open-Meteo liefert Temperatur und Wetterlage; Quelle und Datenstand sind im Wetterbericht sichtbar. Ortssuche und bestätigte Koordinaten stehen unter Dein Profil. Speichern, erneutes Öffnen, Fokus und zehn Minuten im sichtbaren Chatstart aktualisieren das Wetter. Eindeutig passende alte Ortsnamen werden aufgelöst; mehrdeutige Orte erfordern Auswahl. Lade- und Abruffehler ersetzen keine Wetterwerte durch Beispiele. Ohne bestätigten Ort öffnet die Karte das Profil; mit eingerichtetem Ort öffnet sie einen neuen Wetterchat.

AgentMenu zeigt jeden konfigurierten Namen als Text in der gemeinsamen runden
Namensschrift Quicksand (`font-agent-name`, `section`, `semibold`). Vanilla ist
der frei änderbare Startname. Umbenennen erhält Schrift, Größe und Gewicht;
lange Namen erhalten eine Ellipse. Der zugängliche Buttonname nennt weiterhin
den vollständigen Agentennamen und Verbindungszustand. App-Icon und
Installationsname bleiben fest Nori/Vanilla.


Die Chat-Panels trennt eine leise, 1 px breite warmgraue Haarlinie aus der
zentralen Theme-Rolle `pane-seam`. Oben und unten läuft sie über 96 px aus.
Der vorhandene PaneDivider behält seine unsichtbare Trefferbreite von 14 px,
Ziehen und Pfeiltasten; Hover, aktives Ziehen und Tastaturfokus zeigen den
mittigen 2 × 32 px Griff. Erzwungener Kontrast verwendet eine Systemlinie.
Unser Design zeigt denselben Baustein. Ein einziges WelcomeParticles-Canvas
liegt hinter der gesamten Chat-Panelfläche, mit gemeinsamem Bewegungszentrum.
Eingebettete Panels bleiben transparent. „Alle Chats“ aktiviert das gemeinsame
Feld immer, „Nur neue Chats“ sobald mindestens ein sichtbares Panel einen neuen,
geladenen Chat ohne Verlauf zeigt. Verborgene Panels aktivieren es nicht.
Aus, reduzierte Bewegung und Pausieren unsichtbarer Ansichten bleiben erhalten.
Keine Datenmigration; gespeicherte Auswahlwerte bleiben kompatibel.


### Wetter im bestehenden Glasfächer

Die Wetterkarte verwendet WeatherCardContent und WeatherScene innerhalb von
AttentionFan. Fächergeometrie, Höhe, Navigation und Aktionen bleiben gemeinsam.
Ort über großer Temperatur (Rolle weather, 56 px), Wetterlage, optional echte
Tageshöchst-/Tiefstwerte; im Fuß steht nur Heute & 7 Tage. Quelle und Datenstand stehen im Bericht; der erforderliche Open-Meteo-Link bleibt bei ausgewählter echter Wetterkarte klein unter dem Fächer erreichbar. Fehlende Werte
werden ausgelassen. Lade-, Fehler- und Einrichtungszustände behalten die bisherige
neutrale Textkarte. Ohne Ort oder bei mehrdeutigem Altort öffnet ein Klick das Profil; bei eingerichtetem Ort startet er einen neuen Wetterchat im aktuellen Workspace.

Eigene Himmelsszenen orientieren sich an Apples iOS-26-Wetterdarstellung:
sattes Blau und gelbe Sonne, geschichtete weiche Wolken, Regen, Schnee, Frost,
gefrierender Regen, Nebel und Gewitter. is_day bestimmt Tag/Nacht unabhängig
vom App-Theme; bei fehlendem Tag/Nacht-Wert wird kein Nachtzustand behauptet.
Temperaturen unter oder gleich null ergänzen bei klarem Wetter Frost. Reifnebel, Nieselregen, Starkregen, Hagel und stärkere Winde besitzen eigene Details.
Wettercodes sind keine amtlichen Warnungen. Die ausdrücklich markierte Warnkarte
in WeatherPreview ist nur ein Designbeispiel, bis eine Warnquelle angeschlossen ist.
Apple-Referenzbilder werden nicht als Produktassets übernommen.

Farben, Licht, Typografie und Bewegungsdauern führt weatherArtwork in der
zentralen Designquelle. Glasrahmen und Fächerschatten bleiben erhalten; die
Landschaft ist auf die Kartenfläche begrenzt. Die abdunkelnde Textebene hält
Beschriftungen ruhig lesbar. Keine blitzenden Gewittereffekte. Aussehen → Visuell
→ Wetterbewegung speichert den Ein-/Aus-Zustand lokal und synchronisiert Tabs;
Speicherfehler bleiben sichtbar. Reduzierte Bewegung zeigt statische Szenen,
Sichtbare seitliche Wetterkarten bewegen sich ebenfalls; unsichtbare Karten und versteckte Ansichten pausieren. Pointer-Parallaxe bewegt Hintergrund, Wolken und Niederschlag mit unterschiedlichen, zentral festgelegten Tiefen; die Schrift bleibt fest. Ein federnder Rücklauf und verschobenes Flächenlicht ergänzen die feine Liquid-Glass-Kante. Touch benötigt keine Bewegungssensoren. Sonne und Strahlen bewegen sich ruhig, aber klar sichtbar, Eis schimmert sanft. Forced Colors blendet die
Dekoration aus. Unser Design zeigt alle Wetterzustände im produktiven Fächer
mit ausdrücklich markierten Beispieldaten und Tag-/Nachtwahl.


Die Chat-Mehrfachansicht speichert Panelanzahl, Reihenfolge, aktives Panel,
Breiten und die Session-/Workspace-Zuordnung jedes Panels lokal im Browser.
Hard Refresh und App-Neustart stellen diese Auswahl wieder her, einschließlich
der wegen Platzmangels verborgenen Panels. Ohne gespeicherte Auswahl startet
ein leerer Chat. Gelöschte Sessions ergeben ein leeres Panel; vorübergehende
Ladefehler löschen die Zuordnung nicht. Explizite Chatlinks öffnen ihren Chat
im ersten Panel und aktivieren dieses. Maximieren bleibt vorübergehend.


Der Wetterklick liest den gespeicherten Ort serverseitig und holt eine aktuelle
Open-Meteo-Vorhersage. Erst nach gültigen sieben Tagen entsteht über den bestehenden
Berichtschat-Baustein eine neue Session im aktiven Workspace. Der dauerhaft gespeicherte
Bericht enthält aktuelle Werte, sieben Tageszeilen und die nächsten Stunden mit
Ortszeit, Einheiten, Quelle, Abrufzeit und fehlenden Werten als Strich. Er bleibt
beim Wiederöffnen als zeitgebundener Bericht erkennbar. Danach startet genau eine
kurze KI-Einordnung über den bestehenden Turn-Anschluss. Sie nutzt nur belegten
persönlichen oder Projektkontext dieses Workspaces, maximal drei passende Hinweise;
keine erfundenen Baustellen, keine Zuordnung fremder Orte und keine Arbeitsfreigaben.
Ohne solchen Kontext genügt der allgemeine Ausblick. Fehlende Einordnung lässt den
Datenbericht erreichbar. Wiederholungen desselben Klicks sind über requestId
idempotent, ein neuer bewusster Klick erzeugt eine neue Session. Der Composer-Entwurf
bleibt erhalten. Forecast-Fehler erzeugen keine leere Session. Die Quellenangabe
entfällt auf der kompakten Kachel; unter dem Fächer steht bei ausgewähltem Wetter der Quellenlink. Die Quellenzeile reserviert ihre Höhe auch bei anderen Karten und im Skeleton. Ausführliche Quellen stehen im Wetterbericht und im Profil.


## Chat-Sperre ohne Nutzerkonten

Das Drei-Punkte-Menü des jeweiligen Panels bietet „Chat sperren …“. Im bestehenden
Modal wird eine vierstellige PIN zweimal eingegeben. Der Hinweis erklärt fehlende
PIN-Wiederherstellung, Entfernung aus aktivem gemeinsamen Memory und die Grenze
zu exportierten Dateien und Sicherungen. Keine PIN im Browser speichern.

Gesperrte Chats heißen „Privater Chat“. Die Chatliste zeigt das vorhandene animierte
Lock-Icon rechts, unabhängig vom Hover-Menü. Die Zeile bleibt zum Entsperren
anklickbar. LockedChat ersetzt Verlauf, Eingabe und Kapitelnavigation vollständig;
ChatPrivacyForm verwendet ein maskiertes natives Eingabefeld mit numerischer
Tastatur, Enter, verständlicher Fehlermeldung und Pending-Zustand. Derselbe Baustein
steht im Einrichtungsdialog. Nach dem Entsperren schließt ein IconButton neben
dem Chatmenü sofort wieder ab. „Schutz entfernen …“ verlangt erneut die PIN.

Die Animation stammt unverändert aus MotionGlyph, icon-catalog.mjs und
icon-animation.mjs (Lock); bestehende Hover-/Klick- und Reduced-Motion-Regeln
gelten. Farben, Abstände, Form und Typografie verwenden gemeinsame Tokens.

Der Python-Kern prüft PIN und Zugriffe. Gesalzene scrypt-Prüfwerte und Fehlversuche
bleiben serverseitig. Nach fünf Fehlversuchen folgt eine Minute Wartezeit.
Entsperrungen sind kurzlebig und gelten nur für einen Browser-Tab; fünf Minuten
ohne Bedienung oder Neuladen sperren. Abschließen widerruft alle Entsperrungen
dieses Chats und informiert andere Panels/Tabs über den bestehenden Ereignisstream.
Direktzugriff auf Verlauf und Chataktionen ist ebenfalls geschützt. Suche und
Startkarten liefern keine privaten Gesprächsinhalte. Der Ereignisstream filtert
auch bereits gepufferte Nachrichten bei der Auslieferung.

Aktives Memory wird beim Einrichten bereinigt und neue Erfassung unabhängig von
der allgemeinen Memory-Einstellung verhindert. Historische Sicherungen, eigene
Ableitungen und exportierte Dateien bleiben erhalten; dies ist keine Verschlüsselung
und keine Grenze gegen Admin-, Dateisystem- oder Werkzeugzugriff. Verzweigen,
Anbieterübergabe und Fortsetzungsnotizen bleiben bei privaten Chats gesperrt, damit
keine ungeschützte Gesprächskopie entsteht. Das Entfernen der PIN schaltet die
Memory-Erfassung nicht automatisch wieder ein.


Die Wetterbeleuchtung unterscheidet Morgendämmerung, Morgen, Tag, Sonnenuntergang, Abenddämmerung und Nacht anhand gelieferter Sonnenauf- und Untergangszeiten am Wetterort. Der Sonnenbogen ist eine dekorative Annäherung innerhalb der Karte, kein astronomischer Positionsmesser. Ohne Sonnenzeiten gilt weiterhin is_day; ohne beides bleibt der Himmel neutral. Die Uhr wird bei sichtbarer Ansicht minütlich aktualisiert. Vorschauen zeigen dieselben sechs Phasen mit markierten Beispieldaten. Größere Wolkenwege, gegenläufige Ebenen, Sonnenstrahlen und dezentes Sternenfunkeln machen Motion erkennbar, ohne Text zu bewegen.


Das Chat-Menü beginnt mit Neuer Chat, Anpinnen/Nicht mehr anpinnen und
Umbenennen. Darauf folgen Chat verzweigen, Fortsetzungsnotiz und Teilen und
exportieren. Kopieren, Markdown und der zugangsbeschränkte App-Link stehen
ausschließlich im gemeinsamen Teilen-Dialog; die allgemeine Suche wird nicht
als Chat öffnen dupliziert. Schutz, Ansicht und Archivieren bilden getrennte
Gruppen. Chat N maximieren und Chat N schließen verwenden dieselbe Bezeichnung;
Schließen entfernt nur die Ansicht, Archivieren bleibt die letzte Aktion.
ChatMenu trennt Gruppen durch nicht fokussierbare Separatoren mit zentralen
Abstands- und Farbrollen. ChatTitle verwendet in allen Ansichten dieselbe
Reihenfolge. Verzweigen ist nur bei bestätigter Anbieterfähigkeit verfügbar,
Fortsetzungsnotizen und Textexport erst bei geladenem Gesprächsinhalt.


### Anpassungsfähiger Agentenname

Der Seitenleistenkopf reserviert den verbleibenden Platz für den Namen: kein
Zusatzabstand zwischen den Kopfaktionen, kompakte Iconbreite `control-height`
bei Mausbedienung, unverändert `control-touch` bei Touch. Der Avatarabstand nutzt
`space-8`. AgentName misst den Text nach Namenswechsel, Schriftladen und
Breitenänderung und verkleinert ihn bei Bedarf von `section` bis `reading`.
Erst wenn diese gut lesbare Mindestgröße nicht reicht, erscheint eine Ellipse;
der vollständige Name bleibt als Tooltip und im zugänglichen Buttonnamen erhalten.
Keine Datenmigration, keine Änderung gespeicherter Namen.


### Lebende Antwortkarten · Version 1.1.0

Der Startfächer zeigt die neueste ungelesene abgeschlossene Antwort jedes normalen
Chats im aktiven Workspace als eigene Karte. Keine Begrenzung auf fünf Karten.
Private, archivierte und auftragsgebundene Chats bleiben ausgeschlossen. Die
Kartenkennung enthält Chat und Turn; gelesene Antworten verlassen den Fächer.
Nur ohne ungelesene Chatantworten wird das letzte Gespräch als Weitermachen angeboten.
Vorhandene Ereignisse aktualisieren den Fächer ohne Plus oder erneutes Öffnen.

Bestehende Karten behalten Reihenfolge und Auswahl. Neue Einträge kommen vor
festen Dienstkarten hinzu. Entfernen der Auswahl wählt den nächsten erhaltenen
Nachbarn, am Ende den vorherigen. Keine automatische Rotation und kein Sprung
auf neu angekommene Inhalte. Kartenhöhe, Kopftext und Navigation bleiben reserviert;
der Zähler verwendet gleich breite Ziffern. Gleichzeitig sichtbar bleiben auf mindestens 460 px breiten Fächerflächen fünf,
sonst drei Karten zuzüglich kurzer, nicht bedienbarer Ausblendungen.

AttentionFan verwendet AnimatePresence und die zentralen attentionFanMotion-Werte:
280 ms Einblenden aus geringer Tiefe, 180 ms Ausblenden mit leichtem Zurücknehmen,
gedämpfte Positionsübergänge ohne Nachschwingen. Keine Unschärfe über der Schrift,
keine dauernden Effekte. App-/Systemvorgaben für reduzierte Bewegung schalten
Übergänge unmittelbar. Entfernte Karten sind während der Ausblendung inert.

Sichtbare Antwortkarten laden ausschließlich den passenden abgeschlossenen Turn
über die vorhandene geschützte Thread-API. Nur die letzte finale Agentenantwort
liefert die gekürzte Vorschau, keine Werkzeuge oder Zwischenmeldungen. Fehlende
Vorschau bleibt ausdrücklich erkennbar; verspätete Antworten überschreiben keinen
neueren Turn. Klick öffnet den zuständigen Chat und springt zum Antwortanfang,
auch bei bereits geöffnetem Panel. Gelesen wird weiterhin erst bei bewusster
Auswahl und vollständig geladenem, abgeschlossenem Verlauf im aktiven Chat bestätigt, niemals durch die Kartenvorschau.

Unser Design enthält ein lokales Live-Beispiel zum Hinzufügen, Entfernen und
Zurücksetzen. Beispiele verändern keine Chats. Keine neue Datenhaltung oder
Migration; Rückkehr stellt nur bisherige Darstellung und Kartenbegrenzung wieder her.

## Native Rückfragen am Composer · Version 1.0.0

Nur strukturierte Anbieteranfragen öffnen `ComposerQuestion`: Codex
`item/tool/requestUserInput` und ACP `elicitation/create` (Form). Text und
Werkzeugausgaben werden nicht nach Fragen durchsucht; keine zusätzliche
Aufforderung an das Modell, Fragen zu erzeugen. Alle gelieferten Optionen,
Beschreibungen und Mehrfachauswahlen bleiben erhalten. Es gibt keine erfundenen
oder automatisch abgeschickten Vorauswahlen.

Die schmale zentrierte Karte steht unmittelbar über der Schreibpille, mit
horizontaler Haarlinie, `radius-large` und dem gemeinsamen Composerglas.
Der normale Composer zeigt während der Rückfrage „Sonstiges“. Auswahl oder
Freitext werden erst über den bestehenden Sendepfeil/Enter übernommen.
Mehrere Fragen teilen denselben Composer, mit Vor-/Zurücknavigation; erst die
letzte Bestätigung übermittelt das vollständige native Antwortobjekt. Auswählen
sendet nichts. Freitext ersetzt die Auswahl der jeweiligen Frage. Bei nativen
Formfeldern ohne freie Antwort bleibt die Eingabe schreibgeschützt. Vertrauliche
Felder sind maskiert. Diktat ergänzt die Rückfrage, nicht den normalen Entwurf.

Die Antwort verwendet `/api/respond` und die konkrete offene Request-ID,
niemals `/api/turn`. Der Anbieter behält seinen wartenden Aufruf; keine
simulierte Pause und kein neuer Modelllauf. Sendeversuche sind während einer
laufenden Übertragung gesperrt. Ein Fehler erhält Eingabe und Auswahl und wird
an der Karte angezeigt. Stoppen bleibt erreichbar. Erledigte, abgebrochene und
bei Verbindungstrennung ungültige Fragen verschwinden. Offene Anfragen kommen
beim Neuladen über Bootstrap erneut an. Ungesendete Frageantworten leben nur
im jeweiligen Panel, ohne Browserpersistenz; normale Entwürfe und Anhänge
bleiben von der Rückfrage getrennt. Mehrere Requests werden in Empfangsfolge
beantwortet, jeder nur im zugehörigen Chat. Freigaben behalten ihren vorhandenen
spezifischen Ablauf im Verlauf.

Bestätigte nicht vertrauliche Frageantworten werden als kompakter
Werkzeugeintrag im bestehenden Arbeitsverlauf gespeichert; externe Formulare
und Secret-Felder werden nicht in diese zusätzliche Quittung übernommen.
`tools.json` und das bestehende Transkriptformat werden weiterverwendet.
Keine Datenmigration, keine Änderung von Konten oder gespeicherten Entwürfen.
Rückkehr stellt die bisherige Darstellung wieder her; vor Adapterwechsel
müssen offene native Aufrufe abgeschlossen oder regulär gestoppt werden.

Tastaturfokus, native Radio-/Checkbox-Bedienung, begrenzte Kartenhöhe,
interner Scrollbereich, transparente und deckende Ersatzflächen gelten auch
auf schmalen Panels. Der kurze Eintritt verwendet bestehende Motionrollen;
reduzierte Bewegung bleibt statisch. Unser Design enthält denselben Baustein
als lokale interaktive Vorschau.

## Römische Forktitel · Version 1.0.0

Beim ersten erfolgreichen Verzweigen erhält der ursprüngliche Chat `I · Titel`,
der neue `II · Titel`. Weitere Abzweigungen derselben Familie zählen mit III, IV
usw. weiter, auch beim Fork eines Forks. Ohne Fork bleibt der Titel unverändert.
Die vorhandenen Chatzeilen, Suche und Panelmenüs zeigen denselben gespeicherten
Titel mit der Nummer vorne; keine neuen Komponenten oder Stilwerte.
Umbenennen bleibt frei und verändert andere Familienmitglieder nicht. Ein
weiterer Fork übernimmt den aktuellen Quelltitel ohne dessen verwaltete Nummer.

Datenvertrag: `chat-fork.mjs` ergänzt beim erfolgreichen Fork optional
`forkFamilyId`, `forkIndex` und `forkSequence` im vorhandenen Chatdatensatz.
Die Familienzuordnung folgt IDs, niemals gleichlautenden Titeln. Der höchste
vergebene Zähler wird bei allen vorhandenen Familienmitgliedern mitgeführt;
Archivieren, Löschen einzelner Mitglieder und Neuladen setzen ihn nicht zurück.
Die Nummer wird erst nach erfolgreichem nativen Fork vergeben. Alle geöffneten
Ansichten erhalten danach das bestehende `wrapper/chats`-Ereignis.

Migration: additive Felder, keine Startmigration und keine Massenumbenennung.
Alte Kopien ohne belegte Familienzuordnung bleiben eigenständige Chats; beim
nächsten Fork beginnen sie eine neue Familie. Älterer Code kann Titel und
Datensätze weiter lesen, vergibt aber wieder Kopie-Zusätze. Nach einer solchen
Rückkehr erstellte Kopien müssen vor erneutem Einsatz gesondert zugeordnet werden,
da alter Code Familienfelder ungeprüft kopieren kann. Native Sitzungsdaten und
Kontextverwaltung bleiben unverändert.


## Persönliche Statistik und Fächer · Version 1.2.0

ChatStart begrüßt beim ersten Inhalt mit dem ersten Namensbestandteil aus dem
bestehenden Nutzerprofil. Weitere Karten verwenden sachliche Anschlusssätze.
Kein gespeicherter Name wird verändert; ohne Profilname bleibt die Ansprache neutral.

AttentionFan zeigt ab 460 px verfügbarer Breite fünf Ebenen mit zwei zurückgesetzten
Karten je Seite, darunter drei. Weniger Einträge werden nicht dupliziert. Horizontaler
Trackpad-Scroll und Shift-Mausrad wechseln nach einer Wegschwelle mit begrenzter
Folgegeschwindigkeit; vertikales Scrollen bleibt erhalten. Gedämpfte Federn,
Tastatur, Touch, stabile Auswahl und inerte ausblendende Karten bleiben gemeinsam.
Die zentrale attentionFanMotion enthält Geometrie, Schwellen und Federwerte.

StatisticsCard ist eine feste Dienstkarte. StatisticsDashboard zeigt einen
unveränderlichen Berichtsstand im normalen Chat mit Composer: Übersicht/Modelle,
Zeitraumwahl über direkte Buttons, Kennzahlen, Tagesaktivität und Datenabdeckung.
ActivityPixels nutzt dieselbe pixelHash-Textur wie AmountSlider. Helligkeit bedeutet
Nachrichten pro Tag; eine endliche Welle bildet beim Einblenden, Zeitraumwechsel
und Druck das reale Muster. statisticsMotion führt Geometrie und Dauer.
Das dezente Tagesfeld-Schimmern folgt dem unten ergänzten Vertrag. Verborgene Ansichten und reduzierte Bewegung zeigen den
statischen Datenstand. Farben, Schrift, Rundungen und Flächen sind gemeinsame Tokens;
Forced Colors bleibt verständlich. Statistikflächen passen sich der Panelbreite an.
StatisticsPreview unter Unser Design zeigt produktive Bausteine mit markierten
Beispieldaten, ohne reale Gespräche anzulegen.

GET /api/statistics liest ausschließlich lokale normale Gespräche des angefragten
Workspaces einschließlich Archiv; die Core-Privatsperre wird vor dem Lesen über GET /internal/chat-privacy/ids geprüft.
Der interne Anschluss liefert nur IDs, niemals PIN-Hashes oder Freigaben.
Private Chats, Aufträge, Messenger- und Berichtschats bleiben ausgeschlossen.
Nachrichten sind Nutzereingaben und maximal eine finale Antwort pro Runde.
Werkzeuge, Zwischenmeldungen und übernommene doppelte Turn-IDs zählen nicht.
Aktivität und Serien verwenden lokale Kalendertage der Browserzeitzone; gestern
hält eine laufende Serie bis zum Ende des heutigen Tages offen. Die Grafik zeigt
maximal 26 Wochen, numerische Gesamtsummen bleiben vollständig für lesbare Daten.
Fehlende Verläufe, Datums- und Modellwerte werden als Abdeckung genannt.
Native kumulative Tokens sind nur insgesamt und ohne geerbte Verläufe ausgewiesen;
keine erfundene Zeitraumaufteilung, Wortmenge, Kosten oder Produktivität.

POST /api/statistics/chat erstellt über briefingChatOpener und saveHandoff einen
Berichtschat; parallele und wiederholte requestIds öffnen denselben Bericht.
Das Öffnen startet keine KI-Runde. Alle drei Zeiträume und Modellzahlen stehen
im gespeicherten Text für spätere Rückfragen. Ein bewusster neuer Klick erzeugt
einen aktuellen Bericht. Entwürfe und laufende Gespräche bleiben erhalten.

Datenvertrag/Migration: additive optionale chat.statisticsTurns mit Startzeit und
Modell für neue Runden sowie chat.statisticsSnapshot Version 1 für Berichtschats.
Keine Massenmigration und kein neues Kontingentkonto. Ältere Daten bleiben gültig;
fehlende historische Modellangaben werden nicht aus der letzten Auswahl geraten.
Älterer Code kann den normalen gespeicherten Berichtstext anzeigen; nach Rückkehr
können bei neu entstehenden Runden Modellangaben fehlen. Keine Datenlöschung.
Prüfungen: Zählung, Zeitzonengrenzen, Serien, Duplikate, Privatsperre, Lücken,
Berichtswiederholung, Fächerbedienung, beide Themes, schmale Breite, große Schrift,
Tastatur, reduzierte Bewegung und Zeitraumwechsel.
## Ergebnisse für den Leser · Version 1.1.0

`collectChatArtifacts` trennt die Ergebnisdarstellung von der vollständigen
Datei- und Werkzeughistorie. PDF, Office-Dokumente, Tabellen, Präsentationen,
Bilder, Audio und Video sind Leserartefakte. Markdown, Text, CSV/TSV, HTML und
ZIP erscheinen bei bestätigter Ausgabe im output-/exports-/deliverables-Ordner
oder ausdrücklicher nativer Artefaktdeklaration. Programmquellen wie MJS, CSS,
TSX, Konfiguration und technische Projektdateien erzeugen keine Ergebniszeile,
auch wenn sie in output/ liegen. Änderungen bleiben in den Werkzeugdetails
und im unveränderten Bibliotheksindex erreichbar. Ausgabeordner mit enthaltenen
Quellcheckouts werden ebenfalls nicht pauschal als Artefakte behandelt.

Reihenfolge am Ende der Antwort: Arbeitsverlauf, Ergebnisse, Aktionsicons.
`ChatArtifacts` ist Teil von `beforeActions` der letzten Antwort; ohne
Antworttext steht es direkt nach dem Arbeitsstatus. Es bleibt unabhängig vom
aufgeklappten Werkzeugverlauf zugänglich. Keine Dateiengruppe unter den Icons
und keine künstliche Lücke. Dokumente stehen hinter einer geschlossenen
caption-Zeile „1 Ergebnis“/„N Ergebnisse“. Aufklappen zeigt kompakte klickbare
Dateizeilen mit Vorschau und Download, ohne durchgehende Trenner. Name öffnet
weiterhin die Workspace-Vorschau. Bestehende Grenzen und Fehler-/Ladezustände
von FileContent bleiben erhalten; Textdokumente werden lesend dargestellt.

Erstellte Bilder erscheinen direkt im Chat, bis zu vier sofort; weitere Bilder
sind aufklappbar. Dateiname öffnet die größere Vorschau, Download bleibt
zugänglich. Bereits als Markdownbild sichtbare Bilder werden nicht verdoppelt;
ein bloßer Bildlink erhält dagegen die tatsächliche Bildvorschau. Explizite
Dokumentlinks in der Antwort werden weiterhin nicht als zweite Dateiliste
wiederholt. Fehlgeschlagene, gelöschte und noch laufende Ausgaben liefern keine
bestätigten Ergebnisse. Keine Dateilöschung, neue Datenhaltung oder Migration;
Rückkehr betrifft ausschließlich Darstellung und Klassifikation im Chat.


### Unterbrechbares Mitlaufen beim Streaming

createChatScroll bleibt der einzige Scrollbesitzer pro Panel. Erstes Öffnen
positioniert den Verlauf direkt; Textwachstum und der Sprungbutton folgen mit
einer gemeinsamen, abbrechbaren Bewegung aus chatScrollMotion. Neue Textstücke
aktualisieren das Ziel, ohne die Bewegung neu zu starten. Aufwärtsbewegungen
per Rad, Touch, Tastatur oder Scrollbar stoppen vor dem nächsten Schreibzugriff.
Beim Lesen bleibt Browser-Scrollankern erlaubt; Layout- und Ankerbewegungen
aktivieren das Folgen niemals. Erst bewusstes Herunterscrollen bis auf 2 px ans
Ende oder der Sprungbutton aktiviert es wieder. Abschluss und eingeklappte
Werkzeugausgaben überschreiben keine Leseposition. Reduzierte Bewegung setzt
nur beim aktiven Folgen direkt ans Ende. Verborgene Panels und entfernte
Controller stoppen ihre Animationsframes. Chatstart bleibt stabil.
Keine Datenmigration; Entwürfe und gespeicherte Scrollpositionen bleiben kompatibel.


## Diktat-Tastenkürzel · Version 1.0.0

Stimme → Diktat verwendet DictationShortcutSettings mit normalen SettingRows:
Taste (Automatisch, rechte Command/Meta, rechte Strg, Aus) und Bedienung
(Drücken zum Ein-/Ausschalten als Standard, optional Gedrückt halten).
Automatisch verwendet auf Mac MetaRight und sonst ControlRight. Ausschließlich
die ausgewählte sichtbare Chat-Pane im aktiven Fenster reagiert, keine globalen
Betriebssystem-Hotkeys. Dialoge, Menüs und Sprachchat verhindern einen neuen Start.
Umschalten erfolgt beim Loslassen einer allein gedrückten Taste; Kombinationen
und Wiederholungen lösen es nicht aus. PTT startet beim Drücken und beendet beim
Loslassen; zusätzliche Tastenkombinationen unterbrechen die PTT-Aufnahme.
Fenster-/Panewechsel beendet eine per Kürzel gestartete Aufnahme. Ein Loslassen
während der Mikrofonfreigabe bricht den ausstehenden PTT-Start ab. Erneuter Start
braucht eine neue Geste. Beenden sichert und transkribiert ausschließlich in den
Entwurf, ohne Nachricht zu senden. Vorhandene Audio-Wiederherstellung bleibt.
Einstellungen sind browserlokal unter agent-dictation-shortcut-v1, validiert und
zwischen Tabs synchronisiert; Speicherfehler werden angezeigt. Keine Migration
bestehender Audio- oder Serverdaten. Entfernen des neuen Schlüssels stellt die
plattformabhängige Voreinstellung wieder her. Systemtasten können vom Betriebssystem
abgefangen werden; rechte Strg bleibt als Alternative auswählbar.


## Firmenaufbau im Arbeitschat

Firma öffnet einen festen Arbeitschat je Katalogpunkt. Ziel, Kriterien, Quellen
und Arbeitsstand werden bei jedem neuen Turn frisch ergänzt. Die bestehenden
Eingabe-, Diktat-, Anhangs- und Entwurfswege bleiben gemeinsam. Ein knappes Firma
im Chatkopf führt zurück. FirmaReview bietet nur nach abgeschlossener Antwort
und belegtem Ergebnis die versionsgebundene menschliche Bestätigung; siehe
firma.md. Zusätzliche Chatfelder sind additiv und keine Nutzerrechte.


## Kontingente und Live-Verbrauch · Version 1.1.0

ChatStart reserviert neben Statistik eine eigene Kontingent-Kachel. Die Auswahl
öffnet eine lokale Detailansicht im Startbereich, ohne Nachricht oder Modellaufruf.
AllowanceBars zeigt Anbieterwerte als verbrauchte Prozent, niemals als Tokenbudget.
Alle benannten Kontingente und Reset-Zeitpunkte bleiben im Detail erhalten,
einschließlich modellbezogener Claude-Wochenlimits, Credits und Reset-Gutschriften.
Eine Karte zeigt bis zu zwei Balken. Abgelaufene Zeitfenster zeigen „neuer Stand
ausstehend“, fehlende Werte bleiben unbekannt und Fehler behalten erkennbar den
letzten Stand. Reset-Gutschriften werden nur angezeigt, niemals eingelöst.

GET /api/usage/allowances fragt eingerichtete Anbieter unabhängig und explizit ab.
Anfragen werden 60 Sekunden zusammengefasst; Fehler eines Anbieters verdecken den
anderen nicht. Kontingente sind kontoweit und können Nutzung anderer Geräte oder
privater Chats enthalten, geben aber keine Gesprächsdetails preis. Codex verwendet
account/rateLimits/read mit workerId codex; Claude verwendet den installierten
SDK-Kontrollaufruf get_usage in einem kurzlebigen nativen Prozess ohne Prompt,
Werkzeuge, gespeicherten Chat oder Modellaufruf, mit demselben CLAUDE_CONFIG_DIR.
Der Claude-Abruf ist experimentell; inkompatible Antworten werden nicht geraten.
Keine Schlüssel werden ausgelesen oder an den Browser gegeben. Fehlendes Abo ist
kein Nullverbrauch und löst weder Anmeldung noch Anbieterwechsel aus.

Statistik bleibt als Bericht gespeichert. Nur der Reiter Verbrauch fragt bei
sichtbarem Panel den aktuellen Workspace-Stand alle 15 Sekunden ab. Kontoanzeigen
aktualisieren jede Minute im Vordergrund. Alte Berichte bleiben lesbar. Die Zahlen
trennen Eingabe, Ausgabe, Cache-Lesen, Cache-Schreiben und belegtes Reasoning.
Codex-Cache ist eine Teilmenge seiner Eingabe. Claude-Cache ist separat; Reasoning
ist Teil der Ausgabe und nicht separat belegt. Claude-Modellwerte können interne
Aufrufe enthalten und sind keine Zerlegung der Hauptschleifen-Tokenzahl.

Datenvertrag: optionale usageBaseline für neue Chats sowie usage samt workerId/usageUpdatedAt in statisticsTurns und
usage im Statistik-Snapshot. ACP-Turnantworten übernehmen native _meta.quota;
usage_update bewahrt Kontextbelegung und native Kostenschätzung in workerSession.
Codex-Turnwerte entstehen nur aus monotonen Differenzen bekannter Gesamtsummen;
fehlende Ausgangswerte oder Rücksprünge werden nicht als Verbrauch verbucht.
Modell- und Zeitraumverteilungen tragen ihre erfasste Rundenzahl. Historische
Summen ohne Zeit-/Modellbeleg bleiben ausschließlich in Gesamt. Keine rückwirkende
Schätzung, destruktive Migration oder Änderung privater Chatdaten. Alte Leser
ignorieren Zusatzfelder und zeigen weiterhin den gespeicherten Berichtstext.

## Direkte Pane-Tastenkürzel · Version 2.1.0

Ctrl + Shift + 1–4 wählt das erste bis vierte geöffnete Chatfeld in der
Ansichtsreihenfolge von links nach rechts, setzt den Composerfokus und startet
das Diktat. Bei „1 Chat“ bedient die 1 immer das verbliebene Chatfeld, auch nach
Verkleinern einer Viereransicht. Interne Pane-IDs bleiben unabhängig erhalten;
Tabnamen, Menüaktionen und zugängliche Eingabebeschriftungen verwenden dieselbe
Ansichtsnummer. Schmale oder maximierte Ansichten erhalten die Reihenfolge aller
geöffneten Felder. Eine Änderung dieser Zuordnung vor dem Mikrofonstart bricht
die ausstehende Geste ab. Keine Migration von Chats, Entwürfen oder Belegungen;
Rückkehr zu 2.0 verwendet wieder die internen Pane-Nummern.
Erneutes Drücken derselben Kombination beendet die Aufnahme und sendet den
Erkennungstext einmal zusammen mit vorhandenem Entwurf und Anhängen. Während
Mikrofonfreigabe bricht erneutes Drücken den ausstehenden Start ab; während
Sichern/Erkennen/Senden werden weitere Start-/Sendeimpulse ignoriert.
Escape bricht Aufnahme oder ausstehende Erkennung ohne Textübernahme und Senden
ab. Bereits übergebene Nachrichten werden damit nicht zurückgerufen. Audio bleibt
unter Stimme wiederherstellbar, Entwürfe und Anhänge bleiben erhalten.
Pane-/Fensterwechsel beendet eine per Pane-Kürzel gestartete Aufnahme ohne
Senden. Ein Chatwechsel verwirft ausstehende Textübernahme; auch verspätete
Statusantworten dürfen niemals in einen anderen Chat senden.
Verborgene oder maximierte Zielpanels werden über die aktive Panelauswahl sichtbar.
Nicht geöffnete Panels melden einen Hinweis; gesperrte Chats starten kein Mikrofon.
Nur ein Listener der äußeren App verarbeitet die Kürzel im aktiven Chatfenster;
Dialoge, Menüs, Einstellungen, IME und Tastenwiederholung sind ausgeschlossen.
Einstellungen → Tastenkürzel erklärt Start, Senden und Escape in der vorhandenen
PaneShortcutSettings mit SettingRows. Belegung aufnehmen, je Pane deaktivieren
und Standard wiederherstellen bleiben erhalten. Doppelte Belegungen und bestehende
App-Kürzel werden abgewiesen; Schreibzeichen ohne Ctrl/Alt/Meta sind nicht erlaubt,
F-Tasten sind möglich. Escape/Tab/Verlassen bricht die Belegungsaufnahme ab.
Speicherfehler bleiben sichtbar. Browserlokaler Schlüssel agent-pane-shortcuts-v1
bleibt validiert und zwischen Tabs synchronisiert. Gespeicherte Belegungen gelten
nun für Diktatstart/Direktsenden; fehlende/ungültige Werte verwenden den Standard.
Keine Audio-/Serverdatenmigration. Rückkehr zu Version 1 macht die Belegungen
wieder zu reinen Fokusaktionen. Separate rechte Command-/Strg-Diktattaste und
PTT behalten die Entwurfsübernahme. Betriebssystem-/Browserbelegungen können
Vorrang haben; keine globalen Betriebssystem-Hotkeys.


## Visuelle Chat-Ergebnisse · Version 1.1.0

ChatArtifacts zeigt erfolgreich gelieferte typisierte Bilder aus nativen
Bildwerkzeugen und generischen Exec-Aufrufen mit Bilderzeugungsquittung direkt
unter der Antwort, außerhalb eingeklappter Arbeitsschritte. ToolImages nutzt
für diese Ergebnisse den gemeinsamen Modal zum Vergrößern, eine Downloadaktion
und einen sichtbaren Fehler mit Wiederholen. Bildschirmaufnahmen und gelesene
Referenzbilder bleiben im Arbeitsverlauf. Fehlgeschlagene oder laufende
Werkzeuge liefern keine bestätigten Bild-Ergebnisse. Keine Pfade aus
Werkzeugtexten werden geöffnet und keine Remote-Bilder automatisch abgerufen.

Markdown-Bilder und Bildlinks unterstützen PNG, JPEG, WebP, GIF, AVIF, BMP und
SVG über die bestehende freigegebene Datei-API. Bereits eingebettete Dateien
werden im Ergebnisblock nicht verdoppelt. SVG-Dateien verwenden in FileContent
eine inaktive Bildvorschau mit Quelltext-/Bearbeiten-Umschalter; PNG und andere
Rasterbilder behalten ihre bisherige Vorschau. Vollständige SVG-Codeblöcke
zeigen eine Grafik mit aufklappbarem, kopierbarem Quelltext. Unvollständige oder
zu große Codeblöcke bleiben Code. SVG läuft ausschließlich als img-Dokument,
niemals als aktives HTML im App-DOM oder mit Skript-/Netzwerkrechten.

Unser Design verwendet denselben Markdown-Baustein für ein gekennzeichnetes
Beispielorganigramm. Größen, Abstände und Modal kommen aus dem gemeinsamen
Design. Mobil bleiben Bilder innerhalb der Nachrichtenspalte. Fehlende
Dateien verwenden die vorhandenen Fehler-/Downloadwege.

Datenvertrag/Migration: reine Darstellung vorhandener öffentlicher
toolContent-/result-Daten und Dateireferenzen; keine Datenmigration. Bereits
gespeicherte vollständige Bildausgaben werden beim erneuten Öffnen sichtbar.
Alte ausgelassene Bilddaten werden nicht erfunden. Rückkehr betrifft nur die
Darstellung; Originaldateien, Chats und Anschlüsse bleiben lesbar.


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

## Workspace-Spezialisierung

Das Plus neben Workspace eröffnet die kurze native Einrichtung. Die anklickbare
Überschrift erklärt den Begriff; das bestehende Projektmenü bearbeitet oder
setzt die Einrichtung fort. Name und Spezialisierung stehen in AGENTS.md,
Assistentenname und Firmenbasis bleiben gemeinsam. Wiederholte Startanfragen
öffnen denselben Chat; Forks sind normale Gespräche ohne Einrichtungszuordnung.
Quelle, Revisionsschutz, Fehler und Migration führt
[workspaces.md](workspaces.md). Bestehende Scroll- und native Sitzungsregeln
bleiben eigenständig und sind durch diese Erweiterung nicht neu abgenommen.

Gesprächs-Skeletons stehen in derselben `message-column` wie geladene Turns.
Dadurch teilen sie Maximalbreite, Panelränder und vertikale Abstände mit dem
Verlauf und dem Composer, auch bei mehreren Panels und schmalen Fenstern.
Die Autorenzeile verwendet `turn-author`, `agent-signature` und `turn-author-meta`.
Der App-Start verwendet ebenfalls Chatpanel, Nachrichtenspalte und Composerbereich
statt eigener Inhaltsbreiten. Reine Layoutkorrektur, keine Datenmigration.

### Startkarten · Version 1.4.0

Kompakte Überlappung aus attentionFanMotion; bei bis zu 800 px Höhe schrumpfen
Avatar und Abstände, Karten und Touchziele behalten ihre Größe. Der Startbereich
reserviert oben 64 px und unten die gemessene Composerhöhe. Kein Nachrichten-Fade
über den Startkarten; bei Platzmangel bleibt die Navigation scrollbar erreichbar.
Wetter und Kalender stehen als letzte feste Karten direkt links neben der ersten
Karte im umlaufenden Stapel, nach Statistik und Kontingenten. Der Kalender zeigt
das lokale heutige Datum und öffnet den Tagesbericht mit vorhandenen Terminen.
Keine automatische Rotation, Nachrichten oder zusätzlichen Abrufe. Bestehende
Auswahl und Reihenfolge bleiben während der Nutzung stabil; neue ungelesene
Antworten bleiben verfügbar. Keine Datenmigration; Rückkehr ist rein visuell.

Weiterentwicklung, noch nicht implementiert: freiwilliges Ausblenden einzelner
Inhalte bis zu einer relevanten Änderung; wenige zeitlich passende Anlässe beim
neuen Einstieg, höchstens ein Vorschlag pro Thema und keine Wiederholung ohne
neuen Nutzen. Dringende Rückfragen behalten Vorrang.

## Nachrichtenübergabe · Version 1.0.0

Der gemeinsame MessageOutbox läuft unabhängig von geöffneten Chat-Panes.
Absenden speichert Text, Anhängepfade, Ziel, Modellwahl und eine eindeutige
clientMessageId vor dem Leeren des Entwurfs lokal. Chatwechsel bleibt frei.
Neue Chats verwenden zunächst eine lokale Kennung; spätere Antworten ordnen
nur diese Kennung zu und überschreiben keinen inzwischen geöffneten Chat.

Unter der Nachrichtenblase zeigt DeliveryMark ausschließlich neutrale Symbole:
Uhr für Übertragung/fehlende Verbindung, ein Check nach dauerhaft bestätigter
Serverannahme, ein kompaktes `DeliveryChecks`-Doppelzeichen nach bestätigtem Workerstart, ein
anklickbares Ausrufezeichen bei Fehler oder unklarem Ausgang. Zugänglicher Name
und Tooltip erklären den Zustand. Bestehende Nachrichten ohne Beleg erhalten
keinen erfundenen Haken. `DeliveryChecks` zeichnet den zweiten Haken nur mit seinem
sichtbaren Arm, sodass er hinter dem ersten liegt statt ihn zu kreuzen.
Einzelzeichen 12 × 12 px, Doppelzeichen 18 × 12 px, feine gerundete Konturen.
Die Anzeige steht 2 px unter der Bubble und 12 px innerhalb ihrer rechten Kante.
Fehleraktionen behalten ihre zugängliche Bedienfläche. Unser Design zeigt beide
Bestätigungen am produktiven Bubblelayout. Reine Darstellung, keine Datenmigration.
Nachricht, Zeit und bestehende Aktionen bleiben erhalten.
Nach sicherer Serverannahme ist kein offener Browser für die Verarbeitung nötig.
Vorher wird bei erneutem Öffnen der App weiter übertragen; kein Closed-Browser-
Upload wird zugesagt.

POST /api/delivery speichert vor Antwort den Beleg in state.messageDelivery
Version 1 über den vorhandenen Storage-/SQLite-Anschluss. GET /api/delivery
liest eine einzelne Kennung; GET /api/deliveries?id liest einen Chat unter der
bestehenden Privatsperre. Identische Wiederholungen verwenden denselben Beleg;
abweichende Inhalte mit gleicher Kennung werden abgewiesen. Neue Chats und
Workerübergaben laufen serverseitig unabhängig vom HTTP-Aufrufer. Gleiche Chats
werden seriell übergeben. Vorhandene Turn-/Steer-, Modell- und Projektwege gelten.
Private Antworten tragen chatId und durchlaufen die bestehende Privacy-Filterung.

Browserablage: agent-message-outbox-v1:<workspace>:<clientMessageId>, ausschließlich offene
Nachrichten plus inhaltsfreie Kennungszuordnungen für neue Chats nach Übergabe.
Jede Nachricht hat einen eigenen atomaren Storage-Eintrag; mehrere
Tabs überschreiben keine gemeinsame Indexliste.
Serverbelege bleiben für Wiederholungsschutz erhalten. Keine Löschung oder
Migration bestehender Chats. Alte Versionen ignorieren das additive Feld;
vor Rückkehr offenen Postausgang abarbeiten. Unterbrochene Workerübergaben
werden als unklar erhalten und niemals automatisch erneut ausgeführt.
Ein Klick prüft dort den Status; ein erneuter Auftrag erfordert bewusstes Senden.
Speicherfehler lassen den Entwurf stehen. Feature-Erkennung erhält ältere Server.
Prüfungen: langsame Übergabe, Verbindungsabbruch, Wiederholungsschutz, parallele
Anfragen, neue Chats, Wiederherstellung, volle lokale Ablage, Anhänge, Chatwechsel,
Desktop und mobile Emulation.


## Effizienter mobiler Einstieg · Version 1.0.0

Zusatzinhalte verwenden die lokalen Ladegrenzen aus DESIGN.md. Der Start des
Ereignisstreams fragt die beim Einstieg geladenen Grunddaten nicht nochmals ab;
echte Wiederverbindungen gleichen Chats, Rückfragen und den geöffneten Verlauf ab.
Ein Kernereignis wird pro Tab einmal verteilt, auch bei mehreren Panels.
Gleichzeitige Leseanfragen werden geteilt, ohne dauerhaften Cache privater Daten.
Die optionale API-Projektion `view=sidebar` auf bootstrap/chats lässt nur die
unbenutzten tokenUsage/statisticsTurns-Zähler weg. Modellwahl, Fähigkeiten,
Privatsperre und Statistikberichte behalten ihre bisherigen Felder. Der normale
API-Aufruf bleibt kompatibel. Native Kontexte verwenden keine Browserprojektion.

Verborgene gespeicherte Panels stellen ihren Verlauf erst bei Sichtbarkeit wieder
her. Ihre gespeicherte Zuordnung wird davor nicht überschrieben. Bereits geöffnete
Chats, Entwürfe und Streams bleiben gemountet. Streaming kopiert nur den betroffenen
Turn und das veränderte Item; abgeschlossene Turns behalten ihre Referenzen und
werden nicht bei jedem neuen Textstück erneut gerendert. Aktionen greifen auf den
aktuellen App-Zustand zu. Sperren, Wiederverbinden und Lesen bleiben maßgebend.

Startdaten und Statistik pausieren in verborgenen Panels. Beim Wiederaktivieren
verhindert ein kurzer Frischeabstand parallele Fokus-/Sichtbarkeitsabfragen; explizite
Änderungen werden sofort berücksichtigt. Updateabfragen pausieren in versteckten
Tabs, außer bei laufender Neustartwiederherstellung oder Sprachsession.

Die Diktatsicherung teilt einen Timer pro Tab und liest Audio nur für noch nicht
vollständig gesicherte Aufnahmen. Bestehende Datenbankversion, Chunk-Schlüssel,
Audioarchive und Download-Wiederherstellung bleiben erhalten. Gleichzeitige
Synchronisation wird zusammengefasst; neue Daten während eines Durchlaufs erhalten
einen weiteren Durchlauf. Fehlgeschlagene Übertragung bleibt wiederholbar.

Migration: keine Änderung gespeicherter Chat-, Audio- oder Serverdaten. Rückkehr
zur vorherigen Version bleibt möglich. Frontend-Build und statische Auslieferung
werden zusammen geprüft; ohne neuen Server bleibt der Build lesbar, erhält aber
noch keine Kompression oder langlebige Cache-Header.


## Chatabruf und optionale Startdaten · Version 1.1.0

Die Browseransicht verwendet `/thread?view=chat`. Nachrichten, native Sitzungssteuerung,
Ergebnisdateien und erzeugte Bilder bleiben vorhanden. Große Werkzeugausgaben
werden als beschriftete Zusammenfassung übertragen und erst beim Öffnen des einzelnen
Schritts über `/thread/item` geladen. Der bestehende Chat-Datenschutz gilt vor und nach
beiden Antworten. Originalverlauf, Exportanschluss und Worker-Kontext bleiben vollständig.
Auch bereits vorhandene Werkzeugdaten werden erst aufgeklappt gerendert.
Fehler und Zeitüberschreitungen bieten Wiederholen im betroffenen Bereich; Entwürfe
bleiben erhalten. Leseanfragen ohne eigenes Abbruchsignal erhalten bis zu 65 Sekunden, passend zum nativen Worker-Limit. Beim Chatwechsel, Verlassen oder Sperren wird der nicht mehr benötigte Verlaufsabruf sofort abgebrochen; andere Panels bleiben unabhängig. Abbrüche zeigen eine verständliche Wiederholungsmöglichkeit.

Der Startfächer zeigt vorhandene Hinweise direkt. Aufträge, Profil und Berichte
ergänzen sich unabhängig; eine langsame Quelle sperrt die anderen nicht. Der
gemeinsame Attention-Skeleton bleibt für das Laden des Oberflächenmoduls vorhanden.
Verbindungsdaten werden erst für die Verbindungsseite oder einen Ablauf geladen,
der sie benötigt. Keine Migration gespeicherter Chats, Aufnahmen oder Einstellungen.

Updates erscheinen ausschließlich im vorhandenen Einstellungsbereich. Ein interner Agentenreview nutzt einen eigenen begrenzten Thread ohne Änderung normaler Chats oder ihrer Modellwahl. Die Betriebspause sperrt neue Turns und lässt bestehende Arbeit vor dem Stoppen abschließen.

KI-Aktualisierungen verwenden die bestehenden Hinweis-/Ergebniskarten des Startfächers.
Pro Anbieter erscheint dessen neuester ungelesener Hinweis. Die Karte öffnet
KI & Modelle; sie startet keine Installation und keinen Modellauftrag.
## Kalenderkachel und Tageschat

Im AttentionFan bleiben Wetter und Kalender als feste Karten erhalten. CalendarCardContent zeigt Wochentag, große Tageszahl,
Monat und ISO-KW mit denselben Glasmaßen und zentraler Typografierolle calendar.
Der nächste laufende oder kommende heutige Termin erhält Titel und Countdown;
weitere Termine erscheinen erst im Tagesbericht. Countdown und Uhrzeit stehen
gemeinsam über dem Titel. Ohne nächsten Termin ist nur der Leerhinweis unter
Monat/KW gedämpft; Wochentag und Tageszahl behalten ihre Farben.
Ganztägig und Läuft gerade sind eigene Angaben.
Veraltete oder unvollständige Quellen werden als „Termine möglicherweise nicht
aktuell“ erklärt, statt zum unklaren „Stand prüfen“ aufzufordern.
Ohne weitere heutige Termine kein Countdown auf morgen. Datum und Countdown
aktualisieren sich; Projektwechsel, Mitternacht und Abruffehler zeigen keinen
vorherigen Tag als aktuellen. Fehlender Dienst ist kein terminfreier Tag.

Klick öffnet explizit einen neuen Tageschat mit Datenbericht und kurzer Einordnung.
Diese Aktion darf den Worker starten; bloßes Anzeigen der Kachel tut es nicht.
Kalender öffnen im Tageschat führt zur bestehenden Kalenderansicht ohne neuen
Hauptmenüpunkt. Eigene und angebundene Termine teilen dieselbe Projektion, bleiben
nach Herkunft unterscheidbar. Kalenderdaten und Migrationsvertrag: docs/PLANNER.md.


### Gemeinsamer Workerwechsel · Version 2

Der bestehende Chat wechselt über einen einzigen Übergabeaufruf. Eine zusätzliche
Aktivierungsanfrage entfällt. Verlauf und Entwurf bleiben sichtbar; ausschließlich
die Auswahl zeigt die tatsächliche ausstehende Bestätigung. Der vollständige
unveränderliche Verlauf bleibt erhalten. Der begrenzte Kontextblock enthält bei
langen Chats sowohl den ursprünglichen Auftrag als auch den jüngsten Stand,
mit Verweis auf die vollständige Datei, ohne zusätzlichen Zusammenfassungsaufruf.
Bei ausgefallener Quellverbindung verwendet die Übergabe den vorhandenen lokalen
Verlauf über denselben Leseanschluss wie der Chat. Aktive Arbeit muss weiterhin
bestätigt beendet sein. Kein automatisches Wiederholen von Nachrichten.
Keine Datenmigration; bestehende Übergabedateien und Modellwerte bleiben lesbar.
Ein älterer UI-Stand zeigt wieder die separaten ACP-Menüs.

### Stabiler Verlauf während der Nachrichtenübergabe

Beim Absenden bleiben vorhandene Antworten sichtbar. Sending und Accepted lösen
keinen zusätzlichen nativen Verlaufsabruf aus. Nach bestätigtem Start oder einem
Übergabefehler gleicht der bestehende Abruf den Verlauf ab, ohne bereits sichtbare
Textstücke, Arbeitsschritte oder neuere Turns durch einen verspäteten oder leeren
Zwischenstand zu entfernen. Wiederverbindungen verwenden denselben Abgleich;
explizite Bearbeitung und Löschung behalten ihre eigenen Ersetzungswege.
Privat gesperrte Chats dürfen verspätete Antworten nicht übernehmen.
DeliveryView erhält Referenzen unveränderter Turns und Werkzeugausgaben; nur die
zugehörige Nutzerblase bekommt den Zustellbeleg. Identische Belege verwenden die
vorhandene Darstellung weiter. Keine neuen Komponenten, Tokens oder Animationen.
Keine Datenmigration; native Sitzungen und gespeicherte Verläufe bleiben unverändert.

Abschlussereignisse übertragen dieselbe Browserprojektion wie der Verlaufsabruf.
Große gespeicherte Werkzeugausgaben bleiben über den einzelnen Arbeitsschritt
abrufbar. Übersteigt auch die Projektion die Ereignisgrenze, fordert der bestehende
Resync den Verlauf per HTTP an, statt den gemeinsamen Stream abzubrechen.
Originalverlauf, native Worker-Daten und Export werden nicht verändert.

Zustellabfragen warten auf den laufenden Speichervorgang, bevor sie den
bestätigten Workerstart anzeigen; ein vorzeitig sichtbarer Haken ist kein Beleg.


### Eindeutige Claude-Auswahl · Version 1.1.0

Der mitgelieferte Adapter reicht die von derselben Sitzung gemeldete resolvedModel-ID
als additive Modellmetadaten weiter. Der Picker zeigt daraus Familie und Version,
einschließlich einer gemeldeten 1M-Variante. Es gibt keine fest codierte Versionsliste.
Der native Default-Eintrag entfällt in der Auswahlliste, sobald konkrete Modelle
vorliegen. Doppelte IDs erscheinen nur einmal; gleich benannte unterschiedliche
Optionen erhalten ihre ID zur Unterscheidung. Vorhandene Default-Sitzungen bleiben
lesbar und werden nicht beim Öffnen geändert. Eigene externe Adapter bleiben erhalten.
Modell und Denkaufwand gelten für den jeweiligen Chat/Composer. Nach Modellwechsel
wird ein zuvor ausdrücklich gewählter Denkaufwand wieder übernommen, sofern die
neu bestätigten Optionen ihn anbieten. Andere Panels und globale Vorgaben werden
nicht geändert. Ablehnungen bleiben sichtbar; nur bestätigte Werte gelten.
Keine Datenmigration; ältere Versionen ignorieren die additiven Metadaten.


## Ereignisstrom mit Nachlieferung · Version 1.0.0

Jeder Rahmen des Ereignisstroms trägt eine laufende Kennung aus Serverleben und
Nummer. Der Wrapper behält die letzten 2.000 Rahmen (höchstens 4 MB). Verbindet
sich ein Browser neu, sendet er die letzte Kennung; der Wrapper liefert genau die
verpassten Rahmen nach und bestätigt jede Verbindung mit `wrapper/connected` und
`replayed`. Nur ohne Nachlieferung (erste Verbindung, anderes Serverleben, Fenster
überschritten) lädt der Browser Startdaten, Verlauf und Chats neu; nach einer
Nachlieferung prüft er nur den Verbindungsstatus und pumpt den Postausgang.
`wrapper/resync` bleibt der Weg für zu große Verläufe und den Kernanschluss.

Schreiben in eine bereits geschlossene Browserverbindung wird verworfen und die
Verbindung entfernt; ein geschlossener Tab beendet nie den Adapter. Herzschlag,
Ereignisse und Nachlieferung verwenden dieselbe geschützte Schreibfunktion.

Im Browser werden Textstücke (`agentMessage`, `plan`, Befehlsausgabe,
Denkzusammenfassung) je Animationsbild zu einem Ereignis je Element gebündelt;
jedes andere Ereignis leert die Bündelung zuerst, damit Abschluss und Text nie
die Reihenfolge tauschen. Ursprüngliche Ereignisse werden nicht verändert.
Keine Datenmigration; native Sitzungen und gespeicherte Verläufe bleiben unverändert.
Prüfungen: Kennungen und Fenster (`event-backlog.test.mjs`), Bündelung und
Reihenfolge (`event-batcher.test.mjs`), Rahmen ohne Kennung unverändert.

### Bestätigte Anfangsstufe · Version 1.2.0

Der mitgelieferte Claude-Adapter bestätigt eine konkrete Anfangsstufe (Medium, sofern angeboten, sonst erste native Stufe) beim Öffnen und Wiederherstellen sowie nach Modellwechsel ohne explizite Stufe. Bestehende explizite Einstellungen bleiben erhalten. Der gemeinsame Regler zeigt damit sofort Griff und Stufenname. Native Default-Modellaliase markieren bei exakt gleicher resolvedModel-ID die konkrete Modellzeile und verwenden deren bestätigten Denkaufwand. Versionen zeigen auch die Minor-Version .0. Keine globale Profiländerung oder Datenmigration; ältere Stände lesen die native Einstellung weiter. Modellwechsel während einer Antwort bleiben für die nächste Nachricht vorgemerkt, Anbieterwechsel verwenden weiterhin den bestätigten Stop-und-Übergabeweg im selben Chat.


## Verlauf bleibt beim Senden stehen · Version 1.0.0

Beim Senden in einen bestehenden Chat bleibt der sichtbare Verlauf unverändert; nur
ein vorläufiger Postausgangs-Chat (`outbox-…`) wird gegen seine echte Kennung
getauscht. Gestreamte Elemente tragen Anbieterkennungen (`msg_…`), der gespeicherte
Verlauf nummeriert sie um (`item-N`). Beim Abgleich eines Schnappschusses gilt
zuerst die Kennung, dann der Inhalt (gleicher Typ, ein Text ist Präfix des anderen),
damit eine Antwort nie doppelt erscheint; der längere gestreamte Text gewinnt.
Fehlende Elemente eines veralteten Schnappschusses bleiben sichtbar. Keine
Datenmigration. Prüfungen: `thread-update.test.mjs`.


## Panes nach Neustart · Version 1.0.1

Jede Pane öffnet ihren gespeicherten Chat auch dann, wenn die Chatliste beim Laden noch
unvollständig ist, etwa direkt nach einem Neustart. Ob der Chat noch existiert, entscheidet
die Verlaufsanfrage; erst danach wird der Pane-Zustand neu geschrieben. Eine Pane fällt nie
still auf einen leeren Entwurf zurück. Keine Datenmigration.


## Abschluss einer Antwort ohne Vollverlauf · Version 1.0.0

Nach einer fertigen Antwort sendet der Wrapper nur den abgeschlossenen Turn als Teil-
Schnappschuss (`wrapper/thread` mit `partial`), nicht den gesamten Verlauf. Der Browser
gleicht diesen Turn in den geladenen Verlauf ein und behält alle anderen Turns; ein Teil-
Schnappschuss für einen noch nicht geladenen Chat wird ignoriert. Lange Verläufe lösen so
keinen `wrapper/resync` und kein Neuladen mehr aus. Vollständige Schnappschüsse bleiben
für Übergaben und Verlaufsänderungen. Keine Datenmigration. Prüfungen: `thread-update.test.mjs`.
