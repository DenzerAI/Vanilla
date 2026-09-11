# Gemeinsamer CRM-Kern

Data ist der strukturierte Datenkern eines Arbeitsbereichs. Pipeline, Kontaktliste und spätere benutzerdefinierte Ansichten sind Sichten auf denselben Bestand. Das Backend schreibt keine Verkaufsphasen vor und installiert keinen zweiten Datenbankdienst. Es erweitert die bestehende SQLite-Datei hinter FastAPI. Zugangsdaten bleiben vollständig beim vorhandenen Verbindungs-/Tresoranschluss.

## Umgesetzt

- Personen: Vorname, weitere Vornamen, Nachname, Anzeigename, Anrede, Namenszusatz, Position, Abteilung, Sprache und Webseite. Ein bekannter Name reicht; kein erzwungenes Paar aus Vor-/Nachname.
- Personen und Firmen: mehrere E-Mail-Adressen, Telefonnummern und strukturierte Adressen. Jeder Mehrfachwert hat eine stabile Slot-ID, eine Bezeichnung und optional die Kennzeichnung bevorzugt. Telefonnummern können Durchwahlen enthalten; lokale Nummern werden nicht ohne Länderkontext zur Identitätsentscheidung verwendet. Anschriften enthalten Straße, Zusatz, Postleitzahl als Text, Ort, Region und Land, optional Ländercode. Länder dürfen als überlieferter Text erhalten bleiben, ohne einen ISO-Code zu erfinden.
- Firmen: Firmenname, rechtlicher Name, USt-ID, Registernummer, Webseite, Branche und Geschäftsrollen. Kunde, Lieferant und Partner sind Rollen, keine verschiedenen Kopien derselben Firma.
- Vorgänge: Titel, frei benennbare Vorgangsart, Zuständigkeit, Betrag als ganzzahlige Untereinheiten plus Währung und ein benutzerdefinierter Ablauf. Prozess und datierter nächster Schritt bilden einen gemeinsam validierten Feldwert. Die Phasen aus der UI-Studie sind keine Backend-Konstanten.
- Beziehungen: Person/Firma und Beteiligte, mit Rolle und Abteilung; Verweise auf bereits vorhandene Projekte und Chats. Es werden keine Projekte oder Gesprächsverläufe kopiert. Mehrere Firmenzugehörigkeiten sind möglich.
- Typisierte Zusatzfelder: Text, Datum, Wahrheitswert, ganze Zahl, Auswahl und Mehrfachwerte. Geburtsdatum ist bewusst kein Standardfeld; ein solches Zusatzfeld müsste ausdrücklich angelegt werden. Felddefinitionen sind nach Anlage unveränderlich, damit bestehende Werte nicht durch eine Typänderung ungültig werden.
- Versionierte Definitionen für gespeicherte Listen-/Boardansichten mit Feldspalten und Gleichheitsfiltern. Ein Board verweist auf einen definierten Ablauf. Die UI zum Bauen eigener Ansichten folgt separat.

## Produktkern, CRM-Modul und betriebliche Konfiguration

Die Plattform verantwortet Datenbankbetrieb, Eigentümeranmeldung, Sicherung,
Updateverfahren und gemeinsame Oberflächenbausteine. Der CRM-Kern verantwortet
Personen, Firmen, Vorgänge, Beziehungen, Herkunft, Revisionen und geprüfte
Schreibwege. Produktvorlagen liefern einen neutralen Start. Betriebsdaten,
Zusatzfelder, eigene Abläufe und gespeicherte Ansichten gehören der Installation.
Sie werden nicht aus neuen Produktvorgaben erneut aufgebaut.

Ein Deal ist ein eigenständiger Vorgang (`case`), verbunden mit Firmen und
Kontaktpersonen über die vorhandenen Beziehungen. Eine Firma kann mehrere Deals
mit unabhängigen Beträgen, Phasen und nächsten Schritten haben. Ein Lead ist eine
Dealphase, kein zweiter Personentyp. Die Kontaktakte bleibt bestehen, wenn ein
Deal abgeschlossen oder verloren wird. People, Firmenliste, Dealliste und
Pipeline verwenden dieselben Fakten. Der allgemeine Kern schreibt keine
Verkaufsphasen vor; betriebliche Abläufe können auch andere Vorgangsarten führen.

### Neutrale Startvorlage

