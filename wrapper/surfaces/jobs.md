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

„Auftrag erstellen“ öffnet das gemeinsame `Modal` mit `JobForm`. Bearbeiten verwendet dasselbe Formular mit geladenen Werten. Pflichtangaben und passende Worker-/Verbindungswahl, danach Speichern. Fehler lassen den Entwurf offen. Zeitplan-Ein/Aus nutzt `apple-switch`; manuelles Ausführen nutzt die bestehende Aktion. Status muss aus dem tatsächlichen Lauf kommen.

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

Python-Aufträge verwenden das vorhandene Formular: lokaler Skriptpfad, JSON-Eingabe, Zeitlimit und ausdrücklich idempotente Wiederholungen. Intervall- und Ereignispläne ergänzen täglich/werktäglich. Systemaufträge erscheinen in derselben Liste; Bearbeiten führt zu ihren Systemeinstellungen. Laufdetails lesen den echten SQLite-Lauf einschließlich Ergebnis, Fehler, Protokoll und Abbruch.
