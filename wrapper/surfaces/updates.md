# Updates

Implementierter Aufbauvertrag. Betriebs- und Einrichtungsgrenzen stehen in UPDATES.md.
Architektur, Freigaben, Zustände und Abnahme führt [UPDATES.md](../../docs/UPDATES.md).

## Platz und gemeinsame Bausteine

**Einstellungen → Updates**, unmittelbar nach System. Ein PageHeading „Updates“
und die vorhandene segmentierte Auswahl **Version / Beiträge**. Kein zusätzlicher
Hauptmenüpunkt. Suche und Benachrichtigung öffnen denselben Bereich direkt.
SettingRow, SettingsNavigationRow, settings-group, Modal, vorhandene Tabs,
SettingsSkeleton und AppLoader verwenden; keine neuen Tokens oder Dashboardkarten.
GitHub-Anmeldung bleibt ausschließlich unter **Verbindungen**.

## Version

Reihenfolge: installierter Stand und letzte Prüfung → neue Version mit kurzer
Beschreibung → aktueller Updateauftrag → automatische Prüfung und Hinweisoptionen.
**Jetzt prüfen**, **Vorbereiten** und **Jetzt installieren** stehen je nach Zustand
als passende Zeilenaktion bereit. Keine drei gleichzeitig angebotenen Hauptaktionen.
Technische Commitwerte, Diff, Testdetails und Protokoll nur unter **Details**.
Fehlende Voraussetzung benennt ihre Aktion, etwa **GitHub verbinden** als direkten
Verweis in den vorhandenen Verbindungsdialog.

„In Vorbereitung“ zeigt wirkliche Phasen ohne erfundene Prozentwerte. „Bereit“
zeigt neue Funktionen, erhaltene Erweiterungen, relevante Änderungen und den
geprüften Rückkehrweg. **Jetzt installieren** ist die eine Freigabe für genau
diesen geprüften Stand. Warten auf aktive Arbeit und eine notwendige neue Prüfung
werden verständlich angezeigt. Kein automatisches Beenden fremder Arbeit.

Beim Ursprung steht die eigene Rolle als **Ursprung** in den Details. Der Reiter
Version ergänzt die Aktion **Freigeben** ausschließlich bei eingerichteten
Herausgeberrechten und erfolgreicher Releaseprüfung. Dies veröffentlicht eine
Version und aktualisiert keine eigene oder fremde Installation automatisch.
Kunden sehen diesen Ablauf nicht; eine kopierte Einstellung erteilt keine Rechte.

## Beiträge

Kurzer Reitername **Beiträge**. „Pull Request“, „Fork“ und „Push“ werden für die
normale Bedienung nicht vorausgesetzt; technische Details bleiben erreichbar.

- Kunde: eigener Übermittlungsstatus und Liste der geteilten Stände. **Teilen**
  bereitet einen Beitrag vor. Beim betreuten Update ist die bereits vereinbarte
  Codebereitstellung ein sichtbarer Schritt; keine erneute pauschale Zustimmung.
- Ursprung: Gruppe **Eingang** mit Herkunft, Zweck, betroffenen Modulen und Zustand.
  Öffnen zeigt den Vergleich. **Prüfen**, **Übernehmen**, **Zurückstellen** und
  **Ablehnen** erscheinen passend zum Zustand. „Übernehmen“ beschreibt ausdrücklich
  die Vorbereitung im Entwicklungszweig und verspricht keine Live-Installation.
- Freigabeumfang, Zugriffsproblem oder vertraulicher Inhalt zeigen einen konkreten
  Zustand. „Gesendet“ folgt erst auf bestätigte Remote-Referenz. Leere Liste und
  fehlende GitHub-Anmeldung sind unterschiedliche Zustände.

## Hinweise und Zustände

Die bestehende Glocke nutzt NotificationRow mit Kurztext, Datum und Lesestatus:
„Update verfügbar“, „Update bereit“, „Update braucht Klärung“, „Aktualisiert“ oder
„Neuer Beitrag“. Klick öffnet Version beziehungsweise Beiträge und den betroffenen
Auftrag. Keine Installation oder Übermittlung durch Öffnen einer Meldung.
Der vorhandene SystemNotice für Neuladen/Neustart bleibt davon getrennt.

Erstladen, vorhandene Daten während Aktualisierung, Offline/alter Prüfstand,
keine neue Version, Zugang abgelaufen, Rechte fehlen, Klärung, Erfolg und
Wiederherstellung erhalten ausdrücklich eigene Zustände. Kein Platzhalter darf
eine vorhandene Anmeldung, Codeübermittlung oder erfolgreiche Prüfung vortäuschen.

## Abnahme

Vor Umsetzung Verbindung-, Einstellungs- und Benachrichtigungsquellen prüfen.
Das Agentenmenü zeigt die aus dem laufenden Kern gemeldete Produktversion und
öffnet diesen Bereich direkt im Reiter Version. Entwicklung, CLI-Version,
verfügbare Freigabe und installierter Stand dürfen sich nicht gegenseitig ersetzen.
Desktop und schmale Ansicht, beide Themes, große Schrift, lange Versionshinweise,
Tastatur und reduzierte Bewegung prüfen. Laufender Auftrag überlebt Tabwechsel,
Browser-Neuladen und Dienstneustart. Doppelklicks erzeugen keine zweite Aktion.
Eingehender Code wird beim Öffnen nur angezeigt, nicht ausgeführt. Funktionstests
und gemeinsame Designprüfung ergänzen die Szenarien aus UPDATES.md.
