# Inbox

## Stand und Konzept

Lokale Designvorschau mit erfundenen Beispielen aus Outlook, Gmail und WhatsApp. Zielarchitektur: [docs/INBOX.md](../../docs/INBOX.md). Keine Nachrichten-API, Kontozugriffe, Workeraufrufe oder Versand. Status und Entwürfe bestehen nur während die Inbox geöffnet bleibt. Hinweise zu Beispieldaten und flüchtigen Entwürfen stehen ausschließlich im Konzeptdialog, nicht im alltäglichen Lesefluss.

## Navigation und Flächen

Inbox verwendet das offene Ablagefach `Tray` aus Framework7 Icons über den gemeinsamen `Inbox`-Export in `ui/icons.jsx`, sowohl im Hauptmenü als auch im Leerzustand.

Der Hauptpunkt Inbox steht direkt über Aufträge; `?view=inbox` öffnet ihn direkt. Die Inbox übernimmt wie Einstellungen die vorhandene linke Seitenleiste. Oben bleibt der gemeinsame Agentenkopf mit Such-Icon und Einklappen erreichbar. Darunter steht der bestehende Zurück-Button, danach der gemeinsame PageHeading „Inbox“ mit Konzept-Icon, Suche, Status-/Kanalfilter und Gespräche. Allgemeine Navigation und Projekte werden hier durch die Inbox-Liste ersetzt. Ein zusätzlicher Profilfuß entfällt. Zurück führt zum bestehenden Agentenchat und stellt dessen vorherige Seitenleistensichtbarkeit wieder her; laufende Chats bleiben gemountet.

Die Hauptfläche enthält ausschließlich Gesprächskopf, Verlauf und Antwortzeile. Kein zweiter Listenbereich, kein eingerahmter Workspace, keine große äußere Seitenpolsterung. Auf Desktop teilen sich die vorhandene verstellbare Seitenleiste und der Verlauf den Platz. Bis 650 px Fensterbreite steht beim Einstieg nur die Liste in voller Breite. Gespräch öffnen zeigt nur den Verlauf; dessen Zurück-Pfeil öffnet wieder die Liste. Filter, lokale Entwürfe und Listenposition bleiben dabei erhalten. Der Agentenkopf gehört zur Liste, nicht zusätzlich zum mobilen Verlauf.

`InboxPage` hält den lokalen Zustand und rendert die Liste per React-Portal in den expliziten Sidebar-Platz der App. Es erzeugt keine zweite Sidebar und keinen zweiten Datenbestand. Beim Verlassen der Inbox wird die Vorschau ausgehängt. Eingebettete Agentenchatpanels bleiben unberührt.

## Gesprächszeile und Bedienung

`InboxConversationRow` zeigt ausschließlich das vorhandene Kanal-Markenicon, Name, Uhrzeit und bei ungelesenen Nachrichten einen kleinen neutralen Punkt. Keine Initialenblase, Betreffzeile, Nachrichtenvorschau oder Anbieter-Unterzeile. Der zugängliche Name enthält Anbieter und Status. Lange Namen dürfen umbrechen; Zeit und Icon bleiben sichtbar. Die neutrale Fläche markiert die Auswahl. Der gemeinsame Baustein wird weiterhin unter Unser Design gezeigt.

Suche, Offen/Ungelesen/Erledigt und der vorhandene FilterPicker für Kanäle wirken gemeinsam. Öffnen markiert ein Beispiel als gelesen; Erledigen/Wiederöffnen ändert dessen lokalen Status. Der aktuelle Verlauf darf dabei sichtbar bleiben. Leere Trefferlisten erhalten nur eine kurze Rückmeldung. Fokus wechselt beim Öffnen in den Verlauf, beim Zurück zur Liste auf die ausgewählte beziehungsweise erste sichtbare Gesprächszeile.

## Verlauf und Antwortzeile

Der Kopf zeigt Markenicon und Namen sowie Erledigen/Wiederöffnen. Kontodetails bleiben im Tooltip nachsehbar. Im Verlauf bleiben der fachliche Betreff, Absender und Zeit lesbar; Nachrichtentexte verwenden die zentrale Gesprächsschrift und Leserolle. Lange Wörter und URLs brechen um. Der Verlauf scrollt unabhängig von der Liste.

Unten eine einzelne beschriftete Antwortzeile mit dem Platzhalter „Antwort schreiben …“. Keine sichtbare Überschrift, kein Vorschau-Untertext und kein Senden-Button. Der zugängliche Feldname bleibt „Antwortentwurf“. Die Zeile wächst automatisch bis zur Maximalhöhe; erst danach scrollt sie vertikal. Horizontales Scrollen ist ausgeschlossen. Messung erfolgt beim Schreiben, Gesprächswechsel, Breiten-/Schriftänderung und beim Wiederöffnen des mobilen Verlaufs. Entwürfe bleiben beim Wechsel zwischen Gesprächen zugeordnet.

## Erweiterung und Abnahme

PageHeading, Zurück-Muster, FilterPicker, BrandIcon, Modal und zentrale Tokens wiederverwenden. Neue Konten bleiben unter Verbindungen. Vor echter Datenanbindung das Zielkonzept lesen und echte Lade-/Leer-/Fehlerzustände integrieren; Beispieldaten niemals mit Kontodaten vermischen. Empfang löst keine automatische Antwort aus.

Abnahme: Designprüfung, TypeScript, Build, Portal-Einbindung, Navigation zurück zum Chat, kombinierte Filter, Entwürfe pro Gespräch und Konzeptdialog. Desktop und mobile Vollbreitenwechsel einschließlich Fokus, Textumbruch, Schriftvergrößerung, maximaler/minimaler Seitenleistenbreite sowie Hell/Dunkel visuell prüfen. Keine Übernahme von Beispieldaten in produktive Nachrichten.
