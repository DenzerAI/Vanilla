# AGENT · CI 1.0

Die Oberfläche ist eine ruhige lokale Arbeitszentrale. Sie verbindet die Klarheit einer Entwickleroberfläche mit warmen neutralen Flächen und macOS-typischer Navigation, gruppierten Einstellungen und zurückhaltenden Bedienelementen. Die Assistentenidentität beginnt als „Agent“ mit dem einfarbigen Bot-Avatar Nori. Sechs eigene SVG-Bots sind unter „Dein Agent“ auswählbar und passen sich dem Erscheinungsbild an. Der Anzeigename wird zentral in soul/IDENTITY.md konfiguriert. Die bestehende Informationsarchitektur, Icons und Funktionen bleiben erhalten.

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

Inter ist die gemeinsame Schrift für Oberfläche, Nutzernachrichten und Überschriften. Agentenantworten verwenden die vorhandene System-Serifenschrift (Charter, Sitka Text oder Georgia); Statusmeldungen bleiben in Inter. IBM Plex Mono wird für Code, Tastenkürzel und technische Werte eingesetzt. Keine dekorative Monospace-Schrift in Navigation oder Überschriften. Inter wird einschließlich echtem Kursivschnitt lokal ausgeliefert, Plex Mono im regulären Schnitt; Browser dürfen in bestehenden Codeauszeichnungen Gewicht/Kursiv synthetisch darstellen.

Die verbindlichen Größen, Gewichte, Zeilenhöhen und Verwendungszwecke stehen in `typography` der zentralen Quelle und werden in Aussehen als Schriftproben angezeigt. Die Basis für rem beträgt 16 px. Die Skala reicht von 12 px für Zusatzinformationen bis 28 px für Seitentitel; 48 px sind für die bestehende Sprachansicht reserviert. Standardbedienelemente verwenden 14 px, längere Inhalte 16 px. Komponenten können für ihren Inhalt einen passenden Zeilenabstand aus `leading` wählen. Schriftgrößen sind in rem definiert und unterstützen Browserzoom.

## Abstände, Flächen und Farben

Ein 4-px-Raster organisiert die Oberfläche; 2 px sind optischen Details vorbehalten. Enge Gruppen verwenden 8 px, normale Innenabstände 16 px, Gruppentrennungen 24–32 px und große Seitenränder 48–64 px. Die Detailsansicht zeigt alle definierten Abstufungen und Rundungen aus der Quelle.

Warme neutrale Flächen und ein zurückhaltender Orange-Akzent bestimmen die Identität. Blau bezeichnet Links und Tastaturfokus. Erfolg, Hinweis und Fehler besitzen eigene Farbrollen mit passenden Hintergründen. Beide Erscheinungsbilder implementieren dieselben Rollen. Einstellungen sind flach gruppiert; Schatten dienen schwebenden Bedienelementen. Farbwerte, Schatten und die Rundungen wiederkehrender Komponenten kommen aus der gemeinsamen Quelle.

Textfarben müssen mindestens 4,5:1 Kontrast zu ihren vorgesehenen Flächen erreichen. Status benötigt zusätzlich Text. Tastaturfokus muss sichtbar sein. Die CI-Referenz bleibt schreibgeschützt und ist unter „Design im Detail“ aufklappbar. Nutzereinstellungen umfassen Hell/Dunkel, Inter/Systemschrift, drei Schriftgrößen und reduzierte Bewegung. `ui/appearance.mjs` definiert die erlaubten Optionen für Oberfläche und Server gemeinsam. Schriftgrößen skalieren die Rollen aus `typography`, ohne eine zweite Größentabelle. Projektsymbole werden als stabile Schlüssel gespeichert. Chatlisten zeigen fünf aktuelle Gespräche plus angepinnte Chats; alle Texte einschließlich „Neuer Chat“ und „Mehr anzeigen“ teilen dieselbe linke Kante. Statussymbole stehen rechts: rotierender Ring während der Arbeit, grüner Haken bei erfolgreichem Abschluss, eigene Symbole für Fehler und Unterbrechung. Die Farbe `chat-complete` ist zentral und für beide Themes definiert.

## Schriften und Lizenznachweise

Die Font-Dateien und vollständigen SIL-OFL-1.1-Lizenztexte liegen unter `ui/assets/fonts/`. Originalquellen und SHA-256-Prüfsummen stehen in `sources.json`. Die Originalschriften werden unverändert ausgeliefert. Inter stammt aus Release v4.1; die genaue IBM-Plex-Revision ist im Quellenverzeichnis festgehalten. Die Schriftlizenzen sind direkt in der Aussehen-Ansicht aufklappbar. Fonts werden ausschließlich vom lokalen Server geladen; keine Abhängigkeit von einem externen Font-CDN. Die bestehende Content Security Policy bleibt erhalten.

