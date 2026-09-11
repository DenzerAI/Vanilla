# UI zwischen Installationen übernehmen

Vanilla liefert einen verbindlichen optischen und funktionalen Bauplan mit.
Die Oberfläche gehört zum Produktupdate: Layout, Typografie, Farben, Icons,
Abstände, Bewegung, Fokus, Ladezustände und Bedienwege werden gemeinsam mit
den Funktionen gepflegt. Eine Installation darf nicht allein deshalb die alte
Gestaltung behalten, weil ihre eigenen Module bereits funktionieren.

## Führende Quellen und optischer Vergleich

- `wrapper/DESIGN.md`: gemeinsame Gestaltungs- und Bedienregeln.
- `wrapper/ui/design-system.mjs`: zentrale Werte, keine nachgebauten Paletten.
- `wrapper/surfaces/README.md` und Bereichsvertrag: Aufbau und Verhalten jedes Moduls.
- `wrapper/ui/design-reference.jsx`: interaktive Produktionsbausteine in Unser Design.
- `wrapper/ui/blueprint.html`: eigenständiger, neutraler UI-Bauplan ohne Anmeldung.

Der eigenständige Bauplan und die Anwendung verwenden dieselben Komponenten,
Styles und Tokens. ChatStartPreview zeigt den echten ChatStart, AttentionFan,
Skeleton und die gemeinsame Scrollsteuerung mit neutralen Daten. Ladezustand,
Anhang und Kartenaktion sind ausprobierbar. Alle Bausteine zeigt dieselbe
DesignReference wie Aussehen → Unser Design. Der Bauplan sendet keine Nachrichten,
liest keine Installationsdaten und startet keine Anmeldung oder Dienste.
Eine simulierte Anhangsfläche dient dem Layoutvergleich; sie prüft keinen Upload.
Handybreite begrenzt den Inhalt, ersetzt aber keine echte Browseremulation:
Viewport-Mediaqueries, Tastatur und Touch sind zusätzlich zu prüfen.

```sh
npm run ui:prepare
npm run ui:preview
```

`ui:prepare` prüft das Design, baut Anwendung und Bauplan gemeinsam und kontrolliert
anschließend den Build. `ui:preview` öffnet die gebaute Vorschau auf Loopback-Port
4173 unter `/blueprint.html`, ohne App-Backend. Der Port muss frei sein.
Die gebaute Datei liegt unter `wrapper/dist/blueprint.html`; ES-Module benötigen
HTTP, ein Doppelklick über `file://` ist kein unterstützter Vorschauweg.
Builddateien bleiben lokal und werden in jeder Installation aus Git erzeugt.

## Bestehende Erweiterungen erhalten

Der übernehmende Worker liest zuerst den eigenen Bereichsvertrag und den
entsprechenden neuen Vertrag aus Vanilla. Aufträge, Geschäftslogik, zusätzliche
Felder, eigene Module und Datenflüsse der Zielinstallation bleiben erhalten.
Die neuen gemeinsamen Bausteine und Bedienregeln werden in diese vorhandenen
Module eingearbeitet. Keine zweite Parallelansicht und kein Komplettaustausch
lokaler Module allein zum Erzwingen derselben Optik.

Eine explizite lokale Produktanforderung kann eine Abweichung begründen. Der
Worker nennt sie konkret im betroffenen Bereichsvertrag: betroffener Baustein,
fachlicher Grund und Ersatzverhalten. Persönliche Werte wie Name, Avatar,
Farbwelt und Schriftgröße bleiben lokal. Sie begründen keine unbeabsichtigte
Abweichung bei Struktur, Fokus, Ladeverhalten oder Aktionen.

Bei einem Merge-Konflikt beide Änderungen fachlich zusammenführen. Pauschales
„ours“ oder „theirs“ für UI-Dateien ist keine Übernahme. Derselbe Grundsatz gilt
beim Übertragen in ein anderes Repository: zuerst den gemeinsamen Baustein
zuordnen, dann die Zieloberfläche daran anpassen. Source-, Design- und Modulprüfungen
bleiben aktiv. Eine reine Git-Übereinstimmung beweist keine identische Oberfläche.

## Update im Zielsystem

Der gesamte Auftrag beginnt bei [UPDATE.md](../UPDATE.md), einschließlich
Versionswahl, Sicherung, eigener Codeänderungen und Wiederherstellung. Die
folgenden Schritte konkretisieren die UI-Prüfung innerhalb dieses Ablaufs.

1. Zielordner, Branch, laufenden Dienst und lokale Änderungen feststellen.
   Nach `docs/CODE-SYNC.md` sichern und den gewünschten Quellstand übernehmen.
2. Geänderte Abhängigkeiten mit den vorhandenen Lockdateien installieren:
   `npm ci`, `npm --prefix wrapper ci`; bei Python-Änderungen zusätzlich die
   projektlokale virtuelle Umgebung mit `requirements.lock` aktualisieren.
3. Neue Regeln und Produktionsbausteine in bestehende eigene Module einarbeiten;
   Modulvertrag und gemeinsame Referenz um zulässige Erweiterungen ergänzen.
4. `npm run modules:verify`, passende Funktionstests und `npm run ui:prepare`
   ausführen. Ein fehlgeschlagener Build wird nicht aktiviert.
