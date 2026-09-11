# Geräte und Netzwerk

Modul `device-connections`, Version **1.0.0**, Datenformat **1**.
Einstieg: Einstellungen → Verbindungen → Geräte & Netzwerk. Android (ADB),
Samsung TV und Tailscale verwenden denselben Katalog und denselben Modal.

## Anschlüsse und Zustände

`core/devices.py` führt die Registry und die Gerätetransporte; `core/device_api.py`
führt die HTTP-Schnittstellen. `core/device_network.py` verwaltet ausschließlich
Tailscale-Regeln für den aktuellen App-Port. Die Funktionslandkarte führt
Statusquellen, UI und MCP-Anschluss.

- `GET /api/devices`: gespeicherte Geräte, letzte Prüfung und ADB-Verfügbarkeit.
- `GET /api/devices/usb`: USB-Auswahl, nur auf ausdrücklichen Klick.
- `POST /api/devices/save`: Anlage/Bearbeitung mit Revision; geändertes Ziel setzt
  Verbindung und Freigabe zurück. Noch nicht geprüft bedeutet nicht verbunden.
- `POST /api/devices/{id}/action`: Eigentümeraktion (koppeln, verbinden, prüfen,
  trennen und bedienen). Keine Aktion durch bloßes Anzeigen der Liste.
- `POST /api/devices/{id}/revoke`: Freigabe unabhängig von Formularentwürfen sperren.
- `POST /api/devices/{id}/remove`: revisionsgeprüft entfernen.
- `GET /api/devices/{id}/audit`: letzte 50 Einträge; insgesamt höchstens 500.
- `GET /api/network/status`, `POST /api/network/action`: Installation, Anmeldung,
  Serve, expliziter Funnel und Beenden der eigenen Freigabe.

Native Worker erhalten `device_list` und `device_action` über `core/mcp.py` und
`/internal/devices/tool`. Die Bridge setzt die Worker-ID aus ihrer Startkonfiguration,
nicht aus den Modellargumenten. Eine ACP-Bridge ist zusätzlich an das Projekt
gebunden. Codex verwendet wie beim bestehenden Memory-Anschluss die aktuelle
Projekt-ID im Werkzeugaufruf. OpenClaw unterstützt weiterhin keinen pro Session
eingerichteten MCP-Anschluss. Werkzeuge richten keine Geräte ein und erteilen
keine Freigaben.

## Rechte und Betrieb

Jedes Gerät beginnt gesperrt. Nach bestätigter Verbindung können Eigentümer es
für genau einen Arbeitsbereich, ausgewählte Worker und erlaubte Aktionsgruppen
freigeben. Lesen: Status/Bildschirm; Bedienen: Tasten/Tippen/Wischen/Text;
Apps: Android-Komponenten starten; Shell: explizit erweiterte Android-Befehle.
Apps und Shell sind standardmäßig aus. Der Server prüft die Freigabe vor jeder
Agentenaktion, auch nach einem Neustart. Wartende Aktionen lesen die aktuelle
Freigabe nach Erwerb der Ausführungssperre erneut. Eine Sperre nimmt bereits
an das Gerät gesendete Befehle nicht zurück. Gleichzeitige Formularänderungen
überschreiben keine neuere Revision. Keine automatischen Befehlswiederholungen.

Diese Anschlussrechte sind **keine Betriebssystem-Sandbox**. Der bestehende
Hostprozess besitzt weiterhin native Shell-/Dateirechte; ebenso ist die bestehende
App-Anmeldung eine Eigentümeranmeldung, keine Mitarbeiterrollenverwaltung.
Für voneinander nicht vertrauenswürdige Firmenbenutzer sind getrennte Hostrechte
und eine authentisierte Benutzer-/Projektzuordnung erforderlich. Ein Worker mit
unbeschränktem Hostzugriff kann native ADB-Befehle außerhalb dieser API starten.

## Android

