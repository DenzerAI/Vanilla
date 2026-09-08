# Gmail, Outlook und echte Inbox

Vanilla liefert keine Konten, Zugangsdaten oder Beispielnachrichten aus. Die Einrichtung erfolgt ausschließlich unter Verbindungen. Persönliche Worker-/Host-Konten werden nicht übernommen.

## Normaler Einstieg

Gmail oder Outlook auswählen, „Mit Google/Microsoft verbinden“, beim Anbieter anmelden und Mailzugriff bestätigen. Nach erfolgreicher Anmeldung wird das Konto im aktiven Arbeitsbereich verbunden; die Inbox beginnt den Abruf. Ohne registrierte Anbieteranwendung zeigt der Dialog die einmalige Vorbereitung, die konkrete Rücksprungadresse und „Mit Agent einrichten“. Erst nach dieser Vorbereitung kann die Anmeldung per Button funktionieren. Keine vorgetäuschte One-Click-Einrichtung ohne OAuth-App.

Die Anbieter-App wird einmal pro Installation im gemeinsamen lokalen Anbietertresor gespeichert. Google: Gmail API aktivieren, OAuth-Webanwendung, Zielgruppe, Redirect URI, gmail.readonly und gmail.send. Externe öffentliche Apps benötigen die je nach Einsatz geltende Google-Verifizierung; Testmodus ist kein dauerhafter Produktionsbetrieb. Microsoft: Web-App, passende Kontotypen, Redirect URI, delegiert User.Read, Mail.Read, Mail.Send und offline_access. Ein Firmenadministrator muss die App gegebenenfalls freigeben. Anmeldung nutzt zufälligen Einmalzustand, PKCE und einen auf die eröffnende Sitzung begrenzten Abschlussstatus. Abgebrochene/abgelaufene Abläufe verbinden kein Konto. OAuth-Zugänge werden automatisch erneuert. Kein Passwort des Postfachs wird gespeichert.

## Firmenpostfach / Entra

Der zusätzliche Outlook-Weg verwendet Tenant-ID, App-ID, App-Geheimnis und explizite Postfachadresse. Die Verbindung prüft vor Speicherung tatsächlich den Lesezugriff auf dieses Postfach. Administratoren richten die App in Entra und ihre Postfachrollen in Exchange ein. Für begrenzten Zugriff Exchange RBAC for Applications verwenden, mit Application Mail.Read und bei gewünschtem Versand Application Mail.Send auf den freigegebenen Ressourcen. Unbeschränkte zusätzliche Entra-Zuweisungen wirken additiv und müssen gesondert geprüft werden. Das Postfachfeld in Vanilla stellt keine Berechtigungsgrenze beim Anbieter dar. Konkrete Administratorrollen und Freigabe hängen vom Organisationsverfahren ab; Vanilla speichert keinen Admin-Login. Zertifikatsanmeldung, automatisierte App-Provisionierung und Verwaltung des Secret-Ablaufdatums sind noch nicht implementiert. Das Formular prüft keine isolierte Mail.Send-Berechtigung durch einen Testversand.

## Inbox und Versand

Die bestehende Sidebar zeigt Gespräche; auf schmalen Ansichten wechseln Liste und Verlauf. Die SQLite-Datenbank besitzt Konten, Gespräche, Nachrichten, lokale Lesemarker, Erledigung, versionierte Entwürfe und Versandreservierungen. Konten sind Arbeitsbereichen zugeordnet. IDs werden aus Konto und Anbieter-ID abgeleitet; gleiche Anbieter-ID in zwei Konten vermischt keine Nachrichten. Neue Nachrichten öffnen erledigte Gespräche erneut. Veraltete Lesemarker markieren keine neueren Nachrichten gelesen.

Erstimport: letzte 30 Tage, Gmail maximal 2.000 Nachrichten pro Runde. Gmail folgt danach historyId mit paginierter Historie; abgelaufene Historie löst einen begrenzten Neuimport aus. Outlook folgt Delta-Seiten für Posteingang und Gesendet. Nachrichten und Cursor werden erst nach einer vollständigen Runde gemeinsam übernommen. Abgleich läuft alle 120 Sekunden und lässt sich manuell anstoßen. Kein öffentlicher Webhook ist nötig. Lokale Nachrichten bleiben beim Entfernen/Archivieren im Anbieterpostfach oder beim Trennen erhalten; dies ist eine lokale Arbeitskopie, kein vollständiger Spiegel von Anbieterordnern und Labels. Historie außerhalb des Erstimports wird noch nicht nachgeladen. Gesprächsliste lädt seitenweise; Volltextsuche über sämtliche Mailinhalte und unbegrenzte Historienansicht sind noch nicht umgesetzt.

