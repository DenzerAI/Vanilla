# AGENT · CI 1.1

Die Oberfläche ist eine ruhige lokale Arbeitszentrale. Sie verbindet die Klarheit einer Entwickleroberfläche mit warmen neutralen Flächen und macOS-typischer Navigation, gruppierten Einstellungen und zurückhaltenden Bedienelementen. Die Assistentenidentität beginnt als „Agent“ mit dem einfarbigen Bot-Avatar Nori. Sechs eigene SVG-Bots sind unter „Dein Agent“ auswählbar und passen sich dem Erscheinungsbild an. Der Anzeigename wird zentral in soul/IDENTITY.md konfiguriert. Die bestehende Informationsarchitektur, Icons und Funktionen bleiben erhalten.

## Verbindlicher Designvertrag für jede Erweiterung

Diese Datei ist die führende Designvorgabe der Schaltzentrale. Sie gilt für
jede neue Seite, Funktion, Komponente, jeden Dialog, Ladezustand und Effekt,
auch bei importiertem React-/shadcn-Code und aus Vorlagen erzeugten Oberflächen.
Die konkrete Nutzeranweisung hat Vorrang. Eine gewünschte Designänderung wird
im selben Auftrag hier und im betroffenen Bereichsvertrag nachvollzogen.

Die Zuständigkeiten sind eindeutig: `DESIGN.md` legt die Gestaltungsregeln fest,
`ui/design-system.mjs` deren gemeinsame Werte, `surfaces/` Aufbau und Verhalten
jedes Bereichs. **Aussehen → Unser Design** zeigt die vorhandenen Bausteine.
Diese Quellen werden erweitert; zusätzliche konkurrierende Designhandbücher,
Tokenlisten und komponenteneigene Themen sind nicht vorgesehen.

Vor der Umsetzung ordnet der Worker die Erweiterung einem Bereichsvertrag zu
und prüft die passenden Produktionskomponenten. Einstellungen verwenden die
vorhandenen Einstellungszeilen, Seiten den gemeinsamen Seitenkopf, Dialoge und
Navigation ihre bestehenden Muster. Farben, Schrift, Abstände, Rundungen,
Bediengrößen und wiederkehrende Bewegungswerte stammen aus zentralen Rollen.
Externe Beispiele liefern Funktionalität; ihre Gestaltung wird an dieses
System angepasst. Ein separater CSS-Reset oder ungeprüfte globale Overrides
gehören nicht zu einer Komponentenübernahme.

Fehlt ein Muster, wird es als wiederverwendbare Komponente mit benannten
Zuständen eingeführt, im zuständigen Bereichsvertrag dokumentiert und in der
Bausteinreferenz ergänzt. Neue wiederkehrende Werte kommen zuerst in die
Designquelle. Eine lokale Layoutkorrektur darf komponentenspezifisch bleiben;
sie begründet keine zweite Schrift-, Farb- oder Abstandsskala. Bestehende
abweichende Stellen sind kein Vorbild für neue Abweichungen.

### Motion und Sci-Fi als gezielte Gestaltung

Die Oberfläche darf einen eigenständigen Wow-Effekt haben. Bewegung erhält
einen benennbaren Anlass: direkte Bedienrückmeldung, verständlicher Übergang,
Arbeitsstatus oder bewusst gewählte Atmosphäre. Pro Interaktion steht ein
visueller Schwerpunkt im Vordergrund. Texte, Eingabe und Navigation bleiben
ruhig lesbar und bedienbar; Effekte verschieben keine Inhalte und verzögern
keine Aktion. Neon, Glow, Partikel, Glas und Terminalmotive sind gezielte,
zum bestehenden Theme passende Akzente.

Neue dekorative oder dauerhaft animierte Effekte werden unter **Aussehen**
an passender Stelle einstellbar und abschaltbar. Auswahlwerte werden validiert,
dauerhaft gespeichert und von allen betroffenen Ansichten gemeinsam genutzt.
Intensität oder Tempo werden nur angeboten, wenn sie eine sinnvolle Wahl sind.
Wiederkehrende Dauer-, Easing- und Intensitätswerte erhalten zentrale Rollen.
Die ruhige Voreinstellung respektiert die vorhandene gespeicherte Auswahl.

App- und Systemvorgaben für reduzierte Bewegung haben Vorrang vor dem Effekt.
Es gibt einen verständlichen statischen Zustand; unsichtbare Ansichten und
versteckte Tabs pausieren dauerhafte Animationen. Dekoration ist für
Screenreader verborgen. Status bleibt auch ohne Bewegung verständlich;
Animationen täuschen keinen gemessenen Fortschritt oder Erfolg vor.
Diese Leitplanken autorisieren für sich allein keinen neuen Effekt.

### Fertig bedeutet ins System integriert und geprüft

Zur Umsetzung gehören passende Lade-, Leer-, Fehler-, Erfolgs- und deaktivierte
Zustände sowie Tastaturbedienung und sichtbarer Fokus. Geprüft werden Hell/Dunkel,
Desktop und schmale Breite, große Schrift, lange Inhalte sowie reduzierte
Bewegung, soweit die Änderung sie betrifft. Neue dauerhafte Einstellungen
werden auch nach erneutem Laden geprüft; geteilte Komponenten an ihren
betroffenen Einsatzorten. TypeScript, Build und passende Funktionstests gehören
bei Codeänderungen dazu. Reine Dokumentationsänderungen brauchen keinen Build.

Die Rückmeldung nennt die verwendeten oder erweiterten gemeinsamen Bausteine,
aktualisierte Regeln, tatsächliche Prüfungen und offene Einschränkungen.
Ein erfolgreicher Build ersetzt keine Sichtprüfung. Fehlende Prüfwerkzeuge
werden ausdrücklich benannt. Eine neue Oberfläche ist erst dann vollständig
integriert, wenn Gestaltung, Verhalten, Dokumentation und Prüfung zusammenpassen.

Die betroffene laufende Oberfläche muss am Desktop und auf dem Handy visuell
geprüft werden. Dabei Gesamtwirkung, Hierarchie, Ausrichtung, Textumbrüche,
Überlagerungen, Scrollverhalten und erreichbare Bedienelemente beurteilen;
korrekte Tokens allein belegen keine stimmige Gestaltung. Screenshots beider
Ansichten tatsächlich ansehen und die relevanten Interaktionen ausführen.
Die Rückmeldung nennt Ansicht, Zustand, Viewport beziehungsweise Gerät und
Prüfbeleg. Eine mobile Browseremulation wird als solche ausgewiesen; fehlt
ein echtes Handy, bleibt dessen Geräteprüfung ausdrücklich offen.

## Verbindliche Quelle

`ui/design-system.mjs` enthält Schriftfamilien, Größenrollen, Gewichte, Zeilenhöhen, Abstände, Radien und semantische Farbpaletten. `build.mjs` erzeugt daraus `ui/design-tokens.css`. Die Oberfläche verwendet diese CSS-Variablen; `ui/design-reference.jsx` liest dieselbe Quelle für **Einstellungen → Aussehen → Unser Design**. Die generierte CSS-Datei wird nicht von Hand bearbeitet.

Änderungen am Design beginnen in der zentralen Quelle, werden mit `npm run build` erzeugt und mit `npm test` geprüft. Neue wiederkehrende Werte erhalten dort eine benannte Rolle. Komponenten dürfen ihre strukturellen Maße, Breakpoints und optischen Korrekturen behalten; Farben, Schriftgrößen und wiederverwendbare Abstände werden nicht lokal nachgebildet. Die Legacy-Oberfläche unter `frontend/` ist nicht Teil des Wrappers auf Port 1989.

## Typografie

Vite baut die React-Oberfläche ab `ui/main.tsx`. Neue Komponenten werden in
TypeScript geprüft; vorhandene JSX-Komponenten bleiben kompatibel. Tailwind 4
ist über das Vite-Plugin eingebunden. `ui/tailwind.css` verbindet die semantischen
Tailwind-Farben mit den vorhandenen Tokens und aktiviert keinen zweiten CSS-Reset.
React-Komponenten aus externen Katalogen werden an diese Tokens und die
Bereichsverträge angepasst. Motion ist installiert; der gemeinsame MotionConfig
berücksichtigt die Systemeinstellung für reduzierte Bewegung.