Benötigt aktuelle Android SDK Platform Tools (`adb` im PATH), USB- oder
WLAN-Debugging und Bestätigung am entsperrten Gerät. Netzwerkzugriffe sind auf
private LAN-/Tailnet-Adressen begrenzt; öffentliche ADB-Adressen, Loopback und
Link-Local-Ziele werden abgewiesen. Eine geprüfte DNS-Auflösung wird als konkrete
Ziel-IP benutzt. Die Verbindung bindet zusätzlich die gehashte Android-Serienkennung;
ein anderes Gerät an derselben Adresse wird nicht bedient.

Kopplungsport und sechsstelliger Einmalcode kommen aus „Gerät mit Kopplungscode
koppeln“. Der separate Verbindungsport steht auf der WLAN-Debugging-Seite und kann
sich ändern. Kopplung allein meldet noch keine Verbindung. USB-Geräte werden
explizit ausgewählt. Native ADB-Schlüssel bleiben bei ADB; keine Kopie im
Verbindungsspeicher. Der native ADB-Server wird weder zurückgesetzt noch beendet.
Der Code geht nur über stdin, nie in Prozessargumente, SQLite oder Protokolle.

Steuerbefehle verwenden immer ein konkretes `-s`-Ziel. Normale Eingaben werden
für die Android-Shell als getrennte Argumente quotiert. Texteingabe unterstützt
in dieser Fassung druckbares ASCII ohne Prozentzeichen; sonst verständlicher
Fehler, keine fehlerhafte Unicode-Zusage. Bildschirmbilder werden begrenzt und
an den Aufrufer zurückgegeben, nicht separat gespeichert. Shell-Ausgabe ist begrenzt,
Prozesslaufzeit auf 20 Sekunden. Android-Schutzbildschirme können Bildschirmaufnahmen
verhindern. Entfernen in der App widerruft nicht die native Android-Kopplung;
dafür auf dem Gerät unter gekoppelte Geräte „Vergessen“ wählen.

## Samsung-Fernseher

Unterstützt die Netzwerk-Fernbedienung kompatibler Tizen-Fernseher über
`/api/v2/channels/samsung.remote.control`. Direkter Anschluss üblicherweise
`ws://Adresse:8001`; Anfrage am eingeschalteten Fernseher bestätigen.
Keine Samsung-Kontoanmeldung und keine SmartThings-Cloud-Anbindung.

WSS verwendet gültige, zum Host passende Zertifikate. Selbstsignierte
TV-Zertifikate werden nicht still akzeptiert. Für Fernzugriff kann ein passender
TLS-Proxy/Serve-Zugang vor dem Fernseher stehen; ein beliebiger Funnel-Link stellt
noch keine Samsung-API bereit. Öffentliche WSS-Ziele brauchen eine ausdrückliche
Geräteeinstellung, bei privatem WS werden ausschließlich geprüfte private Adressen
verbunden. Der Proxy muss den WebSocket-Pfad zum Fernseher weiterleiten.

Die WebSocket-Session bleibt nur im Arbeitsspeicher. Eventuell vom Fernseher
zurückgegebene Tokens werden nicht persistiert oder ausgegeben. Nach einem
Neustart kann eine neue TV-Bestätigung erforderlich sein. Eine Taste gilt als
„gesendet“, nicht als nachgewiesene physische Ausführung. Einschalten aus Standby
ist modellabhängig; kein pauschales Wake-on-LAN-Versprechen. Kompatibilität bleibt
am echten Modell zu prüfen.

## Tailscale-Einrichtung

Tailscale wird über die offizielle Installationsseite installiert. Der Dialog
prüft die vorhandene CLI und startet auf Klick deren Kontoanmeldung. Nur eine
validierte `login.tailscale.com`-Adresse wird als Anmeldelink ausgegeben. Ablauf
endet spätestens nach drei Minuten; ein App-Ende beendet den eigenen Loginprozess.
Keine Zugangstokens in Konfigurationsdateien oder CLI-Ausgaben im Chat.