## Prüfung dieser Einführung

Produktionsbuild, automatisierte Farbkontraste in beiden Paletten, Synchronität zwischen Designquelle und generiertem CSS, Auflösung sämtlicher verwendeter CSS-Variablen sowie WOFF2-Header und beiliegende Lizenzen werden geprüft. Browserkontrollen decken die CI-Ansicht in Hell/Dunkel bei 1440, 390 und 320 CSS-Pixeln, Font-Laden, Theme-Wechsel, Aufklappen und Überlauf ab. Ein vollständiger VoiceOver-Audit ist damit nicht verbunden.

Der Impeccable-Scan meldet Inter als verbreitete Schrift sowie die bestehende Zitatlinie im Markdown. Inter ist hier bewusst wegen der gewünschten klaren, macOS-nahen Arbeitsoberfläche gewählt. Die Zitatlinie bezeichnet ein Zitat, keine dekorative Karte.

## Chat und Personalisierung

Eine schmale Eingabenavigation mit Vorschau springt zu Nutzernachrichten. Uhrzeit und Nachrichtenaktionen bleiben außerhalb der Bubble; Löschen liegt im Mehr-Menü. Bildanhänge stehen als Vorschauen über dem Text. Der Sprung zur neuesten Nachricht erscheint beim Lesen älterer Inhalte. Der Markenakzent ist ein gedecktes Terrakotta und wird sparsam für bewusste Auswahlzustände eingesetzt. Ein-/Aus-Einstellungen und Zeitpläne verwenden denselben Schalter. „Dein Agent“ zeigt das Profilbild, bearbeitet Name und persönliche Arbeitswünsche direkt und bietet sechs Avatare im gemeinsamen Auswahlfenster an; letztere werden in einem abgegrenzten Abschnitt der vorhandenen Identitätsdatei gespeichert. Ein Versionsvergleich verhindert das Überschreiben zwischenzeitlicher Dateiänderungen beim Speichern.

## Mehrfachansicht und Chat-Kopf

Die Einzelansicht ist der Standard. Oben rechts steht links vom Workspace-Icon die Chat-Ansicht mit 1–4 Panels. Die Auswahl „1 Chat“ behält das zuletzt aktive Panel. Panels haben unabhängige Eingaben, Anhänge, Modelle, Verläufe und Scrollpositionen. Ausgeblendete Panels bleiben während der Sitzung gemountet; auch ein Wechsel zu Einstellungen entfernt sie nicht. Alle Panels teilen einen Eventstream. Die verfügbare Breite des Chatbereichs entscheidet über die Spaltenzahl (400 px Mindestbreite pro Spalte); zusätzliche Panels sind über Tastatur-bedienbare Tabs erreichbar. Trennlinien lassen sich ziehen oder mit Pfeiltasten verschieben. Maximieren ist vorübergehend; Schließen entfernt nur das Panel aus der Ansicht.

Bestehende Chats und benannte Entwürfe zeigen ihren Titel mit Projektsymbol; unbenannte Entwürfe erhalten keine „Neuer Chat“-Beschriftung in der globalen Leiste. Bei mehreren Panels steht jeder Titel nur im zugehörigen Panel. Die Chatleiste besitzt keine untere Trennlinie. Der Titel öffnet ein Dropdown mit Umbenennen, Anpinnen, Teilen, Fork, Kopieren, Markdown-Export, Chatwechsel und Archivieren. Auch ein neuer Entwurf kann bereits benannt werden. Teilen bietet den Gesprächsinhalt, einen lokalen Deep Link und, falls verfügbar, die Systemfreigabe. Lokale Links werden ausdrücklich als solche bezeichnet; es gibt keinen öffentlichen Freigabedienst.

Der Verbindungsstatus steht ausschließlich als fokussierbarer Punkt beim Agenten unten links. Hover, Fokus oder Klick zeigen Serveradresse, Engine, Verbindungszustand und gemessene Server-Antwortzeit. Die Zeit misst einen lokalen HTTP-Rundweg; sie behauptet keine Modellgeschwindigkeit.

Die Seitenleiste verwendet eine gemeinsame Textkante für Navigation, Projektnamen, neue und bestehende Chats sowie „Neues Projekt“. Fertig- und Aktivitätsstatus teilen sich den rechten Platz mit den Chat-Aktionen; bei Hover, Tastaturfokus und geöffnetem Aktionsmenü wird dort nur die Aktion angezeigt. Der Online-Punkt ist vertikal zur Agent-Zeile zentriert. Die Layoutauswahl enthält ausschließlich die vier Optionen ohne Unterzeilen oder erklärenden Fußtext.

