# Installationsbezogene Schlüsselablage

## Vertrag und Einrichtung

ProviderVault führt die bestehenden Anbieter-, App-Zugangs- und Backupwerte
zusammen. SQLite enthält Fernet-verschlüsselte Werte unter provider-vault/.
Node verwendet ausschließlich den authentisierten internen Kernanschluss;
öffentliche APIs, Metadatenlisten, Ereignisse und normale Datei-/Memoryexporte
geben weder Schutzschlüssel noch entschlüsselte Zugänge aus.

Beim ersten Speichern erzeugt Vanilla einen zufälligen Schutzschlüssel. Ein eigener
Eintrag in macOS Keychain beziehungsweise Linux Secret Service hält diesen Wert.
Sein Namensraum ist an den absoluten Tresorpfad und eine zufällige Kennung gebunden.
Es gibt keine Suche nach vorhandenen Konten, keinen globalen Profilimport und
keinen Klartext-Fallback. Die vorhandene native Worker-Anmeldung bleibt getrennt:
Ein frischer Kunde meldet Codex/Claude für diese Installation selbst an.

Die Abhängigkeit keyring wird vom bestehenden Systeminstaller mitinstalliert.
Vanilla instanziiert nur den zum Betriebssystem passenden nativen Backendtyp;
benutzerdefinierte Keyring-Plugins und Konfigurationsimporte werden nicht geladen.
Linux braucht einen verfügbaren Secret-Service-Dienst samt D-Bus-Sitzung. Die
Einrichtung dieses Betriebssystemdienstes ist eine Installationsvoraussetzung,
kein heimlicher App-Hintergrundprozess. Nicht unterstützte Plattformen oder
verweigerte OS-Zugriffe bleiben sichtbar nicht verfügbar.

Beim Neustart wird derselbe eigene Eintrag verwendet. Der Betriebssystembenutzer
muss angemeldet und sein Schlüsselspeicher erreichbar/entsperrt sein. Eine bereits
aktivierte App-Anmeldung startet bei fehlendem Schutzschlüssel nicht ungeschützt.
Ohne App-Anmeldung bleiben andere lokale Funktionen verfügbar, Schlüsselaktionen
melden den Fehler. Lesen, Ersetzen und Entfernen erzeugen bei fehlender Zuordnung
keinen Ersatzschlüssel. Statusabfragen lesen nur Metadaten und öffnen keine
Betriebssystemdialoge; configured bedeutet nicht aktuell entsperrt.

## Migration

Format 1 hatte provider.key als lokale Datei. Format 2 verwendet vault.json mit
Version und Kennung; der Schutzschlüssel liegt ausschließlich im eigenen OS-Eintrag.
SQLite-Ciphertexte behalten ihr Format. Es gibt keine stille Migration beim Lesen.

Vor der Quellaktivierung den bestehenden gesicherten Betriebsweg verwenden,
Kern und Adapter geordnet stoppen und in der betreffenden Installation ausführen:

```sh
.venv/bin/python -m core.vault_migrate
```

Der Befehl verwendet die konfigurierte Datenablage; `--data` erlaubt eine andere
Ablage innerhalb derselben Installation. Die bestehende Datenbanksperre verhindert
Migration bei aktivem Kern. Alle vorhandenen Ciphertexte werden zuerst gegen den
alten Schlüssel geprüft. Erst nach erfolgreichem Schreiben und Rücklesen im
OS-Speicher wird die neue Zuordnung atomar geschrieben und die alte Datei entfernt.
Ein Abbruch davor erhält den alten Schlüssel. Ein wiederholter Aufruf beendet eine
bereits begonnene Migration, ohne bestehende OS-Einträge zu überschreiben.
Ein beschädigter Bestand wird nicht neu initialisiert.

Nach erfolgreicher Migration kann alter Code nicht direkt mit dem neuen
Schlüsselformat starten. Ein Rückwechsel erfordert den vollständigen vorherigen
Datenstand oder eine geprüfte Wiederherstellung; kein isoliertes Code-Downgrade.
Ältere Backups und lokale Sicherheitskopien können noch die alte Schlüsseldatei
enthalten. Entfernen der aktiven Datei behauptet keine physische Datenlöschung.

## Sicherung und Gerätewechsel

Das bestehende verschlüsselte restic-Archiv enthält eine Wiederherstellungskopie
des Schutzschlüssels zusammen mit den passenden SQLite-Werten. Dazu wird der
Schlüssel ausschließlich im privaten Backup-Staging als provider.key abgelegt,
nach dem Sicherungslauf wird dieses Staging auch bei Fehlern entfernt. Ein
Prozessabbruch kann Staging zurücklassen; dieses liegt in der privaten Datenablage
und muss beim Wiederanlauf/bewussten Bereinigen beachtet werden. Keine Schlüssel
in Kommandozeilen, normalen Logs oder unverschlüsselten Quellarchiven ablegen.
Der restic-Wiederherstellungsschlüssel muss separat vom Gerät verwahrt werden.

Ein entpackter, geprüfter Restore enthält ebenfalls den Wiederherstellungsschlüssel
und ist daher sensibel. Vor dem Commit des bestehenden Restore-Journals übernimmt
Vanilla ihn in einen neuen eigenen OS-Eintrag am Ziel und entfernt die aktive
Klartextkopie. Schlägt die Übernahme fehl, erfolgt der bisherige Dateirückweg.
Vorherige OS-Einträge bleiben für den Rückweg bestehen. Verwaiste eigene Einträge
nach abgebrochener Einrichtung werden nicht durch eine globale Suche gelöscht.
Die geprüfte Restore-Vorbereitung und alte Sicherheitskopien folgen der bestehenden
Aufbewahrung; sie werden nicht als gewöhnliche Arbeitsdateien exportiert.

Ein bloß kopierter Datenordner oder Git-Clone übernimmt keine nutzbaren Konten.
Bei bewusstem Umzug ist der Restoreweg zu verwenden. Diese Trennung ist keine
Mandanten- oder Betriebssystem-Sandbox gegen andere Prozesse desselben berechtigten
Benutzers. Native Worker können weitergehende Dateirechte besitzen.

## Prüfung

core/tests/test_provider_vault.py prüft Persistenz, Installationsgrenzen,
fehlende/gesperrte Schlüssel, paralleles erstmaliges Speichern, Migration und
atomare Änderung der App-Anmeldung. Die bestehende restic-Prüfung in
test_operations.py stellt die Daten auf einem anderen Installationspfad wieder
her. test_mail.py prüft interne/öffentliche API-Grenzen, Verbindungstests prüfen
Ersetzen, Entfernen und Rücknahme bei Fehlern. Automatische Tests verwenden eine
explizite synthetische OS-Ablage; sie greifen nie auf Hostkonten zu. Eine echte
OS-Schreib-/Neustartprüfung ist zusätzlich pro Zielinstallation erforderlich.
