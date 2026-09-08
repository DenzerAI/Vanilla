# Vanilla

Eine gemeinsame Identität, lesbare Workspaces und lokales Wissen.

```text
Vanilla/
├── AGENTS.md          Gemeinsamer Einstieg für jeden Worker
├── IDENTITY.md        Name, Rolle und persönliche Wünsche
├── knowledge/
│   ├── company/       Geschäftliches Wissen
│   └── personal/      Persönliches Wissen
├── workspaces/
│   └── Allgemein/     Ein Workspace, ein Ordner mit demselben Namen
└── system/            Anwendung und technische Daten
```

Einrichtung: `npm run setup:system`. Start: `npm start`.
Python ab 3.12 und Node ab 22.12 werden benötigt. Die erste Einrichtung lädt
Abhängigkeiten und lokale Modelle herunter. Danach eigene Zugänge in der App
einrichten. Die Installation bleibt eigenständig; kein Konto wird mitgeliefert.

Workspaces werden in der App angelegt und umbenannt. Anzeigename und Ordnername
bleiben gleich; Chats und Aufträge behalten ihre festen Kennungen. Im
Workspace-Dialog wird gemeinsames Firmenwissen oder persönliches Wissen
ausdrücklich freigegeben. Eigene Unterlagen liegen in knowledge/, abgeleitete
Erinnerungen in memory/, Eingaben in input/ und Ergebnisse in output/.

Bestehende Installationen werden beim ersten kontrollierten Start umgestellt.
Während ein alter Dienst läuft, verweigert die Migration den Umzug. Alte
Dateiverweise bleiben über die lokale Pfadzuordnung auflösbar. Sicherungen und
Umzugsjournal liegen unter system/migrations/; sie werden nicht automatisch
gelöscht. Details: [Workspace-Struktur](system/app/docs/WORKSPACES.md).

Programmquellen, Paketlisten und Funktionstests liegen in system/app/.
Die kleinen package-Dateien im Hauptordner reichen Start- und
Einrichtungsbefehle weiter. Technischer Betrieb und Entwicklungswege stehen in
[system/app/README.md](system/app/README.md).
