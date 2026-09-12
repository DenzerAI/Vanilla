# Diktat: Konzept und Umsetzung

Die Diktatfunktion erstellt einen bearbeitbaren Textentwurf. Sie sendet keine Chatnachricht selbstständig. Das Mikrofon im Chat öffnet die Aufnahme; Pause/Fortsetzen, tatsächlicher Pegel und Laufzeit zeigen den Zustand. Der Haken sichert die Aufnahme, startet die Erkennung und übernimmt den Text in den Entwurf. Der Pfeil „Diktat direkt senden“ erledigt dieselben Schritte und sendet anschließend den erkannten Text zusammen mit vorhandenem Entwurf und Anhängen. Die Aufnahme ersetzt vorübergehend die Textzeile in derselben kompakten Pille; es gibt keinen zusätzlichen Quick-Modusschalter. Während einer laufenden Antwort oder Übertragung bleibt Direkt senden gesperrt. Ein Chatwechsel oder Schließen während der Erkennung verhindert eine spätere Direktübertragung. Fehler oder leere Erkennung senden nichts; bei Sendefehlern bleibt der Text im Entwurf. Der Verlauf unter Einstellungen → Stimme bietet Textübernahme, erneute Erkennung und WAV-Download. Sprachchat und Sprachausgabe: [VOICE.md](VOICE.md). Die Funktion ist auch im Planmodus verfügbar, da sie ausschließlich Text vorbereitet.

## Audio hat Vorrang

Audio und Transkription sind voneinander unabhängig. Ein AudioWorklet erfasst Mono-PCM bei 16 kHz. Je 4.096 Samples (256 ms) werden in einer strikten IndexedDB-Transaktion gespeichert. Alle drei Sekunden werden ausstehende Abschnitte an den lokalen Server übertragen. Bestätigte Browserkopien werden beibehalten. Die Anwendung fordert beständigen Browserspeicher an; der Browser entscheidet darüber.

Der Server speichert jeden Abschnitt separat unter `data/control/dictations/<UUID>/`. Schreiben, fsync, atomare Umbenennung und Verzeichnissynchronisation kommen vor der Bestätigung. Wiederholte Uploads sind idempotent; ein anderer Inhalt unter derselben Abschnittsnummer wird abgewiesen. Lücken verhindern die Erzeugung einer scheinbar vollständigen WAV-Datei. Nach einem Serverneustart werden ausstehende Browserabschnitte erneut gesendet. Auch eine abgebrochene Aufnahme ohne Abschlussmarkierung lässt sich aus zusammenhängenden Abschnitten nachträglich verarbeiten.

Fehler bei Whisper, Groq, Netzwerk, API-Limits oder Schlüsseln löschen kein Audio und keinen bisherigen Text. Nach einem Neustart unterbrochene Erkennungen lassen sich erneut anstoßen. „Verwerfen“ ist ausschließlich eine Papierkorb-Markierung; Wiederherstellen ist möglich. Es gibt keine automatische Löschfrist und keine endgültige Löschfunktion. Bei Speicherversagen wird die Aufnahme pausiert; fehlgeschlagene Abschnitte bleiben bis zum erneuten Sichern im Arbeitsspeicher und können zusammen mit der Browserkopie heruntergeladen werden. Browserkopien sind auch ohne Server zum Download verfügbar.

Grenzen: Stromausfall oder Browserabsturz können noch nicht persistierte Samples verlieren. Browserdaten löschen, ein privates Browserfenster schließen oder ein Datenträgerdefekt können lokale Kopien zerstören. Keine Software kann absolute Verlustfreiheit garantieren. Für ein vollständiges Sicherungskonzept gehört `data/control/dictations` in die reguläre verschlüsselte Rechner-Sicherung. Keine Uploads zu einem Backupdienst werden automatisch eingerichtet. Die Browserkopie gehört zum jeweiligen Browserprofil und Ursprung (Host und Port).

## Lokal als Standard

Vor dem Mikrofonzugriff stellt der gemeinsame Browserhelfer eine vorhandene
AudioSession auf `play-and-record`. Sobald die Anfrage erfolgreich oder
fehlgeschlagen beendet ist, übernimmt wieder `auto`; ein zuvor aktiver reiner
Wiedergabemodus darf Diktat und Mikrofontest nicht blockieren. Browser ohne diese
optionale API verwenden weiterhin den normalen Mikrofonzugriff. Berechtigungsfehler
werden nicht automatisch wiederholt. Regressionstests simulieren die
WebKit-Kategoriesperre, Gerätefallback und verweigerte Berechtigungen.

