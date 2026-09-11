# Aufträge


Der gemeinsame `PageHeading` zeigt „Aufträge“ und „Erstellen“ in einer Zeile. Eine zusätzliche globale Kopfleiste entfällt.

## Fester Aufbau

Titel und vorhandene Erstellen-Aktion, Suche/Filter soweit vorhanden, Liste vorhandener Aufträge. Leerer Zustand hat denselben Erstellen-Einstieg. Ein Auftrag zeigt Name, Zeitplan/Worker und den vorhandenen Status; Aktionen im bestehenden Zeilen-/Menümuster. Keine getrennten Karten oder Formularfelder nur für einen neuen Auftragstyp.

Der Filter „Vorlagen“ zeigt den deutschen Auftragskatalog in thematischen Gruppen
als vollständig klickbare `settings-navigation-row`-Zeilen in gemeinsamen Gruppen. Icon, mehrzeiliger Text und Chevron liegen innerhalb der Gruppenfläche; keine Pillen um den Text. Suche und `FilterPicker` grenzen die Vorlagen ein.
Eine Auswahl öffnet dasselbe `JobForm` als neuen, vorausgefüllten Entwurf.
„Erstellen“ bietet dieselben Vorlagen gruppiert im Formular an. Eine andere
Auswahl ersetzt Eingaben erst über „Vorlage in Entwurf übernehmen“; bestehende
Aufträge zeigen keine Aktion zum Ersetzen durch eine Vorlage. Quelle,
benötigte Angaben und nicht unterstützte Zeitpläne werden vor dem Speichern
genannt. Vorlagen werden pausiert gespeichert; Aktivierung ist ausdrücklich
wählbar. Wochen- und Intervallpläne werden zunächst als manuell übernommen.
Katalog und deutsche Adaptionen liegen in `job-templates.mjs`, Herkunft und
Lizenz in `job-templates-sources.md`. Der Katalog aktiviert keine Hermes-Jobs.

## Hinzufügen und Bearbeiten

„Auftrag erstellen“ öffnet rechts den Detailbereich mit `JobForm`. Bearbeiten verwendet denselben Bereich mit geladenen Werten. Unter 1100 px ersetzt der Detailbereich die Liste; Schließen führt zur Liste zurück. Einstiege außerhalb der Auftragsseite verwenden weiterhin das gemeinsame Modal. Pflichtangaben und passende Worker-/Verbindungswahl, danach Speichern. Fehler lassen den Entwurf offen. Zeitplan-Ein/Aus nutzt `apple-switch`; manuelles Ausführen nutzt die bestehende Aktion. Status muss aus dem tatsächlichen Lauf kommen.

## Erweiterungen

Neue Worker oder Auftragstypen als Auswahl im bestehenden Formular ergänzen. Externe Zugänge werden über **Verbindungen** eingerichtet und nur referenziert. Generelle Worker-Einstellungen gehören unter **Einstellungen → Worker**. Ein neuer Typ bekommt keine zweite „Hinzufügen“-Logik. Laufdetails und Ergebnisse bleiben beim Auftrag.

„Automatisch“ nutzt den Standard und die eingerichtete Vertretung. Eine feste
Worker-Auswahl ist verbindlich. Der Katalog liefert alle Worker; nicht
verbundene Einträge bleiben sichtbar und deaktiviert. Ältere Aufträge behalten
ihre Zuordnung. Laufbelege enthalten den tatsächlich verwendeten Worker.

Der Python-Kern speichert manuelle und geplante Ausführungen in SQLite.
„Jetzt ausführen“ bestätigt zunächst die Warteschlange. Die Liste zeigt danach
den tatsächlichen Status: wartend, Übergabe, laufend oder abgeschlossen/fehlgeschlagen.
Ein Serverneustart unterbricht bereits übergebene Läufe sichtbar; externe
Aktionen werden nicht automatisch wiederholt. Noch wartende Aufträge bleiben
erhalten. Zeitpläne verwenden die konfigurierte Zeitzone und holen höchstens
den heutigen verpassten Termin nach.

Python-Aufträge verwenden das vorhandene Formular: lokaler Skriptpfad, JSON-Eingabe, Zeitlimit und ausdrücklich idempotente Wiederholungen. Intervall- und Ereignispläne ergänzen täglich/werktäglich. Systemaufträge erscheinen ausschließlich im Reiter System; ihre Details beschreiben die echte Funktion und verlinken die vorhandenen Systemeinstellungen. Laufdetails lesen den echten SQLite-Lauf einschließlich Ergebnis, Fehler, Protokoll und Abbruch.

## Laden der Liste

Beim ersten Abruf zeigt der Listenbereich gemeinsame List-Skeletons.
„Dein erster Auftrag“ erscheint erst nach erfolgreichem leerem Ergebnis.
Fehler bieten „Erneut laden“; vorhandene Aufträge bleiben beim Nachladen
sichtbar. Der lokale Vorlagenkatalog braucht keinen künstlichen Ladezustand.
Ausführungsdetails verwenden den gemeinsamen Settings-Skeleton.


Auftrags-Skeletons verwenden job-row und job-info, mit kleinem Statussymbol sowie Aktions- und Schalterplätzen an den originalen Kanten.

## Routinen aus dem Chat und Benachrichtigungen

