# Nachrichtenanschlüsse, Skills und Bibliothek

Die Schaltzentrale ergänzt dünne Adapter und einen Ergebnisindex. Worker behalten ihre eigenen Werkzeuge, Modelle, Berechtigungsdialoge und Sessions. Es gibt keinen zweiten allgemeinen Agenten- oder Terminal-Stack.

## Einrichtung unter Verbindungen

| Anschluss | Implementiert | Noch separat erforderlich |
| --- | --- | --- |
| Telegram | Bot-Token im Schlüsselbund, Nutzer-IDs, privater Nachrichtenempfang per Long Polling, Text/Fotos/Dokumente, Antworten und Ergebnisdateien | Bot bei BotFather und freigegebene Nutzer; keine Gruppen oder Sprachnachrichten |
| WhatsApp | Eigene Anmeldung/QR und Bridge je Anschluss, zugelassene Nummern, Textempfang und Antworten | Bereitgestellte eigene Rufnummer mit WhatsApp; keine Rufnummernbeschaffung, keine automatische Übernahme der alten Bridge |
| WhatsApp Business | Cloud-API-Zugang, Rufnummerprüfung, signierter Webhook, Absenderfreigabe, Textdialog | Meta-App, Nummer, API-Version, Token/App Secret/Verify Token; HTTPS-Reverse-Proxy zum lokalen Webhook; Medien später |
| A2A | Vorhandenen Agenten entdecken/ansprechen, eigene JSON-RPC-Schnittstelle, GetTask/CancelTask, Bearer-Auth, Kontexte, blockierende oder abrufbare Antworten | Vorhandene Hermes-Adresse und Token eintragen oder eigenen freien Port wählen; Streaming/Push nicht implementiert |
| Outlook / Microsoft Graph | App-Zugang mit Tenant/Client/Secret/Postfach, Zugang prüfen, Posteingang/Kalender lesen | Microsoft-App und passende Application Permissions; interaktives OAuth, Senden und Ereignisabos später |
| Discord | Bot-/Kanalzugang speichern und prüfen, Absenderliste als Struktur | Gateway und automatischer Empfang folgen |
| OpenAI Bilder | Eigenen API-Zugang prüfen, GPT-Image-Modell wählen, Bild aus Beschreibung erzeugen und in output/ registrieren | API-Zugang; keine Nutzung eines ChatGPT-Abos als API-Key, keine Bildbearbeitung im separaten Formular |

Speichern aktiviert keinen Empfänger. Erst „Empfang starten“ bindet einen Port, startet Polling oder öffnet eine WhatsApp-Bridge. Beim ausdrücklich angeforderten normalen Neustart werden aktive, ruhende Empfänger kurz pausiert und anschließend wieder gestartet. Die additiven IDs in channels.json.restartChannels werden vor dem Stoppen gespeichert; fehlgeschlagene Wiederverbindungen bleiben für den nächsten Start erhalten. Laufende Kanalaufträge blockieren den Neustart. Restore- und Updatepausen verhindern eine automatische Wiederaufnahme. Nach ungeplantem Prozessende ohne Neustartvormerkung bleiben Empfänger gestoppt. Ältere Versionen ignorieren die Vormerkung und benötigen manuelles Starten. Ein beendeter Prozess wird nicht stillschweigend wiederholt. Bestehende Hermes-Dienste, insbesondere Port 9900/Tailscale, werden weder umkonfiguriert noch gestoppt. A2A-Standardwerte: Clientmodus, neuer Server mit Bind Host 127.0.0.1 und Port 9900. Die A2A-Implementierung verwendet Node-Standardbibliothek und vorhandene Netzwerkhelfer, kein zusätzliches Agenten-SDK.

Jeder Nachrichtenanschluss wählt Arbeitsbereich und Worker beziehungsweise Standard/Vertretung. Eine Conversation-Zuordnung enthält Anschluss, Chat und Absender. Vor dem Workerstart wird eine Empfangskennung gespeichert. Ein Duplikat startet keinen zweiten Auftrag. Pro Conversation läuft ein Auftrag, pro Anschluss höchstens acht; A2A begrenzt Kontexte auf fünf Nachrichten. `/new`, `/stop`, `/status` gelten für normale Messaging-Kanäle. Kanalgespräche starten mit Workspace-Berechtigungen; native Rückfragen bleiben in der Verbindung zugänglich. Eine Dateisandbox ersetzt keine MCP-/Netzwerkisolation.