Inter ist die gemeinsame Schrift für Oberfläche, Nutzernachrichten und Überschriften. Gesprächstexte und Eingabe verwenden die native Systemschrift über font-conversation, auf macOS San Francisco; Statusmeldungen verwenden die UI-Schrift. IBM Plex Mono wird für Code, Tastenkürzel und technische Werte eingesetzt. Keine dekorative Monospace-Schrift in Navigation oder Überschriften. Inter wird einschließlich echtem Kursivschnitt lokal ausgeliefert, Plex Mono im regulären Schnitt; Browser dürfen in bestehenden Codeauszeichnungen Gewicht/Kursiv synthetisch darstellen.

Die verbindlichen Größen, Gewichte, Zeilenhöhen und Verwendungszwecke stehen in `typography` der zentralen Quelle und werden in Aussehen als Schriftproben angezeigt. Die Basis für rem beträgt 16 px. Die Skala reicht von 12 px für Zusatzinformationen bis 28 px für Seitentitel; 48 px sind für die bestehende Sprachansicht reserviert. Standardbedienelemente verwenden 14 px, längere Inhalte 16 px. Komponenten können für ihren Inhalt einen passenden Zeilenabstand aus `leading` wählen. Schriftgrößen sind in rem definiert und unterstützen Browserzoom.

## Abstände, Flächen und Farben

Ein 4-px-Raster organisiert die Oberfläche; 2 px sind optischen Details vorbehalten. Enge Gruppen verwenden 8 px, normale Innenabstände 16 px, Gruppentrennungen 24–32 px und große Seitenränder 48–64 px. Die Detailsansicht zeigt alle definierten Abstufungen und Rundungen aus der Quelle.

Ruhige neutrale Bedienelemente bestimmen die Oberfläche. Der bisherige Markenakzent bleibt für bewusst gewählte Projekt- und Avatarfarben verfügbar. Links in Chatantworten verwenden die bestehende kontrastgeprüfte Rolle `blue` und eine feine Unterstreichung, damit sie klar als Links erkennbar sind. Fokus verwendet die neutrale Rolle `focus-ring` als feine 1-px-Linie; normale Klicks erhalten keinen zusätzlichen Außenrahmen. Textauswahl verwendet eine neutrale Fläche. Erfolg, Hinweis und Fehler besitzen eigene Farbrollen mit passenden Hintergründen. Beide Erscheinungsbilder implementieren dieselben Rollen. Einstellungen sind flach gruppiert; Schatten dienen schwebenden Bedienelementen. Farbwerte, Schatten und die Rundungen wiederkehrender Komponenten kommen aus der gemeinsamen Quelle.

Textfarben müssen mindestens 4,5:1 Kontrast zu ihren vorgesehenen Flächen erreichen. Status benötigt zusätzlich Text. Tastaturfokus muss sichtbar sein. Die CI-Werte stehen in der Unterseite „Unser Design“; interaktive Bausteinbeispiele verändern nur ihren lokalen Vorschauzustand. Nutzereinstellungen umfassen Hell/Dunkel, die Farbwelten Ausgewogen/Warm/Neutral, Hervorhebung in Terrakotta/Graphit/Salbei, Inter/Systemschrift, drei Schriftgrößen und reduzierte Bewegung. `ui/appearance.mjs` definiert die erlaubten Optionen für Oberfläche und Server gemeinsam. Schriftgrößen skalieren die Rollen aus `typography`, ohne eine zweite Größentabelle. Projektsymbole werden als stabile Schlüssel gespeichert. Chatlisten zeigen standardmäßig alle Gespräche im verfügbaren Scrollbereich; „Weniger anzeigen“ begrenzt auf fünf aktuelle Gespräche plus angepinnte Chats; alle Texte einschließlich „Neuer Chat“ und „Mehr anzeigen“ teilen dieselbe linke Kante. Statussymbole stehen links vor dem Chatnamen: rotierender Ring während der Arbeit, grüner Haken bei erfolgreichem Abschluss, eigene Symbole für Fehler und Unterbrechung. Die Farbe `chat-complete` ist zentral und für beide Themes definiert.

## Schriften und Lizenznachweise

Die Font-Dateien und vollständigen SIL-OFL-1.1-Lizenztexte liegen unter `ui/assets/fonts/`. Originalquellen und SHA-256-Prüfsummen stehen in `sources.json`. Die Originalschriften werden unverändert ausgeliefert. Inter stammt aus Release v4.1; die genaue IBM-Plex-Revision ist im Quellenverzeichnis festgehalten. Die Schriftlizenzen sind direkt in der Aussehen-Ansicht aufklappbar. Fonts werden ausschließlich vom lokalen Server geladen; keine Abhängigkeit von einem externen Font-CDN. Die bestehende Content Security Policy bleibt erhalten.

## Prüfung dieser Einführung

Produktionsbuild, automatisierte Farbkontraste in beiden Paletten, Synchronität zwischen Designquelle und generiertem CSS, Auflösung sämtlicher verwendeter CSS-Variablen sowie WOFF2-Header und beiliegende Lizenzen werden geprüft. Browserkontrollen decken die CI-Ansicht in Hell/Dunkel bei 1440, 390 und 320 CSS-Pixeln, Font-Laden, Theme-Wechsel, Aufklappen und Überlauf ab. Ein vollständiger VoiceOver-Audit ist damit nicht verbunden.

Der Impeccable-Scan meldet Inter als verbreitete Schrift sowie die bestehende Zitatlinie im Markdown. Inter ist hier bewusst wegen der gewünschten klaren, macOS-nahen Arbeitsoberfläche gewählt. Die Zitatlinie bezeichnet ein Zitat, keine dekorative Karte.

## Chat und Personalisierung

Eine schmale Eingabenavigation mit Vorschau springt zu Nutzernachrichten. Uhrzeit und Nachrichtenaktionen bleiben außerhalb der Bubble; Löschen liegt im Mehr-Menü. Bildanhänge stehen als Vorschauen über dem Text. Der Sprung zur neuesten Nachricht erscheint beim Lesen älterer Inhalte. Allgemeine Auswahlzustände und Schalter sind neutral; Orange ist keine Standardfarbe für Bedienelemente. Ein-/Aus-Einstellungen und Zeitpläne verwenden denselben Schalter. „Dein Agent“ zeigt das Profilbild, bearbeitet Name und persönliche Arbeitswünsche direkt und bietet sechs Avatare im gemeinsamen Auswahlfenster an; letztere werden in einem abgegrenzten Abschnitt der vorhandenen Identitätsdatei gespeichert. Ein Versionsvergleich verhindert das Überschreiben zwischenzeitlicher Dateiänderungen beim Speichern.

## Mehrfachansicht und Chat-Kopf

Die Einzelansicht ist der Standard. Oben rechts steht links vom Workspace-Icon die Chat-Ansicht mit 1–4 Panels. Die Auswahl „1 Chat“ behält das zuletzt aktive Panel. Panels haben unabhängige Eingaben, Anhänge, Modelle, Verläufe und Scrollpositionen. Ausgeblendete Panels bleiben während der Sitzung gemountet; auch ein Wechsel zu Einstellungen entfernt sie nicht. Alle Panels teilen einen Eventstream. Die verfügbare Breite des Chatbereichs entscheidet über die Spaltenzahl (400 px Mindestbreite pro Spalte); zusätzliche Panels sind über Tastatur-bedienbare Tabs erreichbar. Trennlinien lassen sich ziehen oder mit Pfeiltasten verschieben. Maximieren ist vorübergehend; Schließen entfernt nur das Panel aus der Ansicht.

Bestehende Chats und benannte Entwürfe zeigen ein Drei-Punkte-Menü; unbenannte Entwürfe erhalten keine „Neuer Chat“-Beschriftung in der globalen Leiste. Bei mehreren Panels steht das Menü im zugehörigen Panel, der Titel bleibt im Tooltip zugänglich. Die Chatleiste besitzt keine untere Trennlinie. Das Menü öffnet ein Dropdown mit Umbenennen, Anpinnen, Teilen, Fork, Kopieren, Markdown-Export, Chatwechsel und Archivieren. Auch ein neuer Entwurf kann bereits benannt werden. Teilen bietet den Gesprächsinhalt, einen lokalen Deep Link und, falls verfügbar, die Systemfreigabe. Lokale Links werden ausdrücklich als solche bezeichnet; es gibt keinen öffentlichen Freigabedienst.