Ein ausdrücklicher Auftrag im Agentenchat erstellt über `routine_capabilities`,
`routine_list`, `routine_create` und `routine_update` einen normalen Job. Kein
zusätzlicher Cron-Dienst und keine Schlüsselworterkennung im Chat. Der Worker
prüft Quellen und Werkzeuge, formuliert eine eigenständig ausführbare Aufgabe
und bestätigt nur den gespeicherten Termin samt Zeitzone und Zustellweg.
Einmalige Termine, täglich, werktags, ausgewählte Wochentage und Intervalle
verwenden denselben Kernzeitplaner. Neue Routinen starten ab ihrer Einrichtung,
ein bereits verstrichener heutiger Termin wird nicht sofort ausgelöst.

`JobForm` bietet dieselben Wochen-/Einmalpläne und die Benachrichtigungsauswahl.
Fehlgeschlagene und ungültige Aufträge zeigen „Braucht Aufmerksamkeit“ in der Zeile. Kategorien und eine Heute-Seite
sind für diesen Ablauf nicht erforderlich. PageHeading, Field, Modal,
SettingsNavigationRow, IconButton und bestehende Schrift-/Abstandsrollen bleiben
unverändert. Keine zweite Komponenten- oder Tokenpalette.

Die Glocke in der Seitenleiste und im Auftragskopf öffnet dasselbe Modal
„Benachrichtigungen“. Sie kennzeichnet ungelesene Ergebnisse und bestehende
Rückfragen. `NotificationRow` verwendet die vorhandene vollständig klickbare
Einstellungszeile, mit Titel, Datum und Neu/Gelesen; ein Beispiel steht unter
Unser Design. Öffnen markiert genau diesen Eintrag gelesen. Die Detailansicht
zeigt Ergebnistext und tatsächlichen Versandstatus; Ausführung und zugehöriger
Agentenchat bleiben direkt erreichbar. Rückfragen öffnen den bestehenden
Freigabedialog. Laden, leer, Fehler, Nachladen älterer Meldungen und Wiederholen
sind eigenständige Zustände. Lesestatus bleibt über Neustarts und Geräte erhalten.

Im selben Modal wird einmal der Standard für neue Routinen gewählt. Pro Job
kann er überschrieben werden: App oder ein vorhandenes, freigegebenes und
bereites Telegram-/WhatsApp-Ziel; immer oder nur bei Problemen. Externe Konten
werden weiterhin unter Verbindungen eingerichtet. Eine fehlende Verbindung
verhindert die Aktivierung mit diesem Ziel, niemals das Pausieren einer Routine.
App-Ergebnisse bleiben unabhängig vom externen Versand erhalten.

Browserhinweise werden ausschließlich nach der Aktion „Gerätehinweise erlauben“
angefordert. Sie setzen eine geöffnete App und Browserunterstützung voraus;
das ist kein Web-Push bei geschlossener App. Telegram kann ohne geöffneten
Browser zustellen. WhatsApp benötigt die aktive lokale Bridge und eine bekannte
freigegebene Conversation. WhatsApp Business und Mail werden nicht als
proaktive Versandziele angeboten. Empfang/Verbindungen starten nicht automatisch.
Der Host muss wach und der Kern aktiv sein. Reale Geräte-/Anbieterzustellung
wird separat von simulierten Funktionstests geprüft.

Wochentage verwenden die bestehende row mit Umbruch, damit auf Handybreite alle sieben Tage erreichbar bleiben.


## Iconaktionen

NotificationBell bewegt die erste sichtbare Glocke kurz bei einem neuen notification.created-Ereignis oder einer neuen Rückfrage. Gelesen-Markierungen und wiederholtes Laden lösen keine Bewegung aus. Der Ungelesen-Punkt und die zugängliche Beschriftung bleiben unabhängig von Animation verständlich.

## Status und Detailbereich

Die Reiter heißen Alle, Aktiv, Pausiert, Abgeschlossen, System und Vorlagen.
Alle umfasst Nutzeraufträge; System bündelt ausschließlich verwaltete Wartung.
Ein erfolgreicher wiederkehrender Lauf bleibt aktiv; Abgeschlossen bezeichnet
einmalige oder manuelle erledigte Aufträge. Letzter Lauf und Zeitplanstatus
werden getrennt benannt. Fehler bleiben in Alle sichtbar.

Die Auswahl öffnet rechts JobForm mit Aufgabe, Workspace, Anbieter, Modell,
Reasoning, Zeitplan und Benachrichtigung. Die Auswahl stammt aus dem vorhandenen
Anbieterkatalog; Automatisch verwendet den Anbieterstandard. Eine feste Modellwahl
bleibt an den festen Anbieter gebunden und wird beim Ausführen erneut validiert.
Jeder Lauf erhält den bestehenden eigenen Chat im gewählten Workspace und den
Auftragsordner mit input, output und runs. Keine automatisch erzeugten Projekte.
Systemaufträge verwenden keine KI-Modellwahl. Backup-Aktivierung prüft zuerst
das erreichbare Archiv mit seinem vorhandenen Schlüssel.

PageHeading, Field, IconButton, CoreRunDetails, apple-switch und tabs bleiben
die gemeinsamen Bausteine. jobs.css beschreibt ausschließlich den responsiven
Liste-/Detailaufbau mit vorhandenen Tokens. Der Suchindex läuft bereits alle
30 Sekunden im Kern; sein manueller Eintrag startet keinen zweiten Zeitplaner.

Uhrzeiten bleiben beim YAML-Austausch zwischen Oberfläche und Kern Zeichenketten,
auch unquoted 10:30, 16:00 und 23:59. Speichern und erneutes Einlesen dürfen
keinen gültigen Tagesplan in einen ungültigen Auftrag verwandeln.
