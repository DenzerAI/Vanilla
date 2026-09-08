# Inbox: Architekturentscheidung

Stand: 08.09.2026. Zielarchitektur für den späteren Bau. Die erste lokale Designvorschau ist jetzt unter Inbox vorgesehen und im Bereichsvertrag dokumentiert. Empfang, Speicherung und Versand sind weiterhin nicht implementiert.

## Zweck und Platz

Die **Inbox** ist der gemeinsame Eingang für externe Nachrichten aus angeschlossenen Konten, zunächst mit Outlook, Gmail und WhatsApp als Zielanbietern. Sie ist ein eigenständiger Hauptpunkt **direkt oberhalb von Aufträge**, auf derselben Navigationsebene. Sie ist weder ein Unterauftrag noch eine Wiederaufnahme der früheren leeren Seite „Module“.

Die Bereiche haben klare Aufgaben: Inbox sammelt und bearbeitet Nachrichten; Aufträge führen daraus abgeleitete Arbeit aus; Verbindungen richten die Konten ein; der bestehende Agentenchat bleibt der Ort für die Zusammenarbeit mit dem Agenten. Eine Nachricht kann später mit einem Auftrag oder Agentenchat verknüpft werden, ohne ihren ursprünglichen Verlauf zu verlieren.

## Erste Oberfläche

Die Inbox übernimmt wie Einstellungen die vorhandene linke Seitenleiste: oben Zurück, darunter Inbox-Titel, Suche, kompakte Filter und Gesprächsliste. In der Hauptfläche steht nur der ausgewählte Verlauf. Ein weiterer eingerahmter Workspace oder eine zweite Gesprächsliste entfällt. Auf schmalen Fenstern bis 650 px wechseln Liste und Verlauf in voller Breite.

Gesprächszeilen zeigen Name, Kanal-Markenicon, Uhrzeit und Ungelesen-Punkt, ohne Betreff- oder Vorschau-Unterzeilen. Im Verlauf bleiben der eigentliche Betreff und Nachrichtenmetadaten erhalten. Die Antwortzeile wächst mit ihrem Text, bricht auch lange Wörter um und scrollt ab der Maximalhöhe nur vertikal.

Die lokale erste Designstufe bietet Suche/Filter, Lesen, Erledigen/Wiederöffnen und flüchtige Entwürfe pro Gespräch. Vorschauhinweise, fehlende Konten und Speichergrenzen stehen ausschließlich im Konzeptdialog. Bei einem späteren echten Eingang öffnet eine neue Nachricht erledigte Gespräche erneut; Lesestatus und Erledigungsstatus bleiben unabhängig. Lokales Erledigen verschiebt oder löscht keine Anbieternachricht.

Bei der späteren Datenanbindung sind leerer Eingang, fehlendes Konto, Laden, veralteter Stand und Kontoausfall eigenständige Zustände. Einrichtung bleibt unter Verbindungen. Bereits geladene Nachrichten und andere Konten bleiben bei einem Teilausfall nutzbar.

## Technische Aufteilung

```text
Anbieter → vorhandener Anschluss / ergänzter Empfangsadapter
         → Normalisierung und Duplikatprüfung
         → Inbox-Dienst im bestehenden Kern → vorhandene SQLite-Datenbank
                                           → vorhandener SSE-Ereignisstrom
                                           → Inbox-Oberfläche
                                           → begrenzter Kontext für Agenten

Agent → lokaler Antwortentwurf → Prüfung/Freigabe → Versand über Ursprungskonto
```

Der Kern besitzt Inbox-Daten, Bearbeitungsstatus, Kontextzugriff und später Versandaufträge. Anbieteradapter übersetzen Anbieterformate und melden ihre tatsächlichen Fähigkeiten. Bestehende Verbindungen, Secret-Referenzen, Worker und Ereigniswege werden wiederverwendet. Es entsteht kein zweiter allgemeiner Agentenstack und keine separate Nachrichten-Datenbank.

Die Inbox speichert eine lokale Projektion der externen Gespräche. Anbieter bleiben die Quelle für externe Nachrichtenidentität und Zustellung; lokale Triage und lokale Entwürfe werden von der Inbox geführt. Die Trennung erlaubt Wiederanlauf und Nachladen ohne Verlust lokaler Bearbeitung.

## Gemeinsames Datenmodell