Neue Chats werden über das Plus ganz rechts am Projektordner angelegt; das Projekt-Plus erscheint an der Überschrift „Projekte“ bei Hover oder Tastaturfokus. Projektmenü und Einklapp-Pfeil erscheinen bei Hover/Fokus, auf Touch-Geräten bleiben sie erreichbar. Die separate Suchzeile, „Neuer Chat“-Zeile und „Neues Projekt“-Zeile entfallen. Cmd/Ctrl+K und Cmd/Ctrl+N bleiben erhalten. Offene Rückfragen erscheinen bei Bedarf neben dem App-Namen.

Grüne Haken bezeichnen ausschließlich ungelesene abgeschlossene Antworten. Der Server speichert die gelesene Turn-ID; eine neuere Antwort ist wieder ungelesen. Die UI bestätigt erst nach 700 ms bei sichtbarem Chat, aktivem Fenster und Leseposition am Ende. Ein veralteter Lesehinweis kann keine neuere Antwort als gelesen markieren.

## Verbindliche Bereichsverträge

Jeder Bereich hat einen verbindlichen Aufbau- und Erweiterungsvertrag unter [surfaces/README.md](surfaces/README.md). Vor UI-Änderungen ist der passende Vertrag zu lesen; [AGENTS.md](AGENTS.md) macht diesen Schritt für weitere Agenten verbindlich. Eine neue Funktion rechtfertigt keine neue Interaktionslogik. Gleichartige Elemente teilen Einstieg, Komponente, Zustände und Bearbeitungsweg.

Neue externe Dienste stehen mit Original-Markenicon und Plus unter **Verbindungen → Weitere Dienste einrichten**, werden im vorhandenen Dialog eingerichtet und danach unter **Eingerichtet** bearbeitet. Keine zusätzlichen Zugangsfelder auf Übersichtsseiten. Einstellungen konfigurieren verfügbare Funktionen, keine Anbieterzugänge. Sprache liegt gesammelt unter **Stimme**; der Chat enthält nur kompakte Sprachaktionen.

Original-Markenassets mit dunklen oder transparenten Signets erhalten bei Bedarf eine helle Trägerfläche über die gemeinsame Farbrolle `brand-asset-bg`, damit sie in beiden Erscheinungsbildern erkennbar bleiben. Größe, Rundung und Aktion folgen weiterhin der gemeinsamen Dienstekachel; die Markenfarben werden nicht verändert.

## Persönlicher Gesprächsfluss

Nutzernachrichten verwenden die 15-px-Textrolle, Agentenantworten die 16-px-Leserolle mit System-Serif. Die Uhrzeit steht jeweils unter der eigenen Nachricht: Nutzer rechts, Agent links neben dem ausgewählten Bot-Avatar. Erfolgreiche Antworten erhalten keine zusätzliche Abschlusszeile. Fehler, Unterbrechungen und laufende Arbeit bleiben ausdrücklich sichtbar. Nachrichtenaktionen erscheinen auf Geräten mit präzisem Hover bei Hover oder Tastaturfokus; auf Touch bleiben sie erreichbar. Die Eingabe beginnt mit einer kompakten Schreibzeile und wächst mit dem Entwurf. Arbeitsmodus und Modell stehen zurückhaltend darunter.

Der serverseitige Gesprächsstandard gilt bei jedem neuen Turn auch in bestehenden Chats: normalerweise ein bis drei kurze Sätze, gelegentlich ein passendes Emoji und höchstens zwei. Ausführlichkeit folgt dem Nutzerwunsch oder der notwendigen Vollständigkeit; die tatsächliche Arbeit wird dadurch nicht verkürzt.

## Composer und Dateiergebnisse

Die Schreibzeile ist eine Pille mit der zentralen großen Rundung. Ein Mikrofon diktiert in den Entwurf; separate Voice-/Vorlese-Icons entfallen im Composer. Arbeitsmodus und Modellwahl stehen direkt nebeneinander links auf einer gemeinsamen horizontalen Linie außerhalb der gefüllten Schreibfläche darunter. Einheitliche 32-px-Bedienelemente, 13-px-Schriftrolle und Chevrons verbinden beide Auswahlen. Der Denkaufwand folgt dem Modell mit einem zurückhaltenden Mittelpunkt. Workername und Computer-Use-Einstieg entfallen dort; Hinweise auf eine Vertretung stehen bei Bedarf innerhalb der Modellwahl. Anhänge stehen oberhalb. Diffs behalten Plus/Minus und nutzen Erfolgs-/Fehlerfarben für hinzugefügte/entfernte Zeilen. Explizite lokale Ergebnisse sind klickbare Dateizeilen mit Vorschau und Download. Der Vertrag unter surfaces/chat.md beschreibt Ladegrenzen, Fehlerzustände und die Engine-Kompatibilität.


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