`core/crm_templates.py` führt den lesbaren, versionierten Katalog. Die Vorlage
`people-deals`, Version 1, liefert People- und Firmenlisten sowie eine Dealliste
und ein Board. Ihr Ablauf ist Lead → Angebot → Laufend → Abgeschlossen, ergänzt
um Verloren. Laufend meint die aktive Durchführung; Abgeschlossen und Verloren
sind Endzustände. Erlaubte Übergänge stehen in der Vorlagendefinition. Neue Deals
beginnen bei Lead und offene Phasen benötigen weiterhin nächsten Schritt und
Datum. Geldbeträge bleiben ganzzahlige Untereinheiten mit eigener Währung.
Angebots- und Abschlussdatum können zunächst als typisierte Zusatzfelder ergänzt
werden; es gibt keine zweite Angebots- oder Buchhaltungsdatenbank.

GET `/api/crm/templates` liest Katalog und Installationsnachweise ohne Einrichtung.
POST `/api/crm/templates/install` benötigt die vorhandene Eigentümeranmeldung und
CSRF-Prüfung. Eingabe beispielsweise
`{"template_id":"people-deals","version":1,"namespace":"sales"}`.
Die API legt ausschließlich Definitionen an, keine Personen, Firmen, Deals,
Verbindungen oder Beispieldaten. Es gibt keinen entsprechenden Agenten-Schreibbefehl.
`crm_schema` macht die lokal eingerichteten Definitionen weiterhin lesbar.

Die Einrichtung kopiert den Ablauf nach `sales-deals` und die Ansichten nach
`sales-people`, `sales-companies`, `sales-deals` und `sales-pipeline` in die bereits
vorhandenen Tabellen. Ablauf- und Ansichtskennungen haben getrennte Namensräume.
Beide Dealansichten filtern explizit auf diesen Ablauf; fremde Vorgänge erscheinen
nicht versehentlich im Board. Listen und Board sind gespeicherte Definitionen,
noch keine neu ausgelieferten Bildschirmmasken.

### Schutz bei Einrichtung und Updates

Ablauf, Ansichten, Versionsnachweis und Audit werden in einer einzigen Transaktion
angelegt. Ein Konflikt mit einer vorhandenen Kennung bricht alles ab. Vorhandene
Ansichten werden dabei auch dann nicht ersetzt, wenn sie ähnlich aussehen.
Wiederholung derselben Vorlage und Version im selben Namensraum schreibt nichts;
insbesondere bleiben inzwischen angepasste Spalten, Filter und Bezeichnungen
bestehen. Eine andere Version oder Vorlage im belegten Namensraum wird abgewiesen.
Eine zusätzliche Einrichtung braucht einen anderen Namensraum.

Die Tabelle `crm_template_installations` speichert ursprünglichen Snapshot,
Vorlagenversion, lokale Ressourcenkennungen, Akteur und Zeitpunkt. Die aktuellen
betrieblichen Definitionen bleiben in `crm_workflows` und `crm_views` führend.
Veröffentlichte Vorlagenversionen sind unveränderlich: neue Standardvorgaben
erscheinen als neue Katalogversion und werden niemals beim Start oder Lesen in
bestehende Installationen eingespielt. Ansichten werden über den vorhandenen
revisionsgeschützten Schreibweg angepasst. Geänderte Abläufe erhalten eine neue
ID; bestehende Deals werden nicht automatisch umgehängt. Eigene Zusatzfelder
bleiben unter `custom.*`, besondere Fachlogik folgt dem Modulvertrag und nutzt
die bestehenden CRM-Schnittstellen. Änderungen an gemeinsamen Kernquellen pro
Betrieb sind kein Konfigurationsweg.

Modulversion 3 ergänzt nur die Installationstabelle; die bestehende SQLite-Datei
und alle IDs, Fakten, Historien, Felder, Abläufe und Ansichten bleiben erhalten.
Ein alter Datenbestand erhält die leere Tabelle ohne Startvorlagen. Normale
Datenbanksicherungen enthalten Konfiguration und Herkunft gemeinsam. Alter Code
kann die vorhandenen CRM-Fakten und Definitionen weiterhin lesen, kennt jedoch
den Vorlagenkatalog und dessen Einrichtung nicht. Bei Rückkehr die zusätzliche
Tabelle erhalten; keine Gegenmigration durch Löschen ausführen. Änderungen
bestehender Datenformate oder Abläufe erfordern weiterhin die isolierte Prüfung,
Sicherung und Rückkehr nach UPDATE.md. Diese erste Trennung garantiert keine
Kompatibilität beliebiger späterer Erweiterungen.