| Objekt | Wesentliche Felder und Regeln |
| --- | --- |
| Kontoanbindung | Arbeitsbereich, Verbindungsreferenz, Anbieter, externe Konto-ID, Fähigkeiten für Lesen, Historie, Anhänge, Entwürfe und Versand; keine Schlüsselkopie |
| Gespräch | Interne ID, Konto, externe Gesprächs-ID, Teilnehmer, optionaler Betreff, letzte Aktivität, lokal offen/erledigt, Lesemarker |
| Nachricht | Interne ID, Konto, externe Nachrichten-ID, Gespräch, ein-/ausgehend, Absender, Empfänger/CC, Text, Zeit beim Anbieter und beim Eingang, Antwortbezug, externe Revision soweit verfügbar |
| Anhang | Nachrichtenreferenz, externer Dateiverweis, Name, Typ, Größe, lokaler Abrufstatus; Inhalt bei Bedarf über authentifizierten Zugriff |
| Entwurf, später | Gespräch, Ursprungskonto, Empfänger/CC, Text, Anhänge, Version, zugrunde liegender Nachrichtenstand, Ersteller Mensch/Agent, Status |
| Synchronisation | Konto, Cursor, letzter erfolgreicher Abgleich, Zustand, Fehler und Wiederholungszeitpunkt |
| Verknüpfung, später | Gespräch/Nachricht zu bestehendem Auftrag oder Agentenchat |

Externe IDs sind nur innerhalb des jeweiligen Kontos eindeutig. Die Datenbank erzwingt eindeutige Nachrichten anhand von Konto plus externer Nachrichten-ID. Threading nutzt Anbieterbezüge; Betreff oder gleicher Kontakt allein reichen nicht. Gespräche verschiedener Konten oder Anbieter werden zunächst nicht automatisch zusammengelegt.

Der Lesemarker bezieht sich auf einen tatsächlich gesehenen Nachrichtenstand. Ein verspäteter Lesehinweis darf eine inzwischen neu eingegangene Nachricht nicht als gelesen markieren. Entwürfe verwenden Versionsprüfung, damit Agent und Mensch sich nicht gegenseitig überschreiben.

## Empfang und bestehende Kanalautomatik

Der heutige Kanalweg kann Nachrichten an einen Worker übergeben und Antworten zustellen. Die Inbox darf diesen Ablauf nicht unbeabsichtigt übernehmen. Pro Anschluss wird daher der Verarbeitungsmodus explizit unterschieden: **Inbox** sammelt; **Agentendialog** verwendet den bisherigen automatischen Dialogweg. Neue Inbox-Anbindungen starten ohne automatische Antwort. Bestehende Anschlüsse werden nicht still umgestellt.

Ein normalisiertes Eingangsereignis wird zuerst dauerhaft und duplikatsicher gespeichert. Anschließend erfolgen UI-Ereignis und, ausschließlich im dafür eingerichteten Modus, Worker-Übergabe. Transport und Verarbeitungsmodus bleiben getrennt. Werden bestehende Agentendialoge später zusätzlich in der Inbox angezeigt, wird dafür dasselbe gespeicherte Ereignis verwendet, kein zweiter Empfänger.

Adapter verwenden Webhooks oder Polling entsprechend ihrer belegten Fähigkeiten. Cursor und Nachrichten werden konsistent gespeichert; Wiederholungen erzeugen keine Duplikate. Empfangsstart bleibt eine ausdrückliche Aktion gemäß bestehendem Anschlussvertrag. Historienimport ist begrenzt und separat vom Eingang neuer Nachrichten; ältere importierte Nachrichten lösen keine automatische Arbeit aus. Umfang und Zeitraum werden bei der späteren Einrichtung festgelegt.

## Agentenkontext, Triage und Entwürfe

Der Agent erhält einen gezielt ausgewählten Verlauf mit stabilen Nachrichtenreferenzen, Absendern, Zeiten und eindeutigem Ursprungskonto. Große Verläufe werden begrenzt; ausgelassene Teile bleiben erkennbar und gezielt nachladbar. Externe Nachrichtentexte und Anhänge sind Daten, keine Anweisungen an den Agenten. Nachrichten gelangen nicht pauschal ins gemeinsame Firmenwissen oder in jede Agentensitzung.

Spätere Triage kann Zusammenfassungen, Prioritätsvorschläge und Antwortentwürfe erstellen. Wiederkehrende Triage verwendet das bestehende Auftragssystem und einen explizit eingerichteten Konto-/Gesprächsumfang. Sie erzeugt keine zweite Aufgabenverwaltung innerhalb der Inbox.

Ein Antwortentwurf bleibt zunächst lokal. Antworten erfolgen über das Ursprungskonto im passenden Thread; eine kanalübergreifende Antwort wird nicht automatisch gewählt. Ein neuer Nachrichtenstand kennzeichnet einen älteren Entwurf als erneut prüfbedürftig. Versand ist eine separate, ausdrücklich autorisierte Aktion. Eine spätere Automatik benötigt einen eigenen konkreten Auftrag und Umfang; „mitlesen“ oder „mitdraften“ bedeutet nicht „senden“.

