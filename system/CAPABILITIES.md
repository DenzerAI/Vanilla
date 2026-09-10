# Zentrale Funktions- und Anschlusslandkarte

Der verbindliche, automatisch geprüfte Modulvertrag ist [MODULES.md](MODULES.md),
seine Datenquelle [modules.json](modules.json). Worker entdecken Einrichtung und
Aufrufe mit `system_modules` und `system_module`. Die folgenden Oberflächenaktionen
ergänzen diese gemeinsame Grundlage. Neue oder geänderte Module unterliegen
derselben Registrierungspflicht; Live-Status wird separat gelesen.

Die maschinenlesbare Quelle ist [capabilities.mjs](capabilities.mjs). Sie führt
alle Produktbereiche, ihre führenden Kataloge und Bereichsverträge zusammen.
`node system/capabilities.mjs` liefert zusätzlich die vollständige Auflistung
der wörtlich deklarierten HTTP-Endpunkte mit Quelldatei und Zeile. Dynamisch
erzeugte Dienste und externe Worker-Werkzeuge stehen in den verlinkten Katalogen;
diese werden nicht in einer zweiten Liste dupliziert. Installation und
Verfügbarkeit werden immer über den jeweiligen Live-Status geprüft.

Neue Funktionen erhalten hier eine stabile ID, UI-Anschluss, Backend-Anschluss,
Statusquelle und führenden Vertrag. Anbietererweiterungen prüfen zuerst die
bestehenden Aktionen und Kataloge. Geheimnisse gehören in den bestehenden
Tresor, niemals in die Landkarte. Der technische Worker-Einstieg verweist auf
diese Quelle, damit alle Worker dieselben Anschlüsse finden.

## Neutraler Codeaustausch

Geplanter Ausbau: [Updates und Beiträge](../docs/UPDATES.md), Oberfläche
[Einstellungen → Updates](../wrapper/surfaces/updates.md), GitHub unter Verbindungen.
Das Konzept reserviert `updates`, `github` und `contributions`. Es beschreibt noch
keine verfügbaren APIs oder registrierten Module. Bei Implementierung hier und
in den ausführbaren Katalogen mit realen Anschlüssen, Prüfungen und Status aufnehmen.

`source-privacy` führt die lokalen Git-Prüfungen, den geschützten Merge-Befehl und
die einmalige Einrichtung der ausgeschlossenen Firmenbasis zusammen. Ablauf,
Erstübernahme und Grenzen stehen in [../docs/CODE-SYNC.md](../docs/CODE-SYNC.md).
Die Prüfungen benötigen keine Anbieter-Verbindung und verändern keine KI-Zugänge.

## Vorlesen / ElevenLabs

`chat.message.read-aloud` bezeichnet den Lautsprecher unter fertigen
Agentenantworten. `MessageSpeech` verwendet `SpeechPlayback`, dieser sendet
Textabschnitte an `/api/speech/synthesize`. Die dort gespeicherte Anbieterwahl
entscheidet über Piper/Thorsten oder ElevenLabs. Eine spätere ElevenLabs-
Einrichtung benötigt keinen zweiten Button und keine eigene Wiedergabe.
Verbindung unter **Verbindungen**, Anbieter und Stimme unter **Einstellungen →
Stimme**. Verbinden allein wechselt den Anbieter nicht. Kein Cloud-Fallback.

Der Button bleibt auffindbar, bei laufender Antwort deaktiviert und zeigt
Vorbereiten/Stoppen sowie tatsächliche Fehler. Code und Werkzeugtexte werden
nicht vorgelesen. Wechsel auf eine andere Antwort stoppt die vorherige Ausgabe;
Entfernen des Buttons beim Chatwechsel beendet seine Wiedergabe. Die
lokale Installation erfolgt eigenständig mit `npm --prefix wrapper run
setup:speech`, ohne ein zusätzliches Erkennungsmodell herunterzuladen.

## Wiederholbare Neuinstallation

`npm run setup:system` ist der vollständige Einrichtungseinstieg. Er ruft
Diktat- und Sprachinstallation selbst auf. Festgelegte Sprachpakete führt
`requirements-speech.lock`, Modellversion und SHA-256-Prüfsummen führt
`runtime-assets.mjs`. Der Bereitschaftsmarker wird erst nach Dateiprüfung und
erfolgreichem Laden durch Piper geschrieben; geänderte Versionen oder fehlende
Dateien lösen bei erneuter Einrichtung eine Reparatur aus.

## Geräte und Netzwerk

`device-connections` verbindet Android/ADB, Samsung-Fernbedienung und Tailscale
unter Verbindungen. Status: `/api/devices`, `/api/network/status`.
Worker verwenden `device_list` und `device_action` für explizit freigegebene
Geräte, Arbeitsbereiche, Worker und Aktionen. Keine automatische Kopplung,
Freigabe oder öffentliche Veröffentlichung. Details und Migration: [Geräte](../docs/DEVICES.md).
