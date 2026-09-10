# Verbindungen

Der Bereich liegt unter **Einstellungen → Verbindungen** und verwendet deren Seitenleiste mit ausgewähltem Verbindungen-Eintrag und „Zurück zur App“. Querverweise und die globale Suche öffnen ihn direkt. Die bisherige Kataloggestaltung bleibt erhalten.

Der gemeinsame `PageHeading` zeigt den einzigen Seitentitel. Die zusätzliche Verbindungen-/Skills-Tabzeile und die globale Hinzufügen-Aktion entfallen; neue Dienste werden über das Plus im Katalog eingerichtet.

## Zweck und fester Aufbau

Externe Anbieter einrichten und bestehende Zugänge verwalten. Reihenfolge: Seitentitel → Suche mit Kategoriefilter → **Eingerichtet** → **Weitere Dienste einrichten**. Beide Listen sind nach CRM & Handwerk, E-Mail & Kalender, Nachrichten, Design & Medien, Sprache und Automatisierung & Agenten gruppiert. Leere Kategorien entfallen; Überschriften zeigen die Trefferzahl. Suche und Filter wirken auf beide Listen und finden auch Kategoriebegriffe. Der Filter verwendet den gemeinsamen `FilterPicker`. Keine Formulare oder neuen Funktionsblöcke zwischen Titel und Suche.

## Ein Element

Alle Dienste verwenden `integration-item` innerhalb von `integration-grid`: Original-Markenicon links (`BrandIcon`), Name und höchstens eine kurze Funktionszeile in der Mitte, einheitliche Aktion rechts. Ein nicht eingerichteter Dienst zeigt **Plus**, ein eingerichteter **Chevron**. Keine abweichenden Größen für einzelne Anbieter. Anbieter werden im zentralen `ui/connection-catalog.mjs` geführt; Markenassets liegen lokal mit Quellenangabe vor.

## Hinzufügen und Bearbeiten

Plus auf dem Diensteeintrag öffnet `Modal` mit „Verbindung hinzufügen“. Derselbe Formulartyp öffnet bei eingerichteten Diensten „Verbindung bearbeiten“. Der Anbietername ist sichtbar. Nur notwendige Felder; bei API-Zugängen ein Passwortfeld und der vorhandene primäre Speichern-/Verbinden-Button. Fehler erscheinen innerhalb des normalen Benachrichtigungsablaufs; der Dialog bleibt offen. Keine vorgetäuschte erfolgreiche Verbindung. Nach Erfolg Dialog schließen und Eintrag unter **Eingerichtet** anzeigen. Verbundene native Sprachdienste verschwinden aus dem Hinzufügen-Katalog. Verbindung entfernen deaktiviert ihre Verwendung.

## Funktionale Trennung

- Link/Webhook: vorhandenes Verbindungsformular mit Adresse und Secret-Referenz.
- Groq: echter API-Zugang zur Spracherkennung, Schlüsselbund; keine frei editierbare URL.
- ElevenLabs: echter API-Zugang zur Sprachausgabe, Schlüsselbund; Stimmen werden danach unter **Stimme** ausgewählt.
- Anbieter verbinden wählt ihn nicht automatisch als Standard. Anbieterwahl gehört zur jeweiligen Funktionseinstellung.

Alle gespeicherten Zugangsschlüssel verwenden denselben macOS-Schlüsselbund und denselben Metadatenindex unter **Einstellungen → Secrets**. Sprachdienste registrieren ihren Schlüssel automatisch; frühere Sprachschlüssel werden ohne Auslesen des Werts in die Liste übernommen. Im Webhook-Dialog kann ein vorhandenes Secret gewählt oder ein neuer Bearer-Token eingegeben werden. Neue Tokens erhalten eine eigene Referenz und überschreiben keine von anderen Verbindungen verwendeten Schlüssel. Entfernen einer Verbindung behält ihren Schlüssel; das Löschen eines noch verwendeten Secrets wird verhindert.

## Erweiterungsregel

Jeder weitere Anbieter folgt diesem Aufbau. Anbieterbezogene Einstellungen dürfen einen spezialisierten Dialoginhalt haben, aber keinen eigenen Einstieg, keine zusätzliche Übersichtsleiste und keine abweichende Kachel erfinden. Suchfilter gilt auch für neue Einträge.

## CRM und Handwerk

