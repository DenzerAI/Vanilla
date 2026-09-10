# Aufbauverträge der Oberflächen

Diese Dateien sind verbindliche Bauanleitungen, keine Ideensammlung. Vor einer Erweiterung ist der passende Vertrag zu lesen. Jeder Bereich definiert die Reihenfolge, seine Elemente, den Weg zum Hinzufügen und Grenzen. Die tatsächliche gemeinsame Designsprache steht in `../DESIGN.md` und `../ui/design-system.mjs`.

| Bereich | Vertrag | Implementierung |
| --- | --- | --- |
| Chat / Projekte | [chat.md](chat.md) | app.jsx, chat-controls.jsx, dictation.jsx |
| Heute / Kalender | [today.md](today.md) | planner.tsx, planner.css, planner-dates.mjs |
| Inbox | [inbox.md](inbox.md) | app.jsx / Inbox-Sidebar, inbox.tsx, inbox.css; Designvorschau |
| Aufträge | [jobs.md](jobs.md) | app.jsx / JobForm |
| Verbindungen | [connections.md](connections.md) | app.jsx, connection-catalog.mjs, service-connection.jsx, service-catalog.mjs, brand-icon.jsx |
| Bibliothek | [library.md](library.md) | library.jsx, file-content.jsx, filter-picker.jsx |
| Skills | [skills.md](skills.md) | app.jsx, skill-details.jsx, filter-picker.jsx, skill-art.mjs |
| Einstellungen → Service | [work-evidence.md](work-evidence.md) | work-evidence.tsx, work-evidence.mjs, work-evidence.css |
| Module (entfallen) | [modules.md](modules.md) | Keine eigene Oberfläche |
| Einstellungen | [settings.md](settings.md) | app.jsx, voice-settings.jsx, local-workers.jsx |

## Navigation

Der gemeinsame Seitenleistenkopf zeigt AgentMenu mit konfiguriertem Avatar, Namen und integriertem Verbindungspunkt. Daneben stehen Suche als IconButton, Benachrichtigungen und Einklappen. Dies gilt auch für Inbox und Einstellungen. Der bisherige Agentenfuß und der separat bedienbare Serverstatus entfallen; Details und Neustart stehen im Agentenmenü. Aufbau und Tastaturbedienung führt chat.md.

Inbox, Aufträge und die verfügbare Bibliothek bilden das Hauptmenü; Die Gruppe „Workspace“ und ihre Chats folgen darunter. Verbindungen und Skills stehen in der vorhandenen Einstellungsnavigation mit ihren bisherigen Symbolen und Katalogansichten. Globale Suche und Querverweise öffnen den jeweiligen Einstellungsbereich direkt. Keine Modul-Platzhalter, zusätzliche Navigationsebene oder neue Seitengestaltung.

## Gemeinsamer Seitenkopf

Aufträge, Verbindungen, Skills, Bibliothek und Einstellungen verwenden `PageHeading`: genau ein Seitentitel im Inhaltsbereich, daneben die unmittelbar zugehörigen Kopfaktionen. Keine zweite globale Titel- oder Tabzeile darüber. „Erstellen“ steht bei Aufträge; „Skill hinzufügen“ als Plus und „Skills neu laden“ stehen bei Skills. Verbindungen nutzt ausschließlich die vorhandenen Plus-Aktionen im Dienstekatalog. Die Bibliotheksaktionen stehen kompakt am PageHeading; der Ergebnisstatus unter den Dateien. Bei ausgeblendeter Seitenleiste steht ihr Öffnen-Button am Seitentitel; im Chat bei den Chataktionen. Die Navigation bleibt auch bei schmalen Fenstern erreichbar.

## Gemeinsame Suche und Filter

Skills und Bibliothek verwenden das gemeinsame Suchfeld und `FilterPicker`. Der kompakte Dateibrowser verwendet die zentrale control-Höhe; seine Filter dürfen neben der Suche umbrechen. Die Suche bleibt flexibel; reicht die verfügbare Inhaltsbreite nicht für beide Filter, bricht die Zeile um. Bis 900 CSS-Pixel Fensterbreite stehen Suche und Filter untereinander in voller Breite. Auch eine breite Seitenleiste darf das Suchfeld nicht zusammendrücken. Die gemeinsamen Regeln liegen in `ui/styles.css` und `ui/library-connections.css`.

## Vorgehen bei Ergänzungen

