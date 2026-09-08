# Datenschutz vor der Übergabe

Die Einstellungen verbinden lokale Vorprüfung, Auswertung und betriebliche
Dokumentation. Quellcode und Bedienelemente sind keine Datenschutzabnahme.

## Tatsächlicher Schutzumfang

`core/privacy.py` hält versionierte Regeln und ausschließlich Mengen und
Entscheidungen der Übergabeprüfungen in SQLite. `wrapper/privacy.mjs` verlangt
eine ausdrückliche Freigabe; fehlender Kern oder fehlgeschlagene Protokollierung
verhindern die Übergabe. Die Prüfstellen erfassen Worker-Turns und Nachträge,
Titelanfragen, Live-Sprache sowie angeschlossene Sprach-, Bild- und Dienstaktionen.
Neue Übergaben lassen sich pausieren; bekannte Zugangsdatenmuster werden
standardmäßig blockiert. E-Mail-/IBAN- und Anhangssperre sind zuschaltbar.

Die Oberfläche bietet die Regeln erst an, wenn der Kern das Modul über
`features.privacy` als geladen meldet. Ein UI-Update allein aktiviert keine
Vorprüfung; der reguläre Serverneustart muss laufende Arbeit berücksichtigen.

Die Regeln prüfen Text einschließlich frischem Firmenkontext und ausgewähltem
Memory. Anhänge werden gezählt, nicht inhaltlich analysiert. Unprüfbares Audio
wird bei aktiver Kontakt-/Anhangssperre abgewiesen. Dateien werden nicht verändert
oder still anonymisiert. Native Werkzeuge, bestehende Sitzungsinhalte, laufende
Worker, Python-Skripte und direkte Anbieterzugriffe bleiben außerhalb dieser
Kontrolle. Ein zugelassener Versuch ist keine bestätigte Zustellung.

## Prüfen und auswerten

Der lokale Texttest speichert nichts. Auditdaten werden nach der gewählten
Frist durch die vorhandene Speicherpflege entfernt; kürzere Fristen wirken
beim Speichern. Backups haben einen eigenen Lebenszyklus. Export enthält
Regeln, betriebliche Anmerkungen und maximal 10.000 Ereignisse mit einem
Hinweis bei Begrenzung. Prozentwerte zählen dokumentierte Prüfpunkte bzw.
blockierte Versuche, niemals Rechtssicherheit.

## Rechtsgrundlage der Prüfpunkte, Recherche 08.09.2026

Die betrieblichen Prüfpunkte umfassen Zweck, Rechtsgrundlage, Anbieterrollen,
Drittlandzugriffe, Information, Betroffenenrechte, Sicherheit und Risiken.
Eine Einzelfallprüfung bleibt erforderlich. Quellen: [DSK zum KI-Einsatz](https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf)
und [DSK zu technischen und organisatorischen Maßnahmen](https://www.datenschutzkonferenz-online.de/media/oh/DSK-OH_KI-Systeme.pdf).

Zusätzlich sind Rolle und Einsatz nach der KI-Verordnung sowie Maßnahmen zur
KI-Kompetenz zu beurteilen. Aktuelle Einordnung: [EU-Kommission zur KI-Verordnung](https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act)
und [EU-Kommission zur KI-Kompetenz](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers).
Die Anwendung prüft keine Verträge oder Nachweise automatisch.
