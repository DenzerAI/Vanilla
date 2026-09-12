# Persönliches Telegram-Konto in der Inbox

## Vertrag

`core/telegram_bridge.py` verbindet ein persönliches Konto über Telegram MTProto.
Der Bot-Anschluss unter `wrapper/channel-runtime.mjs` bleibt unabhängig. Ein
Bot-Token ersetzt weder die Telegram-App noch die persönliche Anmeldung. Die
Inbox startet keine Agentenaufträge und konsumiert keine Bot-Updates.

Voraussetzung: Python-Extra `telegram` (`pip install '.[telegram]'`), API-ID und
API-Hash einer eigenen App unter https://my.telegram.org, Rufnummer und der von
Telegram zugesandte Anmeldecode. Bei aktivierter Bestätigung in zwei Schritten
wird zusätzlich das Telegram-Passwort benötigt. Der Adapter implementiert
`configure`, `status`, `auth_start`, `auth_finish`, `threads`, `messages`, `send`,
`media`, `send_file`, `react`, `disconnect`, `close`; die Inbox stellt diese über ihren vorhandenen
Einrichtungs- und Nachrichtenanschluss bereit.

API-ID, API-Hash und StringSession werden über den installationsgebundenen
ProviderVault als `telegram-user-<anschluss-id>` gespeichert. Anmeldecode,
Passwort und vorläufiger Telefon-Code-Hash werden nicht dauerhaft abgelegt.
Authentisierungsschritte eines Anschlusses sind serialisiert. Nach Neustart
kann eine bestätigte Sitzung erneut verbinden; unvollständige Anmeldung muss
neu gestartet werden. Zugangsdaten nicht in Protokolle oder Statusantworten
aufnehmen. Aufrufe benötigen die reguläre lokale API-Authentisierung und die
Inbox muss Anschluss und Workspace vor jedem Adapteraufruf prüfen.

Lesen markiert Nachrichten nicht als gelesen. Verlauf wird paginiert (maximal
500 Nachrichten je Abruf), private Chats, Gruppen und Bot-Gespräche sind lesbar.
Ein expliziter Sendeaufruf sendet Klartext (bis 4096 Zeichen) mit optionalem
Antwortbezug. Existierende Dialoge werden zur sicheren InputPeer-Auflösung
verwendet; neue Empfänger zunächst in Telegram öffnen. Medien bis 25 MB können
heruntergeladen werden. Dateien (einschließlich Sprachnachrichten) können als bereits freigegebene Bytes
mit Dateiname versandt werden; der Adapter akzeptiert weder lokale Pfade noch
URLs als Dateiquellen. Reaktionen werden explizit gesetzt oder mit leerem Emoji
entfernt. Lesebestätigungen sind in diesem Adapter noch nicht implementiert. Telegram-Kontolimits und
Netzwerkfehler sind Fehler und dürfen keine erfolgreiche Zustellung vortäuschen.

Trennen entfernt lokale Zugangswerte und schließt den Client; gespeicherter
Inbox-Verlauf bleibt erhalten. Es beendet nicht alle anderen Telegram-Sitzungen.
Telegram selbst erlaubt unter Einstellungen/Geräte den Widerruf dieser Sitzung.
Eine Rückkehr zu Code ohne Adapter lässt die separaten Vault-Daten bestehen,
aktiviert aber keinen Telegram-Empfänger. Keine Migration fremder Sessions.

## Prüfung

`python -m pytest core/tests/test_telegram_bridge.py` prüft Code-/Passwortablauf,
Geheimnisausschluss, Wiederverbindung, Dialogauflösung, expliziten Klartextversand
und Eingabegrenzen sowie fehlgeschlagene Anmeldung, Medienberechtigungen,
Mediengrößen und Datei-/Reaktionsversand mit einem simulierten Client. Ein echter Kontoabruf ist erst
nach eigener API-App und persönlicher Anmeldung möglich; Tests beweisen diese
Live-Anmeldung nicht.

## Anbieterquellen

- https://docs.telethon.dev/en/stable/basic/signing-in.html
- https://docs.telethon.dev/en/stable/concepts/sessions.html
- https://core.telegram.org/api/bots/bot-to-bot (Bot-zu-Bot-Kommunikation ist mit
  passender BotFather-Freigabe möglich; keine persönliche Kontoanmeldung.)

## Vorhandenen Agentenbot verbinden

Der Dienstanschluss `telegram` unter Verbindungen verwendet den vorhandenen
Bot-Token im gemeinsamen Secrets-Speicher und explizite `allowedUsers`. Er ist
vom persönlichen `telegram-user`-Inbox-Konto unabhängig. `getMe` und
`getWebhookInfo` prüfen die Identität ohne Nachrichtenversand. Empfang erst
mit eindeutig zugeordneten Nutzer-IDs aktivieren; keinen fremden Webhook
übernehmen. Historische Tokens und IDs niemals in Dokumentation kopieren.

Die gemeinsame Netzprüfung akzeptiert öffentliche IPv6-Adressen auch unter
2001::/16; die IANA-Sonderbereiche 2001::/23, 2001:db8::/32, 2002::/16
und 3fff::/20 bleiben ausgeschlossen. Alle aufgelösten Adressen werden vor
dem auf eine geprüfte Adresse festgelegten Verbindungsaufbau validiert.
Quelle: https://www.iana.org/assignments/iana-ipv6-special-registry/

`/start` bestätigt für freigegebene Bot-Nutzer die Verbindung direkt. Es startet
keinen Worker und wird nicht an dessen Slash-Befehlssystem weitergereicht.
Normale Nachrichten bleiben im bestehenden Kanalauftragssystem.