1. Zweck des neuen Elements benennen: Aktion, konfigurierbare Präferenz, Zugang, Ergebnis oder Verlauf?
2. Dem passenden bestehenden Bereich zuordnen. Gleiche Funktion bedeutet gleicher Ort und Ablauf.
3. Vorhandenes Element derselben Art als Vorlage nutzen. Keine zusätzliche Karte, Formularleiste oder Anleitung erfinden, nur weil die Implementierung separat ist.
4. Neue Einträge in den vorhandenen Katalog aufnehmen; vorhandene Gruppen, Suchfunktion, Statusdarstellung und Dialoge weiterverwenden.
5. Eine knappe Beschreibung nur dort, wo sie eine Entscheidung erklärt. Details erst auf Nachfrage oder durch Aufklappen.
6. Funktionsfähige Zustände liefern: leer, laden, verbunden/erfolgreich, Fehler, deaktiviert. Noch nicht vorhandene Fähigkeiten werden nicht als verfügbar dargestellt.
7. Den Vertrag bei einer bewusst beschlossenen Änderung aktualisieren. Die Änderung gilt danach für weitere Einträge desselben Typs.

Die Verträge schreiben keine Backend-Technik vor. Gemeinsame Frontend-Komponenten und Kataloge setzen sie in Code um; Regressionstests prüfen zentrale Zuordnungen.

## Systemhinweise

Auf schmalen Fenstern reserviert ein sichtbarer Update-/Neustarthinweis oberhalb des Agentenkopfes die Touchhöhe plus 16 px. Der Hinweis verdeckt weder Agentenbutton noch Suche oder Einklappen; ohne Hinweis entfällt der Abstand.

`SystemNotice` zeigt Updates als einzelnen schlichten Button mittig an der oberen Fensterkante. Reine UI-Builds bieten „Aktualisieren“ an und laden ausschließlich die Seite neu. Nur geänderter Laufzeitcode beziehungsweise Laufzeitabhängigkeiten bieten „Neustarten“ an. Buildskript, UI-Quellen, Paketversion und reine Entwicklungsabhängigkeiten lösen keinen Serverneustart aus; serverseitig importierte gemeinsame UI-Module zählen dagegen zum Laufzeitcode. Fehler und Anmeldehinweise behalten ihre erklärende Benachrichtigung. Kein automatisches Neuladen oder Neustarten. Nach einem Neustart bleibt das Neuladen ausdrücklich wählbar, damit Entwürfe nicht unerwartet verloren gehen. Routine-Speicherbestätigungen entfallen; tatsächliche Fehler bleiben erreichbar.

Bei einer fehlenden oder abgelaufenen Anmeldung hat „Bitte erneut anmelden“ Vorrang
vor veralteten Neustarthinweisen. „Anmelden“ öffnet das gemeinsame Modal für den
bestehenden Zugangscode. Die Anmeldung verbindet den gemeinsamen Ereignisstream
neu; Chats, Entwürfe und Aufnahmen bleiben ohne Neuladen in der Oberfläche erhalten.
Fehlgeschlagene Aktionen werden nach der Anmeldung nicht automatisch wiederholt.

Der Neustart prüft alle laufenden Turns, Übergaben und Sprachsessions serverseitig. Bei laufender Arbeit folgt „Laufende Session beenden?“ mit Abbrechen und „Beenden und neu starten“. Die einmalige Bestätigung gilt nur für die zuvor geprüften Sessions; neu hinzugekommene Arbeit verlangt eine erneute Abfrage. Während des Neustarts werden neue Turns abgewiesen. Neuladen fragt zusätzlich bei laufenden Antworten, Sprache und Entwürfen nach; Serverantworten laufen dabei weiter. Die Benachrichtigung verwendet zentrale Tokens in Hell/Dunkel. Der kompakte Update-/Neustart-Button nutzt stärker transparentes Glas mit 40-px-Blur, feiner Glaskante, leichtem Schatten und kleinem RotateCcw-SVG neben dem Aktionsnamen; deckende Ersatzfläche bei reduzierter Transparenz oder fehlendem Blur. Die Bestätigungsdialoge behalten ihre ruhige Darstellung im gemeinsamen Modal. Buttons bleiben zugänglich.

## Globale Suche