Der Verbindungsstatus steht ausschließlich als fokussierbarer Punkt beim Agenten unten links. Hover, Fokus oder Klick zeigen Serveradresse, Engine, Verbindungszustand und gemessene Server-Antwortzeit. Die Zeit misst einen lokalen HTTP-Rundweg; sie behauptet keine Modellgeschwindigkeit.

Die Seitenleiste verwendet eine gemeinsame Textkante für Navigation, Projektnamen, neue und bestehende Chats sowie „Neues Projekt“. Fertig- und Aktivitätsstatus teilen sich die linke Symbolspalte vor dem Chatnamen mit den Chat-Aktionen; bei Hover, Tastaturfokus und geöffnetem Aktionsmenü wird dort nur die Aktion angezeigt. Der Online-Punkt ist vertikal zur Agent-Zeile zentriert. Die Layoutauswahl enthält ausschließlich die vier Optionen ohne Unterzeilen oder erklärenden Fußtext.

Neue Chats werden über das Plus ganz rechts am Projektordner angelegt; das Projekt-Plus erscheint an der Überschrift „Projekte“ bei Hover oder Tastaturfokus. Projektmenü und Einklapp-Pfeil erscheinen bei Hover/Fokus, auf Touch-Geräten bleiben sie erreichbar. Die obere Suchpille ersetzt den App-Namen und öffnet dieselbe Suche wie Cmd/Ctrl+K. „Neuer Chat“-Zeile und „Neues Projekt“-Zeile entfallen; Cmd/Ctrl+N bleibt erhalten. Offene Rückfragen erscheinen bei Bedarf neben der Suchpille.

Grüne Haken bezeichnen ausschließlich ungelesene abgeschlossene Antworten. Der Server speichert die gelesene Turn-ID; eine neuere Antwort ist wieder ungelesen. Die UI bestätigt erst nach 700 ms bei sichtbarem Chat, aktivem Fenster und Leseposition am Ende. Ein veralteter Lesehinweis kann keine neuere Antwort als gelesen markieren.

## Verbindliche Bereichsverträge

Jeder Bereich hat einen verbindlichen Aufbau- und Erweiterungsvertrag unter [surfaces/README.md](surfaces/README.md). Vor UI-Änderungen ist der passende Vertrag zu lesen; [AGENTS.md](AGENTS.md) macht diesen Schritt für weitere Agenten verbindlich. Eine neue Funktion rechtfertigt keine neue Interaktionslogik. Gleichartige Elemente teilen Einstieg, Komponente, Zustände und Bearbeitungsweg.

Neue externe Dienste stehen mit Original-Markenicon und Plus unter **Einstellungen → Verbindungen → Weitere Dienste einrichten**, werden im vorhandenen Dialog eingerichtet und danach unter **Eingerichtet** bearbeitet. Keine zusätzlichen Zugangsfelder auf Übersichtsseiten. Einstellungen bündeln Konfiguration, Skills und Verbindungen; Anbieterzugänge bleiben ausschließlich im Verbindungsbereich. Sprache liegt gesammelt unter **Stimme**; der Chat enthält nur kompakte Sprachaktionen.

Original-Markenassets mit dunklen oder transparenten Signets erhalten bei Bedarf eine helle Trägerfläche über die gemeinsame Farbrolle `brand-asset-bg`, damit sie in beiden Erscheinungsbildern erkennbar bleiben. Größe, Rundung und Aktion folgen weiterhin der gemeinsamen Dienstekachel; die Markenfarben werden nicht verändert.

## Persönlicher Gesprächsfluss

Nutzernachrichten verwenden die 14-px-Rolle control, Agentenantworten die 15-px-Rolle conversation mit der nativen Systemschrift. Die Uhrzeit bleibt unter der Nachricht; der ausgewählte Bot-Avatar steht bereits ab Beginn über der Antwort. Erfolgreiche Antworten erhalten keine zusätzliche Abschlusszeile. Fehler, Unterbrechungen und laufende Arbeit bleiben ausdrücklich sichtbar. Nachrichtenaktionen erscheinen auf Geräten mit präzisem Hover bei Hover oder Tastaturfokus; auf Touch bleiben sie erreichbar. Die Eingabe beginnt mit einer kompakten Schreibzeile und wächst mit dem Entwurf. Arbeitsmodus und Modell stehen zurückhaltend darunter.

Die Gesprächswünsche führt soul/IDENTITY.md; der gemeinsame Initialstandard liegt in identity-preferences.mjs. Die Oberfläche ergänzt kein zweites sprachliches Regelwerk.

Werkzeugaktivität und Begleitdateien bleiben leise, aufklappbare Zeilen in der gemeinsamen kleinen Beschriftungsrolle. Herkunft, Pfade und ausführliche Fehlerdetails gehören in die geöffneten Inhalte. ActivityGroup und ChatArtifacts verwenden vorhandene Abstands-, Text- und Touchrollen; der konkrete Aufbau steht im Chatvertrag.

## Composer und Dateiergebnisse

Die Schreibzeile ist eine Pille mit der zentralen großen Rundung. Ein Mikrofon diktiert in den Entwurf; separate Voice-/Vorlese-Icons entfallen im Composer. Arbeitsmodus und Modellwahl stehen direkt nebeneinander links auf einer gemeinsamen horizontalen Linie außerhalb der gefüllten Schreibfläche darunter. Einheitliche 32-px-Bedienelemente, 13-px-Schriftrolle und Chevrons verbinden beide Auswahlen. Der Denkaufwand folgt dem Modell mit einem zurückhaltenden Mittelpunkt. Workername und Computer-Use-Einstieg entfallen dort; Hinweise auf eine Vertretung stehen bei Bedarf innerhalb der Modellwahl. Anhänge stehen oberhalb. Diffs behalten Plus/Minus und nutzen Erfolgs-/Fehlerfarben für hinzugefügte/entfernte Zeilen. Explizite lokale Ergebnisse, die nicht bereits im Antworttext verlinkt oder als Bild dargestellt sind, liegen in der gemeinsamen ChatArtifacts-Gruppe hinter einer kompakten, zunächst geschlossenen Dateizeile; Vorschau und Download erscheinen beim Aufklappen. Der Vertrag unter surfaces/chat.md beschreibt Ladegrenzen, Fehlerzustände und die Engine-Kompatibilität.


## Menüs und unmittelbare Vorschau

Aktionsnamen in Kontext- und Dropdownmenüs bleiben einzeilig und vollständig lesbar. Kurze Bezeichnungen wählen; weder Zeilenumbruch noch Abschneiden oder Ellipsen als Ersatz für fehlenden Platz. Menüs außerhalb abschneidender Container platzieren und innerhalb des sichtbaren Fensters halten, bei Bedarf oberhalb des Auslösers. Dies auch bei schmalen Fenstern und vergrößerter Schrift prüfen. „Projekt bearbeiten …“ fasst Name, Symbol und Farbe zusammen.

Farbauswahl zeigt die Wirkung unmittelbar am Projektsymbol im Dialog und am bearbeiteten Projekt. Speichern übernimmt die Auswahl, Abbrechen verwirft die Vorschau. Bilder und Dateien lassen sich in das jeweilige Chatpanel ziehen; ein sichtbares Ablageziel, Uploadstatus und entfernbare Anhänge oberhalb der Eingabe gehören zum Ablauf. Bilder erhalten eine Vorschau. Anhängen erhält den Textentwurf und sendet keine Nachricht.

## Eine Überschrift pro Seite

Aufträge, Verbindungen, Skills, Bibliothek und Einstellungen zeigen ihren Titel ausschließlich im gemeinsamen `PageHeading` im Inhaltsbereich. Zugehörige Kopfaktionen stehen auf derselben Linie; eine weitere globale Titel-/Tabzeile entfällt. Verbindungen wird über die Plus-Aktionen des Katalogs erweitert. Ein ausgeblendetes Seitenmenü lässt sich direkt am Seitentitel wieder öffnen. Bestehende Chats werden über Seitenleiste, Suche oder das vorhandene Chatmenü erreicht; im leeren Gespräch steht kein zusätzlicher Öffnen-Link.

