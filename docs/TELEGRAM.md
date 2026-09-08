# Telegram-Nutzerliste und offene Gateway-Frage

**Entscheidung offen:** Hermes wird durch diesen Auftrag nicht angebunden. Es wird
kein Gateway konfiguriert, kein Empfang aktiviert und kein Bot übernommen. Die
folgenden Anschlusswege beschreiben Möglichkeiten für die gemeinsame Besprechung.

## Vorhandener direkter Anschluss

Telegram → ChannelRuntime → gemeinsamer Chat-/Kontextpfad → gewählter Worker
(zum Beispiel Hermes über `hermes acp`) → Antwort an Telegram.

Die Schaltzentrale ist bei diesem Weg der einzige Telegram-Empfänger. Sie benötigt
Bot-Token, einzeln freigegebene Nutzer und einen eingerichteten Worker. Speichern,
Zugang prüfen und Empfang starten bleiben getrennte Schritte. Der Token gehört in
die Schlüsselverwaltung; die neutrale Basis sperrt den System-Schlüsselbund.
Ein produktiver eigener Tresor ist Voraussetzung für echte Zugangsdaten.

„Systemstandard verwenden“ übernimmt die zentrale Workerwahl bei neuen Gesprächen;
bestehende Gespräche behalten ihren Worker. `/new` beginnt ein neues Gespräch.
Gespräche sind nach Anschluss, Telegram-Chat und Absender getrennt. Manuell gepflegte
Namen dienen ausschließlich der Anzeige. Weder Namen noch Telegram-Usernames
können eine nicht freigegebene ID berechtigen.

`wrapper/server.mjs` legt Kanalchats im ausgewählten Projekt an und verwendet
anschließend denselben `sendTurn` wie Browserchats. Vor jedem neuen Turn werden
Firmenbasis, Identität und Arbeitsanweisungen gelesen. `routedContext` fragt die
Wissenssuche des Python-Kerns mit Projekt-ID und aktueller Nachricht ab. Hermes
bekommt zusätzlich den vorhandenen `shared_memory`-MCP für das Projekt, sofern
Kern und Python-Anschluss konfiguriert sind. Wissen wird nicht in einen zweiten
Hermes-Wissensordner kopiert. Ohne Kern gibt es keine automatische Wissenssuche.

Das ist gemeinsames Wissen, kein automatisch geteilter Gesprächsverlauf. Die
normale Chatliste blendet Kanalgespräche derzeit aus; sie sind im Anschlussdialog
erreichbar. Die Auswahl eines Projekts ist zudem keine Betriebssystem-Sandbox:
Werkzeug-, Dateisystem- und Netzwerkrechte müssen gesondert begrenzt werden.

## Bereits laufendes Hermes-Gateway

Ein bereits an Hermes gebundener Telegram-Bot bleibt bei genau einem Empfänger.
Kein paralleles `getUpdates` mit demselben Bot und keine automatische Übernahme
oder Änderung einer fremden Gateway-Konfiguration.

Hermes bietet ACP, einen TUI-Gateway und eine HTTP-API an. ACP steuert denselben
Agentenkern, hängt sich aber nicht automatisch an die laufende Telegram-Session
eines unabhängigen Gateway-Prozesses. Ein Gateway-URL-Eintrag allein synchronisiert
weder Wissen noch Projekte, Identitäten oder Gespräche.

Der vorhandene A2A-Client unter Verbindungen kann einen bestehenden Hermes-A2A-
Dienst prüfen und einzelne Aufgaben senden/abfragen. Er ist **kein** vollständiger
Gateway-Worker für den normalen Chat und reicht dort auch nicht automatisch den
Vanilla-Kontext durch. Ein eigener HTTP-/Gateway-Worker benötigt noch explizite
Zuordnung von authentifiziertem Nutzer, Projekt und Session, frische Kontextübergabe,
Antwortstream, Abbruch, Freigaben und Wiederaufnahme. Externe Clients dürfen Projekt-
oder Session-IDs nicht selbst beliebig auswählen und dadurch fremdes Wissen lesen.
Vor einer solchen Anbindung sind Zieladresse, unterstütztes Protokoll und gewünschter
Wissensumfang zu bestimmen. Bestehende Hermes-Zugänge werden nicht verändert.

Welcher Anschlussweg künftig verwendet wird, ist noch nicht entschieden. Ein
bestehendes Hermes-Gateway und der direkte Empfang in Vanilla sind getrennte
Varianten; durch die neue Nutzerliste wird keine davon aktiviert.

## Noch abzusichern und live abzunehmen

- Bot-Token im tatsächlich verfügbaren lokalen Tresor sowie echte Nutzer-IDs.
- Ein echter privater Telegram-Dialog mit Wissensfrage, Antwort und Fortsetzung.
- Modellzugang des gewählten Workers; allein die Installation genügt nicht.
- Empfang nach Neustart: derzeit bewusst gestoppt, kein automatischer Wiederanlauf.
- Sichtprüfung der Nutzerliste auf Desktop und Handy.
- Harte Trennung von normalen Aufträgen und App-Entwicklung sowie getesteter Restore.

Quellen, abgeglichen am 8. September 2026:
[Hermes-Schnittstellen](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration),
[Hermes A2A](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/a2a),
[Telegram-Bot-API](https://core.telegram.org/bots/api).