`npm start` installiert vor dem ersten Start automatisch eine isolierte Python-Laufzeit mit faster-whisper 1.2.1 sowie das mehrsprachige Modell Whisper Small. Voraussetzung ist Python 3.9 oder neuer mit venv/pip; `UWE_PYTHON` kann den Interpreter wählen. Der einmalige Paket-/Modelldownload braucht Internet und Speicherplatz. Manueller Installationsbefehl: `npm run setup:dictation`. Im Entwicklungsstart wird dieselbe Einrichtung verwendet.

Die Laufzeit und das Modell liegen unter `UWE_DATA_ROOT` beziehungsweise `data/control/`. Erkennung läuft mit CPU/int8, deutscher Sprache, Sprachaktivitätserkennung und ohne Übersetzung. Inferenz verwendet ausschließlich lokale Modelldateien und setzt `HF_HUB_OFFLINE=1`. Es gibt keinen Cloud-Fallback. Eine Erkennung läuft gleichzeitig; ihr Ergebnis und Fehler werden dauerhaft gespeichert. Das Zeitlimit beträgt 30 Minuten. Small ist der initiale Kompromiss zwischen Größe und Qualität, keine Zusicherung perfekter Erkennung von Eigennamen oder Fachwörtern.

## Groq optional

Unter **Verbindungen → Weitere Dienste einrichten → Groq (+)** kann ein API-Schlüssel hinterlegt werden. Unter **Einstellungen → Stimme** wird die Erkennung gewählt. Er liegt im vorhandenen macOS-Schlüsselbund, nicht in der Konfigurationsdatei. Erneute Erkennung im Aufnahmeverlauf verwendet den unter Stimme gewählten Anbieter. Groq sendet die gewählte WAV-Aufnahme an den festen offiziellen Endpunkt mit `whisper-large-v3-turbo`, Sprache `de`, ohne Redirects und mit zweiminütigem Zeitlimit. Eine erneute Cloud-Erkennung ist ein erneuter Upload. Die Übergabeprüfung protokolliert nur ID und Byteanzahl.

Uploads sind konservativ auf 24 MiB begrenzt (bei diesem PCM-Format etwa 13 Minuten); größere Aufnahmen bleiben lokal verarbeitbar. Kosten und Kontolimits richten sich nach dem Groq-Konto. „Schnell“ bedeutet keine garantierte sofortige Erkennung.

## Prüfung und sinnvolle nächste Erweiterungen

Automatisierte Tests prüfen Neustart, Duplikate, widersprüchliche Uploads, Lücken, Papierkorb, fehlgeschlagene lokale Erkennung und unvollständigen Abschluss. Ein Browsertest mit simuliertem Mikrofon prüft Aufnahme/Pause/Fortsetzen, Neuladen, Wiederherstellen und Layouts auf Desktop/Mobil. Eine deutsche synthetische Sprachdatei wurde mit dem tatsächlich installierten Modell offline korrekt transkribiert. Ein echter Mikrofontest und ein echter Groq-Aufruf mit dem persönlichen Schlüssel stehen aus.

Später sinnvoll: Fachwortliste, Modellwahl Small/Large Turbo, dauerhaft warmgehaltenes Modell für kürzere Startlatenz, Suchfilter für viele Aufnahmen und ausdrücklich eingerichtete zweite Sicherung. Live-Teiltranskripte wären eine Komfortfunktion; die belastbare Originalaufnahme bleibt die Grundlage.

