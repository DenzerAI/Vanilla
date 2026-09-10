# Updates und Beiträge

Status: beschlossenes Produkt- und Umsetzungskonzept. Stand: 10.09.2026.
Updateoberfläche, GitHub-Anmeldung, Release-Manifest und automatischer
Beitragsabgleich sind noch nicht implementiert. Bereits vorhanden sind der
[Update-Arbeitsablauf](../UPDATE.md), Quellprüfungen, Modulverträge, UI-Buildprüfung,
Worker, Sicherung und Benachrichtigungen. Deren tatsächliche Grenzen gelten weiter.

Dieses Dokument führt Architektur, Zustände und Abnahme. Die Oberfläche führt
[updates.md](../wrapper/surfaces/updates.md), GitHub folgt dem bestehenden
[Verbindungsvertrag](../wrapper/surfaces/connections.md). Keine zweite
Updater-, Zugangsschlüssel- oder Benachrichtigungsverwaltung daneben aufbauen.

## Produktentscheidung

- Ein Einstieg **Einstellungen → Updates**, direkt nach System. Reiter **Version**
  und **Beiträge**. Keine neue Hauptseite in der App-Navigation.
- **GitHub** ist ein dauerhaft mitgelieferter Anbieter unter **Verbindungen**,
  Kategorie Automatisierung & Agenten. Dauerhaft verfügbar bedeutet nicht
  automatisch angemeldet. Jede Installation verbindet ihr eigenes Konto.
- Neue Versionen und relevante Auftragsergebnisse erscheinen in der vorhandenen
  Glocke. Ein Hinweis öffnet Updates und startet keine Installation.
- Version 1 prüft automatisch nach neuen Versionen. Vorbereitung startet auf
  Klick; die Aktivierung hat genau eine ausdrückliche Freigabe **Jetzt installieren**.
- In der betreuten Kundeninstallation gehört die Bereitstellung ihres geprüften
  aktuellen Anwendungscodes zum vereinbarten Updateprozess. Der Vorgang ist
  sichtbar und einmalig eingerichtet. Firmendaten und Zugänge bleiben lokal.
- Eingehender Code wird auf der Ursprungsseite verglichen und bewertet. Empfang,
  Übernahme in Vanilla, öffentliche Freigabe und lokale Installation sind getrennt.

## Repositorys und Rollen

| Ablage oder Rolle | Verantwortung |
| --- | --- |
| `DenzerAI/Vanilla`, öffentlich | Gemeinsamer Kern, neutrale Module, Anleitungen und geprüfte Veröffentlichungen. |
| Eigenständiges privates Kundenrepository | Gemeinsame Git-Historie plus geprüfte eigene Codeänderungen. Kunde schreibt; der vereinbarte Betreuer erhält lesenden Zugriff. Kein öffentlicher GitHub-Fork mit vertraulichen Inhalten. |
| Lokale Installation | Firmendaten, Identität, Workspaces, Geheimnisse, Arbeitszustände, Sicherungen und Updatejournal. |
| Ursprung | Veröffentlichungen vorbereiten, Beiträge aus ausdrücklich verbundenen Kundenrepositorys prüfen und zur Übernahme auswählen. |
| Kundeninstallation | Releases empfangen, eigenen Code bereitstellen, Kombination prüfen und lokal aktivieren. |

Eine Codebasis unterstützt beide Rollen. Die Rolle wird bei der Einrichtung lokal
festgelegt und gegen reale GitHub-Rechte geprüft. Ein Repositoryname, Clone oder
mitgeliefertes `origin` erteilt keine Herausgeberrechte. Neue Kundeninstallationen
erben weder die Ursprungsrolle noch dessen Konten, Kundenliste oder Freigaben.
Der Betreuer greift mit seinem eigenen GitHub-Konto zu, nie mit Kundentokens.

