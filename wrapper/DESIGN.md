# AGENT · CI 1.1

Die Oberfläche ist eine ruhige lokale Arbeitszentrale. Sie verbindet die Klarheit einer Entwickleroberfläche mit warmen neutralen Flächen und macOS-typischer Navigation, gruppierten Einstellungen und zurückhaltenden Bedienelementen. Die Assistentenidentität beginnt als „Agent“ mit der Pixelfigur Lumi. Sechs eigene Pixelfiguren sind unter „Dein Agent“ auswählbar, passen sich dem Erscheinungsbild an und zeigen auf der Schreibzeile den Sitzungsstand. Der Anzeigename wird zentral in soul/IDENTITY.md konfiguriert. Die bestehende Informationsarchitektur, Icons und Funktionen bleiben erhalten.

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

### Aufmerksamkeit in der Chatliste

Die Lesebestätigung folgt dem sichtbaren ausgewählten Chat im aktiven Fenster.
Nach Ende des Ladens und Abschluss der Antwort wird der fertig gerenderte Verlauf
nach einem Browser-Paint als gelesen bestätigt. Composerfokus und Scrollposition
sind keine Voraussetzung. Das gilt auch für das wiederhergestellte aktive Panel;
weitere sichtbare oder verborgene Panels bleiben ungelesen. Beim Chatwechsel muss
der geladene Verlauf zur ausgewählten Chat-ID gehören. Der grüne Haken blendet
nach bestätigtem Speichern mit `motion-feedback-duration` aus, ohne Layoutsprung.
Reduzierte Bewegung entfernt ihn direkt. Keine neue Speicherung oder Migration.
Klicks auf Freiflächen, Nachrichten und Bedienelemente wählen die zugehörige Pane
und aktivieren die vorhandene Composer-Kontur. Sie setzen keinen Schreibfokus;
das Eingabefeld wird weiterhin direkt fokussiert. Scrollen allein wählt keine Pane.