HTML erscheint als reiner Text. Skripte und entfernte Bilder werden nicht geladen. Datei-Anhänge werden auf ausdrücklichen Abruf authentisiert als Download angeboten, bis 8 MB. Outlook-Element-/Referenzanhänge werden nicht als gewöhnliche Dateien ausgegeben.

Antwortentwürfe werden explizit gespeichert und beim Wechsel über die Inbox-Aktionen vorab gespeichert. Konflikte überschreiben keinen fremden Entwurf. „Antwort prüfen“ zeigt Ursprungskonto, Antwortadresse, Betreff und den gespeicherten Text. Erst „Senden“ reserviert die Entwurfsversion und ruft den Anbieter auf. Antworten bleiben im Ursprungsthread. Ein neuer Nachrichtenstand verlangt erneute Prüfung. „Vom Anbieter angenommen“ bedeutet keine nachgewiesene Zustellung. Unklare Zustellung und nach Neustart unterbrochener Versand sperren blinde Wiederholung. Neue Nachrichten werden über das Plus in der Inbox vorbereitet, mit ausdrücklich gewähltem Ursprungskonto, Empfänger und Betreff. Eine automatische Auflösung unklarer Zustellung, Antwort-an-alle und ausgehende Dateianhänge sind noch nicht enthalten.

## Agenten

„Mit Agent einrichten“ legt die konkrete Hilfsanfrage in den bestehenden Chatentwurf; die dort ausgewählte Maschine bleibt zuständig. „Mit Agent bearbeiten“ übergibt ausschließlich den ausgewählten, begrenzten Mailverlauf als Daten. Bestehendes Shared-Memory-MCP führt zusätzlich inbox_setup, inbox_accounts, inbox_threads, inbox_read, inbox_draft, inbox_compose und inbox_send. Unterstützte Worker erhalten diese Werkzeuge über ihren bestehenden MCP-Anschluss; reine Chatübergabe funktioniert unabhängig davon. MCP-Entwürfe versenden nichts. inbox_send erfordert die ausdrückliche Benutzerfreigabe des konkreten Empfängers und gespeicherten Inhalts; Version und Freigabeparameter werden serverseitig verlangt. Keine automatische Antwort auf eingehende Nachrichten.

## Tresor und Wiederherstellung

ProviderVault verschlüsselt Anbieterwerte mit Fernet aus cryptography in SQLite. Der installationsbezogene Schlüssel liegt unter data/control/provider-vault/provider.key, Verzeichnis 0700, Datei 0600; kein System-Schlüsselbund und kein Import von Host-Credentials. Node-Verbindungen nutzen denselben Tresor über den geschützten internen Kernanschluss. Im Standalone-Adapter ist Speichern ohne Kern nicht verfügbar. Systemzugangs-Schlüssel bleiben getrennt.

Backups nehmen SQLite und den lokalen Tresorschlüssel gemeinsam auf. Wiederherstellung ersetzt beide zusammen; reine Datenbankkopien genügen nicht. Der lokale Schlüssel schützt vor Klartext in Datenbank/Export, nicht vor einem Angreifer mit vollständigem Zugriff auf den Betriebssystembenutzer. Nach Anbieter-App-Rotation bestehende Konten erneut verbinden. Trennen löscht den lokal gespeicherten Kontozugang und beendet den Abruf, widerruft aber nicht automatisch die Anbieterfreigabe. Diese lässt sich im Google-/Microsoft-Konto entfernen.

## Belege und Abnahme

core/tests/test_mail.py nutzt ausschließlich synthetische Konten und simulierte HTTP-Antworten. Echte Google-/Entra-Anmeldung, organisationsabhängige Adminfreigaben und Versand an reale Empfänger bleiben separate Betreiberabnahme. Diese Entwicklung richtet ausdrücklich keine persönlichen Konten ein.

Offizielle Quellen:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/guides/sync
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
- https://learn.microsoft.com/en-us/graph/delta-query-messages
