# Einstellungen


Der gemeinsame `PageHeading` zeigt den Titel der gewählten Einstellungsseite genau einmal. Eine zusätzliche globale Titelzeile entfällt.

## Aufbau

Eigene Einstellungsnavigation mit bestehenden Symbolen und „Zurück zur App“. Neue zusammenhängende Funktionen bekommen genau einen sachlich benannten Navigationspunkt. Inhalt: Titel → Gruppenüberschrift → `settings-group` mit gemeinsamen `SettingRow` aus `ui/settings-row.jsx`. Links Bezeichnung und optional eine kurze erklärende Zeile, rechts Steuerung. Optionaler `SettingsHeader` nur für eine sinnvolle Bereichseinführung. Kein Dashboard. `SettingsNavigationRow` öffnet Details als ganze Zeile; Icons und Chevron liegen innerhalb der Gruppe. Die Bausteinreferenz unter Aussehen verwendet dieselben Produktionskomponenten.

Verbindungen und Skills stehen als eigene Einträge nach Dein Agent in derselben Navigation. Ihre vorhandenen Katalogansichten, Suchfelder, Filter, Seitenköpfe und Dialoge folgen weiterhin [connections.md](connections.md) und [skills.md](skills.md). Es gibt keine zusätzliche Übersichtsseite oder Einstellungsgruppe um die Kataloge. Globale Suche, einzelne Skilltreffer und Querverweise aus Stimme, Worker und System öffnen den passenden Bereich mit ausgewähltem Navigationseintrag. Bei knapper Höhe scrollt nur die Bereichsliste; Zurück zur App und die Agentenzeile bleiben erreichbar.

## Elemente

Beschlossener Ausbau: **Updates** erhält einen eigenen Einstellungsbereich direkt
nach System, mit den Reitern **Version** und **Beiträge**. Der Aufbau führt
[updates.md](updates.md), der technische Ablauf ../../docs/UPDATES.md. Der Bereich
ist noch nicht implementiert; neue GitHub-Zugänge bleiben unter Verbindungen.

Auswahl über vorhandene Selects, Ein/Aus über `apple-switch`, Aktion über den gemeinsamen kompakten, leicht gerundeten Aktionsbutton, auch in verschachtelten Aktionsgruppen. Native Selects verwenden dieselbe Form und den gemeinsamen Chevron. Iconaktionen sind kreisrund. Auf schmalen Ansichten dürfen Aktionsgruppen umbrechen. Gruppentrennung, Schriften und Flächen aus dem Designsystem. Primäre Funktion und Zustand auf einen Blick. Technische Installationsbefehle gehören in Dokumentation, nicht in den normalen Einstellungsfluss. Nicht verfügbare Funktionen zeigen einen ehrlichen Status.

## Dein Agent

Reihenfolge: Speicheraktion und Änderungsstatus → **Profil** mit aktuellem Avatar und Name → **Wie soll dein Agent
arbeiten?** mit editierbarer Vorgabe → **Arbeitsgrundlage** mit den
direkt sichtbaren Zeilen für Identität und gemeinsame Arbeitsregeln. Kein
„Erweitert“-Aufklappen. Die Gruppen verwenden die vorhandenen Einstellungszeilen.

Acht eigene einfarbige SVG-Gesichter stehen im gemeinsamen Auswahlfenster zur Wahl:
Nori (Standard), Orbit, Miko, Pixel, Lumi, Kibo, Pebble und Pad. „Bild ändern …“ oder Klick auf
den Avatar öffnet den Dialog. Vorschau und Auswahlmarkierung reagieren sofort;
Abbrechen verwirft die Dialogauswahl, Übernehmen ändert den Formularentwurf,
Speichern übernimmt das gesamte Profil. Die Radioauswahl unterstützt Pfeiltasten.
Die Bots verwenden die Farbrollen des aktuellen Themes. Die Motive haben keine Füße; Nori und Lumi behalten einen kurzen Halsansatz.
Pixel und Pad bestehen aus einer zusammenhängenden Pixelkontur ohne Antenne.
Die gemeinsame Agent-Animation unter Aussehen bietet Still, Nur Augen,
Sanftes Gesicht (Standard), Kleine Gesten, Zwinkern, Fröhlich, Grimmig und
Abwechslungsreich. Die Auswahl wird sofort über die bestehende Darstellungseinstellung
validiert und gespeichert und gilt auch in offenen Chats. Das dunkle Visier folgt
dem Blick minimal; seltenes Nicken, Blattwippen und kurze Ausdrücke lassen lange
Ruhephasen. Ausdrücke zeigen keinen gemessenen Status. Alle Ebenen pausieren
außerhalb des sichtbaren Bereichs und in versteckten Tabs. Reduzierte Bewegung
in App oder System zeigt neutrale offene Augen. `AvatarMotionSetting` und die
bestehenden `AvatarChoices` stehen auch in Unser Design mit lokalem Vorschauzustand.
Der Kreis um den Avatar hat keinen Rand. Im selben Dialog folgt eine kompakte
Radioauswahl für den Hintergrund: Ohne Farbe, Sand, Terrakotta, Salbei, Himmel
und Lavendel. Hintergrund und Motiv werden gemeinsam in der Vorschau gezeigt,
übernommen oder verworfen. „Ohne Farbe“ bleibt die neutrale Voreinstellung.
Die acht mitgelieferten SVGs werden direkt gerendert, ohne CSS-Maskierung oder
kreisförmiges Abschneiden der Motive. So entstehen keine Eck-Artefakte in WebViews.

