# Gemeinsame Quellen und Auftragskontext

## Führende Quellen

- `UWE_WORKSPACE/soul/IDENTITY.md` führt Namen, Rolle und persönliche Wünsche.
  Ohne `UWE_WORKSPACE` verwendet die Anwendung `workspaces/default`. Der
  Profileditor und die Worker lesen dieselbe Datei. Bei fehlenden oder leeren
  persönlichen Wünschen verwenden beide den gleichen Initialstandard aus
  `wrapper/identity-preferences.mjs`; gespeicherte Wünsche verdrängen ihn.
- `COMPANY_BASE/AGENTS.md` führt die fachliche Landkarte; `FIRMA.md` und dort
  verlinkte Quellen führen verbindliches Firmenwissen. Standard: `firmenbasis/`.
  Dieser Ordner ist lokal und vollständig von Git ausgeschlossen. Die neutrale
  Erstvorlage unter `templates/firmenbasis/` wird nur beim Einrichten einer neuen
  Installation kopiert. Bestehende Inhalte werden bei Updates nicht überschrieben.
- `SYSTEM_BASE/WORKER.md` beschreibt den technischen Anschluss; Standard:
  `system/`. Lokale `AGENTS.md` ergänzen den konkreten Arbeitsbereich.
- `jobs/<id>/SKILL.md` führt den Jobinhalt, `job.yaml` die Ausführungseinstellungen.
  SQLite enthält den daraus abgeleiteten Jobindex. Weitere Ressourcen bleiben
  beim Job. Fähigkeiten unter `skills/` und firmenweite Arbeitsweisen müssen
  dafür nicht verschoben oder pro Anbieter dupliziert werden.

## Übergabe

`wrapper/server.mjs` übergibt bei jedem neuen Turn frisch gelesene Quellen aus
`backend/worker-context.mjs`: Firmenregeln, Firmenwissen, technischer Einstieg,
Identität und Workspace-Regeln mit Herkunftspfaden. Beim bloßen Anlegen des
Threads wird dieser Block nicht zusätzlich als dauerhafte Kopie gesetzt.
Ein Resume lädt die native Sitzung; die nächste Nachricht erhält wieder den
aktuellen Block. Steering in einem laufenden Turn übergibt nur die neue
Nutzernachricht, da das native Protokoll dort keinen Kontextwechsel vorsieht.

Codex erhält den Block in `collaborationMode.settings.developer_instructions`.
ACP erhält ihn als Textblock vor der Nachricht (bei Slash-Kommandos dahinter);
ACP bietet dafür keine eigene Developer-Rolle. Im gemeinsamen Gesprächsexport
bleibt die Nutzernachricht separat. Titelgenerierung ist ein eigener enger
Hilfsauftrag ohne Firmenkontext. Native Systemprompts, Werkzeuge, Plugin- und
Skillkataloge kommen zusätzlich vom gewählten Worker.

Ein Job startet im Jobordner und erhält die frisch aus `SKILL.md` gelesene
Anweisung einmal inline. Referenzen und benötigte Eingaben werden danach
gezielt gelesen. n8n erhält dieselbe Anweisung als Webhook-Nutzlast. Python
führt das im Manifest konfigurierte Skript mit JSON-Eingabe aus; Markdown ist
hier die Beschreibung, kein Modellprompt.

## Gedächtnis und Bedarfskontext

Der Kern indexiert `notes/`, `brain/`, `input/`, `output/` des jeweiligen
Projekts. SQLite-FTS, Wortindex und Embeddings sind Suchhilfen. Vor der Übergabe
liest `Knowledge.context` die Quelldatei erneut; gelöschte oder geänderte
Indexinhalte werden nicht ungeprüft übergeben. Standardmäßig kommen bis zu
sechs Fundstellen mit insgesamt höchstens 8.000 Textzeichen hinzu, als Daten
mit Pfad, Version, Fundmethode und Offset. Andere Projektbereiche bleiben
getrennt; `notes/shared/` ist eine ausdrückliche Freigabeoption.

Automatische Notizen unter `brain/daily/`, Ergebniszusammenstellungen und
Fortsetzungsnotizen sind Ableitungen aus Gesprächsquellen. Sie verändern
`FIRMA.md` oder die Identität nicht. SQLite-Nachrichten und Dateiexporte bilden
Verlauf ab; die native Sitzung führt die Modellfortsetzung. Ein Export erlaubt
keinen beliebigen Wechsel des Workers mitten in einer Sitzung.

Der gemeinsame Memory-MCP verbindet Codex und unterstützte ACP-Worker mit dem
Kern. OpenClaw akzeptiert hier keinen pro Sitzung konfigurierten MCP; die
automatische Kontextauswahl wird trotzdem im Prompt geliefert. Native
Worker-Heimatordner sind keine synchronisierten Kopien der Firmenbasis:
Codex isoliert Sitzungsdaten, übernimmt jedoch Anmeldung, Konfiguration und
Erweiterungen aus dem bestehenden Benutzerkonto. ACP erbt die Prozessumgebung.
Eigenständiges natives Memory muss deshalb je Anschluss geprüft werden;
der Wrapper behauptet keine globale Deaktivierung und verändert keine fremden
Gateway-Konfigurationen.

## Separater Order-Dienst

`backend/server.mjs` ist der ältere, separat gestartete Order-Dienst, nicht
der normale Wrapper-Jobpfad. Sein Bootstrap liest jetzt dieselbe konfigurierte
Workspace-Identität. Das Protokoll bleibt Version 2: bestehende `brain`-Inhalte,
letzte 100 Learnings und Personenverzeichnis bleiben im Bootstrap enthalten.
Diese Daten stammen aus dem getrennten Order-Datenspeicher; sie werden nicht
still in das Wrapper-Memory übernommen. Eine Umstellung dieses externen
Protokolls auf reinen Bedarfskontext braucht eine versionierte Migration seiner
Verbraucher. Die Firmen-Workflows werden schon heute nur als Referenzen geliefert
und über den authentisierten Firmenbasis-Endpunkt geladen.
