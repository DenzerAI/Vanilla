# Code zwischen Installationen austauschen

Für „Update + Link“ führt [UPDATE.md](../UPDATE.md) durch den vollständigen Ablauf
einschließlich Sicherung, Versionsauswahl, eigener Erweiterungen und Aktivierung.
Dieses Dokument beschreibt die technische Quellübernahme als Teil davon.
`UPDATE.md` ist ausdrücklich zugelassene neutrale Dokumentation im Projektstamm;
die Inhalts- und Historienprüfungen gelten auch für diese Datei unverändert.

Jede Installation behält ihre Firma, Identität, Chats, Arbeitsdateien,
Verbindungen und Anbieteranmeldung. Git transportiert Anwendungsquellen,
neutrale Dokumentation, Abhängigkeitslisten und geprüfte UI-Assets.
Ein gemeinsamer Quellstand verbindet keine Konten und überträgt keine Logins.

## Einmal pro Clone

```sh
npm run source:setup
```

Der Befehl aktiviert die vorhandenen Git-Hooks, einschließlich Datenschutzprüfung,
und richtet `firmenbasis/` aus `templates/firmenbasis/` ein, sofern der lokale
Ordner noch nicht existiert. `npm ci` aktiviert die Hooks über `prepare` ebenfalls;
bei `--ignore-scripts` muss `source:setup` danach ausdrücklich laufen.
Ein fremder Hook-Pfad wird nicht überschrieben. Er muss bewusst mit den
Datenschutz- und Design-Hooks zusammengeführt werden.

`firmenbasis/` ist vollständig ausgeschlossen, auch alle Firmen-Arbeitsweisen.
Bestehende Firmenbasen werden nur gelesen und auf Vollständigkeit geprüft.
Ein explizit gesetztes `COMPANY_BASE` muss innerhalb dieser Installation liegen,
von Git ausgeschlossen und bereits vollständig eingerichtet sein. Ein fehlender
konfigurierter Ordner wird nicht durch eine neutrale Firma ersetzt.
Vorlagen sind mit geprüften SHA-256-Werten in `system/source-policy.json` gebunden;
sie sind kein Editor für die tatsächliche Firma.

## Entwicklung auf zwei Rechnern

Auf beiden Rechnern einen eigenen Entwicklungsclone desselben Vanilla-Repositories
verwenden. Am zweiten Rechner in diesem Clone arbeiten, nicht im Quellrepository
der fremden Firmenanwendung. UI und Funktionen in eigenen Feature-Branches ändern,
prüfen, committen und den konkreten Branch pushen. Jeder Worker verwendet weiterhin
den vor Ort eingerichteten Anbieterzugang. Git überträgt diesen Zugang nicht.

Vor dem Weiterarbeiten die Änderungen der anderen Seite holen und geprüft mergen:

```sh
git fetch origin
npm run source:merge -- origin/BRANCH
```

Der Befehl prüft beide Commit-Verläufe sowie den vorher berechneten gemeinsamen
Quellbaum. Erst danach beginnt der Merge. Vorgemerkte oder ungesicherte
Codeänderungen, fremde laufende Git-Operationen und Konflikte stoppen den Ablauf.
Die vorhandenen Commit-Hooks prüfen den endgültigen Index und bei UI-Änderungen
auch das Design. Fehlgeschlagene Prüfungen brechen den eigenen Merge ab.
Bei einer linearen Aktualisierung bleibt die exakte eingehende Commit-ID erhalten;
auseinander entwickelte Zweige erhalten einen regulären Merge-Commit.
Es gibt keinen automatischen Push, Dienstneustart oder Wechsel des Anbieterkontos.

Für eine reine Vorprüfung:

```sh
npm run source:merge -- origin/BRANCH --check
```

Fast-forward-Updates haben keinen Git-Vorab-Hook. Deshalb für fremde Änderungen
den Übernahmebefehl verwenden; ein direktes `git pull`, `reset` oder `checkout`
bietet diese Prüfung vor der Dateiersetzung nicht. Die laufende Runtime erhält
anschließend den freigegebenen Quellcommit und den passenden Build über ihren
eigenen Betriebsweg. Nicht in einer laufenden Runtime entwickeln oder ungeprüfte
Zweige mergen. Eine geprüfte Quellübernahme ersetzt keinen geregelten Neustart.

## Eigenes Firmenrepository

Der Abschnitt zur Entwicklung auf zwei Rechnern beschreibt gemeinsame Vanilla-
Entwicklung. Eine eigenständig weiterentwickelte Firmenversion behält dagegen
ihr eigenes Repository als `origin`. Vanilla wird als zusätzliche geprüfte Quelle
angebunden, gewöhnlich `upstream`. Remotes vor Änderungen prüfen; bestehende
Zuordnungen nicht überschreiben. Nach dem Fetch die gewünschte Commit-ID festhalten.
Die oben beschriebenen `source:merge`-Prüfungen gelten auch für diesen Commit.