### Nächster Oberflächenausbau

Zuerst produktive People-/Firmenakten und Dealbearbeitung an dieselben geprüften
Schreibwege anbinden. Die Dealmaske führt Titel, Betrag/Währung, Zuständigkeit,
Firma/Kontakte, Phase, nächsten Schritt und Datum; Listen und Board lesen die
lokalen Ansichts- und Ablaufdefinitionen. Der Kern prüft auch beim Verschieben
Revision, Übergang und Pflichtangaben. Boardanzahl und sichtbare Karten müssen
denselben gefilterten, vollständig beziehungsweise sichtbar paginierten Bestand
verwenden. Summen werden pro Währung gebildet. Keine zweite Statuskopie auf
Personen oder Firmen, keine stillen Schreibaktionen aus KI-Vorschlägen.

Danach Konfiguration für eigene Spalten, Zusatzfelder und Abläufe anbieten;
Änderungen bereits genutzter Abläufe mit ausdrücklichem Zuordnungs- und
Migrationsweg bauen. Branchenpakete sind zusätzliche versionierte Vorlagen.
Anbietersynchronisation folgt separat mit Feldführungsregeln, Konfliktprüfung und
stabilen externen Kennungen. Personendaten oder betriebliche Migrationen aus einer
anderen Installation sind kein Bestandteil neutraler Produktvorlagen.

## Entscheidungsweg

Rohsignal → Vorschlag mit Feldwerten → ausdrückliche Eigentümerentscheidung → Fakt.

Ein eingehender Datensatz erstellt noch keine Person, Firma oder Verkaufschance. Ein Vorschlag kann auf einen bestehenden Eintrag oder einen neuen Eintrag zielen. Nur die atomare Annahme erzeugt oder ändert Fakten. Agentenwerkzeuge dürfen erfassen, lesen und vorschlagen; eine Freigabe ist dort nicht verfügbar. Automatische fachliche Übernahmeregeln sind noch nicht aktiviert. Qualitative Extraktionssicherheit ersetzt keine Entscheidung.

Jeder Feldwert trägt eigene Spalten für Signal, Vorschlag, Quellzeit, Erfassungs-/Entscheidungsakteur, Sicherheitsstufe, Entscheidungszeit, Prüfzeit und Aktivstatus. Ein ersetzter Wert bleibt als historische Zeile erhalten. Notizen sind ein ausdrücklich menschenlesbares Feld; Gleichheitsfilter auf Notizen werden verweigert. Fehlende Felder müssen zuerst definiert werden. Weggelassene Werte ändern nichts; explizites null löscht den aktuellen Wert mit Herkunft als nachvollziehbaren Leerwert.

Das Änderungsprotokoll erfasst auch Quellen, Vorschläge, Entscheidungen, Zuordnungen, neue Definitionen und Archivierung mit wer/wann/warum. Zurückgewiesene Eingaben erzeugen keine teilweisen Fakten. Ein nicht mehr benötigter Eintrag kann versionsgeprüft archiviert und ausdrücklich wiederhergestellt werden; Importe können ihn nicht still reaktivieren. Archivieren ist keine Löschung.

## Aktualität

Ein zugeordneter Eingang erhöht die Aktenrevision sofort. Solange er unverarbeitet oder fehlerhaft ist, lautet die Akte nicht „bereit“. Ein widersprechender Vorschlag markiert nur seine betroffenen Feldwerte als `review`; andere Werte bleiben als aktuelle Fakten lesbar. Auf Aktenebene verhindert jeder offene Vorschlag die Freigabe für nachfolgende Aktionen. Eine fachliche Verwerfung gibt den bisherigen Feldwert wieder frei und setzt dessen Prüfzeit neu.

Entscheidungen verlangen die gelesene Aktenrevision. Ein älterer Vorschlag darf keinen inzwischen geänderten Feldwert überschreiben, auch wenn jemand nur die Revisionsnummer aktualisiert. Verspätete Quellen werden nicht wegen ihres späteren Eingangs zur neuen Wahrheit. Für Korrekturen braucht es dann eine neue, datierte Quelle und einen neuen Vorschlag. Neu angekommene unverarbeitete Hinweise verhindern eine Annahme bis zur Einordnung. Wiederholte Signal-IDs sind idempotent; anderer Inhalt unter derselben ID führt zum Konflikt. Ereignis-/Snapshot-IDs müssen deshalb die externe Objektversion einschließen.

