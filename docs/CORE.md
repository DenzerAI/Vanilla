# Architektur und Betrieb

Der integrierte Betriebsstand ist in [OPERATIONS.md](OPERATIONS.md) dokumentiert.
Quellen und Lesewege beschreibt [CONTEXT.md](CONTEXT.md).

## Verantwortung

Die Anwendung hat einen öffentlichen Einstieg: FastAPI auf Port 1989. SQLite
verwaltet Anwendungszustand, Chats und Nachrichten, Projekte, indexierte
Jobdefinitionen, Ausführungen, lokale Suchindizes, Verknüpfungen,
Kontextnachweise und Anmeldesitzungen. Der Python-Kern besitzt eine exklusive
Prozesssperre pro Datenbank; SQLite verwendet WAL und kurze Schreibtransaktionen.

Der Node-Prozess auf Port 1990 ist ein interner Adapter für die bestehenden
Codex-/ACP-Protokolle, Dienstanschlüsse, macOS-Schlüsselbund und Sprachfunktionen.
Er akzeptiert im Kernbetrieb nur ein beim Start übergebenes internes Geheimnis.
Dieses Geheimnis geht niemals an den Browser. Der Kern leitet API-Anfragen und
Live-Ereignisse weiter; native Modellgespräche bleiben beim jeweiligen Worker.
Dadurch müssen funktionierende Anbieterprotokolle nicht neu implementiert werden.

Das separate alte Order-System unter backend/server.mjs ist nur noch über
`npm run start:order` startbar. Seine alten WhatsApp-/HERO-Endpunkte auf Port 8787
sind keine Python-Endpunkte. Für neue Arbeiten ist die Schaltzentrale mit den
vorhandenen Verbindungen, Chats und Jobs der Einstieg. Die Daten des alten
Order-Dienstes werden nicht still mit den Wrapper-Daten vermischt.

## Führende Ablagen

