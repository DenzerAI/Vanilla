# Einstellungen


Der gemeinsame `PageHeading` zeigt den Titel der gewählten Einstellungsseite genau einmal. Eine zusätzliche globale Titelzeile entfällt.

## Aufbau

Eigene Einstellungsnavigation mit bestehenden Symbolen und „Zurück zur App“. Neue zusammenhängende Funktionen bekommen genau einen sachlich benannten Navigationspunkt. Inhalt: Titel → Gruppenüberschrift → `settings-group` mit gemeinsamen `SettingRow` aus `ui/settings-row.jsx`. Links Bezeichnung und optional eine kurze erklärende Zeile, rechts Steuerung. Optionaler `SettingsHeader` nur für eine sinnvolle Bereichseinführung. Kein Dashboard. `SettingsNavigationRow` öffnet Details als ganze Zeile; Icons und Chevron liegen innerhalb der Gruppe. Die Bausteinreferenz unter Aussehen verwendet dieselben Produktionskomponenten.

## Elemente

Auswahl über vorhandene Selects, Ein/Aus über `apple-switch`, Aktion über den gemeinsamen kompakten, leicht gerundeten Aktionsbutton, auch in verschachtelten Aktionsgruppen. Native Selects verwenden dieselbe Form und den gemeinsamen Chevron. Iconaktionen sind kreisrund. Auf schmalen Ansichten dürfen Aktionsgruppen umbrechen. Gruppentrennung, Schriften und Flächen aus dem Designsystem. Primäre Funktion und Zustand auf einen Blick. Technische Installationsbefehle gehören in Dokumentation, nicht in den normalen Einstellungsfluss. Nicht verfügbare Funktionen zeigen einen ehrlichen Status.

## Dein Agent

Reihenfolge: Speicheraktion und Änderungsstatus → **Profil** mit aktuellem Avatar und Name → **Wie soll dein Agent
arbeiten?** mit editierbarer Vorgabe → **Arbeitsgrundlage** mit den
direkt sichtbaren Zeilen für Identität und gemeinsame Arbeitsregeln. Kein
„Erweitert“-Aufklappen. Die Gruppen verwenden die vorhandenen Einstellungszeilen.

Sechs eigene einfarbige SVG-Bots stehen im gemeinsamen Auswahlfenster zur Wahl:
Nori (Standard), Orbit, Miko, Pixel, Lumi und Kibo. „Bild ändern …“ oder Klick auf
den Avatar öffnet den Dialog. Vorschau und Auswahlmarkierung reagieren sofort;
Abbrechen verwirft die Dialogauswahl, Übernehmen ändert den Formularentwurf,
Speichern übernimmt das gesamte Profil. Die Radioauswahl unterstützt Pfeiltasten.
Die Bots verwenden die Farbrollen des aktuellen Themes. Nur ihre Augen bewegen
sich: gelegentliches Blinzeln, selten ein längerer Lidschluss und kleine Blicke
nach links, rechts, oben und unten. Lange Ruhephasen und leicht unterschiedliche
Zeiten pro Avatar verhindern einen gleichförmigen Takt. Kopf und Hintergrund
bleiben still. Die Bewegung erfolgt direkt im SVG, ohne GIF-Dateien oder Masken.
Nicht sichtbare Avatare und versteckte Tabs pausieren. Bei „Bewegung reduzieren“
in den Einstellungen oder im Betriebssystem bleiben die Augen ruhig geöffnet.
Der Kreis um den Avatar hat keinen Rand. Im selben Dialog folgt eine kompakte
Radioauswahl für den Hintergrund: Ohne Farbe, Sand, Terrakotta, Salbei, Himmel
und Lavendel. Hintergrund und Motiv werden gemeinsam in der Vorschau gezeigt,
übernommen oder verworfen. „Ohne Farbe“ bleibt die neutrale Voreinstellung.
Die sechs mitgelieferten SVGs werden direkt gerendert, ohne CSS-Maskierung oder
kreisförmiges Abschneiden der Motive. So entstehen keine Eck-Artefakte in WebViews.

