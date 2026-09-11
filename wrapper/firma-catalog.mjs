// Versioned criteria, not a questionnaire: the worker asks only for missing evidence.
const step = (id, title, rows) => ({id,title,items:rows.map(([key,label,criteria])=>({id:`${id}-${key}`,title:label,criteria:criteria.map((text,i)=>({id:`c${i+1}`,text}))}))});
export const firmaSteps = [
 step('start','Start & Rahmen',[
 ['ziel','Ziel und erste Aufgaben',['Konkretes Problem und gewünschtes Ergebnis','Häufigkeit, Aufwand und drei priorisierte Aufgaben']],
 ['menschen','Ansprechpartner und Zusammenarbeit',['Verantwortliche Person und beteiligte Rollen','Betreuungsrhythmus und verfügbare Beiträge']],
 ['zugang','Zugang und Betrieb',['Tatsächlich getesteter Zugang und vorgesehene Anbieter','Nachweise für Wiederanlauf und Wiederherstellung, offene Grenzen']],
 ['daten','Erste Eingaberegeln',['Erlaubte Daten und geprüfter Verarbeitungsweg für die Erfassung','Ausgeschlossene Daten und Ansprechperson bei Unsicherheit']]]),
 step('betrieb','Betrieb verstehen',[
 ['profil','Leistungen und Kunden',['Leistungen und Zielgruppen','Verbindliche Begriffe, Besonderheiten und Grenzen']],
 ['rollen','Rollen und Zuständigkeiten',['Rollen, Verantwortung und Vertretung','Entscheidungen und nötige Freigaben']],
 ['quellen','Werkzeuge und Unterlagen',['Genutzte Werkzeuge und verfügbare Quellen','Zuständigkeit, Aktualität und Sichtbarkeit der Quellen']],
 ['ablaeufe','Wiederkehrende Abläufe',['Auslöser, Eingaben, Schritte und Ergebnis der Pilotabläufe','Ausnahmen, Engpässe, Aufwand und vorhandene Qualitätsprüfung']]]),
 step('qm','Vereinfachen & Qualität',[
 ['filter','Sinnvolle Aufgaben auswählen',['Problem, Prozessreife und Datenlage pro Kandidat','Einfachere Alternative, Häufigkeit und Bedarf an KI beurteilt']],
 ['vereinfachen','Abläufe vereinfachen',['Ist-Ablauf und begründeter Soll-Vorschlag getrennt','Änderungen und verbleibende Risiken mit Verantwortlichen abgestimmt']],
 ['qualitaet','Qualität und Ausnahmen',['Überprüfbare Merkmale eines guten Ergebnisses','Fehler-, Ausnahme- und Vertretungsweg']],
 ['pilot','Ersten Umfang festlegen',['Vereinbarte Pilotprozesse und bewusste Ausschlüsse','Ausgangswerte, Erfolgskriterien und Verantwortliche']]]),
 step('wissen','Firmengedächtnis bestätigen',[
 ['kern','Firmenwissen prüfen',['Benötigte Kernaussagen mit aktuellen Quellen','Offene Wissenslücken und widersprüchliche Aussagen geklärt']],
 ['prozesse','Prozesse bestätigen',['Vollständige Prozessblätter einschließlich Qualität und Ausnahmen','Fachliche Prüfung durch zuständige Personen belegt']],
 ['pflege','Pflege festlegen',['Führende Ablage ohne konkurrierende Wahrheiten','Pflegeverantwortliche, Prüfanlass und Versionsverfahren']],
 ['fragen','Wissen im Alltag testen',['Repräsentative Fragen anhand der freigegebenen Quellen beantwortet','Korrekte Antworten und bewusst als unbekannt markierte Angaben geprüft']]]),
 step('regeln','KI-Regeln festlegen',[
 ['einsatz','Werkzeuge und Einsatz klären',['Konkrete Anbieter, Accounts und Einsatzfälle','Datenarten, Empfänger, Verarbeitungsorte und Einstellungen geprüft']],
 ['datenschutz','Datenschutzfragen klären',['Zweck, Datenbedarf, Rechtsgrundlage und erforderliche Verträge geprüft','Aufbewahrung, Löschung, Transparenz und weitere erforderliche Prüfungen geklärt']],
 ['richtlinie','Unsere KI-Richtlinie erstellen',['Betriebsspezifischer Entwurf mit erlaubter Nutzung, Grenzen und Freigaben','Ergebnisprüfung, Fehlerwege, Einweisung und Pflege beschrieben']],
 ['freigabe','Richtlinie freigeben',['Fachliche Prüfungen und Entscheidung der Geschäftsleitung für konkrete Version','Geltungsbereich, Ansprechpartner und Bekanntgabe belegt']]]),
 step('team','Team einweisen',[
 ['lernweg','Passenden Lernweg festlegen',['Nutzerrollen, Vorwissen und konkrete Werkzeuge berücksichtigt','KI-Grenzen, Daten, gute Aufträge und Ergebnisprüfung abgedeckt']],
 ['praxis','Im Alltag üben',['Praktische Aufgabe und Bewertung je beteiligter Person dokumentiert','Fehlversuche erklärt und erforderliche Wiederholung durchgeführt']],
 ['nachweis','Einweisung festhalten',['Person, Inhalte, Version, Datum und ausstellende Stelle dokumentiert','Kenntnisnahme der gültigen Richtlinie, keine erfundene Zertifizierung']],
 ['rechte','Nutzungsumfang freigeben',['Gesonderte Freigabe je Person und Anwendungsumfang','Technisch geprüfte Rechte und Verfahren für Änderung oder Entzug']]]),
 step('faehigkeiten','Fähigkeiten erproben',[
 ['auftrag','Erste Fähigkeit beschreiben',['Auslöser, Eingaben, Quellen und gewünschtes Ergebnis','Einfachste passende Umsetzung, Verantwortung und Grenzen']],
 ['testen','Gemeinsam ausprobieren',['Normale Fälle, fehlende Daten und Fehlerfälle erprobt','Ergebnisqualität, Korrekturen und Nacharbeit belegt']],
 ['automatik','Automatik begrenzen',['Begründete Entscheidung für manuell, Zeit- oder Ereignisauslösung','Bei Automatik: Runden, Zeit, Kosten, Freigaben, Doppelaufrufe und Stoppweg geklärt']],
 ['abnahme','Fähigkeit abnehmen',['Vereinbarte Qualität und Nutzen erreicht','Betriebliche Abnahme mit konkretem Funktionsumfang']]]),
 step('uebergabe','Übergabe & Pflege',[
 ['nutzen','Nutzen gemeinsam prüfen',['Zeit pro Fall, Ergebnisqualität, Nutzung und Fehler betrachtet','Ausgangslage und Pilotwerte nachvollziehbar verglichen']],
 ['alltag','Betrieb übergeben',['Kunde kann den vereinbarten Umfang selbst bedienen','Offene Punkte und Abnahme dokumentiert']],
 ['verantwortung','Verantwortung übergeben',['Wissen, Zugänge, Backups und Fähigkeiten zugeordnet','Einführung neuer Mitarbeitender und Wiederherstellung geklärt']],
 ['weiter','Weiterentwicklung vereinbaren',['Pflege, Support und nächste Durchsicht vereinbart','Weitere Autonomie nur für separat bewertete Aufgaben und Grenzen']]])
];
export const firmaItems = firmaSteps.flatMap(step=>step.items);
export function firmaItem(id) {const item=firmaItems.find(x=>x.id===id);if(!item)throw new Error('Dieser Firmenpunkt ist nicht vorhanden.');return item;}