Ohne bereits gewählten Avatar wird beim ersten Öffnen ein überspringbarer
Einrichtungsdialog mit denselben acht Bildern und Namensfeld angeboten. Ein
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
allen offenen Panels. Die runde Namensschrift im Seitenleistenkopf bleibt beim
Umbenennen erhalten; das Namensfeld verwendet weiterhin die normale UI-Schrift.

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

Allgemein zeigt den Projektordner und die Arbeitsmodi. Projektnamen werden ausschließlich über „Projekt bearbeiten …“ in der Seitenleiste geändert; kein zweites Namensfeld in den Einstellungen. Einstellungsinhalt und Navigation scrollen ohne sichtbare Scrollleisten. Der App-Rahmen bleibt auf die Fensterhöhe begrenzt. Aussehen und Unser Design scrollen ausschließlich im Inhaltsbereich; am Anfang und Ende wird weder an das Dokument weitergescrollt noch die gesamte App über den Fensterrand gezogen.

## Gemeinsame Ladeanzeige

Unter Aussehen → Ladeanzeige stehen alle 17 Loader-Varianten als kompakte
Radioauswahl mit gleich großen Vorschauplätzen. ASCII ist der Standard, Dither
steht direkt daneben. Größe und Tempo werden wie die übrigen Darstellungswerte
sofort serverseitig gespeichert. Seitenleiste, Paneltabs, Chatstatus und Serverneustart verwenden
denselben AppLoader und übernehmen Änderungen auch in offenen Panels. Breite
Varianten werden innerhalb eines festen Platzes optisch verkleinert. Prozent
ist eine wiederholte Animation, kein gemessener Fortschritt; die Auswahl nennt
diesen Unterschied. App- und Systempräferenz für reduzierte Bewegung zeigen
einen statischen Zustand. Animierte Glyphen sind vor Screenreadern verborgen.

## Aussehen und Unser Design

Reihenfolge: Hell/Dunkel → drei Farbwelten mit echter Vorschau →
Hervorhebungsfarbe → Schrift/Bewegung → bestehende Ladeanzeige und Reiseeffekt
→ Navigationszeile Unser Design mit CI-Version. Farbwelt und Akzent sind
serverseitig validierte, sofort gespeicherte Präferenzen. Keine Farbeingabe,
die ungeprüfte Kontraste erlaubt. Die Unterseite Unser Design hat einen
Rückweg zu Aussehen; ihre segmentierte Auswahl zeigt jeweils einen Bereich.
Die Farbreferenz zeigt die aktive Palette einschließlich festem Terrakotta-
Markenakzent. Tokenwerte und Regeln sind Referenz, keine nutzlosen Formulare.

## Skeletons beim Öffnen

Dein Agent, Worker, lokale Laufzeiten, Stimme, Systemeinstellungen und
Ausführungsdetails verwenden gemeinsame Settings-Skeletons bis Daten
vorliegen. Ladefehler beenden die Platzhalter. Die Designreferenz zeigt
dieselben produktiven List-, Settings-, Chat-, Document- und Media-Formen.

Nutzung ergänzt Settings-Skeletons nur für die noch fehlenden Kontingente.

Die grafischen Loader benötigen die Utility-Klassen ihrer verschachtelten Komponenten. Der CSS-Build erfasst `ui/` einschließlich `components/` explizit; die Prüfung kontrolliert die Klassen im gebauten CSS, damit Vorschauen und echte Ladezustände gleichermaßen sichtbar bleiben.


## Dezentes Flächenlicht