Die Profilseite bietet einen editierbaren Standard für kurze, warme Kommunikation und effiziente, vollständige Arbeit. Die Arbeitsgrundlage bleibt als Einstellungsgruppe direkt sichtbar. Ein überspringbarer Dialog bietet beim ersten Öffnen Avatar und Namenswahl an. Details zum Speichern, Zurücksetzen und bestehenden Vorgaben stehen im Vertrag unter `surfaces/settings.md`.

Agenten-Avatare haben keine Kreisumrandung. Optional wählen Nutzer einen von fünf
gedeckten Hintergründen aus der zentralen Palette oder „Ohne Farbe“. Der leere
Chat zeigt den Agenten groß über einer von sechs wechselnden Begrüßungen mit
der eigenen 36-px-Textrolle. Die Auswahl bleibt bei jeder Begrüßung unverändert.

Die Avatare blinzeln gelegentlich und blicken mit kleinen Augenbewegungen in
verschiedene Richtungen. Lange Ruhephasen, unterschiedliche Zeitabläufe und ein
stiller Kopf halten die Bewegung zurückhaltend. Es sind direkte SVG-Animationen;
kein Flackern, keine Maskierung und kein zusätzlicher Hintergrundeffekt.
„Bewegung reduzieren“ lässt die Augen ruhig geöffnet. Unsichtbare Avatare pausieren.

## Gemeinsame Bedienelemente

Aktionsbuttons und Auswahlfelder verwenden `radius-button`, die kompakte
`control-height` und dieselbe kleine UI-Schrift. Iconbuttons sind kreisrund;
`control-target` und auf Touchgeräten `control-touch` bestimmen die Trefferfläche.
Primäraktionen sind neutral invertiert, Nebenaktionen liegen ruhig auf `raised`.
Native Selects bleiben für Tastatur und Formulare erhalten, mit gemeinsamem
Chevron und Themefarben. Auch verschachtelte SettingRow-Aktionen folgen diesem
Muster. Navigation, große Ergebniszeilen und Schalter behalten ihre eigenen
Flächenrollen; `radius-control` bleibt für Eingabefelder und Menüs bestehen.

Der Composer wächst ohne Scrollbalken bis zur CSS-Maximalhöhe. Nur darüber
scrollt er vertikal. Lange Wörter und URLs brechen um. Nach Löschen, Änderungen
an Schriftgröße oder Panelbreite wird die Höhe neu gemessen.

## Schwebende Chatnavigation und Eingabe

Die Startvorschläge verwenden `WelcomeSuggestions`: flache, vollständig runde
Pillen mit `control-height` (32 px) und der transparenten Rolle
`suggestion-glass`, 40 px Hintergrundunschärfe und ohne Rahmen oder Schatten.
Hover und Tastaturfokus nutzen `suggestion-glass-hover`; der sichtbare Fokus
bleibt erhalten. Die Farbrollen folgen der aktiven Farbwelt. In schmalen
Vorschlagsgruppen bis 620 px wechseln sie von small zu caption und blenden die
dekorativen Pfeile aus. Die Gruppe bricht nach verfügbarem Platz um, statt
alle Vorschläge in volle Zeilen zu zwingen. Auf Touch bleibt die äußere
Trefferfläche mindestens 44 px hoch, während die sichtbare Pille flach bleibt.
Lange Texte dürfen wachsen und umbrechen. Ohne Blur oder bei reduzierter
Transparenz gelten surface/raised als deckende Ersatzflächen. Unser Design
verwendet denselben Baustein mit einer lokalen Entwurfsvorschau.

Die Seitenleiste ist eine nach innen versetzte Fläche mit großen Rundungen und Abstand zum Fensterrand. Der Composer verwendet die getönte Farbrolle `composer-blur` mit 40 px Hintergrundunschärfe, verstärkter Sättigung und einer dezenten inneren Glaskante aus `composer-glass-shadow`. Bei reduzierter Transparenz oder fehlender Blur-Unterstützung bleibt die Fläche deckend. Der Verlauf läuft dahinter weiter; sein Endabstand passt sich der Eingabehöhe an. Der Reiseeffekt ist unter Aussehen für neue oder alle Chats wählbar.

Die Einzelansicht zeigt oben nur schwebende Kopfaktionen einschließlich kompaktem Chatmenü. Der Verlauf fadet oben und unter der Schreibfläche aus; Modus und Modell stehen frei auf der Grundfarbe. ScrollEdgeFade blendet scrollende Chat- und Suchlisten ausschließlich an überlaufenden Kanten über den bestehenden 8-px-Abstand aus. Auswahlfläche und Fokus bleiben außerhalb dieses schmalen Randes klar; im erzwungenen Kontrastmodus entfällt die Maske. Lange Seitenleistennamen verwenden am rechten Textrand einen Fade statt Auslassungspunkten, die Ziehkante bleibt im Ruhezustand unsichtbar. Mikrofon und Senden teilen kreisrunde Bedienflächen.

## macOS-nahe Bausteine als verbindliche Referenz

Die vom Nutzer gelieferten Finder- und Systemeinstellungsbilder bestimmen die
Formensprache: flache Gruppen, dünne eingerückte Trennlinien, links klare Labels,
rechts kompakte Steuerungen. Begriffe und Funktionen bleiben produktspezifisch.
Aktionsbuttons sind horizontal mit 6-px-Rundung; Vollrundung gehört zu Schaltern,
Iconflächen, den kompakten Startvorschlägen und dem Composer, niemals zu mehrzeiligen Listeninhalten.
Schalter zeigen eine 36 × 20 px neutrale Spur mit vollständig innenliegendem
16-px-Griff. Die Trefferfläche ist unabhängig davon 40 px, bei Touch 44 px.
Die Griffposition ist absolut und darf nicht durch Button-Flexregeln verschoben
werden. Ein/Aus bleibt zusätzlich über Position und ARIA-Zustand erkennbar.

`SettingRow`, `SettingsNavigationRow` und `SettingsHeader` sind die gemeinsamen
Bausteine. Navigation umfasst Icon, Text und Chevron als eine klickbare Zeile.
Gruppen umfassen alle zusammengehörigen Inhalte, ohne die Fokusumrandung
abzuschneiden. Zeilen haben mindestens 48 px und wachsen mit mehrzeiligem Text.
Auswahlfelder bleiben native Selects; Regler verwenden native Range-Inputs mit
zugänglichem Namen und sichtbarem Wert. Headerbilder nur, wenn sie den konkreten
Gegenstand oder eine Bedienung erklären; kein dekoratives Bild auf jeder Seite.

**Einstellungen → Aussehen → Unser Design** zeigt interaktive Beispiele aus
diesen Produktionsbausteinen. Beispielzustände bleiben lokal. Dies ist die
lebende Referenz neben den zentralen Tokens und Bereichsverträgen; kein zweiter
Skill mit einer duplizierten Wertetabelle. Neue Seiten setzen diese Bausteine
ein und ergänzen neue wiederkehrende Rollen zuerst in `design-system.mjs`.
Prüfung: Hell/Dunkel, Desktop/schmal, große Schrift, Tastatur, lange Texte,
deaktivierte Zustände, Schaltergeometrie und Überlauf.

Einzel- und Mehrfachansicht verwenden schwebende Drei-Punkte-Chatmenüs auf derselben oberen Linie. Ausgeschriebene Paneltitel und eine zusätzliche Panelkopfzeile entfallen. Maximieren und Schließen sind im Panelmenü erreichbar. Alle Verläufe teilen den oberen Fade; die rechte Panelaktion reserviert Platz für die globalen Ansicht-/Workspace-Buttons.

## Aussehen und Designreferenz · CI 1.1

Aussehen beginnt mit einer kompakten Hell-/Dunkel-Auswahl, drei echten
Farbwelt-Vorschauen und der Hervorhebungsfarbe. Auswahl speichert sofort über
den vorhandenen Settings-Endpunkt; Fehler bleiben sichtbar. Gespeicherte Werte
werden bestätigt, bevor die Oberfläche sie übernimmt. Laufende Worker brauchen
nach Änderungen am gemeinsamen Validierungsmodul einen regulären Neustart.