Serve veröffentlicht nur die eigene Loopback-App im privaten Tailnet. Funnel
veröffentlicht sie auf Port 8443 und verlangt eine aktive App-Anmeldung sowie
`publicConfirmed: true`. Existierende Freigaben werden nicht übernommen oder
zurückgesetzt; ein Wechsel erfordert zuerst das Beenden der eigenen Freigabe.
Vorher-/Nachher-Abgleich prüft alle fremden Regeln. Die eigene HTTPS-Adresse wird
in der bestehenden Hostkonfiguration erhalten; andere Hostwerte bleiben unverändert.
Eine CLI-Bestätigung belegt die Regel, nicht einen externen Erreichbarkeitstest.
Bei zentral verwaltetem HTTPS (`VANILLA_MANAGED_HTTPS=1`) bleibt die App lesend;
Anmeldung und Serve gehören dort weiterhin zum Host-Betriebsweg. Der Dialog
zeigt diese Grenze, statt einen nicht funktionierenden Aktivierungsknopf anzubieten.

Die Installation lädt die WebSocket-Abhängigkeit über die bestehende Lockdatei.
Es werden keine Android-Geräte gesucht, gekoppelt, automatisch freigegeben oder
Tailscale-Funnels beim App-/Systemstart geöffnet. Betriebssystemanmeldung und
Bestätigung am jeweiligen Gerät bleiben notwendige Einrichtungsschritte.

## Daten, Migration und Rückkehr

Additive Records `devices/registry-v1` und `devices/network-v1` in der bestehenden
SQLite-Datenbank. Keine neue Datenbank und kein Zurücksetzen anderer Verbindungen.
Fehlende Records ergeben eine leere Liste; unbekannte Formatversionen werden
abgewiesen. Registry enthält Zielmetadaten, gehashte Android-Geräteidentität,
Rechte, Revision und letzte Prüfung. Das begrenzte Protokoll enthält Zeitpunkt,
Geräte-ID, Aktion, Akteur und Ergebnis, keine Codes, Befehlsinhalte oder Screenshots.
Die vorhandene SQLite-Sicherung erfasst diese Records. Native ADB-Kopplungsschlüssel
und Tailscale-Konto bleiben externe Installationszustände.

Ältere App-Versionen ignorieren die neuen Records. Vor Rückkehr Agentenfreigaben
sperren und von der neuen Version eingerichtete Serve-/Funnel-Regeln bewusst
beenden: Ein Code-Rollback nimmt externe Netzwerkregeln nicht automatisch zurück.
Abhängigkeit: `websockets==17.0.1`; keine weitere Node-Produktionsabhängigkeit.
Ältere laufende Server melden `deviceConnections` nicht und zeigen den neuen
Gerätekatalog erst nach regulärem Neustart. Bestehender Tailscale-Dialog bleibt
für diese Server als Fallback erhalten.

## Quellen und Prüfung

- Android: https://developer.android.com/tools/adb
- Platform Tools: https://developer.android.com/tools/releases/platform-tools
- Tailscale: https://tailscale.com/docs/reference/tailscale-cli/serve und
  https://tailscale.com/docs/reference/tailscale-cli/funnel
- Samsung-Protokollreferenz: https://github.com/xchwarze/samsung-tv-ws-api
  (Referenz einer unabhängigen Implementierung, keine offizielle Samsung-API-Garantie).
- WebSocket-Client: https://websockets.readthedocs.io/en/stable/reference/sync/client.html

`core/tests/test_devices.py` prüft Rechte, Sperren während laufender I/O,
Revisionen, Migration, Codebehandlung, Shell-Quoting, Zielbindung, CSRF und
interne Authentisierung, Samsung-Verbindung über einen echten lokalen
WebSocket-Testserver sowie Tailscale-Regeln über simulierte CLI-Antworten.
Physische Geräte und reale Konto-/Tailnet-Freigaben sind separate Abnahmeschritte.