Der spätere Versand unterscheidet vorbereitet, freigegeben, sendend, bestätigt, fehlgeschlagen und Zustellung unklar. Bei unklarer Zustellung kein blindes erneutes Senden. Anbieterfähigkeiten werden serverseitig geprüft; fehlender Versandzugang darf keine erfolgreiche Zustellung vortäuschen.

## Anschlussstellen für die Umsetzung

Geplante stabile Bereichs-ID: `inbox`. Geplanter UI-Einstieg: Sidebar direkt vor `jobs`; eigene Inbox-Komponente, gemeinsamer `PageHeading`, `FilterPicker`, `BrandIcon`, Skeletons, Fokusregeln und zentrale Design-Tokens. Ein neuer Verlauf darf das bestehende Agentenchat-Datenmodell nicht mit externen Postfächern vermischen.

Bei der Umsetzung erhält `wrapper/surfaces/inbox.md` den verbindlichen Bereichsvertrag und `wrapper/surfaces/README.md` dessen Eintrag. `system/capabilities.mjs` registriert dann UI, Backend, Vertrag und tatsächliche Statusquelle gemeinsam. Dieses Konzept ist die Arbeitsgrundlage; es erklärt keine noch fehlenden Endpunkte für verfügbar.

Der geplante API-Vertrag umfasst paginierte Konten/Gespräche/Nachrichten, lokale Triage-Änderungen und Kontostatus. Später folgen versionierte Entwürfe, begrenzter Agentenkontext und eine getrennte Versandaktion. Alle Zugriffe werden im Kern auf aktiven Arbeitsbereich und Konto eingeschränkt. Der vorhandene authentifizierte SSE-Strom meldet Änderungen per ID; die Oberfläche lädt berechtigte Inhalte nach.

Mail-HTML wird vor Anzeige bereinigt; externe Bilder laden nicht automatisch. Anhänge verwenden den bestehenden geschützten Dateizugriff. Verbindung entfernen beendet neue Zugriffe; lokale Aufbewahrung und endgültiges Löschen werden beim späteren Bau getrennt geregelt und dürfen nicht beiläufig durch „Erledigen“ erfolgen.

## Reihenfolge des Baus und Abnahme

1. Inbox-Bereich und lokales Datenmodell mit eindeutig gekennzeichneten Testdaten bauen. Listen-/Detailansicht, mobile Navigation und lokale Triage abnehmen.
2. Gemeinsamen Eingang an vorhandene Anschlüsse anbinden, anschließend die fehlenden Anbieteradapter ergänzen. Kontofähigkeiten, Abgleich, Neustart, doppelte Ereignisse, gleichzeitige Eingänge und Teilfehler prüfen. Echte Konten gesondert abnehmen.
3. Gezielten Agentenkontext und lokale Entwürfe integrieren. Konto-/Workspace-Grenzen, Quellenbezüge, Versionskonflikte und neue Nachrichten während der Bearbeitung prüfen.
4. Autorisierten Versand ergänzen. Ursprungskonto, Empfänger, Threadbezug, unklare Zustellung und Schutz vor Doppelversand prüfen. Wiederkehrende Triage danach über Aufträge ergänzen.

Für UI-Code gelten die bestehenden Designprüfungen sowie Sichtprüfung bei breiter und schmaler Ansicht, Hell/Dunkel, Tastatur, langen Inhalten und Lade-/Leer-/Fehlerzuständen. Dieser Architekturauftrag benötigt keinen App-Build.

## Abgleich mit dem Bestand

Gelesen wurden der Projekt-/Workspace-Einstieg, Identität, Firmen- und Systembasis, `README.md`, `docs/CORE.md`, `wrapper/AGENTS.md`, `wrapper/DESIGN.md`, `wrapper/surfaces/README.md`, die Verträge für Verbindungen und Aufträge, `wrapper/CHANNELS.md`, die zentrale Fähigkeitenlandkarte sowie relevante Stellen der Sidebar, des Dienstekatalogs und des Kanalempfangs.

Der lokale Anschlussvertrag beschreibt Outlook-Lesezugriff und WhatsApp-Empfang, aber keine fertige gemeinsame Inbox. Gmail ist in diesem geprüften Dienstekatalog noch kein Inbox-Adapter. Das ist ein Quellabgleich, keine Live-Prüfung angemeldeter Konten. Konkrete Anbieterberechtigungen und heutige API-Grenzen werden beim jeweiligen Adapterbau verifiziert.

Architekturstand: Platzierung, minimale Oberfläche, Datenverantwortung, Empfangsmodus und Erweiterungsweg sind festgelegt. Den aktuellen Umsetzungsstand führt ../wrapper/surfaces/inbox.md. Anbieterzugriff und Backend folgen in eigenen Schritten.