`../crm-catalog.mjs` enthält die recherchierten Anbieter, Quellen, belegten API-Möglichkeiten und Zugangsfelder. `ui/connection-catalog.mjs` übernimmt sie in denselben Katalog. Die Original-Markenassets unter `ui/assets/crm/` besitzen einen Quellen- und Prüfsummennachweis. Die Suche findet auch „Handwerk“, „CRM“, „KMU“ und Aliasnamen wie „Label“ oder „SAP B1“. Eingerichtete CRM-Anbieter verschwinden aus dem Hinzufügen-Katalog; ihr Markenicon bleibt auch bei einer eigenen Bezeichnung erhalten.

Das Plus öffnet denselben `Modal` mit `CrmConnectionForm`; Bearbeiten verwendet denselben Inhalt. Vorbelegt werden Anbieter, belegte Zugangsmethode und bekannte Adressen. API-Freigaben und Beta-Status stehen mit Anbieterquelle im Dialog. Ein Browserlogin ist kein Ersatz für eine dokumentierte API; bei Desktop-Installationen darf die Anmeldeadresse leer bleiben. Es gibt keinen automatischen Browserlogin und keinen automatischen Datenabgleich.

API-Schlüssel sowie Benutzername und Passwort liegen als zusammengehöriger Zugang im bestehenden macOS-Schlüsselbund. Der Zustand enthält nur Metadaten und die Secret-Referenz. Beim Bearbeiten bleiben leere Geheimnisfelder unverändert; neue Werte erhalten eine eigene Referenz. Die Zugangsmethode wechseln erfordert passende neue Zugangsdaten. Die Oberfläche liest gespeicherte Werte nicht aus. Bündel von CRM-Zugangsdaten sind im Webhook-Dialog nicht als Bearer-Token auswählbar. „Ersetzen“ in Secrets öffnet die zugehörige CRM-Verbindung.

„Sicher speichern“ bedeutet **Login hinterlegt · nicht angemeldet** oder **API-Zugang hinterlegt · ungeprüft**. Für HERO, weclapp und CentralStationCRM kann nach dem Speichern ein API-Zugang separat geprüft werden. Eine fehlgeschlagene Prüfung bleibt sichtbar. Eine erfolgreiche Prüfung meldet **API-Zugang geprüft · kein Sync aktiv**. Bei Anbietern ohne implementierte Prüfung wird kein Prüfbutton angeboten. Änderungen an Zugang oder Adresse verwerfen die alte Prüfung; ein während einer Prüfung geänderter oder entfernter Anschluss kann nicht nachträglich als geprüft erscheinen. Speichern aus einem veralteten Dialog wird zurückgewiesen.

Der Server meldet die Fähigkeit `crmConnections`; ältere laufende Server zeigen die neuen Einträge erst nach ihrem Neustart an.

## Nachrichten und Agenten

Telegram, WhatsApp (eigene Bridge), WhatsApp Business (Cloud API), A2A, Outlook (Microsoft Graph), Discord-Vorbereitung und OpenAI Bilder nutzen denselben Katalog und `Modal` mit `ServiceConnectionForm`. Felder und Anbieter werden zentral in `service-catalog.mjs` geführt. Mehrere Identitäten sind erlaubt; diese Angebote bleiben daher im Katalog sichtbar. Gespeichert, geprüft und Empfang aktiv sind getrennte Zustände. Empfang startet nur ausdrücklich; zum Ändern zuerst stoppen. Ungespeicherte Änderungen sperren Prüfen und Starten. Zugangswerte bleiben im Schlüsselbund.

Arbeitsbereich und Worker gehören bei Nachrichtenanschlüssen in denselben Dialog. Gespräche/Ergebnisse und Rückfragen werden dort aufgeklappt, ohne einen zweiten Chatbereich oder eine zusätzliche Seite einzuführen. Die Anzeige von Kanalgesprächen in der normalen Chatliste bleibt eine offene Produktentscheidung. A2A-Clientaktionen und Microsoft-Lesezugriffe liegen ebenfalls hinter Aufklappdetails.

## Kategorien, Marken und Aktualisierung

`ui/connections-page.jsx` rendert beide Listen aus dem zentralen Katalog. Generische Link-/Webhook-Verbindungen speichern Anbieterkennung und Kategorie; Umbenennen entfernt das Markenicon nicht. Eigene Dienste können im Verbindungsdialog zugeordnet werden. Unbekannte Werkzeuge liegen unter Automatisierung & Agenten. Kalender und technische Werkzeuge verwenden sachliche Symbole der gemeinsamen Iconbibliothek statt einer erfundenen Marke. A2A verwendet das lokal belegte Originalzeichen. Bekannte Worker-Werkzeuge haben verständliche Anzeigenamen; der technische Name bleibt als Titel erhalten.

