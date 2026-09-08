# Chat und Projekte

## Aufbau und Erweiterungen

Die Agent-Zeile unten links öffnet als ganze Schaltfläche das Agent-Menü. Sie zeigt den unter „Dein Agent“ gewählten Bot-Avatar und Namen ohne zusätzliches Zahnrad; der separate Verbindungsstatus bleibt erhalten.

Die Projekt-/Chatnavigation liegt in der Seitenleiste. Ein unbenannter neuer Chat zeigt oben keinen Titel und keinen separaten Einstieg „Bestehenden Chat öffnen“. Benannte Entwürfe und bestehende Chats behalten ihr Titelmenü. Bei mehreren Panels steht der jeweilige Titel ausschließlich am Panel. Die globale Chatleiste enthält die Ansichts- und Workspace-Aktionen ohne untere Trennlinie. Chatfläche zeigt Nutzereingaben, Antworten und kompakte Werkzeugaktivität. Der Composer besteht aus einer pillenförmigen Schreibzeile: Anhängen, Eingabe, genau ein Mikrofon für Diktat, Senden/Stoppen. Arbeitsmodus und Modellwahl stehen direkt nebeneinander, links ausgerichtet auf einer gemeinsamen horizontalen Linie außerhalb der Pille darunter. Beide Menüs verwenden dieselbe Höhe, Schriftrolle und Chevron-Darstellung. Modellname und Denkaufwand bleiben gemeinsam auswählbar. Keine separate Worker-Beschriftung oder Computer-Use-Schaltfläche im Composer. Bei mehrzeiligen Entwürfen wächst die Schreibfläche; ihre Rundung bleibt erhalten. Zusätzliche direkt benötigte Aktionen sind knappe Iconbuttons mit Tooltip und zugänglichem Namen. Keine Konfiguration oder Verlaufsverwaltung im Composer.

Projekte werden über das Plus an „Projekte“ ergänzt; Chats über das Plus am Projekt. Kontextmenüs und bestehende Dialoge für Bearbeiten verwenden. „Projekt bearbeiten …“ öffnet den gemeinsamen Projektdialog. Unter dem Projektsymbol folgt eine vordefinierte Farbauswahl mit Farbnamen, Auswahlhaken und Tastaturfokus. Die Farbe gilt für das Projektsymbol in Seitenleiste und Chatkopf; „Standard“ verwendet die bisherige neutrale Darstellung. Neue Projekte nutzen denselben Dialog, bestehende Projekte ohne Farbwert bleiben neutral. Der kompakte Projektdialog zeigt eine gemeinsame Vorschau von Symbol und Farbe neben dem Namen, darunter ruhig gruppierte Auswahlfelder und eine abgetrennte Aktionsleiste. Speichern überträgt Name, Symbol und Farbe gemeinsam; erneutes Öffnen und Neuladen erhalten die Auswahl. Mehrfachansichten behalten unabhängige Entwürfe und die gemeinsame Eventverbindung.

## Streaming und Scrollposition

Verlauf und Composer teilen dieselbe zentrierte Inhaltsspalte und dieselben horizontalen Kanten. Die Sprungmarken für bisherige Eingaben bleiben in einem reservierten linken Rand außerhalb der Inhalte, auch beim Streaming und in schmalen Chatpanels. Scrollleisten verändern die Ausrichtung der Inhaltsspalte nicht. Die maximale Inhaltsbreite beträgt 760 px und wächst auf großen Bildschirmen nicht weiter. Panels bis 620 px Breite behalten beidseitig 32 px Rand, größere mindestens 64 px. Die aufgeklappte Eingabevorschau bleibt ein vorübergehendes Overlay und reserviert keine dauerhafte zusätzliche Spalte.

Jedes Chatpanel folgt neuen Inhalten am unteren Rand, solange der Nutzer nicht nach oben scrollt. Text, Werkzeugwechsel, nachgeladene Vorschauen und Größenänderungen werden vor der Darstellung am tatsächlichen unteren Rand ausgerichtet. Automatisches Scrollen bewegt ausschließlich den Verlauf des jeweiligen Panels. Hochscrollen pausiert das Mitlaufen sofort; unten angekommen oder über „Zur neuesten Nachricht“ wird es wieder aktiviert. Layoutänderungen dürfen diese Entscheidung nicht umschalten. Beim Chatwechsel werden Leseposition und Mitlaufzustand gemeinsam erhalten.

## Sprache

