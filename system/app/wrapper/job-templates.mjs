// Deutsche Adaptionen des Hermes-Katalogs; Herkunft und MIT-Lizenz: job-templates-sources.md.
export const jobCategories = ["Gespräche & Wissen", "Tagesplanung", "Kommunikation", "Recherche & Markt", "Organisation", "Lernen & Wohlbefinden"];
export const hermesSource = "https://github.com/NousResearch/hermes-agent/blob/089bb32886c8c18f7fa20182c7bf8826d6935ac5/cron/blueprint_catalog.py";
const entry = (id, name, category, description, cadence, schedule, needs, task, note = "") => ({
  id, name, category, description, cadence, schedule, needs, task, note,
  source: id === "interview" ? "Lokaler Interviewauftrag · verallgemeinert" : "Hermes · deutsch adaptiert",
  sourceUrl: id === "interview" ? null : hermesSource,
});
const manual = { type: "manual" };
const daily = time => ({ type: "daily", time });
const weekdays = time => ({ type: "weekdays", time });
const limited = "Dieser Hermes-Zeitplan wird hier noch nicht unterstützt. Die Vorlage startet deshalb nur manuell; täglich oder werktags kannst du im Formular wählen.";
export const jobTemplates = [
  entry("interview", "Interview · Betrieb kennenlernen", "Gespräche & Wissen",
    "In kurzen Gesprächsrunden Abläufe, Zuständigkeiten und Entlastungsmöglichkeiten erfassen.", "Bei Bedarf", manual,
    "Gesprächsziel und neue Antworten in input/antworten.md; bisherige Gesprächsnotizen in output/interview.md.",
    "Führe genau eine Gesprächsrunde aus. Lies vorhandene Antworten und Notizen. Erfasse neue bestätigte Angaben mit Datum, offene Punkte und Widersprüche. Stelle höchstens eine konkrete Anschlussfrage in ein bis drei kurzen deutschen Sätzen. Beginne ohne bisherigen Kontext mit: Welche wiederkehrende Aufgabe kostet dich im Alltag am meisten Zeit? Wiederhole keine offene Frage. Fehlt eine neue Antwort, notiere, dass die Antwort noch aussteht. Sobald Abläufe, Zuständigkeiten, Programme, Engpässe, Prioritäten und gewünschte Entlastung ausreichend klar sind, liefere einen konkreten nächsten Schritt. Speichere den Gesprächsstand in output/interview.md und die nächste Nachricht in output/naechste-frage.md. Verändere keine gemeinsame Firmenbasis automatisch."),
  entry("morning-brief", "Morgenbriefing", "Tagesplanung",
    "Termine, Wetter und dringende Aufgaben für den heutigen Tag auf einen Blick.", "Täglich um 08:00", daily("08:00"),
    "Kalender, Aufgaben und gegebenenfalls Postfach; Wetterort in input/konfiguration.md.",
    "Erstelle ein kurzes Morgenbriefing für das heutige lokale Datum: Termine mit Uhrzeit, Überschneidungen und Vorbereitung; Wetter für den angegebenen Ort; höchstens drei dringende Aufgaben. Verknüpfe relevante Nachrichten mit Terminen, wenn beide Quellen erreichbar sind. Nutze das genaue Tagesfenster von 00:00 bis zum nächsten Tagesbeginn. Fehlen Anschlüsse, nenne die konkrete Lücke; fehlende Termine sind keine Bestätigung eines freien Kalenders. Speichere output/morgenbriefing-DATUM.md. Liefere einen knappen Tagesüberblick mit dem wichtigsten nächsten Schritt."),
  entry("workday-start", "Arbeitsstart · Tagesprioritäten", "Tagesplanung",
    "Die heutige Agenda und die ein bis drei wichtigsten Aufgaben zum Arbeitsbeginn.", "Werktags um 09:00", weekdays("09:00"),
    "Kalender und aktuelle Aufgaben oder Notizen in input/.",
    "Prüfe die heutige Agenda und leite aus belegten Fristen und dem aktuellen Kontext ein bis drei Prioritäten ab. Kennzeichne deine Priorisierung als Vorschlag. Formuliere eine kurze, ermutigende Nachricht mit dem ersten machbaren Schritt."),
  entry("evening-winddown", "Feierabend · Morgen vorbereiten", "Tagesplanung",
    "Offene Enden abschließen und früh anstehende Termine für morgen vorbereiten.", "Täglich um 21:00", daily("21:00"),
    "Kalender und offene Aufgaben; optional Wetterort in input/konfiguration.md.",
    "Gib einen kurzen Ausblick auf den morgigen lokalen Kalendertag. Nenne frühe Verpflichtungen und was heute dafür vorbereitet werden sollte. Ergänze einen passenden Abschluss für offene Aufgaben. Ohne Kalender benenne die Lücke und ergänze nur bei bekanntem Ort das Wetter für morgen."),
  entry("weekly-review", "Wochenrückblick & Planung", "Organisation",
    "Erledigtes, offene Zusagen und verfügbare Zeit für die nächste Woche zusammenführen.", "Hermes: sonntags um 18:00", manual,
    "Kalender, Aufgaben, Notizen und optional E-Mails der vergangenen und kommenden Wochen.",
    "Prüfe die abgeschlossene Woche und die kommenden ein bis zwei Wochen. Gliedere in: Rückblick, Erledigtes, offene Zusagen, stockende Projekte, Warten auf andere, kommende Termine und realistische Wochenplanung. Berücksichtige vorhandene Kapazität und Puffer. Liefere Vorschläge und Entwürfe; ändere keine Termine oder Aufgaben im Quellsystem.", limited),
  entry("important-mail", "Wichtige E-Mails prüfen", "Kommunikation",
    "Neue Nachrichten auf Handlungsbedarf prüfen und Unwichtiges aus dem Bericht lassen.", "Hermes: alle 30 Minuten", manual,
    "Erreichbares Postfach und Relevanzkriterien in input/konfiguration.md, etwa Antwort heute nötig oder konkrete Frist.",
    "Prüfe neue E-Mails seit dem letzten erfolgreichen Lauf. Bewerte sie anhand der angegebenen Relevanzkriterien. Berichte nur relevante Nachrichten mit Absender, Betreff, belegtem Handlungsbedarf und Frist. Behalte den letzten erfolgreichen Prüfstand bei Zugriffsfehlern bei. Markiere, verschiebe und beantworte keine E-Mails.", limited),
  entry("news-digest", "Themenbriefing · Neue Entwicklungen", "Recherche & Markt",
    "Neue Meldungen zu einem gewählten Thema mit Quellen und ohne Wiederholungen sammeln.", "Werktags um 18:00", weekdays("18:00"),
    "Thema und bevorzugte Quellen in input/konfiguration.md; gewünschte Zahl von Meldungen, standardmäßig fünf.",
    "Recherchiere aktuelle relevante Entwicklungen zum konfigurierten Thema. Vergleiche mit den früheren Ergebnissen dieses Auftrags. Fasse höchstens fünf neue Entwicklungen in je einem kurzen Absatz mit Datum und anklickbarer Quelle zusammen. Bevorzuge Primärquellen und trenne Fakten von Einordnung. Fasse mehrere Artikel zum gleichen Ereignis zusammen."),
  entry("competitor-watch", "Wettbewerber beobachten", "Recherche & Markt",
    "Produktstarts, Preise und weitere relevante Veränderungen ausgewählter Unternehmen verfolgen.", "Hermes: montags um 09:00", manual,
    "Unternehmensnamen, Domains und relevante Ereignisarten in input/konfiguration.md.",
    "Bestätige beim ersten Lauf die Unternehmen und geeignete Quellen. Recherchiere seit dem letzten erfolgreichen Prüfstand relevante Ereignisse, beispielsweise Produktstarts, Preisänderungen, Finanzierung oder Partnerschaften. Fasse pro zugrunde liegendem Ereignis nur eine Meldung mit Beleg zusammen und erkläre kurz die Relevanz. Unbestätigte Meldungen bleiben ausdrücklich unbestätigt.", limited),
  entry("price-watch", "Preis & Verfügbarkeit beobachten", "Recherche & Markt",
    "Ein genau bestimmtes Produkt oder Reiseangebot gegen Preisziel und Verfügbarkeit prüfen.", "Hermes: alle sechs Stunden", manual,
    "Exakte URL oder Angebot mit Variante, Reisedaten und Anbieter; Zielpreis mit Währung oder Verfügbarkeitsbedingung in input/konfiguration.md.",
    "Prüfe beim ersten Lauf das genaue Angebot und einen aktuellen Abruf. Vergleiche den Gesamtpreis einschließlich erkennbarer Pflichtkosten sowie Verfügbarkeit mit der Bedingung. Melde neue Treffer mit Zeit und Quelle. Überschreibe bei Abruffehlern niemals den letzten verlässlichen Stand. Vermeide doppelte Trefferberichte. Kaufe und buche nichts.", limited),
  entry("custom-reminder", "Eigene Erinnerung", "Organisation",
    "Eine wiederkehrende Erinnerung in deinen eigenen Worten vorbereiten.", "Täglich um 14:00", daily("14:00"),
    "Erinnerungstext in input/konfiguration.md.",
    "Formuliere die konfigurierte Erinnerung als eine kurze, unmittelbar verständliche Nachricht. Ergänze keine erfundenen Termine oder Zusagen."),
  entry("bill-renewal-watch", "Zahlungen & Verlängerungen im Blick", "Organisation",
    "Vor bekannten Fälligkeiten und Vertragsverlängerungen an die Prüfung erinnern.", "Täglich um 10:00", daily("10:00"),
    "Vertrag oder Zahlung, belegte Fälligkeit und gewünschter Vorlauf in input/konfiguration.md.",
    "Prüfe die angegebenen Fälligkeiten und Vorlaufzeiten. Bereite bei Handlungsbedarf eine kurze Erinnerung vor: Was wird wann fällig, was sollte bis wann geprüft werden? Behaupte keine automatische Zahlung ohne Beleg. Führe keine Zahlung oder Kündigung aus."),
  entry("meal-plan", "Wochenmenü & Einkaufsliste", "Organisation",
    "Einen passenden Essensplan und eine nach Warengruppen sortierte Einkaufsliste erstellen.", "Hermes: sonntags um 17:00", manual,
    "Ernährungswünsche, Unverträglichkeiten, Personenzahl, Mahlzeiten pro Tag und Kochaufwand in input/konfiguration.md.",
    "Plane einfache Mahlzeiten für die kommende Woche passend zu den angegebenen Wünschen und dem verfügbaren Kochaufwand. Bündele Zutaten und Mengen zu einer Einkaufsliste nach Warengruppen. Nutze Reste sinnvoll. Kennzeichne angenommene Portionsgrößen. Bestelle keine Lebensmittel.", limited),
  entry("habit-checkin", "Gewohnheit · Kurz nachfragen", "Lernen & Wohlbefinden",
    "Freundlich und ohne Druck nach einer gewählten Gewohnheit fragen.", "Täglich um 20:00", daily("20:00"),
    "Gewohnheit und gegebenenfalls neue Antworten in input/.",
    "Bereite eine kurze Frage vor, ob die gewählte Gewohnheit heute gelungen ist. Bleibe freundlich und wertfrei. Bestätige vorhandene neue Antworten knapp und datiere sie im Auftragsverlauf. Erfinde keine Erfolge oder Serien."),
  entry("hydration-move", "Trinken & Bewegung", "Lernen & Wohlbefinden",
    "Im Arbeitsalltag an Wasser, Aufstehen und eine kurze Bewegungspause erinnern.", "Hermes: werktags stündlich von 09 bis 17 Uhr", manual,
    "Optional gewünschte Formulierung und Arbeitszeit in input/konfiguration.md.",
    "Bereite eine kurze freundliche Erinnerung vor, etwas Wasser zu trinken, aufzustehen und sich kurz zu bewegen. Variiere den Wortlaut behutsam. Gib keine individuellen medizinischen Vorgaben.", limited),
  entry("learn-daily", "Täglicher Lernimpuls", "Lernen & Wohlbefinden",
    "Ein Thema in kleinen aufeinander aufbauenden Lektionen kennenlernen.", "Werktags um 08:30", weekdays("08:30"),
    "Lernthema und Kenntnisstand in input/konfiguration.md; bisherige Lektionen in output/.",
    "Erstelle eine kleine Lektion zum konfigurierten Thema. Baue auf den bisherigen Lektionen und vorhandenen Antworten auf. Nutze zwei kurze Absätze, ein konkretes Beispiel und eine Verständnisfrage. Halte den Fortschritt fest und wiederhole Inhalte nur gezielt."),
  entry("gratitude-journal", "Tagesreflexion & Dankbarkeit", "Lernen & Wohlbefinden",
    "Mit einem kurzen Impuls das Gute am Tag festhalten.", "Täglich um 21:30", daily("21:30"),
    "Optional neue Antworten in input/antworten.md.",
    "Bereite einen warmen kurzen Tagesabschluss vor. Lade dazu ein, etwas Gelungenes, einen kleinen Erfolg oder einen Grund für Dankbarkeit festzuhalten. Gehe auf vorhandene Antworten freundlich ein und erfinde keine Erlebnisse."),
  entry("on-this-day", "Wissenshäppchen des Tages", "Lernen & Wohlbefinden",
    "Ein historisches Ereignis, Wort oder wissenschaftlicher Fakt als täglicher Impuls.", "Täglich um 07:30", daily("07:30"),
    "Gewünschte Art in input/konfiguration.md: Geschichte, Wort, Wissenschaft oder Zitat; Standard: Geschichte.",
    "Wähle einen interessanten, belegten Eintrag passend zum heutigen Datum oder der gewünschten Art. Erkläre ihn in ein bis zwei Sätzen und nenne eine verlässliche Quelle. Prüfe bei Zitaten den Wortlaut und die Zuschreibung; erfinde kein Zitat."),
];

