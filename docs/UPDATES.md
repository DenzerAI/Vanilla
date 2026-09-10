# Updates und Beiträge

Stand: 10.09.2026. Die Module `github`, `updates` und `contributions` sind im
Quellcode umgesetzt und unter Einstellungen angeschlossen. Eine Quelländerung
ist noch keine veröffentlichte Produktversion und kein aktivierter Betriebsweg.
GitHub-App, echtes Kundenrepository, Review-Worker und unabhängiger Operator
müssen je Installation eingerichtet und abgenommen werden. Ohne diese
Voraussetzungen meldet der Ablauf Prüfbedarf und installiert nichts.

Dieses Dokument führt Architektur und Betriebsgrenzen; den Oberflächenvertrag
führt [updates.md](../wrapper/surfaces/updates.md). Dauerhafter Agenteneinstieg
bleibt [UPDATE.md](../UPDATE.md), die Anmeldung führt [GITHUB.md](GITHUB.md).

## Bedienung

**Einstellungen → Updates** enthält **Version / Beiträge**. Die vorhandene Glocke
öffnet den passenden Reiter. GitHub bleibt im gemeinsamen Verbindungsbereich.

1. **Jetzt prüfen** oder täglicher Systemauftrag: öffentliche Freigabe lesen.
2. **Vorbereiten**: eigenen neutralen Code bereitstellen, getrennte Arbeitskopie
   zusammenführen, technische Prüfungen und Agentenbewertung ausführen.
3. **Jetzt installieren**: genau diesen geprüften Stand freigeben. Solange noch
   Arbeit läuft, erfolgt keine Betriebspause; danach erneut starten. Veränderte
   Voraussetzungen erfordern eine neue Vorbereitung.

Der Ursprung kann unter Version **Freigeben**. Nur ein sauberer, nach `main`
gepushter Stand mit erfolgreichen Pflichtprüfungen wird veröffentlicht. Ein
normaler Push ist keine Updatefreigabe. Kunden sehen diesen Herausgeberweg nicht.

## Quellen, Rollen und privater Austausch

| Bereich | Inhalt und Verantwortung |
| --- | --- |
| Öffentliches `DenzerAI/Vanilla` | Gemeinsamer Kern, neutrale Module, Baupläne und geprüfte Releases. |
| Eigenständiges privates Kundenrepository | Geprüfter Anwendungscode und gemeinsamer öffentlicher Basiscommit. Kunde schreibt; Betreuer liest mit eigenem Konto. |
| Lokale Datenablage | Firma, Identität, Arbeitsanweisungen, Chats, Aufträge, Zugänge, Betriebszustand und Updatejournal. |
| Ursprung | Beiträge vergleichen und einen eigenen Entwicklungszweig vorbereiten; Veröffentlichung separat. |
| Kunde | Eigene Einrichtung, private Codebereitstellung und lokale Updatefreigabe. |

Rolle, Konto-ID, Repository-ID, Sichtbarkeit und Rechte werden beim Einrichten und
vor externen Schreibaktionen geprüft. Das Ursprungsrepository bleibt öffentlich.
Kunden bekommen durch diese Funktion kein Schreibrecht auf Vanilla. Neue Clones
erben weder Ursprungsrolle noch Konten oder Kundenliste.

**Teilen** und die Updatevorbereitung prüfen zuerst den kompletten neutralen
Quellbaum mit den vorhandenen Datenschutz- und Modulregeln. Geschützte Pfade,
Symlinks, ungeprüfte Assets und unregistrierte Module stoppen den Export. Nur
neutrale Dateien werden übertragen; keine lokale Git-Historie. Namen, Tests und
Kommentare gehören ebenfalls zum geprüften Code. Inhaltsscanner ersetzen keine
saubere Trennung von Firmendaten und Anwendungscode.

Der Austauschstand ist ein elternloser Commit mit neutraler Nachricht und
öffentlichem Basiscommit, unter `refs/heads/vanilla-share/<Quellbaumhash>`. Kennung
und bestätigter Remote-Commit bleiben im lokalen Journal. Eine Wiederholung
prüft zuerst dieselbe Referenz; unbestätigte Schreibaktionen werden nicht blind
wiederholt. Der private Hauptzweig bleibt unverändert. Ohne eingerichtete
Austauschvereinbarung gibt es keinen betreuten Installationsablauf. Öffentliche
Downloads und die lesende Updateprüfung bleiben erreichbar.