Im normalen Composer gibt es genau ein Sprachsymbol: Mikrofon = Diktat in den Entwurf. Keine zusätzlichen Einstiege für Sprachchat oder Vorlesen. Bestehende Ausgabe-Einstellungen und gesicherte Aufnahmen bleiben unter Stimme; die vereinfachte Chatbedienung startet keinen Sprachchat. Im aktiven Zustand eine kompakte Leiste mit Status, tatsächlichem Pegel, Laufzeit und Iconaktionen für Pause, Verwerfen, Übernehmen/Senden und Schließen. Keine Schaltfläche „Aufnahmen“ und keine erklärende Textkarte im normalen Chat. Fehlermeldungen nur bei tatsächlichen Fehlern und mit einem Wiederherstellungsweg.

Diktat übernimmt erkannten Text in den Entwurf. Sprachchat darf erkannte Äußerungen an den ausgewählten Chat senden und die fertige Antwort vorlesen. Automodus gilt nur innerhalb eines bewusst gestarteten Sprachchats. Chatwechsel/Schließen beendet die Sprachbedienung; bereits gesicherte Aufnahmen bleiben erhalten. Rückfragen und Werkzeugfreigaben bleiben im vorhandenen Chatfluss. Keine Erklärungen, Werkzeugausgaben oder Codeblöcke ungefragt vorlesen.

## Details und Einstellungen

Aufnahmearchiv, Anbieterwahl, Geräte und Stimmen gehören unter **Einstellungen → Stimme**. Verbinden externer Anbieter gehört unter **Verbindungen**. Keine neuen Aufnahme-Popovers mit eigenem Archiv oder Anbieterformular.

## Werkzeuge und Ergebnisse

Werkzeuggruppen bleiben kompakt und aufklappbar. Eine gedämpfte Tätigkeitszeile mit passendem Linienicon fasst zusammen, was passiert ist, etwa „Dateien gelesen und Befehle ausgeführt“. Überlegungen werden nicht zusätzlich in die Zusammenfassung aufgenommen, wenn konkrete Werkzeugaktivitäten vorliegen; sie bleiben in den Details zugänglich. Der Aufklapppfeil folgt unmittelbar dem Text. Fehlgeschlagene Schritte stehen mit Anzahl direkt in derselben Zeile; ein Fehlerlabel am rechten Rand entfällt. Unvollständige Schritte dürfen nicht als abgeschlossen erscheinen. Unter der laufenden Antwort steht ein kompakter Arbeitsstatus ohne Trennlinie. Nach erfolgreichem Abschluss entfällt diese Statuszeile; Fehler und Abbruch bleiben sichtbar. Die tatsächliche Dauer steht, falls Werkzeugaktivität vorliegt, in deren Zusammenfassung. Der Sekundentakt aktualisiert nur diese Komponente, ohne wiederholte Screenreader-Ansage der Zeit. Vorliegende Diffs zeigen hinzugefügte und entfernte Zeilen mit Plus/Minus und semantischen Farben. Große Ausgaben werden begrenzt und auf Nachfrage erweitert. Fehlgeschlagene Schritte dürfen nicht als erfolgreiche Dateierstellung erscheinen.

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

Chats stehen je Projekt nach letzter Aktivität absteigend. Angeheftete Chats bilden eine eigene Gruppe; danach gliedern dezente beschriftete Linien die sichtbaren Chats in Heute, Gestern, Letzte 7 Tage, Letzte 30 Tage und Älter. Leere Gruppen entfallen. Es gelten lokale Kalendertage; die vorhandene Begrenzung auf fünf aktuelle Chats und „Mehr anzeigen“ bleibt erhalten. Chatzeilen sind am Desktop 36 px hoch, bei größerer Schrift dürfen sie wachsen; Touch-Zeilen bleiben mindestens 44 px hoch. Gruppentitel und Chatnamen teilen die Textkante der Navigation, Status und Aktionen die rechte Spalte der Projektaktionen.

## Reiseeffekt auf der Startansicht

Neue Chats ohne Gespräch zeigen standardmäßig dezente Lichtpunkte in drei Tiefenebenen, die langsam aus der Mitte nach außen wandern und sanft pulsieren. Inhalt und Layout bleiben unverändert. Bestehende Gespräche zeigen den Effekt nicht. Unter Aussehen → Visuell → Reiseeffekt lässt er sich dauerhaft ein- und ausschalten. Reduzierte Bewegung in App oder System zeigt ruhende Punkte; unsichtbare Ansichten pausieren.

## Nachrichtensteuerung und Zustellung