Der Einstieg in der Seitenleiste und Cmd/Ctrl+K öffnen denselben nativen Suchdialog. Er verwendet die randlose transparente gemeinsame Glasfläche mit Hintergrundunschärfe und eine zusätzlich um 8 px weichgezeichnete, über `overlay` abgedunkelte Kulisse. Das kompakte Suchfeld nutzt dieselbe dunkle Fläche auf `workspace-backdrop` ohne nativen Suchfeldrahmen. Schreibmarke und hervorgehobene Lupe zeigen Eingabefokus, Ergebniszeilen behalten sichtbaren Tastaturfokus. Nur die Trefferliste scrollt; ScrollEdgeFade mildert überlaufende Kanten über 8 px. Bei reduzierter Transparenz oder fehlender Blur-Unterstützung bleibt die Fläche deckend.

Chats erscheinen zuerst, danach Bibliotheksdateien/Artefakte, Wissen und Notizen, Aufträge, Skills, Projekte und Navigation. Leere Eingabe zeigt letzte Gespräche. Titel und lokale Gesprächsinhalte, Dateinamen/Pfade/Herkunft, indexierte Wissenstexte, Auftragsanweisungen sowie Skillnamen/-beschreibungen werden über die vorhandenen Quellen durchsucht; binäre Dateien erhalten keine erfundene Volltextsuche. Bibliotheks-, Skill- und Auftragskataloge werden pro Dialog geladen und bei Ladefehler erneut angefragt. Einzelne Ausfälle verdecken die übrigen Treffer nicht und werden benannt. Ergebnisse erscheinen bereits während weitere Quellen laden. Die Anzeige begrenzt auf 80 Datentreffer und nennt die gelieferte Trefferzahl.

Pfeiltasten navigieren, Enter öffnet, Escape schließt. Dateien, Notizen, Skills und Aufträge öffnen ihre vorhandenen Detailansichten, verwaltete Systemaufträge ihre Einstellungen. Eine Auswahl startet keinen Auftrag und führt keinen Skill aus.

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

## Gemeinsames Prüftor

Alle Bereiche unterliegen `npm --prefix wrapper run design:verify`, auch neue
Dateien, importierte Vorlagen und Demos. Fehler müssen vor Übernahme behoben
werden. Genaue Abdeckung und begründete Sonderfälle stehen ausschließlich im
[Designvertrag](../DESIGN.md#verbindliches-prüftor-vor-übernahme).

## Gemeinsame Skeletons

`ui/skeleton.tsx` liefert List-, Settings-, Chat-, Document-, Media- und
Shell-Platzhalter gemäß DESIGN.md. Nur fehlende Inhalte werden überbrückt,
vorhandene Ergebnisse bleiben während Aktualisierungen bedienbar. Die globale
Suche zeigt Listenformen bis erste Treffer eintreffen; ihre vorhandene
Statuszeile übernimmt die Ansage. App-Start zeigt auf schmalen Ansichten
nur den Inhaltsbereich; Fehler ersetzen die Platzhalter durch Wiederholen.


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

Service steht als eigener Bereich in Einstellungen; Aufbau und Vorschaugrenzen führt [work-evidence.md](work-evidence.md).

## Gemeinsame Iconrückmeldung

Für alle Bereiche gilt [die gemeinsame Iconrückmeldung](../DESIGN.md#gemeinsame-iconrückmeldung).
`MotionGlyph`, `IconButton`, `CopyButton`, `NotificationBell` und `icon-motion.tsx`
sind die Produktionsbausteine. `icon-catalog.mjs` und `icon-animation.mjs` führen
die 82 freigegebenen Formen und ihre individuellen Zeitlinien. Die Auswahl
steht unter Aussehen → Visuell, die Sammlung unter Unser Design → Icons.
Aktionsicons reagieren auf Bedienung, bestehende Chevron- und Ladebewegungen
bleiben eigenständig. Neue Ausnahmen verwenden `data-icon-motion="off"`.


Einzelicons folgen der [gemeinsamen Auswahl- und Hoverregel](../DESIGN.md#gemeinsame-iconrückmeldung). Auswahl bleibt als dünner Kreisrand
erkennbar; Hover animiert einmal, Klick bestätigt die Bedienung. Textzeilen
und native Schalter werden nicht in Iconbuttons umgeformt.


Der Standardstart ist jetzt der leere Chat mit kontextabhängiger Begrüßung und
AttentionFan. Heute entfällt im Hauptmenü; Kalender und bestehende Direktlinks
bleiben über die Suche nutzbar. Aufbau und Verhalten führt [chat.md](chat.md).


Der gemeinsame PageHeading ist aus app.jsx nach ui/page-heading.tsx ausgelagert;
Anwendung und neutraler UI-Bauplan verwenden denselben Baustein.
Bei Übernahmen in andere Installationen gilt ../../docs/UI-UPDATES.md.
