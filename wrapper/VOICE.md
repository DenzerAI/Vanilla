# Stimme: Bedienung, Technik und Grenzen

## Bedienung

Im vereinfachten Composer gibt es genau eine Sprachaktion: **Mikrofon** diktiert in den Entwurf. Die früheren Einstiege für Sprachchat und Vorlesen sind dort entfernt. Die darunter beschriebene Ausgabetechnik und ihre Einstellungen bleiben vorhanden; der Composer startet sie nicht. Die Sprachleiste zeigt den tatsächlichen Pegel, Laufzeit und Iconaktionen für Pause, Verwerfen, Übernehmen/Senden und Schließen. Aufnahmen stehen ausschließlich unter **Einstellungen → Stimme → Gesicherte Aufnahmen → Verwalten**. Verwerfen markiert den Papierkorb, löscht aber keine Audiodaten.

**Stimme** verwendet die gemeinsamen Einstellungsgruppen: Allgemein (Mikrofon), Diktat (Erkennung und Verlauf), Sprachchat (Ausgabe, Stimme, Automodus). Gerätewahl gilt für das Browserprofil. Ein nicht mehr verfügbares Gerät fällt auf den Systemstandard zurück. Anbieterwahl und Automodus liegen lokal im Datenordner.

**Groq und ElevenLabs** werden ausschließlich unter **Verbindungen → Weitere Dienste einrichten** über die normale Plus-Kachel mit Original-Markenasset eingerichtet. Einrichtung und Bearbeitung nutzen denselben Dialograhmen. Schlüssel werden vor dem Speichern geprüft und im macOS-Schlüsselbund gehalten. Nach Einrichtung steht der Dienst unter Eingerichtet und wird in Stimme auswählbar. Das Verbinden allein wechselt keinen Standard. Entfernen deaktiviert die Verbindung und setzt den betroffenen Standard auf lokal; der Schlüssel verbleibt im Schlüsselbund, bis er dort entfernt oder ersetzt wird.

## Diktat und Sprachchat

Diktat stoppt auf Übernehmen, sichert alle Abschnitte, erkennt Deutsch und fügt den Text in den bestehenden Entwurf ein. Es sendet keine Nachricht. Sprachchat sendet die erkannte Äußerung an den gewählten Chat über dessen vorhandenen Arbeitsmodus und liest ausschließlich die fertige Agentenantwort vor. Codeblöcke, Werkzeugausgaben und Zwischenkommentare werden nicht vorgelesen.

Automodus ist zunächst aus. Innerhalb eines ausdrücklich gestarteten Sprachchats erkennt er eine Sprechpause (ca. 1,5 Sekunden nach mindestens 0,35 Sekunden hörbarer Sprache), sendet, wartet auf die Antwort, liest sie vor und öffnet anschließend wieder das Mikrofon. Die Pegelerkennung ist eine einfache Heuristik; „Senden“ bleibt verfügbar. Nach längerem Schweigen wird pausiert. Während der Wiedergabe ist das Mikrofon geschlossen. Im Hintergrund wird die Aufnahme pausiert; nach Rückkehr ist Fortsetzen nötig. Schließen/Chatwechsel beendet die Sprachbedienung. Es gibt kein Wake-Word und keinen heimlich gestarteten Dauerhörmodus. Rückfragen und Freigaben bleiben Teil des bestehenden Chatablaufs.

## Lokale Ausgabe

Piper 1.4.2 mit `de_DE-thorsten-high` ist die mitgelieferte deutsche Ausgabestimme. Installation: automatisch als Teil von `npm run setup:system` im Projektordner. Einzelne Reparatur: `npm run setup:speech` im Wrapper. `npm start` und `npm run dev` starten die Anwendung, ohne Modelldownloads zu wiederholen. Python 3.9+ mit venv/pip ist erforderlich. Einmalige Paket-/Modelldownloads benötigen Internet; danach werden die lokalen Modelldateien verwendet. Dateien: `data/control/dictation-runtime`, `speech-model` und `dictation-model` beziehungsweise der konfigurierte `UWE_DATA_ROOT`.

Piper bekommt den Text über stdin, schreibt eine kurzlebige WAV-Datei und die lokale API liefert das Audio an den Browser. Temporäre Ausgabedateien werden nach der Antwort entfernt; das betrifft keine Mikrofonaufnahmen. Wiedergabe benutzt einen durch Benutzeraktion aktivierten AudioContext. Lange Antworten werden in Abschnitte bis 2.000 Zeichen zerlegt und vollständig nacheinander vorgelesen; Stoppen verhindert weitere Abschnitte. Blockierte Wiedergabe oder API-Fehler werden gemeldet, nicht verschwiegen.

## Cloud

