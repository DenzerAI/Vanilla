# Vanilla · Agent von Denzer AI

Neutrale, weiterentwickelbare Basis mit Python/FastAPI, SQLite, React, dateibasiertem Wissen, Memory, Jobs und einem privaten Node-Adapter. Firmenwissen, Identität und Anbieterzugänge werden erst bei der Einrichtung ergänzt. Keine persönlichen Worker-Anmeldungen, Kundendaten oder Host-Datenbanken werden importiert.

Öffentlicher Quellcode: [DenzerAI/Vanilla](https://github.com/DenzerAI/Vanilla). Dieser Entwicklungsstand enthält ausschließlich Anwendungsquellen, keine privaten Git-Verläufe oder Installationsdaten.

## Aktueller Abnahmestand, 07.09.2026

Die neutrale Entwicklungsvorschau läuft auf Port **21989**, der private Adapter auf **21990**. Die gebaute Oberfläche und ihre Assets sind über Tailscale-HTTPS erreichbar. Ein eigener Supervisor startet den Dienst nach einem Prozessende erneut; der geregelte App-Neustart wurde geprüft. Automatischer Start nach einem Host-Neustart ist noch nicht abgenommen. Hostadressen und Zugangsdaten werden je Installation eingerichtet.

Entwicklung und Runtime sind eigenständige Clones dieses Repositories. Sie verwenden eigene Datenordner und importieren keine Kundendaten. Das ist eine Trennung der Anwendung und Daten, keine harte Betriebssystem-Sandbox. Eigene KI-Zugänge und eine zusätzliche App-Anmeldung sind noch nicht eingerichtet.

## Lokaler Start

Voraussetzungen: Python ab 3.12, Node ab 22.12. Aus dem Vanilla-Projektordner:

```sh
npm run setup:system
npm start
```

`setup:system` installiert die festgelegten Python- und Node-Abhängigkeiten,
baut die Oberfläche und richtet lokale Suche, Diktat sowie Piper/Thorsten
und das Backup-Programm ein. Der erste Durchlauf braucht Internet und kann
wegen der Modelldownloads einige Minuten dauern. Bei einem Fehler gilt das
Setup als fehlgeschlagen; erneut ausführen setzt die Einrichtung fort.
Piper-Pakete stehen in `requirements-speech.lock`; die Modelldateien werden
gegen die Prüfsummen in `system/runtime-assets.mjs` geprüft. Nach erfolgreicher
Einrichtung braucht Thorsten keinen zusätzlichen Handgriff und kein Internet.
Git enthält Quellcode, Installationsablauf und Modellreferenzen; Zugangsdaten,
Chats und persönliche Einstellungen gehören zur jeweiligen Installation.
Der aktuelle Prüfhost ist macOS ARM64; die vollständige Neuinstallation auf
anderen Betriebssystemen oder Prozessoren ist noch gesondert abzunehmen.

`npm start` startet den FastAPI-Kern auf Loopback-Port **1989**, dieser seinen privaten Node-Adapter auf **1990**. Ctrl+C beendet beide. 8890/9090 und identische Kern-/Adapterports sind gesperrt. Die Daten bleiben in `data/control`, Arbeitsdateien in `workspaces/default`, jeweils innerhalb des Projekts. Symlink-Ausbrüche und externe Daten-/Modellpfade werden abgewiesen.

Der Kern liefert die gebaute Oberfläche aus. Ereignisse laufen über **SSE** (`/api/events`), es wird kein Browser-WebSocket benötigt. Ohne konfigurierten eigenen Anbieterzugang ist noch kein echter KI-Chat möglich.

## Entwicklung und GitHub

Die führende Quelle ist jetzt ein eigenständiger Entwicklungsclone von **DenzerAI/Vanilla**. UI-Code liegt unter `wrapper/ui`, die zugehörigen Designverträge unter `wrapper/DESIGN.md` und `wrapper/surfaces`. Der frühere Importordner `work/vanilla-agent` ist nicht mehr die Arbeitsquelle. `publish-source.py` war für den Erstexport gedacht und wird beim normalen Weiterbau nicht verwendet.

Änderungen entstehen in einem Feature-Branch, werden gebaut und geprüft, anschließend per Commit und normalem Push gesichert. Die Runtime übernimmt den geprüften Commit ohne eigene Quellcodeänderungen. Neue Instanzen klonen dasselbe Repository und erhalten eigene Daten, Identität und Zugänge. Betriebsdaten, Dependencies und Secrets bleiben außerhalb von Git; neue Dateitypen müssen bewusst in `.gitignore` aufgenommen werden.

## Alternative macOS-Installation aus stabilem Clone

Die folgenden `host-service.py`-Befehle beschreiben den launchd-Installationsweg auf einem entsprechend berechtigten Zielhost. Sie sind nicht der aktuelle Supervisor-Betriebsweg der Entwicklungsvorschau auf 21989. Sie setzen freie Ports 1989/1990 und die funktionierende native Tailscale-CLI voraus.

Dieser Abschnitt ist ein Operator-Ablauf für einen regulär berechtigten Host-Prozess. Er ist keine Umgehung einer Worker-Sandbox. Die Web-App darf weiterhin weder Dienste installieren noch Serve oder Schlüsselbund ändern.

Einmalig einen **stabilen eigenen Clone außerhalb der Werkbank und temporärer Verzeichnisse** anlegen:

```sh
VANILLA_RUNTIME="$HOME/vanilla-agent-runtime"
gh repo clone DenzerAI/Vanilla "$VANILLA_RUNTIME"
cd "$VANILLA_RUNTIME"
```

Dort die Abhängigkeiten wie oben installieren. Im zentralen Verifikationstor genau einmal die Oberfläche bauen und den Build an die gepushte Quellrevision binden:

```sh
npm run control:build
.venv/bin/python scripts/host-service.py seal-build
```

Der Operator bestätigt vorher, dass 1989/1990 frei sind. Altprozesse werden ausschließlich nach eindeutiger Zuordnung und Ausschluss laufender Arbeit geordnet über den zulässigen Host-Weg beendet. Das Installationsskript beendet selbst keinerlei Portbesitzer.

Mit dem **live bestätigten** Tailnet-Hostnamen als `VANILLA_ORIGIN`:

```sh
VANILLA_ORIGIN='https://HOST.TAILNET.ts.net:1989'
.venv/bin/python scripts/host-service.py start --origin "$VANILLA_ORIGIN"
.venv/bin/python scripts/host-service.py https --origin "$VANILLA_ORIGIN"
.venv/bin/python scripts/host-service.py status
```

`start` ist bei bereits geladenem Dienst idempotent und prüft dessen Erreichbarkeit. Beim ersten Start verwendet es die bestehenden `core.service`-Vorlagen: genau ein launchd-Kerndienst mit `KeepAlive`, `RunAtLoad`, zehn Sekunden Wiederanlaufabstand, restriktiver Dateimaske und Dateideskriptor-Limits 8192. Der Kern beaufsichtigt seinen Node-Adapter bereits selbst. Ein weiterer vorhandener Heartbeat-Job prüft jede Minute. Kein neuer Supervisor und kein PM2.

Beide launchd-Labels leiten sich aus dem absoluten, isolierten Datenordner ab. Definitionen liegen im Benutzer-LaunchAgents-Ordner, Logs ausschließlich in `data/control/logs/core.log` und `heartbeat.log`. Die Aktivierungsnotiz liegt in `data/control/services/host-activation.json`; sie enthält Quellrevision und Build-Hash. Installiert wird ausschließlich bei sauberem Git-Bestand, Übereinstimmung mit `origin/main` und unverändertem versiegeltem UI-Build.

`https` prüft zuerst den nativen Tailscale-Zustand und die freie Zielbelegung. Es ergänzt nur `serve --https=1989 --bg` zum Loopback-Kern und verifiziert die übrigen Regeln vor/nachher, insbesondere 443. Kein Funnel, Reset oder Überschreiben einer fremden Regel. Scheitert die native CLI, endet der Ablauf sofort. Die Syntax folgt der [offiziellen Tailscale-Serve-Dokumentation](https://tailscale.com/docs/reference/tailscale-cli/serve).

Im verwalteten Betrieb prüft die App den eigenen HTTPS-Endpunkt mit echter Zertifikatsprüfung, ohne wiederholt die native Tailscale-App zu starten. Die Zugriffsbeschränkung ist in dieser neutralen Vorschau das Tailnet. Noch kein eigener zusätzlicher App-Login eingerichtet.

## Neustart und Weiterbau

```sh
.venv/bin/python scripts/host-service.py restart
```

Der Befehl benutzt den vorhandenen Core-Neustart-Endpunkt. Er verweigert laufende Chats oder Aufträge und friert neue Arbeit während des Neustarts ein. Danach werden eine neue Prozess-ID, Erreichbarkeit und geladener KeepAlive-Dienst geprüft. Ein echter KeepAlive-Ausfalltest gehört zusätzlich in die zentrale Host-Abnahme.

Für ein Update dieser alternativen launchd-Installation erst den geprüften Commit pushen, dann in der stabilen Runtime:

```sh
.venv/bin/python scripts/host-service.py stop
git pull --ff-only
.venv/bin/python -m pip install --no-cache-dir -r requirements.lock
npm ci --ignore-scripts --cache .cache/npm --no-audit --no-fund
npm --prefix wrapper ci --ignore-scripts --cache .cache/npm --no-audit --no-fund
npm run control:build
.venv/bin/python scripts/host-service.py seal-build
.venv/bin/python scripts/host-service.py start --origin "$VANILLA_ORIGIN"
```

`stop` nutzt dieselbe Prüfung auf aktive Arbeit, entlädt ausschließlich die beiden eigenen Labels und prüft freie Vanilla-Ports. Kein Hostserver-Neustart. SQLite und Workspace bleiben erhalten. Bei Auth-Einrichtung muss der Operator-Anschluss bewusst um die eigene Authentifizierung ergänzt werden; die Skripte lesen dafür keine privaten Zugangsdaten.

## Prüfung

```sh
.venv/bin/python -m pip install --no-cache-dir pytest
.venv/bin/python -m pytest core/tests/test_deployment.py core/tests/test_vanilla.py core/tests/test_integration.py core/tests/test_operations.py -q
.venv/bin/python scripts/security-scan.py
.venv/bin/python scripts/verify-start.py
```

`verify-start.py` benötigt freie 1989/1990 und benutzt ausschließlich temporäre eigene Daten. Es prüft HTTP → FastAPI → Adapter und vollständiges Herunterfahren. Der Integrationstest prüft zusätzlich SSE und persistierte Wiederaufnahme mit einem simulierten Worker. Die Entwicklungsvorschau auf 21989 ist separat über HTTPS und mit geregeltem Wiederanlauf geprüft. Eine neue Zielinstallation braucht ihre eigene Betriebsabnahme. Ein bestehender Altprozess gilt niemals als Abnahme.

Der getrennte Skilltree ist fertig gebaut und wird bereits über die bestehende Bibliothek als eigenständige Vorschau ausgeliefert. Die Übernahme seines Quellstands steht noch aus. Dieser Betriebsauftrag verändert oder exportiert ihn nicht; die spätere Anbindung an den stabilen App-Zugang bleibt offen.

## Bekannte Grenzen

- Embedding-Modellgewichte fehlen; ohne Modell arbeitet die Suche mit Volltext/Fuzzy-Suche. Optionale Installation über `requirements-embeddings.lock` und `python -m core.models`.
- System-Schlüsselbund und globale Aktivierung bleiben gesperrt. Anbieterzugänge verwenden jetzt einen installationsbezogenen verschlüsselten Tresor. Gmail-/Outlook-Einrichtung und echte Inbox: [docs/MAIL.md](docs/MAIL.md). Keine persönlichen Konten werden mitgeliefert; die echte Anbieterabnahme steht aus.
- Die vorhandenen Memory-Verlustfälle des Quellaudits sind nicht vollständig behoben oder abgenommen.
- Restic ist optional; lokales Backup ist noch kein vollständiges ausfallsicheres Wiederherstellungskonzept. Vollständiger Betriebsumfang, eigene Zugänge und echter Restore-Test bleiben offen.
- Der Scanner erkennt bekannte Muster; er beweist nicht die Abwesenheit unbekannter Namen oder kodierter Geheimnisse.


## Öffentlicher Arbeitsstand

Stand: 8. September 2026. `main` enthält den eingefrorenen Quellstand der aktuellen
App. Separate Entwicklungsarbeiten sind als `work/…`-Zweige gesichert; ihre Übersicht
steht in [docs/WORKING-STATES.md](docs/WORKING-STATES.md). Sie sind nicht automatisch
zusammengeführt oder als produktionsfertig abgenommen. Anbieter und Gateways sind
nicht vorkonfiguriert. Diese Veröffentlichung aktiviert keine Verbindung.