Der Kern erstellt keine dauerhafte CRM-Zusammenfassung neben den Fakten. `crm_read` erzeugt die Akte aus aktuellen Zeilen und liefert ihre Revision und offenen Hinweise. `memory_context` ergänzt bei erkannten Namen/Firmen/Titeln/E-Mail-Adressen begrenzte, frisch gelesene CRM-Quellen vor dem Textmemory. Die Beiträge teilen das bisherige Zeichenbudget. Historische Notizen werden dadurch nicht gelöscht oder automatisch in Fakten umgeschrieben. Die Namenserkennung ist eine einfache Kandidatensuche, keine vollständige semantische Identitätsauflösung; der Agent soll für verbindliche Kundenaussagen `crm_search`/`crm_read` verwenden. Bereits geladener Modellkontext kann nicht rückwirkend verändert werden.

`/entities/{id}/check` prüft Version und Bereitschaft erneut. Zukünftige Fachaktionen müssen dieselbe Prüfung unmittelbar im eigenen Schreibweg anwenden; ein vorheriger separater HTTP-Check ist keine Sperre über eine spätere externe Aktion hinweg. `received_signals_only` bedeutet ausdrücklich nur den verarbeiteten lokalen Eingang. Noch nicht abgerufene Nachrichten sind keine nachgewiesene Vollständigkeit. Polling, Webhooks, Wiederanlauf-Cursor und Quellen-SLAs gehören zum nächsten echten Adapter, nicht zu einer erfundenen „aktuell“-Anzeige.

## Identität und Anschlüsse

Interne UUIDs bleiben anbieterunabhängig. Externe IDs bestehen aus Verbindung, Objekttyp und externer Kennung; die Verbindung bezeichnet das konkrete Konto. Eine bereits belegte Kennung darf nicht umgehängt werden. E-Mail und internationale Telefonnummer liefern exakte Kandidaten; selbst ein einzelner Kandidat führt hier noch zu keiner automatischen Zusammenführung. Geteilte Postfächer, mehrere Treffer und unklare Rufnummern bleiben zu klären. Namen werden nie zum Zusammenführen benutzt. Zusammenführung samt Rücknahme ist bewusst noch kein Schreibwerkzeug.

Der bestehende Anbieterkatalog bleibt führend: `wrapper/crm-catalog.mjs`, `wrapper/service-catalog.mjs` und `wrapper/ui/connection-catalog.mjs`. Die CRM-API liest vorhandene Verbindungskennungen aus dem bestehenden Zustand, ohne Config oder Secrets herauszugeben. Es gibt keinen zweiten Anbieter- oder Anmeldekatalog.

| Anschluss | Geprüfter Bezug | Stand des Data-Anschlusses |
| --- | --- | --- |
| Outlook / Microsoft Graph | Kontaktmodell mit mehreren E-Mails/Telefonen/Adressen und separaten Firmenbezeichnungen | Reine, getestete Kontaktübersetzung; noch kein Kontaktabruf oder Sync |
| HERO | Kontakte, Projekte, Dokumente und Termine als GraphQL-Objekte | Kanonischer Eingangs-/Vorschlagsvertrag; genaue Feldübersetzung und Abruf noch nicht gebaut |
| weclapp | Version 2 vereinheitlicht contact/customer/lead/supplier unter party | Kanonischer Vertrag; API-Version und Kontotyp vor Adapterbau festlegen |
| CentralStationCRM und weitere vorhandene CRM-Anbieter | Bestehender Zugangskatalog | Keine behauptete Synchronisation; konkrete Felder/Rechte je Adapter prüfen |