`ComposerFocus` markiert nur die Eingabehülle: inaktive Composer bleiben mit
90 % Deckkraft leicht gedämpft, die aktive Eingabe behält ihre normale Deckkraft
und eine 1-px-Kontur. Ein breiter, gedämpfter neutraler Schimmer läuft bei Auswahl kontinuierlich
in 18 Sekunden entlang derselben Kante, mit gleichmäßigem nahtlosem Umlauf. Der Lichtbogen umfasst 110 Grad mit weichen Flanken; 250 Grad bleiben ohne Schimmer. Die ruhige Grundkontur ist schwächer als der wandernde Bogen (14 % in Dunkel, 18 % in Hell). Keine ganze Pane wird beleuchtet.
Mehrzeilige Eingaben übernehmen dieselbe Rundung, Menüs und Trefferflächen bleiben
frei. Farben, Deckkraft und Dauer liegen in der zentralen Designquelle. Verborgene
Ansichten pausieren; reduzierte Bewegung zeigt nur die ruhige Kontur und erzwungener
Kontrast eine Systemkontur. Die Dauerbewegung ist über Aussehen → Bewegung reduzieren abschaltbar;
die statische Auswahlkontur bleibt dabei sichtbar.
Unser Design zeigt vier Eingaben mit demselben Baustein. Visuelle Anregung:
[Border Trail](https://21st.dev/community/components/motion-primitives/border-trail),
eigene Umsetzung ohne importierten Fremdcode oder neue Abhängigkeit.

Chatnamen ohne offenen Status verwenden `muted`; laufende Chats, ungelesene
Antworten, Fehler und Unterbrechungen verwenden `text`. Der vorhandene
zugänglich beschriftete Chatstatus steuert diese Hervorhebung auch bei Hover
und Touch. Die Auswahlfläche bleibt davon unabhängig, die Reihenfolge stabil.
Ungelesene abgeschlossene Antworten behalten den grünen Haken aus dem
Iconkatalog mit einer zusätzlichen Kontur von 2 SVG-Einheiten; laufende Chats
verwenden weiterhin den ausgewählten AppLoader. Keine neue Ladevariante.
Nach bestätigtem Lesen entfällt die Hervorhebung über den bestehenden Lesestatus.
Diese Darstellungsänderung benötigt keine Datenmigration.

## Schriften und Lizenznachweise

Die Font-Dateien und vollständigen SIL-OFL-1.1-Lizenztexte liegen unter `ui/assets/fonts/`. Originalquellen und SHA-256-Prüfsummen stehen in `sources.json`. Die Originalschriften werden unverändert ausgeliefert. Inter stammt aus Release v4.1; die genaue IBM-Plex-Revision ist im Quellenverzeichnis festgehalten. Die Schriftlizenzen sind direkt in der Aussehen-Ansicht aufklappbar. Fonts werden ausschließlich vom lokalen Server geladen; keine Abhängigkeit von einem externen Font-CDN. Die bestehende Content Security Policy bleibt erhalten.

## Prüfung dieser Einführung

Produktionsbuild, automatisierte Farbkontraste in beiden Paletten, Synchronität zwischen Designquelle und generiertem CSS, Auflösung sämtlicher verwendeter CSS-Variablen sowie WOFF2-Header und beiliegende Lizenzen werden geprüft. Browserkontrollen decken die CI-Ansicht in Hell/Dunkel bei 1440, 390 und 320 CSS-Pixeln, Font-Laden, Theme-Wechsel, Aufklappen und Überlauf ab. Ein vollständiger VoiceOver-Audit ist damit nicht verbunden.

Der Impeccable-Scan meldet Inter als verbreitete Schrift sowie die bestehende Zitatlinie im Markdown. Inter ist hier bewusst wegen der gewünschten klaren, macOS-nahen Arbeitsoberfläche gewählt. Die Zitatlinie bezeichnet ein Zitat, keine dekorative Karte.

## Chat und Personalisierung

Eine schmale Eingabenavigation mit Vorschau springt zu Nutzernachrichten. Uhrzeit und Nachrichtenaktionen bleiben außerhalb der Bubble; Löschen liegt im Mehr-Menü. Bildanhänge stehen als Vorschauen über dem Text. Der Sprung zur neuesten Nachricht erscheint beim Lesen älterer Inhalte. Allgemeine Auswahlzustände und Schalter sind neutral; Orange ist keine Standardfarbe für Bedienelemente. Ein-/Aus-Einstellungen und Zeitpläne verwenden denselben Schalter. „Dein Agent“ zeigt die Figur, bearbeitet Name und persönliche Arbeitswünsche direkt und bietet sechs Pixelfiguren im gemeinsamen Auswahlfenster an; letztere werden in einem abgegrenzten Abschnitt der vorhandenen Identitätsdatei gespeichert. Ein Versionsvergleich verhindert das Überschreiben zwischenzeitlicher Dateiänderungen beim Speichern.

## Mehrfachansicht und Chat-Kopf

Die Einzelansicht ist der Standard. Oben rechts steht links vom Workspace-Icon die Chat-Ansicht mit 1–4 Panels. Die Auswahl „1 Chat“ behält das zuletzt aktive Panel. Panels haben unabhängige Eingaben, Anhänge, Modelle, Verläufe und Scrollpositionen. Ausgeblendete Panels bleiben während der Sitzung gemountet; auch ein Wechsel zu Einstellungen entfernt sie nicht. Alle Panels teilen einen Eventstream. Die verfügbare Breite des Chatbereichs entscheidet über die Spaltenzahl (400 px Mindestbreite pro Spalte); zusätzliche Panels sind über Tastatur-bedienbare Tabs erreichbar. Trennlinien lassen sich ziehen oder mit Pfeiltasten verschieben. Maximieren ist vorübergehend; Schließen entfernt nur das Panel aus der Ansicht.

Bestehende Chats und benannte Entwürfe zeigen ein Drei-Punkte-Menü; unbenannte Entwürfe erhalten keine „Neuer Chat“-Beschriftung in der globalen Leiste. Bei mehreren Panels steht das Menü im zugehörigen Panel, der Titel bleibt im Tooltip zugänglich. Die Chatleiste besitzt keine untere Trennlinie. Das Menü öffnet ein Dropdown mit Umbenennen, Anpinnen, Teilen, Fork, Kopieren, Markdown-Export, Chatwechsel und Archivieren. Auch ein neuer Entwurf kann bereits benannt werden. Teilen bietet den Gesprächsinhalt, einen lokalen Deep Link und, falls verfügbar, die Systemfreigabe. Lokale Links werden ausdrücklich als solche bezeichnet; es gibt keinen öffentlichen Freigabedienst.

Der Agent steht oben links als gemeinsamer Avatar-/Namensbutton mit einem dezenten, nicht separat bedienbaren Verbindungspunkt. Sein zugänglicher Name nennt den Verbindungszustand. Klick öffnet das gemeinsame ChatMenu mit Serveradresse, tatsächlich gemeldeter Engine und gemessener HTTP-Antwortzeit, gefolgt von Nutzung, Einstellungen, archivierten Chats und Serverneustart. Fehlende Messwerte bleiben ausdrücklich nicht verfügbar; die Zeit behauptet keine Modellgeschwindigkeit. Es gibt keinen separaten Serverstatusbutton und keinen zweiten Agenteneinstieg unten. SystemNotice behält echte Fehler, Anmeldung und Update-/Neustarthinweise.

Die Seitenleiste verwendet eine gemeinsame Textkante für Navigation, Projektnamen, neue und bestehende Chats sowie „Neuer Workspace“. Fertig- und Aktivitätsstatus teilen sich die linke Symbolspalte vor dem Chatnamen mit den Chat-Aktionen; bei Hover, Tastaturfokus und geöffnetem Aktionsmenü wird dort nur die Aktion angezeigt. Die animierte 16-px-Nadel angehefteter Chats bleibt rechts und teilt dort Größe und Mittelachse mit dem Plus des Workspace; nur diese Zeilen reservieren die kompakte Aktionsbreite. Der Online-Punkt ist vertikal zur Agent-Zeile zentriert. Die Layoutauswahl enthält ausschließlich die vier Optionen ohne Unterzeilen oder erklärenden Fußtext.

Neue Chats werden über das Plus ganz rechts am Projektordner angelegt; das Projekt-Plus erscheint an der Überschrift „Workspace“ bei Hover oder Tastaturfokus. Projektmenü und Einklapp-Pfeil erscheinen bei Hover/Fokus, auf Touch-Geräten bleiben sie erreichbar. Neben der Agentenidentität öffnet ein kreisrunder Such-Iconbutton dieselbe Suche wie Cmd/Ctrl+K. „Neuer Chat“-Zeile und „Neuer Workspace“-Zeile entfallen; Cmd/Ctrl+N bleibt erhalten. Offene Rückfragen erscheinen bei Bedarf neben dem Such-Iconbutton.

Grüne Haken bezeichnen ausschließlich ungelesene abgeschlossene Antworten. Der Server speichert die gelesene Turn-ID; eine neuere Antwort ist wieder ungelesen. Die UI bestätigt nach dem Rendern des vollständig geladenen, abgeschlossenen Verlaufs im sichtbaren aktiven Chatfenster. Composerfokus und Leseposition spielen dabei keine Rolle. Ein veralteter Lesehinweis kann keine neuere Antwort als gelesen markieren.

## Verbindliche Bereichsverträge

Jeder Bereich hat einen verbindlichen Aufbau- und Erweiterungsvertrag unter [surfaces/README.md](surfaces/README.md). Vor UI-Änderungen ist der passende Vertrag zu lesen; [AGENTS.md](AGENTS.md) macht diesen Schritt für weitere Agenten verbindlich. Eine neue Funktion rechtfertigt keine neue Interaktionslogik. Gleichartige Elemente teilen Einstieg, Komponente, Zustände und Bearbeitungsweg.

Neue externe Dienste stehen mit Original-Markenicon und Plus unter **Einstellungen → Verbindungen → Weitere Dienste einrichten**, werden im vorhandenen Dialog eingerichtet und danach unter **Eingerichtet** bearbeitet. Keine zusätzlichen Zugangsfelder auf Übersichtsseiten. Einstellungen bündeln Konfiguration, Skills und Verbindungen; Anbieterzugänge bleiben ausschließlich im Verbindungsbereich. Sprache liegt gesammelt unter **Stimme**; der Chat enthält nur kompakte Sprachaktionen.

Original-Markenassets mit dunklen oder transparenten Signets erhalten bei Bedarf eine helle Trägerfläche über die gemeinsame Farbrolle `brand-asset-bg`, damit sie in beiden Erscheinungsbildern erkennbar bleiben. Größe, Rundung und Aktion folgen weiterhin der gemeinsamen Dienstekachel; die Markenfarben werden nicht verändert.

## Persönlicher Gesprächsfluss

Nutzernachrichten verwenden die 14-px-Rolle control, Agentenantworten die 15-px-Rolle conversation mit der nativen Systemschrift. Die Uhrzeit bleibt unter der Nachricht; der ausgewählte Bot-Avatar steht bereits ab Beginn über der Antwort. Erfolgreiche Antworten erhalten keine zusätzliche Abschlusszeile. Fehler, Unterbrechungen und laufende Arbeit bleiben ausdrücklich sichtbar. Nachrichtenaktionen erscheinen auf Geräten mit präzisem Hover bei Hover oder Tastaturfokus; auf Touch bleiben sie erreichbar. Die Eingabe beginnt mit einer kompakten Schreibzeile und wächst mit dem Entwurf. Arbeitsmodus und Modell stehen zurückhaltend darunter.

Die Gesprächswünsche führt soul/IDENTITY.md; der gemeinsame Initialstandard liegt in identity-preferences.mjs. Die Oberfläche ergänzt kein zweites sprachliches Regelwerk.

Werkzeugaktivität und Begleitdateien bleiben leise, aufklappbare Zeilen in der gemeinsamen kleinen Beschriftungsrolle. Herkunft, Pfade und ausführliche Fehlerdetails gehören in die geöffneten Inhalte. ActivityGroup und ChatArtifacts verwenden vorhandene Abstands-, Text- und Touchrollen; der konkrete Aufbau steht im Chatvertrag.

## Composer und Dateiergebnisse

Die Schreibzeile ist eine Pille mit der zentralen großen Rundung. Ein Mikrofon diktiert in den Entwurf; separate Voice-/Vorlese-Icons entfallen im Composer. Unter der Schreibfläche steht nur die kompakte Modellwahl mit 32-px-Bedienhöhe, der 12-px-Schriftrolle caption und Chevron. Die Optionszeile behält oben und unten jeweils 2 px Abstand; auf Touch bleiben die Ziele mindestens 44 px hoch. Im geöffneten Modellfenster steht links Fast, rechts das Arbeitsmodus-Icon mit Chevron. Das bestehende ChatMenu bietet dort Umsetzen und Planen mit Auswahlhaken, Tooltip und zugänglichem Namen. Fokus und Klicks im untergeordneten Menü schließen die Modellwahl nicht; Escape schließt zuerst das Untermenü. Während laufender Arbeit bleibt der Modus gesperrt. Ein aktiver Planmodus erhält ein kleines Statusicon im geschlossenen Modelltrigger. Der aktive Fast-Blitz ist 18 px groß, nutzt brand-accent (Terrakotta) und eine verstärkte Kontur, zusätzlich zum gemeinsamen Auswahlring. Sein Statusicon am Modell verwendet denselben Akzent. Der Denkaufwand wird pro Chat ausdrücklich gewählt; der Composer bietet keine Rücksetzung auf native Default-/Auto-Werte. Der mitgelieferte Claude-Anschluss bestätigt beim Sitzungsaufbau Medium, sofern angeboten, sonst die erste konkrete native Stufe. Bestehende explizite Stufen bleiben erhalten. Nur externe Adapter ohne bestätigte Stufe zeigen „Stufe wählen“. Wrench stammt aus dem gemeinsamen Lucide-Iconkatalog. Der Denkaufwand folgt dem Modell mit einem zurückhaltenden Mittelpunkt. Workername und Computer-Use-Einstieg entfallen dort; Hinweise auf eine Vertretung stehen bei Bedarf innerhalb der Modellwahl. Anhänge stehen oberhalb. Diffs behalten Plus/Minus und nutzen Erfolgs-/Fehlerfarben für hinzugefügte/entfernte Zeilen. Explizite lokale Ergebnisse, die nicht bereits im Antworttext verlinkt oder als Bild dargestellt sind, liegen in der gemeinsamen ChatArtifacts-Gruppe hinter einer kompakten, zunächst geschlossenen Dateizeile; Vorschau und Download erscheinen beim Aufklappen. Der Vertrag unter surfaces/chat.md beschreibt Ladegrenzen, Fehlerzustände und die Engine-Kompatibilität.


## Menüs und unmittelbare Vorschau

Aktionsnamen in Kontext- und Dropdownmenüs bleiben einzeilig und vollständig lesbar. Kurze Bezeichnungen wählen; weder Zeilenumbruch noch Abschneiden oder Ellipsen als Ersatz für fehlenden Platz. Menüs außerhalb abschneidender Container platzieren und innerhalb des sichtbaren Fensters halten, bei Bedarf oberhalb des Auslösers. Dies auch bei schmalen Fenstern und vergrößerter Schrift prüfen. „Workspace bearbeiten …“ fasst Name, Symbol und Farbe zusammen.

Farbauswahl zeigt die Wirkung unmittelbar am Projektsymbol im Dialog und am bearbeiteten Projekt. Speichern übernimmt die Auswahl, Abbrechen verwirft die Vorschau. Bilder und Dateien lassen sich in das jeweilige Chatpanel ziehen; ein sichtbares Ablageziel, Uploadstatus und entfernbare Anhänge oberhalb der Eingabe gehören zum Ablauf. Bilder erhalten eine Vorschau. Anhängen erhält den Textentwurf und sendet keine Nachricht.

## Eine Überschrift pro Seite

Aufträge, Verbindungen, Skills, Ergebnisse und Einstellungen zeigen ihren Titel ausschließlich im gemeinsamen `PageHeading` im Inhaltsbereich. Zugehörige Kopfaktionen stehen auf derselben Linie; eine weitere globale Titel-/Tabzeile entfällt. Verbindungen wird über die Plus-Aktionen des Katalogs erweitert. Ein ausgeblendetes Seitenmenü lässt sich direkt am Seitentitel wieder öffnen. Bestehende Chats werden über Seitenleiste, Suche oder das vorhandene Chatmenü erreicht; im leeren Gespräch steht kein zusätzlicher Öffnen-Link.

Die Profilseite bietet einen editierbaren Standard für kurze, warme Kommunikation und effiziente, vollständige Arbeit. Die Arbeitsgrundlage bleibt als Einstellungsgruppe direkt sichtbar. Ein überspringbarer Dialog bietet beim ersten Öffnen Avatar und Namenswahl an. Details zum Speichern, Zurücksetzen und bestehenden Vorgaben stehen im Vertrag unter `surfaces/settings.md`.

Agenten-Avatare haben keine Kreisumrandung. Optional wählen Nutzer einen von fünf
gedeckten Hintergründen aus der zentralen Palette oder „Ohne Farbe“. Der leere
Chat zeigt den Agenten groß über einer von sechs wechselnden Begrüßungen mit
der eigenen 36-px-Textrolle. Die Auswahl bleibt bei jeder Begrüßung unverändert.

Die sechs Figuren sind einfarbige Pixelwesen auf einem 16er-Raster mit Armen
und Füßen (Stand 12.09.2026). Lumi, ein Ei mit Spross, ist der Maßstab; Nori,
Miko, Orbit, Pixel und Kibo sind nach Tamagotchi-Klassikern gezeichnete
Entwürfe. Keine Münder. Augen sind Ausschnitte in der Farbe der Fläche dahinter
(`--avatar-cutout`), Requisiten wie Laptop, Buch, Brötchen, Bälle, Besen,
Sprechblase, Noten und Z liegen als eigene Ebenen in derselben SVG und werden
je Zustand eingeblendet. Alle Bewegungen springen in ganzen Rasterpixeln
(`steps`), nichts gleitet. Die Fußlinie ist in jedem Zustand dieselbe: Hüpfer
gehen nach oben und landen dort wieder, Einsacken trifft nur den Körper.
`Avatar` nimmt `set` (Zustand) und `stage` (Bühne mit Requisiten); kompakte
Avatare beschneiden auf die Figur und zeigen nur das Grund-Set.
Zustände (`companion-state.mjs`): Ruhe läuft immer; Denkt, Arbeitet, Liest,
Jongliert, Fegt, Fertig, Tanzt, Ruft, Wartet auf dich, Spielt, Isst, Fehler,
Krank, Nickt ein, Schläft und Läuft zeigen den echten Sitzungsstand. Die Figur
auf der Schreibzeile (`AgentCompanion`) leitet ihn aus Verbindung, offenen
Rückfragen, laufendem Turn, jüngster Tätigkeit, Turn-Ergebnis und Leerlaufzeit
ab; Ruf wird nach einer Minute zu Wartet, Fertig dauert zweieinhalb Sekunden,
Einnicken beginnt nach fünf, Schlafen nach zehn Minuten Ruhe.
Die Figur ist auf der Schreibzeile ein Menü-Auslöser (`ChatMenu`, öffnet nach
oben): letzte Meldung, Figur wechseln (führt zu Dein Agent), Figur ausblenden.
Rechts neben ihr erscheint eine Sprechblase (`.companion-bubble`,
`companion-notes.mjs`) nur für Fakten außerhalb des aktuellen Chats: ein anderer
Chat ist fertig oder fehlgeschlagen, ein anderer Chat braucht eine Freigabe, ein
Hintergrund-Job hat ein Ergebnis. Der Chattitel ist die Aussage („… ist fertig“),
Tippen öffnet den Chat beziehungsweise die Benachrichtigung, das Kreuz schließt,
nach zwanzig Sekunden verschwindet sie; mehrere Meldungen stapeln sich als
„und N weitere“, je Chat und Art nur eine. Beim Eintreffen hüpft die Figur einmal
(Ruft), sofern sie gerade nichts Wichtigeres zeigt. Der eigene Chat bekommt keine
Blase, sein Stand ist die Figur selbst.
Unter Aussehen → Visuell → Figur-Animation stehen Still, Ruhig, Lebendig
(Standard) und Ausgeblendet; frühere Gesichtsstile laufen als Lebendig weiter.
Ruhig lässt Hüpfer und Drehungen weg, Still zeigt die Pose ohne Bewegung,
Ausgeblendet nimmt die Figur von der Schreibzeile. Zurück holt sie das
Agent-Menü im Seitenleistenkopf („… auf der Schreibzeile zeigen“) oder die
Einstellung.
`AvatarMotionSetting` verwendet die gemeinsame SettingRow; Unser Design zeigt
denselben Baustein und die sechs produktiven Figuren. System-/App-Vorgaben für
reduzierte Bewegung zeigen die Pose ohne Bewegung. Unsichtbare Avatare und
versteckte Tabs pausieren sämtliche Ebenen. Keine Masken.

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

Die Seitenleiste ist eine nach innen versetzte Fläche mit großen Rundungen und Abstand zum Fensterrand. Der Composer verwendet die getönte Farbrolle `composer-blur` mit 40 px Hintergrundunschärfe, verstärkter Sättigung und einer dezenten inneren Glaskante aus `composer-glass-shadow`. Bei reduzierter Transparenz oder fehlender Blur-Unterstützung bleibt die Fläche deckend. Der Verlauf läuft dahinter weiter; sein Endabstand passt sich der Eingabehöhe an. Anhang-Bubbles verwenden die gemeinsame dezente Tönung, Unschärfe und innere Kante aus glass-button-tint, glass-button-blur und glass-button-edge, mit deckender Ersatzfläche bei reduzierter Transparenz oder fehlendem Blur. Der Reiseeffekt ist unter Aussehen für neue oder alle Chats wählbar.

Die Einzelansicht zeigt oben nur schwebende Kopfaktionen einschließlich kompaktem Chatmenü. Der Verlauf fadet oben und unter der Schreibfläche aus; Modus und Modell stehen frei auf der Grundfarbe. ScrollEdgeFade blendet scrollende Chat- und Suchlisten ausschließlich an überlaufenden Kanten aus: normalerweise 8 px, am unteren Rand der Seitenleisten-Chatliste 32 px bis zur Panelunterkante. Der Scrollbereich endet dort ohne zusätzliche abgeschnittene Textkante. Am Listenende entfällt der Fade; 32 px Inhaltsabstand halten den letzten Eintrag vollständig lesbar. Auswahlfläche und Fokus bleiben außerhalb dieses schmalen Randes klar; im erzwungenen Kontrastmodus entfällt die Maske. Lange Seitenleistennamen verwenden am rechten Textrand einen Fade statt Auslassungspunkten, die Ziehkante bleibt im Ruhezustand unsichtbar. Mikrofon und Senden teilen kreisrunde Bedienflächen.

## Scrollleisten in Popups

Dialoge, Popover und Auswahlmenüs verbergen native Scrollleisten einschließlich
ihrer inneren Scrollbereiche über die gemeinsame Regel in `ui/styles.css`.
Überlauf bleibt mit Rad, Trackpad, Touch und Tastatur erreichbar; Scrollhöhen,
Fokusführung und Schließen bleiben unverändert. Im erzwungenen Kontrastmodus
gelten die bisherigen Systemdarstellungen. Reine CSS-Änderung ohne Datenmigration.

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

Das Hauptmenü zeigt Inbox, Kalender, Aufträge, die verfügbaren Ergebnisse und Firma in dieser Reihenfolge, darunter Workspaces und Chats. Firma verwendet dieselbe nav-item-Zeile ohne eigene Abschnittsüberschrift. Skills und Verbindungen sind eigene Einträge der vorhandenen Einstellungsnavigation. Der Einstieg bleibt im Agentenmenü. Bestehende Icons, Textkanten, Abstände und Inhaltsansichten bleiben erhalten; keine Platzhalter oder reservierten Leerzeilen für künftige Module. Suche und Querverweise öffnen beide Kataloge direkt mit ausgewähltem Einstellungsbereich. Die Einstellungsnavigation scrollt bei Platzmangel innerhalb der Seitenleiste; Zurück-Einstieg und Agentenzeile bleiben erreichbar.

Oben in der Seitenleiste steht der konfigurierte Agent: 32-px-Avatar mittig in der 18-px-Symbolspalte der Navigation, Name auf derselben Textkante mit reading (16 px), semibold und bestehender UI-Schrift. Daneben stehen Suche als kreisrunder Iconbutton, bei Bedarf Benachrichtigungen sowie Einklappen. Der Agentenbutton nutzt die bestehende Hoverfläche und das gemeinsame ChatMenu mit Fokusführung, Pfeiltasten, Escape und Außenklick; das Portal hält das Menü im Viewport. Auch Inbox und Einstellungen behalten diesen Einstieg. Der Such-Iconbutton öffnet den Suchdialog mit fokussierter Eingabe und nennt Cmd/Ctrl+K im Tooltip und zugänglichen Tastaturhinweis. Suche umfasst Gesprächstitel, lokal gespeicherte Nutzer- und Agententexte einschließlich archivierter Chats über alle Projekte, Projektnamen und Navigation/Einstellungen. Treffer zeigen Kontext und Textausschnitt; moderate Tippfehler, Buchstabendreher und Akzente werden toleriert. Werkzeugausgaben, interne Überlegungen und reine Kanalgespräche sind ausgeschlossen. Fehlende lokale Exporte werden als eingeschränkte Inhaltssuche kenntlich gemacht; es wird kein Worker für die Suche gestartet.

Navigation und Chatzeilen haben am Desktop mindestens 32 px Höhe, bei Touch mindestens 44 px. Die Überschrift „Workspace“ steht mit 8 px Abstand unter der Navigation, weitere Projekte mit 4 px Abstand. Der Agentenbutton im Kopf bleibt am Desktop mindestens 40 px, bei Touch 44 px hoch. Lange Namen kürzen nur im Button; der vollständige Name bleibt zugänglich. Reine Iconbuttons sind systemweit kreisrund, einschließlich Plus-Hover im Composer.

Der Update-/Neustart-Button ist eine kleine transparente Glaspille mit 40-px-Blur, verstärkter Sättigung und 14-px-RotateCcw-SVG, ohne Rand, Lichtsaum oder Schatten. Text bleibt lesbar und erklärt die Aktion. Reduzierte Transparenz und fehlende Blur-Unterstützung erhalten eine deckende Ersatzfläche.

Die globale Suche verwendet die transparente `sheet-glass`-Fläche ohne Glanzrand und 40 px Hintergrundunschärfe. Die gesamte Kulisse wird mit `overlay` abgedunkelt und um 8 px weichgezeichnet. Das Suchfeld verwendet `workspace-backdrop`, ohne native Suchfelddekoration oder Fokusrahmen. Fokus zeigen Schreibmarke und hervorgehobene Lupe; im erzwungenen Kontrastmodus bleibt ein Systemrahmen erhalten. Treffer bleiben flach, gruppiert und mit sichtbarem Tastaturfokus bedienbar. Reduzierte Transparenz und fehlender Blur erhalten eine deckende Glasfarbe.

Aktualisieren lädt die Oberfläche direkt ohne Bestätigungsdialog neu. HTML, Versionsdaten und private API-Antworten bleiben `no-store`. Öffentliche, inhaltsversionierte Assets verwenden einen langlebigen Browser-Cache; unversionierte Skripte und Styles werden vor Wiederverwendung validiert. Laufende Serverantworten bleiben bestehen. Nur ein tatsächlicher Serverneustart verwendet die bestehende Session-Bestätigung.

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

## Ergebnisvorschau

`LibraryPreview` erweitert den gemeinsamen Modal um Quick Look: dieselbe transparente `sheet-glass`-Fläche und weichgezeichnete Kulisse wie die Suche, kompakter Titel, große Medienfläche und ruhige Aktionen. Dateidetails sind aufklappbar; Pfeile navigieren durch die zuletzt geänderten gefilterten Dateien. Reduzierte Transparenz erhält die deckende `glass`-Ersatzfläche. Die Ergebnisansicht verwendet kompakte flache Ergebniszeilen mit Name, Art und Änderungsdatum oder ein umschaltbares Bildraster ohne Kartenhintergründe. Ein Klick markiert und zeigt rechts den gemeinsamen Workspace-Stil mit FileContent; Vergrößern öffnet Quick Look. Die Reiter Dateien/Wissen und Notizen entfallen. Suche und Filter sind kompakt, die Ansichtspräferenz bleibt lokal gespeichert.

## Ruhiger Gesprächsfluss

Antworten beginnen direkt mit ihrem Inhalt. Der konfigurierte Agentenname bleibt im Seitenleistenkopf. ComposerHeading zeigt nur ModelPicker rechts, mit Einzug auf die Achse des Sendepfeils; links darüber steht die Figur des Agenten auf der Oberkante der Schreibzeile und zeigt den Sitzungsstand (siehe Avatare). Eine wiederholte Autorenzeile und relatives Nachrichtenalter entfallen; der genaue Antwortzeitpunkt bleibt als Tooltip des Antwortblocks verfügbar. Direkt unter dem jeweils neuesten Antworttext, vor den bei Hover eingeblendeten Nachrichtenaktionen, stehen ausgewählter AppLoader, Live-Status, Schrittanzahl und tatsächliche Bearbeitungszeit. Diese aufklappbare ActivityGroup wandert beim Streaming mit dem Text nach unten und bleibt nach Abschluss dort als kompakter Verlauf erhalten. Ohne Werkzeuge steht der kompakte Arbeitsstatus ebenfalls direkt unter dem Text vor den Aktionen. Die Aktionszeile reserviert keinen Platz zwischen Text und Status. Die Anzeige liegt im normalen Gesprächsfluss, ohne Inhalte zu überdecken; manuelles Hochscrollen pausiert weiterhin das automatische Mitlaufen. Der Spinner endet mit der Arbeit und behauptet keinen weiteren Fortschritt.

Zwischenmeldungen bleiben während der Arbeit im Gespräch sichtbar. Sobald eine abschließende Antwort vorliegt und die Arbeit beendet ist, werden Zwischenmeldungen und Werkzeugschritte in ihrer ursprünglichen Reihenfolge in die standardmäßig geschlossene Gruppe aufgenommen. Aufklappen zeigt den vollständigen Ablauf. Laufende oder fehlgeschlagene Turns ohne Abschlussantwort verlieren ihre sichtbaren Zwischenmeldungen nicht. Nutzernachrichten und Antworten behalten ihre Reihenfolge; Nachträge werden nicht vor die erste Nutzernachricht verschoben.

Antworten nutzen die zentrale 15-px-Rolle conversation und die native Systemschrift (auf macOS San Francisco). Nutzernachrichten und Desktop-Eingabe nutzen control (14 px); Touch-Eingabe bleibt in reading. Links verwenden blue und Unterstreichung. Routinemäßige Prüfberichte werden nicht als Abschlussanhang erzeugt oder verlinkt. Dateien gehören in die Antwort, wenn sie ein angefragtes oder direkt nützliches Ergebnis liefern, etwa eine HTML-Visualisierung.

Bei Nutzernachrichten bleibt die Uhrzeit eng unter dem Text; Agentenantworten zeigen keine dauerhafte Alters- oder Uhrzeitzeile. Nachrichtenaktionen erscheinen auf Desktop bei Hover oder Tastaturfokus ohne Layoutsprung; auf Touch bleiben sie mit mindestens 44 px Bedienfläche sichtbar. Der aktive Vorlesen-Stoppen-Button bleibt erreichbar.

## Dezentes Flächenlicht

Seitenleiste und Workspace verwenden den gemeinsamen dekorativen Baustein `PanelLight`. Die Seitenleiste behält ihre hellere Grundfläche `sidebar` und erhält über `sidebar-material-shadow` eine sehr feine innere Kante; `sidebar-sheen` zeigt zwei diffuse, schwache radiale Verläufe. Der Workspace nutzt seine bestehende schwarze Materialfläche und `workspace-panel-sheen`. Nur die Lichtschicht bewegt sich, um jeweils wenige Prozent, mit 48 Sekunden je Richtung, sanften Wendepunkten und gegenläufiger Phase links/rechts. Dauer und Easing liegen in der zentralen Designquelle. Keine zufälligen Sprünge, kein Pulsieren von Text oder Kante.

Aussehen → Visuell → Flächenlicht bietet Aus, Ruhend und Sanft bewegt (Standard). Die Auswahl wird gemeinsam mit den bestehenden Darstellungseinstellungen validiert und gespeichert. App- und Systemvorgaben für reduzierte Bewegung zeigen statische Verläufe. Versteckte Tabs, eingeklappte Seitenleisten und nicht sichtbare Flächen pausieren. Nur die Dekoration wird an den Rundungen beschnitten; Menüs, Tastaturfokus und Ziehkanten bleiben erreichbar. Erzwungener Kontrast blendet die Dekoration aus. Unser Design zeigt denselben Baustein.


Das Terminal im Workspace verwendet einen transparenten Inhaltsuntergrund, damit die gemeinsame dunkle Materialfläche mit Lichtverlauf bis zur Eingabe durchgeht. Es legt keine eckige deckende Fläche über die abgerundete Workspace-Hülle. Ausgabe, Eingabe und deren Fokus bleiben unverändert bedienbar.

Die Gesprächsschrift ist bewusst zurückhaltend: Antworten 15 px bei normalem Gewicht und 1,5-fachem Zeilenabstand, Nutzernachrichten, Zwischenmeldungen und Desktop-Eingabe 14 px in derselben Systemschrift. Absätze trennen 12 px, der letzte Absatz hat keinen Endabstand. Markdown-Hervorhebungen nutzen semibold; Überschriften bleiben mit reading (16 px) kompakt. Browserzoom und gespeicherte Schriftgrößenskalierung bleiben wirksam; Touch-Eingabe behält mindestens die bestehende reading-Rolle.


## Kompakter Workspace als Arbeitsbegleiter

Der Workspace dient dem Nachsehen und Prüfen neben dem Gespräch: Dateien sind der direkte Einstieg, Änderungen eine weitere Ansicht, Befehle ein manuelles Zusatzwerkzeug. Er startet bei jedem Öffnen mit 280 px; Vergrößern und Ziehen bleiben explizite Aktionen. Es gibt keine drei großen Startbuttons und keine automatische Breitenänderung beim Ansichtswechsel.

Kopf und Bereichsauswahl nutzen control (14 px), Dateizeilen und Begleittexte small (13 px), Pfad-/Statusangaben und Befehlsausgaben caption (12 px). Die gewählte Textskalierung bleibt wirksam; Touch-Eingaben verwenden reading, Touchziele mindestens 44 px. Ordner stehen vor Dateien, beide natürlich nach Namen sortiert. Der Ordnername und eine kompakte relative Pfadzeile ersetzen den ausgeschriebenen absoluten Systempfad; dieser bleibt im Tooltip. Kopf und Eintragsstatus bleiben stehen, nur die Dateiliste scrollt. Geschützte Einträge sind standardmäßig ausgeblendet und über einen beschrifteten Button einblendbar; Zugriffsrechte bleiben erhalten.

„Befehle“ verwendet normale UI-Schrift im Leerzustand, Monospace nur für Eingabe und tatsächliche Ausgabe. Der kurze Hinweis benennt Einzelaufrufe und das 30-Sekunden-Limit. Die Eingabe bleibt unten als kompakte getönte Zeile. Die gemeinsame schwarze Materialfläche, feine Kante und Lichtbewegung bleiben in allen Ansichten sichtbar. Der Bereich ist kein persistentes Terminal und bietet keine neu erfundene native Finder-/Terminal-Anbindung.


Die erste Nachrichtenaktion und das Fortschrittssymbol teilen dieselbe senkrechte Mittelachse. Der Name bleibt im Seitenleistenkopf; auf der Schreibzeile steht die Figur oben links (`.composer-companion`, Fußlinie auf der Pillenkante, ohne Zeigerereignisse). Sie bleibt auch mit Anhängen und Rückfragen sichtbar; die Optionszeile reserviert ihre Bühnenhöhe und hält Modellwahl und Vorschauen frei.

## Inbox

Inbox verwendet das offene Ablagefach `Tray` aus Framework7 Icons über den gemeinsamen `Inbox`-Export in `ui/icons.jsx`, sowohl im Hauptmenü als auch im Leerzustand.

Die Inbox übernimmt wie Einstellungen die bestehende linke Seitenleiste mit Zurück-Einstieg, Suche und kompakter Gesprächsliste. Kanal-Icon, Name, Uhrzeit und Ungelesen-Punkt genügen; Betreff-/Vorschauunterzeilen entfallen. Die volle Hauptfläche zeigt Verlauf und eine automatisch wachsende, ausschließlich vertikal scrollende Antwortzeile. Bis 650 px Fensterbreite wechseln Liste und Verlauf in voller Breite. Beispiele und Speichergrenzen werden ausschließlich im Konzeptdialog erklärt. PageHeading, FilterPicker, BrandIcon, Modal und zentrale Tokens bleiben gemeinsam; InboxConversationRow steht unter Unser Design. Aufbau und Verhalten führt [surfaces/inbox.md](surfaces/inbox.md).

Ergebnis-Quick-Look bleibt eine reine Großansicht ohne doppelte Dateiverwaltung. Dateiaktionen stehen im rechten Workspace. Markdown nutzt dort den bestehenden bereinigten Renderer mit kompakten Dokumentrollen statt Editorfläche. Der Liste/Raster-Umschalter verwendet die gemeinsame runde Iconauswahl ohne rechteckige Auswahlfüllung; sämtliche Iconbuttons bleiben rund.


Der leere Composer zeigt auf Desktop und Handy nur „Nachricht“ in der zurückhaltenden Rolle `faint`, vertikal zentriert mit 2 px optischer Absenkung. Die leere Schreibzeile bleibt eine volle Pille; ausschließlich tatsächlicher mehrzeiliger Text oder die aktive Aufnahme erweitern die Rundung. Die Höhenmessung berücksichtigt den Textinnenabstand und ignoriert Platzhalterumbrüche für den Mehrzeilenzustand.

Dateiminiaturen verwenden LibraryThumbnail: echte erste PDF-Seite, Textausschnitt, Bild oder Videostandbild. Audio und nicht unterstützte Formate erhalten ein ruhiges Formatsymbol mit Endung. PdfPreview ist der gemeinsame lokale PDF-Lesebaustein mit Seitensteuerung und Lade-/Fehlerzuständen. Dokumentformen, Typografie und Abstände verwenden vorhandene Tokens.


Erneut ausführen sendet die ursprüngliche Nachricht samt Anhängen als neuen Turn in derselben Session. Chat-ID, Titel, bisheriger Verlauf und Composer-Entwurf bleiben erhalten; es entsteht kein Seitenleistenduplikat. Während Übertragung und laufender Antwort ist die Aktion gesperrt. Kopieren schreibt ausschließlich in die Zwischenablage. Verzweigen ist eine separate Aktion an der Antwort und übernimmt den Verlauf bis einschließlich des gewählten Turns. Bearbeiten und Verzweigen bleibt ausdrücklich beschriftet.


Skeletons übernehmen die produktiven Layoutklassen: integration-grid/-item für Verbindungen und Skills, library-entries-list/-grid und library-entry für Dateien, job-row/-info für Aufträge sowie SettingRow für Einstellungen. Die Suche teilt ihre Zeilengeometrie mit system-search-placeholder. Textformen reservieren echte Schriftzeilen (lh/em); Chatblasen, Absätze und Signatur folgen dem Gesprächslayout. Keine allgemeine Kartenhöhe über alle Bereiche. Layoutwechsel und mobile Spalten folgen denselben Regeln wie geladene Inhalte.


## Adaptive HTML-Vorschau · Version 1.1.0

HTML-Links öffnen FileContent im kompakten Workspace als gerenderte Seite.
Die verfügbare iframe-Breite bestimmt den responsiven Dokumentaufbau. „Vergrößern“
erweitert denselben Workspace und „Verkleinern“ stellt dessen vorherige Breite
wieder her. „Vollbild“ verwendet separat die native Browserfunktion auf demselben
HtmlPreview-Element, ohne den iframe zu versetzen oder neu zu laden. Escape und
„Vollbild verlassen“ führen zurück. Fehlende Browserunterstützung wird angezeigt.
„Präsentieren“ aktiviert die Foliensteuerung für markierte Dokumente; ohne Folien
bleibt HTML frei scrollbar. Dateititel, gemeinsame IconButtons und ein kompakter
Folienzähler sind die einzigen zusätzlichen Elemente. Im Vollbild bleiben die
Steuerelemente erreichbar; andere Workspace-Aktionen liegen außerhalb der Bühne.
Bearbeiten bleibt getrennt. Das vollständige Dokumentprotokoll steht im
Ergebnisvertrag.
Die Ergebnisansicht nutzt denselben HtmlPreview-Baustein und ihre bestehende Großansicht.
Darstellung, Bearbeitung und Isolation führt [der Ergebnisvertrag](surfaces/library.md#html-dokumente-im-workspace-und-in-der-großansicht).


## Modellwahl mit Anbieterbereichen

Die gemeinsame `ModelPicker`-Komponente öffnet zuerst den kompakten Regler: mittig der großgeschriebene Stufenname und darunter der Modellname, links der native Fast-Blitz und rechts der Arbeitsmodus. Gleich breite Seitenplätze halten die Mitte fest. Klick auf die Mitte öffnet im selben Popover die Modell- und Anbieterwahl; dort stehen die anklickbaren Codex- und Claude-Code-Bereiche mit Original-Markenassets aus `BrandIcon`. Logos erscheinen ausschließlich in dieser erweiterten Ansicht. Eine erfolgreiche Modell- oder Anbieterwahl kehrt zum Regler zurück; Zurück und Escape ebenfalls, ein weiteres Escape schließt. Fehler lassen die betreffende Ansicht offen. Ohne geladene Modelle öffnet direkt der vorhandene Lade-/Einrichtungszustand. Die höchstens 300 px breite `popover-glass`-Fläche ist stärker transparent als ein Dialog, mit 28 px Hintergrundunschärfe, verstärkter Sättigung, feinen Lichtkanten und dezentem Schatten. `popover-glass` und `popover-glass-shadow` führen die hellen und dunklen Materialwerte zentral. Die Fläche hat keinen diagonalen Verlauf. Modellzeilen bleiben flach und mindestens 32 px hoch; Touchziele mindestens 44 px. Kein zusätzlicher Fertig-Fuß.

Die große gemeinsame 24-px-Rundung umschließt beide Ansichten. Ihre Höhe passt sich mit der zentralen Picker-Bewegung an, ohne die Inhalte zu skalieren; nur die sichtbare Ansicht ist gemountet. Der Regler steht direkt unter dem kompakten Kopf. Sichtbare Überschriften für Modell, Denkaufwand und Geschwindigkeit entfallen; zugängliche Namen bleiben erhalten. Der gemeinsame `AmountSlider` unter `ui/components/ui/amount-slider.tsx` adaptiert ausschließlich den vom Nutzer gelieferten Regler. Radix liefert die zugängliche Bedienung, `ReasoningSlider` die native Beschriftung und Übernahme. Das Terrakotta-Quadratfeld folgt `brand-accent`; Dichte, vertikale Ausdehnung, Schweiflänge und Tempo steigen mit der Stufe; Low bleibt fast ruhig, Medium kurz und locker, High dichter, X-High breiter und Max kräftig. `reasoningAnimationLevels` beschreibt ausschließlich diese visuelle Staffelung, keine zusätzlichen nativen Stufen. Die Geometrie und Bewegungswerte stehen in `amountSliderGeometry` und `amountSliderMotion`. Der Glasknopf folgt beim Ziehen flüssig, wird in der Nähe der vorhandenen Stufen magnetisch und rastet beim Loslassen auf der nächsten Stufe ein; darüber wechselt deren Name ohne Layoutsprung. Die Anzeige beginnt mit einem Großbuchstaben, `xhigh` erscheint als `X-High`; übermittelte native Werte bleiben unverändert. Ziehen zeigt eine Vorschau, Loslassen übernimmt genau einmal. Untere Endbeschriftungen entfallen. Native Default-/Auto-Optionen sind keine Sliderstufen und werden nicht als Rücksetzaktionen angeboten. Der mitgelieferte Claude-Anschluss setzt und bestätigt eine konkrete Anfangsstufe. Nur wenn ein externer Adapter keine konkrete Stufe bestätigt, zeigen Griff und Quadratfeld keinen erfundenen Zahlenwert. Der Codex-Fast-Schalter sitzt als flacher Iconbutton links im Kopf; gedrückter Zustand, zugänglicher Name und Hinweis auf höheren Verbrauch gehören dazu. Er erscheint nur bei nativ gemeldeter Fast-Service-Tier. Pfeiltasten, Home/End und PageUp/PageDown bleiben bedienbar. Native Ablehnung stellt die bestätigte Auswahl wieder her. Ohne Denkstufen entfällt der Regler; bei genau einer Stufe bleibt deren Name stehen.

Die Animation läuft nur im sichtbaren geöffneten Menü. Verdeckte Tabs, nicht sichtbare Regler und Übertragungen pausieren; App-Einstellung „Bewegung reduzieren“ und die Systemeinstellung zeigen ein statisches Quadratfeld. Themes werden auch im Canvas sofort übernommen. Erzwungener Kontrast zeigt reine Systemkonturen. Keine Geldanzeige, Beispielbuttons oder Bildassets aus dem Demo.
Originalstufen und Verfügbarkeit stammen aus dem jeweiligen nativen Anschluss, niemals aus einer anbieterübergreifenden Übersetzungstabelle. Laden, fehlende Anmeldung, Fehler und erneuter Versuch bleiben im Popover sichtbar. Reduzierte Transparenz und fehlende Blur-Unterstützung erhalten `glass` als deckende Fläche. Escape und Außenklick schließen; Fokus, Browserzoom und Bildschirmtastatur bleiben berücksichtigt. Aussehen → Unser Design zeigt denselben Baustein mit als Beispiel gekennzeichneten lokalen Daten. Ablauf und Anbieterwechsel führt `surfaces/chat.md`.


## Heute und Kalender

Heute bleibt eine über die Suche erreichbare Detailansicht und bündelt Morgenbriefing, Tagesplan und
„Braucht dich“. Kalender ist über denselben Seitenkopfbereich und die Suche
zugänglich: Tag und Woche mit Stundenraster, Monat als Kalenderraster, optional Mo–Fr.
Die Pipeline-Designstudie entfällt; der gemeinsame CRM-Kern bleibt bestehen.
AgendaRow ist der flache gemeinsame Terminbaustein und steht unter Unser Design.
PageHeading, Modal, SettingRow, Tabs, Schalter und zentrale Tokens werden
wiederverwendet. Beispielansicht und echte Hinweise sind sichtbar getrennt.
Aufbau, Zustände, Quellen und Grenzen führt [surfaces/today.md](surfaces/today.md).

Heute zeigt datierte Berichte als kompakte `BriefingRow`-Liste mit höchstens fünf
Ergebnissen, Vorschau und Chevron. Der Baustein teilt Agenda-Typografie, Fokus und
Abstände und steht in der Designreferenz. Datum und Uhrzeit stehen am Desktop in
einer eigenen Spalte, mobil über dem Text. Tagesplan und offene Punkte stehen bei
ausreichender Breite nebeneinander, sonst untereinander. Berichte öffnen ihren
dauerhaften Chat mit dem Bericht als erster Assistentennachricht; kein Briefingmodal.
Die globale Beispielunterzeile und ihr Schalter entfallen. Fiktive Einträge bleiben
lokal gekennzeichnet; der Schalter liegt im Verknüpfungsdialog. Dessen Scrollleiste
ist visuell verborgen, Rad, Touch und Tastatur bleiben bedienbar.

## Routine-Ergebnisse

Die Glocke öffnet ein gemeinsames Benachrichtigungsmodal. `NotificationRow`
erweitert die vorhandene `SettingsNavigationRow` mit Neu/Gelesen und Datum;
Unser Design zeigt denselben Baustein. Ergebnistext nutzt den gemeinsamen
Markdown-Renderer, Aktionen führen zur Ausführung oder ihrem Chat. Zielauswahl,
Wochen-/Einmalpläne und Fehler bleiben im vorhandenen Field-/JobForm-Muster.
Der Punkt signalisiert ungelesene Ergebnisse oder Rückfragen, kein bloßes
Speicherereignis. Lesestatus bleibt dauerhaft gespeichert. Aufbau und Grenzen
stehen in `surfaces/jobs.md`; keine weitere Hauptseite wird eingeführt.

Die Modellwahl behält während einer Öffnung ihre horizontale Ausrichtung unabhängig von wechselnden Modell-, Denkaufwand- und Fast-Beschriftungen. Die beim Öffnen gemessene Triggerbreite bleibt der Anker; tatsächliche Layoutänderungen und Viewportgrenzen werden weiterhin berücksichtigt. Erneutes Öffnen richtet das Menü frisch aus.

Die Reasoning-Spur ist eine horizontale Pille, ihr stärker mattierter Glasgriff eine vertikale Pille mit 16 px Blur. Bereits erreichte Punkte verschwinden; nur die noch vorausliegenden Rastpunkte bleiben neutral sichtbar. Die native Stufe Ultra verstärkt Terrakotta-Sättigung, Schweiflänge und Tempo zusätzlich, mit weichem Übergang beim Ziehen. Andere höchste Stufen werden nicht als Ultra behandelt. Die Werte liegen in amountSliderMotion und den slider-Glas-/Akzentrollen; reduzierte Bewegung bleibt statisch.


Der schwebende Neustart-/Aktualisieren-Button verwendet `GlassButton` aus
`ui/components/ui/glass-button.tsx`: flache, minimalistische Glasfläche in der Materialfamilie des Composers.
Die Tönung verwendet nur 15 % Deckkraft, der Hintergrund bleibt durch 24 px Blur
weich sichtbar. Eine sehr feine innere Kontur begrenzt die Fläche. Keine
Verläufe, Glanzstreifen, Wulstkanten oder äußeren Schatten. Hover behält die
Transparenz; Tastaturfokus bleibt sichtbar. Die Tönung folgt der Farbwelt.
Material und Unschärfe
verwenden zentrale Tokens; die feste Mindestbreite erhält den ruhigen Ladezustand.
Ref, native Buttonattribute und deaktivierter Zustand gelten für den inneren Button;
`className` gestaltet die Hülle, `contentClassName` den Inhalt. Ohne angegebenen
Typ ist der Button `type="button"`. Tastaturfokus, reduzierte Bewegung,
reduzierte Transparenz und erzwungener Kontrast sind berücksichtigt.
Unser Design zeigt die vier Größen und den deaktivierten Zustand ohne Systemaktionen.
Die bestehende Session-Bestätigung und Wiederanlauferkennung bleiben unverändert.

Die vorhandene shadcn-Konfiguration löst `@/components/ui` nach
`wrapper/ui/components/ui` auf. Dieser gemeinsame Ordner hält Importe und CLI-Ziele
konsistent; kein zweiter Komponentenordner an der Repositorywurzel.
Tailwind 4 liegt in `ui/tailwind.css`, gemeinsame Styles in `ui/styles.css`,
Buttonstyles in `ui/components/ui/glass-button.css`. TypeScript und Tailwind
sind bereits eingerichtet; keine erneute CLI-Initialisierung nötig.


Aktives Diktat verwendet dieselbe einzeilige Composer-Pille wie die Texteingabe.
Pegel, Laufzeit und runde Iconaktionen ersetzen vorübergehend Textfeld, Plus und
normale Sendeaktionen, ohne eine zweite Zeile anzulegen. Der gemeinsame
Senden-Pfeil rechts startet Erkennung und direkte Übergabe; der Haken ergänzt
den Entwurf. Papierkorb verwirft wiederherstellbar, Pause setzt die Aufnahme aus.
Kein zusätzliches X während der Aufnahme. Größen, Farben und Touchziele folgen
den bestehenden Composer- und Iconbutton-Tokens; die Wellenform nutzt die
verbleibende Breite. Den vollständigen Ablauf führt surfaces/chat.md.

Service verwendet unter Einstellungen normale SettingRow-Gruppen. Zeiten stehen als kompakte Zeilenwerte; Einsätze, Meldungen und Konzeptdetails werden erst auf Nachfrage aufgeklappt. Kein zusätzlicher Hauptmenüpunkt oder Kennzahlen-Dashboard.


Die Sprachleiste verwendet VoiceWave und VoiceStatus aus voice-visual.tsx.
Der Pegel bleibt maximal 240 px breit, mit feinen, nicht mitskalierenden Strichen
und an die verfügbare Breite angepasster Anzahl. Höhe und Verstärkung liegen
in voiceWaveGeometry; die Übergänge verwenden motion-feedback-duration.
Es werden ausschließlich gemessene Pegel gezeigt, ohne künstliche Sprachbewegung.
Reduzierte Bewegung deaktiviert die Übergänge. Die Erkennung zeigt mittig
„Wird erkannt“ neben dem gewählten AppLoader; Schließen bleibt rechts erreichbar.
Die kompakte Höhe und alle Aufnahme-/Sendeaktionen bleiben erhalten.
Unser Design zeigt beide gemeinsamen Bausteine ohne echten Mikrofonzugriff.


Der gemeinsame `ThemeToggle` unter `ui/components/ui/theme-toggle.tsx` zeigt Mond
und Sonne in einer kompakten Pille mit gleitendem Auswahlkreis. Er ersetzt
Hell/Dunkel unter Aussehen und steht ohne zusätzliche sichtbare Beschriftung neben dem randlosen Neustart-IconButton
im Agent-Menü. Beide verwenden dieselbe bestätigte, serverseitig gespeicherte
Theme-Einstellung. Während der Speicherung ist der Schalter gesperrt; Fehler
lassen die bisherige Auswahl bestehen und werden direkt angezeigt. Native
Buttonbedienung, sichtbarer Fokus, 44-px-Treffhöhe und reduzierte Bewegung
sind berücksichtigt. Im Menü gilt menuitemcheckbox, sonst switch. Farben
und Bewegung folgen vorhandenen zentralen Tokens. Unser Design zeigt dieselbe
Komponente mit lokalem Vorschauzustand. Keine weiteren Kopf- oder Workspaceaktionen.


Das helle Erscheinungsbild verwendet eine gedämpfte Papierfläche, dunkler
abgesetzte Seitenleiste und Workspace sowie helle, klar konturierte Menüs
und Eingabe. Die Abstufung gilt in Ausgewogen, Warm und Neutral über die
zentrale Palette und resolveDesign. Popover und Dialoge sind im hellen Modus
weniger durchscheinend; Text, Fokus und Auswahl bleiben kontrastreich.
Die Lichtpunkte nutzen eigene zentrale Deckkraftrollen je Theme, damit sie
auf hellem Papier sichtbar bleiben. Bewegung und Abschaltmöglichkeiten bleiben
bestehen. Dunkle Farbwerte bleiben unverändert. Visuelle Inspiration: warme
Flächenhierarchie der Claude-Chatoberfläche, keine behauptete Übernahme originaler
Vendor-Tokens (Referenz: https://www.bluestacks.com/blog/bluestacks-roundups/ai-tools-like-chatgpt-en.html).

## Gemeinsame Iconrückmeldung

`ui/icon-catalog.mjs` führt alle 73 bestehenden Systemicons und neun weitere
UI-Symbole (fünf Lucide- und vier Spaltensymbole). Ihre freigegebenen Formen
bleiben erhalten; Framework7- und Lucide-Lizenzen liegen unter `ui/assets/icons/`.
`MotionGlyph` rendert die gemeinsame SVG-Geometrie, `icon-animation.mjs` die
individuellen Bewegungen ihrer Bestandteile: beispielsweise Glockenkörper und
Klöppel, Uhrzeiger, Blätter, Regler und Konturen. Kein pauschales Aufpoppen.
`iconMotion` in der zentralen Designquelle hält die Dauern. Die gemeinsamen
weichen Zeitkurven beginnen und enden ohne Geschwindigkeit; Ausgangsgeometrie
und Endzustand stimmen überein.

`ui/icon-motion.tsx` steuert Klick, Touch, native Tastaturaktivierung und
Desktop-Hover. Aussehen → Visuell → Iconanimationen bietet **Hover und Drücken**
(Standard), **Nur beim Drücken** und **Aus**. Die vorhandene Settings-API validiert
und speichert die Auswahl. App- und Systemvorgaben für reduzierte Bewegung haben
Vorrang, auch in der Designreferenz. Versteckte, entfernte und außerhalb des
sichtbaren Bereichs liegende Icons laufen nicht weiter. Eine laufende Geste
wird durch Hover/Klick nicht unterbrochen oder neu gestartet; native Aktionen
bleiben unverzögert. Hover verändert weder Auswahl noch Systemzustand.

Nur ein geeignetes Icon je Bedienelement bewegt sich. Trefferfläche, Fokus,
Text und äußere SVG-Zustandstransformationen bleiben stabil. Zustandsabhängige
Disclosure-Chevrons und echte Ladeanzeigen behalten ihre eigenen Animationen.
Markenassets und bereits eigenständige Schalter bleiben eigenständig;
`data-icon-motion="off"` kennzeichnet weitere begründete Ausnahmen. Keine
Leerlaufschleifen und kein künstlicher Ladefortschritt. Die Iconsammlung unter
Aussehen → Unser Design → Icons nutzt dieselben Komponenten und Zeitlinien,
mit Suche, beschrifteter Auswahl und großer Vorschau im aktiven Theme.

`IconButton` liegt gemeinsam in `ui/icon-button.tsx`. `CopyButton` verwendet
denselben direkten Button-Aufbau wie die anderen Nachrichtenaktionen;
keine zusätzliche Hülle steuert dessen Sichtbarkeit. Er zeigt erst nach
bestätigtem Schreiben in die Zwischenablage einen kurz erscheinenden Haken und
eine zugängliche Kopiert-Meldung. Fehler zeigen keinen Haken und erlauben einen
erneuten Versuch. Wiederholtes Kopieren, Textwechsel und Entfernen des Bausteins
räumen alte Zeitgeber auf. Nachrichtenaktionen behalten Hover-, Fokus- und
Touch-Verhalten. Ausgeblendete Desktop-Nachrichtenaktionen verbergen zusätzlich
ihre SVG-Symbole, auch während einer Iconanimation; die Schaltflächen bleiben
per Tastatur fokussierbar. Aktives Vorlesen bleibt sichtbar.
Die globale Glocke reagiert einmal auf neue Benachrichtigungs-
ereignisse oder neu hinzugekommene Rückfragen, nicht auf Lesen oder wiederholtes
Rendern; bei mehreren sichtbaren Glocken bewegt sich nur die erste. Initialer
Glockenaufbau spielt keine alten Hinweise ab. Unser Design zeigt dieselben
Bausteine als lokale, beschriftete Beispiele. Beim normalen Copy-Hover bewegen
sich nur die Papierblätter. Ein simulierter Haken ist ausschließlich in der
als Beispiel gekennzeichneten Iconsammlung zulässig.


Codeblöcke im gemeinsamen Markdown-Renderer verwenden ebenfalls CopyButton.
Die bereinigte Toolbar enthält nur den Portalplatz; React rendert darin dieselbe
zugängliche Kopieraktion mit Haken und Fehlerzustand. Kopiert wird ausschließlich
der Text des zugehörigen Codeblocks, ohne die letzte Formatierungszeile.


Einzelne Iconaktionen verwenden systemweit `IconButton` beziehungsweise die
vorhandene `icon-button`-Klasse: flach, kreisrund, ohne Schatten. Inaktive Buttons
bleiben transparent; Desktop-Hover erhält die feine gemeinsame Hoverfläche.
Auswahl (`aria-pressed`/`selected`) und geöffnetes Menü/Dialog (`aria-expanded`)
zeigen einen dünnen runden Rand aus `border-strong` und das betonte Icon auf
transparentem Grund. Ein transparenter Rand gleicher Stärke reserviert den Platz
auch ohne Auswahl. Fokus bleibt zusätzlich sichtbar, im erzwungenen Kontrast
verwendet der Auswahlring Highlight. Textnavigation, Listenzeilen, Schalter und
primäre Sendeaktionen behalten ihren jeweiligen Aufbau. Ergebnis-Ansichtswechsel,
Fast, Workspace und Menüs verwenden keine eigenen Auswahlfarben oder Kacheln.
Unser Design zeigt zusätzlich einen schaltbaren Einzelicon-Auswahlzustand.


Der Standardstart ist jetzt der leere Chat mit kontextabhängiger Begrüßung und
AttentionFan. Heute entfällt im Hauptmenü; Kalender und bestehende Direktlinks
bleiben über die Suche nutzbar. Aufbau und Verhalten führt [surfaces/chat.md](surfaces/chat.md).


Der leere Chat verwendet denselben schwebenden Composer wie der Gesprächsverlauf.
Der scrollbare Einstieg reicht bis zum unteren Panelrand: Karten und Text laufen
hinter Eingabe und Anhängen weiter, ohne harte Schnittkante an deren Oberseite.
Der gemeinsame untere Fade und der dynamische Composer-Endabstand halten die
letzten Inhalte und die Kartennavigation vollständig erreichbar.
Der Start zeigt ausschließlich den größeren rahmenlosen Begrüßungstext mit der Titelrolle. Zwei feste Textzeilen halten den Einstieg beim Schreiben und beim Satzwechsel stabil. AttentionFan nutzt
suggestion-glass, die gemeinsame Glaskante und 28 px Blur, mit deckenden Fallbacks.
Maus-Hover hebt eine Karte in ihrer bestehenden Position an und betont ihre Kontur;
kein Umsortieren unter dem Zeiger. Ein Klick öffnet die angehobene Karte, Touch
behält Auswahl/Öffnen. Tastaturfokus bietet dieselbe Hervorhebung.

ChatStartHeading ordnet den belegten Zustand der Karte kurz ein, ohne Titel als
Fragen zu wiederholen. Langsame Zeichenfolge, zwanzig Sekunden Lesezeit und
höchstens eine sachliche Vertiefung aus dem vorhandenen Inhalt. Danach steht der
Text still. Die Karten wechseln nie automatisch.
Der Textplatz bleibt auf zwei Zeilen begrenzt. Hover und Tastaturfokus pausieren nur den späteren Satzwechsel; die RPG-Schreibanimation läuft weiter. Ein Composer-Entwurf pausiert auch das Schreiben, ohne den Satz vorzeitig zu vervollständigen. Verborgene Ansichten stoppen Zeitgeber.
Screenreader erhalten die vollständige Zeile ohne laufende Wortansagen. Reduzierte
Bewegung zeigt einen statischen Satz. Aussehen → Visuell → Lebendiger Starttext
schaltet den Effekt für diesen Browser dauerhaft ab; kein zusätzlicher Server nötig.
Die Auswahl wird zwischen Tabs desselben Ursprungs synchronisiert und ein
Speicherfehler angezeigt. Gemeinsame Werte: chatHeadingMotion und attentionFanMotion.


Der Startfächer bietet konkrete Anschlussaktionen: offene Rückfragen und Probleme,
ungelesene Antworten, Routine-Ergebnisse, das letzte abgeschlossene Gespräch im
Workspace und den nächsten geplanten Auftrag. Jede Karte benennt ihre Aktion.
Beliebige zuletzt geänderte Dateien und nicht angebundenes Wetter werden nicht
als Arbeitsanlass angeboten. Gespräche führen in ihren Chat, Ergebnisse in den
Berichtschat, Aufträge in den bestehenden Dialog. Diese Aktionen starten keine Arbeit; die eingerichtete Wetterkarte startet auf ausdrücklichen Klick ihren Bericht mit kurzer Einordnung.
Ohne Anschluss bleibt ein Vorschlag, der nur den Entwurf vorbereitet.

Der gemeinsame Skeleton mit Variante `attention` reserviert dieselbe Kartenhöhe,
Fächerbreite und Navigation wie AttentionFan. Der Einstieg bleibt oben verankert;
Laden, Satzwechsel und Composer-Anhänge zentrieren ihn nicht neu. Der leere
Startbildschirm folgt nicht der Scrollautomatik für neue Chatnachrichten.
Bei Platzmangel scrollt der Einstieg manuell, während der Composer erreichbar bleibt.
Unser Design zeigt den Karten-Ladezustand neben den gemeinsamen Skeletons.

Die rechte Seitenleiste öffnet manuell die zuletzt verwendete verfügbare Ansicht
(Dateien, Änderungen oder Befehle), auch nach erneutem Laden. Ohne gespeicherte
Auswahl beginnt sie mit Dateien; Ergebnisse öffnen direkt ihre Vorschau.
Die Dateiliste beginnt beim gewählten Workspace, zeigt dessen Namen einmal im
Kopf und navigiert höchstens bis zu dessen Wurzel zurück. Workspace-Wechsel
verwerfen vorherige Dateiauswahl und Ordnerziele. Ausdrückliche Auftragslinks
können weiterhin ihren zugehörigen Ordner öffnen. Technische Installationsnamen
sind keine Workspace-Titel. Geschützte Einträge sind zunächst ausgeblendet.


### Persönlicher Heute-Einstieg

Avatar, Text und Karten besitzen feste Plätze. Zwei reservierte Textzeilen in der Titelrolle stehen ohne zusätzliche Figur, Sprechblasenfläche oder Rahmen über den Karten. Die vorhandene Schreibanimation bleibt; längere Texte ändern weder die Höhe des Einstiegs noch die Position der Karten. Kurze, belegte Anschlussfragen greifen die gewählte Karte auf. Dateinamen dienen nur als Thema; keine erfundene Erinnerung oder unbelegte Zeitangabe.

Alle Fächerkarten sind einschließlich Innenabständen 224 px hoch. Titel und
Beschreibung bleiben auf je zwei Zeilen begrenzt. Die Navigation reserviert auch
bei einer einzelnen Karte ihre Höhe. Die Startreferenz zeigt denselben Avatar,
Textbaustein und Fächer.


Die angeschlossene Wetterkarte bleibt im Startfächer reserviert. Open-Meteo liefert Temperatur und Wetterlage; Quelle und Datenstand sind im Wetterbericht sichtbar. Ortssuche und bestätigte Koordinaten stehen unter Dein Profil. Speichern, erneutes Öffnen, Fokus und zehn Minuten im sichtbaren Chatstart aktualisieren das Wetter. Eindeutig passende alte Ortsnamen werden aufgelöst; mehrdeutige Orte erfordern Auswahl. Lade- und Abruffehler ersetzen keine Wetterwerte durch Beispiele. Ohne bestätigten Ort öffnet die Karte das Profil; mit eingerichtetem Ort öffnet sie einen neuen Wetterchat.

### Aufträge mit Detailbereich

Die Auftragsseite verwendet vorhandene Tabs für Nutzerstatus, System und Vorlagen.
Ein ausgewählter Auftrag öffnet rechts das gemeinsame JobForm, auf schmalen
Fenstern ersetzt es die Liste mit erreichbarer Schließen-Aktion. Die Liste
verwendet job-row, Details die vorhandenen Formular- und Einstellungsbausteine.
Zeitplanstatus und letzter Lauf bleiben unterscheidbar. Vollständiger Vertrag:
[surfaces/jobs.md](surfaces/jobs.md).

## Vanilla als App-Marke

Browser und installierte Web-App heißen Vanilla. Ihr festes Icon unter
`public/app-icon.svg` behält die neutrale Nori-Geometrie der früheren
Gesichtsreihe (Antenne, Augen, Sockel, Stand vor den Pixelfiguren vom 12.09.2026).
Die deckende quadratische Fläche verwendet die bestehende helle Palette
(surface #eae7df, text #292720). Das Motiv bleibt innerhalb der Maskierungszone;
die Plattform bestimmt die Außenrundung. Keine im Bild eingebauten Schatten.
PNG-Ausgaben in 192, 512 und 1024 px ergänzen das SVG im Manifest;
180 px dienen als Apple-Touch-Icon und 32 px als Browser-Fallback.
Die SVG-Datei ist die Quelle aller Rasterausgaben. Herkunft und geprüfte
Asset-Hashes stehen in `scripts/design-assets.json` und der Source-Policy.
Der frei konfigurierbare Agentenname und seine Avatarwahl bleiben eigenständig.

Der Agentenname im gemeinsamen Seitenleistenkopf verwendet für jeden Namen die
lokal gebündelte Rundschrift Quicksand über `font-agent-name`, Größe `section`
und Gewicht `semibold`. Umbenennen ändert nur den Text, niemals die Typografie.
Großschreibung bleibt erhalten; lange Namen werden mit Ellipse begrenzt, der
Button nennt den vollständigen Namen. Der Startname ist Vanilla und frei änderbar.
Die übrige Oberfläche behält ihre UI-Schrift. Unser Design zeigt die Namensschrift
samt Lizenz und dasselbe AgentMenu. Die feste Produktwortmarke unter
`public/vanilla-wordmark.svg` bleibt in der Markenreferenz über VanillaWordmark
verfügbar; sie ersetzt keinen konfigurierbaren Agentennamen.


Die Chat-Panels trennt eine leise, 1 px breite warmgraue Haarlinie aus der
zentralen Theme-Rolle `pane-seam`. Oben und unten läuft sie über 96 px aus.
Der vorhandene PaneDivider behält seine unsichtbare Trefferbreite von 14 px,
Ziehen und Pfeiltasten; Hover, aktives Ziehen und Tastaturfokus zeigen den
mittigen 2 × 32 px Griff. Erzwungener Kontrast verwendet eine Systemlinie.
Unser Design zeigt denselben Baustein. Ein einziges WelcomeParticles-Canvas
liegt hinter der gesamten Chat-Panelfläche, mit gemeinsamem Bewegungszentrum.
Eingebettete Panels bleiben transparent. „Alle Chats“ aktiviert das gemeinsame
Feld immer, „Nur neue Chats“ sobald mindestens ein sichtbares Panel einen neuen,
geladenen Chat ohne Verlauf zeigt. Verborgene Panels aktivieren es nicht.
Aus, reduzierte Bewegung und Pausieren unsichtbarer Ansichten bleiben erhalten.
Keine Datenmigration; gespeicherte Auswahlwerte bleiben kompatibel.


### Wetter im bestehenden Glasfächer

Die Wetterkarte verwendet WeatherCardContent und WeatherScene innerhalb von
AttentionFan. Fächergeometrie, Höhe, Navigation und Aktionen bleiben gemeinsam.
Ort über großer Temperatur (Rolle weather, 56 px), Wetterlage, optional echte
Tageshöchst-/Tiefstwerte; im Fuß steht nur Heute & 7 Tage. Quelle und Datenstand stehen im Bericht; der erforderliche Open-Meteo-Link bleibt bei ausgewählter echter Wetterkarte klein unter dem Fächer erreichbar. Fehlende Werte
werden ausgelassen. Lade-, Fehler- und Einrichtungszustände behalten die bisherige
neutrale Textkarte. Ohne Ort oder bei mehrdeutigem Altort öffnet ein Klick das Profil; bei eingerichtetem Ort startet er einen neuen Wetterchat im aktuellen Workspace.

Eigene Himmelsszenen orientieren sich an Apples iOS-26-Wetterdarstellung:
sattes Blau und gelbe Sonne, geschichtete weiche Wolken, Regen, Schnee, Frost,
gefrierender Regen, Nebel und Gewitter. is_day bestimmt Tag/Nacht unabhängig
vom App-Theme; bei fehlendem Tag/Nacht-Wert wird kein Nachtzustand behauptet.
Temperaturen unter oder gleich null ergänzen bei klarem Wetter Frost. Reifnebel, Nieselregen, Starkregen, Hagel und stärkere Winde besitzen eigene Details.
Wettercodes sind keine amtlichen Warnungen. Die ausdrücklich markierte Warnkarte
in WeatherPreview ist nur ein Designbeispiel, bis eine Warnquelle angeschlossen ist.
Apple-Referenzbilder werden nicht als Produktassets übernommen.

Farben, Licht, Typografie und Bewegungsdauern führt weatherArtwork in der
zentralen Designquelle. Glasrahmen und Fächerschatten bleiben erhalten; die
Landschaft ist auf die Kartenfläche begrenzt. Die abdunkelnde Textebene hält
Beschriftungen ruhig lesbar. Keine blitzenden Gewittereffekte. Aussehen → Visuell
→ Wetterbewegung speichert den Ein-/Aus-Zustand lokal und synchronisiert Tabs;
Speicherfehler bleiben sichtbar. Reduzierte Bewegung zeigt statische Szenen,
Sichtbare seitliche Wetterkarten bewegen sich ebenfalls; unsichtbare Karten und versteckte Ansichten pausieren. Pointer-Parallaxe bewegt Hintergrund, Wolken und Niederschlag mit unterschiedlichen, zentral festgelegten Tiefen; die Schrift bleibt fest. Ein federnder Rücklauf und verschobenes Flächenlicht ergänzen die feine Liquid-Glass-Kante. Touch benötigt keine Bewegungssensoren. Sonne und Strahlen bewegen sich ruhig, aber klar sichtbar, Eis schimmert sanft. Forced Colors blendet die
Dekoration aus. Unser Design zeigt alle Wetterzustände im produktiven Fächer
mit ausdrücklich markierten Beispieldaten und Tag-/Nachtwahl.


Die Chat-Mehrfachansicht speichert Panelanzahl, Reihenfolge, aktives Panel,
Breiten und die Session-/Workspace-Zuordnung jedes Panels lokal im Browser.
Hard Refresh und App-Neustart stellen diese Auswahl wieder her, einschließlich
der wegen Platzmangels verborgenen Panels. Ohne gespeicherte Auswahl startet
ein leerer Chat. Gelöschte Sessions ergeben ein leeres Panel; vorübergehende
Ladefehler löschen die Zuordnung nicht. Explizite Chatlinks öffnen ihren Chat
im ersten Panel und aktivieren dieses. Maximieren bleibt vorübergehend.


Der Wetterklick liest den gespeicherten Ort serverseitig und holt eine aktuelle
Open-Meteo-Vorhersage. Erst nach gültigen sieben Tagen entsteht über den bestehenden
Berichtschat-Baustein eine neue Session im aktiven Workspace. Der dauerhaft gespeicherte
Bericht enthält aktuelle Werte, sieben Tageszeilen und die nächsten Stunden mit
Ortszeit, Einheiten, Quelle, Abrufzeit und fehlenden Werten als Strich. Er bleibt
beim Wiederöffnen als zeitgebundener Bericht erkennbar. Danach startet genau eine
kurze KI-Einordnung über den bestehenden Turn-Anschluss. Sie nutzt nur belegten
persönlichen oder Projektkontext dieses Workspaces, maximal drei passende Hinweise;
keine erfundenen Baustellen, keine Zuordnung fremder Orte und keine Arbeitsfreigaben.
Ohne solchen Kontext genügt der allgemeine Ausblick. Fehlende Einordnung lässt den
Datenbericht erreichbar. Wiederholungen desselben Klicks sind über requestId
idempotent, ein neuer bewusster Klick erzeugt eine neue Session. Der Composer-Entwurf
bleibt erhalten. Forecast-Fehler erzeugen keine leere Session. Die Quellenangabe
entfällt auf der kompakten Kachel; unter dem Fächer steht bei ausgewähltem Wetter der Quellenlink. Die Quellenzeile reserviert ihre Höhe auch bei anderen Karten und im Skeleton. Ausführliche Quellen stehen im Wetterbericht und im Profil.


### Private Chats

Die Chat-Sperre verwendet das vorhandene animierte Lock-Icon über MotionGlyph
und IconButton. Rechts in der Chatliste bleibt das Schloss neben „Privater Chat“
auch bei Hover sichtbar. Ein entsperrter privater Chat zeigt die sofortige
Sperraktion neben seinem Drei-Punkte-Menü. LockedChat ersetzt den Gesprächsbereich
mit einer ruhigen PIN-Eingabe; ChatPrivacyForm teilt Einrichtungs- und
Entsperrverhalten. Modal, maskierte native Eingabe, numerische Tastatur,
Fehleransage und zentrale Tokens bleiben gemeinsam. Keine dekorative Unschärfe
über weiterhin geladenem Chattext. Ablauf und Schutzgrenzen führt surfaces/chat.md.


Die Wetterbeleuchtung unterscheidet Morgendämmerung, Morgen, Tag, Sonnenuntergang, Abenddämmerung und Nacht anhand gelieferter Sonnenauf- und Untergangszeiten am Wetterort. Der Sonnenbogen ist eine dekorative Annäherung innerhalb der Karte, kein astronomischer Positionsmesser. Ohne Sonnenzeiten gilt weiterhin is_day; ohne beides bleibt der Himmel neutral. Die Uhr wird bei sichtbarer Ansicht minütlich aktualisiert. Vorschauen zeigen dieselben sechs Phasen mit markierten Beispieldaten. Größere Wolkenwege, gegenläufige Ebenen, Sonnenstrahlen und dezentes Sternenfunkeln machen Motion erkennbar, ohne Text zu bewegen.


Das Chat-Menü beginnt mit Neuer Chat, Anpinnen/Nicht mehr anpinnen und
Umbenennen. Darauf folgen Chat verzweigen, Fortsetzungsnotiz und Teilen und
exportieren. Kopieren, Markdown und der zugangsbeschränkte App-Link stehen
ausschließlich im gemeinsamen Teilen-Dialog; die allgemeine Suche wird nicht
als Chat öffnen dupliziert. Schutz, Ansicht und Archivieren bilden getrennte
Gruppen. Chat N maximieren und Chat N schließen verwenden dieselbe Bezeichnung;
Schließen entfernt nur die Ansicht, Archivieren bleibt die letzte Aktion.
ChatMenu trennt Gruppen durch nicht fokussierbare Separatoren mit zentralen
Abstands- und Farbrollen. ChatTitle verwendet in allen Ansichten dieselbe
Reihenfolge. Verzweigen ist nur bei bestätigter Anbieterfähigkeit verfügbar,
Fortsetzungsnotizen und Textexport erst bei geladenem Gesprächsinhalt.


### Anpassungsfähiger Agentenname

Der Seitenleistenkopf reserviert den verbleibenden Platz für den Namen: kein
Zusatzabstand zwischen den Kopfaktionen, kompakte Iconbreite `control-height`
bei Mausbedienung, unverändert `control-touch` bei Touch. Der Avatarabstand nutzt
`space-8`. AgentName misst den Text nach Namenswechsel, Schriftladen und
Breitenänderung und verkleinert ihn bei Bedarf von `section` bis `reading`.
Erst wenn diese gut lesbare Mindestgröße nicht reicht, erscheint eine Ellipse;
der vollständige Name bleibt als Tooltip und im zugänglichen Buttonnamen erhalten.
Keine Datenmigration, keine Änderung gespeicherter Namen.


### Lebende Antwortkarten · Version 1.1.0

Der Startfächer zeigt die neueste ungelesene abgeschlossene Antwort jedes normalen
Chats im aktiven Workspace als eigene Karte. Keine Begrenzung auf fünf Karten.
Private, archivierte und auftragsgebundene Chats bleiben ausgeschlossen. Die
Kartenkennung enthält Chat und Turn; gelesene Antworten verlassen den Fächer.
Nur ohne ungelesene Chatantworten wird das letzte Gespräch als Weitermachen angeboten.
Vorhandene Ereignisse aktualisieren den Fächer ohne Plus oder erneutes Öffnen.

Bestehende Karten behalten Reihenfolge und Auswahl. Neue Einträge kommen vor
festen Dienstkarten hinzu. Entfernen der Auswahl wählt den nächsten erhaltenen
Nachbarn, am Ende den vorherigen. Keine automatische Rotation und kein Sprung
auf neu angekommene Inhalte. Kartenhöhe, Kopftext und Navigation bleiben reserviert;
der Zähler verwendet gleich breite Ziffern. Gleichzeitig sichtbar bleiben auf mindestens 460 px breiten Fächerflächen fünf,
sonst drei Karten zuzüglich kurzer, nicht bedienbarer Ausblendungen.

AttentionFan verwendet AnimatePresence und die zentralen attentionFanMotion-Werte:
280 ms Einblenden aus geringer Tiefe, 180 ms Ausblenden mit leichtem Zurücknehmen,
gedämpfte Positionsübergänge ohne Nachschwingen. Keine Unschärfe über der Schrift,
keine dauernden Effekte. App-/Systemvorgaben für reduzierte Bewegung schalten
Übergänge unmittelbar. Entfernte Karten sind während der Ausblendung inert.

Sichtbare Antwortkarten laden ausschließlich den passenden abgeschlossenen Turn
über die vorhandene geschützte Thread-API. Nur die letzte finale Agentenantwort
liefert die gekürzte Vorschau, keine Werkzeuge oder Zwischenmeldungen. Fehlende
Vorschau bleibt ausdrücklich erkennbar; verspätete Antworten überschreiben keinen
neueren Turn. Klick öffnet den zuständigen Chat und springt zum Antwortanfang,
auch bei bereits geöffnetem Panel. Gelesen wird weiterhin erst bei bewusster
Auswahl und vollständig geladenem, abgeschlossenem Verlauf im aktiven Chat bestätigt, niemals durch die Kartenvorschau.

Unser Design enthält ein lokales Live-Beispiel zum Hinzufügen, Entfernen und
Zurücksetzen. Beispiele verändern keine Chats. Keine neue Datenhaltung oder
Migration; Rückkehr stellt nur bisherige Darstellung und Kartenbegrenzung wieder her.


### Kompakter Arbeitsverlauf

Die bestehende Trennung bleibt: graue Zwischenmeldungen während der Arbeit,
helle finale Antwort nach Abschluss. Zwischenmeldungen bleiben chronologisch
im aufklappbaren Verlauf erhalten. Standardmäßig ist dieser geschlossen;
ein bewusst geöffneter Verlauf und seine Werkzeugdetails bleiben beim Abschluss
offen. ChatTurn hält diese Leseentscheidungen auch beim Wechsel zur finalen Antwort.

Werkzeugzeilen verwenden 28 px Mindesthöhe am Desktop, 44 px bei Touch,
2 px vertikale Innenabstände und keine zusätzlichen Zeilenaußenabstände.
Konkrete Titel stammen nur aus öffentlichen Aktionen, Dateinamen oder eindeutig
erkannten Befehlen. Ausgabeinhalte liefern keine erfundenen Absichten oder Erfolge;
Fehler und fehlende Abschlüsse bleiben ausdrücklich sichtbar.

DiffStats zeigt hinzugefügte und entfernte Zeilen aus gelieferten Diffs bereits
in der Schrittzeile. Bestätigte Änderungen verwenden success/danger mit +/−,
unbestätigte Umfänge bleiben neutral und entsprechend beschriftet. Fehlende
Diffs erhalten keine Zahlen, teilweise verfügbare Diffs sind gekennzeichnet.
Dateidetails zeigen zuerst Dateiname und DiffView mit farbigen Einzelzeilen.
Rohaufruf und Werkzeugausgabe bleiben darunter separat aufklappbar; der
vollständige Dateipfad steht am Dateilink als Tooltip.

StepCount bewegt nur eine tatsächlich geänderte Schrittzahl in 240 ms vertikal;
die Daueranzeige bleibt statisch. Neue Zeilen im geöffneten Live-Verlauf erscheinen
in 180 ms mit 2 px Bewegung. Farben, Maße und Zeiten sind zentrale Rollen.
Reduzierte Bewegung zeigt statische Werte; abgeschlossene und verborgene Ansichten
spielen keine Live-Animationen. Unser Design zeigt dieselben Bausteine mit
lokalen Beispieldaten und einem abschließbaren Lauf. Keine Datenmigration.

### Rückfrage am Composer

`ComposerQuestion` zeigt native Rückfragen in einer schmalen zentrierten
Glaskarte über der Eingabepille. Horizontaler Haarstrich, große Composerrundung
(`radius-large`), `composer-blur`, `composer-glass-shadow` und die gemeinsame
Unschärferolle aus der GlassButton-Materialfamilie bilden die Fläche.
Status in caption, Frage und Antworten in control; Beschreibungen in caption.
Native Radio-/Checkbox-Auswahlen liegen als flache Zeilen mit `radius-button`
auf derselben Fläche. Der gewohnte Composer wird zu „Sonstiges“ und verwendet
weiterhin seinen Sendepfeil. Keine zusätzliche Sendeleiste in der Karte.

Ein kurzer Eintritt von unten verwendet picker-duration/picker-easing und
space-8. App-/Systemvorgaben für reduzierte Bewegung deaktivieren ihn. Bei
reduzierter Transparenz oder fehlendem Blur gilt die deckende Composerfläche;
Forced Colors erhält Systemkonturen. Lange Karten scrollen innerhalb einer
begrenzten Höhe, Eingabe und Senden bleiben außerhalb erreichbar. Desktop und
schmale Panels behalten einen seitlichen Einzug gegenüber dem Composer.
Unser Design zeigt die Produktionskomponente. Ablauf und Datenvertrag stehen
in surfaces/chat.md unter Native Rückfragen am Composer.

## Römische Forktitel · Version 1.0.0

Beim ersten erfolgreichen Verzweigen erhält der ursprüngliche Chat `I · Titel`,
der neue `II · Titel`. Weitere Abzweigungen derselben Familie zählen mit III, IV
usw. weiter, auch beim Fork eines Forks. Ohne Fork bleibt der Titel unverändert.
Die vorhandenen Chatzeilen, Suche und Panelmenüs zeigen denselben gespeicherten
Titel mit der Nummer vorne; keine neuen Komponenten oder Stilwerte.
Umbenennen bleibt frei und verändert andere Familienmitglieder nicht. Ein
weiterer Fork übernimmt den aktuellen Quelltitel ohne dessen verwaltete Nummer.

Datenvertrag: `chat-fork.mjs` ergänzt beim erfolgreichen Fork optional
`forkFamilyId`, `forkIndex` und `forkSequence` im vorhandenen Chatdatensatz.
Die Familienzuordnung folgt IDs, niemals gleichlautenden Titeln. Der höchste
vergebene Zähler wird bei allen vorhandenen Familienmitgliedern mitgeführt;
Archivieren, Löschen einzelner Mitglieder und Neuladen setzen ihn nicht zurück.
Die Nummer wird erst nach erfolgreichem nativen Fork vergeben. Alle geöffneten
Ansichten erhalten danach das bestehende `wrapper/chats`-Ereignis.

Migration: additive Felder, keine Startmigration und keine Massenumbenennung.
Alte Kopien ohne belegte Familienzuordnung bleiben eigenständige Chats; beim
nächsten Fork beginnen sie eine neue Familie. Älterer Code kann Titel und
Datensätze weiter lesen, vergibt aber wieder Kopie-Zusätze. Nach einer solchen
Rückkehr erstellte Kopien müssen vor erneutem Einsatz gesondert zugeordnet werden,
da alter Code Familienfelder ungeprüft kopieren kann. Native Sitzungsdaten und
Kontextverwaltung bleiben unverändert.


## Persönliche Statistik und Fächer · Version 1.2.0

ChatStart begrüßt beim ersten Inhalt mit dem ersten Namensbestandteil aus dem
bestehenden Nutzerprofil. Weitere Karten verwenden sachliche Anschlusssätze.
Kein gespeicherter Name wird verändert; ohne Profilname bleibt die Ansprache neutral.

AttentionFan zeigt ab 460 px verfügbarer Breite fünf Ebenen mit zwei zurückgesetzten
Karten je Seite, darunter drei. Weniger Einträge werden nicht dupliziert. Horizontaler
Trackpad-Scroll und Shift-Mausrad wechseln nach einer Wegschwelle mit begrenzter
Folgegeschwindigkeit; vertikales Scrollen bleibt erhalten. Gedämpfte Federn,
Tastatur, Touch, stabile Auswahl und inerte ausblendende Karten bleiben gemeinsam.
Die zentrale attentionFanMotion enthält Geometrie, Schwellen und Federwerte.

StatisticsCard ist eine feste Dienstkarte. StatisticsDashboard zeigt einen
unveränderlichen Berichtsstand im normalen Chat mit Composer: Übersicht/Modelle,
Zeitraumwahl über AmountSlider, Kennzahlen, Tagesaktivität und Datenabdeckung.
ActivityPixels nutzt dieselbe pixelHash-Textur wie AmountSlider. Helligkeit bedeutet
Nachrichten pro Tag; eine endliche Welle bildet beim Einblenden, Zeitraumwechsel
und Druck das reale Muster. statisticsMotion führt Geometrie und Dauer.
Keine Dauerschleife. Verborgene Ansichten und reduzierte Bewegung zeigen den
statischen Datenstand. Farben, Schrift, Rundungen und Flächen sind gemeinsame Tokens;
Forced Colors bleibt verständlich. Statistikflächen passen sich der Panelbreite an.
StatisticsPreview unter Unser Design zeigt produktive Bausteine mit markierten
Beispieldaten, ohne reale Gespräche anzulegen.

GET /api/statistics liest ausschließlich lokale normale Gespräche des angefragten
Workspaces einschließlich Archiv; die Core-Privatsperre wird vor dem Lesen geprüft.
Private Chats, Aufträge, Messenger- und Berichtschats bleiben ausgeschlossen.
Nachrichten sind Nutzereingaben und maximal eine finale Antwort pro Runde.
Werkzeuge, Zwischenmeldungen und übernommene doppelte Turn-IDs zählen nicht.
Aktivität und Serien verwenden lokale Kalendertage der Browserzeitzone; gestern
hält eine laufende Serie bis zum Ende des heutigen Tages offen. Die Grafik zeigt
maximal 26 Wochen, numerische Gesamtsummen bleiben vollständig für lesbare Daten.
Fehlende Verläufe, Datums- und Modellwerte werden als Abdeckung genannt.
Native kumulative Tokens sind nur insgesamt und ohne geerbte Verläufe ausgewiesen;
keine erfundene Zeitraumaufteilung, Wortmenge, Kosten oder Produktivität.

POST /api/statistics/chat erstellt über briefingChatOpener und saveHandoff einen
Berichtschat; parallele und wiederholte requestIds öffnen denselben Bericht.
Das Öffnen startet keine KI-Runde. Alle drei Zeiträume und Modellzahlen stehen
im gespeicherten Text für spätere Rückfragen. Ein bewusster neuer Klick erzeugt
einen aktuellen Bericht. Entwürfe und laufende Gespräche bleiben erhalten.

Datenvertrag/Migration: additive optionale chat.statisticsTurns mit Startzeit und
Modell für neue Runden sowie chat.statisticsSnapshot Version 1 für Berichtschats.
Keine Massenmigration und kein neues Kontingentkonto. Ältere Daten bleiben gültig;
fehlende historische Modellangaben werden nicht aus der letzten Auswahl geraten.
Älterer Code kann den normalen gespeicherten Berichtstext anzeigen; nach Rückkehr
können bei neu entstehenden Runden Modellangaben fehlen. Keine Datenlöschung.
Prüfungen: Zählung, Zeitzonengrenzen, Serien, Duplikate, Privatsperre, Lücken,
Berichtswiederholung, Fächerbedienung, beide Themes, schmale Breite, große Schrift,
Tastatur, reduzierte Bewegung und Zeitraumwechsel.
### Ergebnisse direkt am Arbeitsverlauf

Die letzte Antwort bündelt Arbeitsverlauf → Ergebnisse → Aktionsicons.
ChatArtifacts sitzt mit space-2/space-4 unmittelbar am Status, ohne unterhalb
der Icons einen eigenen Abschlussblock anzuhängen. Die geschlossene
„Ergebnisse“-Zeile verwendet caption, muted, bestehendes Dateiicon und Chevron.
Aufgeklappte Dateizeilen verwenden dieselben kleinen Schriftrollen und gemeinsame
Bedienhöhen, ohne zusätzliche volle Trennlinien. Bilder zeigen direkt die
bestehende FileContent-Vorschau samt kompakter Dateizeile. Weitere Bilder bleiben
über die vorhandene Aufklapplogik erreichbar. Touchziele behalten control-touch.

Quellcode und technische Projektdateien bleiben in den Arbeitsschritten.
Filter-, Vorschau- und Duplikatregeln führt surfaces/chat.md unter Ergebnisse
für den Leser. Unser Design zeigt dieselbe ChatArtifacts-Komponente mit
lokalen Beispieldokumenten; keine echten Dateien werden dadurch angelegt.


### Unterbrechbares Mitlaufen beim Streaming

createChatScroll bleibt der einzige Scrollbesitzer pro Panel. Erstes Öffnen
positioniert den Verlauf direkt; Textwachstum und der Sprungbutton folgen mit
einer gemeinsamen, abbrechbaren Bewegung aus chatScrollMotion. Neue Textstücke
aktualisieren das Ziel, ohne die Bewegung neu zu starten. Aufwärtsbewegungen
per Rad, Touch, Tastatur oder Scrollbar stoppen vor dem nächsten Schreibzugriff.
Beim Lesen bleibt Browser-Scrollankern erlaubt; Layout- und Ankerbewegungen
aktivieren das Folgen niemals. Erst bewusstes Herunterscrollen bis auf 2 px ans
Ende oder der Sprungbutton aktiviert es wieder. Abschluss und eingeklappte
Werkzeugausgaben überschreiben keine Leseposition. Reduzierte Bewegung setzt
nur beim aktiven Folgen direkt ans Ende. Verborgene Panels und entfernte
Controller stoppen ihre Animationsframes. Chatstart bleibt stabil.
Keine Datenmigration; Entwürfe und gespeicherte Scrollpositionen bleiben kompatibel.

Die AttentionFan-Karten verwenden 48 px Hintergrundunschärfe aus attentionFanMotion
und eine stärkere Tönung der gemeinsamen surface-Fläche (72 %, vorne und bei Hover
86 %). Überlagerte Texte bleiben dadurch ruhig lesbar; reduzierte Transparenz und
fehlender Blur verwenden weiterhin deckende Flächen. Die Statistik verwendet
direkte Zeitraumbuttons statt eines Reglers, einen kurzen Titel ohne Unterzeile
und einen Rückweg zum Kachelstart. Unser Design zeigt dieselben Bausteine.


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
Fenster-/Panewechsel erhält Umschalt-Aufnahmen; nur Gedrückt-halten endet bei Fokusverlust oder Loslassen. Ein Loslassen
während der Mikrofonfreigabe bricht den ausstehenden PTT-Start ab. Erneuter Start
braucht eine neue Geste. Beenden sichert und transkribiert ausschließlich in den
Entwurf, ohne Nachricht zu senden. Vorhandene Audio-Wiederherstellung bleibt.
Einstellungen sind browserlokal unter agent-dictation-shortcut-v1, validiert und
zwischen Tabs synchronisiert; Speicherfehler werden angezeigt. Keine Migration
bestehender Audio- oder Serverdaten. Entfernen des neuen Schlüssels stellt die
plattformabhängige Voreinstellung wieder her. Systemtasten können vom Betriebssystem
abgefangen werden; rechte Strg bleibt als Alternative auswählbar.



## Firma · Version 1

Firma verwendet PageHeading, den kompakten Fortschrittswert und FirmaList: acht
flache, native Aufklappzeilen mit je vier Chataktionen. Kein zusätzlicher Avatar,
Rollen-Dropdown, Hero oder Dashboard. Texte brechen in einer Spalte um, Touchziele
bleiben 44 px. FirmaReview zeigt im bestehenden Composerbereich die aufklappbare
fachliche Abnahme für eine konkrete Version. Inter, Farben und Maße kommen aus
der gemeinsamen Quelle; Chevron-Bewegung respektiert reduzierte Bewegung.
Unser Design zeigt denselben FirmaList-Baustein mit neutralen Daten.
Verhalten und Migrationsgrenzen stehen in surfaces/firma.md.


## Kontingente und Verbrauch · Version 1.1.0

Kontingente sind eine eigene Dienstkarte im AttentionFan. AllowanceBars zeigt
schlichte horizontale Balken untereinander. Die Karte zeigt den verbleibenden
Prozentwert mit „übrig“: Codex · Woche, Claude · Woche und danach separat gemeldete
Claude-Modellwochenkontingente, höchstens vier Zeilen. Fehlende Wochenwerte bleiben
als „Nicht verfügbar“ sichtbar. Spark und kurze Fenster bleiben im Detail. Dort
stehen verbrauchter Prozentwert und Reset-Zeit. Der Klick zeigt alle
gemeldeten Kontingente, Credits und verfügbare Reset-Gutschriften ohne Einlösung.
Der Klick öffnet Einstellungen → Nutzung. Dort gruppiert UsageSettings dieselben
AllowanceBars pro Anbieter in settings-group mit SettingRow und allen Details.
Tokenmengen stehen getrennt im Reiter Verbrauch der Statistik. Typografie und
Farbtokens bleiben gemeinsam; die Kontingente nutzen die Einstellungsnavigation.
StatisticsPreview zeigt dieselben Produktionsbausteine mit Beispieldaten.
ActivityPixels füllt die gesamte Innenbreite als Raster. Gefüllte Tagesfelder
schimmern langsam und leicht versetzt; die Datenhelligkeit bleibt maßgeblich.
statisticsMotion führt die Dauer. Aussehen → Bewegung reduzieren schaltet den
Effekt ab; Systemeinstellung, inaktive Karten und unsichtbare Ansichten pausieren
bzw. deaktivieren ihn. Leere Tage bleiben ruhig, Forced Colors bleibt statisch.

## Direkte Pane-Tastenkürzel · Version 2.1.0

Ctrl + Shift + 1–4 wählt das erste bis vierte geöffnete Chatfeld in der
Ansichtsreihenfolge von links nach rechts, setzt den Composerfokus und startet
das Diktat. Bei „1 Chat“ bedient die 1 immer das verbliebene Chatfeld, auch nach
Verkleinern einer Viereransicht. Interne Pane-IDs bleiben unabhängig erhalten;
Tabnamen, Menüaktionen und zugängliche Eingabebeschriftungen verwenden dieselbe
Ansichtsnummer. Schmale oder maximierte Ansichten erhalten die Reihenfolge aller
geöffneten Felder. Eine Änderung dieser Zuordnung vor dem Mikrofonstart bricht
die ausstehende Geste ab. Keine Migration von Chats, Entwürfen oder Belegungen;
Rückkehr zu 2.0 verwendet wieder die internen Pane-Nummern.
Erneutes Drücken derselben Kombination beendet die Aufnahme und sendet den
Erkennungstext einmal zusammen mit vorhandenem Entwurf und Anhängen. Während
Mikrofonfreigabe bricht erneutes Drücken den ausstehenden Start ab; während
Sichern/Erkennen/Senden werden weitere Start-/Sendeimpulse ignoriert.
Escape bricht Aufnahme oder ausstehende Erkennung ohne Textübernahme und Senden
ab. Bereits übergebene Nachrichten werden damit nicht zurückgerufen. Audio bleibt
unter Stimme wiederherstellbar, Entwürfe und Anhänge bleiben erhalten.
Pane-/Fensterwechsel erhält die Aufnahme. Ein Chatwechsel während der Erkennung
übernimmt ausschließlich in den ursprünglichen Entwurf; verspätete
Statusantworten dürfen niemals in einen anderen Chat senden.
Verborgene oder maximierte Zielpanels werden über die aktive Panelauswahl sichtbar.
Nicht geöffnete Panels melden einen Hinweis; gesperrte Chats starten kein Mikrofon.
Nur ein Listener der äußeren App verarbeitet die Kürzel im aktiven Chatfenster;
Dialoge, Menüs, Einstellungen, IME und Tastenwiederholung sind ausgeschlossen.
Einstellungen → Tastenkürzel erklärt Start, Senden und Escape in der vorhandenen
PaneShortcutSettings mit SettingRows. Belegung aufnehmen, je Pane deaktivieren
und Standard wiederherstellen bleiben erhalten. Doppelte Belegungen und bestehende
App-Kürzel werden abgewiesen; Schreibzeichen ohne Ctrl/Alt/Meta sind nicht erlaubt,
F-Tasten sind möglich. Escape/Tab/Verlassen bricht die Belegungsaufnahme ab.
Speicherfehler bleiben sichtbar. Browserlokaler Schlüssel agent-pane-shortcuts-v1
bleibt validiert und zwischen Tabs synchronisiert. Gespeicherte Belegungen gelten
nun für Diktatstart/Direktsenden; fehlende/ungültige Werte verwenden den Standard.
Keine Audio-/Serverdatenmigration. Rückkehr zu Version 1 macht die Belegungen
wieder zu reinen Fokusaktionen. Separate rechte Command-/Strg-Diktattaste und
PTT behalten die Entwurfsübernahme. Betriebssystem-/Browserbelegungen können
Vorrang haben; keine globalen Betriebssystem-Hotkeys.


### Bilder und SVG im Gespräch · Version 1.1.0

Erzeugte Bilder gehören sichtbar in ChatArtifacts, auch bei eingeklappten
Werkzeugschritten. ToolImages zeigt Bild, Vergrößern im gemeinsamen Modal und
Download; Fehler und Wiederholen bleiben erreichbar. SVG-Dateien teilen die
FileContent-Vorschau mit getrenntem Quelltext-/Bearbeitungsmodus. SVG-Codeblöcke
zeigen eine inaktive Bildvorschau über ihrem aufklappbaren Quelltext samt
CopyButton. Alle Vorschauen bleiben innerhalb der Nachrichtenspalte.
Abstände, Schrift und Rundungen verwenden bestehende Tokens; keine neue
Farbwelt oder Animation. Unser Design enthält ein Beispielorganigramm im
produktiven Markdown-Renderer. Vollständiger Daten-/Migrationsvertrag unter
surfaces/chat.md, Visuelle Chat-Ergebnisse.


## Portabler UI-Bauplan

Gestaltung und Bedienverhalten gehören zu jeder Quellübernahme. Der Vertrag
für die Integration in bestehende eigene Module steht in ../docs/UI-UPDATES.md.
Die separate blueprint.html verwendet dieselbe DesignReference wie Unser Design.
ChatStartPreview zeigt den echten Gesprächseinstieg mit umschaltbarem Ladezustand
und simulierter Anhangsfläche, neutralen Daten und rein lokalen Aktionen.
Die Vorlage liest keine Kundeninhalte. Hell/Dunkel und eine begrenzte Inhaltsbreite
helfen beim Vergleich; Handybedienung wird zusätzlich am tatsächlichen Viewport
geprüft. PageHeading liegt für Anwendung und Bauplan gemeinsam in ui/page-heading.tsx.
Farben, Schrift und Abstände verwenden weiter die zentrale Designquelle.
Build-Herkunft und Datei-Hashes machen veraltete Ausgaben erkennbar; die visuelle
Abnahme bleibt notwendig. Eine lokale Erweiterung übernimmt die gemeinsamen
Bausteine und dokumentiert fachlich notwendige Abweichungen im Bereichsvertrag.

### Workspace-Einrichtung und Kategorien

Die Workspace-Überschrift ist als beschrifteter Button auch per Touch und
Tastatur erklärbar. Plus öffnet den kompakten Workspace-Dialog; das Kontextmenü
bietet Bearbeiten und die optionale Anpassung im Chat. WorkspaceDefinitionEditor
verwendet Modal, Settings-Skeleton, Field-Muster und native Radio-Auswahl.
Der Inhalt scrollt unabhängig von Kopf und Aktionen. Fehler bleiben am Entwurf.
Aufträge und Ergebnisse verwenden den bestehenden FilterPicker für Workspaces.
Gemeinsame Abstände und Schriftrollen gelten.
Die identischen Komponenten stehen unter Unser Design; den fachlichen Ablauf,
Bestandsregeln und Grenzen führen surfaces/workspaces.md und surfaces/jobs.md.

Gesprächs-Skeletons stehen in derselben `message-column` wie geladene Turns.
Dadurch teilen sie Maximalbreite, Panelränder und vertikale Abstände mit dem
Verlauf und dem Composer, auch bei mehreren Panels und schmalen Fenstern.
Der Skeleton beginnt wie echte Antworten direkt mit dem Inhalt und reserviert die gemeinsame Zeile oberhalb der Eingabe.
Der App-Start verwendet ebenfalls Chatpanel, Nachrichtenspalte und Composerbereich
statt eigener Inhaltsbreiten. Reine Layoutkorrektur, keine Datenmigration.

### Startkarten · Version 1.4.0

Kompakte Überlappung aus attentionFanMotion; bei bis zu 800 px Höhe schrumpfen
Avatar und Abstände, Karten und Touchziele behalten ihre Größe. Der Startbereich
reserviert oben 64 px und unten die gemessene Composerhöhe. Kein Nachrichten-Fade
über den Startkarten; bei Platzmangel bleibt die Navigation scrollbar erreichbar.
Wetter und Kalender stehen als letzte feste Karten direkt links neben der ersten
Karte im umlaufenden Stapel, nach Statistik und Kontingenten. Der Kalender zeigt
das lokale heutige Datum und öffnet den Tagesbericht mit vorhandenen Terminen.
Keine automatische Rotation, Nachrichten oder zusätzlichen Abrufe. Bestehende
Auswahl und Reihenfolge bleiben während der Nutzung stabil; neue ungelesene
Antworten bleiben verfügbar. Keine Datenmigration; Rückkehr ist rein visuell.

Weiterentwicklung, noch nicht implementiert: freiwilliges Ausblenden einzelner
Inhalte bis zu einer relevanten Änderung; wenige zeitlich passende Anlässe beim
neuen Einstieg, höchstens ein Vorschlag pro Thema und keine Wiederholung ohne
neuen Nutzen. Dringende Rückfragen behalten Vorrang.

## Nachrichtenbelege und Bildschirmhinweise · Version 1.0.0

DeliveryMark verwendet vorhandene Check-, Clock- und AlertCircle-Icons in muted
direkt unter der Nachrichtenblase. Zwei Checks stehen leicht versetzt als ein
zusammenhängendes Symbol. Keine Statusfarben; Fehler nennen zusätzlich „Nicht gesendet“ oder
„Zustellung unklar“. Tooltip und zugänglicher Name bleiben vorhanden. Layout, Fehlerbedienung und
Datenvertrag stehen in surfaces/chat.md.

Alle SystemNotice-Zustände einschließlich Updates stehen oben rechts mit space-16
und sicheren Displayrändern. Das Portal an document.body verhindert eine
Verschiebung durch transformierte Chat-/App-Flächen. Schmale Ansichten begrenzen
die Breite und erlauben Textumbruch. Bestehende GlassButton-/Hinweisbausteine,
Tastaturbedienung und Neustartbestätigung bleiben erhalten.


## Effizientes Laden · Version 1.0.0

Der Chat-Composer und die Navigation bleiben während des Nachladens bedienbar.
Zusatzseiten, Einstellungsinhalte, Berichte und Dialoginhalte verwenden lokale
`lazySurface`-Grenzen mit dem gemeinsamen Skeleton. Ein Ladefehler betrifft nur
diesen Inhalt und bietet Wiederholen an; kein automatisches Neuladen und kein
Verlust von Entwürfen. Bestehende Farben, Schriften, Abstände und Bedienwege bleiben.
Vite trennt JavaScript und CSS nach Bedarf. Statische Assets tragen Inhalts-Hashes;
Brotli/Gzip entstehen beim Build. Alte Hash-Dateien bleiben für bereits offene
Tabs erhalten. Private Inhalte gelangen weder in den Asset-Cache noch in den
Service Worker. Öffentliche Assets sind kein Offline-Modus für Chats.

Geteilte gleichzeitige GET-Anfragen leben nur bis zur Antwort im Arbeitsspeicher.
Schreibaktionen invalidieren diese Zuordnung und werden niemals automatisch
wiederholt. Native Worker-Kontexte, Dateien, Aufträge und Server-Sessions sind
unabhängig davon vollständig erhalten. Kein Reset oder neue Nutzereinstellung.


## Chatabruf und optionale Startdaten · Version 1.1.0

Die Browseransicht verwendet `/thread?view=chat`. Nachrichten, native Sitzungssteuerung,
Ergebnisdateien und erzeugte Bilder bleiben vorhanden. Große Werkzeugausgaben
werden als beschriftete Zusammenfassung übertragen und erst beim Öffnen des einzelnen
Schritts über `/thread/item` geladen. Der bestehende Chat-Datenschutz gilt vor und nach
beiden Antworten. Originalverlauf, Exportanschluss und Worker-Kontext bleiben vollständig.
Auch bereits vorhandene Werkzeugdaten werden erst aufgeklappt gerendert.
Fehler und Zeitüberschreitungen bieten Wiederholen im betroffenen Bereich; Entwürfe
bleiben erhalten. Leseanfragen ohne eigenes Abbruchsignal erhalten bis zu 65 Sekunden, passend zum nativen Worker-Limit. Beim Chatwechsel, Verlassen oder Sperren wird der nicht mehr benötigte Verlaufsabruf sofort abgebrochen; andere Panels bleiben unabhängig. Abbrüche zeigen eine verständliche Wiederholungsmöglichkeit.

Der Startfächer zeigt vorhandene Hinweise direkt. Aufträge, Profil und Berichte
ergänzen sich unabhängig; eine langsame Quelle sperrt die anderen nicht. Der
gemeinsame Attention-Skeleton bleibt für das Laden des Oberflächenmoduls vorhanden.
Verbindungsdaten werden erst für die Verbindungsseite oder einen Ablauf geladen,
der sie benötigt. Keine Migration gespeicherter Chats, Aufnahmen oder Einstellungen.
Die Nachrichtenübergabe verwendet `DeliveryChecks`: ein feines neutrales
Einzelzeichen (10 × 10 px) oder Doppelzeichen (15 × 10 px) mit nur teilweise
sichtbarem hinterem Haken. Keine zwei sich kreuzenden vollständigen Icons.
`message-delivery` steht direkt rechts hinter der Uhrzeit mit `space-4` Abstand.
Beide bleiben in `message-meta` vertikal zentriert und ohne Zeilenumbruch zusammen,
auch wenn die Aktionsleiste umbricht. Die gerundete Kontur verwendet 1.5 SVG-Einheiten. Fehler behalten die bisherigen
zugänglichen Bedienflächen. Unser Design zeigt dieselben Bausteine.
Statusbedeutung und Speicherung bleiben unverändert; keine Datenmigration.

## Produktupdates und GitHub

Einstellungen → Updates verwendet PageHeading, vorhandene tabs, SettingRow, SettingsNavigationRow, Settings-Skeleton und Modal. Version und Beiträge zeigen tatsächliche Kernzustände; kein Fortschrittsprozent ohne Messung. GitHub steht mit Originalzeichen unter Verbindungen. NotificationRow öffnet je nach Betreff den Updatebereich oder die vorhandene Auftragsansicht. Technische Details bleiben aufgeklappt; bestehende Themes, Touchziele und Fokusregeln gelten.

## KI-Programme aktuell halten

KI & Modelle erweitert bestehende SettingRow-Gruppen, apple-switch, Suchfeld,
Settings-Skeleton und native Details. Neue Versionen und Wartezustände verwenden
Text statt eigener Statusgrafiken. Der öffentliche Modellkatalog bleibt sichtbar
als fremde Informationsquelle gekennzeichnet. Der vorhandene Startfächer und
NotificationRow öffnen die KI-Einstellungen. Keine neue Palette oder Kartenform.

## Geräteanschlüsse

Geräte & Netzwerk erweitert ausschließlich den vorhandenen Verbindungskatalog.
Gerätedialoge verwenden Field, SettingRow, Modal, apple-switch und native Details.
Freigabe und letzte Verbindungsprüfung erhalten getrennte Textzustände; keine
Live-Verbindung durch einen lediglich gespeicherten Status behaupten. Die
Fernbedienung nutzt die vorhandenen umbrechenden Aktionszeilen. Bildschirmbilder
bleiben auf Dialogbreite und 60 vh begrenzt. Aufbau führt surfaces/connections.md.
## Kalender im Glasfächer

CalendarCardContent verwendet den vorhandenen AttentionFan ohne eigene Kartenmaße.
Datum in der zentralen Rolle calendar (56 px), Wochentag und Countdown mit
brand-accent, Monat/KW mit muted. Ohne weiteren heutigen Termin ist nur der
Hinweis unter Monat/KW muted. Wochentag behält brand-accent, die Tageszahl
behält die normale helle Textfarbe im dunklen Design.
Nur der nächste Termin steht auf der Karte: Countdown und Uhrzeit zusammen,
der Titel darunter maximal zweizeilig. Weitere Termine stehen im Tagesbericht.
Unvollständige oder veraltete Daten heißen „Termine möglicherweise nicht aktuell“.
Keine zusätzliche Daueranimation.
Die Kalenderkachel folgt Fächerbewegung, Reduced Motion und Kontrastvorgaben.
CalendarPreview zeigt denselben Produktionsbaustein mit markierten Beispieldaten in
Unser Design und damit im gemeinsamen UI-Bauplan. Verhalten: surfaces/chat.md.


### Einheitliche Claude- und Codex-Bedienung

Über jedem Composer steht rechts ModelPicker mit Einzug auf die Achse des Sendepfeils. Separate native
Worker-Menüs entfallen auch bei Claude. Der nativ verfügbare Fast-Schalter
verwendet denselben Blitz und Statusindikator im Modellfenster. Die bestätigte
Beschreibung des nativen Default-Modells liefert, sofern gemeldet, seinen
lesbaren Modellnamen. Die nativen IDs und Denkstufen bleiben unverändert.
Im ruhenden Chat startet der Anbieterbutton den Wechsel unmittelbar; eine
laufende Antwort verwendet weiterhin „Stoppen und wechseln“. Kein zusätzlicher
Ladeschritt oder neues Dialogmuster. Gemeinsame Fehlermeldung, Fokusführung,
Touchziele und reduzierte Bewegung bleiben wirksam.

### Stabiler Verlauf während der Nachrichtenübergabe

Beim Absenden bleiben vorhandene Antworten sichtbar. Sending und Accepted lösen
keinen zusätzlichen nativen Verlaufsabruf aus. Nach bestätigtem Start oder einem
Übergabefehler gleicht der bestehende Abruf den Verlauf ab, ohne bereits sichtbare
Textstücke, Arbeitsschritte oder neuere Turns durch einen verspäteten oder leeren
Zwischenstand zu entfernen. Wiederverbindungen verwenden denselben Abgleich;
explizite Bearbeitung und Löschung behalten ihre eigenen Ersetzungswege.
Privat gesperrte Chats dürfen verspätete Antworten nicht übernehmen.
DeliveryView erhält Referenzen unveränderter Turns und Werkzeugausgaben; nur die
zugehörige Nutzerblase bekommt den Zustellbeleg. Identische Belege verwenden die
vorhandene Darstellung weiter. Keine neuen Komponenten, Tokens oder Animationen.
Keine Datenmigration; native Sitzungen und gespeicherte Verläufe bleiben unverändert.

Die Modellliste zeigt Claude-Familie und native Version einschließlich .0; Kontextvarianten bleiben beschriftet. Ein intern gewähltes Default-Modell markiert die konkrete Zeile nur bei übereinstimmender resolvedModel-ID. Der Regler übernimmt dabei die bestätigten Denkstufen des Default-Modells. Unser Design enthält denselben Aliasfall als lokales Beispiel.

### Stimmenprofile

`VoiceProfiles` verwendet gemeinsame SettingRows, kreisrunde Iconaktionen und den vorhandenen Modal: Plus öffnet Voice-ID und optionalen Namen. Gespeicherte Namen bleiben vorn, IDs stehen als sekundäre Beschreibung. Die Auswahl verwendet Check mit aria-pressed; Bearbeiten und Entfernen haben eindeutige Beschriftungen. Fehler bleiben am Formular, während Speicherung sind Aktionen gesperrt. `VoiceProfilesPreview` zeigt denselben Baustein in Unser Design ohne Anbieteraufrufe.

Hinweise zur Zugangsspeicherung benennen jetzt die lokale .env im Vanilla-Ordner. Die bestehenden Verbindungsdialoge, Secret-Zeilen und der Status der Schlüsselablage bleiben die gemeinsamen Bausteine; es gibt keine zusätzlichen Mac-Passwortfelder.


### Unmittelbare Composer-Auswahl

Engine, Modell und Denkaufwand verwenden weiterhin denselben ModelPicker und
seine beiden Ansichten. Die Auswahl wird sofort lokal angezeigt, ohne Ladeanzeige
oder Sperre für den Hintergrund-Speichervorgang. „Nächste Nachricht“ bezeichnet die
Vormerkung; die laufende Antwort bleibt unberührt. Fehlende Modelloptionen zeigen
den nativen Standard für die nächste Nachricht. Verbindungsaufbau und native
Bestätigung gehören erst zum vorhandenen Nachrichten-Postausgang beim Senden.
Speicherfehler verwenden die bestehende Fehlermeldung. Keine neuen Tokens,
Komponenten oder Animationen. Verhalten und Migration: surfaces/chat.md.


## Vereinfachter mobiler Chat · Version 1.1.0

Bis 650 CSS-Pixel schließen Chatwahl (auch derselbe Chat oder ein anderes Panel),
neuer Chat und die Auswahl eines Hauptmenü- oder Einstellungseintrags die linke
Navigation. Die Inbox behält ihren eigenen Wechsel zwischen Liste und Gespräch.
Die seitliche Nachrichtennavigation entfällt auf dem Handy. Nachrichten selbst
bleiben vollständig erhalten; die Inhaltsränder nutzen space-16.

MessageActions aus chat-controls.jsx bündelt mobile Aktionen hinter einem
beschrifteten Mehr-Icon mit aria-expanded. Erneutes Tippen oder Escape schließt
sie, Escape stellt den Fokus wieder her. CopyButton, Bearbeiten, Verzweigen,
Wiederholen, Löschen und Vorlesen verwenden ihre bisherigen Anschlüsse.
Aktive Sprachwiedergabe und deren Fehler bleiben auch bei geschlossenen Aktionen
sichtbar. Touchziele behalten control-touch. Auf Desktop bleibt die vorhandene
Hover-/Tastaturdarstellung bestehen; Unser Design zeigt denselben Baustein.

Abgeschlossene erfolgreiche Werkzeugverläufe sind mobil ausgeblendet; laufende
Arbeit, Rückfragen, Fehler und unvollständige Schritte bleiben erreichbar.
Die laufende Statuszeile zeigt mobil keine Schrittzahl oder Laufzeit.
Auch mobil bleibt die Identität im Seitenleistenkopf; eine Autorenzeile über jeder Antwort entfällt.
Nachrichtenabstände verwenden space-8, Status-/Kopfabstände space-4.
Keine Datenmigration: Originalverlauf, Geräte, Einstellungen und Exporte bleiben
unverändert. Ein älterer UI-Stand zeigt wieder die ausführliche Darstellung.


### Aufträge und Ergebnisse

Aufträge und Ergebnisse verwenden denselben FilterPicker „Workspace“ und die
Auswahl „Alle Workspaces“. Die Auftragsseite kombiniert ihn mit Status und Suche,
die Ergebnisse mit Dateityp/Favoriten und Suche. Kategorieeingaben, Kategoriefilter
und die zusätzliche Kategorie in Auftragszeilen entfallen. JobForm behält seine
Workspace-Auswahl. Die gemeinsame Referenz zeigt denselben FilterPicker.
Bestehende Buttons verbinden Auftrag und Ergebnisse. Keine neuen Tokens oder
Animationen. Daten-/Rückkehrvertrag: surfaces/library.md und surfaces/jobs.md.


### Slash-Vorschläge über der Eingabe

ComposerCommands verwendet die vorhandene ComposerQuestion-Glasfläche, Schrift-,
Abstands-, Fokus- und Touchrollen. Eine flache Liste mit Befehlsname und optionaler
Beschreibung öffnet ausschließlich bei führendem Slash; die Modellzeile bleibt
unverändert. Ausgewählter Treffer nutzt hover, kein neues Material oder Effekt.
Die Liste scrollt innerhalb von 30dvh; Neu laden, Ladezustand und Meldungen bleiben
erreichbar. Reduzierte Bewegung/Transparenz und Forced Colors folgen dem bestehenden
Baustein. Tastaturwahl übernimmt nur in den Entwurf, Escape schließt. Unser Design
zeigt denselben Produktionsbaustein. Vertrag: surfaces/chat.md, Slash-Befehle im Composer.
### Mobile Navigation und bündige Nachrichtenaktionen

Bis 650 px zeigt der Chat ausschließlich die aktive Pane. LayoutPicker, Pane-Tabs
und Pane-Kopfaktionen werden nicht angeboten; Titel und Chatwechsel bleiben im
gemeinsamen Kopf und der Navigation erreichbar. Gespeicherte Desktop-Aufteilung,
Pane-Identitäten und Entwürfe bleiben erhalten. Das mobile Menü nutzt die
Bildschirmbreite abzüglich space-32 und schließt bei jeder Chatauswahl.

MessageActions verwenden auf Desktop und Mobile transparente, ungefüllte
Icon-Schaltflächen ohne runden Hintergrund oder Auswahlrahmen, auch beim Öffnen
und Hover. Tastaturfokus bleibt sichtbar. Die erste Agentenaktion liegt mittig
auf derselben Achse wie das Fortschrittsicon; die unsichtbare Trefferfläche bleibt
control-height (32 px) beziehungsweise control-touch (44 px) groß. Der vertikale Abstand zum
Fortschritt beträgt space-4, die Aktionszeile hat keine zusätzlichen Blockränder.


### Feinausrichtung im Chat

ComposerHeading zeigt ausschließlich Modell und Denkstufe rechts über der Pille.
Der horizontale Einzug entspricht space-8 plus der halben Sende-Trefferbreite
(control-target, bei Touch control-touch). Die Identität bleibt im Seitenleistenkopf.
Die Reihenfolge ist Rückfragen/Slash-Liste, Anhänge, Modellwahl, Schreibpille. Unter der
Pille stehen keine Zusatzzeilen. Die Unterkante liegt mit space-8 bündig zur
Seitenleiste; sichere Displayränder gehen vor. Mehrzeiliger Text wächst nach oben.
Antworten beginnen ohne wiederholte Autorenzeile; der genaue Zeitpunkt steht im
Tooltip am Antwortblock. Relative Altersangaben entfallen dort.
Der obere Verlauf-Fade beträgt 2.4 × space-64 statt 3 × space-64 (20 % kürzer).
Der untere Fade und die automatische Scrollentscheidung bleiben unverändert.
Nachrichtenaktionen haben am Desktop 32 px Trefferbreite ohne Zusatzlücke,
auf Touch weiterhin 44 px. Auch die spezifische globale Hoverregel darf keine
Fläche erzeugen; Iconfarbe und sichtbarer Tastaturfokus geben Rückmeldung.
Uhrzeit und kompakte DeliveryChecks bleiben als ruhige Gruppe zusammen.
Die Sprungmarken stehen am linken Panelrand, vertikal mittig, und behalten ihre
Vorschau und Tastaturbedienung. Mobil bleiben sie ausgeblendet.
Bestehende ComposerQuestion und native Antwortwege werden wiederverwendet;
Freitext und gewöhnliche Chatfragen erzeugen keine künstlichen Auswahlkarten.
Keine Datenmigration. Rückkehr verändert nur Darstellung; Entwürfe, Nachrichten,
Profile und native Rückfragen behalten ihre bisherigen Datenformate.

Die äußere App-Hülle verwendet overflow: clip. Auch programmatischer Fokus
oder ScrollIntoView darf sie nicht verschieben; ausschließlich die inneren
Bereiche scrollen. Insbesondere bleiben mobiler Kopf und Composer beim
Öffnen eines Chats an ihren Bildschirmkanten. Keine Datenmigration.


### Ladegrenzen für zusätzliche Chatpanels

Der App-Start zeigt `shell` mit genau einer Seitenleiste. Eingebettete Chatpanels
verwenden `chat-panel`: dieselbe Nachrichtenspalte und Eingabegeometrie, ohne
Seitenleistenplatzhalter und ohne volle Fensterhöhe. Beim späteren Verlaufsabruf
bleibt `chat` innerhalb der vorhandenen Nachrichtenspalte. Datei- und
Änderungsansichten behalten ihre lokalen Listen-/Dokumentplatzhalter.
Die Bausteinreferenz zeigt auch den Panelstart. Keine Datenmigration.
Der Modulplatzhalter der Ordneransicht verwendet ebenfalls die kompakte Dateiliste.
Slash-Befehle blenden beim Modulimport keine zusätzliche Liste im Composer ein;
der geladene Befehlsbaustein zeigt seinen eigenen Abrufstatus.


## Chatübergreifendes Vorlesen und Arbeitsbegleitung

„Chat vorlesen“ im Chatmenü und im Menü der Chatliste aktiviert die sichtbaren künftigen Agenten-Prosameldungen
und Endantworten dieses Chats. Keine Werkzeugausgaben oder Reasoning-Inhalte.
Abgeschlossene Meldungen werden dedupliziert; ACP-Prosa wird spätestens beim
folgenden Werkzeugstart vorgelesen. Es spricht genau eine Quelle pro Browser-Tab.
Eine andere Antwort, Stimmprobe oder Begleitung schaltet die vorherige Quelle aus.
Navigation und Panelwechsel lassen die Quelle bestehen. Neuladen startet stumm.
Der Lautsprecher unter einer Antwort verwendet dieselbe gemeinsame ChatAudio-Steuerung.

ChatAudioButton zeigt rechts am betroffenen Chat Pause/Play, bei wartender Begleitung
einen Lautsprecher. Die globale kompakte Steuerung bleibt oben mittig auch ohne
Seitenleiste erreichbar; ihr Tooltip nennt den Quellchat. Stop schaltet vollständig aus.
Mikrofonstart pausiert vor dem Öffnen sofort auch ausstehende Ausgabe. Solange das
Diktat aktiv ist, ist keine Wiedergabe möglich; anschließend bewusst fortsetzen.
Pause erhält die Audioposition; nach fünf Minuten endet die Quelle. Während Pause
entfallen Zwischenmeldungen, die letzte Endantwort bleibt zum Fortsetzen bereit.
Ein überholter Rückstau wird durch die neueste Meldung ersetzt. Fertiges manuelles
Vorlesen verschwindet; eine aktivierte Begleitung wartet sichtbar auf neue Arbeit.
Archivieren und Sperren beenden die Quelle. Fehler stehen an der globalen Steuerung.

Gemeinsame IconButton-Bausteine und vorhandene Tokens, keine Animation oder weitere
Einstellungsseite. Unser Design enthält eine isolierte Play/Pause/Stop-Vorschau.
Nur flüchtiger Browserzustand, keine Migration gespeicherter Chats oder Stimmen.


Der kompakte Agentenmenükopf zeigt Vanilla mit Version und Denzer AI. Verbindung, Engine und Antwortzeit teilen eine dezente Zeile. Commitkennung und Zeitpunkt stehen in einer Zeile; Push, Neustart und Laufzeit folgen ohne Leerzeilen. Zeitpunkte zeigen Tag, Monat und Uhrzeit, das vollständige Datum einschließlich Jahr bleibt im Tooltip. Die Serveradresse schließt den Statusblock ab. Der gemeinsame randlose IconButton für Neustart und ThemeToggle teilen den Menüfuß; Fokus und Touchfläche bleiben erhalten.


### Sieben lebendige Startkarten

Der vollständige Chatstart ergänzt die vorhandenen Themen bei Bedarf mit den
bestehenden echten Gesprächseinstiegen auf sieben unterschiedliche Karten. Auf
breiten Flächen stehen drei links und drei rechts der Mitte; kleinere Ansichten
zeigen fünf oder drei. Auch bei weniger Einträgen bleibt die sichtbare Zahl ungerade.
Automatischer Wechsel alle 6,5 Sekunden mit gemeinsamem Federübergang; Zeigerkontakt
hebt eine Karte an, stoppt den Umlauf aber nicht dauerhaft. Pause/Play steht neben
den Pfeilen. Tastaturfokus, Schreiben, verborgene Ansichten und reduzierte Bewegung
pausieren. Der automatische Zähler bleibt für Screenreader still.

Die Glasflächen tragen langsame gebrochene Lichtreflexe hinter feststehendem Text.
Kalender: dunkle violette Glasbasis mit weißer Tageszahl in beiden Themes.
Kontingente: bis zu vier echte Fenster, zuerst Woche und kurzes Fenster je Anbieter,
danach weitere gemeldete Fenster,
mit kräftigeren Restbalken und Lichtreflex. Resetzeiten stehen im Tooltip und
vollständig unter Nutzung. Fehlende Werte werden nicht als Fortschritt gezeichnet.
Gemeinsame Rollen fan-glass-light, fan-calendar-base, fan-glass-duration und
attentionFanMotion steuern Material und Bewegung. Aussehen → Bewegung reduzieren
schaltet die Bewegung ab; reduzierte Transparenz und Forced Colors bleiben lesbar.
Bestehende AttentionFan-Referenzen verwenden dasselbe Material. Keine Datenmigration.

## Messenger in der gemeinsamen Inbox

InboxComposer verwendet dieselbe ComposerFocus-Pille, IconButton und Sendepfeil
wie der Chat. Antwortbezug, Anhang und gesicherte Sprachaufnahme stehen darüber.
InboxConversationRow und der mobile Vollbreitenwechsel bleiben unverändert.
Verläufe ergänzen kompakte Antwortzitate, Medien mit nativen Steuerelementen und
DeliveryChecks für tatsächliche Anbieterbelege. Reaktionsauswahl bleibt beschriftet.
Alle Farben, Abstände, Rundungen und Schriften verwenden bestehende Tokens.
InboxPatternPreview zeigt den gemeinsamen Composer mit fiktiven lokalen Daten.
Verbindungen ergänzen MessengerConnectionForm im vorhandenen Modal-/Field-Muster.
Datenhaltung, Aufnahmeerhalt und Versandgrenzen stehen in surfaces/inbox.md und
docs/MESSENGER.md. Keine automatischen Antworten oder dekorativen Effekte.

Messengerblasen verwenden inhaltsabhängige Breite bis 82 % und die bestehende
surface-Fläche. Zeit, DeliveryChecks und ChatMenu-Mehraktion sitzen kompakt am
unteren Rand; Gruppensender bleiben lesbar. Keine eigene Menü- oder Iconfamilie.
QR-Kopplung liegt ausschließlich im bestehenden Verbindungsmodal.

Inbox-Sprachnachrichten verwenden `InboxVoiceMessage`: kompakter Play/Pause-
IconButton, echte suchbare Fortschrittsleiste und Zeitangaben, kein Autoplay.
`InboxTranscript` zeigt den Text standardmäßig offen; die komplette Kopfzeile
mit rechtsstehendem Chevron klappt ihn per Maus, Touch oder Tastatur ein.
Keine Datei-Symbole oder nativen Disclosure-Dreiecke. Fehlende Transkripte
werden als noch nicht verfügbar bezeichnet, nicht als fertige Erkennung.


## Kalender: Monat und Stundenraster

PlannerCalendar ist der gemeinsame Baustein in Produktion und Designreferenz.
Großzügiges Monatsraster, schmale KW-Spalte links, ausgeschriebene Wochentage auf
Desktop. Kleine Tageszahlen ohne Kreis, Heute mit feiner Zellkontur. Termine als
kompakte einzeilige Punkt/Zeit/Titel-Zeilen in text-small ohne Kartenflächen; ihre Anzahl richtet
sich nach dem verfügbaren Platz. Der Zeitraum ist der einzige Seitenkopf in text-section (mobil text-heading),
darunter eine gemeinsame Werkzeugzeile. Neue Ansichten starten Mo–Fr. Keine dauerhaften
Status-Unterzeilen oder Wochenenderklärungen; echte Lade-/Fehlerhinweise bleiben.
Tag/Woche: flache Tagesköpfe und Halbstundenraster mit bestehenden Terminblöcken.
Die Ganztagszeile erscheint nur mit Inhalt. Zentral: calendar-hour-height,
calendar-month-event-height, calendar-day-number-height, calendar-week-gutter.
Verhalten, mobile Anpassung und Grenzen: surfaces/today.md.

### Beständige Diktataufnahme

Diktat und Erkennung gehören der zentralen RecordingProvider-Sitzung. Navigation
und Panewechsel erhalten sie. Außerhalb des ausgewählten Ursprungscomposers
zeigt eine flache Pille oben rechts ein neutrales Mikrofon zum Rücksprung,
Dauer, Pause/Fortsetzen und Stop. Kein sichtbarer Titel oder pulsierender Punkt.
Radius-pill und 44-px-Bedienziele ergeben ohne vertikales Padding 46 px Höhe.
Der Chatname steht im Tooltip und zugänglichen Namen des Rücksprungs.
RecordingIndicator markiert statisch den Ursprungschat in der Seitenleiste
und die passende Pane; ungespeicherte Chats markieren ihren Workspace.
Aufnahme zeigt ein rotes Record-Zeichen, Pause ein graues Pausenzeichen.
SystemNotice weicht um die gemessene Höhe aus.
Rückkehr zeigt dieselbe Aufnahme wieder im Composer. Stop übernimmt ausschließlich
in den ursprünglichen Entwurf, ohne Versand oder Ansichtswechsel. Ein expliziter
Sendebefehl fällt bei zwischenzeitlichem Chatwechsel auf diesen Entwurf zurück.
IconButton, VoiceStatus und bestehende Tokens gelten auch mobil; RecordingPreview
zeigt das Muster unter Unser Design. Rückfragen bleiben an die konkrete Frage
gebunden. Keine Datenmigration. Wiederherstellung und Hintergrundgrenzen führt
[DICTATION.md](DICTATION.md#aufnahme-beim-navigieren).


### Kompakte Workspace-Dialoge

WorkspaceDefinitionEditor verwendet beim Erstellen und Bearbeiten denselben
project-dialog auf randloser sheet-glass-Fläche mit vorhandenem Blur und Fallbacks.
Name und klickbares Symbol bilden den Kopf des Formulars. Das Symbol öffnet native
Radio-Gruppen mit Katalogicons und Farbkreisen; Touchziele und Fokus bleiben sichtbar.
Weitere Angaben sind zugeklappt. Nur der Formularinhalt scrollt, Titel und Aktionen
bleiben im Fenster. Statusauswahl und Markdowneditor entfallen; besondere
Arbeitsweisen sind im Chat anpassbar. Gemeinsame Tokens, Modal, Skeleton und
Field-Muster; keine neue Farbskala oder Animation. Die Bausteinreferenz verwendet
denselben Dialog. Verhalten und Rückkehr: surfaces/workspaces.md.


### Ablage neben dem Gespräch

Die bisherige rechte Workspace-Leiste heißt Ablage; Workspace bleibt die
Projekt-/Chatgruppe. Kopf, native Auswahl Im Chat/Dateien, flache chronologische
Zeilen und lesende Dateivorschau folgen wrapper/surfaces/chat.md, Abschnitt
Veränderbare Breiten und Ablage. ChatShelf/ShelfFilePreview verwenden gemeinsame
IconButtons, FileContent, Skeleton und zentrale Material-/Schriftrollen.
Die Liste zeigt kleine Formatsymbole, Namen, Herkunft und belegte Zeiten;
keine Kartenwand oder neue Palette. Glas bleibt auf Auswahl/Hover zurückhaltend.
Unser Design zeigt dieselbe Produktionsliste mit Beispieldaten. Öffnen beginnt
mit 360 px, Ziehen bleibt ab 280 px möglich; mobile Schließen-Aktion bleibt sichtbar.

Bei sichtbarem Update-/Neustarthinweis reservieren Chat-Kopfaktionen und
Ablage-Kopf darunter die vorhandene Touchhöhe plus space-16, damit der schwebende
Hinweis Öffnen, Vergrößern und Schließen nicht überdeckt.


### Aktionen für nicht bestätigte Nachrichten

Fehlerbelege nutzen die vorhandene Nachrichtenaktionszeile mit IconButton und
CopyButton. Wiederholen, Bearbeiten und Löschen bleiben bei Fehlern auch ohne
Hover sichtbar, die Zeile darf auf schmalen Ansichten umbrechen. Der Status nennt
„Nicht gesendet“ oder „Zustellung unklar“. Der gemeinsame Modal erläutert vor
Wiederholung eines unklaren Versands die mögliche doppelte Ausführung; Bearbeiten
verwendet Field und textarea, Löschen den vorhandenen danger-Button.


### Kalender-Kopfaktionen

CalendarHeaderActions verwendet zwei gleich große IconButtons mit Plus und
MoreHorizontal rechts vom Zeitraum. Transparente popover-glass-Fläche, feine
border-Kontur, radius-pill und control-touch. Das gemeinsame ChatMenu öffnet Quellen,
Beispielumschaltung und Details. Beispielansicht steht in text-small und muted beim
Zeitraum statt als Aktionsbeschriftung. Produktion und Designreferenz teilen den
Baustein; Navigation bleibt in der darunterliegenden Werkzeugzeile.

## Grundtriage der Inbox

Fokus und Alle ersetzen die bisherige ständig sichtbare Statusleiste. Fokus
zeigt Gespräche und darunter aufklappbare Gruppen für Werbung & Newsletter,
Belege & Bestellungen und Benachrichtigungen. Keine Zähler in farbigen Badges;
Anzahlen stehen neutral rechts. Alle zeigt die flache Liste des gewählten
Status. Suche öffnet Treffer aus allen Gruppen, ohne ihre Einordnung zu ändern.

Ein Filter-Icon öffnet den bestehenden Modal mit gemeinsamen Field-Labels und
nativen Selects für Kanal, einzelnes Postfach, Status und Einordnung. Standard:
alle Konten, alle Kanäle, offene Gespräche, Fokus. Der aktive Filter wird kurz
angezeigt, Zurücksetzen bleibt im Dialog. Kein zusätzlicher Einstellungsbereich.
Postfach-/Kanalwechsel hebt die Gesprächsauswahl auf; Entwürfe bleiben erhalten.
Es wird kein Gespräch automatisch geöffnet oder dadurch als gelesen markiert.

Gesprächszeilen enthalten einen einzeiligen Absender, bei Mail darunter einen
einzeiligen Betreff, rechts Uhrzeit und lokalen Lesestatus. Das Kanalicon bleibt
klein. Vollständige Namen und Inhalte stehen im geöffneten Gespräch.

Das Einordnungs-Icon im Mailkopf öffnet Grund und Kategorienauswahl. Die bewusste
Auswahl gilt dauerhaft für dieses Gespräch, bis „Automatisch einordnen“ gewählt
wird. Keine automatische Absenderregel. Die Grundtriage ist lokal regelbasiert,
ohne KI-Anbieter oder CRM-Voraussetzung; unklare Eingänge bleiben im Fokus.

Inbox-Dialoge werden mit dem gemeinsamen Modal über ein Portal am Dokumentkörper geöffnet, damit sie auch bei mobil ausgeblendetem Detailbereich sichtbar bleiben.

KI & Modelle verwendet kompakte SettingRow-Gruppen: vorhandene Programme zuerst, Kataloge und Aktualisierungen anfangs geschlossen über native details/summary (ai-disclosure). Programm-Chevrons öffnen Aktionen und Details. Lokale Laufzeiten zeigen Anzahl statt einer dauerhaft ausgeklappten Modellliste. Status trennt Installation, gespeicherte Einrichtung und Live-Verbindung. Vertrag: surfaces/settings.md.

### Companion am Composer (12.09.2026)

Im Chat steht die Figur ausschließlich links auf der Composerkante. Auch bei
Anhängen, Uploads und Rückfragen reserviert die Optionszeile die Bühnenhöhe
(75 px, schmal 60 px); Modellwahl und Anhangaktionen bleiben frei.
Der Start und sein Ladeplatzhalter zeigen nur den vergrößerten Begrüßungstext.
Der Seitenleistenkopf zeigt nur den Namen in font-ui; Verbindung und Status
bleiben im zugänglich beschrifteten Agentenmenü erreichbar.
Ruhe, kurze Spiel-, Snack- und Tanzpausen wechseln auch im leeren Chat.
Nach fünf Minuten nickt die Figur ein, nach zehn schläft sie; Eingaben wecken
sie sofort. Senden zeigt Denken; laufende Tätigkeiten haben Vorrang vor
Leerlauf. Rückfragen zeigen Rufen, nach einer Minute Warten. Erfolgreicher
Abschluss, Fehler und Verbindungsverlust behalten ihre eigenen Zustände.
Unsichtbare Figuren pausieren; Still und reduzierte Bewegung bleiben wirksam.
Die Startreferenz verwendet denselben Companion samt Anhangumschalter.
Keine Datenmigration oder Änderung gespeicherter Bewegungseinstellungen.

Avatar bleibt bei unveränderten Eigenschaften memoisiert: Der Sekundentakt des
Companion darf die SVG-Ebenen nicht neu einsetzen und ihre Animationen nicht
jede Sekunde zurücksetzen. Zustands- und Profilwechsel aktualisieren weiterhin.

### Saubere Gesichtsebenen und ruhige Gesten

Die Grundfläche der sechs Gesichter ist durchgehend gefüllt. Nur das offene
oder geschlossene Augenpaar bewegt sich; feste Löcher und mitanimierte
Füllrechtecke dürfen keine Augenspuren hinterlassen. Geschlossene Augen
bleiben getrennt und verwenden bei allen Motiven dieselbe Ausschnittfarbe.
Die SVG-Ebenen bleiben auch bei Zustandswechseln bestehen.

Ruhe zeigt Atmen und Blinzeln ohne dauerndes Drehen oder Hüpfen. Sechs weitere
kurze Gesten ergänzen den Leerlauf: tief atmen, hocken, strecken, Gewicht
verlagern, umschauen und zunicken. Jede dauert acht Sekunden über die gemeinsame
Rolle motion-avatar-idle-duration und kehrt zum Stand zurück; die Fußlinie
bleibt fest. Die Gesten wechseln mit Ruhe innerhalb von drei Minuten.
Arbeit, Rückfrage, Fehler und Abschluss haben weiterhin Vorrang; Einnicken
und Schlafen folgen erst längerer Inaktivität. Still und reduzierte Bewegung
bleiben wirksam. Unser Design bietet einen lokalen Zustandswähler mit allen
sechs Produktionsfiguren, einschließlich Arbeits- und Augenzuständen.
Keine Datenmigration oder Änderung gespeicherter Bewegungspräferenzen.

Die Buchseite der Figuren heißt avatar-book-page. Allgemeine Layoutklassen
wie page dürfen nicht auf SVG-Requisiten wirken und deren Geometrie verändern.


Asynchrone native Rückfragen verwenden ebenfalls ComposerQuestion. Der Status
„Deine Antwort ist noch offen“ unterscheidet sie von einem wartenden Aufruf.
Auswahl, Freitext, Navigation und Fehlerzustände folgen unverändert den
Composertokens. Dauer und Zustellung führt surfaces/chat.md unter Native Rückfragen.
