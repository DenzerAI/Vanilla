# Diktat: Konzept und Umsetzung

Die Diktatfunktion erstellt einen bearbeitbaren Textentwurf. Sie sendet keine Chatnachricht selbstständig. Das Mikrofon im Chat öffnet die Aufnahme; Pause/Fortsetzen, tatsächlicher Pegel und Laufzeit zeigen den Zustand. Der Haken sichert die Aufnahme, startet die Erkennung und übernimmt den Text in den Entwurf. Der Verlauf unter Einstellungen → Stimme bietet Textübernahme, erneute Erkennung und WAV-Download. Sprachchat und Sprachausgabe: [VOICE.md](VOICE.md). Die Funktion ist auch im Planmodus verfügbar, da sie ausschließlich Text vorbereitet.

## Audio hat Vorrang

Audio und Transkription sind voneinander unabhängig. Ein AudioWorklet erfasst Mono-PCM bei 16 kHz. Je 4.096 Samples (256 ms) werden in einer strikten IndexedDB-Transaktion gespeichert. Alle drei Sekunden werden ausstehende Abschnitte an den lokalen Server übertragen. Bestätigte Browserkopien werden beibehalten. Die Anwendung fordert beständigen Browserspeicher an; der Browser entscheidet darüber.

Der Server speichert jeden Abschnitt separat unter `data/control/dictations/<UUID>/`. Schreiben, fsync, atomare Umbenennung und Verzeichnissynchronisation kommen vor der Bestätigung. Wiederholte Uploads sind idempotent; ein anderer Inhalt unter derselben Abschnittsnummer wird abgewiesen. Lücken verhindern die Erzeugung einer scheinbar vollständigen WAV-Datei. Nach einem Serverneustart werden ausstehende Browserabschnitte erneut gesendet. Auch eine abgebrochene Aufnahme ohne Abschlussmarkierung lässt sich aus zusammenhängenden Abschnitten nachträglich verarbeiten.

Fehler bei Whisper, Groq, Netzwerk, API-Limits oder Schlüsseln löschen kein Audio und keinen bisherigen Text. Nach einem Neustart unterbrochene Erkennungen lassen sich erneut anstoßen. „Verwerfen“ ist ausschließlich eine Papierkorb-Markierung; Wiederherstellen ist möglich. Es gibt keine automatische Löschfrist und keine endgültige Löschfunktion. Bei Speicherversagen wird die Aufnahme pausiert; fehlgeschlagene Abschnitte bleiben bis zum erneuten Sichern im Arbeitsspeicher und können zusammen mit der Browserkopie heruntergeladen werden. Browserkopien sind auch ohne Server zum Download verfügbar.

Grenzen: Stromausfall oder Browserabsturz können noch nicht persistierte Samples verlieren. Browserdaten löschen, ein privates Browserfenster schließen oder ein Datenträgerdefekt können lokale Kopien zerstören. Keine Software kann absolute Verlustfreiheit garantieren. Für ein vollständiges Sicherungskonzept gehört `data/control/dictations` in die reguläre verschlüsselte Rechner-Sicherung. Keine Uploads zu einem Backupdienst werden automatisch eingerichtet. Die Browserkopie gehört zum jeweiligen Browserprofil und Ursprung (Host und Port).

## Lokal als Standard

`npm start` installiert vor dem ersten Start automatisch eine isolierte Python-Laufzeit mit faster-whisper 1.2.1 sowie das mehrsprachige Modell Whisper Small. Voraussetzung ist Python 3.9 oder neuer mit venv/pip; `UWE_PYTHON` kann den Interpreter wählen. Der einmalige Paket-/Modelldownload braucht Internet und Speicherplatz. Manueller Installationsbefehl: `npm run setup:dictation`. Im Entwicklungsstart wird dieselbe Einrichtung verwendet.

Die Laufzeit und das Modell liegen unter `UWE_DATA_ROOT` beziehungsweise `data/control/`. Erkennung läuft mit CPU/int8, deutscher Sprache, Sprachaktivitätserkennung und ohne Übersetzung. Inferenz verwendet ausschließlich lokale Modelldateien und setzt `HF_HUB_OFFLINE=1`. Es gibt keinen Cloud-Fallback. Eine Erkennung läuft gleichzeitig; ihr Ergebnis und Fehler werden dauerhaft gespeichert. Das Zeitlimit beträgt 30 Minuten. Small ist der initiale Kompromiss zwischen Größe und Qualität, keine Zusicherung perfekter Erkennung von Eigennamen oder Fachwörtern.

## Groq optional

Unter **Verbindungen → Weitere Dienste einrichten → Groq (+)** kann ein API-Schlüssel hinterlegt werden. Unter **Einstellungen → Stimme** wird die Erkennung gewählt. Er liegt im vorhandenen macOS-Schlüsselbund, nicht in der Konfigurationsdatei. Erneute Erkennung im Aufnahmeverlauf verwendet den unter Stimme gewählten Anbieter. Groq sendet die gewählte WAV-Aufnahme an den festen offiziellen Endpunkt mit `whisper-large-v3-turbo`, Sprache `de`, ohne Redirects und mit zweiminütigem Zeitlimit. Eine erneute Cloud-Erkennung ist ein erneuter Upload. Die Übergabeprüfung protokolliert nur ID und Byteanzahl.

Uploads sind konservativ auf 24 MiB begrenzt (bei diesem PCM-Format etwa 13 Minuten); größere Aufnahmen bleiben lokal verarbeitbar. Kosten und Kontolimits richten sich nach dem Groq-Konto. „Schnell“ bedeutet keine garantierte sofortige Erkennung.

## Prüfung und sinnvolle nächste Erweiterungen

Automatisierte Tests prüfen Neustart, Duplikate, widersprüchliche Uploads, Lücken, Papierkorb, fehlgeschlagene lokale Erkennung und unvollständigen Abschluss. Ein Browsertest mit simuliertem Mikrofon prüft Aufnahme/Pause/Fortsetzen, Neuladen, Wiederherstellen und Layouts auf Desktop/Mobil. Eine deutsche synthetische Sprachdatei wurde mit dem tatsächlich installierten Modell offline korrekt transkribiert. Ein echter Mikrofontest und ein echter Groq-Aufruf mit dem persönlichen Schlüssel stehen aus.

Später sinnvoll: Fachwortliste, Modellwahl Small/Large Turbo, dauerhaft warmgehaltenes Modell für kürzere Startlatenz, Suchfilter für viele Aufnahmen und ausdrücklich eingerichtete zweite Sicherung. Live-Teiltranskripte wären eine Komfortfunktion; die belastbare Originalaufnahme bleibt die Grundlage.

Quellen: [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Groq Speech to Text](https://console.groq.com/docs/speech-to-text).