Die Zuordnung bleibt in `data/control/channels.json`, die eigentliche Session und deren Export beim jeweiligen Worker und unter `workspaces/default/chats/`. Status und Ergebnisse sind im Verbindungsdialog einsehbar. Nach unbestätigter Zustellung wird ein Ergebnis nicht automatisch erneut verschickt. Die Aufnahme dieser Conversations in die normale Chatliste ist bewusst noch offen.

## Skills

`skill-library.mjs` indexiert die Firmenbasis, Workspace-/Projekt-Skills, `~/.agents/skills`, `~/.codex/skills`, `~/.claude/skills`, `$HERMES_HOME/skills` (sonst `~/.hermes/skills`) und Skillkataloge bereits verbundener Worker. Der Scan startet keinen Worker. Herkunft wird nicht mit Urheberschaft verwechselt; Hermes' Bündelmanifest kennzeichnet mitgelieferte Skills. Der lokale Hub liest `hermes-agent/optional-skills` unter dem Hermes-Home.

Details laden die Anweisung erst bei Bedarf. „Im Chat verwenden“ nennt die genaue Quelldatei und verlangt eine Prüfung der Voraussetzungen mit den eigenen Worker-Werkzeugen. Kopieren legt eine eigene Variante inklusive Referenzen und `.source.json` an; bei Hermes zusätzlich den Repository-Lizenzhinweis. Fremde Installationen bleiben unverändert. Symlinks, übergroße und zwischenzeitlich geänderte Quellen werden abgewiesen. Selbst erstellte Skills werden ebenfalls getrennt markiert. Ein automatisches Lernen, Remote-Marketplace-Installationen und automatisches Überschreiben durch Updates sind nicht Bestandteil dieser Stufe.

## Ergebnisse

`library.mjs` indexiert `output/` der Projekte/Jobs, registrierte Dateien aus Antwortlinks und vorhandene `data/artifacts/` des Order-Systems. Versteckte Dateien und ausbrechende Pfade werden verweigert; Input-Dateien werden nicht pauschal als Erzeugnisse indexiert. Der Scan umfasst bis zu 5.000 Output-Dateien, mit sichtbarem Hinweis bei Erreichen der Grenze. Metadaten/Favoriten liegen in `data/control/library.json`; fehlende Dateien bleiben erkennbar. Wiederverwenden erzeugt erst auf Wunsch eine Kopie in Projekt-input/. Native Tools werden weiterhin im Worker ausgeführt; explizite Ergebnisdateien können unabhängig vom Worker registriert werden.

## Verifikation und Quellen

`test/service-platform.test.mjs` prüft Geheimnisreferenzen, Absenderfreigaben, konkurrierende Duplikate, Bridge-Trennung, Neustartverhalten, Zustellfehler, A2A-Roundtrips gegen lokale HTTP-Server, Cloud-Signaturen, Bibliothek und Skill-Importe. Die Tests kontaktieren keine echten Anbieter und führen keine kostenpflichtigen Modellaufrufe aus. UI-Prüfung mit isolierten Testdaten: 1280, 390, 320 Pixel; Speichern/Fehler, Filter, Vorschau, Favoriten und Datei als Chat-Anhang.

A2A wurde mit dem lokal installierten Hermes-Plugin unter `plugins/platforms/a2a/` abgeglichen. Referenz: [A2A-Spezifikation](https://a2a-protocol.org/latest/specification/). Bildschnittstelle: [OpenAI Image Generation](https://developers.openai.com/api/docs/guides/image-generation). Anbieterlinks stehen zusätzlich direkt im Einrichtungsdialog. Der echte Kontozugang und ein Nachrichten-Roundtrip müssen nach Einrichtung der jeweiligen Zugangsdaten geprüft werden.

## Einspielen bei laufenden Chats

Die statische UI kann bereits aktualisiert werden, während der bisherige Server laufende Chats beendet. Neue Katalogeinträge und die Bibliothek werden erst angeboten, wenn der Server sie in bootstrap.features bestätigt. Bis dahin bleiben bestehende Einrichtungswege und Skill-Details verfügbar. Nach Ende laufender Chats den Wrapper regulär neu starten; Browser-Ereignisstream/Reload übernimmt die neuen Fähigkeiten. Keinen laufenden Agentenauftrag dafür abbrechen.
