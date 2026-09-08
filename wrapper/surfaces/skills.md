# Skills


Der gemeinsame `PageHeading` zeigt „Skills“, das Plus „Skill hinzufügen“ und die Aktion „Skills neu laden“ in einer Zeile. Das Plus erscheint, wenn der Server die Skillbibliothek anbietet. Eine zusätzliche globale Titel-/Tabzeile entfällt.

## Fester Aufbau

Titel → Suchfeld, Herkunfts- und Kategoriefilter → Trefferstatus → nach Kategorien gruppierte Skill-Liste. Suche und Filter folgen dem gemeinsamen Umbruchmuster aus [README.md](README.md). Jeder Eintrag verwendet `SkillIcon`, vorhandenen Namen, Kurzbeschreibung, Herkunft und die vorhandene Detailaktion. Kein zweites Icon-/Kartensystem pro Quelle. Leere oder fehlgeschlagene Ergebnisse im bestehenden Listenbereich anzeigen.

## Ergänzen

Skills stammen aus dem tatsächlichen Skillkatalog; keine hardcodierten Einträge erfinden, die nicht verfügbar sind. Neue Quellen/Einträge durch denselben Lade-, Such-, Kategorie- und Detailweg führen. Wenn ein Installationsablauf ergänzt wird, ein gemeinsamer Hinzufügen-Einstieg und ein gemeinsamer Detail-/Installationsdialog; keine Installationstexte oder Schlüsselblöcke zwischen Titel und Suche.

## Grenzen

Zugänge eines Skills gehören unter **Verbindungen**; dessen allgemeine Präferenzen gegebenenfalls in Einstellungen. Installation und Nutzbarkeit sind getrennte Zustände. Bestehende Beschreibungen nicht als tatsächliche Ausführungsgarantie darstellen.

Die Landkarte der Firmenbasis ist eine gemeinsame Quelle unabhängig vom Worker.
Native Worker-Skills ergänzen dieselbe Liste, wenn der gewählte Anschluss sie
auflisten kann. Ein ausgefallener Worker verdeckt die gemeinsame Basis nicht.

## Herkunft und lokale Ergänzungen

Die vorhandene Liste ergänzt eine kurze Quellenzeile und denselben FilterPicker für die Herkunft. Quellen: Firmenbasis, eigene Workspace-/Projekt-Skills, Codex einschließlich nativ gemeldeter Plugins, Claude Code, gemeinsame lokale Skills und Hermes. „Installiert“ bestätigt die gefundene Quelle und garantiert keine providerübergreifende Ausführbarkeit.

Der Plus-Button im PageHeading öffnet den gemeinsamen Hinzufügen-Dialog: lokale optionale Hermes-Skills suchen oder einen eigenen Skill erstellen. Details zeigen Pfad, Herkunft und aufklappbare Anweisung. Eine eigene Variante kopiert Referenzdateien und Herkunftsbeleg in Workspace/skills; Originalinstallationen werden nicht geändert. „Im Chat verwenden“ stellt einen Entwurf mit der genauen Skill-Datei bereit. Kein automatisches Ausführen oder Laden sämtlicher Skill-Inhalte in den Kontext.