Quellen: [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Groq Speech to Text](https://console.groq.com/docs/speech-to-text).


## Diktat-Tastenkürzel · Version 1.0.0

Stimme → Diktat verwendet DictationShortcutSettings mit normalen SettingRows:
Taste (Automatisch, rechte Command/Meta, rechte Strg, Aus) und Bedienung
(Drücken zum Ein-/Ausschalten als Standard, optional Gedrückt halten).
Automatisch verwendet auf Mac MetaRight und sonst ControlRight. Ausschließlich
die ausgewählte sichtbare Chat-Pane im aktiven Fenster reagiert, keine globalen
Betriebssystem-Hotkeys. Dialoge, Menüs und Sprachchat verhindern einen neuen Start.
Umschalten erfolgt beim Loslassen einer allein gedrückten Taste; Kombinationen
und Wiederholungen lösen es nicht aus. PTT startet beim Drücken und beendet beim
Loslassen; zusätzliche Tastenkombinationen unterbrechen die PTT-Aufnahme.
Fenster-/Panewechsel erhält Umschalt-Aufnahmen; nur Gedrückt-halten endet bei Fokusverlust oder Loslassen. Ein Loslassen
während der Mikrofonfreigabe bricht den ausstehenden PTT-Start ab. Erneuter Start
braucht eine neue Geste. Beenden sichert und transkribiert ausschließlich in den
Entwurf, ohne Nachricht zu senden. Vorhandene Audio-Wiederherstellung bleibt.
Einstellungen sind browserlokal unter agent-dictation-shortcut-v1, validiert und
zwischen Tabs synchronisiert; Speicherfehler werden angezeigt. Keine Migration
bestehender Audio- oder Serverdaten. Entfernen des neuen Schlüssels stellt die
plattformabhängige Voreinstellung wieder her. Systemtasten können vom Betriebssystem
abgefangen werden; rechte Strg bleibt als Alternative auswählbar.

## Gemeinsamer integrierter Stand
Die Browserablage lädt nur offene Diktate und deren Chunks. Geteilte Abrufe und
Hintergrundversand behalten Wiederherstellung und ursprüngliche Audiosegmente.
Prüfung: dictation-storage.test.mjs und composer-dictation.test.mjs.

## Direkte Pane-Tastenkürzel · Version 2.1.0

Ctrl + Shift + 1–4 wählt das erste bis vierte geöffnete Chatfeld in der
Ansichtsreihenfolge von links nach rechts, setzt den Composerfokus und startet
das Diktat. Bei „1 Chat“ bedient die 1 immer das verbliebene Chatfeld, auch nach
Verkleinern einer Viereransicht. Interne Pane-IDs bleiben unabhängig erhalten;
Tabnamen, Menüaktionen und zugängliche Eingabebeschriftungen verwenden dieselbe
Ansichtsnummer. Schmale oder maximierte Ansichten erhalten die Reihenfolge aller
geöffneten Felder. Eine Änderung dieser Zuordnung vor dem Mikrofonstart bricht
die ausstehende Geste ab. Keine Migration von Chats, Entwürfen oder Belegungen;
Rückkehr zu 2.0 verwendet wieder die internen Pane-Nummern.
Erneutes Drücken derselben Kombination beendet die Aufnahme und sendet den
Erkennungstext einmal zusammen mit vorhandenem Entwurf und Anhängen. Während
Mikrofonfreigabe bricht erneutes Drücken den ausstehenden Start ab; während
Sichern/Erkennen/Senden werden weitere Start-/Sendeimpulse ignoriert.
Escape bricht Aufnahme oder ausstehende Erkennung ohne Textübernahme und Senden
ab. Bereits übergebene Nachrichten werden damit nicht zurückgerufen. Audio bleibt
unter Stimme wiederherstellbar, Entwürfe und Anhänge bleiben erhalten.
Pane-/Fensterwechsel erhält die Aufnahme. Ein Chatwechsel während der Erkennung
übernimmt ausschließlich in den ursprünglichen Entwurf; verspätete
Statusantworten dürfen niemals in einen anderen Chat senden.
Verborgene oder maximierte Zielpanels werden über die aktive Panelauswahl sichtbar.
Nicht geöffnete Panels melden einen Hinweis; gesperrte Chats starten kein Mikrofon.
Nur ein Listener der äußeren App verarbeitet die Kürzel im aktiven Chatfenster;
Dialoge, Menüs, Einstellungen, IME und Tastenwiederholung sind ausgeschlossen.
Einstellungen → Tastenkürzel erklärt Start, Senden und Escape in der vorhandenen
PaneShortcutSettings mit SettingRows. Belegung aufnehmen, je Pane deaktivieren
und Standard wiederherstellen bleiben erhalten. Doppelte Belegungen und bestehende
App-Kürzel werden abgewiesen; Schreibzeichen ohne Ctrl/Alt/Meta sind nicht erlaubt,
F-Tasten sind möglich. Escape/Tab/Verlassen bricht die Belegungsaufnahme ab.
Speicherfehler bleiben sichtbar. Browserlokaler Schlüssel agent-pane-shortcuts-v1
bleibt validiert und zwischen Tabs synchronisiert. Gespeicherte Belegungen gelten
nun für Diktatstart/Direktsenden; fehlende/ungültige Werte verwenden den Standard.
Keine Audio-/Serverdatenmigration. Rückkehr zu Version 1 macht die Belegungen
wieder zu reinen Fokusaktionen. Separate rechte Command-/Strg-Diktattaste und
PTT behalten die Entwurfsübernahme. Betriebssystem-/Browserbelegungen können
Vorrang haben; keine globalen Betriebssystem-Hotkeys.


## Aufnahme beim Navigieren

RecordingProvider hält genau ein Diktat pro Browser-Tab außerhalb der Chatpanels.
DictationComposer meldet nur den sichtbaren Anker und die Startgeste. Aufnahme,
Mikrofonfreigabe, Sichern und Erkennung behalten den beim Start gebundenen
Workspace, Chat, Pane und gegebenenfalls die konkrete Rückfrage. Neue Aufnahmen
sind bis zum Abschluss gesperrt. Vorhandene Entwürfe und Anhänge bleiben erhalten.

Navigation zu Inbox, Einstellungen, anderen Chats oder Panels beendet das Diktat
nicht. Außerhalb des ausgewählten Ursprungscomposers erscheint oben rechts die
RecordingHost als kompakte Aufnahmekapsel: ursprünglicher Chatname als
Rücksprung, statischer Aufnahmepunkt, Status, Dauer, Pause/Fortsetzen und Stop.
Auch eine geschlossene Pane lässt sich über den Rücksprung wieder öffnen.
Rückkehr verschiebt ausschließlich die Bedienelemente zurück in den Composer;
der Aufnahmeprozess und seine bereits gesicherten Abschnitte bleiben bestehen.

Stop in der Kapsel sichert und transkribiert ohne Versand oder erzwungenen
Ansichtswechsel. Das Ergebnis wird an den aktuellen Text des ursprünglichen
Entwurfs angehängt, auch wenn inzwischen ein anderer Chat offen ist. Eine noch
offene ursprüngliche Rückfrage erhält den Text in genau ihrer Antwort; eine
inzwischen erledigte Rückfrage fällt auf den Chatentwurf zurück. Der explizite
Sendepfeil und das Pane-Kürzel senden nur bei weiterhin ausgewähltem Ursprung;
ein Wechsel während der Erkennung übernimmt stattdessen in dessen Entwurf.

Die Kapsel nutzt IconButton, VoiceStatus, VoiceWave im Composer sowie bestehende
Flächen-, Abstands-, Farb- und Rundungsrollen. Auf Desktop und Mobil bleibt sie
innerhalb sicherer Bildschirmränder. SystemNotice weicht um die gemessene
Kapselhöhe aus. Keine Daueranimation; Pause bleibt sichtbar. Fehler, leere
Erkennung und Sicherungsprobleme bleiben erreichbar; Verwerfen erhält Audio.
Unser Design zeigt RecordingPreview mit Pause und Stop ohne Mikrofonzugriff.

Fensterfokusverlust allein beendet kein Umschalt-Diktat. Gedrückt-halten behält
seine ausdrückliche Loslassen-/Fokusverlust-Semantik. Bei verborgenem Browser-Tab
oder ausgesetztem AudioContext wird pausiert; Fortsetzen benötigt eine Geste.
Neuladen/Schließen führt weiterhin zur Warnung während der Aufnahme, beendet
aber den Browserprozess. Gesicherte Audioabschnitte bleiben unter Stimme
wiederherstellbar. Keine Garantie für Aufnahme bei gesperrtem Mobilgerät.
Nur flüchtige Sitzungszuordnung, keine Migration vorhandener Audio-/Serverdaten.
Rückkehr zu älterem UI stellt dessen bisheriges Abbruchverhalten wieder her.

Sperren des ursprünglichen privaten Chats beendet das Diktat ohne Textübernahme;
der globale Titel wird sofort verborgen. Bereits gesicherte Audiodaten bleiben erhalten.
