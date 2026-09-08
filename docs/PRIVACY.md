# Datenschutz in Vanilla

Stand: 08.09.2026. Die lokalen Prüfstellen unterstützen den Betrieb; sie sind
keine vollständige Datenschutzabnahme, Anonymisierung oder Worker-Sandbox.

## Produkt und Verantwortung

Einstellungen → Datenschutz verbindet Schutzoptionen, den aktuellen Stand der
gemeinsamen Daten, lokale Texttests und eine exportierbare Auswertung. Die
Anwendung bleibt Wrapper: native Sitzungen und Werkzeuge bleiben beim Worker.
Eine verpflichtende Kontrolle sämtlicher Datenabflüsse benötigt zusätzlich
technisch begrenzte Worker und kontrollierte Werkzeug-/Netzwerkzugriffe. Ein
Prompt, ein Textfilter und Loopback-Bindung ersetzen diese Grenze nicht.

Die betriebliche Prüfung führt zwölf Punkte mit Quellen, Status und Nachweis.
„Dokumentiert“ und begründetes „Nicht einschlägig“ zählen als dokumentiert,
nicht als rechtlich erfüllt. Die Quote ist dokumentierte Punkte / zwölf.
Ohne Nachweis lässt sich ein Punkt nicht abschließen. Es gibt keine Aussage
„X Prozent DSGVO-konform“. Neue Anbieter oder Einsatzzwecke verlangen eine
erneute Prüfung; das gesetzte Datum ist der Recherchetag, kein Rechtsmonitor.

## Recherchegrundlage