Ohne bereits gewählten Avatar wird beim ersten Öffnen ein überspringbarer
Einrichtungsdialog mit denselben sechs Bildern und Namensfeld angeboten. Ein
vorhandener Name bleibt vorgegeben. Nach „Später“ gilt weiterhin Nori; innerhalb
der Browsersitzung erscheint der Dialog nicht erneut. Nach Speicherung bleibt die
Auswahl über Neustarts erhalten.

Name, Avatarschlüssel, Hintergrundfarbe und persönliche Arbeitswünsche liegen gemeinsam in
`soul/IDENTITY.md`. Das Speichern vergleicht die geladene Dateiversion, schreibt
atomar und erhält alle übrigen Identitätsregeln. Vorhandene persönliche Wünsche
werden nicht durch den Standard ersetzt. Der gemeinsame Standard beschreibt
kurze, warme, natürliche Kommunikation und vollständige, effiziente Arbeit.
„Standard verwenden“ setzt nur den Entwurf zurück; danach ist Speichern nötig.
Die gespeicherte Identität aktualisiert Seitenleiste und Antwortsignaturen in
allen offenen Panels.

## Stimme

Reihenfolge:
1. **Allgemein**: Mikrofonwahl mit Systemstandard; Mikrofon prüfen auf Klick.
2. **Diktat**: Erkennung (Whisper lokal, Groq wenn verbunden); gesicherte Aufnahmen über „Verwalten“, mit separatem Papierkorb. Verlauf ist nicht permanent offen.
3. **Sprachchat**: Ausgabeanbieter; Stimme und Hörprobe; Automodus als gemeinsamer Schalter.
4. Verweis zu **Verbindungen**, falls weitere Sprachdienste benötigt werden.

Deutsch ist Standard; Thorsten wird bei erfolgreicher lokaler Installation als verfügbar angezeigt. ElevenLabs-Stimmen kommen aus dem verbundenen Konto. Cloudverarbeitung wird bei Anbieterwahl kurz benannt. Im Automodus: Sprechpause → senden → fertige Antwort vorlesen → wieder zuhören. Während Ausgabe kein Mikrofon. Automodus startet keinen Sprachchat selbst. Diktat bleibt unabhängig ein Entwurf.

## Grenzen

**Secrets** zeigt die gemeinsame Schlüsselliste aus Verbindungen und manuell angelegten Secrets. „Ersetzen“ öffnet für Groq und ElevenLabs den jeweiligen Verbindungsdialog, damit die Anbieterprüfung erhalten bleibt. Aktive Verbindungen schützen ihre Schlüssel vor dem Löschen; nach Entfernen der Verbindung kann der verbliebene Schlüssel hier gelöscht werden.

Externe API-Schlüssel und Anbieteranmeldungen ausschließlich über den Verbindungsbereich. Die ausdrücklich gewünschte eigene App-Anmeldung liegt unter Zugang; der lokale Backup-Schlüssel gehört zur Sicherungseinrichtung. Aufnahmen werden beim Verwerfen nur in den Papierkorb verschoben. Wiederherstellen, erneute Erkennung und Download bleiben erreichbar.

Bei einem Secret einer eingerichteten CRM-Verbindung führt „Ersetzen“ in denselben CRM-Verbindungsdialog. Benutzername, Passwort und API-Schlüssel werden dort gemeinsam verwaltet; ein Überschreiben dieses Bündels über das einfache Secret-Formular ist gesperrt.

## Worker

Reihenfolge: Standard und Vertretung → KI-Worker → feste Abläufe → lokale Laufzeiten mit verfügbaren Modellen → direkt sichtbarer Modellkatalog.
Erklärungstexte und gemeinsame Arbeitsgrundlage entfallen hier. Status und Fehler bleiben sichtbar.
Worker und lokale Laufzeiten zeigen Original-Markenassets über `BrandIcon` in `SettingRow`: 36-px-Platz mit 28-px-Motiv, unverzerrt und in beiden Themes lesbar.
`worker-settings.jsx` verwendet `SettingRow` und den gemeinsamen Katalog aus
`system/worker-catalog.mjs`. Jeder Worker ist eine eigene Zeile, auch OpenClaw
und Claude Code. Installiert, verbunden und nicht erreichbar sind verschiedene
Zustände. „Verbinden“ prüft die lokale Schnittstelle; Konten und Schlüssel
bleiben beim Worker. Das ist keine zusätzliche externe Anbieterregistrierung.
Technische Pfade und Versionen stehen erst unter Details. Eine erfolgreiche
Schnittstellenprüfung verspricht keinen angemeldeten Modellzugang.

