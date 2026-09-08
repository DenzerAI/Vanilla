# Workspace-Struktur und gemeinsamer Bootstrap

## Führende Ablagen

Die Installation enthält AGENTS.md, IDENTITY.md, knowledge/, workspaces/ und
system/. Neutrale Programmquellen liegen unter system/app/. Die kleinen
package-Dateien an der Wurzel reichen bestehende npm-Befehle weiter.

Jeder Workspace liegt direkt unter workspaces/<Anzeigename>/. Unicode,
Leerzeichen und deutsche Namen bleiben erhalten. Ordnernamen dürfen keine
Pfadtrenner, versteckten Namen oder auf unterstützten Dateisystemen reservierten
Namen enthalten. Namen sind auch ohne Groß-/Kleinschreibung eindeutig.

workspace.json enthält die stabile ID, den Namen, den relativen Pfad, Symbol,
Farbe und knowledge: eine Liste aus company und personal. IDs bleiben beim
Umbenennen erhalten. Bestehende API-/Datenbankfelder projectId und projects
bleiben als kompatible interne Kennungen bestehen. Die Oberfläche spricht
durchgehend von Workspaces. Neue Workspaces erhalten keine Wissensfreigabe
automatisch; die beiden Schalter im Workspace-Dialog setzen sie ausdrücklich.

input/ und output/ führen Arbeitsdateien. knowledge/ enthält eigene Quellen,
memory/ abgeleitete Erinnerungen. skills/ und jobs/ führen lokale Fähigkeiten
und Aufträge. Chat-Exporte bleiben unter chats/<ID>/ im zugehörigen Workspace.
Auftrags-IDs sind installationsweit eindeutig. Ihre Dateien liegen unter
jobs/<ID>/ im jeweiligen Workspace; der gemeinsame Index führt den Pfad mit.

## Identität und Wissen

IDENTITY.md an der Installationswurzel ist die einzige gepflegte Identität.
Der Profileditor und der gemeinsame Worker-Kontext lesen dieselbe Datei.
backend/worker-context.mjs liefert den Bootstrap bei jedem neuen Turn für
Codex und die ACP-Anschlüsse einschließlich Claude Code und Hermes. Die
native Engine bleibt austauschbar; native Gesprächsprotokolle sind weiterhin
an ihren jeweiligen Worker gebunden. Steering behält den Kontext des laufenden
Turns. Nach Wiederaufnahme erhält der nächste Turn wieder frische Quellen.

Der Bootstrap enthält die zentrale AGENTS.md, Identität, technischen Anschluss,
Workspace-Regeln, tatsächlichen Zielordner und freigegebene Wissenswurzeln.
Geschäftliche Angaben und Arbeitsweisen liegen unter knowledge/company/,
persönliche Quellen unter knowledge/personal/. Nur freigegebene gemeinsame
Bereiche fließen in die automatische Workspace-Suche und Kontextauswahl ein.
Die Freigabe steuert Kontext, keine Betriebssystemrechte eines frei gestarteten
Workers. Historische Erinnerungen werden nicht zu neuen Regeln erhoben.

## Migration

core/layout.py führt die einmalige Offline-Migration durch. Der Start lädt
zunächst die alte Konfiguration und übernimmt vorhandene Aufzeichnungen.
Eine exklusive Dateisperre verhindert den Umzug bei laufendem Python-Kern.
Alle Zielnamen werden vorab auf Konflikte geprüft. Die Datenbank wird über
die SQLite-Backup-API gesichert. Dateiumzüge werden vor jedem Schritt in
system/migrations/layout-v2/journal.json festgehalten; bestehende Zielinhalte
werden niemals ersetzt. Bei einem Fehler werden ausgeführte Umzüge rückgängig
gemacht. Ein unterbrochener Umzug wird mit `python -m core.layout rollback`
aus system/app/ bei gestoppten Diensten zurückgesetzt.

Der frühere default-Ordner wird zum benannten Workspace, seine projects/-Kinder
werden direkte Geschwister. Die vorhandene Identität zieht aus soul/ an die
Installationswurzel. brain/ wird memory/, notes/ wird knowledge/.
Die lokale Firmenbasis zieht nach knowledge/company/. Vorhandene Workspaces
behalten den bisherigen Firmenkontext; persönliches Wissen wird nicht ergänzt.

Die Betriebsdaten ziehen nach system/data/control/. Die lokale Datei
system/layout.json führt Version, Datenpfad, alte Pfadzuordnungen und die
frühere Workspace-Abbildung. Die Adapter erhalten die aufgelösten Pfade.
Programmcode verwendet getrennte Installations- und Quellwurzeln.

Gesprächs- und Auftragskennungen bleiben erhalten. Strukturierte Pfade in
Datensätzen werden angepasst; öffentlicher Nachrichtentext wird nicht
umgeschrieben. Suchindizes sind Ableitungen und werden neu aufgebaut.
Alte Links werden zuerst auf ihr neues Ziel aufgelöst und dann gegen dieselben
Pfadgrenzen geprüft. Eine alte Zuordnung erweitert keine Zugriffsrechte.
Bibliotheksfavoriten behalten ihre Kennungen. Umbenennen erfolgt ebenfalls
mit Sicherung und Journal und wartet auf ruhende Gespräche und Aufträge.

## Sicherung und Quellcode

Das Sicherungsformat agent-backup-v2 umfasst Workspaces, gemeinsames Wissen,
IDENTITY.md, Pfadzuordnungen, SQLite, lokale Wissenshistorie und vorhandene
Worker-Sitzungen. Programmcode und installierte Pakete werden nicht mit den
Arbeitsdateien vermischt. Restore ersetzt einzelne Inhaltswurzeln, niemals
den gesamten Installationsordner. Ein V1-Sicherungsstand wird vor Übernahme
in einer getrennten Ablage migriert und erneut geprüft. Da V1 das gemeinsame
Wissen nicht gesichert hat, bleibt dieses aus der aktuellen Installation
erhalten. Der ursprüngliche Sicherungsstand wird nicht verändert.

Identität, Wissen, Pfadzuordnungen und Betriebsdaten bleiben von Git
ausgeschlossen. Der Quellenprüfer prüft auch die umgezogenen Dateien unter
system/app/ mit denselben Inhalts-, Vorlagen- und Asset-Regeln. Alte Commits
bleiben prüfbar. Die Datenschutz- und Design-Hooks liegen an der Git-Wurzel.
