# Messenger und private Inbox

## Vertrag

Das Modul `messenger` ergänzt die bestehende Mail-Inbox um kontogebundene
WhatsApp- und persönliche Telegram-Gespräche. Einrichtung ausschließlich unter
Verbindungen. Die Rolle `inbox` besitzt sichtbare Gespräche. `agent-send` ist ein
separater Hintergrund-Schreibanschluss ohne Eintrag in Gesprächsliste oder Suche.
Ein Eingang startet niemals einen Worker und sendet keine automatische Antwort.
Der frühere Bot-/Auftragsempfang unter Services bleibt ein eigener Anschluss.

WhatsApp verwendet eine ausdrücklich konfigurierte lokale HTTP-Bridge mit eigenem
Login. Zwei Nummern benötigen zwei eigenständige Bridge-Sitzungen. Der Anschluss
liest `/health`; verbunden ist nur ready/running. Er übernimmt vorhandene lokale
Tabellen chats/messages/reactions per schreibgeschützter SQLite-Transaktion.
Der Bridgeprozess muss weiterhin laufen; die Übernahme kopiert weder dessen
Programm noch Login-Sitzung. Es ist kein neuer selbständiger WhatsApp-Daemon.
Die alte Inbox-Oberfläche wird nicht übernommen und muss dafür nicht geöffnet sein.

## Einrichtung

Verbindungen → WhatsApp → Name, Meine Inbox oder Schreibkanal des Agenten und
unter Bridge-Einrichtung die lokale Adresse. Die Inbox erhält außerdem den
expliziten Pfad zur vorhandenen WhatsApp-Datenbank. Speichern, Prüfen, Abgleichen
und Trennen sind separate Aktionen im gemeinsamen Modal. Nur Loopback-HTTP mit
Port wird akzeptiert; keine fremden Remote-URLs oder automatische Profilsuche.
Die Quelle muss das geprüfte chats/messages/reactions-Format besitzen.
Telegram verwendet `telegram-user`, eine eigene API-App und persönliche Anmeldung.
Bauplan und Paketvoraussetzung: [TELEGRAM.md](TELEGRAM.md).

Der ausdrückliche lokale Übernahmeweg lautet:
`python -m core.messenger_import --root INSTALLATION --source WHATSAPP_DB --bridge LOOPBACK_URL --agent-bridge SECOND_LOOPBACK_URL`.
Vorher prüfen, dass beide Adressen den gewünschten Nummern zugeordnet sind.
Das Werkzeug erstellt zuerst ein konsistentes Online-Backup der Zieldatenbank,
importiert isoliert und übernimmt seine Tabellen additiv in einer Transaktion.
Eine Wiederholung erzeugt dank stabiler Konto-/Nachrichtenkennungen keine Duplikate.
Bestehende Entwürfe und Markierungen werden beim Wiederholen nicht überschrieben.
Der laufende alte Kern benötigt danach den normalen Neustart in einer Arbeitspause.

## Daten, Synchronisierung und Migration

Format 1 ergänzt messenger_connections, messenger_threads, messenger_messages,
messenger_drafts und messenger_sends in der vorhandenen SQLite-Datenbank.
Medienkopien und unveröffentlichte Import-/Wiederherstellungsstände liegen unter
`data/control/messenger`. Originaldateien außerhalb der ausdrücklich gewählten
Medienwurzel werden nicht gelesen; Dateinamen dienen niemals als Zielpfad.
Bis 100 MB große vorhandene Medien werden kopiert. Fehlende Originale bleiben
als fehlend erkennbar, Texte, Zeitpunkte, Absender, Richtung, Antwortbezüge,
Reaktionen und vorhandene Zustellbelege bleiben erhalten.

Der aktive Kern gleicht alle 15 Sekunden ab. Die Quelle bleibt schreibgeschützt.
Lokaler Gelesen-/Erledigtstatus ist unabhängig von Anbieter-Lesebestätigungen.
Beim Erstimport wird der bestehende Ungelesen-Zustand berücksichtigt. Angepinnte,
stummgeschaltete und archivierte Anbieterordnungen werden nicht synchronisiert.
Trennen beendet Abruf und Versand, erhält lokale Verläufe und Medien. Bei Telegram
wird zusätzlich die lokale Sitzung aus dem Tresor entfernt; Anbieter-Sitzungen
gegebenenfalls direkt im Konto widerrufen.