Im separaten Entwicklungsclone vom gesicherten Firmenstand ausgehen und einen
Update-Zweig verwenden. Den kombinierten Commit prüfen und über den eigenen
Betriebsweg ausliefern. Die laufende Firmenversion muss nicht dieselbe Commit-ID
wie Vanilla haben. Fehlende gemeinsame Historie, vertrauliche Inhalte in der
Historie und Konflikte nach UPDATE.md behandeln; keine erzwungene Übernahme.

## Erstwechsel von den früheren Firmenvorlagen

Die frühere Version hatte `firmenbasis/` noch in Git. Der neue Übernahmebefehl
sichert diese lokalen Dateien vor dem Merge in `.verify/source-sync/`, entfernt
die alten Vorlagen aus dem Quellbaum und stellt die ursprünglichen lokalen
Inhalte wieder her. Das schließt noch nicht committete Änderungen an diesen
Firmendateien ein. Auf Erfolg wie auf Abbruch bleiben die Daten erhalten;
bei gleichzeitiger fremder Bearbeitung stoppt die Wiederherstellung, statt sie
zu überschreiben. Die lokale Sicherung bleibt zur Wiederherstellung liegen.

Für diese erste Übernahme ist das neue Skript im alten Checkout noch nicht da.
Der Operator führt `scripts/source-sync.py` aus einer bereits geprüften neuen
Codekopie mit `--root` auf den alten Entwicklungsclone aus. Nicht zuerst blind
die alten Firmenvorlagen per Git löschen. Bereits früher committete echte
Firmendaten werden auch in der Historie erkannt; dann Codeänderungen gezielt
in einen frischen neutralen Clone übernehmen. Die Prüfung bereinigt niemals
heimlich eine bestehende Historie.

## Was geprüft wird

- Commit: die tatsächlichen Git-Blobs im Index, auch bei abweichender Arbeitsdatei.
- Commit-Nachricht: bekannte Schlüssel-, Kontakt- und lokale Inhaltsmuster.
- Push: die konkreten zu sendenden Referenzen und alle erreichbaren Commit-Bäume
  und Nachrichten, auch bereits später gelöschte Daten. Flache Clones ohne
  vollständige Historie werden abgewiesen. Nur Branches und Tags sind vorgesehen.
- Merge: eingehende Historie und gemeinsamer Quellbaum vor der Änderung, dann
  der endgültige Index. Unveränderte alte neutrale Firmenvorlagen sind ausschließlich
  in historischen Commits anhand ihrer geprüften Hashes zugelassen.
- Pfade: lokale Datenordner und unbekannte Dateiformate werden auch nach
  `git add -f` abgewiesen. Symlinks und Submodule werden nicht veröffentlicht.
- Inhalte: erkennbare Schlüssel, private Schlüsselblöcke, Kontaktadressen,
  Telefonnummern, Benutzerpfade, Zugangsdaten in URLs und wörtlich kopierte lokale
  Firmenzeilen. Zusätzliche private Namen und Begriffe können lokal, einer pro
  Zeile, in `firmenbasis/private-terms.txt` hinterlegt werden.
- Vorlagen und Bild-/Schriftassets: nur ausdrücklich geprüfte Inhalte gemäß
  `system/source-policy.json`. Neue Assets brauchen Herkunfts- und Inhaltsprüfung
  vor Aufnahme ihres Hashes. Testausnahmen gelten nur für einzelne geprüfte
  fiktive Werte an konkreten Pfaden, nie pauschal für Testdateien.

Der Prüfer läuft lokal, ohne KI, ohne Zugang zum Schlüsselbund und ohne Versand
von Quelldaten an einen Prüfdienst. Die Ausgabe enthält nur Typ, Pfad und Zeile.
Der GitHub-Workflow `Source privacy` wiederholt die Prüfung nach einem Upload;
er kann einen bereits erfolgten Upload nicht rückgängig machen. Als verpflichtende
Merge-Prüfung muss er zusätzlich in den Repository-Regeln eingerichtet werden.

Diese Regeln schützen den normalen Entwicklungsablauf. Frei formulierter oder
absichtlich kodierter unbekannter Firmeninhalt ist nicht vollständig automatisch
erkennbar. Bewusst deaktivierte Hooks oder manipulierte Prüfprogramme sind keine
Sicherheitsgrenze. Deshalb weiterhin nur neutrale Beispiele in Quelländerungen
verwenden und Änderungen an den Prüfregeln selbst sorgfältig prüfen.
Git ist keine Sicherung der lokalen Firmenbasis; diese gehört in die eigene
Datensicherung der Installation.


## Oberfläche als Teil des Updates

Jede Übernahme enthält auch die gemeinsamen Design- und Bedienverbesserungen.
Der Ablauf für bestehende eigene Module, den optischen Vergleich und die Prüfung
des tatsächlich gebauten UI-Stands steht in [UI-UPDATES.md](UI-UPDATES.md).
Nach dem Quellmerge folgt `npm run ui:prepare`; erst ein erfolgreich geprüfter
Build wird über den vorhandenen Betriebsweg aktiviert. Die eigenständige
Referenz `wrapper/ui/blueprint.html` ist ausdrücklich freigegebener neutraler
Anwendungsquellcode; lokale Buildausgaben bleiben ausgeschlossen.