- [DSK: Künstliche Intelligenz und Datenschutz, 06.05.2024](https://www.datenschutzkonferenz-online.de/media/oh/20240506_DSK_Orientierungshilfe_KI_und_Datenschutz.pdf):
  Auswahl und Einsatz prüfen; die Orientierungshilfe ist kein abschließender Katalog.
- [DSK: Anforderungen an KI-Systeme](https://www.datenschutzkonferenz-online.de/media/oh/DSK-OH_KI-Systeme.pdf):
  technische Gestaltung, Betrieb und Betroffenenrechte. Bloßes Unterdrücken von
  Ausgaben ersetzt keine vollständige Löschung.
- [DSGVO, amtliche Wiedergabe beim BMF](https://grsth.bundesfinanzministerium.de/ao/2025/Datenschutz-Grundverordnung/inhalt.html)
  und [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj): maßgebliche
  Verordnung. Der direkte EUR-Lex-Abruf war bei der Recherche durch eine
  JavaScript-Prüfung blockiert; die zugänglichen Aufsichtsquellen wurden gelesen.
- [BDSG § 26](https://www.gesetze-im-internet.de/bdsg_2018/__26.html),
  [BDSG § 38](https://www.gesetze-im-internet.de/bdsg_2018/__38.html),
  [BetrVG § 87](https://www.gesetze-im-internet.de/betrvg/__87.html):
  Beschäftigtendaten, Benennungspflicht und gegebenenfalls Mitbestimmung sind
  für den konkreten deutschen Betrieb gesondert zu prüfen. KMU sind nicht
  pauschal ausgenommen.
- [EU-Kommission: KI-Verordnung](https://digital-strategy.ec.europa.eu/en/faqs/navigating-ai-act)
  und [KI-Kompetenz](https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers):
  Rollen, Einsatz und Pflichten gesondert einordnen. Die am Recherchetag
  abgerufenen Seiten berücksichtigen Änderungen durch den AI Omnibus. Keine
  pauschale Anwendung eines alten Stichtags auf alle KI-Systeme.

Die ausführbaren Prüfpunkte in `core/privacy.py` bilden Zweck/Rechtsgrundlage,
Verträge, Drittlandzugriffe, Information, Betroffenenrechte, Sicherheit,
Risiko, Verantwortlichkeiten und KI-Einsatz ab. Sie ersetzen keine
anbieterbezogene Vertragsprüfung. Branchenrecht, Aufbewahrungspflichten,
Berufsgeheimnisse und besondere Einsatzzwecke können weitere Anforderungen
auslösen. Regeln sind nicht durch einen Schalter rechtlich abwählbar.

## Wirksame Prüfstellen

`wrapper/privacy.mjs` ruft vor Freigabe `/internal/privacy/check` auf. Ohne
erreichbaren Kern oder erfolgreich geschriebenen Auditdatensatz gibt es keine
Freigabe. Der interne Endpunkt ist über das vorhandene Adaptergeheimnis geschützt.
Direkter Standalone-Adapterbetrieb kann deshalb keine neuen Arbeiten übergeben.

| Stelle | Geprüfter Inhalt / Grenze |
| --- | --- |
| `Workers.call` vor `turn/start` und `turn/steer` | neuer Text, frische Firmenanweisungen und ausgewählter Kontext, bekannte Anhangtypen; gilt auch für Worker-Jobs |
| automatische Titelanfrage | erster Nachrichtentext vor separater nativer Anfrage |
| Realtime-Start | unprüfbarer Audiokanal; kein laufender Audio-Inhaltsfilter |
| Groq-Diktat | Audio-Anhang; kein vorgelagerter Transkriptfilter |
| ElevenLabs | vorgelesener Text |
| Webhook, Dienstaktion, Bildgenerierung | JSON-Nutzlast bzw. Prompt; Authentisierungsheader werden nicht an die Textprüfung gegeben |
| lokaler Modelltest | Textfilter und Audit; von der Übergabepause ausgenommen |

Standardeinstellung: bekannte Zugangsdatenmuster blockieren; zusätzliche
E-Mail-/IBAN-Muster und Anhänge optional blockieren. Die Pause betrifft diese
neuen KI-/Dienstübergaben. Sie beendet keine laufenden Prozesse. Bei Kontakt-
oder Anhangsperre werden unprüfbare Cloud-Audiowege abgewiesen. Der
Zugangsdatenfilter allein gilt nur für vorliegende Texte.

Ausdrücklich außerhalb der vollständigen Kontrolle: native Worker-MCPs,
Shell/Dateizugriffe, gespeicherte Sitzungshistorie, direkte Kanal-Sendewege,
Kontoprüfungen, Python-Skripte und Programme außerhalb des Wrappers. Ein durch
Textprüfung zugelassener Auftrag kann später weitere Daten lesen und senden.
Anhänge werden nicht per OCR oder Dateiextraktion auf Personenbezug untersucht.
Ein lokales Modell-Testziel ist keine Garantie für das Verhalten eines
beliebig konfigurierten Modellservers.

## Daten, Auswertung und Aufbewahrung

Validierte Datenschutzeinstellungen und Versionszähler liegen in den bestehenden
SQLite-`records` unter `privacy/settings` und `privacy/version`. Sie werden
atomar mit Konfliktprüfung gespeichert. Diese getrennte Einstellungsgruppe
überschreibt keine parallel bearbeiteten Heartbeat-/Memory-Einstellungen.
Nachweise sind lokale Nutzereingaben und können im Export enthalten sein.

`privacy_events` enthält ausschließlich Zeitpunkt, Prüfstelle, Entscheidung,
Regelversion, Zeichenzahl, Anhangzahl und Musteranzahlen. Kein Nachrichtentext,
kein Dateipfad, kein Konto- oder Chatname. Zugelassen bedeutet vorab freigegeben,
nicht erfolgreich versandt. Die zweite Quote lautet blockierte / erfasste
Versuche im gewählten Zeitraum; ohne Daten erscheint keine Prozentzahl.
Statistik und Export verwenden denselben Zeitraum. Export maximal 10.000
Ereignisse mit explizitem `truncated`-Hinweis; Gesamtzähler bleiben vollständig.

Frist 1–90 Tage, Standard 30. Speichern einer kürzeren Frist und die bestehende
tägliche Speicherpflege entfernen abgelaufene Einträge. Historische
`transfers.ndjson`, SQLite-WAL, frühere Backups und native Protokolle werden
dadurch nicht nachträglich bereinigt. Kein forensisches Löschversprechen.
Der lokale Beispieltest speichert weder Text noch Auditereignis.

## Gemeinsame Daten, Suche und Heartbeat

Wissen bleibt in vorhandenen Dateien; Suche ist derselbe lokale Index für
Oberfläche und Memory-MCP. Suchtreffer werden vor Ausgabe gegen Quelldatei,
Version, Projektpfad und Memory-Ausblendung geprüft. Veränderte Quellen liefern
bis zum nächsten Indexlauf keine alten Ausschnitte. Die vorhandene periodische
Indizierung, automatische Gesprächsaufnahme und extraktive Memory-Pflege
bleiben zuständig; kein zweiter Scheduler oder Wissensspeicher.

`GET /api/privacy/status` und das Feld `privacy` in `GET /api/system/status`
sind die Anschlussstellen für die getrennt geplante Heartbeat-Erweiterung.
Diese Abfrage erfolgt lokal ohne LLM und ohne Rechtsrecherche. Ein offener
betrieblicher Prüfpunkt ist kein Anlass für einen Dienstneustart.

## Prüfung

`core/tests/test_privacy.py` prüft Regeln, fehlertolerante Bedienung über
authentisierte APIs, atomare Versionen, Aufbewahrung, inhaltsfreie Exporte und
Suchquellen. `core/tests/test_integration.py` prüft HTTP → Kern → Node →
simulierten nativen Worker einschließlich blockierter Übergaben und Resume.
Node-Tests prüfen den Anschluss vor Adapterstart und die gemeinsame
Kontext-/Anhangserfassung. Echte Anbieter und Betriebssystemisolation werden
damit nicht abgenommen.

Der Implementierungsstand liegt im isolierten Zweig `feature/privacy-shared-data`.
Die bestehende laufende Runtime wurde nicht umgestellt. Build, TypeScript,
Designprüfung sowie die genannten Kern- und Integrationsprüfungen bestanden.
Die vollständige visuelle Abnahme ist offen. Nach Behebung eines Portkonflikts
lieferte Host-Auftrag `cu-1788856237-3edffd` einen tatsächlich betrachteten
Desktop-Screenshot (1024 × 1720 Bildpixel, CSS-Viewport nicht bestätigt):
Datenschutz in Dunkel, gespeicherte Voreinstellungen, leere Übergabezähler,
eingeklappte Prüfpunkte. Gruppen, Texte und Schalter sind sichtbar ohne erkennbare
Überlagerung. Der Browseranschluss brach die weitere Bedienung mit unbewegtem
Bildschirm ab. Hell, schmale Breite, große Schrift, Speichern/Neuladen und
Texttest im Browser bleiben offen; API-Tests ersetzen diese Interaktionen nicht.
Erst nach vollständiger visueller Abnahme darf die Übernahme erfolgen.