| Inhalt | Führende Quelle |
| --- | --- |
| Chatliste, Einstellungen, Verbindungen und Workerwahl | SQLite records; Chats/Projekte zusätzlich relational abfragbar |
| Öffentliche Nachrichten und Ergebnisse | SQLite messages; native Worker-Sitzung für die eigentliche Modellfortsetzung |
| Personen, Firmen und Vorgänge | SQLite CRM-Fakten mit Herkunft; [CRM-Vertrag](CRM.md), Ansichten und Anbindungen sind davon getrennt |
| Wissen | UTF-8-Markdown/Text; SQLite-Suche ist daraus wiederaufbaubar |
| Jobbeschreibung und Zeitplan | jobs/*/SKILL.md und job.yaml; SQLite jobs ist deren Abfrageindex |
| Reservierung, Laufstatus und Abschluss | SQLite executions und events |
| Werkzeuge, native Sessions, Audio, Anhänge | bestehende Dateiformate und Adapter |
| Zugangsschlüssel | vorhandener Schlüsselbund, keine neue Klartextkopie |

Beim ersten Start übernimmt der Kern die bekannten bisherigen JSON-Datensätze.
Jeder Datensatz wird nur importiert, solange er noch nicht in SQLite existiert.
Originaldateien bleiben erhalten; spätere Änderungen an einer alten state.json
werden nicht mit dem aktiven Datenbankstand vermischt. Gesprächsexporte als
JSON/Markdown und die Job-Laufbelege bleiben verfügbar. Ein Protokollexport
garantiert keine Fortsetzung einer Codex-Sitzung in einem anderen Worker.

## Suche und Kontext

Der Dateiindex liest ausschließlich Markdown-/Textdateien bis 2 MB in den
freigegebenen Wissensordnern. Versteckte Dateien, Schlüsselablagen und Symlinks
werden ausgeschlossen. PDF-/Office-Dateien bleiben in der vorhandenen
Dateivorschau verfügbar; ihre Textextraktion für den Wissensindex ist ein späterer
separater Schritt. Externe Dateiänderungen werden spätestens beim nächsten
Indexlauf (alle 30 Sekunden) erfasst; „Aktualisieren“ stößt ihn sofort an.

FTS5 findet Wörter; RapidFuzz ergänzt ähnliche Titel und Schreibweisen aus dem
Wortindex. Lokale Embeddings ergänzen die Rangfolge über gespeicherte Textstücke.
Die Vektoren liegen in SQLite; eine zusätzliche Vektordatenbank ist nicht nötig.
Die erste Ausführung verwendet eine exakte lokale Vektorsuche, keinen ANN-Index.
Für sehr große Bestände muss die Suchzeit gemessen und ein spezialisierter Index
nachgerüstet werden. Ein verändertes Dokument verliert seine alten Vektoren.

Modellinhalt, Textversion, Sortierung und Quellen werden nachvollziehbar erfasst.
Semantische Ähnlichkeit ersetzt keine exakte SQL-Abfrage. Der Router begrenzt
Fundstellen auf das aktive Projekt und normalerweise 8.000 Zeichen; er liest
Dateien vor der Übergabe erneut und kennzeichnet sie als Daten, nicht als
Arbeitsanweisungen. Firmenbasis, Identität und Systemregeln werden weiterhin
über den bestehenden gemeinsamen Einstieg geladen. Das ist keine Sandbox für
alle Werkzeuge eines Workers.

## Auftragsausführung

Manuelle Starts und Zeitpläne erzeugen SQLite-Läufe. Pro Job kann nur ein Lauf
wartend/in Übergabe/laufend sein. Die Reservierung erfolgt in einer Transaktion.
Ein schneller Worker darf vor Rückkehr des Startaufrufs fertig werden; der
Abschluss bleibt trotzdem erhalten. Fehlende Worker führen zu einem sichtbaren
Fehler und lösen keine stille Wiederholung aus.

Nach einem Neustart bleiben wartende Aufträge erhalten. Bereits übergebene
Aufträge werden als unterbrochen markiert, weil externe Wirkungen unbekannt sein
können. Die manuelle erneute Ausführung erstellt einen neuen Lauf. Tägliche und
werktägliche Zeitpläne verwenden `AGENT_TIMEZONE` (Standard Europe/Berlin) und
holen höchstens den heute fälligen Termin nach. Zeitplan-Slots sind eindeutig
gespeichert. Unlesbares YAML macht nur den betroffenen Job ungültig.

LLM-Worker bleiben der normale Ausführungsweg. Fachliche Abläufe können über den integrierten Python-Prozessrunner
gezielt deterministisch ausgeführt werden. Ein lokales Embedding-Modell
ist keine frei arbeitende lokale Agenten-Engine.

## Mobil und Anmeldung

Die React-Anwendung passt sich schmalen Fenstern an, besitzt ein Web-App-Manifest
und einen Service Worker mit Netzwerkzugriff ohne privaten Cache. Sie lässt sich
über unterstützte Browser zum Home-Bildschirm hinzufügen. Echte Offline-Bearbeitung
mit späterer Synchronisation ist nicht implementiert. Datenbank, Modelle und
Worker laufen auf dem eigenen eingeschalteten Rechner.

Standard ist Loopback. Die Einstellungen verbinden Anmeldung und Tailscale Serve.
Alternativ werden für einen privaten HTTPS-Zugang über einen bestehenden
Reverse Proxy werden `AGENT_ACCESS_TOKEN` (mindestens 32 zufällige Zeichen) und
`AGENT_PUBLIC_ORIGIN=https://…` im Dienstumfeld gesetzt. Der Proxy muss Host/Origin
erhalten und SSE ohne Pufferung weiterreichen. Er zeigt auf 127.0.0.1:1989;
Port 1990 bleibt privat. Keine Zugangscodes in Git, URLs oder Logs schreiben.
Der Server liest .env-Dateien nicht selbstständig; Variablen werden vom Launcher
oder der Schlüsselverwaltung übergeben.

Mit gesetztem Zugangscode benötigen auch Lesezugriffe, Dateidownloads und
Eventstreams eine Anmeldung. Browser verwenden eine HttpOnly-/SameSite-Sitzung,
bei konfiguriertem HTTPS mit Secure-Cookie. Schreibzugriffe benötigen zusätzlich
das Sitzungstoken. Anmeldeversuche werden pro direkter Client-IP begrenzt.
Dies ist ein persönlicher Arbeitsbereich mit einem Zugang, keine Benutzer- oder
Mandantenverwaltung. Ein fremder Rechner erhält dadurch keine eigenen Rechteprofile.

## Abfragen, Sicherung und Wiederherstellung

SQLite bleibt eine lokale Datei hinter dem Server, keine freigegebene Netzwerkdatei.
Read-only-Abfragen beispielsweise über Python oder die sqlite3-CLI:

```sql
SELECT id, title, worker_id FROM chats WHERE archived = 0;
SELECT id, job_id, status, error FROM executions ORDER BY created_at DESC;
SELECT chat_id, role, content FROM messages WHERE chat_id = ?;
SELECT source, target FROM links ORDER BY source, target;
SELECT id, project_id, sources FROM context_routes ORDER BY created_at DESC;
```

Die integrierte Sicherungsfunktion verwendet restic und die SQLite-Backup-API;
siehe OPERATIONS.md. Bei manuellen Sicherungen ebenfalls die SQLite-Backup-API
verwenden (nicht nur die Hauptdatei aus
einem laufenden WAL-Betrieb kopieren) und zusätzlich den Workspace sowie die
benötigten nativen Worker-Sitzungen sichern. Beispiel während des Betriebs:

```sh
.venv/bin/python -c "import sqlite3; s=sqlite3.connect('file:data/control/agent.sqlite3?mode=ro',uri=True); d=sqlite3.connect('agent-backup.sqlite3'); s.backup(d); d.close(); s.close()"
```

Wiederherstellung nur bei gestopptem Kern und Adapter; zusammengehörige
Datenbank/Workspace-Sicherung verwenden. Ein zweiter Kern verweigert denselben
Datenbankpfad. Die alten JSON-Dateien sind eine Übernahmequelle für den ersten
Start, keine automatisch aktuelle Rückfallsicherung.

## Codevorlage und Prüfstand

Die Git-Auslieferung enthält Quellcode, Abhängigkeits-Locks, Design-Tokens,
Bereichsverträge und lizenzierte UI-Assets. Workspace, Datenbank, Modellgewichte,
Sitzungen, Schlüssel und lokale Testausgaben sind ausgeschlossen. Ein frischer
Clone benötigt die dokumentierte Installation; bestehende Code-Komponenten
werden übernommen und nicht durch einen Prompt rekonstruiert.

Auch `firmenbasis/` bleibt ausschließlich lokal. In Git liegen nur exakt
geprüfte neutrale Vorlagen. Der Quellenprüfer kontrolliert Index, Commit-Verlauf
und eingehende Merge-Bäume; der geschützte Übernahmebefehl erhält vorhandenes
Firmenwissen. Ablauf und Grenzen stehen in [CODE-SYNC.md](CODE-SYNC.md).

Python-Tests prüfen Datenübernahme, abfragbare Nachrichten, Suche, Verweise,
Pfadgrenzen, Versionskonflikte, Reservierungen, Zeitpläne und Anmeldung. Ein
Integrationstest startet den echten Python- und Node-Prozess mit einem lokalen
ACP-Testworker und prüft Chat, Kontext, Jobabschluss und Fortsetzen nach Neustart.
Vorhandene Node-Tests, TypeScript-Prüfung und Vite-Produktionsbuild bleiben Teil
der Prüfung. Echte Dienstzugänge und ein physisches Handy sind separate
Betriebsprüfungen; der Umbau führt keine Testnachrichten an externe Empfänger aus.


## Strukturierte Kundendaten

Der [CRM-Kern](CRM.md) erweitert die vorhandene Datenbank additiv. Seine geprüften Schreibwege unterscheiden Rohsignal, Vorschlag und Fakt und halten ältere Feldwerte als Historie. `memory_context` ergänzt erkannte CRM-Kandidaten mit frisch gelesenen, versionsgebundenen Daten innerhalb des bisherigen Zeichenbudgets. Empfangs-/Prüflücken bleiben sichtbar. Die eigentliche Pipeline und externe Datenabgleiche sind separate Verbraucher; ihre UI-Studie ist noch nicht produktiv angebunden.


Die lokale Bedeutungssuche und ihr Reparatur-/Installationsvertrag stehen in
[OPERATIONS.md#lokale-suche](OPERATIONS.md#lokale-suche). Modellbereitschaft folgt
einer erfolgreichen lokalen Berechnung; Textpassagen beachten das Tokenlimit.
Vektoren mit alter Modell-/Passagenidentität werden aus den Originalen neu aufgebaut.

Die Quellwartung verarbeitet ausdrücklich fertige Übergaben auch während anderer
Chats; der Integrationslock schützt den Quellstand. Betriebspausen bleiben wirksam.
Veröffentlichungsfehler und bestätigte Live-Versionen verwenden die vorhandenen
Systemmitteilungen; Veröffentlichungsstatus bleibt getrennt vom Integrationsstatus.