export function templateInstructions(template) {
  return `# ${template.name}\n\nKategorie: ${template.category}\nVorlage: ${template.source}${template.sourceUrl ? `\nQuelle: ${template.sourceUrl}` : ""}\n\n## Zweck\n${template.description}\n\n## Benötigte Angaben\n${template.needs}\nErgänze die Angaben hier oder in input/konfiguration.md. Fehlen entscheidende Angaben, benenne sie konkret und bearbeite nur den bereits belegbaren Teil.\n\n## Ablauf\n${template.task}\n\n## Ergebnis und Verlauf\nSchreibe auf Deutsch. Speichere das Ergebnis im output/-Ordner dieses Auftrags als datierte Markdown-Datei und verlinke es in der Abschlussantwort. Lies für Folgeläufe nur den relevanten Auftragsverlauf. Halte bei Prüfaufträgen den letzten erfolgreichen Prüfstand und bereits berichtete Ereignisse in output/pruefstand.json fest. Ohne neue relevante Treffer genügt ein kurzer lokaler Status; die Hermes-Schweigemarke [SILENT] wird hier nicht verwendet.\n\n## Ausführung\nVorgeschlagener Takt: ${template.cadence}.${template.note ? ` ${template.note}` : ""}\nDie Vorlage wird pausiert gespeichert. Ergebnisse bleiben in der Schaltzentrale; ein Versand an Telegram, E-Mail oder andere Personen ist nicht eingerichtet und gehört nicht zu diesem Auftrag. Nutze nur tatsächlich verfügbare und autorisierte Quellen. Erfinde keine Firmen-, Kalender- oder Kontodaten.\n`;
}

export function jobFromTemplate(id) {
  const template = jobTemplates.find(t => t.id === id);
  if (!template) throw new Error("Vorlage nicht gefunden.");
  return { name: template.name, instructions: templateInstructions(template), worker: "auto", status: "paused", schedule: { ...template.schedule } };
}

export function filterJobTemplates(query = "", category = "all") {
  const needle = query.trim().toLocaleLowerCase("de");
  return jobTemplates.filter(t => (category === "all" || t.category === category) &&
    `${t.name} ${t.description} ${t.category} ${t.id}`.toLocaleLowerCase("de").includes(needle));
}