Der Ursprung liest nur ausdrücklich über seine GitHub App erreichbare private
Repositorys. Empfang und Vorschau führen keinen fremden Code aus. Die Vorschau
zeigt Änderungen gegenüber dem aktuellen Vanilla-Stand. **Übernehmen** verwendet
die gemeinsame öffentliche Basis für eine echte Zusammenführung und erhält
zwischenzeitliche Vanilla-Änderungen. Konflikte ergeben Prüfbedarf. Der Kandidat
liegt ausschließlich in einer privaten Entwicklungsablage. **Zurückstellen**
und **Ablehnen** verändern keine Kundendaten.

## Veröffentlichungen

Stabiler Kanal ist GitHubs öffentliche neueste reguläre Release mit genau einem
Asset `vanilla-release.json`, höchstens 128 KiB. Autoritatives Schema und
Validierung stehen in `core/releases.py`; veröffentlichte Felder:

| Feld | Bindung |
| --- | --- |
| `schemaVersion`, `releaseId`, `version` | Format 1, konkrete Release-ID, numerische Produktversion. |
| `repository`, `tag`, `commit` | Festes Ursprungsrepository, `v<Version>`, exakter Commit. |
| `publishedAt`, `summary`, `changes` | Datierter, begrenzter Änderungstext. |
| `requirements` | Updater 1, Plattformen und minimale Python-/Node-Version. |
| `modules` | IDs, Versionen, Abhängigkeiten aus dem Modulregister. |
| `migrations`, `rollback` | Ausgangsversionen, Datenkompatibilität und Migrationsbedarf. |
| `checks` | GitHub-Run-IDs für Datenschutz, Funktionen und Design am selben Commit. |

Keine ausführbaren Befehle oder zusätzlichen Agentenanweisungen im Manifest.
Unbekannte Felder und Schemata werden abgewiesen. Tag und tatsächlicher GitHub-
Prüfstatus werden geprüft, einschließlich Linux, macOS und der tatsächlichen
Containerprüfung im Funktionstest.
Entwürfe, Vorabversionen, manipulierte bekannte Manifeste und falsche Quellen
werden nicht übernommen. Bei veränderter Freigabe wird eine vorhandene
Vorbereitung ungültig. Vor Installation wird die Quelle erneut geprüft.

Die bestehende Queue führt `system-update-check` aus: täglich plus Zufallsversatz,
beim Start nur wenn fällig; manuelle Prüfung nutzt dieselbe Queue. Öffentliche
Abfragen senden weder Konto-Token noch lokales Inventar. Bedingte Releaseabfrage,
Rate-Limit-Pause und letzter erfolgreicher Prüfstand bleiben erhalten. Offline
wird kein frischer Prüfzeitpunkt erfunden. Es gibt kein automatisches Downgrade.

**Freigeben** prüft origin/main, Rechte und CI, erstellt einen Entwurf, lädt das
validierte Manifest hoch und veröffentlicht erst anschließend. Ein unbestätigter
Schreibschritt bleibt als ungeklärt gespeichert. Keine automatische Doppel-
veröffentlichung. Ausgangsversionen und Datenkompatibilität muss der Herausgeber
explizit angeben; Version 1 veröffentlicht keine automatischen Datenmigrationen.

## Vorbereitung und Agent

Die SQLite-Datensätze `updates/*` und `contributions/*` führen Zustand und Revision.
Ein Auftrag bindet Release, Originalcommit, Quellbaum, eigenen Bestand, Kandidat,
Build, Tests, Wiederherstellungsprobe, Betriebsweg und Freigabe an Hashes.
Doppelklicks verwenden denselben Auftragsschlüssel. Neustarts unterbrechen eine
Vorbereitung sichtbar; sie wird nicht still neu ausgeführt.

Der technische Zusammenführungsweg erstellt eine getrennte Git-Arbeitskopie.
Prüfcode wird aus der installierten vertrauenswürdigen Version geladen, niemals
durch Import von Python aus einem eingehenden Kandidaten. Eigene Änderung und
neue Version werden zusammengeführt; ungeklärte Konflikte stoppen den Ablauf.