Ein Rückweg zu altem Code lässt neue Tabellen unberührt, blendet sie aber aus.
Vollständige Rückkehr verwendet den konsistenten Datenbankstand vor Import;
zwischenzeitlich entstandene Nutzerdaten vorher sichern. Medien bleiben lokal
und werden nicht automatisch gelöscht. Backups enthalten private Nachrichten.

## Bedienung und Versand

Die gemeinsame Inbox zeigt beide Mailanbieter und Messenger mit Kanalfilter.
Mobil wechselt sie zwischen Liste und Gespräch. Eigene Nachrichten liegen rechts.
Antwortbezüge, Reaktionen, Audio/Video/Bilder und Dateien bleiben im Verlauf.
Nachgeladen werden je 100 lokal gespeicherte Nachrichten; manuelles Lesen älterer
Inhalte stoppt automatisches Scrollen. Ein Sendepfeil versendet den gespeicherten
Entwurf. Dateianhänge und Sprachnachrichten werden vorher separat hochgeladen.
Maximal 20 MB pro ausgehendem Anhang. Sprachnachrichten erfordern ffmpeg zur
Opus/OGG-Konvertierung; ohne Konverter bleibt die Aufnahme erhalten.

Aufnahmen beginnen ausschließlich auf Klick. Browser-IndexedDB
`agent-inbox-recordings` sichert fortlaufende MediaRecorder-Blöcke pro Gespräch.
Die letzte Aufnahme bleibt auch bei Upload-/Sendefehlern wiederherstellbar und
herunterladbar. Eine neue Aufnahme ersetzt diese letzte Aufnahme desselben Chats.
Keine automatische Erkennung, kein automatischer Versand beim Aufnahmestopp.

Jeder Sendeauftrag besitzt requestId und Inhaltsfingerprint sowie einen dauerhaften
Sendezustand. Ein Timeout oder Kernabbruch bleibt unknown und wird nicht automatisch
wiederholt. Ein bestätigter Versand benötigt eine Anbieter-Nachrichtenkennung;
Annahme ist keine Zustellung. Vor erneutem Senden unklarer Aufträge den echten
Verlauf prüfen. Änderungen des Entwurfs während Versand werden erhalten.
Reaktionen sind ausdrückliche UI-Aktionen. Öffnen und Schreiben sendet nichts.

`POST /api/messenger/agent-send` benötigt projectId, connectionId, vollständige
Empfängerkennung, text, requestId und confirmed=true. Der Agent darf confirmed nur
bei ausdrücklichem Auftrag für konkreten Empfänger und Inhalt setzen. Die Rolle
wird serverseitig geprüft. Der Anschluss liest keine privaten Inbox-Entwürfe.
Einrichtung allein ist keine Freigabe für Testnachrichten.

## Prüfungen und Grenzen

Tests: core/tests/test_messenger.py, core/tests/test_telegram_bridge.py sowie
Frontend-Entwurfs-/Composerprüfungen. Der Importtest prüft Kontentrennung, kopierte
Medien, Antwortbezüge, Reaktionen und Wiederholung; Versandtests prüfen unklare
Annahme ohne erneuten Anbieteraufruf. Echte Nachrichten an Empfänger gehören
nicht zu den automatisierten Tests. Live-Verbindung und Sendefähigkeit bleiben
getrennte Abnahmestände.

Telegram-Anmeldung benötigt verfügbare API-ID/API-Hash und Code/gegebenenfalls
Kontopasswort. Ein Bot-Token ersetzt diese Anmeldung nicht. Die Inbox enthält
keine automatische Bot-zu-Bot-Freigabe und pollt keine fremden Bot-Updates.
Neue Kontakte müssen zunächst im jeweiligen Messenger vorhanden sein.

WhatsApp-Anmeldung zeigt unter Verbindungen einen flüchtigen, nicht gecachten
QR-Code über `/api/messenger/pairing`. Dazu das zugehörige Handy unter Verknüpfte
Geräte verwenden. Der QR wird nicht als Verbindungserfolg gewertet. Falls eine
bestehende Agentenbridge bisher an einen anderen Agentenkern weiterleitet, muss
deren Weiterleitung vor Kopplung für den reinen Schreibbetrieb deaktiviert sein.
Einrichtung verändert keine private Nummer und keine fremde Sitzung.