5. Laufende Oberfläche und Bauplan nebeneinander prüfen: Hell/Dunkel, Desktop,
   Handyviewport, große Schrift, lange Inhalte, reduzierte Bewegung, Tastatur,
   Lade-/Fehlerzustand und wachsende Eingabe. Abweichende Inhalte sind normal;
   ungewollte Abweichungen in Layout oder Bedienung werden behoben.
6. Genau den geprüften Quellstand samt Build über den vorhandenen Betriebsweg
   übernehmen. Serveränderungen benötigen einen geregelten Neustart; ein reines
   UI-Update benötigt das Neuladen der Oberfläche. Laufende Arbeit und Entwürfe
   berücksichtigen. Git-Push ist keine Aktivierung auf dem Zielrechner.
7. Im tatsächlich bedienten Installationsordner `npm run ui:verify` ausführen.
   Der UI-Stand in `/version.json` des bedienten Ursprungs muss dem lokal geprüften
   `uiVersion` entsprechen. Im Browser dessen Netzwerkantworten und die sichtbare
   Oberfläche kontrollieren; ein anderer Port, Proxy oder alter Tab kann einen
   anderen Stand zeigen.

`ui:verify` prüft den UI-Quellfingerabdruck samt gemeinsam verwendeten Modulen
und Buildkonfiguration sowie Hashes der erzeugten Dateien. Fehlender, veralteter
oder veränderter Build führt zum Fehler. `sourceRevision` bezeichnet die beim
Bauen vorhandene Git-Revision; `sourceDirty` kennzeichnet lokale Änderungen.
`productVersion` stammt aus `system/version.json`; ein fehlender oder abweichender
Produktstand macht den Build ungültig. Das Agentenmenü zeigt den tatsächlich
gestarteten Kernstand; ein bereits neu gebautes Frontend ersetzt diesen Nachweis
nicht. Entwicklung, freigegebene Produktversion und nativer CLI-Stand bleiben
unterscheidbar.
Ein späterer Dokumentationscommit ist nicht automatisch ein anderer UI-Stand.
Die Hashprüfung ersetzt weder einen Sichtvergleich noch die Prüfung eines
externen Rechners. `npm start` und die Aktualisieren-Schaltfläche bauen keinen
Quellcode neu. Ein automatischer Git-Download oder Deployment erfolgt hier nicht.

## Kurzer Auftrag für einen übernehmenden Worker

> Aktualisiere diese Installation auf den gewünschten Vanilla-Quellstand.
> Lies AGENTS.md, docs/CODE-SYNC.md und docs/UI-UPDATES.md. Übernimm auch den
> UI-Bauplan, die Designregeln und die Bedienverbesserungen in unsere vorhandenen
> Module. Erhalte unsere eigenen Funktionen, Daten und Einstellungen. Löse
> Überschneidungen fachlich, baue und prüfe die neue Oberfläche. Vergleiche die
> tatsächlich laufende Ansicht mit dem Bauplan und bestätige erst danach den
> geladenen UI-Stand. Melde konkret, falls die Zielinstallation nicht prüfbar ist.

## Auslieferung der Builddateien

Auch der separat gestartete Adapter liefert Dateien aus wrapper/dist mit ihren
wirklichen MIME-Typen aus, einschließlich JavaScript-Teildateien unter assets/,
Schriften, Icons und UI-Bauplan. Ein fehlendes Asset liefert 404 und niemals die
HTML-Startseite. Pfadauflösung und Verknüpfungen bleiben auf dist begrenzt;
GET/HEAD sind die einzigen statischen Zugriffsmethoden. Der HTTP-Vertragstest
vergleicht die im gebauten HTML referenzierten Dateien mit den tatsächlich
ausgelieferten Bytes. Der normale Python-Kern behält seinen vorhandenen
Dateiauslieferungsweg. Diese Korrektur verändert keine Arbeitsdaten.

## Bedarfsgeladene Builds
App und Bauplan sind getrennte HTML-Einstiege desselben Builds. JavaScript und
CSS verwenden Inhaltsnamen und werden komprimiert bereitgestellt. Die Prüfung
verfolgt die tatsächlichen Einstiegspfade statt feste app.js-Dateinamen zu
verlangen; Quellenfingerprint und Dateiprüfsummen bleiben bindend.

## Sichtprüfung ohne Host-Bildschirmsteuerung

Die Sichtprüfung der laufenden Oberfläche läuft kopflos über `node scripts/ui-check.mjs`
(Chrome und DevTools-Protokoll, keine Abhängigkeiten). Das Werkzeug öffnet die Adresse der
Installation, wartet auf Elemente (`text=`, `css=`, `label=`), klickt, tippt, drückt Tasten,
wertet JavaScript aus, liest den Seitentext und schreibt Screenshots für Desktop (1440×900)
oder Handy (390×844) in den Ausgabeordner des Arbeitsbereichs. Ergebnis ist eine JSON-Zeile
mit Schritten, Screenshots, Konsolenfehlern und Auswertungen. Die Bildschirmsteuerung des
Hosts wird für Prüfungen nicht verwendet. Scheitert das Werkzeug selbst, ist das eine
benannte Restunsicherheit im Bericht, kein Grund, geprüfte Arbeit zurückzuhalten.
Prüfungen: `wrapper/test/ui-check.test.mjs`.