Normales Senden ergänzt aktive Arbeit über das native Steering am nächsten
sicheren Verarbeitungsschritt. Der ursprüngliche Auftrag bleibt erhalten.
„Danach“ in der vorhandenen Optionszeile legt eine eigenständige Aufgabe an;
diese Aufgaben starten in Eingangsreihenfolge nach bestätigtem Abschluss.
Endet der Turn vor der Übergabe einer Ergänzung, folgt diese im Kontext des
ursprünglichen Auftrags vor den Danach-Aufgaben. Worker ohne Steering übernehmen
die Ergänzung nach dem aktuellen Turn; laufende Werkzeuge werden nicht abgebrochen.

`MessageDeliveryList` steht als flache, aufklappbare Liste über der Eingabe.
Sie verwendet gemeinsame Text-, Abstands-, Flächen- und Buttonrollen. Wartende,
in Zustellung befindliche und unklare Nachrichten sind sichtbar; abgeschlossene
Listen bleiben aufklappbar. Jede Zeile benennt Sendeart und serverseitigen Status:
Wartet, Wird zugestellt, Vom Worker bestätigt, Zustellung unklar, Nicht zugestellt
oder Gelöscht. „Erledigt“ folgt ausschließlich auf den bestätigten Turnabschluss.
Lange Inhalte brechen um; die Liste scrollt innerhalb ihrer begrenzten Höhe.

Wartende Texte werden direkt in der Zeile bearbeitet oder gelöscht. Anhänge bleiben
beim Bearbeiten erhalten und werden mit Namen angezeigt. Versionskonflikte zeigen
einen Fehler; die Oberfläche behauptet weder eine Löschung noch eine Änderung,
wenn die Übergabe bereits begonnen hat. Ein gelöschter Eintrag bleibt als Beleg.

Die Browserablage speichert jede Übertragung mit stabiler ID vor der HTTP-Anfrage.
Bei fehlender Speicherbestätigung bleibt „Annahme unklar“ sichtbar. „Annahme prüfen“
verwendet dieselbe ID am idempotenten Speichereingang; es wiederholt niemals einen
bereits gestarteten Worker-Aufruf. Wiederverbindung und Neuladen lesen die dauerhafte
Serverliste. Eine optimistische Gesprächsblase gilt nicht als Zustellbestätigung.

Unklare Worker-Zustellung, Unterbrechung oder fehlender Abschluss pausieren die Folge.
„Ohne Wiederholung fortsetzen“ prüft zuerst lesend, dass der Worker keine aktive
Arbeit mehr meldet, und gibt nur die noch wartenden Aufgaben frei. Unklare Nachrichten
bleiben als solche dokumentiert und werden auch dabei nicht erneut gesendet.
Eine zwischenzeitliche Zustandsänderung verlangt eine erneute Prüfung.

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

## Ruhiger Gesprächsfluss

Je Turn stehen alle Werkzeugschritte in einer einzigen standardmäßig geschlossenen ActivityGroup unter den Gesprächsnachrichten. Ein kleines Tätigkeitsicon, die Schrittanzahl und die tatsächliche Dauer bilden die Zusammenfassung. Laufende, fehlgeschlagene und unvollständige Schritte bleiben erkennbar; die vollständigen Details sind aufklappbar. Ohne Werkzeuge entfällt die Gruppe. Nachrichten behalten ihre Reihenfolge. Agentenantworten verwenden die zentrale 18-px-Rolle `conversation`, Nutzernachrichten und Eingabe die 14-px-Rolle `control`. Auf Touch bleibt die Eingabe in `reading`, um automatischen Eingabezoom zu vermeiden. Avatar und Uhrzeit sitzen eng unter dem Text; Nachrichtenaktionen blenden bei Hover oder Tastaturfokus ohne Layoutsprung ein. Auf Touch bleiben sie mit mindestens 44 px Bedienfläche erreichbar, ebenso der aktive Vorlesen-Stoppen-Button.


Erneut ausführen sendet die ursprüngliche Nachricht samt Anhängen als neuen Turn in derselben Session. Chat-ID, Titel, bisheriger Verlauf und Composer-Entwurf bleiben erhalten; es entsteht kein Seitenleistenduplikat. Während Übertragung und laufender Antwort ist die Aktion gesperrt. Kopieren schreibt ausschließlich in die Zwischenablage. Verzweigen ist eine separate Aktion an der Antwort und übernimmt den Verlauf bis einschließlich des gewählten Turns. Bearbeiten und Verzweigen bleibt ausdrücklich beschriftet.