Der Agent bewertet den vollständigen neutralen Diff als Text. Aktuell unterstützt
ist der vorhandene native Codex-Anschluss. Modell wird unter Updates ausdrücklich
gewählt, Denkstufe ist dessen höchste bekannte angebotene Stufe. Kein Anbieter-
oder Kontofallback und keine Änderung der normalen Chateinstellung. Tools,
Konnektoren, Skills, Netzwerk und Projektanweisungen werden für diesen flüchtigen
Prüfthread deaktiviert; unerwartete Werkzeugereignisse brechen ihn ab. Der Review
ändert selbst keine Quelldatei. Konfliktanpassungen erfolgen zunächst über den
Arbeitsauftrag aus UPDATE.md und werden danach neu vorbereitet.

Der Diff hat ein festes Größenlimit, die Prüfung ein Zeitbudget. Unvollständige
Vergleiche, ungültiges Ergebnis, Abbruch, erschöpftes Budget oder gemeldete
Probleme ergeben **Klärung nötig**. Auch ein lokal angebundener Worker kann Code
an einen Cloudanbieter senden; das steht sichtbar bei der Modellauswahl.

Technische Nachweise sind unabhängig vom LLM: Datenschutz, Modulverträge,
Funktionstests, Typen/UI-Build, unveränderter eigener Bestand, lesbare Sicherung
und passender Operator. Kandidatentests laufen in einer Betriebssystem-Sandbox
ohne Produktionsdateien, Zugänge oder externe Netzwerkverbindungen. Innerhalb
des Containers ist nur sein eigener Loopback für Schnittstellentests erreichbar.
Nur neutraler Code wird schreibgeschützt eingebunden, keine Git-Historie.
Prüfdaten liegen in einem begrenzten temporären Dateisystem; weder Hostdateien
noch Docker-Socket sind schreibbar eingebunden. Zurück kommt ausschließlich
ein größenbegrenztes, pfadgeprüftes UI-Buildarchiv. Eine bloße
Arbeitskopie zählt nicht als Isolation. Schlägt ein Test wegen fehlender
Sandboxfähigkeiten fehl, gibt es kein Ausweichen auf ungeschützte Ausführung.

## Bestandserhalt und Installation

Erfasst werden die führenden Jobdateien, ihre Anweisungen und Python-Erweiterungen,
Projektdefinitionen und Anschluss-/Worker-Konfiguration als lokale Hashes. Sie
werden nicht in den Modellkontext oder nach GitHub exportiert. Der Operator
sichert zusätzlich **alle** Standard-Daten, sämtliche Arbeitsbereiche, Firmenbasis,
Quellstand, Git-Metadaten und UI-Build. Auftragsreservierungen und Zustellzustände
liegen in der konsistent gesicherten Datenbank und werden bei Rückkehr erhalten.
Eigene Module benötigen ihren Daten- und Migrationsvertrag im Modulregister.

V1 aktiviert auf einem eingerichteten macOS-Hostdienst in einem festen Clone.
Der separate Operator wird einmalig **außerhalb der Web-App** eingerichtet:

```sh
.venv/bin/python scripts/setup-update-sandbox.py
.venv/bin/python scripts/verify-update-sandbox.py
.venv/bin/python scripts/setup-updates.py --standard-data-only
```

