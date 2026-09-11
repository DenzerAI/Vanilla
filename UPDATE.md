# Bestehende Vanilla-Installation aktualisieren

Das [Produktkonzept für Updates und Beiträge](docs/UPDATES.md) beschreibt den
beschlossenen Frontend-/GitHub-Ausbau. Es ist noch kein automatischer Updater.
Bis zu dessen Implementierung und Abnahme gilt der folgende Agentenablauf.

Fester Einstieg: [Vanilla-Update](https://github.com/DenzerAI/Vanilla/blob/main/UPDATE.md).
Dem Agenten **auf dem Zielrechner** genügt dieser Auftrag:

> Update https://github.com/DenzerAI/Vanilla/blob/main/UPDATE.md

Damit ist die Aktualisierung nach diesem Ablauf beauftragt, einschließlich
Vorbereitung, Prüfung und geregelter Aktivierung. Ein Link allein führt nichts
aus. Der Agent benötigt Zugriff auf die richtige Installation und deren zulässigen
Betriebsweg. Fehlende Zugriffe oder fachlich mehrdeutige Konflikte konkret melden;
mit unabhängiger Vorbereitung selbstständig fortfahren. Bereits erteilte
Berechtigungen nicht erneut abfragen. Ein Updateauftrag erlaubt weder das
Veröffentlichen von Firmendaten noch das Senden externer Nachrichten.

## 1. Ziel und Quellversion feststellen

- Installationsordner, Arbeitsbereich, Firmenbasis, Datenordner, laufenden Dienst,
  Betriebssystem und Betriebsweg feststellen. Die dortigen `AGENTS.md`, Identität
  und technischen Regeln lesen. Keine andere Installation aus einem ähnlich
  benannten Verzeichnis ableiten.
- Git-Stand, eigene Commits, ungesicherte und unversionierte Änderungen sowie
  eigene Module und verbundene Dienste erfassen. Keine Geheimnisse in Chat,
  Protokoll oder Git ausgeben.
- Die angegebene Version verwenden. Ohne Versionsangabe gilt der aktuelle
  `main`-Stand von `DenzerAI/Vanilla` als **Kandidat**. Nach dem Fetch dessen
  vollständige Commit-ID festhalten und durchgehend verwenden. Während des
  Updates nicht auf einen inzwischen neueren Branchstand wechseln.
- Für genau diese Commit-ID müssen die GitHub-Prüfungen `Source privacy`,
  `Functionality` (Linux und macOS) und `Design gate` erfolgreich abgeschlossen
  sein. Fehlende, laufende oder fehlgeschlagene Prüfungen erlauben noch keine
  Aktivierung. Nicht still eine andere Version auswählen. Ein Push allein ist
  keine Updatefreigabe. Die Zielinstallation benötigt zusätzlich eigene Tests.

Die Anleitung zunächst lesend aus der angegebenen Quelle laden. Verträge und
Werkzeuge aus dem festgehaltenen Quellcommit lesen und vor Verwendung prüfen.
Nicht zum Lesen der Anleitung den laufenden Checkout ersetzen oder entfernte
Skripte direkt herunterladen und ausführen. Auch bei einer alten Installation
ohne diese Datei beginnt die erste Übernahme mit diesem externen Einstieg.

## 2. Bestand sichern und Rückkehr vorbereiten

Vor Eingriffen in die laufende Installation einen vollständigen lokalen
Wiederherstellungsweg gemäß [Betriebsregeln](docs/OPERATIONS.md) herstellen:

- Alten Quellcommit, lokale Codeänderungen, Build, Abhängigkeiten und
  Dienstkonfiguration erhalten. Ungesicherte Arbeit separat sichern; keinen
  pauschalen Commit aller Dateien und kein Verwerfen fremder Änderungen.
- Firmenbasis, Identität, betroffene Workspaces, Datenbanken, Dateien,
  Einstellungen und Verbindungsspeicher sichern. Externe Modulablagen und
  Anmeldungen gesondert erfassen: Nicht alles ist Teil des Standardbackups.
- Lesbarkeit, Wiederherstellungsschlüssel und eine isolierte Wiederherstellung
  prüfen. Eine Live-SQLite-Datei nicht allein während laufender Schreibzugriffe
  kopieren; den konsistenten Backupweg der Installation verwenden.
- Datenformate und Modulversionen über den gesamten Versionssprung prüfen.
  Migrationen zuerst auf einer isolierten Datenkopie testen. Festhalten, ob alter
  Code die neuen Daten lesen kann. Sonst umfasst die Rückkehr auch die Daten.
  Neue Schreibzugriffe erst nach erfolgreicher Abnahme zulassen, damit eine
  Rückkehr keine zwischenzeitlichen Eingaben verliert.

Tests mit Datenkopien dürfen keine produktiven Bots, Webhooks, Zeitpläne oder
Nachrichten auslösen. Verbindungen deaktivieren oder Testanschlüsse verwenden.
Sicherungen, Prüfnotizen und Installationsdaten bleiben lokal.

## 3. Eigene Entwicklung und Vanilla zusammenführen

In einem separaten Entwicklungsclone beziehungsweise Update-Arbeitszweig arbeiten,
ausgehend vom gesicherten **eigenen** Quellstand. Keine Merges oder Entwicklung
im laufenden Dienstverzeichnis. Details: [CODE-SYNC](docs/CODE-SYNC.md).

| Ausgangslage | Übernahme |
| --- | --- |
| Unveränderte Vanilla-Installation | Geprüften Zielcommit übernehmen. |
| Eigenes Repository mit gemeinsamer Git-Historie | Eigenes `origin` behalten, Vanilla als zusätzliche Quelle `upstream` verwenden und in den eigenen Update-Zweig zusammenführen. |
| Alte Installation ohne neue Übernahmewerkzeuge | Geprüfte neue Codekopie bereitstellen; deren Übernahmeskript mit `--root` auf den separaten alten Entwicklungsclone richten, wie in CODE-SYNC beschrieben. |
| Keine gemeinsame Historie oder Firmendaten in der Historie | Kein erzwungener Merge. Neutrale Codeänderungen gezielt in einem sauberen Clone integrieren und Herkunft lokal festhalten. Private Historie nicht veröffentlichen. |

Remote-Adressen prüfen. Ein firmeneigenes `origin` nicht auf Vanilla umbiegen und
ein vorhandenes `upstream` nicht ungefragt überschreiben. Nach dem Fetch die
Commit-ID auflösen und statt eines beweglichen Branchnamens verwenden:

```sh
# VANILLA_TARGET enthält die zuvor geprüfte vollständige Commit-ID.
npm run source:merge -- "$VANILLA_TARGET" --check
npm run source:merge -- "$VANILLA_TARGET"
```

Der Übernahmebefehl stoppt bei Konflikten vor dem Dateiaustausch. Dann beide
Änderungen in einer separaten Konfliktarbeitskopie fachlich prüfen und eine
geprüfte Integrationsrevision herstellen. Schutzprüfungen bleiben aktiv. Kein
pauschales `ours`/`theirs`, `reset --hard`, `clean -fd` oder blindes Pull auf dem
Produktivbestand. Bei fachlicher Mehrdeutigkeit betroffene Funktion und notwendige
Entscheidung melden; den bisherigen Produktionsstand weiter betreiben.

Eigene Geschäftslogik, Felder und Anschlüsse erhalten. Gemeinsame Verbesserungen
auch in vorhandene Erweiterungen integrieren. Modulversionen und Migrationsregeln
nach [MODULES](system/MODULES.md) pflegen; die Oberfläche folgt
[UI-UPDATES](docs/UI-UPDATES.md). Ein Updateauftrag gibt Firmenanpassungen nicht
automatisch zur Rückveröffentlichung frei.

## 4. Den kombinierten Stand prüfen

Abhängigkeiten anhand der Lockdateien in der getrennten Prüfumgebung installieren.
Den endgültigen kombinierten Stand prüfen, nicht nur den Vanilla-Ausgangsstand:

- Datenschutz- und Modulprüfung über die vorhandenen Hooks sowie
  `npm run modules:verify` ausführen.
- Funktionstests der betroffenen Module, eigene Regressionstests, `npm test`,
  `npm run test:core -- -q` und `npm run typecheck` ausführen. Testvoraussetzungen
  stehen in `.github/workflows/functionality.yml`.
- `npm run ui:prepare` ausführen und die Oberfläche nach UI-UPDATES prüfen.
- Bisherige Kernabläufe und eigene Erweiterungen gezielt abnehmen, etwa Chat,
  Aufträge und vorhandene Messenger-Anschlüsse. Eine gespeicherte Verbindung
  beweist keine Funktionsfähigkeit. Externe Testaktionen benötigen ihre passende
  Autorisierung; bis dahin deren Prüfumfang als offen führen.

Fehlende Voraussetzungen oder fehlgeschlagene relevante Prüfungen sind kein
Erfolg. Kandidaten lokal erhalten, Produktionsstand weiter betreiben und die
konkrete Lücke melden. Fehlgeschlagene Prüfungen nicht umgehen.

## 5. Aktivieren und Ergebnis feststellen

Den geprüften Integrationscommit im eigenen Quellrepository sichern, soweit der
Auftrag diesen Push umfasst. Vor dem Wartungsfenster Voraussetzungen für Build,
Start und Rückkehr bereitstellen. Aktive Chats, Aufträge und Entwürfe beachten;
Schreibzugriffe über den vorhandenen Betriebsweg geordnet anhalten. Unmittelbar
vor Migration/Austausch eine aktuelle konsistente Sicherung anlegen; die frühere
Testkopie ist kein aktueller Rückkehrstand.

Nur den geprüften kombinierten Commit samt passendem Build aktivieren. Bei einem
Firmenrepository ist das der eigene Integrationscommit. Der vorhandene macOS-
Hostweg verlangt einen stabilen Clone und Übereinstimmung mit dessen `origin/main`;
ein Test-Worktree oder Vanilla-`upstream/main` ersetzt diese Voraussetzung nicht.
Andere Dienstmanager nach ihren eigenen Betriebsregeln verwenden. Keine fremden
Dienste, Ports oder Anmeldungen ändern.

Nach dem Start Dienstzustand, `/api/system/readiness`, eigene Module und die
tatsächlich ausgelieferte Oberfläche prüfen. `npm run ui:verify` und der Vergleich
von `/version.json` gehören dazu. Bei Fehlern den vorbereiteten Rückweg anwenden;
bei inkompatiblen Daten nicht einfach alten Code starten. Erst nach erfolgreicher
Abnahme den normalen Schreibbetrieb wieder freigeben.

Lokal Quell- und Zielcommit, Integrationscommit, Sicherungsreferenz, Migrationen,
Prüfergebnisse und aktivierten Stand festhalten. Im Chat kurz sagen: aktualisiert,
nur vorbereitet oder blockiert; erhaltene Erweiterungen und offene Punkte nennen.
Eine Zielinstallation erst nach deren eigener Prüfung als aktualisiert melden.

## Für die Weiterentwicklung von Vanilla

Diese Regeln gelten bei jedem Weiterbau und jeder Veröffentlichung:

1. Module und gemeinsame Schnittstellen weiterverwenden. Bei Änderungen an
   Verhalten, Abhängigkeiten oder Datenhaltung Modulvertrag, Version und
   Migrationsregel im selben Auftrag pflegen. Breaking Changes, Voraussetzungen
   und Rückkehrgrenzen dokumentieren, auch bei übersprungenen Updates.
2. Neue Einrichtungsvorlagen dürfen vorhandene Firmeninhalte, Profile, Anmeldungen
   oder Verbindungen nicht zurücksetzen. Lokale Daten bleiben außerhalb von Git.
3. Relevante Funktionstests und bei Datenänderungen Migrationstests ergänzen.
   Vorhandene Datenschutz-, Modul-, Funktions- und Designprüfungen ausführen.
4. Den geprüften Quellstand veröffentlichen und die erfolgreichen GitHub-Prüfungen
   für diesen Commit kontrollieren. Erst dann als updatebereit melden.
   Feature-Branches und ungeprüfte Pushes sind keine Standardupdates.
5. README, AGENTS und dieser feste Link bleiben der Einstieg. Ändert sich der
   Übernahme- oder Betriebsweg, diesen Ablauf im selben Auftrag aktualisieren.

Diese Datei ist ein verbindlicher Ablauf für den beauftragten Agenten, kein
automatischer Fern-Updater und keine Garantie für beliebige fremde Änderungen.
Die Werkzeuge prüfen Code, Module und Build; fachliche Konflikte und tatsächliche
Wiederherstellbarkeit benötigen weiterhin Prüfung am Ziel.

Lokale parallele Bauaufträge können vor diesem Aktivierungsablauf die in
docs/CODE-SYNC.md beschriebene Quellübergabewarteschlange verwenden. Deren
Integrationsbeleg ersetzt weder die Zielabnahme noch die Live-Versionsprüfung.