Die Navigationszeile **Unser Design · CI 1.1** öffnet eine eigene Unterseite
mit Rückweg. Segmentierte Bereiche zeigen Bausteine, aktive Farben, Schrift,
Formen und Grundlage einzeln. Keine lange aufgeklappte Gesamttabelle im
normalen Einstellungsfluss. `resolveDesign` in `ui/design-system.mjs` versorgt
App, Vorschaukacheln und Referenz mit exakt derselben vollständigen Palette.
`appearance.mjs` leitet zulässige Auswahlen aus diesen Katalogen ab.
Markenakzent ist fest Terrakotta; Hervorhebung ist eine persönliche Auswahl.
Schalter, Warnungen, Fehler und Projektfarben behalten ihre eigenen Rollen.

### Referenzen und eigene Ableitung (7. September 2026)

Anthropics [offizielle Markenvorgaben](https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md)
nennen Creme #FAF9F5, Dunkel #141413, Hellgrau #E8E6DC und Orange #D97757.
Das sind Markenwerte, keine vollständige Tokenliste der Claude-App. Unsere
warme Variante interpretiert diese Richtung mit eigenen kontrastgeprüften
Flächen; Terrakotta bleibt in den vorhandenen AGENT-Abstufungen.

Die [Codex-Produkteinführung](https://openai.com/index/introducing-the-codex-app/)
und [OpenAI-Designrichtlinien](https://openai.com/brand/) dienen als
Produkt-/Markenreferenz. Eine verbindliche Codex-UI-Palette mit Hexwerten ist
dort nicht belegt. „Neutral“ ist daher ausdrücklich unser Entwurf aus gleichen
RGB-Kanälen für die Hauptflächen, ohne Blaustich. „Ausgewogen“ erhält die
bestehende sanft warme AGENT-Palette. Keine Fremdlogos oder Fremdschriften
werden übernommen.

Der projektbezogene Skill `workspaces/default/skills/ui-design/SKILL.md`
verweist auf diese Quellen und die Produktionsbausteine; er dupliziert keine
Wertetabelle.

## Kompakte Navigation und Suche

Das Hauptmenü zeigt Inbox, Pipeline, Aufträge und die verfügbare Bibliothek in dieser Reihenfolge, darunter Projekte und Chats. Skills und Verbindungen sind eigene Einträge der vorhandenen Einstellungsnavigation. Der Einstieg bleibt im Agentenmenü. Bestehende Icons, Textkanten, Abstände und Inhaltsansichten bleiben erhalten; keine Platzhalter oder reservierten Leerzeilen für künftige Module. Suche und Querverweise öffnen beide Kataloge direkt mit ausgewähltem Einstellungsbereich. Die Einstellungsnavigation scrollt bei Platzmangel innerhalb der Seitenleiste; Zurück-Einstieg und Agentenzeile bleiben erreichbar.

Oben in der Seitenleiste steht eine dunkle Suchpille mit Lupe auf der gemeinsamen Icon-/Textkante. Sie öffnet den Suchdialog mit fokussierter Eingabe. Suche umfasst Gesprächstitel, lokal gespeicherte Nutzer- und Agententexte einschließlich archivierter Chats über alle Projekte, Projektnamen und Navigation/Einstellungen. Treffer zeigen Kontext und Textausschnitt; moderate Tippfehler, Buchstabendreher und Akzente werden toleriert. Werkzeugausgaben, interne Überlegungen und reine Kanalgespräche sind ausgeschlossen. Fehlende lokale Exporte werden als eingeschränkte Inhaltssuche kenntlich gemacht; es wird kein Worker für die Suche gestartet.

Navigation und Chatzeilen haben am Desktop mindestens 32 px Höhe, bei Touch mindestens 44 px. Die Projektüberschrift steht mit 8 px Abstand unter der Navigation, weitere Projekte mit 4 px Abstand. Unten bleibt eine kompakte 40-px-Agentenzeile mit 24-px-Avatar. Reine Iconbuttons sind systemweit kreisrund, einschließlich Plus-Hover im Composer.

Der Update-/Neustart-Button ist eine kleine transparente Glaspille mit 40-px-Blur, verstärkter Sättigung und 14-px-RotateCcw-SVG, ohne Rand, Lichtsaum oder Schatten. Text bleibt lesbar und erklärt die Aktion. Reduzierte Transparenz und fehlende Blur-Unterstützung erhalten eine deckende Ersatzfläche.

Die globale Suche verwendet die transparente `sheet-glass`-Fläche ohne Glanzrand und 40 px Hintergrundunschärfe. Die gesamte Kulisse wird mit `overlay` abgedunkelt und um 8 px weichgezeichnet. Das Suchfeld verwendet wie die Suchpille der Seitenleiste `workspace-backdrop`, ohne native Suchfelddekoration oder Fokusrahmen. Fokus zeigen Schreibmarke und hervorgehobene Lupe; im erzwungenen Kontrastmodus bleibt ein Systemrahmen erhalten. Treffer bleiben flach, gruppiert und mit sichtbarem Tastaturfokus bedienbar. Reduzierte Transparenz und fehlender Blur erhalten eine deckende Glasfarbe.

Aktualisieren lädt die Oberfläche direkt ohne Bestätigungsdialog neu. HTML und Assets werden mit `Cache-Control: no-store` ausgeliefert; laufende Serverantworten bleiben bestehen. Nur ein tatsächlicher Serverneustart verwendet die bestehende Session-Bestätigung.

Neustarten und anschließendes frisches Laden gehören zu einer Aktion. Die gemeinsame
SystemNotice bleibt während Anfrage und Wiederanlauf als dieselbe zentrierte,
randlose Pille stehen: feste Buttonbreite, „Neustarten …“ und die ausgewählte System-Ladeanzeige über `AppLoader`. Keine wechselnden Vorbereitungs-, Erfolgs- oder Aktualisieren-Buttons.
Erst die Antwort einer neuen Serverinstanz löst genau ein automatisches Neuladen
aus; Antwort der alten Instanz und Verbindungsunterbrechung gelten nicht als Erfolg.
Ein UI-Update alleine lädt direkt. Ein echter Serverneustart hat Vorrang, wenn
beides erforderlich ist. Session-Bestätigung, Anmeldung und echte Fehler bleiben
verständlich erreichbar. Stil, Größe und Tempo entsprechen der Systemauswahl. Reduzierte Bewegung zeigt die Ladeanzeige statisch; Dauerrollen
für Rückmeldung und Fortschritt stammen aus der zentralen Designquelle.

## Verbindliches Prüftor vor Übernahme

`npm --prefix wrapper run design:verify` ist vor jeder Übernahme von UI-Code
auszuführen. Der Befehl prüft die vollständigen Bäume `wrapper/ui/` und
`wrapper/public/`, die Design-/Appearance- und Scanner-Regressionstests sowie
TypeScript. Neue Unterordner sind automatisch erfasst, auch nicht importierte
Demos. `node wrapper/build.mjs` führt die statische Prüfung selbst vor Vite aus;
ein fehlerhafter Baum ersetzt keinen Produktionsbuild. `publish-source.py`
prüft vor dem Kopieren/Übernehmen. Der GitHub-Workflow `Design gate` prüft
Pull Requests und main-Pushes. Die lokalen Hooks unter `.githooks/` prüfen
Commits, Merge-Commits und Pushes. Aktivierung in einem neuen Checkout:
`git config core.hooksPath .githooks`. Staged UI und geprüfte Arbeitskopie
müssen identisch sein. Ein Push muss die geprüfte ausgecheckte Revision
verwenden. Fast-forward-Merges haben keinen Git-Vorab-Hook; die Prüfung ist
dafür vor dem Merge manuell auszuführen. Serverseitige Branch Protection ist
eine gesonderte Repository-Einstellung, keine Behauptung dieses Prüftors.

### Automatisch geprüft

- CSS über PostCSS, JSX/TSX/JS/TS über den TypeScript-Parser, HTML auf eingebettete Styles; keine Beschränkung auf styles.css.
- Farbwerte einschließlich Hex/RGB/HSL, benannter Farben und Farbverläufe; Schriftfamilie, Größe, Gewicht, Zeilenhöhe und Laufweite; sichtbare Abstände und Radien als zentrale Tokens.
- Statische Tokenreferenzen über alle Dateien, synchron erzeugte Token-CSS und Kontraste sämtlicher wählbarer Paletten. Lokale Geometriemaße wie Breiten, SVG-Koordinaten und Breakpoints sind keine zweite Abstandsskala.
- Harte und dynamische Inline-Stile, eingebettete Stylesheets, fremde Tailwind-Farb-/Typografie-/Abstandsskalen, lokale Font-Registrierung und nicht unterstützte neue Quellformate.
- Gemeinsame Einstellungszeilen, Seitenköpfe und Dialoge; Schalterzustand und gemeinsame Schalterdarstellung, Namen von Iconbuttons/Bildern, Tastaturbedienbarkeit von Klickflächen.
- Vorhandene wirksame gemeinsame Fokus-, Disabled-, Auswahl- und Reduced-Motion-Regeln; entfernte Fokusumrandungen werden gesondert geprüft.

### Geprüfte Sonderfälle statt pauschaler Freistellung

`scripts/design-exceptions.json` enthält ausschließlich konkrete Fundstellen
(Datei, Regel und exakter Ausdruck) mit fachlicher Begründung. Bestehende
Ausnahmen umfassen versteckte zugängliche Beschriftungen, Fokus am umgebenden
Suchfeld, native Markdown-Eventdelegation, den nichtmodalen Modell-Popover,
direkte Katalogwerte und proportionale Geometrie des gemeinsamen Loaders.
Neue oder veränderte Ausdrücke sind erneut prüfpflichtig; verwaiste Einträge
schlagen fehl. Keine pauschale Dateiausnahme oder automatische Baseline.

SVG-Markenassets und eigene Avatarzeichnungen werden mit begründetem SHA-256
in `scripts/design-assets.json` erfasst. Neue oder geänderte Motive verlangen
eine erneute Sicht-/Quellenprüfung. Rasterbilder und Font-Binärdateien werden
inventarisiert, aber nicht als CSS gelesen; Fontdateien und Lizenzen haben
eigene Tests. Die kanonische Designquelle wird durch Schema-/Kontrasttests
geprüft; generierte Tokens werden exakt mit ihrer Quelle verglichen.

### Grenzen und ergänzende Abnahme

Statische Prüfungen beweisen keine CSS-Kaskade, DOM-Erreichbarkeit aller
lokalen Variablen, sinnvollen Texte oder vollständigen Async-Zustände.
Laden, Leerzustand, Fehler, Erfolg, Tastatur, Touch, Zoom und reduzierte
Bewegung bleiben in den passenden Funktionstests und der Sichtprüfung des
betroffenen Bereichs verpflichtend. Fehlende Browserbelege ausdrücklich
ausweisen. Die nicht ausgelieferte Legacy-App unter `frontend/` hat weiterhin
einen eigenen Vertrag und ist nicht der Wrapper.

Nachrichtenaktionen erscheinen bei Hover oder Tastaturfokus und bleiben auf Touch sowie bei aktiver Wiedergabe erreichbar; bei Platzmangel brechen sie um.
Löschen nutzt den bestehenden Papierkorb-Iconbutton und Bestätigungsdialog.
Vorlesen nutzt denselben IconButton mit Lautsprecher, Vorbereiten und Stoppen;
Anbieter und Anschlussstellen führt die zentrale Systemlandkarte.

## Skeleton Loader

`ui/skeleton.tsx` ist der gemeinsame Platzhalter für erstmals geladene Inhalte:
Listen, Einstellungszeilen, Gesprächsverläufe, Dokumente, Medien und App-Start.
Seitenkopf, Filter und erreichbare Navigation bleiben stehen. Formen passen sich
der verfügbaren Breite an, ohne erfundene Texte oder Prozentwerte. Farben und
Abstände verwenden die bestehenden Rollen, die ruhige Pulsdauer kommt aus
`motion-skeleton-duration`. App-/Systemvorgaben für reduzierte Bewegung zeigen
statische Formen; außerhalb des Sichtbereichs und bei verborgenem Tab pausiert
die Animation. Dekorative Formen sind nicht fokussierbar und vor Screenreadern
verborgen; genau eine Statuszeile benennt den Ladevorgang.

Skeletons erscheinen nur, solange echte Inhalte fehlen. Aktualisierungen
erhalten vorhandene Daten; Laden, leer und Fehler bleiben getrennte Zustände.
Bei Medien bleibt das echte Element unter dem Platzhalter gemountet, damit
Ladeabschluss, Fehler und Zeitlimit den Platzhalter zuverlässig beenden.
Laufende Worker, Speichern und andere Aktionen behalten den AppLoader bzw.
ihren bestehenden Arbeitsstatus. Aussehen → Unser Design zeigt die Bausteine.

## Rechte Workspace-Fläche

Der rechte Bereich „Workspace“ verwendet die eigene Rolle `workspace-panel-bg`: in allen dunklen Farbwelten Schwarz als Basis. Die fast deckende `workspace-panel-glass`-Fläche mit 32 px Hintergrundunschärfe, zwei sehr schwachen diffusen Helligkeitsverläufen (`workspace-panel-sheen`), einer feinen inneren Lichtkante und weichem Außenschatten (`workspace-panel-shadow`) gibt dem Bereich dezente Tiefe. Diese Materialgestaltung folgt der Apple-Bildreferenz; sie bleibt klar vom Chat abgegrenzt. Ohne Blur-Unterstützung oder bei reduzierter Transparenz wird die schwarze Basis deckend. Im hellen Erscheinungsbild bleibt die bisherige Farbzuordnung erhalten. App-Grundfläche und Suche behalten `workspace-backdrop`. Nur diese rechte Fläche wird dunkler; die linke Navigation behält `sidebar`. Der Workspace öffnet direkt Dateien; die drei großen Startkacheln entfallen. Dateien, Änderungen und die Nebenfunktion Befehle sind über die kompakte Auswahl im Kopf erreichbar. Rundung, Innenabstand und Farbzuordnung gelten ebenso in schmaler und vergrößerter Ansicht. Die Bausteinreferenz zeigt die gemeinsame Workspace-Basisfarbe.

## Bibliotheksvorschau

`LibraryPreview` erweitert den gemeinsamen Modal um Quick Look: dieselbe transparente `sheet-glass`-Fläche und weichgezeichnete Kulisse wie die Suche, kompakter Titel, große Medienfläche und ruhige Aktionen. Dateidetails sind aufklappbar; Pfeile navigieren durch die zuletzt geänderten gefilterten Dateien. Reduzierte Transparenz erhält die deckende `glass`-Ersatzfläche. Die Bibliothek verwendet kompakte flache Ergebniszeilen mit Name, Art und Änderungsdatum oder ein umschaltbares Bildraster ohne Kartenhintergründe. Ein Klick markiert und zeigt rechts den gemeinsamen Workspace-Stil mit FileContent; Vergrößern öffnet Quick Look. Die Reiter Dateien/Wissen und Notizen entfallen. Suche und Filter sind kompakt, die Ansichtspräferenz bleibt lokal gespeichert.

## Ruhiger Gesprächsfluss

Ab Beginn steht über der Agentenantwort eine eigene Autorenzeile: ausgewählter Avatar, tatsächlicher Agentenname und relatives Nachrichtenalter (zum Beispiel „vor 2 Min.“). Der exakte Zeitstempel bleibt im Tooltip und time-Element zugänglich. Direkt unter dem jeweils neuesten Antworttext, vor den bei Hover eingeblendeten Nachrichtenaktionen, stehen ausgewählter AppLoader, Live-Status, Schrittanzahl und tatsächliche Bearbeitungszeit. Diese aufklappbare ActivityGroup wandert beim Streaming mit dem Text nach unten und bleibt nach Abschluss dort als kompakter Verlauf erhalten. Ohne Werkzeuge steht der kompakte Arbeitsstatus ebenfalls direkt unter dem Text vor den Aktionen. Die Aktionszeile reserviert keinen Platz zwischen Text und Status. Die Anzeige liegt im normalen Gesprächsfluss, ohne Inhalte zu überdecken; manuelles Hochscrollen pausiert weiterhin das automatische Mitlaufen. Der Spinner endet mit der Arbeit und behauptet keinen weiteren Fortschritt.

Zwischenmeldungen bleiben während der Arbeit im Gespräch sichtbar. Sobald eine abschließende Antwort vorliegt und die Arbeit beendet ist, werden Zwischenmeldungen und Werkzeugschritte in ihrer ursprünglichen Reihenfolge in die automatisch geschlossene Gruppe aufgenommen. Aufklappen zeigt den vollständigen Ablauf. Laufende oder fehlgeschlagene Turns ohne Abschlussantwort verlieren ihre sichtbaren Zwischenmeldungen nicht. Nutzernachrichten und Antworten behalten ihre Reihenfolge; Nachträge werden nicht vor die erste Nutzernachricht verschoben.

Antworten nutzen die zentrale 15-px-Rolle conversation und die native Systemschrift (auf macOS San Francisco). Nutzernachrichten und Desktop-Eingabe nutzen control (14 px); Touch-Eingabe bleibt in reading. Links verwenden blue und Unterstreichung. Routinemäßige Prüfberichte werden nicht als Abschlussanhang erzeugt oder verlinkt. Dateien gehören in die Antwort, wenn sie ein angefragtes oder direkt nützliches Ergebnis liefern, etwa eine HTML-Visualisierung.

Bei Nutzernachrichten bleibt die Uhrzeit eng unter dem Text; bei Agentenantworten ersetzt das relative Alter in der Autorenzeile die zusätzliche Uhrzeit am Fuß. Nachrichtenaktionen erscheinen auf Desktop bei Hover oder Tastaturfokus ohne Layoutsprung; auf Touch bleiben sie mit mindestens 44 px Bedienfläche sichtbar. Der aktive Vorlesen-Stoppen-Button bleibt erreichbar.

## Dezentes Flächenlicht

Seitenleiste und Workspace verwenden den gemeinsamen dekorativen Baustein `PanelLight`. Die Seitenleiste behält ihre hellere Grundfläche `sidebar` und erhält über `sidebar-material-shadow` eine sehr feine innere Kante; `sidebar-sheen` zeigt zwei diffuse, schwache radiale Verläufe. Der Workspace nutzt seine bestehende schwarze Materialfläche und `workspace-panel-sheen`. Nur die Lichtschicht bewegt sich, um jeweils wenige Prozent, mit 48 Sekunden je Richtung, sanften Wendepunkten und gegenläufiger Phase links/rechts. Dauer und Easing liegen in der zentralen Designquelle. Keine zufälligen Sprünge, kein Pulsieren von Text oder Kante.

Aussehen → Visuell → Flächenlicht bietet Aus, Ruhend und Sanft bewegt (Standard). Die Auswahl wird gemeinsam mit den bestehenden Darstellungseinstellungen validiert und gespeichert. App- und Systemvorgaben für reduzierte Bewegung zeigen statische Verläufe. Versteckte Tabs, eingeklappte Seitenleisten und nicht sichtbare Flächen pausieren. Nur die Dekoration wird an den Rundungen beschnitten; Menüs, Tastaturfokus und Ziehkanten bleiben erreichbar. Erzwungener Kontrast blendet die Dekoration aus. Unser Design zeigt denselben Baustein.


Das Terminal im Workspace verwendet einen transparenten Inhaltsuntergrund, damit die gemeinsame dunkle Materialfläche mit Lichtverlauf bis zur Eingabe durchgeht. Es legt keine eckige deckende Fläche über die abgerundete Workspace-Hülle. Ausgabe, Eingabe und deren Fokus bleiben unverändert bedienbar.

Die Gesprächsschrift ist bewusst zurückhaltend: Antworten 15 px bei normalem Gewicht und 1,5-fachem Zeilenabstand, Nutzernachrichten, Zwischenmeldungen und Desktop-Eingabe 14 px in derselben Systemschrift. Absätze trennen 12 px, der letzte Absatz hat keinen Endabstand. Markdown-Hervorhebungen nutzen semibold; Überschriften bleiben mit reading (16 px) kompakt. Browserzoom und gespeicherte Schriftgrößenskalierung bleiben wirksam; Touch-Eingabe behält mindestens die bestehende reading-Rolle.


## Kompakter Workspace als Arbeitsbegleiter

Der Workspace dient dem Nachsehen und Prüfen neben dem Gespräch: Dateien sind der direkte Einstieg, Änderungen eine weitere Ansicht, Befehle ein manuelles Zusatzwerkzeug. Er startet bei jedem Öffnen mit 280 px; Vergrößern und Ziehen bleiben explizite Aktionen. Es gibt keine drei großen Startbuttons und keine automatische Breitenänderung beim Ansichtswechsel.

Kopf und Bereichsauswahl nutzen control (14 px), Dateizeilen und Begleittexte small (13 px), Pfad-/Statusangaben und Befehlsausgaben caption (12 px). Die gewählte Textskalierung bleibt wirksam; Touch-Eingaben verwenden reading, Touchziele mindestens 44 px. Ordner stehen vor Dateien, beide natürlich nach Namen sortiert. Der Ordnername und eine kompakte relative Pfadzeile ersetzen den ausgeschriebenen absoluten Systempfad; dieser bleibt im Tooltip. Kopf und Eintragsstatus bleiben stehen, nur die Dateiliste scrollt. Geschützte Einträge sind standardmäßig ausgeblendet und über einen beschrifteten Button einblendbar; Zugriffsrechte bleiben erhalten.

„Befehle“ verwendet normale UI-Schrift im Leerzustand, Monospace nur für Eingabe und tatsächliche Ausgabe. Der kurze Hinweis benennt Einzelaufrufe und das 30-Sekunden-Limit. Die Eingabe bleibt unten als kompakte getönte Zeile. Die gemeinsame schwarze Materialfläche, feine Kante und Lichtbewegung bleiben in allen Ansichten sichtbar. Der Bereich ist kein persistentes Terminal und bietet keine neu erfundene native Finder-/Terminal-Anbindung.


Avatar und Bearbeitungssymbol teilen eine feste senkrechte Mittelachse: Die Signatur reserviert `control-turn-loader-slot` (19,2 px, entsprechend dem 16-px-AppLoader mit Faktor 1,2) und zentriert darin den 24-px-Avatar per Flexbox. Eine spezifische Autorenregel verhindert, dass allgemeine Avatarregeln diese Größe überschreiben. Keine nachträgliche Transform-Verschiebung. Der bisherige Abstand zum Namen bleibt erhalten. Auch das statische Aktivitätssymbol nach Abschluss nutzt denselben Symbolplatz; der laufende Loader und sein Statustext bleiben unverändert. Name und relative Zeit stehen in einer eigenen, an der Textgrundlinie ausgerichteten Flexgruppe und dürfen bei Platzmangel umbrechen.

## Inbox

Inbox verwendet das offene Ablagefach `Tray` aus Framework7 Icons über den gemeinsamen `Inbox`-Export in `ui/icons.jsx`, sowohl im Hauptmenü als auch im Leerzustand.

Die Inbox übernimmt wie Einstellungen die bestehende linke Seitenleiste mit Zurück-Einstieg, Suche und kompakter Gesprächsliste. Kanal-Icon, Name, Uhrzeit und Ungelesen-Punkt genügen; Betreff-/Vorschauunterzeilen entfallen. Die volle Hauptfläche zeigt Verlauf und eine automatisch wachsende, ausschließlich vertikal scrollende Antwortzeile. Bis 650 px Fensterbreite wechseln Liste und Verlauf in voller Breite. Beispiele und Speichergrenzen werden ausschließlich im Konzeptdialog erklärt. PageHeading, FilterPicker, BrandIcon, Modal und zentrale Tokens bleiben gemeinsam; InboxConversationRow steht unter Unser Design. Aufbau und Verhalten führt [surfaces/inbox.md](surfaces/inbox.md).

Bibliotheks-Quick-Look bleibt eine reine Großansicht ohne doppelte Dateiverwaltung. Dateiaktionen stehen im rechten Workspace. Markdown nutzt dort den bestehenden bereinigten Renderer mit kompakten Dokumentrollen statt Editorfläche. Der Liste/Raster-Umschalter verwendet Symbolbetonung ohne rechteckige Auswahlfüllung; sämtliche Iconbuttons bleiben rund.


Der leere Composer zeigt auf Desktop und Handy nur „Nachricht“ in der zurückhaltenden Rolle `faint`, vertikal zentriert mit 2 px optischer Absenkung. Die leere Schreibzeile bleibt eine volle Pille; ausschließlich tatsächlicher mehrzeiliger Text oder die aktive Aufnahme erweitern die Rundung. Die Höhenmessung berücksichtigt den Textinnenabstand und ignoriert Platzhalterumbrüche für den Mehrzeilenzustand.

Dateiminiaturen verwenden LibraryThumbnail: echte erste PDF-Seite, Textausschnitt, Bild oder Videostandbild. Audio und nicht unterstützte Formate erhalten ein ruhiges Formatsymbol mit Endung. PdfPreview ist der gemeinsame lokale PDF-Lesebaustein mit Seitensteuerung und Lade-/Fehlerzuständen. Dokumentformen, Typografie und Abstände verwenden vorhandene Tokens.


Erneut ausführen sendet die ursprüngliche Nachricht samt Anhängen als neuen Turn in derselben Session. Chat-ID, Titel, bisheriger Verlauf und Composer-Entwurf bleiben erhalten; es entsteht kein Seitenleistenduplikat. Während Übertragung und laufender Antwort ist die Aktion gesperrt. Kopieren schreibt ausschließlich in die Zwischenablage. Verzweigen ist eine separate Aktion an der Antwort und übernimmt den Verlauf bis einschließlich des gewählten Turns. Bearbeiten und Verzweigen bleibt ausdrücklich beschriftet.


Skeletons übernehmen die produktiven Layoutklassen: integration-grid/-item für Verbindungen und Skills, library-entries-list/-grid und library-entry für Dateien, job-row/-info für Aufträge sowie SettingRow für Einstellungen. Die Suche teilt ihre Zeilengeometrie mit system-search-placeholder. Textformen reservieren echte Schriftzeilen (lh/em); Chatblasen, Absätze und Signatur folgen dem Gesprächslayout. Keine allgemeine Kartenhöhe über alle Bereiche. Layoutwechsel und mobile Spalten folgen denselben Regeln wie geladene Inhalte.

## Modellwahl mit Anbieterbereichen

Die gemeinsame `ModelPicker`-Komponente bietet kompakte anklickbare Codex- und Claude-Code-Bereiche mit vorhandenen Original-Markenassets aus `BrandIcon`. Die höchstens 300 px breite `popover-glass`-Fläche ist stärker transparent als ein Dialog, mit 28 px Hintergrundunschärfe, verstärkter Sättigung, feinen Lichtkanten und dezentem Schatten. `popover-glass` und `popover-glass-shadow` führen die hellen und dunklen Materialwerte zentral. Die Fläche hat keinen diagonalen Verlauf. Modellzeilen bleiben flach und mindestens 32 px hoch; Touchziele mindestens 44 px. Kein zusätzlicher Fertig-Fuß.

Denkaufwand steht unter einer feinen Trennlinie mit eigenem Innenabstand. Der gemeinsame `AmountSlider` unter `ui/components/ui/amount-slider.tsx` adaptiert ausschließlich den vom Nutzer gelieferten Regler. Radix liefert die zugängliche Bedienung, `ReasoningSlider` die native Beschriftung und Übernahme. Das Terrakotta-Quadratfeld folgt `brand-accent`; Länge und Tempo steigen mit der Stufe. Die Geometrie und Bewegungswerte stehen in `amountSliderGeometry` und `amountSliderMotion`. Der Glasknopf folgt beim Ziehen flüssig, wird in der Nähe der vorhandenen Stufen magnetisch und rastet beim Loslassen auf der nächsten Stufe ein; darüber wechselt deren Originalname ohne Layoutsprung. Ziehen zeigt eine Vorschau, Loslassen übernimmt genau einmal. Untere Endbeschriftungen entfallen. Native Default-/Auto-Optionen sind Rücksetzaktionen neben der Überschrift, keine zusätzlichen Sliderstufen. Solange die Voreinstellung gilt, zeigen weder Griff noch Quadratfeld einen erfundenen Zahlenwert. Der Codex-Fast-Schalter sitzt als flacher Blitz-Button im selben Popover; gedrückter Zustand, zugänglicher Name und Hinweis auf höheren Verbrauch gehören dazu. Er erscheint nur bei nativ gemeldeter Fast-Service-Tier. Pfeiltasten, Home/End und PageUp/PageDown bleiben bedienbar. Native Ablehnung stellt die bestätigte Auswahl wieder her. Ohne Denkstufen entfällt der Regler; bei genau einer Stufe bleibt deren Name stehen.

Die Animation läuft nur im sichtbaren geöffneten Menü. Verdeckte Tabs, nicht sichtbare Regler und Übertragungen pausieren; App-Einstellung „Bewegung reduzieren“ und die Systemeinstellung zeigen ein statisches Quadratfeld. Themes werden auch im Canvas sofort übernommen. Erzwungener Kontrast zeigt reine Systemkonturen. Keine Geldanzeige, Beispielbuttons oder Bildassets aus dem Demo.
Originalstufen und Verfügbarkeit stammen aus dem jeweiligen nativen Anschluss, niemals aus einer anbieterübergreifenden Übersetzungstabelle. Laden, fehlende Anmeldung, Fehler und erneuter Versuch bleiben im Popover sichtbar. Reduzierte Transparenz und fehlende Blur-Unterstützung erhalten `glass` als deckende Fläche. Escape und Außenklick schließen; Fokus, Browserzoom und Bildschirmtastatur bleiben berücksichtigt. Aussehen → Unser Design zeigt denselben Baustein mit als Beispiel gekennzeichneten lokalen Daten. Ablauf und Anbieterwechsel führt `surfaces/chat.md`.


## Pipeline

Die Pipeline ist eine ausdrücklich beauftragte bedienbare Designstudie im Hauptmenü. Data bleibt als gemeinsamer Datenkern im Hintergrund. Vier Phasen mit ruhigen Karten, gemeinsamer PageHeading, Suche und Modal folgen [surfaces/pipeline.md](surfaces/pipeline.md). PipelineCard zeigt Kunde, Vorgang, Wert und datierten nächsten Schritt und wird unter Unser Design wiederverwendet. Vier, zwei oder eine Spalte folgen der verfügbaren Fensterbreite. Beispiele sind sichtbar bezeichnet; offene Vorgänge verlangen Aktion und Datum. Keine zweite Palette, kein externer Abgleich in der Designstudie.


Die Eingabenavigation verwendet `ChapterScrubber` unter `ui/components/ui`. Position links bei 20 % und maximale Höhe 45 % bleiben erhalten. Eine gemeinsame Federbewegung erzeugt eine Kosinuswelle über benachbarte Striche; die einzelne Glasvorschau folgt innerhalb des Panels. Die Werte stehen in `scrubberSprings`. Klick und Enter springen weiterhin zur Nutzernachricht; Pfeiltasten, Home und End steuern den einzigen Tabstopp. App- und Systemvorgaben für reduzierte Bewegung zeigen die Welle ohne zeitliche Animation. Keine dauerhafte Dekoration.

## Routine-Ergebnisse

Die Glocke öffnet ein gemeinsames Benachrichtigungsmodal. `NotificationRow`
erweitert die vorhandene `SettingsNavigationRow` mit Neu/Gelesen und Datum;
Unser Design zeigt denselben Baustein. Ergebnistext nutzt den gemeinsamen
Markdown-Renderer, Aktionen führen zur Ausführung oder ihrem Chat. Zielauswahl,
Wochen-/Einmalpläne und Fehler bleiben im vorhandenen Field-/JobForm-Muster.
Der Punkt signalisiert ungelesene Ergebnisse oder Rückfragen, kein bloßes
Speicherereignis. Lesestatus bleibt dauerhaft gespeichert. Aufbau und Grenzen
stehen in `surfaces/jobs.md`; keine weitere Hauptseite wird eingeführt.