Nur eingerichtete Worker sind als Standard/Vertretung auswählbar. Die Wahl gilt
für neue Chats und automatische Aufträge. Bestehende Chats und ausdrücklich
zugewiesene Aufträge behalten ihren Worker. Die Vertretung übernimmt vor
Auftragseingabe; nach Beginn gibt es keine automatische Wiederholung.

## Reiseeffekt im Chat

Neue Chats ohne Gespräch zeigen standardmäßig dezente Lichtpunkte in drei Tiefenebenen, die langsam aus der Mitte nach außen wandern und sanft pulsieren. Inhalt und Layout bleiben unverändert. Unter Aussehen → Visuell → Reiseeffekt stehen „Aus“, „Nur neue Chats“ (Standard) und „Alle Chats“ dauerhaft zur Auswahl. „Alle Chats“ zeigt den Effekt auch hinter bestehenden Gesprächen in jedem sichtbaren Panel. Reduzierte Bewegung in App oder System zeigt ruhende Punkte; unsichtbare Ansichten pausieren.

„Auto“ probiert eingerichtete Worker in Katalogreihenfolge. Eine gewählte Vertretung
steht am Ende dieser Reihenfolge; „Automatisch“ nutzt alle eingerichteten Worker.
Die Reihenfolge ist sichtbar. Explizite Zuweisungen und laufende Chats wechseln nie.
Neue Installationen verwenden Auto; bestehende Einstellungen werden nicht migriert.
Status, Modelle und Werkzeuge beziehen sich auf den konkret verfügbaren Worker.

Worker-Motive stehen frei ohne helle Trägerkachel. Claude Code verwendet eine
Vektorwiedergabe des Clawd-Maskottchens; Hermes und Ollama passen ihre monochromen
Motive dem Theme an. Lokale Laufzeiten und deren erkannte Modelle sind direkt
sichtbar, nur Testchat und technische Details werden aufgeklappt. Der kuratierte
Modellkatalog enthält Datum, Originalquelle, Downloadgröße und geschätzten
RAM-Bedarf. Suche und Hardwarefilter sind sofort erreichbar. Downloads erfolgen
nur auf Klick, bei laufendem Ollama und passender Hardware; weitere Modelle sind
über den offiziellen Katalog erreichbar. LM-Studio-Modelle werden dort geladen.

## Integrierter Betrieb

System, Memory, Speicher & Sicherung und Zugang verwenden dieselben SettingRow-Gruppen. System bietet Minutenprüfung, Wiederanlauf, Ruhezeiten und Dienstzustand. Memory verbindet Aufnahme, Dreaming, Kontextbudget, lokale Suche und Versionsverlauf. Sicherung verbindet Ziel, verschlüsselte Snapshots, Aufbewahrung und geprüfte Wiederherstellung. Tailscale verwendet die gemeinsame Kachel und den Dialog unter Verbindungen. Einstellungen sind versionsgeprüft; Konflikte erhalten den Entwurf.

## Speichern

Dein Agent sowie System, Memory und Speicher & Sicherung zeigen die Speicheraktion
mit Änderungsstatus direkt unter dem Seitentitel im normalen Dokumentfluss.
Keine schwebende Leiste über den Einstellungsfeldern. Ohne Änderungen ist die
Aktion deaktiviert und mit „Keine Änderungen“ erklärt. Speichern gilt für den
jeweiligen Bereich; Erfolg und Fehler sind sichtbar, Fehler erhalten den Entwurf.

## Allgemein

Allgemein zeigt den Projektordner und die Arbeitsmodi. Projektnamen werden ausschließlich über „Projekt bearbeiten …“ in der Seitenleiste geändert; kein zweites Namensfeld in den Einstellungen. Einstellungsinhalt und Navigation scrollen ohne sichtbare Scrollleisten.
