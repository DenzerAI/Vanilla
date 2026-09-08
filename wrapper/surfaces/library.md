# Bibliothek

Modus: Operate. Die bestehende Designsprache aus ../DESIGN.md ist verbindlich.

## Wissen und Notizen

Unter dem gemeinsamen Seitentitel schalten zwei Schaltflächen zwischen „Dateien“
und „Wissen und Notizen“ um. Die Wissensansicht verwendet dasselbe Suchfeld,
denselben Arbeitsbereichsfilter und dieselben Ergebniszeilen. Sie durchsucht
lokale Markdown-/Textdateien über Volltext, ähnliche Schreibweisen und ein
ausdrücklich lokal installiertes Embedding-Modell. Ohne Modell bleiben
Volltext und Fuzzy-Suche verfügbar; es gibt keinen Cloud-Fallback.

„Notiz erstellen“ und das Öffnen einer Fundstelle verwenden den bestehenden
breiten Modal. Die Notiz bleibt eine einfache Datei in notes/, brain/, input/
oder output/. Speichern prüft die geladene Dateiversion. Konflikte erhalten den
Entwurf. Verlinkungen mit [[Name]], [[Name|Text]] und relativen Markdown-Links
erscheinen mit Rückverweisen unter dem Text. Mehrdeutige und fehlende Ziele
werden angezeigt, nicht geraten. Ein Projektwechsel begrenzt die Suche auf
den gewählten Bereich; der Kontext-Router eines Workers verwendet dessen
Projektzuordnung. Ein neues Navigationshauptziel entsteht dadurch nicht.

Die Bibliothek ist der einzige neue Navigationsbereich dieser Erweiterung. Reihenfolge: PageHeading → Suche und FilterPicker für Dateityp/Arbeitsbereich → Trefferstatus, Aktualisieren und Bild erstellen → Ergebnisliste. Der Dateitypfilter enthält auch „Favoriten“. Suche und Filter folgen dem gemeinsamen Umbruchmuster aus [README.md](README.md). Die Liste verwendet integration-grid/integration-item mit Dateisymbol, Dateiname, Herkunft und Chevron. Keine neue Galerie- oder Kartensprache.

Ein Ergebnis öffnet den vorhandenen breiten Modal mit schreibgeschützter FileContent-Vorschau, Herkunft/Pfad, Favorit, Download und „Im Chat verwenden“. Letzteres kopiert die Datei in input/ des gewählten Arbeitsbereichs und hängt sie einem Chatentwurf an. Fehlende Dateien sind erkennbar, Vorschaufehler können erneut geladen werden. Öffnen des Quellchats wird nur für normale sichtbare Chats angeboten.

Ergebnisse aus Chats, Kanalaufträgen, Jobs, Projekt-output/ und dem bestehenden Order-Artefaktordner teilen denselben Index. Die Bibliothek dupliziert Dateien erst bei ausdrücklicher Wiederverwendung. Favoriten und Quellen bleiben erhalten. Neue Ergebnisse aktualisieren die Ansicht über das bestehende Ereignissystem.

„Bild erstellen“ öffnet einen Dialog mit vorhandenen OpenAI-Bildverbindungen, Arbeitsbereich und Beschreibung. Ohne Zugang erscheint ein konkreter Einrichtungshinweis. Native Bildwerkzeuge eines Workers bleiben bei ihm. Lade-, Fehler- und Leerzustände verwenden die vorhandenen Muster; keine neue globale Toolleiste.