Microsoft-Referenz: [Kontaktmodell](https://learn.microsoft.com/en-us/graph/api/resources/contact?view=graph-rest-1.0). Die Übersetzung verwendet bekannte Namens-, Kommunikations- und Adressfelder. Fehlende Collections bleiben unberührt; explizit gelieferte leere Collections löschen nur Slots dieser Verbindung. `companyName` erzeugt keine Firma, unbekannte Felder werden als nicht zugeordnet benannt und bleiben im Rohsignal. Externe IDs sollten mit `Prefer: IdType="ImmutableId"` gelesen werden; Standard-IDs können sich beim Verschieben ändern. Eine lokale Mobilnummer bekommt keine geratene Landesvorwahl.

Weitere Primärquellen: [HERO GraphQL](https://hero-software.de/api-doku/graphql-guide), [weclapp API-v2-Änderungen](https://www.weclapp.com/api/changelogV2.html). Diese Quellen belegen Modellunterschiede; die lokale Existenz eines Loginformulars belegt keine implementierte Datenübernahme.

## Technischer Vertrag

Die Tabellen sind Verantwortungen innerhalb derselben SQLite-Datenbank: Entitäten, eigene Felddefinitionen, Rohsignale, Vorschläge samt Werten, versionierte Fakten, externe Kennungen, Beziehungen, Abläufe, gespeicherte Ansichten und Audit. Typisierte Objektwerte wie Anschriften liegen als geprüftes JSON im Feldwert; Herkunft und Abfragestatus sind eigene SQL-Spalten. Die Suchindizes sind relational auf Feld/Normalwert aufgebaut. Es gibt weder einen freien JSON-Notizspeicher noch eine neue Vektordatenbank. Normale Backups sichern den gesamten Stand mit.

API-Basis `/api/crm`:

| Aktion | Weg |
| --- | --- |
| Feld-/Ablauf-/Ansichtsdefinitionen lesen | GET /schema |
| Startvorlagen lesen und explizit einrichten | GET /templates, POST /templates/install |
| Deterministische Suche und Gleichheitsfilter | POST /query |
| Aktuelle Akte, Historie, Versionsprüfung | GET /entities/{id}, GET /entities/{id}/history, POST /entities/{id}/check |
| Quelle erfassen/einordnen | POST /sources, GET /sources/{id}, POST /sources/{id}/classify |
| Vorschlagen und entscheiden | POST /proposals, GET /proposals, POST /decisions |
| Zusatzfeld, Ablauf, Ansicht definieren | POST /fields, POST /workflows, POST /views |
| Kennung oder Beziehung zuordnen | POST /identities, POST /relations |
| Archivieren/wiederherstellen | POST /entities/{id}/archive |
| Vorhandene Verbindungen ohne Secrets | GET /connections |
| Graph-Quelle rein normalisieren | GET /sources/{id}/normalize |

Anbietereingänge kommen über `/internal/crm/sources` mit dem vorhandenen internen Token und einer vorhandenen Verbindungs-ID. Die öffentlichen Schreibwege verwenden die bestehende Eigentümeranmeldung und CSRF-Prüfung. Alle JSON-Modelle verweigern unbekannte Schlüssel; Werte werden beim Vorschlagen und beim Übernehmen geprüft. DDL für Zusatzfelder ist nicht nötig: Nur Eigentümer können typisierte Felddefinitionen anlegen. Ein Ablauf ist nach Definition unveränderlich; geänderte Abläufe bekommen eine neue ID. Die bewusste Migration laufender Vorgänge wird später als eigene Aktion gebaut.

Der vorhandene MCP-Bridge-Prozess führt zusätzlich `crm_schema`, `crm_search`, `crm_read`, `crm_resolve`, `crm_capture` und `crm_propose`. CRM ist gemeinsam für den konfigurierten Workspace; `projectId` bezeichnet den aktuellen Agentenkontext und macht keine separate Kundenkopie. Das Produkt besitzt weiterhin einen Eigentümerzugang und keine Mandanten-/Mitarbeiterrechte. Der MCP-Vertrag beschränkt Agenten auf Vorschläge. Er ist keine zusätzliche Betriebssystem-Sandbox gegen Worker, die anderweitig direkten Dateizugriff besitzen.

## Bewusst noch offen

Echter erster CRM-Sync mit Rechten, Feldführungsregeln, Paging, Delta-/Löschsignalen und Wiederanlauf; automatische geprüfte Übernahmeregeln; externe Schreibwarteschlange; produktive Bearbeitungs-/Prüfmasken; ein Builder für Ansichten und Abläufe; Relation ändern/beenden; kontrollierte Identitätszusammenführung; dokumentierte Export-/Lösch-/Aufbewahrungsabläufe. Angebote und Rechnungen bleiben zunächst zuzuordnende externe Geschäftsdokumente; kein Nachbau einer Buchhaltung. Die Beispiel-Pipeline ist durch Heute und Kalender ersetzt. Heute liest fällige CRM-Schritte; die Kalender-/Kontakt-Beispiele schreiben keine Fakten. Weitere produktive Masken müssen explizit diesen Vertrag verwenden.

Der gemeinsame MCP-Einstieg bietet zusätzlich registrierte Gerätewerkzeuge an.
CRM-Werkzeuge und ihre Daten bleiben über dieselben bestehenden Schnittstellen
erreichbar; eine Gerätefreigabe verleiht keine zusätzlichen CRM-Rechte.