Das Kundenrepository bleibt `origin`, Vanilla wird zusätzlich als `upstream`
angebunden. Bestehende Remotes werden geprüft und erhalten. Bei fehlender gemeinsamer
Historie oder vertraulicher Historie gilt die kontrollierte Erstübernahme aus
[CODE-SYNC](CODE-SYNC.md). Kein Force-Push und keine stillschweigende Veröffentlichung.

## GitHub-Verbindung

Geplanter Standard ist eine GitHub App mit Device Flow: **Verbinden** öffnet den
vorhandenen Verbindungsdialog, zeigt GitHubs einmaligen Anmeldecode und führt zur
GitHub-Anmeldung. Nach Freigabe werden Konto und zugängliches privates Repository
ausgewählt und tatsächlich geprüft. Keine Passworteingabe im Chat, kein Import
einer vorhandenen persönlichen CLI-Anmeldung und kein Kontowechsel anderer Worker.

Die App wird einmal vom Herausgeber registriert; ihre öffentliche Client-ID darf
mitgeliefert werden. Device Flow muss aktiviert sein. Access- und Refresh-Token
liegen ausschließlich im bestehenden installationsgebundenen Tresor. Refresh
erfolgt serialisiert und atomar; nach Widerruf oder Ablauf ist erneut anzumelden.
Kein zentrales App-Geheimnis oder privater App-Schlüssel wird an Kunden ausgeliefert.
Dieser lokale Ablauf benötigt keinen neuen zentralen Tokenserver. GitHub beschreibt
[Device Flow und Repositoryzugriff](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
sowie [Token-Erneuerung ohne Client-Secret bei Device Flow](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens).

Anmeldung, App-Installation für ausgewählte Repositorys, Lesezugriff,
Schreibzugriff und bestätigter Betreuerzugriff sind getrennte Voraussetzungen.
Das Setup prüft jede davon. Es erweitert keine Berechtigung automatisch.
Geplant sind Lesen von Metadaten, Inhalten und Prüfstatus sowie Schreiben der
freigegebenen Codezweige und Beiträge im ausgewählten Repository. Zusätzliche
Rechte, etwa für Workflow-Dateien oder eine Veröffentlichung, werden nur für die
konkret eingerichtete Funktion angefordert. Kein Löschen von Repositorys, keine
Organisationsverwaltung und kein universeller Zugriff auf sämtliche Kundenrepos.
Der Herausgeber richtet den Betreuerzugriff separat ein und bestätigt ihn mit
dem eigenen Anschluss; die Kunden-App benötigt dafür keine Verwaltungsrechte.

Der Dialog zeigt Konto, Repository, Freigabeumfang und letzten Prüfstand. Entfernen
stoppt weitere Abfragen und Schreibaktionen, erhält lokale Daten und folgt der
bestehenden Trenn-/Secret-Logik. Bereits übertragener Code wird dadurch nicht
zurückgerufen. Fehlende Rechte zeigen die konkrete fehlende Fähigkeit, kein
pauschales „Verbunden“. Ein einfacher gespeicherter GitHub-Link genügt nicht.

## Releasequelle

Version 1 verwendet einen öffentlichen Kanal **Stabil**. Ein veröffentlichtes
GitHub Release enthält das maschinenlesbare `vanilla-release.json`. Die kleine
Datei wird erst nach erfolgreichen Prüfungen erzeugt und enthält:

| Feld | Bedeutung |
| --- | --- |
| `schemaVersion`, `releaseId`, `version` | Format, unveränderliche Veröffentlichung und lesbare Produktversion. |
| `repository`, `tag`, `commit` | Erwartetes Ursprungsrepository und exakt geprüfter Quellcommit. |
| `publishedAt`, `summary`, `changes` | Datum, kurze Neuerungen und betroffene Modulkennungen. |
| `requirements` | Unterstützte Plattformen, Laufzeiten und Mindestversion des Updaters. |
| `modules` | Modulversionen, Abhängigkeiten und unterstützte Schnittstellenversionen. |
| `migrations`, `rollback` | Unterstützte Ausgangsstände, Migrationsreferenzen, erforderliche Zwischenschritte und Rückkehrgrenzen. |
| `checks` | Nachweise der erforderlichen Prüfungen für genau diesen Quellcommit. |

Das Manifest ist Daten, kein Shellskript und keine neue Agentenanweisung. Der
Client prüft Schema, erlaubte Quelle, Tag/Commit-Bindung und den tatsächlichen
GitHub-Prüfstatus. Hashangaben allein sind kein Nachweis des Herausgebers.
Entwürfe, Vorabversionen, zurückgezogene Releases und fremde Downloadquellen werden
nicht installiert. Unbekanntes Schema, zu alter Updater oder nicht unterstützter
Versionssprung führt zu einer konkreten Meldung statt zu einem geratenen Fallback.
Ein älteres Release löst kein automatisches Downgrade aus.

Voreinstellung: Prüfung beim Start, wenn die letzte Prüfung mehr als 24 Stunden
zurückliegt, danach täglich mit kleinem Zufallsversatz. Der bestehende Scheduler
führt genau einen lesenden Systemauftrag aus. HTTP-Cache, bedingte Anfragen und
Rate-Limit-Pausen verwenden; keine Dauerabfrage pro Browserpanel. **Jetzt prüfen**
nutzt denselben Weg. Offline bleibt der letzte Stand mit Prüfdatum sichtbar.
An GitHub gehen nur die notwendigen öffentlichen Releaseanfragen, keine lokale
Inventarliste. GitHub sieht dabei wie bei jedem Abruf Netzwerkmetadaten.

Bis dieser Releaseweg implementiert und das erste gültige Manifest veröffentlicht
ist, bleibt `UPDATE.md` mit manueller Commit-Auswahl führend. Eine neue Oberfläche
darf fehlende Releases nicht durch angeblich freigegebene `main`-Pushes ersetzen.

## Vorbereitung und Zustände

Der Kern besitzt einen langlebigen Updateauftrag. UI und Agent lösen Aktionen
aus; sie speichern keinen konkurrierenden Zustand. Vorgesehene Operationen sind
Prüfen, Vorbereiten, Abbrechen, Installieren und Status lesen. Das sind geplante
Operationen, noch keine vorhandenen HTTP-Endpunkte.

| Zustand | Bedeutung / nächste Aktion |
| --- | --- |
| Ungeprüft / Aktuell | Letzte Prüfung fehlt oder keine neuere freigegebene Version. |
| Verfügbar | Beschreibung lesen, Vorbereitung starten. |
| In Vorbereitung | Bestand sichern, Code bereitstellen, zusammenführen, bewerten und testen. |
| Klärung nötig | Konkreter Konflikt, fehlende Voraussetzung oder fehlgeschlagener Test; Produktionsstand bleibt aktiv. |
| Bereit | Prüfergebnisse und Rückkehrweg gültig; Jetzt installieren. |
| Wird installiert | Geordnete Betriebspause, aktuelle Sicherung, Migration und Aktivierung. |
| Aktualisiert | Neuer Dienst und eigener Funktionsumfang geprüft. |
| Wiederhergestellt / Wiederherstellung nötig | Rückkehr bestätigt oder manueller Eingriff erforderlich; kein erfundener Erfolg. |

Ein lokales Journal hält Auftrags-ID, Revision, Ausgangs-/Ziel-/Integrationscommit,
Quellbaumhash, Inventarrevision, Worker/Modell/Denkstufe, Phasen, Prüfnachweise,
Sicherungsreferenz, Codeübermittlung und Freigabe fest. Eine exklusive Sperre
verhindert parallele Vorbereitung/Aktivierung. Doppelklicks und HTTP-Wiederholungen
verwenden denselben Auftragsschlüssel. Wiederaufnahme prüft den tatsächlichen
Zustand; sie wiederholt keine Migration, Übermittlung oder Aktivierung blind.

Während der Vorbereitung darf die Firma weiterarbeiten. Ändern sich Code,
Modulkonfiguration oder Zeitpläne nach der Prüfung, ist der Kandidat erneut zu
prüfen. Normale neue Geschäftsdaten erfordern spätestens zur Aktivierung eine
aktuelle konsistente Sicherung. Die Freigabe gilt nur für den geprüften Kandidaten
und wird bei dessen Änderung ungültig. Vor Aktivierung Releasefreigabe, Rechte,
freien Speicher und betroffenen Bestand erneut prüfen.

## Agent und feste Prüftore

Der Auftrag verwendet den ausdrücklich konfigurierten vorhandenen Worker mit
der höchsten von seinem gewählten Modell tatsächlich unterstützten Denkstufe.
Keine erfundene anbieterübergreifende Stufe, kein stiller Wechsel von Anbieter
oder Konto. Gewählte Stufe und begrenztes Auftragsbudget sind nachvollziehbar;
fehlende Fähigkeiten oder erschöpftes Budget führen zu Klärung. Die Einstellung
ändert weder normale Chats noch den globalen Workerstandard.

Der Agent arbeitet in einer separaten Arbeitskopie, erklärt Unterschiede und
Konflikte und erzeugt einen konkreten Integrationskandidaten. Er kann Tests und
Anpassungen vorbereiten. Technische Tore entscheiden anhand tatsächlicher
Ergebnisse über „Bereit“, nicht anhand eines LLM-Textes. Fremder Code, Kommentare
und Releasebeschreibungen bleiben untrusted input und erweitern keine Befugnisse.
Ein lokal laufender Agent kann einen Cloudanbieter verwenden; dafür gelten die
vor Ort erteilten Datenfreigaben. Geheimnisse sind kein Modellkontext.

Erforderlich sind die vorhandenen Datenschutz-, Modul-, Funktions-, Migrations-
und UI-Prüfungen sowie der Erhalt des eigenen Inventars. Tests fremden Codes
laufen ohne Produktionszugänge, aktive Bots, Zeitpläne oder Deploymentrechte.
GitHub-Workflows aus eingehenden Beiträgen erhalten ebenfalls keine Secrets oder
automatischen Veröffentlichungsrechte. Ein Worktree allein ist keine Sandbox.

## Workflows, Cronjobs und Module erhalten

Vorher/Nachher-Inventar pro Arbeitsbereich und Modul: stabile IDs, Quelldateien,
Versionen, Abhängigkeiten, Datenablagen, Konfigurationsrevisionen und Anschlüsse.
Für Aufträge zusätzlich Zeitplan, Zeitzone, Aktivierungszustand, Worker,
Benachrichtigungsziel, letzte Ausführung und schon reservierte Termine festhalten.
Fachliche Arbeitsanweisungen bleiben privat. Unbekannte eigene Erweiterungen
werden nicht gelöscht; fehlende Zuordnung ist ein Prüfbefund.

Lokale Anweisungen und Zeitpläne werden nicht durch neutrale Vorlagen ersetzt.
Bei Migrationen führende Jobdateien und abgeleiteten Datenbankindex zusammen
prüfen. Externe Cron-/Dienstdefinitionen erfassen, falls sie zur Installation
gehören; niemals die gesamte crontab oder fremde Dienstkonfiguration ersetzen.
Ein unveränderter Dateihash beweist noch keine funktionierende Schnittstelle.
Eigene Regressionstests und ein Wiederherstellungstest ergänzen den Inventarvergleich.

Aktivierung benötigt eine technische Wartungssperre für neue Arbeit, geordnetes
Beenden aktiver Arbeit und einen vom App-Prozess unabhängigen lokalen Operator.
Der Agent darf nicht seinen eigenen Neustart beaufsichtigen müssen. Der Operator
arbeitet nur mit dem freigegebenen Kandidaten, erhält das Journal und prüft den
neuen Dienst. Dies ist noch zu implementieren; der vorhandene Neustartknopf
liefert diese vollständige Transaktion nicht. Code, Build und Abhängigkeiten
brauchen ebenso einen Rückweg wie migrierte Daten. Bei ungeklärtem Rückkehrzustand
Schreibbetrieb gesperrt halten und konkret melden.

Nach Wiederanlauf verpasste Auslösungen gemäß bestehender Schedulerregel
behandeln. Bereits versendete oder unklar bestätigte externe Aktionen nicht
erneut ausführen. „Backup vorhanden“ reicht nicht als Abnahme.

## Codebereitstellung und Beiträge

Einmalige Einrichtung dokumentiert zugelassenes Repository, Codeumfang,
Betreuerzugriff sowie die vereinbarte Einsicht, Wiederverwendung und mögliche
Veröffentlichung. „GitHub verbunden“ ist keine solche Vereinbarung. Beim
betreuten Update prüft das System diesen Umfang und die Zugangsvoraussetzungen.
Unvollständige Einrichtung blockiert den betreuten Ablauf, nicht den öffentlichen
Download oder die lesende Updateprüfung. Widerruf stoppt neue Übermittlungen.

Vor dem Zusammenführen eigener Änderungen wird der aktuelle neutrale
Anwendungs-/Modulcode geprüft und unter einer eindeutigen Snapshot-Referenz in
das private Kundenrepository gepusht. Keine Datenordner, Chats, Zugangswerte,
privaten Workflowtexte oder unkontrollierte Historie. Bei vertraulicher Historie
zuerst einen bereinigten neutralen Austauschstand herstellen; den Originalbestand
lokal erhalten. Ein unvollständiger oder ungeprüfter Export zählt nicht als
erfolgreiche Bereitstellung. Auch Beschreibung, Commitnachricht und Tests prüfen.

Die Übermittlung hat einen eigenen Status und eine persistente Kennung aus
Repository-ID und Quellbaumhash. Eine Wiederholung erzeugt keinen zweiten Beitrag.
Vor Erfolg die Remote-Referenz erneut lesen und mit dem geprüften Stand abgleichen.
Bei unklarer Netzwerkantwort zuerst nachsehen, nicht blind erneut pushen.
Neue Codeänderungen verlangen einen neuen Stand. Für betreute Installation ist
bestätigte Bereitstellung erforderlich; ein sachlich abgelehnter Beitrag verhindert
kein Update. Das ist keine Zusage, dass jeder Code in Vanilla übernommen wird.

Auf der Ursprungsseite werden nur ausdrücklich angeschlossene Kundenrepositorys
gelesen. Der tägliche lesende Abgleich und **Jetzt prüfen** erkennen neue Snapshot-
Referenzen; V1 benötigt keine neue Webhook-Infrastruktur. Pro Beitrag speichert
der Ursprung Herkunft, gemeinsamen Vanilla-Basiscommit, Snapshot-ID, Diffhash,
Modulzuordnung und neutralen Kurztext. Kundenspezifische Repositoryliste bleibt lokal.

Der Reiter **Beiträge** zeigt beim Kunden eigene übermittelte Stände und die Aktion
**Teilen** für einen ausdrücklich beauftragten Beitrag außerhalb eines Updates.
Beim Ursprung zeigt er **Eingang**. **Prüfen** lässt den Agenten beschreiben:
Was ist neu, was existiert bereits, welche Abhängigkeiten/Konflikte bestehen und
wie könnte es in Vanilla passen? **Übernehmen** erzeugt einen geprüften separaten
Integrationszweig. **Zurückstellen** und **Ablehnen** verändern keine Kundendaten.

Private Beiträge bleiben zunächst im privaten Kundenrepository und in der
isolierten Prüfablage. Ein öffentlicher Pull Request würde den Code bereits
veröffentlichen; er entsteht erst nach entsprechender Freigabe und Bereinigung.
GitHub-Diffs und Pull Requests können die technische Umsetzung tragen, ohne
diese Begriffe in der normalen Bedienung zu verlangen. Kein Kunde erhält allein
durch die Teilnahme Schreibrechte auf Vanilla. Auch angenommener Code wird
nicht automatisch in der laufenden Ursprungsinstallation ausgeführt.

## Benachrichtigungen

Vorhandene `core/notifications.py`, Ereignisse/SSE, Glocke und NotificationRow
erweitern. Release, Auftrag und Beitrag benötigen stabile eigene Ereigniskennungen;
die bisher auf Jobabschlüsse ausgerichtete Quelle ist dafür gezielt zu ergänzen.
Keine fiktiven Jobausführungen nur zum Anzeigen einer Meldung erzeugen.

Einmal melden: neue Version, Vorbereitung bereit, Klärung nötig, Updateergebnis
oder neuer Beitrag. Keine Meldung bei jeder erfolgreichen Tagesprüfung. Lesestatus
und Deduplizierung über Neustarts erhalten. Klick führt zum passenden Reiter und
Auftrag. Gerät-/Kanalhinweise nutzen ausschließlich eingerichtete Freigaben und
vorhandene Zustellwege; geschlossener Browser ist kein garantierter Web-Push.
Der vorhandene SystemNotice für UI-Neuladen/Serverneustart behält seine Bedeutung.

## Nachhaltige Umsetzung und Abnahme

Geplante Zuständigkeiten sind `updates` für Release/Updateauftrag, `github` für
Anmeldung und Repositoryoperationen, `contributions` für Übermittlung/Vergleich.
Die IDs sind hier reserviert, noch keine registrierten verfügbaren Module.
Vor dem ersten ausführbaren Schritt Quellen, konkrete Endpunkte, Status und
Tests in `system/modules.json` und `system/capabilities.mjs` registrieren.
Die vorhandenen Module für Jobs, Betrieb, Verbindungen und Benachrichtigungen
erweitern; keine zweite Queue oder allgemeine Remote-Shell bauen.

Jede Erweiterung pflegt nach [MODULES](../system/MODULES.md) Version, Schnittstelle,
Datenhaltung und Migrationsregel mit dem Code. Der künftige Releasecheck muss
Manifest, unterstützte Versionssprünge, Modulverträge und bestandene Prüfungen an
denselben Commit binden. Beschreibender Text und ein grüner Build reichen nicht.
Automatische Installation ohne Einzelklick bleibt späterer ausdrücklich
konfigurierter Ausbau; sie umgeht keines dieser Prüftore.

| Schritt | Lieferumfang und Voraussetzung für Abschluss |
| --- | --- |
| 1. GitHub und Einrichtung | App registriert; eigener Login, privates Repo, Rechte, Tresor/Refresh, Trennen und Betreuerzugriff real geprüft. |
| 2. Veröffentlichungen und Anzeige | Validiertes Release-Manifest, Tagesprüfung, Updates → Version und deduplizierte Benachrichtigung; zunächst nur Lesen. |
| 3. Vorbereitung und Beiträge | Dauerhafter Auftrag, getesteter Bestandserhalt, kontrollierter Code-Push, Eingang, Agentenbewertung und feste technische Prüftore. |
| 4. Aktivierung | Freigabegebundener Operator, Wartungssperre, Sicherung, Migration, Startprüfung und getestete Rückkehr. |

Abnahme an zwei getrennten Installationen mit neutralen Testdaten: eigener
Workflow, aktiver/deaktivierter Cronjob, eigenes Modul und simulierte Verbindung.
Erfolgsupdate und Konflikt prüfen; ebenso gleichzeitige Code-/Planänderung,
abgelaufenen Zugang, geheimen Testmarker im Export, verweigerten Push, doppelte
Klicks, manipuliertes/veraltetes Manifest, unbekanntes Modul und unterbrochene
Vorbereitung/Aktivierung. Nach Rückkehr müssen Daten und Ausführungsreservierungen
stimmen. Eingangscode darf vor einer ausdrücklichen Test-/Übernahmeaktion keine
Ausführung auslösen. Pro Schritt echte Funktion und geplanten Ausbau unterscheiden.