Seitenleiste und Workspace verwenden den gemeinsamen dekorativen Baustein `PanelLight`. Die Seitenleiste behält ihre hellere Grundfläche `sidebar` und erhält über `sidebar-material-shadow` eine sehr feine innere Kante; `sidebar-sheen` zeigt zwei diffuse, schwache radiale Verläufe. Der Workspace nutzt seine bestehende schwarze Materialfläche und `workspace-panel-sheen`. Nur die Lichtschicht bewegt sich, um jeweils wenige Prozent, mit 48 Sekunden je Richtung, sanften Wendepunkten und gegenläufiger Phase links/rechts. Dauer und Easing liegen in der zentralen Designquelle. Keine zufälligen Sprünge, kein Pulsieren von Text oder Kante.

Aussehen → Visuell → Flächenlicht bietet Aus, Ruhend und Sanft bewegt (Standard). Die Auswahl wird gemeinsam mit den bestehenden Darstellungseinstellungen validiert und gespeichert. App- und Systemvorgaben für reduzierte Bewegung zeigen statische Verläufe. Versteckte Tabs, eingeklappte Seitenleisten und nicht sichtbare Flächen pausieren. Nur die Dekoration wird an den Rundungen beschnitten; Menüs, Tastaturfokus und Ziehkanten bleiben erreichbar. Erzwungener Kontrast blendet die Dekoration aus. Unser Design zeigt denselben Baustein.


Settings-Skeletons rendern SettingRow innerhalb der settings-group, damit Innenkanten, Mindesthöhe, Zeilentrenner und Umbruch der echten Einstellungen gelten.

## Service

Service steht nach Dein Agent in der Einstellungsnavigation. Betreuung, Arbeitsnachweise und später A2A gehören hier zusammen. Normale SettingRow-Gruppen, kompakte Zeitangaben, Einsätze und Meldungen zunächst geschlossen. Kein Dashboard. Die Bedienung echter Einsätze über eine Session ist noch zu besprechen; die aktuelle Fassung bleibt als Vorschau erkennbar. Vertrag: work-evidence.md.


Der gemeinsame `ThemeToggle` unter `ui/components/ui/theme-toggle.tsx` zeigt Mond
und Sonne in einer kompakten Pille mit gleitendem Auswahlkreis. Er ersetzt
Hell/Dunkel unter Aussehen und steht als eigene Abschlusszeile „Erscheinungsbild“
im Agent-Menü. Beide verwenden dieselbe bestätigte, serverseitig gespeicherte
Theme-Einstellung. Während der Speicherung ist der Schalter gesperrt; Fehler
lassen die bisherige Auswahl bestehen und werden direkt angezeigt. Native
Buttonbedienung, sichtbarer Fokus, 44-px-Treffhöhe und reduzierte Bewegung
sind berücksichtigt. Im Menü gilt menuitemcheckbox, sonst switch. Farben
und Bewegung folgen vorhandenen zentralen Tokens. Unser Design zeigt dieselbe
Komponente mit lokalem Vorschauzustand. Keine weiteren Kopf- oder Workspaceaktionen.


Die helle Palette unter Aussehen verwendet die abgestuften Papierflächen aus DESIGN.md. Ausgewogen, Warm und Neutral halten Menüs, Steuerelemente und Workspace unterscheidbar; Unser Design zeigt dieselben zentralen Werte.


## Iconaktionen

Aussehen → Visuell enthält eine gemeinsame SettingRow „Iconanimationen“ mit
Hover und Drücken (Standard), Nur beim Drücken und Aus. Sie verwendet die
bestehende validierte Settings-Speicherung; reduzierte Bewegung hat Vorrang.
Keine Galerie in der normalen Einstellungsseite. Unser Design ergänzt den
kompakten Reiter Icons mit allen 81 Einträgen aus dem gemeinsamen Katalog,
Suche und beschrifteter Detailvorschau im aktiven Theme. Dieselben MotionGlyph-
Bausteine und Zeitlinien laufen in der App. Die Referenz respektiert ebenfalls
die gespeicherte Auswahl und reduzierte Bewegung. Simulierter Kopiererfolg wird
nur in den gekennzeichneten Galeriebeispielen gezeigt. Daneben erlauben der
produktive CopyButton und NotificationBell reale lokale Beispielaktionen;
Kopieren schreibt den ausdrücklich gekennzeichneten Beispieltext.


