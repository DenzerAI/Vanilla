# Aufbauverträge der Oberflächen

Diese Dateien sind verbindliche Bauanleitungen, keine Ideensammlung. Vor einer Erweiterung ist der passende Vertrag zu lesen. Jeder Bereich definiert die Reihenfolge, seine Elemente, den Weg zum Hinzufügen und Grenzen. Die tatsächliche gemeinsame Designsprache steht in `../DESIGN.md` und `../ui/design-system.mjs`.

| Bereich | Vertrag | Implementierung |
| --- | --- | --- |
| Chat / Projekte | [chat.md](chat.md) | app.jsx, chat-controls.jsx, dictation.jsx |
| Aufträge | [jobs.md](jobs.md) | app.jsx / JobForm |
| Verbindungen | [connections.md](connections.md) | app.jsx, connection-catalog.mjs, service-connection.jsx, service-catalog.mjs, brand-icon.jsx |
| Bibliothek | [library.md](library.md) | library.jsx, file-content.jsx, filter-picker.jsx |
| Skills | [skills.md](skills.md) | app.jsx, skill-details.jsx, filter-picker.jsx, skill-art.mjs |
| Module (entfallen) | [modules.md](modules.md) | Keine eigene Oberfläche |
| Einstellungen | [settings.md](settings.md) | app.jsx, voice-settings.jsx, local-workers.jsx |

## Gemeinsamer Seitenkopf

Aufträge, Verbindungen, Skills, Bibliothek und Einstellungen verwenden `PageHeading`: genau ein Seitentitel im Inhaltsbereich, daneben die unmittelbar zugehörigen Kopfaktionen. Keine zweite globale Titel- oder Tabzeile darüber. „Erstellen“ steht bei Aufträge; „Skill hinzufügen“ als Plus und „Skills neu laden“ stehen bei Skills. Verbindungen nutzt ausschließlich die vorhandenen Plus-Aktionen im Dienstekatalog. Die Bibliotheksaktionen stehen bei ihrem Ergebnisstatus unter den Filtern. Bei ausgeblendeter Seitenleiste steht ihr Öffnen-Button am Seitentitel; im Chat bei den Chataktionen. Die Navigation bleibt auch bei schmalen Fenstern erreichbar.

## Gemeinsame Suche und Filter

Skills und Bibliothek teilen Suchfeld und `FilterPicker` mit gleicher Höhe und Typografie. Die Suche bleibt flexibel; reicht die verfügbare Inhaltsbreite nicht für beide Filter, bricht die Zeile um. Bis 900 CSS-Pixel Fensterbreite stehen Suche und Filter untereinander in voller Breite. Auch eine breite Seitenleiste darf das Suchfeld nicht zusammendrücken. Die gemeinsamen Regeln liegen in `ui/styles.css` und `ui/library-connections.css`.

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

`SystemNotice` ist der gemeinsame flache Hinweis am unteren Fensterrand. Änderungen am ausgelieferten UI-Build bieten „Neu laden“ an; geänderter Servercode bietet vorrangig „Neu starten …“ an. Kein automatisches Neuladen oder Neustarten. Nach einem Neustart bleibt das Neuladen ausdrücklich wählbar, damit Entwürfe nicht unerwartet verloren gehen. Routine-Speicherbestätigungen entfallen; tatsächliche Fehler bleiben erreichbar.

Bei einer fehlenden oder abgelaufenen Anmeldung hat „Bitte erneut anmelden“ Vorrang
vor veralteten Neustarthinweisen. „Anmelden“ öffnet das gemeinsame Modal für den
bestehenden Zugangscode. Die Anmeldung verbindet den gemeinsamen Ereignisstream
neu; Chats, Entwürfe und Aufnahmen bleiben ohne Neuladen in der Oberfläche erhalten.
Fehlgeschlagene Aktionen werden nach der Anmeldung nicht automatisch wiederholt.

Der Neustart prüft alle laufenden Turns, Übergaben und Sprachsessions serverseitig. Bei laufender Arbeit folgt „Laufende Session beenden?“ mit Abbrechen und „Beenden und neu starten“. Die einmalige Bestätigung gilt nur für die zuvor geprüften Sessions; neu hinzugekommene Arbeit verlangt eine erneute Abfrage. Während des Neustarts werden neue Turns abgewiesen. Neuladen fragt zusätzlich bei laufenden Antworten, Sprache und Entwürfen nach; Serverantworten laufen dabei weiter. Die Darstellung verwendet zentrale Tokens in Hell/Dunkel, ohne Schatten oder Glas, mit zugänglichen Buttons und dem gemeinsamen Modal.
