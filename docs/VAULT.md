# Lokale Zugangsverwaltung in .env

## Vertrag und Einrichtung

Vanilla speichert Anbieterzugänge, eigene App-Anmeldung und Backup-Passwörter in
`.env` direkt im Installationsordner. Bestehende Verbindungsformulare und die
Secret-Liste bleiben der Eingabeweg. Die Datei wird erst beim Speichern angelegt,
atomar ersetzt und erhält Rechte 0600. Ein OS-Schlüsselbund ist für neue Zugänge
nicht nötig. Die Datei enthält lesbare Zugangswerte; ein versteckter Dateiname
ist keine Verschlüsselung. Wer den Ordner lesen kann, kann diese Zugänge lesen.

`ELEVENLABS_API_KEY` und `GROQ_API_KEY` sind benannte Variablen. Weitere Secret-IDs
werden verlustfrei als `VANILLA_SECRET_` plus großgeschriebene UTF-8-Hexkennung
abgebildet. Werte werden als JSON-quotierte Strings in einer Zeile gespeichert,
auch bei JSON-Bündeln oder mehrzeiligen Werten. Der Parser unterstützt außerdem
unquotierte Werte, einfache Quotes, Kommentare und export-Präfixe. Doppelte
Variablen, ungültige Zeilen und Symlinks werden abgewiesen; bestehende fremde
Variablen und Kommentare bleiben beim Bearbeiten erhalten. Dollarzeichen und
Shell-Ausdrücke werden nie ausgeführt oder expandiert.

SQLite hält nur Secret-Referenzen `{storage:"env",key:...}`. Die interne Kern-API
liefert Werte ausschließlich an den authentisierten Adapter. Öffentliche APIs,
Browserzustand, Ereignisse und normale Datei-/Memoryexporte geben keine Zugänge
aus. `.env` wird nicht global in Prozessumgebungen geladen und nicht automatisch
an Worker weitergereicht. Änderungen sind über die bestehende Installationssperre
serialisiert. Fehler beim Schreiben von Datenbank oder App-Anmeldung stellen den
vorherigen Dateiinhalt wieder her.

Die Datei bleibt durch .gitignore und die Quellprüfung ausgeschlossen. Codeupdates
dürfen sie nicht ersetzen. Die neutrale `.env.example` enthält nur leere Felder.

## Migration und Rückweg

Alte verschlüsselte SQLite-Einträge bleiben bis zur Migration mit ihrem bisherigen
lokalen Schlüssel beziehungsweise eigenen OS-Eintrag lesbar. Neue Schreibvorgänge
verlangen zuerst die vollständige Migration, damit keine gemischten Bestände
entstehen. Im geordnet gestoppten Installationsordner ausführen:

```sh
.venv/bin/python -m core.vault_migrate
```

Alle alten Zugänge werden vor der ersten Änderung entschlüsselt und geprüft.
Widersprüche mit bereits vorhandenen .env-Werten brechen unverändert ab. Erst
danach werden .env und Datenbankreferenzen geschrieben. Wiederholung ist ohne
weitere Änderung möglich. Der OS-Zugriff ist nur für diese einmalige Übernahme
alter OS-verschlüsselter Werte nötig. Fehlende alte Schlüssel werden nicht ersetzt.
Alte Tresordateien und OS-Einträge bleiben für einen bewussten Rückweg erhalten.
Eine Rückkehr zu altem Code braucht den vollständigen vorherigen Datenstand;
ENV-Referenzen sind für alte Versionen nicht lesbar.

## Sicherung und Gerätewechsel

Sicherungsschema 5 nimmt die gesamte .env als `provider-vault/credentials.env`
in das private Staging des verschlüsselten restic-Archivs auf. Normaler Export
und Quellveröffentlichung enthalten sie weiterhin nicht. Restore prüft alle
Referenzen gegen diese Datei und tauscht .env gemeinsam mit Datenbank und anderen
Daten über das bestehende Rückkehrjournal. Ältere Sicherungsschemata 2 bis 4 werden
vor dem Austausch anhand ihres mitgesicherten Schlüssels umgewandelt, ohne einen
neuen OS-Eintrag anzulegen. Fehler rollen auch die bisherige .env zurück.
Staging und bewusste Rückkehrkopien enthalten Geheimnisse und bleiben privat.

Eine vollständige, konsistente Kopie des gestoppten Vanilla-Ordners einschließlich
versteckter .env, data und workspaces nimmt die gespeicherten Anbieterzugänge mit.
Für laufende Installationen ist der Sicherungsweg zu verwenden. Auf dem Zielhost
bleiben Einrichtung der Laufzeiten/Modelle, passende Betriebssystemversion,
Dienststart und Prüfung der Pfade erforderlich. Native Codex-/Claude-Anmeldungen,
Gerätefreigaben und außerhalb dieses Ordners liegende Dateien sind kein Bestandteil
dieser Zusage und können eine neue Anmeldung verlangen. .env ist keine Garantie,
dass eine komplette Anwendung ohne Einrichtung auf jeder Plattform startet.

## Prüfung

Die Tests prüfen Dateirechte, Persistenz, Kopieren auf einen anderen Pfad ohne
OS-Speicher, Sonderzeichen, Kommentare, Aliasvariablen, Schreibfehler, Parallelität,
Symlinks, vollständige Migration, Konflikte und atomare Rücknahme der App-Anmeldung.
Sicherungsprüfungen decken ENV-Referenzen und Wiederherstellung ab; Updateprüfungen
erhalten eine vorhandene .env unverändert. Fremde Hostkonten werden nicht gelesen.