Einzelicons folgen der [gemeinsamen Auswahl- und Hoverregel](../DESIGN.md#gemeinsame-iconrückmeldung). Auswahl bleibt als dünner Kreisrand
erkennbar; Hover animiert einmal, Klick bestätigt die Bedienung. Textzeilen
und native Schalter werden nicht in Iconbuttons umgeformt.


## Archivierte Chats

Archivieren im Chatmenü und Wiederherstellen unter Einstellungen → Archivierte Chats
verwenden denselben gespeicherten Status. Auch leere Chats und gespeicherte
Berichte ohne native Sitzungsdatei können archiviert und wiederhergestellt werden;
Gesprächsexporte und Berichte bleiben erhalten. Andere Anbieter- und Speicherfehler
werden angezeigt und ändern den angezeigten Status nicht. Während einer Antwort,
Übergabe oder Sprachsession wird nicht archiviert; doppelte Aktionen sind gesperrt.
Erneutes Öffnen eines archivierten Berichts verwendet denselben Wiederherstellungsweg.
Die Archivliste bleibt projektübergreifend, neueste Gespräche zuerst. Suchfilter ohne
Treffer und ein vollständig leeres Archiv zeigen verschiedene vorhandene Empty-Zustände.
Der bestehende Aktionsbutton zeigt Wiederherstellen und während der Anfrage
Wiederherstellen …; erst bestätigter Erfolg entfernt die Zeile.


Lebendiger Starttext unter Aussehen → Visuell verwendet StartTextMotionSetting.
Die boolesche Auswahl wird als on/off im lokalen Browserspeicher gespeichert,
zwischen offenen Tabs synchronisiert und als gerätebezogen beschriftet.
Unbekannte Werte verwenden die ruhige aktivierte Voreinstellung; Speicherfehler
bleiben sichtbar. Reduzierte Bewegung in App oder System hat Vorrang.


## Dein Profil

Direkt nach Dein Agent steht Dein Profil mit der vorhandenen Speicherzeile und SettingRow-Gruppen. Über dich enthält den Anzeigenamen des Nutzers; Wetter verwendet das vorhandene Eingabefeld mit einer um 400 ms verzögerten Open-Meteo-Ortssuche. Treffer stehen als SettingRow mit Stadt, Region, Land und nativem Auswählen-Button darunter. Veraltete Suchantworten werden verworfen. Speichern erfordert bei gesetztem Ort einen bestätigten Treffer und erhält dessen Koordinaten in USER.md. Löschen des Orts entfernt die Koordinaten. Der Wetterabruf startet nach erfolgreicher Speicherung und zeigt Erfolg oder Fehler getrennt vom Speicherstatus. Aktualisieren wiederholt den Abruf. Quellenlinks nennen Open-Meteo und GeoNames sowie die übermittelten Ortsdaten; keine amtliche Adressprüfung. Eine nicht eingerichtete Wetterkarte öffnet diesen Bereich direkt; die eingerichtete Wetterkarte öffnet einen neuen Wetterbericht im Chat. Leere Werte sind erlaubt, maximal 100 Zeichen je Feld.

UserPreferences liest und speichert soul/USER.md über die vorhandenen Workspace-Dateiendpunkte. Der Agentenname bleibt in IDENTITY.md. Andere Markdown-Abschnitte in USER.md werden erhalten. Vor jedem Speichern wird der geladene Text verglichen; bei Konflikt oder Fehler bleibt der Entwurf erhalten. Browser mit Web Locks koordinieren gleichzeitige Profil-Speicherungen desselben Ursprungs. Der allgemeine Datei-Endpunkt bietet keine atomare Versionsprüfung gegen externe Dateieditoren. Neue Arbeitsbereiche erhalten eine leere USER.md ohne erfundene Nutzerdaten.


## Designreferenz zwischen Installationen

Unser Design und der eigenständige UI-Bauplan verwenden dieselbe DesignReference.
Der Gesprächseinstieg wird durch ChatStartPreview mit produktivem ChatStart,
AttentionFan und Skeleton gezeigt. Ladezustand und simulierter Anhang verändern
nur den Vorschauzustand; Karten zeigen ihr Aktionsziel, ohne API oder Versand.
Der separate Bauplan ergänzt Hell/Dunkel und eine schmale Inhaltsbreite. Die
Vorschau speichert keine App-Einstellungen und benötigt keine Anmeldung.
Die Übernahme in eigene Module führt ../../docs/UI-UPDATES.md.

Unter Aussehen → Visuell folgt auf Lebendiger Starttext die gemeinsame WeatherMotionSetting-Zeile Wetterbewegung. Sie speichert lokal, synchronisiert Tabs und meldet Speicherfehler; reduzierte Bewegung hat Vorrang. Unser Design enthält WeatherPreview mit allen markierten Wetterbeispielen im produktiven AttentionFan.

Direkt bei Wetterbewegung öffnet Wettervorschau öffnen eine lokale WeatherPreview in der Einstellungsseite. Der Knopf klappt sie wieder zu; Wetterzustände und sechs Tagesphasen sind ohne Datei-Link auswählbar. Die Vorschau ändert keine Wetterorte und startet keine Sessions.

Der persönliche Chatstart verwendet den ersten Namensbestandteil aus Dein Profil, ohne den gespeicherten Anzeigenamen zu verändern. Fehlender Name ergibt eine neutrale Begrüßung.


## Diktat-Tastenkürzel · Version 1.0.0

Stimme → Diktat verwendet DictationShortcutSettings mit normalen SettingRows:
Taste (Automatisch, rechte Command/Meta, rechte Strg, Aus) und Bedienung
(Drücken zum Ein-/Ausschalten als Standard, optional Gedrückt halten).
Automatisch verwendet auf Mac MetaRight und sonst ControlRight. Ausschließlich
die ausgewählte sichtbare Chat-Pane im aktiven Fenster reagiert, keine globalen
Betriebssystem-Hotkeys. Dialoge, Menüs und Sprachchat verhindern einen neuen Start.
Umschalten erfolgt beim Loslassen einer allein gedrückten Taste; Kombinationen
und Wiederholungen lösen es nicht aus. PTT startet beim Drücken und beendet beim
Loslassen; zusätzliche Tastenkombinationen unterbrechen die PTT-Aufnahme.
Fenster-/Panewechsel beendet eine per Kürzel gestartete Aufnahme. Ein Loslassen
während der Mikrofonfreigabe bricht den ausstehenden PTT-Start ab. Erneuter Start
braucht eine neue Geste. Beenden sichert und transkribiert ausschließlich in den
Entwurf, ohne Nachricht zu senden. Vorhandene Audio-Wiederherstellung bleibt.
Einstellungen sind browserlokal unter agent-dictation-shortcut-v1, validiert und
zwischen Tabs synchronisiert; Speicherfehler werden angezeigt. Keine Migration
bestehender Audio- oder Serverdaten. Entfernen des neuen Schlüssels stellt die
plattformabhängige Voreinstellung wieder her. Systemtasten können vom Betriebssystem
abgefangen werden; rechte Strg bleibt als Alternative auswählbar.


## Direkte Pane-Tastenkürzel · Version 1.0.0

Ctrl + Shift + 1–4 aktiviert Chat-Pane 1–4 gemäß ihrer festen Chatnummer.
Die Zielpane muss geöffnet sein; verborgene oder maximierte Ansichten zeigen
sie über die vorhandene aktive Panelauswahl. Ein eigener Mikrofonstart findet
nicht statt. Nach Auswahl erhält ihr Composer Schreibfokus ohne Scrollsprung
und die vorhandene Auswahlkontur. Gesperrte Chats erhalten keinen Schreibfokus.
Nur ein Listener der äußeren App verarbeitet die Kürzel im aktiven Chatfenster;
Dialoge, Menüs, Einstellungen, IME und Tastenwiederholung sind ausgeschlossen.
Einstellungen → Tastenkürzel verwendet PaneShortcutSettings mit SettingRows:
Belegung aufnehmen, je Pane deaktivieren und Standard wiederherstellen.
Doppelte Belegungen und bestehende App-Kürzel werden abgewiesen; einzelne
Schreibzeichen ohne Ctrl/Alt/Meta sind nicht erlaubt, F-Tasten sind möglich.
Escape/Tab/Verlassen bricht das Aufnehmen ab. Auswahl wird erst nach erfolgreichem
Speichern übernommen, Fehler bleiben sichtbar. Browserlokaler Schlüssel
agent-pane-shortcuts-v1, validiert und zwischen Tabs synchronisiert. Keine
Migration von Serverdaten oder Chatentwürfen; fehlende/ungültige Werte verwenden
den Standard. System- und Browserbelegungen haben gegebenenfalls Vorrang.

## Workspace-Beschreibungen

Workspace-Namen gehören zum jeweiligen Thema und ändern nicht die zentrale
Assistentenidentität. Einrichtung und Bearbeitung verwenden den bestehenden
Workspace-Einstieg der Seitenleiste und die gemeinsamen Settings-Zeilen im
Modal; siehe [Workspace-Vertrag](workspaces.md). Es gibt dafür kein zweites
Identitätsprofil und keine zusätzlichen Anbieterzugänge.