Die Gesprächsantwort kommt weiterhin vom ausgewählten Chat-Worker und dessen bestehender Verbindung. Lokale Erkennung und Ausgabe bedeuten nicht, dass auch der Chat-Worker lokal rechnet.

Groq nutzt `whisper-large-v3-turbo` für Deutsch. ElevenLabs lädt die Kontostimmen über `/v2/voices` mit Nachladen weiterer Seiten und erzeugt Sprache über `/v1/text-to-speech/:voice_id` mit `eleven_multilingual_v2`. Groq erhält die ausgewählte Audioaufnahme; ElevenLabs erhält den vorzulesenden Text. Beide Wege sind optional. Kein automatischer Cloud-Fallback. Die vorhandene Übergabeprüfung speichert nur Metadaten. Ein API-Aufruf kann Kosten im jeweiligen Konto verursachen; Einstellungen benennen die Cloudverarbeitung.

## Mikrofon und Sicherung

Der Browser fragt ein Mikrofon ohne erzwungene Abtastrate oder Kanalzahl an. Der AudioContext verwendet das native Geräteformat. Ein kontinuierlicher Resampler im AudioWorklet überführt 44,1/48/96 kHz auf 16-kHz-Mono-PCM. Damit wird die vorherige problematische Anforderung eines 16-kHz-AudioContext vermieden. Persistenzdetails und Verlustgrenzen stehen in [DICTATION.md](DICTATION.md).

## Quellen und Lizenzen

[Piper](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0), [Python API](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md), [Thorsten-Modellkarte](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/de/de_DE/thorsten/high/MODEL_CARD) mit CC0-Datensatz, [Groq Speech to Text](https://console.groq.com/docs/speech-to-text), [ElevenLabs Stimmen](https://elevenlabs.io/docs/api-reference/voices/search), [ElevenLabs Sprachausgabe](https://elevenlabs.io/docs/api-reference/text-to-speech/convert). Die Modellkarte wird mit heruntergeladen. Markenquellen liegen unter `ui/assets/voice-brands-sources.json`.

## Prüfung der Umsetzung

60 automatisierte Tests einschließlich Audioerhalt, Abtastratenumrechnung, Gerätefallback, Cloud-Einstellungen und Bereichsverträgen bestanden. Desktop-/Mobilprüfung im Browser, Einrichtung über den Groq-Dialog und echte lokale Piper-Hörprobe erfolgreich. Der komplette Automodus wurde in Chromium und WebKit mit synthetischem Mikrofonstream, simulierter Chatantwort und echter lokaler Piper-Ausgabe geprüft: Sprechpause → Übergabe → Ausgabe → erneute Aufnahme. Der Diktatweg wurde zusätzlich mit einer deutschen Sprachdatei bei 48 kHz als Browser-Mikrofoneingang erfolgreich bis zur Textübernahme geprüft. Persönliche Groq-/ElevenLabs-Aufrufe und das physische Nutzermikrofon benötigen die jeweiligen Zugänge beziehungsweise Gerätefreigabe und sind nicht als geprüft ausgewiesen.

## Vorlesen einzelner Antworten

Der Lautsprecher unter fertigen Antworten verwendet die bestehende Speech-API
und die Auswahl unter Stimme. Die zentrale Anschlusslandkarte
`system/CAPABILITIES.md` dokumentiert UI, Anbieter, Status und Endpunkte.
`npm run setup:speech` legt seine Python-Laufzeit auch ohne vorheriges
Diktat-Setup an. Gleichzeitige Ausgaben teilen sich eine exklusive Wiedergabe.


Der gemeinsame Systeminstaller richtet die unabhängige lokale Suche vor den
Sprachlaufzeiten ein. Ein Sprachfehler bleibt ein fehlgeschlagenes Gesamtsetup;
die bereits geprüfte lokale Suche bleibt installiert. Suchmodellvertrag:
[OPERATIONS.md](../docs/OPERATIONS.md#lokale-suche).

## Gespeicherte ElevenLabs-Stimmen

`voiceProfiles` ergänzt speech-settings.json additiv um bis zu 50 Profile mit `id` und `name`. Bestehende `voiceId` bleibt unverändert; ohne Profile gilt eine leere Liste. POST /api/speech/voices/save prüft die ID über GET /v1/voices/{voice_id}, übernimmt ohne eigenen Namen den Anbieternamen und aktualisiert identische IDs statt Duplikaten. `select:true` wählt die Stimme, wechselt aber keinen Anbieter. POST /api/speech/voices/remove entfernt nur das lokale Profil und leert eine dazugehörige aktive Auswahl; beim Anbieter wird nichts gelöscht. Schreibvorgänge sind serialisiert und atomar. Schlüssel bleiben im geschützten Tresor. Trennen erhält Profile. Ältere Versionen bewahren das Zusatzfeld beim Speichern, bieten keine Profilverwaltung.