Voraussetzung ist eine laufende lokale Docker-kompatible Linux-Engine. Der erste
Befehl baut eine Prüfumgebung nur aus neutralen Abhängigkeitsdateien und dem
geprüften Backup-Installer. Er übernimmt keine Firmen- oder Zugangsdaten. Die
spätere Prüfung verwendet ausschließlich deren festgehaltene lokale Image-ID,
ohne automatisches Nachladen. Remote-Docker-Kontexte sind gesperrt. Der zweite
Befehl prüft echte Netzwerk-/Dateigrenzen sowie alle Kandidatentests. Die
[Container-Netzwerkisolation](https://docs.docker.com/engine/network/drivers/none/)
lässt interne Loopback-Tests zu, ohne den Loopback des Hosts freizugeben.


Vorher GitHub, Prüfarbeitsumgebung und regulären Hostdienst nach OPERATIONS.md
vorbereiten. Der Schalter bestätigt die Prüfung, dass keine unbekannten externen
Datenablagen, Symlinks oder zusätzlich betreuten System-Cronjobs fehlen. Solche
Installationen benötigen einen eigenen geprüften Betriebsvertrag. Weder App
noch Agent installieren im Hintergrund einen neuen Systemdienst.

Die App schreibt nur einen freigabegebundenen Auftrag. Der vorinstallierte,
installationsgebundene Operator pausiert genau diesen Dienst, wartet auf das
Ende des Datenbankschreibers, sichert, tauscht Code und UI aus und startet zunächst
mit gesperrter neuer Arbeit. Erst nach Quell-, Datenbank-, Inventar- und
Anschlussprüfung wird der Betrieb freigegeben. Andere Dienste bleiben unberührt.

Jeder Schritt ist in `data/control/updates/<ID>/operator-state.json` nachvollziehbar.
Der Operator liegt außerhalb des ausgetauschten Codes. Ein unterbrochener Austausch
wird zurückgenommen. Nach der dauerhaften Entscheidung zur Betriebsfreigabe gibt
es keine automatische Rücknahme mehr, die bereits neu entstandene Geschäftsdaten
löschen könnte. Eine unbestätigte Wiederaufnahme bleibt als Wiederherstellungsbedarf
stehen. Externe Sendungen werden niemals pauschal wiederholt. Sicherungen werden
nicht automatisch gelöscht; Platzbedarf ist vor der nächsten Übernahme zu prüfen.

Bei bestätigtem Abschluss werden Dienst-/Buildnachweis und installierte Version
aktualisiert. Auch der unabhängige Operator bekommt die geprüfte neue Version.
Neue Abhängigkeiten oder inkompatible Datenmigrationen werden in Version 1
bewusst nicht durch Kopieren über die vorhandene Umgebung installiert.

## Grenzen und Ausbauvertrag

- Automatischer Betrieb ist zunächst **manuell freigegeben**, kein unbeaufsichtigtes
  Auto-Install. Bei aktiver Arbeit warten und später installieren.
- Geänderte Lockfiles oder Python-Abhängigkeiten brauchen eine separat vorbereitete
  Umgebung. Datenmigrationen und Linux-Aktivierung brauchen einen eigenen,
  getesteten Operatorvertrag. Der Agent darf diese Grenze nicht umgehen.
- Ohne lokale Container-Engine und erfolgreich abgenommenes Prüfabbild bleibt
  die Installation gesperrt. Der Client installiert keine Engine still nach und
  weicht nicht auf ungeschützte Tests aus. Im Funktionalitäts-Workflow prüft
  `update-sandbox` dieselbe echte Containergrenze und die vollständige Testsuite.
- Registrierung der GitHub App, reale Anmeldung, tatsächlicher privater Austausch
  und Dienstwechsel müssen auf einer neutralen Abnahmeinstallation geprüft werden,
  bevor eine konkrete Installation als betriebsbereit bezeichnet wird.
- Keine Verlustfreiheit für unbekannte Erweiterungen behaupten. Modulverträge,
  Bestandserfassung, Regressionstests und Wiederherstellungsprobe sind verbindlich.

Jede Erweiterung pflegt `system/modules.json`, Fähigkeiten, API-/Datenvertrag,
Migrationsregel, Oberflächenvertrag und Tests im selben Auftrag. Neue Module
werden dadurch auffindbar und können später bewusst übernommen werden. Der
feste Link auf UPDATE.md bleibt der Einstieg auch für ältere Installationen.

## Prüfszenarien

Eigene Workflows, aktive/inaktive Zeitpläne, Erweiterung, Zugang und reservierte
Ausführungen mit synthetischen Daten auf zwei getrennten Installationen prüfen.
Erfolgsupdate und Konflikt, manipuliertes Manifest/Build, veraltete Freigabe,
Codeänderung während Vorbereitung, verweigerte Rechte, privater Testmarker,
verlorene Push-Antwort, Doppelaktion, Neustart während Vorbereitung und Stromausfall
während Aktivierung gehören zur Abnahme. Nach fehlgeschlagener Gesundheitsprüfung
müssen alter Code, eigene Daten und Ausführungsreservierungen wieder vorhanden sein.
Testdoubles belegen Zustands- und Fehlerlogik; sie ersetzen weder echten GitHub-
Zugriff noch den tatsächlichen Hostwechsel. Desktop/Handy, beide Themes und
Tastaturbedienung ergänzen die gemeinsame Designprüfung.
