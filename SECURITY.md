# Sicherheitsstand und Betriebsgrenzen

Die lokalen Sicherheitspatches sind keine Betriebsfreigabe. Die Anwendung ist
weiterhin ein gemeinsamer Einzelbenutzer-Prototyp, ohne technische Mandantentrennung
und ohne vollständige Freigabe- oder Datenabflusskontrolle für Agenten.

## Order-System

Die API und Artefakt-Downloads benötigen jetzt `Authorization: Bearer …` mit einem
konfigurierten `ORDER_SYSTEM_TOKEN` von mindestens 32 Zeichen. Ohne sichere
Konfiguration antworten sie mit 503; falsche Zugangsdaten ergeben 401. Nutze einen
kryptografisch zufälligen Schlüssel aus einem lokalen Secret-Speicher. Der statische
Token hat noch keine Ablaufzeit und keine getrennten Rollen. Niemals Tokens in URLs
oder Frontend-Builds einbetten.

Vor einem Neustart müssen der menschliche Anmeldeweg und alle Worker auf die
Authentifizierung umgestellt und geprüft werden. Die bisherige Oberfläche sendet
noch kein Token; nackte Downloadlinks sind ebenfalls kein authentifizierter Zugang.
Kein automatischer Neustart ist Bestandteil dieser Änderung.

Der Prozess begrenzt API-/Downloadanfragen gemeinsam auf 600 pro Minute. Das ist
ein einfacher Schutz, keine Benutzerquote, Kostenobergrenze oder faire Verteilung.
Dateirechte für neu erstellte Laufzeitdateien sind auf den Eigentümer beschränkt.

## Wrapper und Workflow-Verbindungen

Der Wrapper bleibt ausschließlich an Loopback gebunden. Host-/Origin-Prüfung und
das Bootstrap-Token stellen keine menschliche Anmeldung dar. Niemals einen Tunnel
oder Reverse Proxy davor veröffentlichen, solange echte Authentifizierung fehlt.

Workflow-Aufrufe erlauben standardmäßig nur öffentliche HTTP(S)-Ziele auf Ports
80/443. Alle DNS-Antworten werden geprüft; die Verbindung nutzt eine geprüfte IP.
Redirects und übergroße Antworten werden verweigert. Für notwendige interne Ziele
kann der Betreiber `UWE_INTERNAL_URLS` setzen: eine vollständige URL pro Zeile,
einschließlich Pfad und Query. Diese Ausnahme ist privilegierte lokale Konfiguration,
kein Browserfeld. Sie erlaubt genau diesen Endpunkt einschließlich interner IPs.
Daher nur kontrollierte Ziele eintragen. HTTPS ist für vertrauliche Inhalte notwendig.

Ausführende Agenten haben weiterhin Vollzugriff. Plananweisungen und lokale
Dateibrowsergrenzen sind keine Sandbox für externe MCP-Werkzeuge. Nachrichten,
Dateien und Toolantworten dürfen keine Freigaben erzeugen. Vor Kundendatenbetrieb
sind technische Toolrechte, Netzgrenzen und einmalige, an Inhalt und Empfänger
gebundene Außenaktionsfreigaben erforderlich.

## Lokale Prüfungen

- `npm test`: synthetische Unit- und HTTP-Integrationstests.
- `npm run check` und `npm --prefix wrapper run build`.
- `python3 -m unittest discover -s jobs/briefings -p 'test_*.py'`.
- `python3 scripts/security-scan.py`: lokaler Musterscanner, nur Fundort/Typ/Zeile.
  Keine Vollständigkeitsgarantie; verschlüsselte Inhalte, Archive und Symlink-Ziele
  werden nicht untersucht. Die zwei expliziten externen Secret-Dateien werden nur
  lokal gelesen. Werte werden nicht ausgegeben oder kopiert.
- `npm audit --ignore-scripts`: sendet Paketmetadaten an die npm-Registry, keine
  Quelldateien oder Kundendaten. Null Advisories beweisen keine sichere Laufzeit.

Private Prüfberichte, Ausgangskopien und Rechteinventare liegen ausschließlich
unter `.security-audit/`, das nicht versioniert werden darf. Bestehende lokale
Codex-Snapshot-Referenzen können ältere Arbeitsdaten enthalten. Kein `push --mirror`,
keine Veröffentlichung sämtlicher Referenzen und keine Historienbereinigung ohne
geklärten Umfang. Ein vorhandener Remote ist keine Veröffentlichungsfreigabe.