Lokal gespeicherte Verbindungen warten nicht auf MCP-Werkzeugabfragen. Der Server liefert den letzten bekannten Werkzeugstand je Worker und aktualisiert ihn im Hintergrund. Ein Fehler löscht diesen Stand nicht. Die Oberfläche hält Einträge während einer Aktualisierung sichtbar, bündelt gleichzeitige Abfragen und nutzt beim erneuten Öffnen einen kurzen Sitzungscache. Der erste Abruf besitzt einen Ladezustand; Fehler bieten erneutes Laden. Werkzeuge werden nur während laufender Ermittlung nachgeladen. Gespeichert/Empfang aktiv bleiben getrennte Zustände. Geheimnisse werden nicht im Browsercache gespeichert.

## Ladeformen

Fehlen beim ersten Abruf eingerichtete Einträge, zeigt dieser Listenbereich
den gemeinsamen List-Skeleton. Der lokal verfügbare Dienstekatalog und
bereits geladene Verbindungen bleiben bedienbar. Fehler ersetzen den
Platzhalter und behalten „Erneut laden“.


Verbindungs-Skeletons verwenden integration-grid und integration-item mit originalem Iconplatz, Textzeilen und rechter Aktionsform; Desktop-/Mobile-Spalten entsprechen dem Katalog.

## 21st.dev

21st.dev steht neben Higgsfield unter Design & Medien mit lokalem Originalicon
und dem vorhandenen Link-Dialog. Die Website ist vorbelegt; ein Einrichtungshinweis
verweist auf https://21st.dev/mcp. Speichern legt nur den Browserlink an.
Der offizielle MCP-Endpunkt ist https://21st.dev/api/mcp und verlangt den
Header `x-api-key`; ein Bearer-Token im Link-Dialog aktiviert diesen Zugang nicht.
Die Worker-Einrichtung ist separat und wird nicht als verbunden dargestellt.
Quelle: https://github.com/21st-dev/magic-mcp/blob/main/server.json (08.09.2026).

## Geräte & Netzwerk

Die zusätzliche Kataloggruppe enthält Android (ADB), Samsung TV und Tailscale.
`DeviceConnection` und `NetworkConnection` verwenden den bestehenden Modal,
Field, SettingRow, native Details und den gemeinsamen Schalter. Technische
Geräteanschlüsse verwenden das vorhandene Plug-Symbol statt neuer Markenbilder.
Keine zusätzliche Hauptnavigation oder Geräteübersicht außerhalb der Verbindungen.
Der Katalog zeigt Geräte erst, wenn der Server `deviceConnections` meldet.

Android: Name → USB oder WLAN/Tailscale → Geräteadresse und Verbindungsport bzw.
USB-Auswahl → Hinzufügen. Danach Verbinden, Verbindung prüfen und Trennen.
Die separate Codekopplung erklärt Kopplungsport und Verbindungsport am selben Ort.
Samsung: Name und WebSocket-Adresse; öffentliche WSS-Adressen erst unter Fernzugriff.
Arbeitsbereich, Agenten und Aktionsrechte liegen zunächst unter Details.
Freigeben wird erst nach bestätigter Verbindung möglich und mit Speichern bestätigt;
Sofort sperren wirkt direkt auch während einer laufenden Anfrage. Adressänderung
nimmt die Freigabe serverseitig zurück. Veraltete Dialoge erhalten den Entwurf
mit Konfliktmeldung. Kopplungscodes werden nach jedem Versuch aus dem Feld entfernt.
Fernbedienung und Nutzungsprotokoll sind aufklappbar; Bildschirmbilder passen in
Viewport und Dialog. Schmale Ansichten lassen die vorhandenen Aktionszeilen umbrechen.

Gespeichert, zuletzt verbunden und für Agenten freigegeben sind unterschiedliche
Zustände. USB-Suche beginnt nur auf Klick; es gibt keine automatische Geräteaktion.
Entfernen benennt den zusätzlichen Widerruf der nativen ADB-Kopplung am Gerät.
Tailscale zeigt Installation, Kontoanmeldung und Serve im normalen Dialog.
Funnel liegt unter Öffentlicher Zugriff und benötigt App-Anmeldung und ausdrücklichen
Schalter. Zentral verwaltete Installationen zeigen ihren Host-Betriebsweg.
Technischer Vertrag, Modellgrenzen und Migration: [Geräte](../../docs/DEVICES.md).
