# Inbox

Echte, zunächst leere Mail-Inbox. Gmail und Outlook werden unter Verbindungen eingerichtet. Keine eingebauten Konten und keine Beispielnachrichten in der Produktion. API, Rechte und Grenzen führt docs/MAIL.md.

Inbox steht direkt über Aufträge. Sie verwendet die bestehende Sidebar mit Zurück, gemeinsamem PageHeading, Suche, Status- und Anbieterfilter und InboxConversationRow. Im Hauptbereich stehen Gesprächskopf, Nachrichten und Antwortentwurf. Bis 650 px wechseln Liste und Verlauf in voller Breite. Original-Markenassets, FilterPicker, Modal und gemeinsame Tokens bleiben verbindlich. Neue Konten werden ausschließlich unter Verbindungen eingerichtet.

Leerer Eingang bietet „Postfach verbinden“. Kontofehler bleiben pro Konto sichtbar, geladene Nachrichten bleiben lesbar. Lade- und Wiederholen-Zustände behaupten keinen erfolgreichen Abruf. Listen laden weitere Seiten. Suche durchsucht Absender, Betreff und Konto der geladenen Gespräche. Gelesen und Erledigt sind lokale persistente Zustände.

Nachrichten werden als Text angezeigt; keine externen Bilder. Anhänge werden erst per Aktion abgerufen. Antwortentwürfe sind pro Gespräch versioniert. Speichern, Mit Agent bearbeiten und Antwort prüfen sind separate Aktionen. Die Prüfung zeigt From/To/Betreff/Inhalt im vorhandenen Modal. Das Plus am Inbox-Titel bereitet eine neue E-Mail mit Ursprungskonto, Empfänger und Betreff vor. Erst Senden löst den Versand aus; Erfolg benennt die Annahme durch den Anbieter. Unklare Zustellung wird nicht automatisch wiederholt. „Mit Agent“ verwendet den bestehenden Chat und dessen Maschine, ohne Nachricht automatisch abzuschicken.

Prüfung: TypeScript, Build, passende Backend-/Oberflächentests und Desktop-/mobile Browseransichten, Hell/Dunkel, leere Inbox, Einrichtungsdialoge, lange Texte, Speicher- und Sendefehler. Ein echter Kontotest ist von synthetischen Tests getrennt zu benennen.
